import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket, RawData } from 'ws';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { createHmac, randomUUID, randomBytes, timingSafeEqual } from 'crypto';
import {
  RoomState,
  Participant,
  DeckType,
  DECK_PRESETS,
  ParticipantRole,
  SelfAssignableRole,
  getRequiredVoters,
} from './src/types';
import {
  ClientMessage,
  LIFECYCLE,
  LIMITS,
  MODERATOR_ONLY,
  ServerErrorCode,
  parseClientMessage,
} from './src/protocol';
import { calculateVoteStats } from './src/utils/stats';

dotenv.config();

const app = express();
// P1-6: Cloud Run i większość PaaS wstrzykuje port przez zmienną środowiskową.
const PORT = Number(process.env.PORT) || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

/**
 * P0-4: sekret podpisujący tożsamości uczestników.
 *
 * Bez SESSION_SECRET generujemy losowy przy starcie — tokeny przestają wtedy
 * być ważne po restarcie, co i tak jest spójne ze stanem trzymanym w pamięci.
 */
const SESSION_SECRET = process.env.SESSION_SECRET || randomBytes(32).toString('hex');

app.use(express.json({ limit: '32kb' }));

// Stan pokoi w pamięci procesu.
const rooms = new Map<string, RoomState>();

interface ClientContext {
  roomId: string | null;
  userId: string | null;
  /** Heartbeat (P1-2): ustawiane na false przed pingiem, na true przy pongu. */
  isAlive: boolean;
  /** Znaczniki czasu ostatnich reakcji — throttling (P2-6). */
  reactionTimes: number[];
}
const clientContextMap = new WeakMap<WebSocket, ClientContext>();

/* ---------- Tożsamość uczestnika (P0-4) ---------- */

function signIdentity(roomId: string, userId: string): string {
  return createHmac('sha256', SESSION_SECRET).update(`${roomId}:${userId}`).digest('hex');
}

function verifyIdentity(roomId: string, userId: string, token: string): boolean {
  const expected = Buffer.from(signIdentity(roomId, userId), 'utf8');
  const provided = Buffer.from(token, 'utf8');
  if (expected.length !== provided.length) return false;
  return timingSafeEqual(expected, provided);
}

/* ---------- Pokoje ---------- */

function createRoom(roomId: string, initialName?: string): RoomState {
  const now = Date.now();
  const room: RoomState = {
    id: roomId,
    name: initialName || `Sprint Planning #${roomId.substring(0, 4).toUpperCase()}`,
    topic: '',
    round: 1,
    deckType: 'fibonacci',
    customDeck: DECK_PRESETS.fibonacci,
    votingState: 'voting',
    participants: {},
    timer: { duration: 90, remaining: 90, isRunning: false },
    autoReveal: false,
    showAverage: true,
    history: [],
    creatorId: null,
    joinCounter: 0,
    lastActivity: now,
  };
  rooms.set(roomId, room);
  return room;
}

function getOrCreateRoom(roomId: string, initialName?: string): RoomState {
  return rooms.get(roomId) ?? createRoom(roomId, initialName);
}

function touchRoom(room: RoomState): void {
  room.lastActivity = Date.now();
}

/* ---------- Redakcja stanu (P0-1) ---------- */

/**
 * Buduje widok pokoju dla konkretnego odbiorcy.
 *
 * Przed odkryciem kart każdy widzi wyłącznie własny głos; cudze przychodzą
 * jako null. Fakt oddania głosu niesie osobne pole hasVoted, więc UI nadal
 * może pokazać „gotowy”, nie znając wartości karty.
 */
function serializeRoomFor(room: RoomState, viewerId: string | null): RoomState {
  const revealed = room.votingState === 'revealed';

  const participants: Record<string, Participant> = {};
  for (const [id, p] of Object.entries(room.participants)) {
    participants[id] = {
      ...p,
      vote: revealed || id === viewerId ? p.vote : null,
      hasVoted: p.vote !== null,
    };
  }

  return { ...room, participants };
}

/* ---------- Rozsyłanie ---------- */

function clientsInRoom(roomId: string): { client: WebSocket; ctx: ClientContext }[] {
  const result: { client: WebSocket; ctx: ClientContext }[] = [];
  wss.clients.forEach((client) => {
    if (client.readyState !== WebSocket.OPEN) return;
    const ctx = clientContextMap.get(client);
    if (ctx && ctx.roomId === roomId) result.push({ client, ctx });
  });
  return result;
}

