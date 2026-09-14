import {
  COFFEE_CARD,
  Participant,
  VoteStats,
  canCastVote,
  isAbstainCard,
} from '../types';

/**
 * Statystyki rundy.
 *
 * Dwie reguły, które wcześniej rozjeżdżały się między serwerem, tym plikiem
 * i widokiem stołu (P2-1, P2-2):
 *
 * 1. Liczy się wyłącznie połączonych uczestników, którzy mogą oddać głos
 *    (głosujący i moderator). Obserwatorzy i wpisy po rozłączeniu są pomijane —
 *    tak samo jak w liczniku „x / y” przy stole.
 * 2. Karty '?' i '☕' nie są estymatą. Nie wchodzą do średniej, mediany,
 *    mody ani konsensusu; są raportowane osobno jako wstrzymania.
 */
export function calculateVoteStats(participants: Record<string, Participant>): VoteStats {
  const voters = Object.values(participants).filter(
    (p) => canCastVote(p) && p.isConnected && p.vote !== null && p.vote !== undefined
  );

  const totalVotes = voters.length;

  const empty: VoteStats = {
    average: null,
    median: null,
    mode: [],
    consensus: 0,
    min: null,
    max: null,
    totalVotes: 0,
    estimatingVotes: 0,
    abstentions: 0,
    coffeeVotes: 0,
    distribution: {},
    lowestVoters: [],
    highestVoters: [],
  };

  if (totalVotes === 0) return empty;

  // Rozkład obejmuje wszystkie karty — także wstrzymania, bo zespół chce je widzieć.
  const distribution: Record<string, number> = {};
  for (const v of voters) {
    const val = v.vote!;
    distribution[val] = (distribution[val] || 0) + 1;
  }

  const coffeeVotes = distribution[COFFEE_CARD] || 0;

  // Konsensus, moda i statystyki liczbowe — wyłącznie z realnych estymat.
  const estimating = voters.filter((v) => !isAbstainCard(v.vote!));
  const estimatingVotes = estimating.length;
  const abstentions = totalVotes - estimatingVotes;

  if (estimatingVotes === 0) {
    return { ...empty, totalVotes, abstentions, coffeeVotes, distribution };
  }

  const estimatingDistribution: Record<string, number> = {};
  for (const v of estimating) {
    const val = v.vote!;
    estimatingDistribution[val] = (estimatingDistribution[val] || 0) + 1;
  }

  let maxCount = 0;
  for (const count of Object.values(estimatingDistribution)) {
    if (count > maxCount) maxCount = count;
  }
  const consensus = Math.round((maxCount / estimatingVotes) * 100);

  const mode: string[] = [];
  for (const [val, count] of Object.entries(estimatingDistribution)) {
    if (count === maxCount) mode.push(val);
  }

  // Wartości liczbowe — talie nieliczbowe (T-Shirt) świadomie dają null.
  const numericList: { val: number; name: string; original: string }[] = [];
  for (const v of estimating) {
    const num = parseFloat(v.vote!);
    if (!isNaN(num)) {
      numericList.push({ val: num, name: v.name, original: v.vote! });
    }
  }

  let average: number | null = null;
  let median: number | null = null;
  let min: string | null = null;
  let max: string | null = null;
  let lowestVoters: string[] = [];
  let highestVoters: string[] = [];

  if (numericList.length > 0) {
    numericList.sort((a, b) => a.val - b.val);
    const sum = numericList.reduce((acc, curr) => acc + curr.val, 0);
    average = Math.round((sum / numericList.length) * 10) / 10;

    const mid = Math.floor(numericList.length / 2);
    if (numericList.length % 2 === 1) {
      median = numericList[mid].val;
    } else {
      median = Math.round(((numericList[mid - 1].val + numericList[mid].val) / 2) * 10) / 10;
    }

    const minVal = numericList[0].val;
    const maxVal = numericList[numericList.length - 1].val;
    min = numericList[0].original;
    max = numericList[numericList.length - 1].original;

    if (minVal !== maxVal) {
      lowestVoters = numericList.filter((x) => x.val === minVal).map((x) => x.name);
      highestVoters = numericList.filter((x) => x.val === maxVal).map((x) => x.name);
    }
  }

  return {
    average,
    median,
    mode,
    consensus,
    min,
    max,
    totalVotes,
    estimatingVotes,
    abstentions,
    coffeeVotes,
    distribution,
    lowestVoters: Array.from(new Set(lowestVoters)),
    highestVoters: Array.from(new Set(highestVoters)),
  };
}

/**
 * Czy większość oddanych głosów to „☕”.
 *
 * Zespół sygnalizuje w ten sposób, że potrzebuje przerwy zamiast estymaty —
 * i to jest moment na konfetti z kawą (P2-2).
 */
export function isCoffeeMajority(stats: VoteStats): boolean {
  return stats.totalVotes > 0 && stats.coffeeVotes * 2 > stats.totalVotes;
}

/**
 * Czy runda osiągnęła pełną zgodę co do estymaty.
 * Sama zgoda na wstrzymanie się nie jest konsensusem.
 */
export function isFullConsensus(stats: VoteStats): boolean {
  return stats.estimatingVotes > 1 && stats.consensus === 100;
}
