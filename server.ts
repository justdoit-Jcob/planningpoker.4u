import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import {
  RoomState,
  Story,
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
    const initialStoryId = 'story-' + Math.random().toString(36).substring(2, 9);
    const initialStory: Story = {
      id: initialStoryId,
      title: 'Zaimplementuj uwierzytelnianie OAuth2 / SSO z GitHub i Google',
      description:
        'Jako użytkownik chcę logować się przez konto GitHub lub Google, aby szybko i bezpiecznie uzyskać dostęp do aplikacji.',
      issueKey: 'AUTH-101',
      notes: 'Uwzględnić obsługę tokenów JWT, odświeżanie sesji i bezpieczne przechowywanie w ciasteczkach HttpOnly.',
      status: 'active',
      createdAt: Date.now(),
    };

    const backlogStory1: Story = {
      id: 'story-' + Math.random().toString(36).substring(2, 9),
      title: 'Optymalizacja zapytań bazy danych i indeksowanie tabeli transakcji',
      description: 'Zredukować czas odpowiedzi endpointu /api/transactions z 850ms do <120ms pod obciążeniem 500 RPS.',
      issueKey: 'PERF-204',
      status: 'queued',
      createdAt: Date.now() + 1000,
    };

    const backlogStory2: Story = {
      id: 'story-' + Math.random().toString(36).substring(2, 9),
      title: 'Eksport raportów sprintu do formatów CSV oraz PDF',
      description: 'Dodać możliwość pobierania zestawienia estymacji i velocity zespołu za dany okres.',
      issueKey: 'REP-305',
      status: 'queued',
      createdAt: Date.now() + 2000,
    };

    room = {
      id: roomId,
      name: initialName || `Sprint Planning #${roomId.substring(0, 4).toUpperCase()}`,
      deckType: 'fibonacci',
      customDeck: DECK_PRESETS.fibonacci,
      votingState: 'voting',
      currentStoryId: initialStoryId,
      stories: [initialStory, backlogStory1, backlogStory2],
      participants: {},
      timer: {
        duration: 90,
        remaining: 90,
        isRunning: false,
      },
      autoReveal: false,
      showAverage: true,
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
    (p) => p.role !== 'observer' && p.isConnected
  );

  if (activeVoters.length > 0 && activeVoters.every((p) => p.vote !== null)) {
    room.votingState = 'revealed';
    // attach stats to current story if active
    if (room.currentStoryId) {
      const currStory = room.stories.find((s) => s.id === room.currentStoryId);
      if (currStory) {
        currStory.stats = calculateVoteStats(room.participants);
        currStory.votes = {};
        for (const p of Object.values(room.participants)) {
          if (p.vote !== null) {
            currStory.votes[p.id] = p.vote;
          }
        }
      }
    }
    broadcastToRoom(room.id, {
      type: 'STATE_UPDATE',
      room,
      action: 'AUTO_REVEALED',
    });
  }
}