/** Rozsyła stan pokoju, redagując głosy osobno dla każdego odbiorcy. */
function broadcastRoomState(room: RoomState, action?: string): void {
  const targets = clientsInRoom(room.id);
  if (targets.length === 0) return;

  // Po odkryciu kart wszyscy widzą to samo — wystarczy jedna serializacja.
  if (room.votingState === 'revealed') {
    const payload = JSON.stringify({
      type: 'STATE_UPDATE',
      room: serializeRoomFor(room, null),
      ...(action ? { action } : {}),
    });
    targets.forEach(({ client }) => client.send(payload));
    return;
  }

  targets.forEach(({ client, ctx }) => {
    client.send(
      JSON.stringify({
        type: 'STATE_UPDATE',
        room: serializeRoomFor(room, ctx.userId),
        ...(action ? { action } : {}),
      })
    );
  });
}

/** Rozsyła wiadomość, która nie zawiera głosów (timer, reakcje). */
function broadcastRaw(roomId: string, message: object): void {
  const payload = JSON.stringify(message);
  clientsInRoom(roomId).forEach(({ client }) => client.send(payload));
}

function sendError(ws: WebSocket, code: ServerErrorCode, detail?: string): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: 'ERROR', code, ...(detail ? { detail } : {}) }));
}

/* ---------- Moderator: nadanie i sukcesja (P0-5) ---------- */

/**
 * Wyznacza moderatora pokoju.
 *
 * Reguła: funkcję trzyma twórca pokoju. Gdy jest offline, przechodzi ona na
 * kolejnego uczestnika według kolejności dołączania. Powrót twórcy odbiera
 * funkcję zastępcy i oddaje ją twórcy.
 *
 * Zwraca true, jeśli którakolwiek rola faktycznie się zmieniła.
 */
function reassignModerator(room: RoomState): boolean {
  const connected = Object.values(room.participants).filter((p) => p.isConnected);

  let chosen: Participant | null = null;

  if (room.creatorId) {
    const creator = room.participants[room.creatorId];
    if (creator && creator.isConnected) chosen = creator;
  }

  if (!chosen && connected.length > 0) {
    chosen = connected.reduce((best, p) => (p.joinOrder < best.joinOrder ? p : best));
  }

  let changed = false;
  for (const p of Object.values(room.participants)) {
    const nextRole: ParticipantRole = chosen && p.id === chosen.id ? 'moderator' : p.preferredRole;
    if (p.role !== nextRole) {
      p.role = nextRole;
      // Obserwator nie trzyma głosu z poprzedniej roli.
      if (nextRole === 'observer') {
        p.vote = null;
        p.hasVoted = false;
      }
      changed = true;
    }
  }

  return changed;
}

function isModerator(room: RoomState, userId: string | null): boolean {
  if (!userId) return false;
  return room.participants[userId]?.role === 'moderator';
}

/* ---------- Automatyczne odkrycie (P2-5) ---------- */

/**
 * Odkrywa karty, gdy wszyscy wymagani głosujący oddali głos.
 *
 * Moderator jest z tego zbioru wyłączony — może estymować, ale nie musi (P2-1),
 * więc nigdy nie blokuje odkrycia.
 */
function checkAndAutoReveal(room: RoomState): boolean {
  if (!room.autoReveal || room.votingState === 'revealed') return false;

  const required = getRequiredVoters(room);
  if (required.length === 0) return false;
  if (!required.every((p) => p.vote !== null)) return false;

  room.votingState = 'revealed';
  return true;
}

/** Czyści głosy i wraca do fazy głosowania. */
function clearVotes(room: RoomState): void {
  room.votingState = 'voting';
  Object.values(room.participants).forEach((p) => {
    p.vote = null;
    p.hasVoted = false;
  });
}

function resetTimer(room: RoomState): void {
  if (room.timer.duration > 0) {
    room.timer.remaining = room.timer.duration;
    room.timer.isRunning = false;
    room.timer.endTime = undefined;
  }
}

/* ---------- Serwer ---------- */

const server = http.createServer(app);
// P2-7: ścieżka jest teraz jawna, a ramki mają górny limit rozmiaru (P2-6).
const wss = new WebSocketServer({
  server,
  path: '/ws',
  maxPayload: LIMITS.wsPayloadBytes,
});

/* ---------- Pętla timera ---------- */

