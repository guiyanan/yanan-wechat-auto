import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/products/evidence/upload/route";

describe("/api/products/evidence/upload", () => {
  it("rejects videos because product understanding only supports screenshots", async () => {
    const formData = new FormData();
    formData.set("productId", "prod-demo");
    formData.set(
      "file",
      new File(["video"], "demo.mp4", { type: "video/mp4" })
    );

    const res = await POST({ formData: async () => formData } as never);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("只支持 PNG、JPG、JPEG、WebP");
  });
});
