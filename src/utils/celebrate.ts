import confetti from 'canvas-confetti';

/**
 * Efekty świętowania na koniec rundy.
 *
 * canvas-confetti był w zależnościach projektu od początku, ale nigdy nie
 * został podłączony — to pierwsze jego użycie.
 */

const COFFEE_COLORS = ['#6F4E37', '#A67B5B', '#C8A27A', '#3B2314', '#E3C9A8'];
const CONSENSUS_COLORS = ['#6366F1', '#22D3EE', '#34D399', '#F59E0B', '#F472B6'];

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * Konfetti z kawą — gdy większość zespołu wybrała „☕”.
 *
 * Sypią się filiżanki; gdy przeglądarka nie udźwignie kształtu z tekstu,
 * spadamy na zwykłe konfetti w barwach palonej kawy.
 */
export function fireCoffeeConfetti(): void {
  if (typeof window === 'undefined' || prefersReducedMotion()) return;

  const base = {
    particleCount: 26,
    spread: 70,
    startVelocity: 38,
    ticks: 220,
    gravity: 0.9,
    disableForReducedMotion: true,
  } as const;

  let shapes: confetti.Shape[] | undefined;
  try {
    // shapeFromText jest dostępne od canvas-confetti 1.6.
    shapes = [confetti.shapeFromText({ text: '☕', scalar: 2.4 })];
  } catch {
    shapes = undefined;
  }

  const burst = (originX: number, angle: number) => {
    try {
      confetti({
        ...base,
        angle,
        origin: { x: originX, y: 0.72 },
        ...(shapes ? { shapes, scalar: 2.4 } : { colors: COFFEE_COLORS }),
      });
    } catch {
      // Brak canvas/WebGL nie może wywrócić rundy.
    }
  };

  burst(0.2, 60);
  burst(0.8, 120);
  window.setTimeout(() => burst(0.5, 90), 220);
}

/** Konfetti przy pełnej zgodzie zespołu co do estymaty. */
export function fireConsensusConfetti(): void {
  if (typeof window === 'undefined' || prefersReducedMotion()) return;

  try {
    confetti({
      particleCount: 90,
      spread: 82,
      startVelocity: 42,
      origin: { x: 0.5, y: 0.6 },
      colors: CONSENSUS_COLORS,
      disableForReducedMotion: true,
    });
  } catch {
    // jw.
  }
}