setInterval(() => {
  const now = Date.now();
  rooms.forEach((room) => {
    if (!room.timer.isRunning || !room.timer.endTime) return;

    const remaining = Math.max(0, Math.ceil((room.timer.endTime - now) / 1000));
    if (remaining === room.timer.remaining) return;

    room.timer.remaining = remaining;
    if (remaining === 0) {
      room.timer.isRunning = false;
      room.timer.endTime = undefined;
      broadcastRaw(room.id, { type: 'TIMER_FINISHED', timer: room.timer });
    } else {
      broadcastRaw(room.id, { type: 'TIMER_TICK', timer: room.timer });
    }
  });
}, 1000);

/* ---------- Heartbeat (P1-2) ---------- */

setInterval(() => {
  wss.clients.forEach((client) => {
    const ctx = clientContextMap.get(client);
    if (!ctx) return;
    if (!ctx.isAlive) {
      // Brak ponga od poprzedniej rundy — połączenie jest martwe.
      client.terminate();
      return;
    }
    ctx.isAlive = false;
    try {
      client.ping();
    } catch {
      client.terminate();
    }
  });
}, LIFECYCLE.heartbeatIntervalMs);

/* ---------- Sprzątanie pokoi i uczestników (P1-4) ---------- */

setInterval(() => {
  const now = Date.now();

  rooms.forEach((room, roomId) => {
    let participantsRemoved = false;

    for (const [id, p] of Object.entries(room.participants)) {
      if (!p.isConnected && now - p.lastSeen > LIFECYCLE.participantTtlMs) {
        delete room.participants[id];
        participantsRemoved = true;
      }
    }

    if (participantsRemoved) {
      // Twórca, który nie wrócił, przestaje blokować sukcesję.
      if (room.creatorId && !room.participants[room.creatorId]) {
        room.creatorId = null;
      }
      const rolesChanged = reassignModerator(room);
      if (participantsRemoved || rolesChanged) broadcastRoomState(room);
    }

    const hasConnected = Object.values(room.participants).some((p) => p.isConnected);
    if (!hasConnected && now - room.lastActivity > LIFECYCLE.roomTtlMs) {
      rooms.delete(roomId);
    }
  });
}, LIFECYCLE.sweepIntervalMs);

/* ---------- Obsługa połączeń ---------- */

wss.on('connection', (ws: WebSocket) => {
  const ctx: ClientContext = { roomId: null, userId: null, isAlive: true, reactionTimes: [] };
  clientContextMap.set(ws, ctx);

  ws.on('pong', () => {
    ctx.isAlive = true;
  });

  ws.on('message', (data: RawData) => {
    try {
      let raw: unknown;
      try {
        raw = JSON.parse(data.toString());
      } catch {
        sendError(ws, 'INVALID_MESSAGE', 'Nieprawidłowy JSON');
        return;
      }

      const msg = parseClientMessage(raw);
      if (!msg) {
        sendError(ws, 'INVALID_MESSAGE');
        return;
      }

      if (msg.type === 'JOIN_ROOM') {
        handleJoinRoom(ws, ctx, msg);
        return;
      }

      // Każda pozostała akcja wymaga ustalonej tożsamości w pokoju.
      if (!ctx.roomId || !ctx.userId) return;
      const room = rooms.get(ctx.roomId);
      if (!room) {
        sendError(ws, 'ROOM_NOT_FOUND');
        return;
      }
      const me = room.participants[ctx.userId];
      if (!me) return;

      // P0-3: pojedyncza bramka autoryzacyjna zamiast sprawdzeń w handlerach.
      if (MODERATOR_ONLY.has(msg.type) && !isModerator(room, ctx.userId)) {
        sendError(ws, 'FORBIDDEN', msg.type);
        return;
      }

      me.lastSeen = Date.now();
      touchRoom(room);
      handleRoomMessage(ws, ctx, room, me, msg);
    } catch (err) {
      console.error('Error handling WebSocket message:', err);
    }
  });

  ws.on('close', () => {
    if (!ctx.roomId || !ctx.userId) return;
    const room = rooms.get(ctx.roomId);
    if (!room) return;

    const participant = room.participants[ctx.userId];
    if (!participant) return;

    // Ten sam uczestnik może mieć otwartą drugą kartę — wtedy nadal jest online.
    const stillOpen = clientsInRoom(room.id).some(
      (t) => t.client !== ws && t.ctx.userId === ctx.userId
    );
    if (stillOpen) return;

    participant.isConnected = false;
    participant.lastSeen = Date.now();

    reassignModerator(room);
    const revealed = checkAndAutoReveal(room);
    broadcastRoomState(room, revealed ? 'AUTO_REVEALED' : undefined);
  });
});

