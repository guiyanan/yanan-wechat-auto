export type ContentLength = "short" | "standard" | "deep";

export type AngleStrategy =
  | "auto"
  | "comparison"
  | "education"
  | "scenario"
  | "trend";

export type TrafficHookMode =
  | "mainstream_product"
  | "category_heat"
  | "domestic_alternative"
  | "usage_explainer"
  | "pitfall"
  | "scenario";

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
  trafficHookLabel?: string;
  trafficHookMode?: TrafficHookMode;
  mainstreamAnchor?: string;
}
