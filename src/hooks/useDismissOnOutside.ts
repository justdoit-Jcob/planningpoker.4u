import { RefObject, useEffect, useRef } from 'react';

/**
 * Wywołuje onDismiss, gdy wskaźnik trafi poza obszar elementu.
 *
 * Nasłuch działa tylko wtedy, gdy element jest aktywny (rozwinięty, w trybie
 * edycji), więc zamknięty komponent nie trzyma globalnego listenera.
 *
 * Używany jest pointerdown, a nie click: łapie mysz i dotyk jednym zdarzeniem
 * i reaguje w momencie wciśnięcia, zanim kliknięty element przejmie focus.
 * Referencja musi obejmować cały obszar uznawany za „wewnątrz” — przy polu
 * edycji także przycisk zapisu, a przy liście rozwijanej również przycisk,
 * który ją otwiera, żeby jego własny onClick mógł ją normalnie przełączyć.
 */
export function useDismissOnOutside<T extends HTMLElement>(
  ref: RefObject<T | null>,
  active: boolean,
  onDismiss: () => void
): void {
  // Callback trzymany w refie, żeby zmiana jego tożsamości przy każdym
  // renderze nie przepinała globalnego nasłuchu.
  const handlerRef = useRef(onDismiss);
  useEffect(() => {
    handlerRef.current = onDismiss;
  });

  useEffect(() => {
    if (!active) return;

    const handlePointerDown = (event: PointerEvent) => {
      const element = ref.current;
      if (!element) return;
      if (event.target instanceof Node && element.contains(event.target)) return;
      handlerRef.current();
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [ref, active]);
}

/**
 * Wywołuje handler po wciśnięciu Escape, gdy element jest aktywny.
 *
 * Potrzebne tam, gdzie focus nie siedzi w polu tekstowym i onKeyDown na samym
 * elemencie by nie zadziałał — na przykład przy rozwiniętej liście wyboru.
 */
export function useEscapeKey(active: boolean, onEscape: () => void): void {
  const handlerRef = useRef(onEscape);
  useEffect(() => {
    handlerRef.current = onEscape;
  });

  useEffect(() => {
    if (!active) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handlerRef.current();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [active]);
}
