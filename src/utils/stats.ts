import { Participant, VoteStats } from '../types';

export function calculateVoteStats(participants: Record<string, Participant>): VoteStats {
  const voters = Object.values(participants).filter(
    (p) => p.role !== 'observer' && p.vote !== null && p.vote !== undefined
  );

  const totalVotes = voters.length;
  if (totalVotes === 0) {
    return {
      average: null,
      median: null,
      mode: [],
      consensus: 0,
      min: null,
      max: null,
      totalVotes: 0,
      distribution: {},
      lowestVoters: [],
      highestVoters: [],
    };
  }

  // Distribution
  const distribution: Record<string, number> = {};
  for (const v of voters) {
    const val = v.vote!;
    distribution[val] = (distribution[val] || 0) + 1;
  }

  // Consensus percentage
  let maxCount = 0;
  for (const count of Object.values(distribution)) {
    if (count > maxCount) maxCount = count;
  }
  const consensus = Math.round((maxCount / totalVotes) * 100);

  // Numeric votes for average, median, min, max
  const numericList: { val: number; name: string; original: string }[] = [];
  for (const v of voters) {
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

  // Mode
  const mode: string[] = [];
  for (const [val, count] of Object.entries(distribution)) {
    if (count === maxCount) {
      mode.push(val);
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
    distribution,
    lowestVoters: Array.from(new Set(lowestVoters)),
    highestVoters: Array.from(new Set(highestVoters)),
  };
}
