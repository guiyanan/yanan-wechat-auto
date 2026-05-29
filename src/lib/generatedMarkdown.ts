const EMOJI_LIST_MARKER =
  /^(\s*(?:[-*•]\s*)?)(?:[\u{1F000}-\u{1FFFF}☀-➿⭐✅📌💡🔹🔸▪️▫️]\s*)+/u;

const PREFACE_LINE =
  /^(?:(?:好的|以下是|下面是|当然可以|我来为你写).{0,60}|这是(?:一篇|为你生成的).{0,30})$/;

function stripEmojiListMarker(line: string): string {
  return line.replace(EMOJI_LIST_MARKER, "$1");
}

function stripMarkdownNoise(line: string): string {
  return stripEmojiListMarker(line)
    .replace(/\*\*([^*\n]+?)\*\*/g, "$1")
    .replace(/__([^_\n]+?)__/g, "$1")
    .replace(/\*\*/g, "")
    .replace(/__/g, "")
    .trimEnd();
}

export function cleanGeneratedMarkdown(markdown: string): string {
  const withoutFence = markdown
    .replace(/^\s*```(?:markdown|md)?\s*/i, "")
    .replace(/\s*```\s*$/i, "");

  const lines = withoutFence
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => stripMarkdownNoise(line.replace(/\t/g, "  ")));

  while (lines.length > 0 && !lines[0].trim()) lines.shift();

  if (lines[0] && PREFACE_LINE.test(lines[0].trim())) {
    lines.shift();
  }

  return lines
    .join("\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
