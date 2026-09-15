/**
 * Rozmiar wartości na karcie — wspólny dla talii i odkrytych kart przy stole.
 * Trzy znaki (0.5, 100, XXL) są o stopień mniejsze, żeby zmieściły się na karcie.
 *
 * Osobny moduł, a nie eksport z komponentu: plik komponentu eksportujący też
 * zwykłą funkcję traci w Vite szybkie przeładowanie (Fast Refresh).
 */
export function cardValueTextClass(card: string): string {
  return card.length >= 3 ? 'text-lg sm:text-2xl md:text-3xl' : 'text-xl sm:text-3xl md:text-4xl';
}
