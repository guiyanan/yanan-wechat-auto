import { beforeEach, describe, expect, it, vi } from "vitest";
import { useProductStore } from "@/store/productStore";
import type { Product } from "@/types";

function product(patch: Partial<Product> = {}): Product {
  return {
    id: "prod-fasium",
    name: "Fasium AI",
    description: "AI fashion design platform",
    tags: [],
    iconGradient: ["#1268FF", "#5B8CFF"],
    knowledgeDocs: [],
    sourcePack: {},
    ...patch,
  };
}

describe("productStore", () => {
  beforeEach(() => {
    localStorage.clear();
    useProductStore.setState({
      products: {},
      serverLoaded: false,
      serverError: undefined,
    });
  });

  it("drops legacy V1 understanding cards when merging local and server products", async () => {
    useProductStore.setState({
      products: {
        "prod-fasium": product({
          updatedAt: "2026-06-16T10:00:00.000Z",
          understanding: {
            summary: "Loop RPA 的旧理解卡",
            targetUsers: ["运营经理"],
            coreCapabilities: ["浏览器自动化"],
            contentAngles: ["为什么需要"],
            missingInfo: ["客户案例"],
            generatedAt: "2026-06-12T00:00:00.000Z",
            source: "qwen",
          } as never,
        }),
      },
    });
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/products/library" && !init) {
        return Response.json({
          ok: true,
          products: {
            "prod-fasium": product({
              updatedAt: "2026-06-16T09:00:00.000Z",
            }),
          },
        });
      }
      return Response.json({ ok: true, products: {} });
    });
    vi.stubGlobal("fetch", fetchMock);

    await useProductStore.getState().loadFromServer();

    const merged = useProductStore.getState().products["prod-fasium"];
    expect(merged.name).toBe("Fasium AI");
    expect(merged).not.toHaveProperty("understanding");
  });
});
