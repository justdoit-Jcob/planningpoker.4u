export type DeckType =
  | 'fibonacci'
  | 'modified_fibonacci'
  | 'tshirt'
  | 'powers_of_2'
  | 'sequential'
  | 'custom';

export type ParticipantRole = 'voter' | 'observer' | 'moderator';

export interface Participant {
  id: string;
  name: string;
  role: ParticipantRole;
  avatarColor: string;
  vote: string | null;
  isConnected: boolean;
  joinedAt: number;
}

export interface VoteStats {
  average: number | null;
  median: number | null;
  mode: string[];
  consensus: number; // percentage 0 - 100
  min: string | null;
  max: string | null;
  totalVotes: number;
  distribution: Record<string, number>;
  lowestVoters: string[]; // names of participants
  highestVoters: string[]; // names of participants
}

export interface Story {
  id: string;
  title: string;
  description: string;
  issueKey?: string;
  url?: string;
  notes?: string;
  finalScore?: string | null;
  status: 'active' | 'estimated' | 'queued';
  votes?: Record<string, string>; // userId -> vote
  stats?: VoteStats;
  createdAt: number;
  completedAt?: number;
}

export interface TimerState {
  duration: number; // seconds
  remaining: number; // seconds
  isRunning: boolean;
  endTime?: number;
}

export interface RoomSettings {
  deckType: DeckType;
  customDeck: string[];
  autoReveal: boolean;
  showAverage: boolean;
}

export interface RoomState {
  id: string;
  name: string;
  deckType: DeckType;
  customDeck: string[];
  votingState: 'voting' | 'revealed';
  currentStoryId: string | null;
  stories: Story[];
  participants: Record<string, Participant>;
  timer: TimerState;
  autoReveal: boolean;
  showAverage: boolean;
}

export interface ReactionEvent {
  id: string;
  emoji: string;
  userId: string;
  userName: string;
  timestamp: number;
}

export const DECK_PRESETS: Record<DeckType, string[]> = {
  fibonacci: ['0', '1', '2', '3', '5', '8', '13', '21', '34', '55', '89', '?', '☕'],
  modified_fibonacci: ['0', '0.5', '1', '2', '3', '5', '8', '13', '20', '40', '100', '?', '☕'],
  tshirt: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '?', '☕'],
  powers_of_2: ['0', '1', '2', '4', '8', '16', '32', '64', '?', '☕'],
  sequential: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '?', '☕'],
  custom: ['1', '2', '3', '5', '8'],
};

export const DECK_LABELS: Record<DeckType, string> = {
  fibonacci: 'Fibonacci (0, 1, 2, 3, 5, 8, 13, 21...)',
  modified_fibonacci: 'Scrum Standard (0, 0.5, 1, 2, 3, 5, 8, 13, 20, 40...)',
  tshirt: 'T-Shirt Sizes (XS, S, M, L, XL, XXL)',
  powers_of_2: 'Powers of 2 (0, 1, 2, 4, 8, 16, 32...)',
  sequential: 'Sequential (1 to 10)',
  custom: 'Custom Deck',
};

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
