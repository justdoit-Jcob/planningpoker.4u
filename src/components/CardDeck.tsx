import React from 'react';
import { ParticipantRole } from '../types';
import { soundEffects } from '../utils/audio';

interface CardDeckProps {
  cards: string[];
  selectedVote: string | null;
  onVote: (card: string) => void;
  disabled: boolean;
  userRole: ParticipantRole;
}

export const CardDeck: React.FC<CardDeckProps> = ({
  cards,
  selectedVote,
  onVote,
  disabled,
  userRole,
}) => {
  const handleCardClick = (card: string) => {
    if (disabled || userRole === 'observer') return;
    soundEffects.playCardSelect();
    onVote(card);
  };

  if (userRole === 'observer') {
    return (
      <div className="w-full max-w-4xl mx-auto px-4 py-3 text-center">
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-3 text-xs text-slate-400 inline-flex items-center gap-2">
          <span>👀 Jesteś w trybie obserwatora. Aby móc głosować, przełącz rolę w prawym górnym rogu.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto px-2 sm:px-4 py-2 sm:py-3">
      <div className="text-center mb-1.5 sm:mb-2">
        <span className="text-[10px] sm:text-xs uppercase tracking-widest text-slate-400 font-semibold">
          {disabled ? 'Karty odkryte lub estymacja wstrzymana' : 'Wybierz swoją kartę'}
        </span>
      </div>

      {/* Responsive Horizontal Deck Carousel / Flex Grid */}
      <div className="flex items-center justify-center gap-1.5 sm:gap-2.5 overflow-x-auto pb-2 pt-1 px-1 scrollbar-thin">
        {cards.map((card) => {
          const isSelected = selectedVote === card;

          return (
            <button
              key={card}
              onClick={() => handleCardClick(card)}
              disabled={disabled}
              className={`group shrink-0 relative flex flex-col justify-between items-center w-11 h-16 sm:w-14 sm:h-22 md:w-16 md:h-24 rounded-xl font-bold transition-all duration-200 cursor-pointer select-none ${
                isSelected
                  ? 'bg-gradient-to-b from-indigo-500 to-indigo-700 text-white -translate-y-2 sm:-translate-y-3 shadow-xl shadow-indigo-500/30 ring-3 ring-indigo-400'
                  : 'bg-slate-800 hover:bg-slate-750 text-slate-200 hover:-translate-y-1 border border-slate-700 hover:border-indigo-500/50 shadow-md'
              } ${disabled ? 'opacity-40 cursor-not-allowed hover:translate-y-0' : 'active:scale-95'}`}
            >
              {/* Card Corner Index */}
              <div className="w-full text-left px-1.5 pt-1 text-[9px] sm:text-[10px] opacity-75 font-mono">
                {card}
              </div>

              {/* Card Center Value */}
              <div className="text-sm sm:text-lg md:text-xl font-black font-mono tracking-tight my-auto">
                {card}
              </div>

              {/* Card Bottom Corner Index (inverted) */}
              <div className="w-full text-right px-1.5 pb-1 text-[9px] sm:text-[10px] opacity-75 font-mono rotate-180">
                {card}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
