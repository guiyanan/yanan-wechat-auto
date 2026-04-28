export type AiScoreLevel = "safe" | "caution" | "danger";

export interface AiScoreMeta {
  level: AiScoreLevel;
  label: string;
  textColor: string;
  bgColor: string;
  barColor: string;
  emoji: string;
}

export function classifyAiScore(score: number): AiScoreLevel {
  if (score < 40) return "safe";
  if (score < 70) return "caution";
  return "danger";
}

export function aiScoreMeta(score: number): AiScoreMeta {
  const level = classifyAiScore(score);
  switch (level) {
    case "safe":
      return {
        level,
        label: "发布安全",
        textColor: "text-emerald-700",
        bgColor: "bg-emerald-50",
        barColor: "bg-emerald-500",
        emoji: "✓",
      };
    case "caution":
      return {
        level,
        label: "需优化",
        textColor: "text-amber-700",
        bgColor: "bg-amber-50",
        barColor: "bg-amber-500",
        emoji: "!",
      };
    case "danger":
      return {
        level,
        label: "风险",
        textColor: "text-red-700",
        bgColor: "bg-red-50",
        barColor: "bg-red-500",
        emoji: "⚠",
      };
  }
}
