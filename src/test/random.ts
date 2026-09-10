/**
 * Deterministic generators. The engine tests check statistical properties, so
 * they need noise that is random-looking but identical on every run: a flaky
 * test on a numerical routine teaches you to ignore it.
 */

/** Numerical Recipes' linear congruential generator, uniform on [0, 1). */
export function lcg(seed = 12345): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Standard normals by Box–Muller, driven by `lcg`. */
export function gaussian(seed = 12345): () => number {
  const u = lcg(seed);
  let spare: number | null = null;
  return () => {
    if (spare != null) {
      const held = spare;
      spare = null;
      return held;
    }
    const a = Math.max(1e-12, u());
    const b = u();
    const radius = Math.sqrt(-2 * Math.log(a));
    spare = radius * Math.sin(2 * Math.PI * b);
    return radius * Math.cos(2 * Math.PI * b);
  };
}
