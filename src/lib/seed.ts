/**
 * Deterministic pseudo-random helpers seeded by a string (typically articleId).
 *
 * Why:
 *   Demo data must be reproducible. If the AI score randomizes on every
 *   /api/ai-score call, two people looking at the same article see different
 *   numbers and stakeholders misread the demo. Seeding by articleId means
 *   the same article always renders the same mock score on any machine.
 *
 * FNV-1a 32-bit is good enough for uniformly scattering article IDs into
 * buckets — we're not doing crypto, just a stable hash.
 */

export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // Keep unsigned 32-bit
  return h >>> 0;
}

/**
 * Mulberry32 PRNG. Given a 32-bit seed, produces a deterministic
 * AsyncIterable-free stream of [0, 1) floats.
 */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Returns an integer in [min, max] (inclusive) deterministic on seed.
 */
export function seededInt(seed: string, min: number, max: number): number {
  const rng = makeRng(hashString(seed));
  return Math.floor(rng() * (max - min + 1)) + min;
}

/**
 * Returns true with the given probability [0,1], deterministic on seed.
 */
export function seededBool(seed: string, probability: number): boolean {
  const rng = makeRng(hashString(seed));
  return rng() < probability;
}
