/**
 * Tiny haptic-feedback helpers. The Vibration API is widely supported on
 * Android (Chrome/Samsung Internet) and on iOS Safari when the page is
 * launched as a PWA; in unsupported contexts the calls silently no-op,
 * so it's safe to sprinkle these across every interaction.
 *
 * Patterns picked to feel close to native iOS/Android UI haptics:
 *   - `tap`:     10ms — light selection click
 *   - `confirm`: [15, 40, 15] — success / commit
 *   - `arrive`:  [25, 30, 50] — something happened externally (bot reply)
 */

type Pattern = "tap" | "confirm" | "arrive";

const PATTERNS: Record<Pattern, number | number[]> = {
  tap: 10,
  confirm: [15, 40, 15],
  arrive: [25, 30, 50],
};

export function haptic(pattern: Pattern): void {
  if (typeof window === "undefined") return;
  const vibrate = window.navigator?.vibrate?.bind(window.navigator);
  if (!vibrate) return;
  try {
    vibrate(PATTERNS[pattern]);
  } catch {
    // Some browsers throw inside iframes when the page lacks user-gesture
    // history; nothing we can do, fail silent.
  }
}
