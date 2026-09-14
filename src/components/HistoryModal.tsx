import React from 'react';
import { History, Trash2, Calendar, CheckCircle, BarChart2 } from 'lucide-react';
import { EstimationRoundResult } from '../types';

interface HistoryModalProps {
  isOpen: boolean;
  history: EstimationRoundResult[];
  onClose: () => void;
  onClearHistory: () => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  history,
  onClose,
  onClearHistory,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl text-slate-200 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-900/60 border border-indigo-700/60 flex items-center justify-center text-indigo-400">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Historia rund</h2>
              <p className="text-xs text-slate-400">Podsumowanie zakończonych estymacji w tej sesji</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-lg p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto py-3 space-y-2.5 my-2 pr-1 scrollbar-thin">
          {history.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              <History className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>Brak zapisanych estymacji w tej sesji.</p>
              <p className="text-[11px] mt-1 text-slate-600">
                Po odkryciu kart kliknij „Zapisz wynik i dalej”, aby odłożyć podsumowanie tutaj.
              </p>
            </div>
          ) : (
            history.map((item, idx) => (
              <div
                key={idx}
                className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 flex items-center justify-between gap-3 hover:border-slate-700 transition"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-[10px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-800/80 px-2 py-0.5 rounded">
                      Runda #{item.round}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="text-xs sm:text-sm font-semibold text-white truncate">
                    {item.topic || 'Bez podanego tematu'}
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1">
                    <span>Zgoda: {item.stats.consensus}%</span>
                    <span>•</span>
                    <span>Głosów: {item.stats.totalVotes}</span>
                    {item.stats.average !== null && (
                      <>
                        <span>•</span>
                        <span>Średnia: {item.stats.average}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="shrink-0 text-right pl-2 border-l border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase font-medium">Wynik</div>
                  <div className="text-lg font-black font-mono text-emerald-400">
                    {item.consensusScore}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
          {history.length > 0 ? (
            <button
              onClick={onClearHistory}
              className="text-red-400 hover:text-red-300 flex items-center gap-1 py-1.5 px-2 rounded hover:bg-red-950/30 transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Wyczyść historię</span>
            </button>
          ) : (
            <div />
          )}

          <button
            onClick={onClose}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-4 py-2 rounded-xl transition cursor-pointer"
          >
            Zamknij
          </button>
        </div>
      </div>
    </div>
  );
};
