function normalizeForSimilarity(text: string): string {
  return text
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, "")
    .trim();
}

function shingles(text: string, size = 3): Set<string> {
  const clean = normalizeForSimilarity(text);
  if (!clean) return new Set();
  if (clean.length <= size) return new Set([clean]);

  const result = new Set<string>();
  for (let i = 0; i <= clean.length - size; i++) {
    result.add(clean.slice(i, i + size));
  }
  return result;
}

export function textSimilarity(a: string, b: string): number {
  const left = shingles(a);
  const right = shingles(b);
  if (left.size === 0 && right.size === 0) return 1;
  if (left.size === 0 || right.size === 0) return 0;

  let intersection = 0;
  for (const item of left) {
    if (right.has(item)) intersection++;
  }

  const union = left.size + right.size - intersection;
  return union === 0 ? 1 : intersection / union;
}
