"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { Stepper, type StepKey } from "./Stepper";
import { SummaryCard } from "./SummaryCard";
import { useWizardStore } from "@/store/wizardStore";
import { getAllProducts } from "@/lib/articles";
import anglesData from "@/data/angles.json";
import stylesData from "@/data/styles.json";
import type { Angle, WritingStyle } from "@/types";
import { cn } from "@/lib/utils";

const ANGLES = anglesData as Angle[];
const STYLES = stylesData as WritingStyle[];

const NEXT_ROUTE: Record<StepKey, string | null> = {
  product: "/wizard/angle",
  angle: "/wizard/style",
  style: "/wizard/generating",
  generating: null,
};

const PREV_ROUTE: Record<StepKey, string | null> = {
  product: "/",
  angle: "/wizard/product",
  style: "/wizard/angle",
  generating: "/wizard/style",
};

interface WizardFrameProps {
  step: StepKey;
  title: string;
  description: string;
  canAdvance: boolean;
  children: React.ReactNode;
  primaryLabel?: string;
  onPrimary?: () => void;
}

export function WizardFrame({
  step,
  title,
  description,
  canAdvance,
  children,
  primaryLabel,
  onPrimary,
}: WizardFrameProps) {
  // zustand persist hydrates from sessionStorage on the client. To avoid SSR
  // hydration mismatches (server sees empty store, client sees populated),
  // gate every store-derived value on `mounted`.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const storeProductId = useWizardStore((s) => s.productId);
  const storeAngleIds = useWizardStore((s) => s.angleIds);
  const storeCustomAngle = useWizardStore((s) => s.customAngle);
  const storeStyleIds = useWizardStore((s) => s.styleIds);

  const productId = mounted ? storeProductId : null;
  const angleIds = mounted ? storeAngleIds : [];
  const customAngle = mounted ? storeCustomAngle : "";
  const styleIds = mounted ? storeStyleIds : [];

  const product = getAllProducts().find((p) => p.id === productId) ?? null;
  const selectedAngles = ANGLES.filter((a) => angleIds.includes(a.id));
  const selectedStyles = STYLES.filter((s) => styleIds.includes(s.id));

  const hasAngle = angleIds.length > 0 || customAngle.trim().length > 0;
  const completedThrough: StepKey | null = styleIds.length > 0
    ? "style"
    : hasAngle
      ? "angle"
      : productId
        ? "product"
        : null;

  const next = NEXT_ROUTE[step];
  const prev = PREV_ROUTE[step];

  const isFinalStep = step === "style";
  const buttonLabel =
    primaryLabel ?? (isFinalStep ? "开始生成" : "下一步");

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-6 px-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-semibold text-slate-900"
          >
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg font-bold text-white shadow-sm"
              style={{
                background:
                  "linear-gradient(135deg,#2563eb 0%,#ec4899 100%)",
              }}
            >
              J
            </div>
            JOTO 内容工厂
          </Link>
          <div className="ml-4 flex-1">
            <Stepper current={step} completedThrough={completedThrough} />
          </div>
          <Link
            href="/"
            className="text-xs text-slate-500 transition-colors hover:text-slate-900"
          >
            取消并返回
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-1 gap-8 px-6 py-8 lg:py-10">
        <div className="min-w-0 flex-1">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              {title}
            </h1>
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          </div>
          <div className="pb-24">{children}</div>
        </div>
        <SummaryCard
          product={product}
          angles={selectedAngles}
          customAngle={customAngle}
          styles={selectedStyles}
        />
      </main>

      <footer className="fixed bottom-0 left-0 right-0 z-20 border-t border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-3">
          {prev ? (
            <Link
              href={prev}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              上一步
            </Link>
          ) : (
            <span />
          )}

          {onPrimary ? (
            <button
              type="button"
              onClick={onPrimary}
              disabled={!canAdvance}
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-lg px-5 text-sm font-medium shadow-sm transition-colors",
                canAdvance
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "cursor-not-allowed bg-slate-200 text-slate-400"
              )}
            >
              {isFinalStep && (
                <Sparkles className="h-4 w-4" aria-hidden="true" />
              )}
              {buttonLabel}
              {!isFinalStep && (
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          ) : canAdvance && next ? (
            <Link
              href={next}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
            >
              {isFinalStep && (
                <Sparkles className="h-4 w-4" aria-hidden="true" />
              )}
              {buttonLabel}
              {!isFinalStep && (
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              )}
            </Link>
          ) : (
            <button
              type="button"
              disabled
              className="inline-flex h-10 cursor-not-allowed items-center gap-2 rounded-lg bg-slate-200 px-5 text-sm font-medium text-slate-400 shadow-sm"
            >
              {isFinalStep && (
                <Sparkles className="h-4 w-4" aria-hidden="true" />
              )}
              {buttonLabel}
              {!isFinalStep && (
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
