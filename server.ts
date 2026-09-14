import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import {
  RoomState,
  Participant,
  DeckType,
  DECK_PRESETS,
  ParticipantRole,
} from './src/types';
import { calculateVoteStats } from './src/utils/stats';

dotenv.config();

const app = express();
const PORT = 3000;
app.use(express.json());

// In-memory Room State Store
const rooms = new Map<string, RoomState>();

// Map WebSocket to its current roomId and userId
interface ClientContext {
  roomId: string | null;
  userId: string | null;
}
const clientContextMap = new WeakMap<WebSocket, ClientContext>();

function getOrCreateRoom(roomId: string, initialName?: string): RoomState {
  let room = rooms.get(roomId);
  if (!room) {
    room = {
      id: roomId,
      name: initialName || `Sprint Planning #${roomId.substring(0, 4).toUpperCase()}`,
      topic: '',
      round: 1,
      deckType: 'fibonacci',
      customDeck: DECK_PRESETS.fibonacci,
      votingState: 'voting',
      participants: {},
      timer: {
        duration: 90,
        remaining: 90,
        isRunning: false,
      },
      autoReveal: false,
      showAverage: true,
      history: [],
    };
    rooms.set(roomId, room);
  }
  return room;
}

// Server setup
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

function broadcastToRoom(roomId: string, message: object) {
  const payload = JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      const ctx = clientContextMap.get(client);
      if (ctx && ctx.roomId === roomId) {
        client.send(payload);
      }
    }
  });
}

function checkAndAutoReveal(room: RoomState) {
  if (!room.autoReveal || room.votingState === 'revealed') return;

  const activeVoters = Object.values(room.participants).filter(
    (p) => p.role === 'voter' && p.isConnected
  );

  if (activeVoters.length > 0 && activeVoters.every((p) => p.vote !== null)) {
    room.votingState = 'revealed';
    broadcastToRoom(room.id, {
      type: 'STATE_UPDATE',
      room,
      action: 'AUTO_REVEALED',
    });
  }
}

// Global Timer loop
setInterval(() => {
  const now = Date.now();
  rooms.forEach((room) => {
    if (room.timer.isRunning && room.timer.endTime) {
      const remaining = Math.max(0, Math.ceil((room.timer.endTime - now) / 1000));
      if (remaining !== room.timer.remaining) {
        room.timer.remaining = remaining;
        if (remaining === 0) {
          room.timer.isRunning = false;
          broadcastToRoom(room.id, {
            type: 'TIMER_FINISHED',
            timer: room.timer,
          });
        } else {
          broadcastToRoom(room.id, {
            type: 'TIMER_TICK',
            timer: room.timer,
          });
        }
      }
    }
  });
}, 1000);

