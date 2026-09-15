/**
 * Generator identyfikatorów pokoi w formacie ROOM-XXXX.
 *
 * Alfabet pomija znaki łatwe do pomylenia przy dyktowaniu i przepisywaniu
 * kodu (0/O, 1/I). Ma dokładnie 32 znaki, więc reszta z dzielenia losowego
 * bajtu rozkłada się równomiernie — żaden znak nie wypada częściej niż inne.
 * Cztery znaki dają 32^4 ≈ 1 mln kodów.
 */
export const ROOM_ID_PREFIX = 'ROOM-';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 4;

export function createRoomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

export function createRoomId(): string {
  return `${ROOM_ID_PREFIX}${createRoomCode()}`;
}
