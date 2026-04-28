"use client";

import { WizardFrame } from "@/components/wizard/WizardFrame";
import { ProductPicker } from "@/components/wizard/ProductPicker";
import { useWizardStore } from "@/store/wizardStore";
import { getAllProducts } from "@/lib/articles";

export default function WizardProductPage() {
  const products = getAllProducts();
  const productId = useWizardStore((s) => s.productId);
  const setProductId = useWizardStore((s) => s.setProductId);

  return (
    <WizardFrame
      step="product"
      title="第一步 · 选产品"
      description="选一个本次要推广的产品。后续的角度和风格会结合这个产品的知识库生成内容。"
      canAdvance={!!productId}
    >
      <ProductPicker
        products={products}
        selectedId={productId}
        onSelect={setProductId}
      />
    </WizardFrame>
  );
}
