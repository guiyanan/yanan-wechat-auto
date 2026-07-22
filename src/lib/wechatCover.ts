import sharp from "sharp";

interface GenerateWechatCoverArgs {
  title: string;
  productName?: string;
  styleLabel?: string;
}

const WIDTH = 1280;
const HEIGHT = 720;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function charWidth(char: string): number {
  return /[\u4e00-\u9fa5]/.test(char) ? 2 : 1;
}

function wrapText(text: string, maxUnits: number, maxLines: number): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  const lines: string[] = [];
  let current = "";
  let units = 0;

  for (const char of clean) {
    const width = charWidth(char);
    if (units + width > maxUnits && current) {
      lines.push(current.trim());
      current = char;
      units = width;
      if (lines.length === maxLines - 1) break;
    } else {
      current += char;
      units += width;
    }
  }

  if (current && lines.length < maxLines) {
    lines.push(current.trim());
  }

  if (clean.length > lines.join("").length && lines.length > 0) {
    const last = lines[lines.length - 1];
    lines[lines.length - 1] =
      last.length > 1 ? `${last.slice(0, Math.max(1, last.length - 1))}…` : last;
  }

  return lines.length ? lines : ["JOTO 内容候选"];
}

function buildCoverSvg({
  title,
  productName,
  styleLabel,
}: GenerateWechatCoverArgs): string {
  const titleLines = wrapText(title, 26, 2);
  const product = productName?.trim() || "JOTO";
  const label = styleLabel?.trim() || "公众号内容";
  const titleSpans = titleLines
    .map(
      (line, index) =>
        `<tspan x="96" dy="${index === 0 ? 0 : 76}">${escapeXml(line)}</tspan>`
    )
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <linearGradient id="blue" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1269ff"/>
      <stop offset="100%" stop-color="#00a6d6"/>
    </linearGradient>
    <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
      <path d="M 48 0 L 0 0 0 48" fill="none" stroke="#dbe7ff" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" rx="0" fill="#f7fbff"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#grid)" opacity="0.45"/>
  <rect x="52" y="54" width="${WIDTH - 104}" height="${HEIGHT - 108}" rx="30" fill="#ffffff" stroke="#d7e6ff" stroke-width="2"/>
  <rect x="96" y="112" width="104" height="10" rx="5" fill="url(#blue)"/>
  <text x="96" y="188" font-family="PingFang SC, Microsoft YaHei, Noto Sans CJK SC, Arial, sans-serif" font-size="34" font-weight="700" fill="#1269ff">${escapeXml(product)}</text>
  <text x="96" y="335" font-family="PingFang SC, Microsoft YaHei, Noto Sans CJK SC, Arial, sans-serif" font-size="66" font-weight="800" fill="#111827" letter-spacing="0">${titleSpans}</text>
  <text x="96" y="566" font-family="PingFang SC, Microsoft YaHei, Noto Sans CJK SC, Arial, sans-serif" font-size="28" font-weight="600" fill="#51627a">${escapeXml(label)}</text>
  <g transform="translate(968 444)">
    <rect x="0" y="0" width="176" height="92" rx="24" fill="#eef6ff" stroke="#c6ddff"/>
    <circle cx="46" cy="46" r="18" fill="#1269ff"/>
    <path d="M86 34h48M86 46h62M86 58h36" stroke="#1269ff" stroke-width="8" stroke-linecap="round"/>
  </g>
  <text x="96" y="630" font-family="PingFang SC, Microsoft YaHei, Noto Sans CJK SC, Arial, sans-serif" font-size="24" font-weight="600" fill="#8aa0bd">JOTO Tech</text>
</svg>`;
}

export async function generateWechatCoverPng(
  args: GenerateWechatCoverArgs
): Promise<Buffer> {
  const svg = buildCoverSvg(args);
  return sharp(Buffer.from(svg)).png().toBuffer();
}
