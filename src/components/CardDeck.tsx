import React from 'react';
import { ParticipantRole } from '../types';
import { soundEffects } from '../utils/audio';
import { cardValueTextClass } from '../utils/cardValue';

interface CardDeckProps {
  cards: string[];
  selectedVote: string | null;
  onVote: (card: string) => void;
  /** Karty odkryte — talia zostaje aktywna, żeby dało się zmienić głos. */
  isRevealed: boolean;
  /** Własna karta różni się od tej z chwili odkrycia. */
  isChanged: boolean;
  userRole: ParticipantRole;
}

export const CardDeck: React.FC<CardDeckProps> = ({
  cards,
  selectedVote,
  onVote,
  isRevealed,
  isChanged,
  userRole,
}) => {
  const handleCardClick = (card: string) => {
    if (userRole === 'observer') return;
    soundEffects.playCardSelect();
    onVote(card);
  };

  if (userRole === 'observer') {
    return (
      <div className="w-full max-w-4xl mx-auto px-4 py-3 text-center">
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-3 text-sm text-slate-400 inline-flex items-center gap-2">
          <span>👀 Jesteś w trybie obserwatora. Aby móc głosować, przełącz rolę w prawym górnym rogu.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto px-2 sm:px-4 py-2 sm:py-3">
      <div className="text-center mb-0">
        <span className="text-xs uppercase tracking-widest text-slate-400 font-semibold">
          {isRevealed ? 'Karty odkryte — możesz zmienić swoją kartę' : 'Wybierz swoją kartę'}
        </span>
      </div>

      {/*
        Responsive Horizontal Deck Carousel / Flex Grid

        Górny padding musi pomieścić uniesienie zaznaczonej karty
        (-translate-y-2 = 8px, sm:-translate-y-3 = 12px) wraz z obwódką
        ring-3 (3px). Bez tego karta wchodzi na napis powyżej, a ponieważ
        overflow-x-auto wymusza przycinanie także w pionie — jest dodatkowo
        obcinana u góry.
      */}
      <div className="flex items-center justify-center gap-1.5 sm:gap-2.5 overflow-x-auto pb-2 pt-4 sm:pt-5 px-1 scrollbar-thin">
        {cards.map((card) => {
          const isSelected = selectedVote === card;

          return (
            <button
              key={card}
              onClick={() => handleCardClick(card)}
              className={`group shrink-0 relative flex flex-col justify-between items-center w-11 h-16 sm:w-14 sm:h-22 md:w-16 md:h-24 rounded-xl font-bold transition-all duration-200 cursor-pointer select-none active:scale-95 ${
                isSelected && isChanged
                  ? 'bg-gradient-to-b from-amber-500 to-orange-600 text-white -translate-y-2 sm:-translate-y-3 shadow-xl shadow-amber-500/30 ring-3 ring-amber-300'
                  : isSelected
                  ? 'bg-gradient-to-b from-indigo-500 to-indigo-700 text-white -translate-y-2 sm:-translate-y-3 shadow-xl shadow-indigo-500/30 ring-3 ring-indigo-400'
                  : 'bg-slate-800 hover:bg-slate-750 text-slate-200 hover:-translate-y-1 border border-slate-700 hover:border-indigo-500/50 shadow-md'
              }`}
            >
              {/* Card Value */}
              <div className={`${cardValueTextClass(card)} font-black font-mono tracking-tight my-auto`}>
                {card}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
