/**
 * Aktualizacje optymistyczne — lokalne odbicie własnych akcji.
 *
 * Każde kliknięcie idzie do serwera, a potwierdzenie wraca po pełnym
 * okrążeniu (na produkcji ok. 200 ms przez Cloudflare do homelabu). Żeby
 * interfejs reagował od razu, klient nakłada własne, jeszcze niepotwierdzone
 * akcje na ostatni stan od serwera. Serwer potwierdza każdą wiadomość jej
 * numerem (ack) — wtedy akcja znika z kolejki i obowiązuje stan serwera.
 *
 * Reguły serwera są tu odwzorowane w przybliżeniu i celowo pomijają to,
 * czego klient nie może wiedzieć (np. cudze karty przy odkryciu).
 * Ewentualna rozbieżność trwa najwyżej jedno okrążenie.
 */

import { ClientMessage, LIMITS, TimerAction } from './protocol';
import { DECK_PRESETS, Participant, RoomState, TimerState } from './types';

/** Akcja wysłana do serwera, czekająca na potwierdzenie. */
export interface PendingAction {
  seq: number;
  msg: ClientMessage;
}

function clearVotes(participants: Record<string, Participant>): Record<string, Participant> {
  const next: Record<string, Participant> = {};
  for (const [id, p] of Object.entries(participants)) {
    next[id] = { ...p, vote: null, hasVoted: false, revealedVote: null };
  }
  return next;
}

function applyTimerAction(timer: TimerState, action: TimerAction, duration?: number): TimerState {
  switch (action) {
    case 'start':
      // Resztę odlicza serwer tickami — tu wystarczy stan „biegnie”.
      return { ...timer, isRunning: true, remaining: timer.remaining <= 0 ? timer.duration : timer.remaining };
    case 'pause':
      return { ...timer, isRunning: false };
    case 'reset':
      return { ...timer, isRunning: false, remaining: timer.duration };
    case 'set': {
      if (typeof duration !== 'number') return timer;
      const seconds = Math.min(7200, Math.max(5, Math.round(duration)));
      return { duration: seconds, remaining: seconds, isRunning: false };
    }
    default:
      return timer;
  }
}

/** Stan pokoju po własnej akcji — zanim potwierdzi ją serwer. */
export function applyOptimistic(room: RoomState, selfId: string, msg: ClientMessage): RoomState {
  const me = room.participants[selfId];
  const isModerator = me?.role === 'moderator';

  switch (msg.type) {
    case 'VOTE': {
      if (!me || me.role === 'observer' || !room.customDeck.includes(msg.card)) return room;
      return {
        ...room,
        participants: { ...room.participants, [selfId]: { ...me, vote: msg.card, hasVoted: true } },
      };
    }

    case 'RESET_ROUND': {
      const timer =
        room.timer.duration > 0
          ? { ...room.timer, remaining: room.timer.duration, isRunning: false, endTime: undefined }
          : room.timer;
      return { ...room, votingState: 'voting', participants: clearVotes(room.participants), timer };
    }

    case 'UPDATE_TOPIC':
      return { ...room, topic: msg.topic.slice(0, LIMITS.topic) };

    case 'TIMER_ACTION':
      return { ...room, timer: applyTimerAction(room.timer, msg.action, msg.duration) };

    case 'UPDATE_ROLE': {
      if (!me) return room;
      // Moderator zachowuje funkcję; wybór obserwatora zdejmuje tylko jego głos.
      const next: Participant = {
        ...me,
        preferredRole: msg.role,
        ...(isModerator ? {} : { role: msg.role }),
        ...(msg.role === 'observer' ? { vote: null, hasVoted: false } : {}),
      };
      return { ...room, participants: { ...room.participants, [selfId]: next } };
    }

    case 'CHANGE_DECK':
      if (!isModerator) return room;
      return {
        ...room,
        deckType: msg.deckType,
        customDeck: msg.customDeck ?? DECK_PRESETS[msg.deckType] ?? DECK_PRESETS.fibonacci,
        votingState: 'voting',
        participants: clearVotes(room.participants),
      };

    case 'UPDATE_SETTINGS': {
      if (!isModerator) return room;
      const { autoReveal, showAverage, roomName } = msg.settings;
      return {
        ...room,
        ...(autoReveal !== undefined ? { autoReveal } : {}),
        ...(showAverage !== undefined ? { showAverage } : {}),
        ...(roomName !== undefined ? { name: roomName.slice(0, LIMITS.roomName) } : {}),
      };
    }

    case 'CLEAR_HISTORY':
      return isModerator ? { ...room, history: [] } : room;

    default:
      // REVEAL i COMPLETE_ROUND potrzebują danych, których klient nie ma przed
      // odpowiedzią serwera (cudze karty, statystyki rundy) — tu tylko czekają.
      return room;
  }
}
