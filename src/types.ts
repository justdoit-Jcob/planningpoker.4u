export type DeckType =
  | 'fibonacci'
  | 'modified_fibonacci'
  | 'tshirt'
  | 'powers_of_2'
  | 'sequential'
  | 'custom';

export type ParticipantRole = 'voter' | 'observer' | 'moderator';

/** Rola, którą uczestnik może nadać sobie sam. 'moderator' nadaje wyłącznie serwer. */
export type SelfAssignableRole = Extract<ParticipantRole, 'voter' | 'observer'>;

export const SELF_ASSIGNABLE_ROLES: SelfAssignableRole[] = ['voter', 'observer'];

export interface Participant {
  id: string;
  name: string;
  /** Rola efektywna — 'moderator' jeśli uczestnik aktualnie trzyma tę funkcję. */
  role: ParticipantRole;
  /** Rola wybrana przez uczestnika; wraca do niej po utracie funkcji moderatora. */
  preferredRole: SelfAssignableRole;
  avatarColor: string;
  /**
   * Oddany głos. Na łączu redagowany: przed odkryciem kart każdy odbiorca
   * widzi wyłącznie własny głos, pozostałe przychodzą jako null.
   */
  vote: string | null;
  /** Czy uczestnik oddał głos — bezpieczne do rozesłania przed odkryciem. */
  hasVoted: boolean;
  /**
   * Karta z chwili odkrycia. Po odkryciu głos wolno zmienić — różnica między
   * vote a revealedVote oznacza zmianę, wyróżnianą przy stole. Przed
   * odkryciem zawsze null.
   */
  revealedVote: string | null;
  isConnected: boolean;
  joinedAt: number;
  /** Pozycja w kolejce dołączeń — wyznacza następcę moderatora. */
  joinOrder: number;
  /** Ostatnia aktywność; steruje sprzątaniem porzuconych wpisów. */
  lastSeen: number;
}

export interface VoteStats {
  average: number | null;
  median: number | null;
  mode: string[];
  consensus: number; // procent 0 - 100, liczony wyłącznie z kart szacujących
  min: string | null;
  max: string | null;
  /** Wszystkie oddane głosy, razem z wstrzymaniami. */
  totalVotes: number;
  /** Głosy będące realną estymatą (bez '?' i '☕'). */
  estimatingVotes: number;
  /** Liczba wstrzymań ('?' oraz '☕'). */
  abstentions: number;
  /** Liczba głosów na '☕' — steruje konfetti z kawą. */
  coffeeVotes: number;
  distribution: Record<string, number>;
  lowestVoters: string[];
  highestVoters: string[];
}

export interface EstimationRoundResult {
  round: number;
  topic: string;
  consensusScore: string;
  stats: VoteStats;
  timestamp: number;
}

export interface TimerState {
  duration: number; // sekundy
  remaining: number; // sekundy
  isRunning: boolean;
  endTime?: number;
}

export interface RoomState {
  id: string;
  name: string;
  topic: string;
  round: number;
  deckType: DeckType;
  customDeck: string[];
  votingState: 'voting' | 'revealed';
  participants: Record<string, Participant>;
  timer: TimerState;
  autoReveal: boolean;
  showAverage: boolean;
  history: EstimationRoundResult[];
  /** Twórca pokoju — odzyskuje moderatora po powrocie. */
  creatorId: string | null;
  /** Licznik nadający kolejne joinOrder. */
  joinCounter: number;
  /** Ostatnia aktywność w pokoju; steruje wygaszaniem pustych pokoi. */
  lastActivity: number;
}

export interface ReactionEvent {
  id: string;
  emoji: string;
  userId: string;
  userName: string;
  timestamp: number;
}

export const COFFEE_CARD = '☕';
export const UNSURE_CARD = '?';

/** Karty, które nie są estymatą — poza konsensusem, modą i średnią. */
export const ABSTAIN_CARDS: readonly string[] = [UNSURE_CARD, COFFEE_CARD];

export function isAbstainCard(card: string): boolean {
  return ABSTAIN_CARDS.includes(card);
}

export const DECK_PRESETS: Record<DeckType, string[]> = {
  fibonacci: ['0', '1', '2', '3', '5', '8', '13', '21', '?', '☕'],
  modified_fibonacci: ['0', '0.5', '1', '2', '3', '5', '8', '13', '20', '40', '100', '?', '☕'],
  tshirt: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '?', '☕'],
  powers_of_2: ['0', '1', '2', '4', '8', '16', '32', '64', '?', '☕'],
  sequential: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '?', '☕'],
  custom: ['1', '2', '3', '5', '8'],
};

export const DECK_LABELS: Record<DeckType, string> = {
  fibonacci: 'Fibonacci (0, 1, 2, 3, 5, 8, 13, 21)',
  modified_fibonacci: 'Scrum Standard (0, 0.5, 1, 2, 3, 5, 8, 13...)',
  tshirt: 'T-Shirt (XS, S, M, L, XL, XXL)',
  powers_of_2: 'Potęgi 2 (0, 1, 2, 4, 8, 16, 32...)',
  sequential: 'Sekwencyjna (1 do 10)',
  custom: 'Własna talia',
};

export const DECK_TYPES = Object.keys(DECK_PRESETS) as DeckType[];

export function isDeckType(value: unknown): value is DeckType {
  return typeof value === 'string' && (DECK_TYPES as string[]).includes(value);
}

export const AVATAR_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#14B8A6', // Teal
  '#F97316', // Orange
  '#6366F1', // Indigo
];

/* ---------- Pomocnicy ról: jedno źródło prawdy (P2-1) ---------- */

/**
 * Uczestnicy, którzy MOGĄ oddać głos: głosujący i moderator (ten ostatni opcjonalnie).
 * Moderator, który wybrał obserwację, zachowuje funkcję, ale nie głosuje
 * i nie siedzi przy stole — tak samo jak obserwator.
 */
export function canCastVote(p: Participant): boolean {
  if (p.role === 'observer') return false;
  return !(p.role === 'moderator' && p.preferredRole === 'observer');
}

/** Uczestnik tylko obserwuje: obserwator albo moderator w trybie obserwacji. */
export function isObserving(p: Participant): boolean {
  return !canCastVote(p);
}

/**
 * Uczestnicy, na których czeka automatyczne odkrycie kart.
 * Moderator jest z tego zbioru wyłączony — może estymować, ale nie musi.
 */
export function getRequiredVoters(room: RoomState): Participant[] {
  return Object.values(room.participants).filter((p) => p.isConnected && p.role === 'voter');
}

/** Uczestnicy widoczni przy stole: wszyscy poza obserwatorami. */
export function getTableParticipants(room: RoomState): Participant[] {
  return Object.values(room.participants).filter(canCastVote);
}
