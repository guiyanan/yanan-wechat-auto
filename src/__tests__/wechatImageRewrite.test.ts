import { describe, expect, it, vi } from "vitest";
import { rewriteLocalImagesForWechat } from "@/lib/wechatImageRewrite";

describe("wechatImageRewrite", () => {
  it("uploads local product images and replaces them with WeChat URLs", async () => {
    const readLocalFile = vi.fn(async (publicPath: string) => {
      expect(publicPath).toBe("uploads/product-assets/prod-fashion/hero.webp");
      return {
        bytes: new Uint8Array([1, 2, 3]),
        fileName: "hero.webp",
        mimeType: "image/webp",
      };
    });
    const uploadImage = vi.fn(async () => ({
      ok: true,
      url: "https://mmbiz.qpic.cn/product/hero.webp",
    }));

    const result = await rewriteLocalImagesForWechat(
      '<p>正文</p><img src="/uploads/product-assets/prod-fashion/hero.webp" data-src="/uploads/product-assets/prod-fashion/hero.webp">',
      { readLocalFile, uploadImage }
    );

    expect(result.html).toContain("https://mmbiz.qpic.cn/product/hero.webp");
    expect(result.html).not.toContain("/uploads/product-assets/prod-fashion/hero.webp");
    expect(result.uploadedUrls).toEqual(["https://mmbiz.qpic.cn/product/hero.webp"]);
    expect(uploadImage).toHaveBeenCalledWith(
      expect.any(Uint8Array),
      "hero.webp",
      "image/webp"
    );
  });

  it("does not upload remote or data URLs", async () => {
    const readLocalFile = vi.fn();
    const uploadImage = vi.fn();

    const result = await rewriteLocalImagesForWechat(
      '<img src="https://example.com/a.png"><img src="data:image/png;base64,abc">',
      { readLocalFile, uploadImage }
    );

    expect(result.uploadedUrls).toEqual([]);
    expect(readLocalFile).not.toHaveBeenCalled();
    expect(uploadImage).not.toHaveBeenCalled();
  });
});
