import React from 'react';
import { motion } from 'motion/react';
import { Eye, Check, Lock } from 'lucide-react';
import { ParticipantRole } from '../types';
import { soundEffects } from '../utils/audio';

interface CardDeckProps {
  cards: string[];
  selectedCard: string | null;
  role: ParticipantRole;
  isRevealed: boolean;
  onSelectCard: (card: string | null) => void;
  onSwitchToVoter: () => void;
}

export const CardDeck: React.FC<CardDeckProps> = ({
  cards,
  selectedCard,
  role,
  isRevealed,
  onSelectCard,
  onSwitchToVoter,
}) => {
  const isObserver = role === 'observer';

  const handleCardClick = (cardVal: string) => {
    if (isRevealed || isObserver) return;
    if (selectedCard === cardVal) {
      // Deselect
      onSelectCard(null);
    } else {
      soundEffects.playCardSelect();
      onSelectCard(cardVal);
    }
  };

  return (
    <div className="w-full bg-slate-900/90 backdrop-blur-md border-t border-slate-800 py-3 px-4 shadow-xl sticky bottom-0 z-30">
      <div className="max-w-6xl mx-auto">
        {isObserver ? (
          /* Observer Notice */
          <div className="flex items-center justify-between bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-300">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                Obserwujesz spotkanie w trybie widza (Product Owner / Stakeholder). Twoje głosy nie są
                wymagane do ukończenia rundy.
              </span>
            </div>
            <button
              onClick={onSwitchToVoter}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-3 py-1.5 rounded-lg shrink-0 transition"
            >
              Dołącz jako głosujący
            </button>
          </div>
        ) : isRevealed ? (
          /* Revealed notification */
          <div className="flex items-center justify-center gap-2 py-2 text-xs text-slate-400 font-medium bg-slate-950/50 rounded-lg border border-slate-800">
            <Lock className="w-3.5 h-3.5 text-indigo-400" />
            <span>Karty zostały odkryte. Wybór kart jest zablokowany do nowej rundy.</span>
          </div>
        ) : (
          /* Interactive Voting Cards Hand */
          <div>
            <div className="flex items-center justify-between mb-2 text-xs text-slate-400">
              <span className="font-semibold text-slate-300">Twoja talia estymacji:</span>
              <span>
                {selectedCard ? (
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    Wybrano: {selectedCard} (kliknij ponownie, by anulować)
                  </span>
                ) : (
                  'Wybierz kartę'
                )}
              </span>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-700">
              {cards.map((card) => {
                const isSelected = selectedCard === card;

                return (
                  <motion.button
                    key={card}
                    whileHover={{ y: -6, scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleCardClick(card)}
                    className={`relative shrink-0 w-12 h-18 sm:w-14 sm:h-22 rounded-xl flex flex-col items-center justify-center font-mono font-bold text-base sm:text-lg border-2 transition-all cursor-pointer select-none shadow-md ${
                      isSelected
                        ? 'bg-gradient-to-b from-indigo-600 to-blue-700 text-white border-white shadow-indigo-500/40 -translate-y-2 ring-2 ring-indigo-400'
                        : 'bg-slate-800 hover:bg-slate-750 text-slate-200 border-slate-700 hover:border-indigo-400/80 shadow-slate-950'
                    }`}
                  >
                    {/* Top small corner number */}
                    <span className="absolute top-1 left-1.5 text-[9px] font-sans opacity-75">
                      {card}
                    </span>

                    {/* Center big number */}
                    <span>{card}</span>

                    {/* Bottom small corner number (flipped) */}
                    <span className="absolute bottom-1 right-1.5 text-[9px] font-sans opacity-75 rotate-180">
                      {card}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