// WebSocket connection handling
wss.on('connection', (ws: WebSocket) => {
  clientContextMap.set(ws, { roomId: null, userId: null });

  ws.on('message', (data: string) => {
    try {
      const msg = JSON.parse(data.toString());
      const ctx = clientContextMap.get(ws);
      if (!ctx) return;

      switch (msg.type) {
        case 'PING': {
          ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
          break;
        }

        case 'JOIN_ROOM': {
          const { roomId, user } = msg;
          ctx.roomId = roomId;
          ctx.userId = user.id;

          const room = getOrCreateRoom(roomId, msg.roomName);
          const isFirstUser = Object.keys(room.participants).length === 0;

          const participant: Participant = {
            id: user.id,
            name: user.name || 'Developer',
            role: user.role || (isFirstUser ? 'moderator' : 'voter'),
            avatarColor: user.avatarColor || '#3B82F6',
            vote: null,
            isConnected: true,
            joinedAt: Date.now(),
          };

          room.participants[user.id] = participant;

          ws.send(
            JSON.stringify({
              type: 'ROOM_STATE',
              room,
            })
          );

          broadcastToRoom(roomId, {
            type: 'STATE_UPDATE',
            room,
          });
          break;
        }

        case 'VOTE': {
          const { card } = msg;
          if (!ctx.roomId || !ctx.userId) return;
          const room = rooms.get(ctx.roomId);
          if (!room || room.votingState === 'revealed') return;

          const participant = room.participants[ctx.userId];
          if (!participant || participant.role === 'observer') return;

          participant.vote = card;

          broadcastToRoom(ctx.roomId, {
            type: 'STATE_UPDATE',
            room,
          });

          checkAndAutoReveal(room);
          break;
        }

        case 'REVEAL': {
          if (!ctx.roomId) return;
          const room = rooms.get(ctx.roomId);
          if (!room) return;

          room.votingState = 'revealed';

          broadcastToRoom(ctx.roomId, {
            type: 'STATE_UPDATE',
            room,
          });
          break;
        }

        case 'RESET_ROUND': {
          if (!ctx.roomId) return;
          const room = rooms.get(ctx.roomId);
          if (!room) return;

          room.votingState = 'voting';
          room.round += 1;
          Object.values(room.participants).forEach((p) => {
            p.vote = null;
          });

          // Reset timer if set
          if (room.timer.duration > 0) {
            room.timer.remaining = room.timer.duration;
            room.timer.isRunning = false;
            room.timer.endTime = undefined;
          }

          broadcastToRoom(ctx.roomId, {
            type: 'STATE_UPDATE',
            room,
          });
          break;
        }

        case 'COMPLETE_ROUND': {
          const { score } = msg;
          if (!ctx.roomId) return;
          const room = rooms.get(ctx.roomId);
          if (!room) return;

          const stats = calculateVoteStats(room.participants);

          room.history.push({
            round: room.round,
            topic: room.topic || `Runda #${room.round}`,
            consensusScore: score || (stats.median !== null ? String(stats.median) : '—'),
            stats,
            timestamp: Date.now(),
          });

          // Move to next round
          room.votingState = 'voting';
          room.round += 1;
          room.topic = '';
          Object.values(room.participants).forEach((p) => {
            p.vote = null;
          });

          if (room.timer.duration > 0) {
            room.timer.remaining = room.timer.duration;
            room.timer.isRunning = false;
            room.timer.endTime = undefined;
          }

          broadcastToRoom(ctx.roomId, {
            type: 'STATE_UPDATE',
            room,
          });
          break;
        }

        case 'UPDATE_TOPIC': {
          const { topic } = msg;
          if (!ctx.roomId) return;
          const room = rooms.get(ctx.roomId);
          if (!room) return;

          room.topic = topic || '';

          broadcastToRoom(ctx.roomId, {
            type: 'STATE_UPDATE',
            room,
          });
          break;
        }

        case 'CLEAR_HISTORY': {
          if (!ctx.roomId) return;
          const room = rooms.get(ctx.roomId);
          if (!room) return;

          room.history = [];

          broadcastToRoom(ctx.roomId, {
            type: 'STATE_UPDATE',
            room,
          });
          break;
        }

        case 'CHANGE_DECK': {
          const { deckType, customDeck } = msg;
          if (!ctx.roomId) return;
          const room = rooms.get(ctx.roomId);
          if (!room) return;

          room.deckType = deckType as DeckType;
          if (customDeck && Array.isArray(customDeck)) {
            room.customDeck = customDeck;
          } else {
            room.customDeck = DECK_PRESETS[deckType as DeckType] || DECK_PRESETS.fibonacci;
          }

          // Reset votes when deck changes
          Object.values(room.participants).forEach((p) => {
            p.vote = null;
          });
          room.votingState = 'voting';

          broadcastToRoom(ctx.roomId, {
            type: 'STATE_UPDATE',
            room,
          });
          break;
        }

        case 'TIMER_ACTION': {
          const { action, duration } = msg;
          if (!ctx.roomId) return;
          const room = rooms.get(ctx.roomId);
          if (!room) return;

          if (action === 'start') {
            room.timer.isRunning = true;
            room.timer.endTime = Date.now() + room.timer.remaining * 1000;
          } else if (action === 'pause') {
            room.timer.isRunning = false;
            if (room.timer.endTime) {
              room.timer.remaining = Math.max(0, Math.ceil((room.timer.endTime - Date.now()) / 1000));
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

          broadcastToRoom(ctx.roomId, {
            type: 'STATE_UPDATE',
            room,
          });
          break;
        }

        case 'UPDATE_ROLE': {
          const { role } = msg;
          if (!ctx.roomId || !ctx.userId) return;
          const room = rooms.get(ctx.roomId);
          if (!room) return;

          const target = room.participants[ctx.userId];
          if (target) {
            target.role = role as ParticipantRole;
            if (role === 'observer') {
              target.vote = null;
            }
          }

          broadcastToRoom(ctx.roomId, {
            type: 'STATE_UPDATE',
            room,
          });
          break;
        }

        case 'UPDATE_SETTINGS': {
          const { settings } = msg;
          if (!ctx.roomId || !settings) return;
          const room = rooms.get(ctx.roomId);
          if (!room) return;

          if (typeof settings.autoReveal === 'boolean') room.autoReveal = settings.autoReveal;
          if (typeof settings.showAverage === 'boolean') room.showAverage = settings.showAverage;
          if (typeof settings.roomName === 'string' && settings.roomName.trim()) {
            room.name = settings.roomName.trim();
          }

          broadcastToRoom(ctx.roomId, {
            type: 'STATE_UPDATE',
            room,
          });
          break;
        }

        case 'SEND_REACTION': {
          const { emoji } = msg;
          if (!ctx.roomId || !ctx.userId) return;
          const room = rooms.get(ctx.roomId);
          if (!room) return;

          const p = room.participants[ctx.userId];
          broadcastToRoom(ctx.roomId, {
            type: 'REACTION',
            reaction: {
              id: Math.random().toString(36).substring(2, 9),
              emoji: emoji || '👍',
              userId: ctx.userId,
              userName: p ? p.name : 'Uczestnik',
              timestamp: Date.now(),
            },
          });
          break;
        }
      }
    } catch (err) {
      console.error('Error handling WebSocket message:', err);
    }
  });

  ws.on('close', () => {
    const ctx = clientContextMap.get(ws);
    if (ctx && ctx.roomId && ctx.userId) {
      const room = rooms.get(ctx.roomId);
      if (room && room.participants[ctx.userId]) {
        room.participants[ctx.userId].isConnected = false;
        broadcastToRoom(ctx.roomId, {
          type: 'STATE_UPDATE',
          room,
        });
      }
    }
  });
});

// REST Endpoints
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', roomsCount: rooms.size });
});

// Get room details
app.get('/api/rooms/:roomId', (req, res) => {
  const room = getOrCreateRoom(req.params.roomId);
  res.json(room);
});

// Serve frontend with Vite middleware or static dist
async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Planning Poker Server listening on port ${PORT}`);
  });
}

start();
