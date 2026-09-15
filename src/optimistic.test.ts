import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { applyOptimistic } from './optimistic';
import { DECK_PRESETS, Participant, RoomState } from './types';

function participant(id: string, overrides: Partial<Participant> = {}): Participant {
  return {
    id,
    name: id,
    role: 'voter',
    preferredRole: 'voter',
    avatarColor: '#3B82F6',
    vote: null,
    hasVoted: false,
    revealedVote: null,
    isConnected: true,
    joinedAt: 0,
    joinOrder: 0,
    lastSeen: 0,
    ...overrides,
  };
}

function room(overrides: Partial<RoomState> = {}): RoomState {
  return {
    id: 'ROOM-TEST',
    name: 'Test',
    topic: '',
    round: 1,
    deckType: 'fibonacci',
    customDeck: DECK_PRESETS.fibonacci,
    votingState: 'voting',
    participants: {
      me: participant('me'),
      anna: participant('anna', { role: 'moderator', hasVoted: true }),
    },
    timer: { duration: 90, remaining: 42, isRunning: true },
    autoReveal: false,
    showAverage: true,
    history: [],
    creatorId: 'anna',
    joinCounter: 2,
    lastActivity: 0,
    ...overrides,
  };
}

describe('applyOptimistic — VOTE', () => {
  it('ustawia własny głos, nie rusza innych i nie mutuje wejścia', () => {
    const before = room();
    const after = applyOptimistic(before, 'me', { type: 'VOTE', card: '5' });
    assert.equal(after.participants.me.vote, '5');
    assert.equal(after.participants.me.hasVoted, true);
    assert.equal(after.participants.anna, before.participants.anna);
    assert.equal(before.participants.me.vote, null);
  });

  it('pomija obserwatora i kartę spoza talii', () => {
    const observer = room({ participants: { me: participant('me', { role: 'observer' }) } });
    assert.equal(applyOptimistic(observer, 'me', { type: 'VOTE', card: '5' }), observer);
    const r = room();
    assert.equal(applyOptimistic(r, 'me', { type: 'VOTE', card: '999' }), r);
  });

  it('po odkryciu zmienia kartę, zostawiając kartę z chwili odkrycia', () => {
    const revealed = room({
      votingState: 'revealed',
      participants: { me: participant('me', { vote: '5', hasVoted: true, revealedVote: '5' }) },
    });
    const after = applyOptimistic(revealed, 'me', { type: 'VOTE', card: '8' });
    assert.equal(after.participants.me.vote, '8');
    assert.equal(after.participants.me.revealedVote, '5');
  });
});

describe('applyOptimistic — pozostałe akcje', () => {
  it('RESET_ROUND czyści głosy, karty z odkrycia i zatrzymuje timer', () => {
    const revealed = room({
      votingState: 'revealed',
      participants: { me: participant('me', { vote: '5', hasVoted: true, revealedVote: '3' }) },
    });
    const after = applyOptimistic(revealed, 'me', { type: 'RESET_ROUND' });
    assert.equal(after.votingState, 'voting');
    assert.deepEqual(
      [after.participants.me.vote, after.participants.me.hasVoted, after.participants.me.revealedVote],
      [null, false, null]
    );
    assert.deepEqual([after.timer.remaining, after.timer.isRunning], [90, false]);
  });

  it('UPDATE_ROLE: głosujący przechodzi na obserwatora i traci głos; moderator zachowuje funkcję', () => {
    const r = room({ participants: { me: participant('me', { vote: '5', hasVoted: true }) } });
    const observer = applyOptimistic(r, 'me', { type: 'UPDATE_ROLE', role: 'observer' });
    assert.deepEqual([observer.participants.me.role, observer.participants.me.vote], ['observer', null]);

    const mod = room({ participants: { me: participant('me', { role: 'moderator' }) } });
    const modAfter = applyOptimistic(mod, 'me', { type: 'UPDATE_ROLE', role: 'observer' });
    assert.deepEqual([modAfter.participants.me.role, modAfter.participants.me.preferredRole], ['moderator', 'observer']);
  });

  it('akcje moderatora: pomijane dla głosującego, stosowane dla moderatora', () => {
    const r = room();
    assert.equal(applyOptimistic(r, 'me', { type: 'CHANGE_DECK', deckType: 'tshirt' }), r);
    const asModerator = applyOptimistic(r, 'anna', { type: 'CHANGE_DECK', deckType: 'tshirt' });
    assert.deepEqual(asModerator.customDeck, DECK_PRESETS.tshirt);
    assert.equal(asModerator.participants.anna.hasVoted, false);
  });

  it('TIMER_ACTION: start od zera wraca do pełnego czasu, pauza zatrzymuje', () => {
    const zero = room({ timer: { duration: 60, remaining: 0, isRunning: false } });
    const started = applyOptimistic(zero, 'me', { type: 'TIMER_ACTION', action: 'start' });
    assert.deepEqual([started.timer.remaining, started.timer.isRunning], [60, true]);
    const paused = applyOptimistic(started, 'me', { type: 'TIMER_ACTION', action: 'pause' });
    assert.equal(paused.timer.isRunning, false);
  });

  it('REVEAL i COMPLETE_ROUND czekają na serwer — stan bez zmian', () => {
    const r = room();
    assert.equal(applyOptimistic(r, 'me', { type: 'REVEAL' }), r);
    assert.equal(applyOptimistic(r, 'me', { type: 'COMPLETE_ROUND', score: '5' }), r);
  });
});