/* ---------- Dołączanie do pokoju ---------- */

function handleJoinRoom(
  ws: WebSocket,
  ctx: ClientContext,
  msg: Extract<ClientMessage, { type: 'JOIN_ROOM' }>
): void {
  const { roomId, user, resume } = msg;
  const room = getOrCreateRoom(roomId, msg.roomName);
  const now = Date.now();

  let userId: string | null = null;

  // P0-4: wejście w istniejący wpis wymaga podpisanego tokenu, nie samego id.
  if (resume && room.participants[resume.userId] && verifyIdentity(roomId, resume.userId, resume.token)) {
    userId = resume.userId;
  }

  const isResuming = userId !== null;
  if (!userId) userId = randomUUID();

  ctx.roomId = roomId;
  ctx.userId = userId;

  const preferredRole: SelfAssignableRole = user.role;

  if (isResuming) {
    const existing = room.participants[userId];
    existing.name = user.name;
    existing.avatarColor = user.avatarColor;
    existing.preferredRole = preferredRole;
    existing.isConnected = true;
    existing.lastSeen = now;
  } else {
    room.participants[userId] = {
      id: userId,
      name: user.name,
      // Rola efektywna zostanie ustalona przez reassignModerator poniżej.
      role: preferredRole,
      preferredRole,
      avatarColor: user.avatarColor,
      vote: null,
      hasVoted: false,
      isConnected: true,
      joinedAt: now,
      joinOrder: ++room.joinCounter,
      lastSeen: now,
    };

    // P0-5: pierwszy uczestnik jest twórcą pokoju i wraca na moderatora po powrocie.
    if (!room.creatorId) room.creatorId = userId;
  }

  reassignModerator(room);
  touchRoom(room);

  // Token tożsamości — klient odsyła go przy wznowieniu połączenia.
  ws.send(
    JSON.stringify({
      type: 'IDENTITY',
      userId,
      token: signIdentity(roomId, userId),
      roomId,
    })
  );

  ws.send(JSON.stringify({ type: 'ROOM_STATE', room: serializeRoomFor(room, userId) }));

  const revealed = checkAndAutoReveal(room);
  broadcastRoomState(room, revealed ? 'AUTO_REVEALED' : undefined);
}

/* ---------- Pozostałe akcje ---------- */

