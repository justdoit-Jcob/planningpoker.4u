import React, { useState } from 'react';
import { Eye, RotateCcw, BarChart2, Trophy, AlertTriangle } from 'lucide-react';
import { Participant, RoomState, VoteStats, canCastVote } from '../types';
import { calculateVoteStats, isCoffeeMajority, isFullConsensus } from '../utils/stats';
import { soundEffects } from '../utils/audio';
import { fireCoffeeConfetti, fireConsensusConfetti } from '../utils/celebrate';

interface PokerTableProps {
  room: RoomState;
  selfId: string;
  onReveal: () => void;
  onReset: () => void;
  onCompleteRound: (score: string) => void;
  onInvite: () => void;
}

export const PokerTable: React.FC<PokerTableProps> = ({
  room,
  selfId,
  onReveal,
  onReset,
  onCompleteRound,
  onInvite,
}) => {
  const participants = Object.values(room.participants) as Participant[];
  // Przy stole siedzą wszyscy, którzy mogą oddać głos — także moderator (P2-1).
  const voters = participants.filter(canCastVote);
  const observers = participants.filter((p) => p.role === 'observer');
  const isRevealed = room.votingState === 'revealed';

  // Licznik obejmuje wszystkich połączonych przy stole, razem z moderatorem.
  // Moderator nadal nie blokuje automatycznego odkrycia — może estymować,
  // ale nie musi — więc karty potrafią odsłonić się przy niepełnym liczniku.
  const seatedVoters = participants.filter((p) => canCastVote(p) && p.isConnected);
  const votesCount = seatedVoters.filter((p) => p.hasVoted).length;
  const totalEligibleVoters = seatedVoters.length;
  const allVoted = totalEligibleVoters > 0 && votesCount === totalEligibleVoters;

  const currentStats: VoteStats = calculateVoteStats(room.participants);

  const [selectedScore, setSelectedScore] = useState<string>('');

  const coffeeBreak = isCoffeeMajority(currentStats);
  const fullConsensus = isFullConsensus(currentStats);

  React.useEffect(() => {
    if (isRevealed) {
      soundEffects.playReveal();

      if (coffeeBreak) {
        // Zespół prosi o przerwę zamiast estymaty (P2-2).
        fireCoffeeConfetti();
      } else if (fullConsensus) {
        soundEffects.playConsensus();
        fireConsensusConfetti();
      }

      if (currentStats.mode.length > 0) {
        setSelectedScore(currentStats.mode[0]);
      } else if (currentStats.median !== null) {
        setSelectedScore(String(currentStats.median));
      }
    } else {
      setSelectedScore('');
    }
  }, [isRevealed, coffeeBreak, fullConsensus]);

  const handleFinishRound = () => {
    if (!selectedScore) return;
    onCompleteRound(selectedScore);
  };

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col items-center justify-center p-2 sm:p-4">
      {/* Table Oval Surface */}
      <div className="relative w-full min-h-[300px] sm:min-h-[360px] md:min-h-[420px] rounded-[36px] sm:rounded-[54px] bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 border-4 border-slate-800/80 shadow-[0_20px_50px_rgba(0,0,0,0.6)] flex flex-col items-center justify-center p-4 sm:p-8 my-2 sm:my-4 transition-all">
        {/* Subtle Felt pattern / Inner Glow */}
        <div className="absolute inset-2 sm:inset-4 rounded-[30px] sm:rounded-[46px] border border-indigo-500/10 pointer-events-none bg-radial from-indigo-950/20 via-transparent to-transparent"></div>

        {/* Center Felt / Action Console */}
        <div className="relative z-10 flex flex-col items-center justify-center text-center max-w-md w-full px-2">
          {!isRevealed ? (
            <div className="space-y-3 sm:space-y-4">
              <div className="flex flex-col items-center">
                <span className="text-xs uppercase tracking-widest text-slate-400 font-semibold mb-1">
                  Status głosowania
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-2xl sm:text-3xl font-extrabold text-white font-mono">
                    {votesCount} / {totalEligibleVoters}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">oddanych głosów</span>
                </div>
                {/* Progress bar */}
                <div className="w-44 sm:w-56 h-2 bg-slate-800 rounded-full mt-2 overflow-hidden border border-slate-700/50">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-blue-500 transition-all duration-300 rounded-full"
                    style={{
                      width: `${totalEligibleVoters > 0 ? (votesCount / totalEligibleVoters) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              {/* Reveal Action Button */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-1">
                <button
                  onClick={onReveal}
                  disabled={votesCount === 0}
                  className={`min-h-[44px] px-5 sm:px-6 py-2.5 rounded-xl font-bold text-sm shadow-xl flex items-center justify-center gap-2 transition transform active:scale-95 cursor-pointer ${
                    allVoted
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white ring-4 ring-emerald-500/20 animate-pulse'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 disabled:hover:bg-indigo-600 disabled:cursor-not-allowed'
                  }`}
                >
                  <Eye className="size-4" />
                  <span>Odkryj karty</span>
                </button>

                <button
                  onClick={onReset}
                  className="min-h-[44px] px-3.5 py-2 rounded-xl text-sm font-semibold text-slate-400 hover:text-white hover:bg-slate-800/80 transition flex items-center justify-center gap-1.5 border border-slate-800 cursor-pointer"
                  title="Wyczyść głosy i zresetuj stół"
                >
                  <RotateCcw className="size-4" />
                  <span>Resetuj</span>
                </button>
              </div>

              {totalEligibleVoters === 0 && (
                <div className="text-xs text-amber-400/90 bg-amber-950/40 border border-amber-800/50 px-3 py-1.5 rounded-lg flex items-center gap-1.5 justify-center">
                  <AlertTriangle className="size-4 shrink-0" />
                  <span>Brak aktywnych głosujących. Zaproś zespół lub zmień rolę na głosującego!</span>
                </div>
              )}
            </div>
          ) : (
            /* Results Console */
            <div className="space-y-3 sm:space-y-4 w-full animate-fadeIn">
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 sm:p-4 shadow-xl backdrop-blur-md">
                {/* Consensus Pill */}
                <div className="flex items-center justify-center gap-2 mb-2">
                  {currentStats.consensus >= 80 ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-300 bg-emerald-950/80 border border-emerald-800/80 px-2.5 py-1 rounded-full">
                      <Trophy className="size-4 text-emerald-400" />
                      Zgoda zespołu: {currentStats.consensus}%
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-300 bg-amber-950/80 border border-amber-800/80 px-2.5 py-1 rounded-full">
                      <BarChart2 className="size-4 text-amber-400" />
                      Zróżnicowane głosy (Zgoda: {currentStats.consensus}%)
                    </span>
                  )}
                </div>

                {/* Primary Stats Grid */}
                <div className="grid grid-cols-3 gap-2 py-2 border-y border-slate-800/80 text-center">
                  <div>
                    <div className="text-xs text-slate-400 uppercase font-semibold">Średnia</div>
                    <div className="text-base sm:text-lg font-extrabold text-white font-mono">
                      {currentStats.average !== null ? currentStats.average : '-'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 uppercase font-semibold">Mediana</div>
                    <div className="text-base sm:text-lg font-extrabold text-indigo-400 font-mono">
                      {currentStats.median !== null ? currentStats.median : '-'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 uppercase font-semibold">Najczęstsza</div>
                    <div className="text-base sm:text-lg font-extrabold text-emerald-400 font-mono">
                      {currentStats.mode.join(', ') || '-'}
                    </div>
                  </div>
                </div>

                {/* Vote Distribution Chips */}
                {Object.keys(currentStats.distribution).length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
                    {Object.entries(currentStats.distribution).map(([card, count]) => (
                      <span
                        key={card}
                        className="text-xs bg-slate-800/90 text-slate-200 border border-slate-700 px-2 py-0.5 rounded-lg flex items-center gap-1"
                      >
                        <span className="font-bold text-indigo-300">{card}</span>
                        <span className="text-xs text-slate-400">×{count}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* End of round controls: Reset or Next Round */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-1">
                <button
                  onClick={onReset}
                  className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white shadow-lg flex items-center justify-center gap-2 cursor-pointer transition transform active:scale-95"
                >
                  <RotateCcw className="size-4" />
                  <span>Nowa runda (Reset)</span>
                </button>

                {/* Save to history option */}
                {selectedScore && (
                  <button
                    onClick={handleFinishRound}
                    className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 transition flex items-center justify-center gap-1.5 cursor-pointer"
                    title="Zapisz ten wynik w historii i rozpocznij kolejną rundę"
                  >
                    <span>Zapisz wynik ({selectedScore}) i dalej</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Circular / Elliptical Participant Cards Placement */}
        <div className="w-full mt-6 pt-4 border-t border-slate-800/40">
          <div className="text-xs text-slate-400 font-semibold text-center uppercase tracking-wider mb-3">
            Uczestnicy ({participants.length})
          </div>

          {/* Responsive Voters Flex Grid */}
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 max-w-4xl mx-auto">
            {voters.map((p) => {
              const isSelf = p.id === selfId;
              // Przed odkryciem serwer nie przysyła cudzych kart — tylko sam fakt głosu (P0-1).
              const hasVoted = p.hasVoted;

              return (
                <div
                  key={p.id}
                  className={`flex flex-col items-center transition-all ${
                    !p.isConnected ? 'opacity-40 grayscale' : ''
                  }`}
                >
                  {/* Card Element */}
                  <div
                    className={`w-14 h-20 sm:w-16 sm:h-24 rounded-xl flex items-center justify-center font-bold shadow-lg transition-all duration-300 relative ${
                      isRevealed
                        ? 'bg-gradient-to-b from-indigo-600 to-indigo-800 text-white border-2 border-indigo-400/80 scale-105'
                        : hasVoted
                        ? 'bg-gradient-to-b from-emerald-600 to-teal-700 text-white border-2 border-emerald-400 shadow-emerald-500/20'
                        : 'bg-slate-800/90 text-slate-500 border-2 border-dashed border-slate-700'
                    }`}
                  >
                    {isRevealed ? (
                      <span className="text-base sm:text-xl font-black font-mono">
                        {p.vote !== null ? p.vote : '—'}
                      </span>
                    ) : hasVoted ? (
                      <div className="flex flex-col items-center">
                        <span className="text-xs text-emerald-200">✓</span>
                        <span className="text-xs font-mono text-emerald-300/80 uppercase">Gotowy</span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500">...</span>
                    )}

                    {/* Self Indicator Marker */}
                    {isSelf && (
                      <span className="absolute -top-2 -right-2 size-5 bg-indigo-500 rounded-full ring-2 ring-slate-900 flex items-center justify-center text-xs font-bold text-white">
                        ★
                      </span>
                    )}
                  </div>

                  {/* Participant Name & Status */}
                  <div className="mt-1.5 flex items-center gap-1 max-w-[85px] sm:max-w-[105px] truncate">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: p.avatarColor }}
                    />
                    <span
                      className={`text-xs sm:text-sm truncate font-medium ${
                        isSelf ? 'text-indigo-300 font-bold' : 'text-slate-300'
                      }`}
                    >
                      {p.name} {isSelf && '(Ty)'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Observers row if any */}
          {observers.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-800/40 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-400">
              <span className="text-xs uppercase font-semibold text-slate-500 mr-1">Obserwatorzy:</span>
              {observers.map((o) => (
                <span
                  key={o.id}
                  className="bg-slate-800/60 px-2 py-0.5 rounded-lg border border-slate-700/60 flex items-center gap-1 text-xs"
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: o.avatarColor }} />
                  <span>{o.name}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
