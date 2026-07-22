import { describe, expect, it } from "vitest";
import { readStyleHtmlDocuments } from "@/lib/styleHtmlDocuments";

describe("readStyleHtmlDocuments", () => {
  it("reads at most five uploaded HTML files for one style learning request", async () => {
    const files = Array.from({ length: 6 }, (_, index) =>
      new File([`<html><body>第${index + 1}篇</body></html>`], `sample-${index + 1}.html`, {
        type: "text/html",
      })
    );

    const result = await readStyleHtmlDocuments(files);

    expect(result.ignoredCount).toBe(1);
    expect(result.documents).toHaveLength(5);
    expect(result.documents.map((doc) => doc.name)).toEqual([
      "sample-1.html",
      "sample-2.html",
      "sample-3.html",
      "sample-4.html",
      "sample-5.html",
    ]);
    expect(result.documents[0].html).toContain("第1篇");
    expect(result.documents[4].html).toContain("第5篇");
  });
});
