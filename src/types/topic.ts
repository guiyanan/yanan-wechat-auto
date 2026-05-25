export type ContentLength = "short" | "standard" | "deep";

export type AngleStrategy =
  | "auto"
  | "comparison"
  | "education"
  | "scenario"
  | "trend";

export interface TopicPlan {
  id: string;
  angleLabel: string;
  angleType:
    | "product_intro"
    | "product_diff"
    | "competitor"
    | "trend"
    | "scenario"
    | "education"
    | "pricing"
    | "ecosystem";
  reason: string;
  promptInstruction: string;
  sourceNeedLevel: "low" | "medium" | "high";
  contentLength?: ContentLength;
  angleStrategy?: AngleStrategy;
}
