/**
 * Placeholder cover image generator.
 * Phase 3b / 6 will swap for a real image model (豆包即梦 / DALL-E / Midjourney).
 */

const PALETTES: Array<[string, string, string]> = [
  ["#6366f1", "#ec4899", "极简"],
  ["#0ea5e9", "#10b981", "科技"],
  ["#f59e0b", "#ef4444", "插画"],
  ["#14b8a6", "#6366f1", "实拍"],
  ["#8b5cf6", "#06b6d4", "简约"],
  ["#ec4899", "#f97316", "活力"],
];

export interface CoverCandidate {
  url: string;
  styleLabel: string;
  gradient: [string, string];
}

function svgDataUrl(
  gradient: [string, string],
  label: string,
  title: string
): string {
  const safeTitle = title
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .slice(0, 24);
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1280 720' preserveAspectRatio='xMidYMid slice'>
<defs>
  <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
    <stop offset='0%' stop-color='${gradient[0]}'/>
    <stop offset='100%' stop-color='${gradient[1]}'/>
  </linearGradient>
</defs>
<rect width='1280' height='720' fill='url(#g)'/>
<text x='64' y='560' font-family='-apple-system,PingFang SC,sans-serif' font-size='56' font-weight='700' fill='rgba(255,255,255,0.95)'>${safeTitle}</text>
<text x='64' y='640' font-family='-apple-system,PingFang SC,sans-serif' font-size='28' font-weight='500' fill='rgba(255,255,255,0.8)'>${label}</text>
</svg>`;
  const encoded = encodeURIComponent(svg).replace(/'/g, "%27");
  return `data:image/svg+xml,${encoded}`;
}

export function generateCoverCandidates(title: string, count = 4): CoverCandidate[] {
  // Pick `count` palettes, rotating if needed
  const out: CoverCandidate[] = [];
  for (let i = 0; i < count; i++) {
    const p = PALETTES[i % PALETTES.length];
    out.push({
      url: svgDataUrl([p[0], p[1]], p[2], title),
      styleLabel: p[2],
      gradient: [p[0], p[1]],
    });
  }
  return out;
}
