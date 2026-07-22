import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { GET, HEAD } from "@/app/uploads/[...path]/route";

const fixtureDir = path.join(
  process.cwd(),
  "public",
  "uploads",
  "__route-test__"
);
const fixtureName = "粘贴截图.png";
const fixtureBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

describe("/uploads/[...path]", () => {
  beforeAll(async () => {
    await mkdir(fixtureDir, { recursive: true });
    await writeFile(path.join(fixtureDir, fixtureName), fixtureBytes);
  });

  afterAll(async () => {
    await rm(fixtureDir, { recursive: true, force: true });
  });

  it("serves runtime uploads with non-ascii filenames", async () => {
    const res = await GET({} as never, {
      params: Promise.resolve({ path: ["__route-test__", fixtureName] }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("image/png");
    expect(Buffer.from(await res.arrayBuffer())).toEqual(fixtureBytes);
  });

  it("supports HEAD without reading the file body", async () => {
    const res = await HEAD({} as never, {
      params: Promise.resolve({ path: ["__route-test__", fixtureName] }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-length")).toBe(String(fixtureBytes.length));
    expect(await res.text()).toBe("");
  });

  it("blocks path traversal outside public uploads", async () => {
    const res = await GET({} as never, {
      params: Promise.resolve({ path: ["..", "secret.png"] }),
    });

    expect(res.status).toBe(404);
  });
});
