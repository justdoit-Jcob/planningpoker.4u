import React from 'react';
import { Users, Crown, Vote, Eye, CheckCircle2, Clock } from 'lucide-react';
import { Participant, ParticipantRole } from '../types';

interface ParticipantsModalProps {
  isOpen: boolean;
  participants: Participant[];
  selfId: string;
  onClose: () => void;
  onPromoteModerator?: (userId: string) => void;
}

export const ParticipantsModal: React.FC<ParticipantsModalProps> = ({
  isOpen,
  participants,
  selfId,
  onClose,
  onPromoteModerator,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl text-slate-200 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-900/60 border border-indigo-700/60 flex items-center justify-center text-indigo-400">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Zespół w pokoju</h2>
              <p className="text-xs text-slate-400">{participants.length} podłączonych uczestników</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-lg p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto py-3 space-y-2 my-2 pr-1 scrollbar-thin">
          {participants.map((p) => {
            const isSelf = p.id === selfId;

            return (
              <div
                key={p.id}
                className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-xs shrink-0 shadow"
                    style={{ backgroundColor: p.avatarColor }}
                  >
                    {p.name.charAt(0).toUpperCase()}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs sm:text-sm font-semibold text-white truncate">
                        {p.name}
                      </span>
                      {isSelf && (
                        <span className="text-[10px] bg-indigo-900 text-indigo-300 px-1.5 py-0.2 rounded">
                          Ty
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                      <span className="capitalize">{p.role === 'voter' ? 'Głosujący' : p.role === 'observer' ? 'Obserwator' : 'Moderator'}</span>
                      <span>•</span>
                      <span className={p.isConnected ? 'text-emerald-400' : 'text-slate-500'}>
                        {p.isConnected ? 'Online' : 'Offline'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Vote Indicator */}
                <div className="shrink-0">
                  {p.role === 'voter' ? (
                    p.vote !== null ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-2 py-0.5 rounded-lg">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Oddał głos</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded-lg">
                        <Clock className="w-3 h-3 text-slate-500" />
                        <span>Wybiera...</span>
                      </span>
                    )
                  ) : (
                    <span className="text-[11px] text-slate-500 italic">Obserwuje</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-xl transition cursor-pointer"
          >
            Zamknij
          </button>
        </div>
      </div>
    </div>
  );
};
