"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { WizardFrame } from "@/components/wizard/WizardFrame";
import { ProductPicker } from "@/components/wizard/ProductPicker";
import { useWizardStore } from "@/store/wizardStore";
import { useProductStore } from "@/store/productStore";
import { getAllProducts } from "@/lib/articles";
import { hasProductMaterial, mergeProducts, productSourceToArticleContext } from "@/lib/productCatalog";

export default function WizardProductPage() {
  const router = useRouter();
  const customProducts = useProductStore((s) => s.products);
  const products = mergeProducts(getAllProducts(), Object.values(customProducts));
  const productId = useWizardStore((s) => s.productId);
  const setProductId = useWizardStore((s) => s.setProductId);
  const setSourcePack = useWizardStore((s) => s.setSourcePack);
  const startAutoFive = useWizardStore((s) => s.startAutoFive);
  const selectedProduct = products.find((p) => p.id === productId) ?? null;

  return (
    <WizardFrame
      step="product"
      title="选产品 · 自动生成 5 篇"
      description="这里不再补素材。请先在产品库完善产品资料,再选择产品一键生成 5 篇不同角度文章。"
      canAdvance={!!productId}
      primaryLabel="随机生成 5 篇"
      onPrimary={() => {
        if (!productId || !selectedProduct) return;
        setSourcePack(productSourceToArticleContext(selectedProduct));
        startAutoFive(productId);
        router.push("/wizard/generating");
      }}
    >
      <div className="mb-5 rounded-xl border border-blue-100 bg-blue-50 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-blue-950">
              产品资料先在产品库维护
            </h2>
            <p className="mt-1 text-xs leading-5 text-blue-700">
              上传 PDF、填写官网链接、生成产品理解简介和补充素材后,这里会直接读取完整产品资料。
            </p>
          </div>
          <Link
            href="/admin/products"
            className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 px-4 text-xs font-medium text-white hover:bg-blue-700"
          >
            去产品库完善
          </Link>
        </div>
      </div>

      <ProductPicker
        products={products}
        selectedId={productId}
        onSelect={setProductId}
      />

      {selectedProduct && !hasProductMaterial(selectedProduct) && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-700">
          这个产品还没有官网、PDF 或产品理解简介。可以继续生成,但文章会更依赖基础简介；建议先去产品库补齐。
        </p>
      )}
    </WizardFrame>
  );
}
