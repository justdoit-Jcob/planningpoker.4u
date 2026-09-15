import React from 'react';
import { Settings, Check, X } from 'lucide-react';
import { DeckType, DECK_LABELS, RoomState } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  room: RoomState;
  onClose: () => void;
  onChangeDeck: (deckType: DeckType) => void;
  onUpdateSettings: (settings: { autoReveal?: boolean; showAverage?: boolean; roomName?: string }) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  room,
  onClose,
  onChangeDeck,
  onUpdateSettings,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl text-slate-200 m-auto animate-fadeIn">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-900/60 border border-indigo-700/60 flex items-center justify-center text-indigo-400 shrink-0">
              <Settings className="size-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Ustawienia sesji</h3>
              <p className="text-xs text-slate-400">Konfiguracja zasad i talii kart w pokoju</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
            title="Zamknij"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Settings Options */}
        <div className="space-y-3.5 text-sm">
          {/* Auto Reveal Setting */}
          <label className="flex items-center justify-between p-3.5 bg-slate-950/70 rounded-2xl border border-slate-800/90 hover:border-slate-700 cursor-pointer transition">
            <div className="pr-3">
              <div className="font-semibold text-white text-sm">Automatyczne odkrywanie kart</div>
              <div className="text-slate-400 text-xs mt-0.5">
                Odkrywaj natychmiast, gdy wszyscy uprawnieni uczestnicy oddadzą głos.
              </div>
            </div>
            <input
              type="checkbox"
              checked={room.autoReveal}
              onChange={(e) => onUpdateSettings({ autoReveal: e.target.checked })}
              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-800 border-slate-700 cursor-pointer shrink-0"
            />
          </label>

          {/* Show Average Setting */}
          <label className="flex items-center justify-between p-3.5 bg-slate-950/70 rounded-2xl border border-slate-800/90 hover:border-slate-700 cursor-pointer transition">
            <div className="pr-3">
              <div className="font-semibold text-white text-sm">Pokazuj średnią arytmetyczną</div>
              <div className="text-slate-400 text-xs mt-0.5">
                Wyliczaj i wyświetlaj średnią arytmetyczną po odkryciu kart.
              </div>
            </div>
            <input
              type="checkbox"
              checked={room.showAverage}
              onChange={(e) => onUpdateSettings({ showAverage: e.target.checked })}
              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-800 border-slate-700 cursor-pointer shrink-0"
            />
          </label>

          {/* Estimation Scale Selector */}
          <div className="p-3.5 bg-slate-950/70 rounded-2xl border border-slate-800/90">
            <label className="block text-slate-200 font-semibold text-sm mb-1.5">
              Skala estymacji (Talia)
            </label>
            <p className="text-xs text-slate-400 mb-2">
              Zmiana skali natychmiast zaktualizuje karty u wszystkich uczestników.
            </p>
            <select
              value={room.deckType}
              onChange={(e) => onChangeDeck(e.target.value as DeckType)}
              className="w-full bg-slate-900 text-white rounded-xl px-3 py-2.5 border border-slate-700 focus:outline-none focus:border-indigo-500 cursor-pointer text-sm"
            >
              {(Object.keys(DECK_LABELS) as DeckType[]).map((type) => (
                <option key={type} value={type}>
                  {DECK_LABELS[type]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-3 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition cursor-pointer shadow-lg shadow-indigo-600/20"
          >
            Gotowe
          </button>
        </div>
      </div>
    </div>
  );
};
