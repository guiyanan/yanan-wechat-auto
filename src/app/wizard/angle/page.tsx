"use client";

import { WizardFrame } from "@/components/wizard/WizardFrame";
import { AnglePicker } from "@/components/wizard/AnglePicker";
import { useWizardStore } from "@/store/wizardStore";
import anglesData from "@/data/angles.json";
import type { Angle } from "@/types";

const ANGLES = anglesData as Angle[];

export default function WizardAnglePage() {
  const angleId = useWizardStore((s) => s.angleId);
  const customAngle = useWizardStore((s) => s.customAngle);
  const setAngleId = useWizardStore((s) => s.setAngleId);
  const setCustomAngle = useWizardStore((s) => s.setCustomAngle);

  const canAdvance = !!angleId || customAngle.trim().length > 0;

  return (
    <WizardFrame
      step="angle"
      title="第二步 · 选角度"
      description="从 10 个预置角度里挑一个,或者自己写一个。角度决定了 AI 写作的切入视角和叙事结构。"
      canAdvance={canAdvance}
    >
      <AnglePicker
        angles={ANGLES}
        selectedId={angleId}
        customAngle={customAngle}
        onSelect={setAngleId}
        onCustomChange={setCustomAngle}
      />
    </WizardFrame>
  );
}
