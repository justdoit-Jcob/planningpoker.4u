import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import confetti from 'canvas-confetti';
import {
  Eye,
  CheckCircle2,
  HelpCircle,
  RotateCcw,
  Check,
  TrendingUp,
  MessageSquare,
  Award,
  Users,
} from 'lucide-react';
import { Participant, RoomState, Story } from '../types';
import { calculateVoteStats } from '../utils/stats';
import { soundEffects } from '../utils/audio';

interface PokerTableProps {
  room: RoomState;
  selfId: string;
  onRevealVotes: () => void;
  onResetVoting: (nextStoryId?: string) => void;
  onSetFinalScore: (storyId: string, score: string, advance: boolean) => void;
  onSelectStory: (storyId: string) => void;
}

export const PokerTable: React.FC<PokerTableProps> = ({
  room,
  selfId,
  onRevealVotes,
  onResetVoting,
  onSetFinalScore,
}) => {
  const isRevealed = room.votingState === 'revealed';
  const participants = Object.values(room.participants) as Participant[];
  const voters = participants.filter((p) => p.role !== 'observer');
  const observers = participants.filter((p) => p.role === 'observer');
  const votedCount = voters.filter((p) => p.vote !== null && p.isConnected).length;
  const connectedVotersCount = voters.filter((p) => p.isConnected).length;
  const allVoted = connectedVotersCount > 0 && votedCount === connectedVotersCount;

  const currentStory = room.stories.find((s) => s.id === room.currentStoryId) || null;
  const stats = isRevealed ? calculateVoteStats(room.participants) : null;

  const me = room.participants[selfId];
  const isModerator = me?.role === 'moderator';

  // Trigger confetti & fanfare if consensus is 100% on reveal
  useEffect(() => {
    if (isRevealed && stats && stats.consensus === 100 && stats.totalVotes > 1) {
      soundEffects.playConsensus();
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6'],
        });
      } catch {}
    } else if (isRevealed) {
      soundEffects.playReveal();
    }
  }, [isRevealed]);

  const [selectedScore, setSelectedScore] = React.useState<string>('');

  useEffect(() => {
    if (stats) {
      // Default suggested final score: mode or median or average
      if (stats.mode.length > 0) {
        setSelectedScore(stats.mode[0]);
      } else if (stats.median !== null) {
        setSelectedScore(stats.median.toString());
      } else if (stats.average !== null) {
        setSelectedScore(Math.round(stats.average).toString());
      }
    }
  }, [isRevealed, stats?.consensus]);

  return (
    <div className="w-full max-w-6xl mx-auto my-2 px-2 sm:px-4">
      {/* Table container */}
      <div className="relative rounded-3xl p-6 md:p-8 bg-radial from-slate-900 via-slate-950 to-slate-950 border border-slate-800 shadow-2xl overflow-hidden min-h-[420px] flex flex-col justify-between">
        {/* Subtle table felt lines */}
        <div className="absolute inset-4 rounded-2xl border border-indigo-500/10 pointer-events-none" />

        {/* Center Table Area (Controls / Analytics) */}
        <div className="relative z-10 max-w-xl mx-auto w-full my-auto text-center py-6">
          {!isRevealed ? (
            /* Voting in Progress View */
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 bg-slate-900/90 border border-slate-800 px-4 py-1.5 rounded-full text-xs font-medium text-slate-300 shadow">
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
                <span>
                  Oddano {votedCount} z {connectedVotersCount} głosów
                </span>
                {allVoted && (
                  <span className="bg-emerald-900/80 text-emerald-300 font-semibold px-2 py-0.5 rounded-full text-[10px]">
                    Wszyscy gotowi!
                  </span>
                )}
              </div>

              {/* Reveal button */}
              <div>
                <button
                  onClick={onRevealVotes}
                  disabled={votedCount === 0}
                  className={`px-8 py-3.5 rounded-xl font-bold text-sm tracking-wide shadow-lg transition-all transform cursor-pointer ${
                    votedCount > 0
                      ? 'bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-600 hover:from-indigo-500 hover:to-blue-500 text-white hover:scale-105 shadow-indigo-500/25 active:scale-95'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  Odkryj karty
                </button>
              </div>

              <p className="text-xs text-slate-500">
                {me?.role === 'observer'
                  ? 'Obserwujesz sesję jako gość / Product Owner.'
                  : me?.vote
                  ? 'Twój głos został zarejestrowany. Możesz go zmienić do momentu odkrycia.'
                  : 'Wybierz kartę z dolnej talii, aby zagłosować.'}
              </p>
            </div>
          ) : (
            /* Revealed Stats & Consensus View */
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.25 }}
              className="bg-slate-900/90 border border-slate-700/80 rounded-2xl p-5 shadow-2xl backdrop-blur-md text-slate-200"
            >
              {/* Consensus Pill */}
              <div className="flex items-center justify-center gap-2 mb-3">
                <div
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                    stats?.consensus === 100
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      : (stats?.consensus || 0) >= 70
                      ? 'bg-blue-950 text-blue-300 border border-blue-800'
                      : 'bg-amber-950 text-amber-300 border border-amber-800'
                  }`}
                >
                  {stats?.consensus === 100 ? (
                    <>
                      <Award className="w-3.5 h-3.5 text-emerald-400" />
                      <span>100% Pełna zgodność zespołu! 🎉</span>
                    </>
                  ) : (
                    <>
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span>{stats?.consensus}% Zgodność zespołu</span>
                    </>
                  )}
                </div>
              </div>

              {/* Statistics Grid */}
              <div className="grid grid-cols-3 gap-2 py-3 border-y border-slate-800 text-center">
                {room.showAverage && (
                  <div className="bg-slate-950/60 p-2 rounded-lg">
                    <div className="text-[11px] text-slate-400 font-medium">Średnia</div>
                    <div className="text-lg font-bold text-white font-mono">
                      {stats?.average !== null ? stats?.average : '—'}
                    </div>
                  </div>
                )}
                <div className="bg-slate-950/60 p-2 rounded-lg">
                  <div className="text-[11px] text-slate-400 font-medium">Mediana</div>
                  <div className="text-lg font-bold text-indigo-400 font-mono">
                    {stats?.median !== null ? stats?.median : '—'}
                  </div>
                </div>
                <div className="bg-slate-950/60 p-2 rounded-lg">
                  <div className="text-[11px] text-slate-400 font-medium">Najczęstsza (Moda)</div>
                  <div className="text-lg font-bold text-emerald-400 font-mono">
                    {stats?.mode.length ? stats?.mode.join(', ') : '—'}
                  </div>
                </div>
              </div>

              {/* Outliers discussion hint */}
              {stats && stats.lowestVoters.length > 0 && stats.highestVoters.length > 0 && (
                <div className="mt-3 p-2.5 bg-slate-950/80 rounded-lg border border-slate-800/80 flex items-start gap-2 text-left">
                  <MessageSquare className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-slate-300">
                    <span className="font-semibold text-white">Różnica w ocenie:</span>{' '}
                    Najniższa ({stats.min}):{' '}
                    <span className="text-sky-300 font-medium">{stats.lowestVoters.join(', ')}</span>{' '}
                    vs Najwyższa ({stats.max}):{' '}
                    <span className="text-amber-300 font-medium">{stats.highestVoters.join(', ')}</span>.
                    Warto omówić założenia architektoniczne i ryzyka.
                  </div>
                </div>
              )}

              {/* Final Agreement Picker */}
              <div className="mt-4 pt-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs text-slate-300">
                  <span>Ustalone punkty (SP):</span>
                  <input
                    type="text"
                    value={selectedScore}
                    onChange={(e) => setSelectedScore(e.target.value)}
                    placeholder="np. 5"
                    className="w-16 text-center font-mono font-bold bg-slate-950 border border-slate-700 rounded py-1 px-2 text-sm text-indigo-300 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onResetVoting()}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700"
                    title="Rozpocznij ponowne głosowanie nad tą samą historyjką"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Ponowne głosowanie</span>
                  </button>

                  {currentStory && (
                    <button
                      onClick={() => onSetFinalScore(currentStory.id, selectedScore || '?', true)}
                      className="flex items-center gap-1 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md cursor-pointer transition"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Zatwierdź i następna</span>
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Participants Cards Array Around the Table */}
        <div className="relative z-10 mt-6 pt-4 border-t border-slate-800/80">
          <div className="flex items-center justify-between mb-3 text-xs text-slate-400">
            <div className="flex items-center gap-1.5 font-semibold text-slate-300">
              <Users className="w-3.5 h-3.5 text-indigo-400" />
              <span>Uczestnicy sesji ({participants.length})</span>
            </div>
            <span>
              {votedCount}/{connectedVotersCount} zagłosowało
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {participants.map((p) => {
              const isMe = p.id === selfId;
              const hasVoted = p.vote !== null;
              const isObserver = p.role === 'observer';
              const isLowest = isRevealed && stats && stats.lowestVoters.includes(p.name);
              const isHighest = isRevealed && stats && stats.highestVoters.includes(p.name);

              return (
                <div
                  key={p.id}
                  className={`flex flex-col items-center p-3 rounded-xl border transition-all ${
                    !p.isConnected
                      ? 'opacity-40 bg-slate-900/40 border-slate-800'
                      : isMe
                      ? 'bg-slate-900/90 border-indigo-500/50 shadow-md'
                      : 'bg-slate-900/60 border-slate-800'
                  }`}
                >
                  {/* Poker Card Display */}
                  <div className="mb-2 w-14 h-20 perspective-500">
                    {isObserver ? (
                      <div className="w-full h-full rounded-lg bg-slate-950 border border-slate-800 flex flex-col items-center justify-center text-slate-500">
                        <Eye className="w-5 h-5 text-amber-500/70" />
                        <span className="text-[10px] mt-1 font-medium text-amber-400/80">Widz</span>
                      </div>
                    ) : !isRevealed ? (
                      /* Facedown or Waiting Card */
                      hasVoted ? (
                        <motion.div
                          initial={{ scale: 0.8 }}
                          animate={{ scale: 1 }}
                          className="w-full h-full rounded-lg bg-gradient-to-br from-indigo-700 via-indigo-900 to-slate-950 border-2 border-indigo-400/80 shadow-lg flex flex-col items-center justify-center text-white relative overflow-hidden"
                        >
                          <div className="absolute inset-0 bg-radial from-indigo-400/20 to-transparent opacity-60" />
                          <CheckCircle2 className="w-6 h-6 text-indigo-300 drop-shadow" />
                          <span className="text-[10px] font-bold text-indigo-200 mt-1 uppercase tracking-wider">
                            Gotowy
                          </span>
                        </motion.div>
                      ) : (
                        <div className="w-full h-full rounded-lg border-2 border-dashed border-slate-700/80 bg-slate-950/40 flex flex-col items-center justify-center text-slate-500 animate-pulse">
                          <HelpCircle className="w-5 h-5 text-slate-600" />
                          <span className="text-[9px] mt-1 text-slate-500">Wybiera...</span>
                        </div>
                      )
                    ) : (
                      /* Revealed Card */
                      <motion.div
                        initial={{ rotateY: 90, scale: 0.8 }}
                        animate={{ rotateY: 0, scale: 1 }}
                        transition={{ duration: 0.3 }}
                        className={`w-full h-full rounded-lg shadow-xl flex flex-col items-center justify-center font-bold text-xl font-mono select-none ${
                          isLowest
                            ? 'bg-gradient-to-b from-sky-950 to-slate-900 text-sky-300 border-2 border-sky-400 shadow-sky-500/20'
                            : isHighest
                            ? 'bg-gradient-to-b from-amber-950 to-slate-900 text-amber-300 border-2 border-amber-400 shadow-amber-500/20'
                            : hasVoted
                            ? 'bg-gradient-to-b from-slate-800 to-slate-950 text-white border-2 border-indigo-500/60 shadow-indigo-500/10'
                            : 'bg-slate-900 text-slate-600 border border-slate-800'
                        }`}
                      >
                        <span>{p.vote ?? '—'}</span>
                        <span className="text-[8px] text-slate-400 font-sans mt-0.5">
                          {isLowest ? 'MIN' : isHighest ? 'MAX' : ''}
                        </span>
                      </motion.div>
                    )}
                  </div>

                  {/* Participant Name & Status */}
                  <div className="text-center w-full min-w-0">
                    <div className="flex items-center justify-center gap-1">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: p.avatarColor }}
                      />
                      <span className="text-xs font-semibold text-slate-200 truncate max-w-[90px]">
                        {p.name} {isMe && '(Ty)'}
                      </span>
                    </div>

                    <div className="flex items-center justify-center gap-1 mt-0.5">
                      {p.role === 'moderator' && (
                        <span className="text-[9px] bg-indigo-950 text-indigo-300 border border-indigo-800 px-1 py-0.2 rounded font-medium">
                          Mod
                        </span>
                      )}
                      {!p.isConnected && (
                        <span className="text-[9px] text-rose-400 font-medium">Offline</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
