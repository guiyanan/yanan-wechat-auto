"use client";

import { toast, Toaster } from "sonner";
import { WizardFrame } from "@/components/wizard/WizardFrame";
import { StylePicker } from "@/components/wizard/StylePicker";
import { useWizardStore } from "@/store/wizardStore";
import stylesData from "@/data/styles.json";
import type { WritingStyle } from "@/types";

const STYLES = stylesData as WritingStyle[];

export default function WizardStylePage() {
  const styleId = useWizardStore((s) => s.styleId);
  const setStyleId = useWizardStore((s) => s.setStyleId);

  return (
    <>
      <Toaster position="top-center" richColors />
      <WizardFrame
        step="style"
        title="第三步 · 选风格"
        description="从 4 个预置风格里挑一个「说话方式」。风格决定最终文章的语气、句式、节奏。"
        canAdvance={!!styleId}
      >
        <StylePicker
          styles={STYLES}
          selectedId={styleId}
          onSelect={setStyleId}
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