function handleRoomMessage(
  ws: WebSocket,
  ctx: ClientContext,
  room: RoomState,
  me: Participant,
  msg: ClientMessage
): void {
  switch (msg.type) {
    case 'VOTE': {
      if (room.votingState === 'revealed') return;
      if (me.role === 'observer') return;
      // P1-5: karta musi pochodzić z aktualnej talii.
      if (!room.customDeck.includes(msg.card)) {
        sendError(ws, 'INVALID_MESSAGE', 'Karta spoza talii');
        return;
      }

      me.vote = msg.card;
      me.hasVoted = true;

      const revealed = checkAndAutoReveal(room);
      broadcastRoomState(room, revealed ? 'AUTO_REVEALED' : undefined);
      break;
    }

    case 'REVEAL': {
      if (room.votingState === 'revealed') return;
      room.votingState = 'revealed';
      broadcastRoomState(room);
      break;
    }

    case 'RESET_ROUND': {
      // P2-3: reset czyści stół, ale nie podbija numeru rundy.
      clearVotes(room);
      resetTimer(room);
      broadcastRoomState(room);
      break;
    }

    case 'COMPLETE_ROUND': {
      // P2-4: rundę zamykamy dopiero po odkryciu kart.
      if (room.votingState !== 'revealed') {
        sendError(ws, 'FORBIDDEN', 'Runda nie została odkryta');
        return;
      }

      const stats = calculateVoteStats(room.participants);
      const fallback =
        stats.mode.length > 0
          ? stats.mode[0]
          : stats.median !== null
          ? String(stats.median)
          : '—';

      room.history.push({
        round: room.round,
        topic: room.topic || `Runda #${room.round}`,
        consensusScore: msg.score || fallback,
        stats,
        timestamp: Date.now(),
      });

      // P1-4: historia jako bufor o stałym rozmiarze.
      if (room.history.length > LIMITS.historyEntries) {
        room.history.splice(0, room.history.length - LIMITS.historyEntries);
      }

      room.round += 1;
      room.topic = '';
      clearVotes(room);
      resetTimer(room);

      broadcastRoomState(room);
      break;
    }

    case 'UPDATE_TOPIC': {
      room.topic = msg.topic;
      broadcastRoomState(room);
      break;
    }

    case 'CLEAR_HISTORY': {
      room.history = [];
      broadcastRoomState(room);
      break;
    }

    case 'CHANGE_DECK': {
      room.deckType = msg.deckType as DeckType;
      room.customDeck =
        msg.customDeck ?? DECK_PRESETS[msg.deckType] ?? DECK_PRESETS.fibonacci;

      // Głosy z poprzedniej talii przestają mieć sens.
      clearVotes(room);
      broadcastRoomState(room);
      break;
    }

    case 'TIMER_ACTION': {
      const { action, duration } = msg;

      if (action === 'start') {
        // Start przy wyzerowanym liczniku wraca do pełnego czasu.
        if (room.timer.remaining <= 0) room.timer.remaining = room.timer.duration;
        room.timer.isRunning = true;
        room.timer.endTime = Date.now() + room.timer.remaining * 1000;
      } else if (action === 'pause') {
        room.timer.isRunning = false;
        if (room.timer.endTime) {
          room.timer.remaining = Math.max(
            0,
            Math.ceil((room.timer.endTime - Date.now()) / 1000)
          );
          room.timer.endTime = undefined;
        }
      } else if (action === 'reset') {
        room.timer.isRunning = false;
        room.timer.remaining = room.timer.duration;
        room.timer.endTime = undefined;
      } else if (action === 'set' && typeof duration === 'number') {
        room.timer.duration = duration;
        room.timer.remaining = duration;
        room.timer.isRunning = false;
        room.timer.endTime = undefined;
      }

      broadcastRoomState(room);
      break;
    }

    case 'UPDATE_ROLE': {
      // P0-2: klient wybiera wyłącznie spośród ról samodzielnych.
      me.preferredRole = msg.role;

      if (me.role === 'moderator') {
        // Moderator zachowuje funkcję; wybór 'observer' oznacza rezygnację
        // z estymowania w tej rundzie (P2-1).
        if (msg.role === 'observer') {
          me.vote = null;
          me.hasVoted = false;
        }
      } else {
        me.role = msg.role;
        if (msg.role === 'observer') {
          me.vote = null;
          me.hasVoted = false;
        }
      }

      const revealed = checkAndAutoReveal(room);
      broadcastRoomState(room, revealed ? 'AUTO_REVEALED' : undefined);
      break;
    }

    case 'UPDATE_SETTINGS': {
      const { settings } = msg;
      if (settings.autoReveal !== undefined) room.autoReveal = settings.autoReveal;
      if (settings.showAverage !== undefined) room.showAverage = settings.showAverage;
      if (settings.roomName !== undefined) room.name = settings.roomName;

      // Włączenie autoReveal, gdy wszyscy już zagłosowali, odkrywa od razu (P2-5).
      const revealed = checkAndAutoReveal(room);
      broadcastRoomState(room, revealed ? 'AUTO_REVEALED' : undefined);
      break;
    }

    case 'SEND_REACTION': {
      const now = Date.now();
      ctx.reactionTimes = ctx.reactionTimes.filter(
        (t) => now - t < LIMITS.reactionWindowMs
      );
      if (ctx.reactionTimes.length >= LIMITS.reactionBurst) {
        sendError(ws, 'RATE_LIMITED', 'Zbyt wiele reakcji');
        return;
      }
      ctx.reactionTimes.push(now);

      broadcastRaw(room.id, {
        type: 'REACTION',
        reaction: {
          id: randomUUID(),
          emoji: msg.emoji,
          userId: me.id,
          userName: me.name,
          timestamp: now,
        },
      });
      break;
    }
  }
}

/* ---------- REST ---------- */

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', roomsCount: rooms.size });
});

/**
 * P1-3: odczyt nie tworzy pokoju.
 * Głosy przechodzą przez tę samą redakcję co WebSocket — bez tego endpoint
 * byłby drugą, prostszą drogą do podejrzenia cudzych kart.
 */
app.get('/api/rooms/:roomId', (req, res) => {
  const room = rooms.get(req.params.roomId.toUpperCase());
  if (!room) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }
  res.json(serializeRoomFor(room, null));
});

/* ---------- Start ---------- */

async function start() {
  if (!IS_PRODUCTION) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // Fallback SPA jako middleware — działa tak samo w Express 4 i 5,
    // w przeciwieństwie do wzorca trasy '*'.
    app.use((_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(
      `Planning Poker Server listening on port ${PORT} (${IS_PRODUCTION ? 'production' : 'development'})`
    );
  });
}

start();
