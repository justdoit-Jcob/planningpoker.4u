import express, { Request, Response } from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket, RawData } from 'ws';
import dotenv from 'dotenv';
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
  POLLING,
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

/**
 * Połączenie klienta niezależne od transportu.
 *
 * Logika pokoi rozmawia wyłącznie z tym interfejsem, więc nie wie, czy klient
 * przyszedł WebSocketem, czy zapasowym long-pollingiem po HTTP.
 */
interface ClientConnection {
  send(payload: string): void;
  isOpen(): boolean;
}

interface ClientContext {
  roomId: string | null;
  userId: string | null;
  /** Znaczniki czasu ostatnich reakcji — throttling (P2-6). */
  reactionTimes: number[];
}
const connections = new Map<ClientConnection, ClientContext>();

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

function clientsInRoom(roomId: string): { client: ClientConnection; ctx: ClientContext }[] {
  const result: { client: ClientConnection; ctx: ClientContext }[] = [];
  connections.forEach((ctx, client) => {
    if (client.isOpen() && ctx.roomId === roomId) result.push({ client, ctx });
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

function sendError(conn: ClientConnection, code: ServerErrorCode, detail?: string): void {
  if (!conn.isOpen()) return;
  conn.send(JSON.stringify({ type: 'ERROR', code, ...(detail ? { detail } : {}) }));
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

/**
 * Usuwa wpisy uczestników, którzy nie są już połączeni.
 *
 * Wywoływane na starcie nowej rundy, żeby stół nie zbierał wyszarzonych
 * profili po osobach, które opuściły sesję.
 *
 * Świadomie NIE zeruje creatorId: twórca pokoju zachowuje prawo do roli
 * moderatora również wtedy, gdy jego wpis zniknął. Powrót z ważnym tokenem
 * odtwarza wpis pod tym samym identyfikatorem (patrz handleJoinRoom).
 * Nikt połączony nie zostanie usunięty, więc aktualny moderator jest bezpieczny.
 */
function purgeDisconnected(room: RoomState): boolean {
  let removed = false;
  for (const [id, p] of Object.entries(room.participants)) {
    if (!p.isConnected) {
      delete room.participants[id];
      removed = true;
    }
  }
  return removed;
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

/** Stan heartbeatu gniazd: false przed pingiem, true po pongu. */
const wsAlive = new WeakMap<WebSocket, boolean>();

setInterval(() => {
  wss.clients.forEach((client) => {
    if (!wsAlive.get(client)) {
      // Brak ponga od poprzedniej rundy — połączenie jest martwe.
      client.terminate();
      return;
    }
    wsAlive.set(client, false);
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

/* ---------- Obsługa połączeń (wspólna dla obu transportów) ---------- */

function openClient(conn: ClientConnection): ClientContext {
  const ctx: ClientContext = { roomId: null, userId: null, reactionTimes: [] };
  connections.set(conn, ctx);
  return ctx;
}

/** Przetwarza jedną wiadomość klienta, niezależnie od drogi, którą przyszła. */
function handleClientMessage(conn: ClientConnection, ctx: ClientContext, raw: unknown): void {
  try {
    const msg = parseClientMessage(raw);
    if (!msg) {
      sendError(conn, 'INVALID_MESSAGE');
      return;
    }

    // Keep-alive na poziomie aplikacji: odpowiadamy od razu i nie wymagamy
    // przynależności do pokoju. Utrzymuje ruch na tunelu, żeby proxy
    // z limitem bezczynności nie zamknęło cichego połączenia.
    if (msg.type === 'PING') {
      conn.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
      return;
    }

    if (msg.type === 'JOIN_ROOM') {
      handleJoinRoom(conn, ctx, msg);
      return;
    }

    // Każda pozostała akcja wymaga ustalonej tożsamości w pokoju.
    if (!ctx.roomId || !ctx.userId) return;
    const room = rooms.get(ctx.roomId);
    if (!room) {
      sendError(conn, 'ROOM_NOT_FOUND');
      return;
    }
    const me = room.participants[ctx.userId];
    if (!me) return;

    // P0-3: pojedyncza bramka autoryzacyjna zamiast sprawdzeń w handlerach.
    if (MODERATOR_ONLY.has(msg.type) && !isModerator(room, ctx.userId)) {
      sendError(conn, 'FORBIDDEN', msg.type);
      return;
    }

    me.lastSeen = Date.now();
    touchRoom(room);
    handleRoomMessage(conn, ctx, room, me, msg);
  } catch (err) {
    console.error('Error handling client message:', err);
  }
}

/** Rozłączenie klienta: zamknięte gniazdo albo wygasła sesja long-pollingu. */
function closeClient(conn: ClientConnection): void {
  const ctx = connections.get(conn);
  connections.delete(conn);
  if (!ctx || !ctx.roomId || !ctx.userId) return;
  const userId = ctx.userId;

  const room = rooms.get(ctx.roomId);
  if (!room) return;

  const participant = room.participants[userId];
  if (!participant) return;

  // Ten sam uczestnik może mieć otwartą drugą kartę — wtedy nadal jest online.
  const stillOpen = clientsInRoom(room.id).some((t) => t.ctx.userId === userId);
  if (stillOpen) return;

  participant.isConnected = false;
  participant.lastSeen = Date.now();

  reassignModerator(room);
  const revealed = checkAndAutoReveal(room);
  broadcastRoomState(room, revealed ? 'AUTO_REVEALED' : undefined);
}

/* ---------- Transport: WebSocket ---------- */

wss.on('connection', (ws: WebSocket) => {
  const conn: ClientConnection = {
    send: (payload) => ws.send(payload),
    isOpen: () => ws.readyState === WebSocket.OPEN,
  };
  const ctx = openClient(conn);
  wsAlive.set(ws, true);

  ws.on('pong', () => {
    wsAlive.set(ws, true);
  });

  ws.on('message', (data: RawData) => {
    let raw: unknown;
    try {
      raw = JSON.parse(data.toString());
    } catch {
      sendError(conn, 'INVALID_MESSAGE', 'Nieprawidłowy JSON');
      return;
    }
    handleClientMessage(conn, ctx, raw);
  });

  ws.on('close', () => closeClient(conn));
});

/* ---------- Transport zapasowy: HTTP long-polling ---------- */

/**
 * Część sieci firmowych (proxy z inspekcją TLS, bramki SWG) przepuszcza zwykłe
 * HTTPS, ale ucina upgrade do WebSocketu — strona się ładuje, a pokój nie.
 * Klient przechodzi wtedy na ten transport: ramki odbiera długo wstrzymanym
 * GET-em, a wysyła POST-em. Obie drogi kończą się na ClientConnection, więc
 * logika pokoi i jej zabezpieczenia są te same.
 *
 * Identyfikator sesji jest losowy i odpowiada samemu gniazdu — nie daje
 * tożsamości w pokoju; tę nadal potwierdza wyłącznie podpisany token.
 */
interface PollSession {
  id: string;
  conn: ClientConnection;
  ctx: ClientContext;
  /** Ramki czekające na odbiór — każda jest gotowym JSON-em. */
  queue: string[];
  /** Wstrzymana odpowiedź GET, na którą czeka klient. */
  waiting: Response | null;
  holdTimer: NodeJS.Timeout | null;
  flushScheduled: boolean;
  lastSeen: number;
  open: boolean;
}

const pollSessions = new Map<string, PollSession>();

function stopHold(session: PollSession): void {
  if (session.holdTimer) clearTimeout(session.holdTimer);
  session.holdTimer = null;
}

/** Oddaje zebrane ramki wstrzymanemu GET-owi. */
function flushPoll(session: PollSession): void {
  const res = session.waiting;
  if (!res) return;
  session.waiting = null;
  stopHold(session);
  session.lastSeen = Date.now();
  res.type('application/json').send(`[${session.queue.splice(0).join(',')}]`);
}

function enqueueFrame(session: PollSession, payload: string): void {
  if (!session.open) return;
  session.queue.push(payload);

  if (session.queue.length > POLLING.maxQueuedFrames) {
    // Klient przestał odbierać. Zamykamy poza bieżącym rozsyłaniem stanu.
    setImmediate(() => closePollSession(session));
    return;
  }

  // Ramki z jednego przebiegu (np. IDENTITY + ROOM_STATE) jadą jedną odpowiedzią.
  if (session.flushScheduled) return;
  session.flushScheduled = true;
  setImmediate(() => {
    session.flushScheduled = false;
    flushPoll(session);
  });
}

function createPollSession(): PollSession {
  const conn: ClientConnection = {
    send: (payload) => enqueueFrame(session, payload),
    isOpen: () => session.open,
  };
  const session: PollSession = {
    id: randomUUID(),
    conn,
    ctx: openClient(conn),
    queue: [],
    waiting: null,
    holdTimer: null,
    flushScheduled: false,
    lastSeen: Date.now(),
    open: true,
  };
  pollSessions.set(session.id, session);
  return session;
}

function closePollSession(session: PollSession): void {
  if (!session.open) return;
  session.open = false;
  pollSessions.delete(session.id);
  stopHold(session);
  if (session.waiting) {
    session.waiting.status(410).json({ error: 'Session closed' });
    session.waiting = null;
  }
  closeClient(session.conn);
}

function findPollSession(req: Request, res: Response): PollSession | null {
  const sid = typeof req.query.sid === 'string' ? req.query.sid : '';
  const session = pollSessions.get(sid);
  if (!session) {
    // 410: klient zakłada nowe połączenie, tak jak po zamknięciu gniazda.
    res.status(410).json({ error: 'Session closed' });
    return null;
  }
  session.lastSeen = Date.now();
  return session;
}

setInterval(() => {
  const now = Date.now();
  pollSessions.forEach((session) => {
    // Wstrzymany GET oznacza żywego klienta; bez niego liczy się ostatni kontakt.
    if (!session.waiting && now - session.lastSeen > POLLING.sessionTtlMs) {
      closePollSession(session);
    }
  });
}, POLLING.sweepIntervalMs);

// Proxy po drodze nie może zbuforować ani oddać nikomu tych odpowiedzi.
app.use('/api/rt', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

app.post('/api/rt/open', (_req, res) => {
  if (pollSessions.size >= POLLING.maxSessions) {
    res.status(503).json({ error: 'Too many sessions' });
    return;
  }
  res.json({ sid: createPollSession().id });
});

app.get('/api/rt/poll', (req, res) => {
  const session = findPollSession(req, res);
  if (!session) return;

  // Nowszy GET wypiera starszy (np. ponowiony przez proxy) — ramki czekają na nowy.
  if (session.waiting) {
    const previous = session.waiting;
    session.waiting = null;
    stopHold(session);
    previous.type('application/json').send('[]');
  }

  session.waiting = res;
  if (session.queue.length > 0) {
    flushPoll(session);
    return;
  }

  session.holdTimer = setTimeout(() => flushPoll(session), POLLING.holdMs);
  res.on('close', () => {
    // Klient zerwał GET (zamknięta karta, przerwana sieć). Ramki czekają
    // w kolejce, a brak kolejnego GET-a zamknie sesję po sessionTtlMs.
    if (session.waiting !== res) return;
    session.waiting = null;
    stopHold(session);
    session.lastSeen = Date.now();
  });
});

app.post('/api/rt/send', (req, res) => {
  const session = findPollSession(req, res);
  if (!session) return;

  const frames: unknown[] = Array.isArray(req.body) ? req.body : [req.body];
  if (frames.length > POLLING.maxBatch) {
    res.status(413).json({ error: 'Too many messages' });
    return;
  }
  for (const raw of frames) {
    if (!session.open) break;
    handleClientMessage(session.conn, session.ctx, raw);
  }
  res.status(204).end();
});

app.post('/api/rt/close', (req, res) => {
  const sid = typeof req.query.sid === 'string' ? req.query.sid : '';
  const session = pollSessions.get(sid);
  if (session) closePollSession(session);
  res.status(204).end();
});

/* ---------- Dołączanie do pokoju ---------- */

function handleJoinRoom(
  conn: ClientConnection,
  ctx: ClientContext,
  msg: Extract<ClientMessage, { type: 'JOIN_ROOM' }>
): void {
  const { roomId, user, resume } = msg;
  const room = getOrCreateRoom(roomId, msg.roomName);
  const now = Date.now();

  let userId: string | null = null;

  // P0-4: prawo do konkretnego identyfikatora daje podpisany token, nie samo id.
  if (resume && verifyIdentity(roomId, resume.userId, resume.token)) {
    userId = resume.userId;
  }

  // Wpis mógł zostać usunięty przy starcie nowej rundy. Token pozostaje ważny,
  // więc odtwarzamy go pod tym samym identyfikatorem — dzięki temu twórca
  // pokoju nie traci prawa do roli moderatora tylko dlatego, że wyszedł
  // na chwilę między rundami.
  const existing = userId !== null ? room.participants[userId] : undefined;
  if (!userId) userId = randomUUID();

  ctx.roomId = roomId;
  ctx.userId = userId;

  const preferredRole: SelfAssignableRole = user.role;

  if (existing) {
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
  conn.send(
    JSON.stringify({
      type: 'IDENTITY',
      userId,
      token: signIdentity(roomId, userId),
      roomId,
    })
  );

  conn.send(JSON.stringify({ type: 'ROOM_STATE', room: serializeRoomFor(room, userId) }));

  const revealed = checkAndAutoReveal(room);
  broadcastRoomState(room, revealed ? 'AUTO_REVEALED' : undefined);
}

/* ---------- Pozostałe akcje ---------- */

function handleRoomMessage(
  conn: ClientConnection,
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
        sendError(conn,'INVALID_MESSAGE', 'Karta spoza talii');
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
      // Nowa runda zaczyna się bez profili osób, które wyszły z sesji.
      if (purgeDisconnected(room)) reassignModerator(room);
      broadcastRoomState(room);
      break;
    }

    case 'COMPLETE_ROUND': {
      // P2-4: rundę zamykamy dopiero po odkryciu kart.
      if (room.votingState !== 'revealed') {
        sendError(conn,'FORBIDDEN', 'Runda nie została odkryta');
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
      // Nowa runda zaczyna się bez profili osób, które wyszły z sesji.
      if (purgeDisconnected(room)) reassignModerator(room);

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
        sendError(conn,'RATE_LIMITED', 'Zbyt wiele reakcji');
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
    // Import dynamiczny, nie na górze pliku: dzięki temu Vite nie wchodzi
    // w graf zależności builda produkcyjnego. Obraz kontenera nie musi
    // wtedy w ogóle zawierać narzędzi deweloperskich.
    const { createServer: createViteServer } = await import('vite');
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
