import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { Participant, SelfAssignableRole, ParticipantRole } from '../types';
import { calculateVoteStats, isCoffeeMajority, isFullConsensus } from './stats';

let seq = 0;

function participant(
  vote: string | null,
  overrides: Partial<Participant> = {}
): Participant {
  seq += 1;
  const role: ParticipantRole = overrides.role ?? 'voter';
  const preferredRole: SelfAssignableRole =
    overrides.preferredRole ?? (role === 'observer' ? 'observer' : 'voter');

  return {
    id: `u${seq}`,
    name: `Uczestnik ${seq}`,
    role,
    preferredRole,
    avatarColor: '#3B82F6',
    vote,
    hasVoted: vote !== null,
    revealedVote: null,
    isConnected: true,
    joinedAt: 0,
    joinOrder: seq,
    lastSeen: 0,
    ...overrides,
  };
}

function room(...list: Participant[]): Record<string, Participant> {
  return Object.fromEntries(list.map((p) => [p.id, p]));
}

describe('calculateVoteStats', () => {
  it('zwraca pusty wynik, gdy nikt nie zagłosował', () => {
    const stats = calculateVoteStats(room(participant(null), participant(null)));
    assert.equal(stats.totalVotes, 0);
    assert.equal(stats.average, null);
    assert.equal(stats.median, null);
    assert.equal(stats.consensus, 0);
    assert.deepEqual(stats.mode, []);
  });

  it('liczy medianę dla nieparzystej liczby głosów', () => {
    const stats = calculateVoteStats(
      room(participant('1'), participant('3'), participant('13'))
    );
    assert.equal(stats.median, 3);
    assert.equal(stats.average, 5.7);
    assert.equal(stats.estimatingVotes, 3);
  });

  it('liczy medianę dla parzystej liczby głosów', () => {
    const stats = calculateVoteStats(
      room(participant('2'), participant('3'), participant('5'), participant('8'))
    );
    assert.equal(stats.median, 4);
  });

  it('pomija obserwatorów', () => {
    const stats = calculateVoteStats(
      room(participant('5'), participant('100', { role: 'observer', preferredRole: 'observer' }))
    );
    assert.equal(stats.totalVotes, 1);
    assert.equal(stats.average, 5);
  });

  it('pomija uczestników rozłączonych', () => {
    const stats = calculateVoteStats(
      room(participant('5'), participant('100', { isConnected: false }))
    );
    assert.equal(stats.totalVotes, 1);
    assert.equal(stats.average, 5);
  });

  it('wlicza głos moderatora, gdy ten zagłosował', () => {
    const stats = calculateVoteStats(
      room(participant('2'), participant('4', { role: 'moderator' }))
    );
    assert.equal(stats.totalVotes, 2);
    assert.equal(stats.average, 3);
  });

  it('pomija moderatora, który wybrał obserwację', () => {
    const stats = calculateVoteStats(
      room(participant('2'), participant('8', { role: 'moderator', preferredRole: 'observer' }))
    );
    assert.equal(stats.totalVotes, 1);
    assert.equal(stats.average, 2);
  });

  it('trzyma wstrzymania poza konsensusem, średnią i modą', () => {
    const stats = calculateVoteStats(
      room(participant('5'), participant('5'), participant('?'), participant('☕'))
    );
    assert.equal(stats.totalVotes, 4);
    assert.equal(stats.estimatingVotes, 2);
    assert.equal(stats.abstentions, 2);
    assert.equal(stats.coffeeVotes, 1);
    assert.equal(stats.consensus, 100);
    assert.deepEqual(stats.mode, ['5']);
    assert.equal(stats.average, 5);
    // Rozkład nadal pokazuje wszystkie karty — zespół chce je widzieć.
    assert.deepEqual(stats.distribution, { '5': 2, '?': 1, '☕': 1 });
  });

  it('nie ogłasza konsensusu, gdy wszyscy się wstrzymali', () => {
    const stats = calculateVoteStats(
      room(participant('?'), participant('?'), participant('☕'))
    );
    assert.equal(stats.totalVotes, 3);
    assert.equal(stats.estimatingVotes, 0);
    assert.equal(stats.abstentions, 3);
    assert.equal(stats.consensus, 0);
    assert.deepEqual(stats.mode, []);
    assert.equal(isFullConsensus(stats), false);
  });

  it('dla talii nieliczbowej zwraca null w miarach liczbowych, ale liczy konsensus', () => {
    const stats = calculateVoteStats(
      room(participant('M'), participant('M'), participant('L'))
    );
    assert.equal(stats.average, null);
    assert.equal(stats.median, null);
    assert.equal(stats.min, null);
    assert.equal(stats.max, null);
    assert.equal(stats.estimatingVotes, 3);
    assert.equal(stats.consensus, 67);
    assert.deepEqual(stats.mode, ['M']);
  });

  it('wskazuje skrajnych głosujących tylko przy rozbieżności', () => {
    const spread = calculateVoteStats(
      room(
        participant('1', { name: 'Ala' }),
        participant('21', { name: 'Bartek' })
      )
    );
    assert.deepEqual(spread.lowestVoters, ['Ala']);
    assert.deepEqual(spread.highestVoters, ['Bartek']);

    const agreed = calculateVoteStats(
      room(participant('5', { name: 'Ala' }), participant('5', { name: 'Bartek' }))
    );
    assert.deepEqual(agreed.lowestVoters, []);
    assert.deepEqual(agreed.highestVoters, []);
  });

  it('obsługuje pojedynczego głosującego', () => {
    const stats = calculateVoteStats(room(participant('8')));
    assert.equal(stats.consensus, 100);
    assert.equal(stats.median, 8);
    // Jeden głos to nie jest zgoda zespołu.
    assert.equal(isFullConsensus(stats), false);
  });

  it('radzi sobie z ułamkami ze skali Scrum Standard', () => {
    const stats = calculateVoteStats(room(participant('0.5'), participant('1')));
    assert.equal(stats.average, 0.8);
    assert.equal(stats.median, 0.8);
  });
});

describe('isCoffeeMajority', () => {
  it('reaguje dopiero na ścisłą większość', () => {
    const tie = calculateVoteStats(room(participant('☕'), participant('5')));
    assert.equal(isCoffeeMajority(tie), false);

    const majority = calculateVoteStats(
      room(participant('☕'), participant('☕'), participant('5'))
    );
    assert.equal(isCoffeeMajority(majority), true);
  });

  it('jest fałszem, gdy nikt nie głosował', () => {
    assert.equal(isCoffeeMajority(calculateVoteStats(room())), false);
  });
});

describe('isFullConsensus', () => {
  it('wymaga co najmniej dwóch zgodnych estymat', () => {
    const consensus = calculateVoteStats(room(participant('5'), participant('5')));
    assert.equal(isFullConsensus(consensus), true);

    const split = calculateVoteStats(room(participant('5'), participant('8')));
    assert.equal(isFullConsensus(split), false);
  });
});
