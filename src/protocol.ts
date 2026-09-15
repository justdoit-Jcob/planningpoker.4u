/**
 * Schemat wiadomości WebSocket wraz z walidacją runtime.
 *
 * Serwer nigdy nie ufa kształtowi wiadomości od klienta: każda ramka przechodzi
 * przez parseClientMessage, które zwraca albo poprawnie otypowaną wiadomość,
 * albo null. Dzięki temu limity długości i listy dozwolonych wartości są
 * wymuszone w jednym miejscu, a nie rozsypane po handlerach.
 */

import { DeckType, ParticipantRole, SelfAssignableRole, isDeckType } from './types';

/* ---------- Limity wejścia (P2-6) ---------- */

export const LIMITS = {
  roomId: 40,
  roomName: 60,
  userName: 40,
  topic: 200,
  card: 12,
  emoji: 8,
  deckCards: 24,
  historyEntries: 100,
  /** Maksymalny rozmiar pojedynczej ramki WebSocket. */
  wsPayloadBytes: 64 * 1024,
  /** Reakcje: ile ramek w oknie czasowym. */
  reactionBurst: 5,
  reactionWindowMs: 3000,
} as const;

/* ---------- Cykl życia (P1-4) ---------- */

export const LIFECYCLE = {
  /** Po tym czasie offline wpis uczestnika jest usuwany z pokoju. */
  participantTtlMs: 15 * 60 * 1000,
  /** Po tym czasie bez aktywności pusty pokój jest kasowany. */
  roomTtlMs: 4 * 60 * 60 * 1000,
  sweepIntervalMs: 10 * 60 * 1000,
  /** Heartbeat WebSocket (P1-2). */
  heartbeatIntervalMs: 30 * 1000,
} as const;

/* ---------- Transport zapasowy: HTTP long-polling ---------- */

export const POLLING = {
  /** Jak długo serwer trzyma GET bez ramek do oddania — poniżej typowych limitów proxy. */
  holdMs: 25 * 1000,
  /** Sesja bez żadnego GET-a przez ten czas uznawana jest za zerwaną. */
  sessionTtlMs: 40 * 1000,
  sweepIntervalMs: 5 * 1000,
  /** Klient, który przestał odbierać, nie może rozdmuchać pamięci serwera. */
  maxQueuedFrames: 500,
  /** Ile wiadomości klient może przesłać jednym POST-em. */
  maxBatch: 20,
  maxSessions: 1000,
} as const;

/* ---------- Wiadomości klient -> serwer ---------- */

export interface ResumeCredentials {
  userId: string;
  token: string;
}

export type TimerAction = 'start' | 'pause' | 'reset' | 'set';

export const TIMER_ACTIONS: TimerAction[] = ['start', 'pause', 'reset', 'set'];

export type ClientMessage =
  /**
   * Keep-alive na poziomie aplikacji.
   *
   * Uzupełnia protokołowy heartbeat serwera (ping/pong z biblioteki ws), ale
   * rozwiązuje inny problem: ruch wychodzący od klienta resetuje liczniki
   * bezczynności na proxy (Cloud Run, Nginx), które potrafią zamknąć cichy
   * tunel WebSocket, zanim serwer zdąży zauważyć cokolwiek niepokojącego.
   * Nie wymaga dołączenia do pokoju.
   */
  | { type: 'PING' }
  | {
      type: 'JOIN_ROOM';
      roomId: string;
      roomName?: string;
      user: { name: string; role: SelfAssignableRole; avatarColor: string };
      resume?: ResumeCredentials;
    }
  | { type: 'VOTE'; card: string }
  | { type: 'REVEAL' }
  | { type: 'RESET_ROUND' }
  | { type: 'COMPLETE_ROUND'; score?: string }
  | { type: 'UPDATE_TOPIC'; topic: string }
  | { type: 'CLEAR_HISTORY' }
  | { type: 'CHANGE_DECK'; deckType: DeckType; customDeck?: string[] }
  | { type: 'TIMER_ACTION'; action: TimerAction; duration?: number }
  | { type: 'UPDATE_ROLE'; role: SelfAssignableRole }
  | {
      type: 'UPDATE_SETTINGS';
      settings: { autoReveal?: boolean; showAverage?: boolean; roomName?: string };
    }
  | { type: 'SEND_REACTION'; emoji: string };

export type ClientMessageType = ClientMessage['type'];

/**
 * Akcje zarezerwowane dla moderatora.
 *
 * Przebieg rundy — odkrycie kart, zapis wyniku, reset i timer — jest celowo
 * otwarty dla wszystkich uczestników: w małym zespole blokowanie go generuje
 * więcej tarcia niż pożytku. Historia i ustawienia (w tym zmiana talii)
 * zmieniają konfigurację całej sesji, więc wymagają moderatora.
 */
export const MODERATOR_ONLY: ReadonlySet<ClientMessageType> = new Set<ClientMessageType>([
  'CLEAR_HISTORY',
  'CHANGE_DECK',
  'UPDATE_SETTINGS',
]);

/* ---------- Kody błędów serwera ---------- */

export type ServerErrorCode =
  | 'FORBIDDEN'
  | 'ROOM_NOT_FOUND'
  | 'INVALID_MESSAGE'
  | 'RATE_LIMITED';

