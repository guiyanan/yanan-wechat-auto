"use client";

import { toast, Toaster } from "sonner";
import { WizardFrame } from "@/components/wizard/WizardFrame";
import { StylePicker } from "@/components/wizard/StylePicker";
import { useWizardStore } from "@/store/wizardStore";
import stylesData from "@/data/styles.json";
import type { WritingStyle } from "@/types";

const STYLES = stylesData as WritingStyle[];

export default function WizardStylePage() {
  const styleIds = useWizardStore((s) => s.styleIds);
  const toggleStyleId = useWizardStore((s) => s.toggleStyleId);

  return (
    <>
      <Toaster position="top-center" richColors />
      <WizardFrame
        step="style"
        title="第三步 · 选风格(可多选)"
        description="风格决定文章的语气、句式、节奏。"
        canAdvance={styleIds.length > 0}
      >
        <StylePicker
          styles={STYLES}
          selectedIds={styleIds}
          onToggle={toggleStyleId}
          onRequestTrain={() =>
            toast.info("自定义风格需要联系管理员上传范文训练", {
              description: "MVP 阶段暂不开放租户自助训练",
            })
          }
        />
      </WizardFrame>
    </>
  );
}