// Global Timer loop for rooms with running timers
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
            type: 'TIMER_EXPIRED',
            room,
          });
        } else {
          broadcastToRoom(room.id, {
            type: 'TIMER_TICK',
            remaining,
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
        case 'JOIN_ROOM': {
          const { roomId, user } = msg;
          ctx.roomId = roomId;
          ctx.userId = user.id;

          const room = getOrCreateRoom(roomId, msg.roomName);

          const existing = room.participants[user.id];
          const isFirstUser = Object.keys(room.participants).length === 0;

          const participant: Participant = {
            id: user.id,
            name: user.name || 'Developer',
            role: user.role || (isFirstUser ? 'moderator' : 'voter'),
            avatarColor: user.avatarColor || '#3B82F6',
            vote: existing ? existing.vote : null,
            isConnected: true,
            joinedAt: existing ? existing.joinedAt : Date.now(),
          };

          room.participants[user.id] = participant;

          ws.send(
            JSON.stringify({
              type: 'INIT_STATE',
              room,
              selfId: user.id,
            })
          );

          broadcastToRoom(roomId, {
            type: 'PARTICIPANT_JOINED',
            participant,
            room,
          });
          break;
        }

        case 'VOTE': {
          const { vote } = msg;
          if (!ctx.roomId || !ctx.userId) return;
          const room = rooms.get(ctx.roomId);
          if (!room || room.votingState === 'revealed') return;

          const participant = room.participants[ctx.userId];
          if (!participant || participant.role === 'observer') return;

          participant.vote = vote;

          // Broadcast that user voted (without revealing the value yet if not revealed)
          broadcastToRoom(ctx.roomId, {
            type: 'PARTICIPANT_VOTED',
            userId: ctx.userId,
            hasVoted: vote !== null,
          });

          checkAndAutoReveal(room);
          break;
        }

        case 'REVEAL_VOTES': {
          if (!ctx.roomId) return;
          const room = rooms.get(ctx.roomId);
          if (!room) return;

          room.votingState = 'revealed';

          // Snapshot votes & calculate stats
          if (room.currentStoryId) {
            const currentStory = room.stories.find((s) => s.id === room.currentStoryId);
            if (currentStory) {
              currentStory.stats = calculateVoteStats(room.participants);
              currentStory.votes = {};
              for (const p of Object.values(room.participants)) {
                if (p.vote !== null) {
                  currentStory.votes[p.id] = p.vote;
                }
              }
            }
          }

          broadcastToRoom(ctx.roomId, {
            type: 'STATE_UPDATE',
            room,
            action: 'REVEALED',
          });
          break;
        }

        case 'RESET_VOTING': {
          if (!ctx.roomId) return;
          const room = rooms.get(ctx.roomId);
          if (!room) return;

          room.votingState = 'voting';
          Object.values(room.participants).forEach((p) => {
            p.vote = null;
          });

          if (msg.nextStoryId) {
            room.currentStoryId = msg.nextStoryId;
            room.stories.forEach((s) => {
              if (s.id === msg.nextStoryId) {
                s.status = 'active';
              } else if (s.status === 'active') {
                s.status = 'queued';
              }
            });
          }

          // Reset timer if configured
          if (room.timer.duration > 0) {
            room.timer.remaining = room.timer.duration;
            room.timer.isRunning = false;
            room.timer.endTime = undefined;
          }

          broadcastToRoom(ctx.roomId, {
            type: 'STATE_UPDATE',
            room,
            action: 'VOTING_RESET',
          });
          break;
        }

        case 'SET_FINAL_SCORE': {
          const { storyId, finalScore, advanceToNext } = msg;
          if (!ctx.roomId) return;
          const room = rooms.get(ctx.roomId);
          if (!room) return;

          const story = room.stories.find((s) => s.id === storyId);
          if (story) {
            story.finalScore = finalScore;
            story.status = 'estimated';
            story.completedAt = Date.now();
            story.stats = calculateVoteStats(room.participants);
          }

          if (advanceToNext) {
            const nextStory = room.stories.find((s) => s.status === 'queued');
            if (nextStory) {
              room.currentStoryId = nextStory.id;
              nextStory.status = 'active';
            }
            // reset votes
            room.votingState = 'voting';
            Object.values(room.participants).forEach((p) => {
              p.vote = null;
            });
            if (room.timer.duration > 0) {
              room.timer.remaining = room.timer.duration;
              room.timer.isRunning = false;
              room.timer.endTime = undefined;
            }
          }

          broadcastToRoom(ctx.roomId, {
            type: 'STATE_UPDATE',
            room,
            action: 'SCORE_SAVED',
          });
          break;
        }

        case 'SET_DECK': {
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

          // Reset votes when deck changes to avoid invalid cards
          Object.values(room.participants).forEach((p) => {
            p.vote = null;
          });
          room.votingState = 'voting';

          broadcastToRoom(ctx.roomId, {
            type: 'STATE_UPDATE',
            room,
            action: 'DECK_CHANGED',
          });
          break;
        }

        case 'ADD_STORY': {
          const { story } = msg;
          if (!ctx.roomId) return;
          const room = rooms.get(ctx.roomId);
          if (!room) return;

          const newStory: Story = {
            id: 'story-' + Math.random().toString(36).substring(2, 9),
            title: story.title || 'Nowa historyjka',
            description: story.description || '',
            issueKey: story.issueKey || '',
            url: story.url || '',
            notes: story.notes || '',
            status: room.stories.length === 0 ? 'active' : 'queued',
            createdAt: Date.now(),
          };

          room.stories.push(newStory);
          if (!room.currentStoryId) {
            room.currentStoryId = newStory.id;
          }

          broadcastToRoom(ctx.roomId, {
            type: 'STATE_UPDATE',
            room,
            action: 'STORY_ADDED',
          });
          break;
        }

        case 'UPDATE_STORY': {
          const { story } = msg;
          if (!ctx.roomId || !story || !story.id) return;
          const room = rooms.get(ctx.roomId);
          if (!room) return;

          const idx = room.stories.findIndex((s) => s.id === story.id);
          if (idx !== -1) {
            room.stories[idx] = { ...room.stories[idx], ...story };
          }

          broadcastToRoom(ctx.roomId, {
            type: 'STATE_UPDATE',
            room,
            action: 'STORY_UPDATED',
          });
          break;
        }

        case 'DELETE_STORY': {
          const { storyId } = msg;
          if (!ctx.roomId) return;
          const room = rooms.get(ctx.roomId);
          if (!room) return;

          room.stories = room.stories.filter((s) => s.id !== storyId);
          if (room.currentStoryId === storyId) {
            const next = room.stories.find((s) => s.status === 'queued') || room.stories[0];
            room.currentStoryId = next ? next.id : null;
            if (next) next.status = 'active';
          }

          broadcastToRoom(ctx.roomId, {
            type: 'STATE_UPDATE',
            room,
            action: 'STORY_DELETED',
          });
          break;
        }

        case 'SELECT_STORY': {
          const { storyId } = msg;
          if (!ctx.roomId) return;
          const room = rooms.get(ctx.roomId);
          if (!room) return;

          room.currentStoryId = storyId;
          room.stories.forEach((s) => {
            if (s.id === storyId) {
              s.status = 'active';
            } else if (s.status === 'active') {
              s.status = 'queued';
            }
          });

          // Reset votes for the newly selected story
          room.votingState = 'voting';
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
            action: 'STORY_SELECTED',
          });
          break;
        }

        case 'UPDATE_TIMER': {
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
            action: 'TIMER_UPDATED',
          });
          break;
        }

        case 'UPDATE_ROLE': {
          const { targetUserId, role } = msg;
          if (!ctx.roomId) return;
          const room = rooms.get(ctx.roomId);
          if (!room) return;

          const target = room.participants[targetUserId];
          if (target) {
            target.role = role as ParticipantRole;
            if (role === 'observer') {
              target.vote = null;
            }
          }

          broadcastToRoom(ctx.roomId, {
            type: 'STATE_UPDATE',
            room,
            action: 'ROLE_UPDATED',
          });
          break;
        }

        case 'KICK_PARTICIPANT': {
          const { targetUserId } = msg;
          if (!ctx.roomId) return;
          const room = rooms.get(ctx.roomId);
          if (!room) return;

          delete room.participants[targetUserId];

          broadcastToRoom(ctx.roomId, {
            type: 'PARTICIPANT_KICKED',
            targetUserId,
            room,
          });
          break;
        }

        case 'UPDATE_SETTINGS': {
          const { autoReveal, showAverage, roomName } = msg;
          if (!ctx.roomId) return;
          const room = rooms.get(ctx.roomId);
          if (!room) return;

          if (typeof autoReveal === 'boolean') room.autoReveal = autoReveal;
          if (typeof showAverage === 'boolean') room.showAverage = showAverage;
          if (typeof roomName === 'string' && roomName.trim()) room.name = roomName.trim();

          broadcastToRoom(ctx.roomId, {
            type: 'STATE_UPDATE',
            room,
            action: 'SETTINGS_UPDATED',
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
          type: 'PARTICIPANT_LEFT',
          userId: ctx.userId,
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

// AI Story Assistant endpoint using Google GenAI SDK
app.post('/api/ai/analyze-story', async (req, res) => {
  const { title, description } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Tytuł wymagany' });
  }

  // Check for Gemini API key
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `Jesteś ekspertem Agile / Scrum Masterem i Senior Architektem oprogramowania.
Przeanalizuj poniższe zadanie / historyjkę użytkownika (User Story) dla zdalnego zespołu developerskiego:

Tytuł: ${title}
Opis: ${description || 'Brak dodatkowego opisu'}

Przygotuj profesjonalną analizę w formacie JSON z następującymi kluczami (odpowiedź MUSI być czystym JSON):
{
  "summary": "Krótkie podsumowanie celu biznesowego i technicznego",
  "acceptanceCriteria": [
    "Kryterium akceptacji 1 (Given/When/Then lub lista wymagań)",
    "Kryterium akceptacji 2",
    "Kryterium akceptacji 3"
  ],
  "technicalConsiderations": [
    "Wyzwanie architektoniczne / integracja / migracja bazy",
    "Kwestia bezpieczeństwa lub wydajności",
    "Przypadki brzegowe i testowanie"
  ],
  "suggestedStoryPoints": "np. 3 lub 5 lub 8 (zgodnie ze skalą Fibonacci)",
  "estimationReasoning": "Uzasadnienie proponowanej złożoności punktowej i nakładu pracy"
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      const text = response.text?.trim() || '{}';
      const parsed = JSON.parse(text);
      return res.json(parsed);
    } catch (error) {
      console.error('Gemini API call failed, falling back to heuristic assistant:', error);
    }
  }

  // Intelligent fallback if API key is not set or network fails
  const words = `${title} ${description}`.toLowerCase();
  let suggestedPoints = '3';
  if (words.includes('migracja') || words.includes('refaktor') || words.includes('architektura') || words.includes('bezpieczeństwo') || words.includes('płatności')) {
    suggestedPoints = '8';
  } else if (words.includes('api') || words.includes('backend') || words.includes('oauth') || words.includes('integracja')) {
    suggestedPoints = '5';
  } else if (words.includes('poprawka') || words.includes('tekst') || words.includes('css') || words.includes('przycisk')) {
    suggestedPoints = '1';
  }

  return res.json({
    summary: `Zadanie skupia się na: "${title}". Wymaga implementacji logiki biznesowej, testów jednostkowych oraz weryfikacji regresji.`,
    acceptanceCriteria: [
      `Funkcjonalność "${title}" działa stabilnie w środowisku przeglądarkowym.`,
      'Wszystkie stany brzegowe, błędy sieciowe oraz walidacja pól formularzy są poprawnie obsłużone.',
      'Dodano odpowiednie testy integracyjne i e2e dla głównej ścieżki użytkownika.',
    ],
    technicalConsiderations: [
      'Weryfikacja kompatybilności wstecznej z istniejącymi kontraktami API.',
      'Optymalizacja czasu renderowania i minimalizacja zapytań do serwera.',
      'Obsługa uprawnień i ról użytkowników (RBAC).',
    ],
    suggestedStoryPoints: suggestedPoints,
    estimationReasoning:
      'Estymacja uwzględnia standardowy nakład pracy na implementację, pokrycie testami, code review oraz wdrożenie na środowisko stagingowe.',
  });
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