/* ---------- Prymitywy walidacji ---------- */

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Przycina string do limitu; zwraca null gdy to nie string. */
function str(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  return value.slice(0, max);
}

/** Jak str, ale odrzuca wartości puste po przycięciu białych znaków. */
function nonEmptyStr(value: unknown, max: number): string | null {
  const s = str(value, max);
  if (s === null) return null;
  const trimmed = s.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function bool(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function finiteNum(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function isSelfAssignableRole(value: unknown): value is SelfAssignableRole {
  return value === 'voter' || value === 'observer';
}

/** Kolor avatara musi być zapisem heksadecymalnym — nie wpuszczamy dowolnego CSS. */
export function parseHexColor(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : null;
}

function parseResume(value: unknown): ResumeCredentials | undefined {
  const r = asRecord(value);
  if (!r) return undefined;
  const userId = nonEmptyStr(r.userId, 64);
  const token = nonEmptyStr(r.token, 128);
  if (!userId || !token) return undefined;
  return { userId, token };
}

/* ---------- Parser ---------- */

export function parseClientMessage(raw: unknown): ClientMessage | null {
  const msg = asRecord(raw);
  if (!msg || typeof msg.type !== 'string') return null;

  switch (msg.type) {
    case 'PING':
      return { type: 'PING' };

    case 'JOIN_ROOM': {
      const roomId = nonEmptyStr(msg.roomId, LIMITS.roomId);
      if (!roomId) return null;
      const user = asRecord(msg.user) ?? {};
      return {
        type: 'JOIN_ROOM',
        roomId: roomId.toUpperCase(),
        roomName: nonEmptyStr(msg.roomName, LIMITS.roomName) ?? undefined,
        user: {
          name: nonEmptyStr(user.name, LIMITS.userName) ?? 'Developer',
          role: isSelfAssignableRole(user.role) ? user.role : 'voter',
          avatarColor: parseHexColor(user.avatarColor) ?? '#3B82F6',
        },
        resume: parseResume(msg.resume),
      };
    }

    case 'VOTE': {
      const card = str(msg.card, LIMITS.card);
      if (card === null) return null;
      return { type: 'VOTE', card };
    }

    case 'REVEAL':
      return { type: 'REVEAL' };

    case 'RESET_ROUND':
      return { type: 'RESET_ROUND' };

    case 'COMPLETE_ROUND':
      return { type: 'COMPLETE_ROUND', score: nonEmptyStr(msg.score, LIMITS.card) ?? undefined };

    case 'UPDATE_TOPIC':
      return { type: 'UPDATE_TOPIC', topic: str(msg.topic, LIMITS.topic) ?? '' };

    case 'CLEAR_HISTORY':
      return { type: 'CLEAR_HISTORY' };

    case 'CHANGE_DECK': {
      if (!isDeckType(msg.deckType)) return null;
      let customDeck: string[] | undefined;
      if (Array.isArray(msg.customDeck)) {
        const cards = msg.customDeck
          .slice(0, LIMITS.deckCards)
          .map((c) => nonEmptyStr(c, LIMITS.card))
          .filter((c): c is string => c !== null);
        // Talia bez kart jest bezużyteczna — wtedy wracamy do presetu.
        customDeck = cards.length > 0 ? Array.from(new Set(cards)) : undefined;
      }
      return { type: 'CHANGE_DECK', deckType: msg.deckType, customDeck };
    }

    case 'TIMER_ACTION': {
      if (typeof msg.action !== 'string') return null;
      if (!(TIMER_ACTIONS as string[]).includes(msg.action)) return null;
      const duration = finiteNum(msg.duration);
      return {
        type: 'TIMER_ACTION',
        action: msg.action as TimerAction,
        // Timer od 5 s do 2 h — poza tym zakresem wartość ignorujemy.
        duration:
          duration === null ? undefined : Math.min(7200, Math.max(5, Math.round(duration))),
      };
    }

    case 'UPDATE_ROLE': {
      if (!isSelfAssignableRole(msg.role)) return null;
      return { type: 'UPDATE_ROLE', role: msg.role };
    }

    case 'UPDATE_SETTINGS': {
      const s = asRecord(msg.settings);
      if (!s) return null;
      const settings: { autoReveal?: boolean; showAverage?: boolean; roomName?: string } = {};
      const autoReveal = bool(s.autoReveal);
      if (autoReveal !== null) settings.autoReveal = autoReveal;
      const showAverage = bool(s.showAverage);
      if (showAverage !== null) settings.showAverage = showAverage;
      const roomName = nonEmptyStr(s.roomName, LIMITS.roomName);
      if (roomName !== null) settings.roomName = roomName;
      return { type: 'UPDATE_SETTINGS', settings };
    }

    case 'SEND_REACTION': {
      const emoji = nonEmptyStr(msg.emoji, LIMITS.emoji);
      if (!emoji) return null;
      return { type: 'SEND_REACTION', emoji };
    }

    default:
      return null;
  }
}

/** Rola dozwolona do samodzielnego nadania (P0-2). */
export function coerceSelfAssignableRole(role: ParticipantRole): SelfAssignableRole {
  return role === 'observer' ? 'observer' : 'voter';
}
