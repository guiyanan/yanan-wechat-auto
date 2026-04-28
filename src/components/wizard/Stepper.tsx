import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type StepKey = "product" | "angle" | "style" | "generating";

export interface StepDescriptor {
  key: StepKey;
  label: string;
  order: number;
}

export const WIZARD_STEPS: StepDescriptor[] = [
  { key: "product", label: "选产品", order: 1 },
  { key: "angle", label: "选角度", order: 2 },
  { key: "style", label: "选风格", order: 3 },
  { key: "generating", label: "生成", order: 4 },
];

interface StepperProps {
  current: StepKey;
  completedThrough: StepKey | null;
}

const ORDER: Record<StepKey, number> = {
  product: 1,
  angle: 2,
  style: 3,
  generating: 4,
};

export function Stepper({ current, completedThrough }: StepperProps) {
  const completedOrder = completedThrough ? ORDER[completedThrough] : 0;
  const currentOrder = ORDER[current];

  return (
    <ol className="flex items-center gap-3 text-sm">
      {WIZARD_STEPS.map((step, idx) => {
        const state =
          step.order < currentOrder || step.order <= completedOrder
            ? "done"
            : step.order === currentOrder
              ? "current"
              : "todo";

        return (
          <li key={step.key} className="flex items-center gap-3">
            <span
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                state === "done" &&
                  "bg-emerald-500 text-white ring-4 ring-emerald-100",
                state === "current" &&
                  "bg-blue-600 text-white ring-4 ring-blue-100",
                state === "todo" && "bg-slate-200 text-slate-500"
              )}
              aria-current={state === "current" ? "step" : undefined}
            >
              {state === "done" ? (
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                step.order
              )}
            </span>
            <span
              className={cn(
                "font-medium",
                state === "current" && "text-slate-900",
                state === "done" && "text-slate-600",
                state === "todo" && "text-slate-400"
              )}
            >
              {step.label}
            </span>
            {idx < WIZARD_STEPS.length - 1 && (
              <span
                className={cn(
                  "mx-1 h-px w-10 transition-colors",
                  step.order < currentOrder || step.order < completedOrder
                    ? "bg-emerald-300"
                    : "bg-slate-200"
                )}
                aria-hidden="true"
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
