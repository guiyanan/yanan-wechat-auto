"use client";

import { WizardFrame } from "@/components/wizard/WizardFrame";
import { AnglePicker } from "@/components/wizard/AnglePicker";
import { useWizardStore } from "@/store/wizardStore";
import anglesData from "@/data/angles.json";
import type { Angle } from "@/types";

const ANGLES = anglesData as Angle[];

export default function WizardAnglePage() {
  const angleIds = useWizardStore((s) => s.angleIds);
  const customAngle = useWizardStore((s) => s.customAngle);
  const toggleAngleId = useWizardStore((s) => s.toggleAngleId);
  const setCustomAngle = useWizardStore((s) => s.setCustomAngle);

  const canAdvance = angleIds.length > 0 || customAngle.trim().length > 0;

  return (
    <WizardFrame
      step="angle"
      title="第二步 · 选角度(可多选)"
      description="角度决定文章的切入视角和读者定位。"
      canAdvance={canAdvance}
    >
      <AnglePicker
        angles={ANGLES}
        selectedIds={angleIds}
        customAngle={customAngle}
        onToggle={toggleAngleId}
        onCustomChange={setCustomAngle}
      />
    </WizardFrame>
  );
}
