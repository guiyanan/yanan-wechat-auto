import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProductLibraryPage from "@/app/admin/products/page";
import { useProductStore } from "@/store/productStore";
import type { Product } from "@/types";
import { toast } from "sonner";

vi.mock("@/components/nav/TopNav", () => ({
  TopNav: () => <nav aria-label="top nav" />,
}));

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt={String(props.alt ?? "")} src={String(props.src ?? "")} />;
  },
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

const seedProducts: Product[] = [
  {
    id: "prod-alpha",
    name: "Alpha Agent",
    description: "浏览器自动化产品",
    website: "https://alpha.example.com/",
    tags: ["Agent"],
    iconGradient: ["#1268FF", "#5B8CFF"],
    knowledgeDocs: [
      {
        id: "doc-alpha",
        fileName: "Alpha 产品白皮书.pdf",
        fileType: "pdf",
        sizeKb: 2048,
        ragStatus: "indexed",
      },
    ],
    sourcePack: {},
  },
  {
    id: "prod-beta",
    name: "Beta CRM",
    description: "客户管理产品",
    website: "https://beta.example.com/",
    tags: ["CRM"],
    iconGradient: ["#10B981", "#1268FF"],
    knowledgeDocs: [],
    sourcePack: {},
  },
];

vi.mock("@/lib/articles", async () => {
  const actual = await vi.importActual<typeof import("@/lib/articles")>(
    "@/lib/articles"
  );
  return {
    ...actual,
    getAllProducts: () => seedProducts,
  };
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("ProductLibraryPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useProductStore.setState({
      products: {},
      serverLoaded: true,
      serverError: undefined,
    });
  });

  it("does not parse the website just by opening a product", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<ProductLibraryPage />);

    expect(await screen.findByText("产品资料输入")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/products/parse-website",
      expect.anything()
    );
  });

  it("marks documents without extracted text as not parsed", async () => {
    vi.stubGlobal("fetch", vi.fn());

    render(<ProductLibraryPage />);

    expect(await screen.findByText("Alpha 产品白皮书.pdf")).toBeInTheDocument();
    expect(screen.getByText("未读取到文本")).toBeInTheDocument();
  });

  it("does not offer video as a product understanding material", async () => {
    vi.stubGlobal("fetch", vi.fn());

    render(<ProductLibraryPage />);

    expect(await screen.findByText("产品资料输入")).toBeInTheDocument();
    expect(screen.queryByText("上传演示视频")).not.toBeInTheDocument();
    expect(screen.queryByText(/视频最高支持/)).not.toBeInTheDocument();
  });

  it("does not write a stale website parse result into another selected product", async () => {
    const parseResult = deferred<Response>();
    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/products/parse-website") {
        return parseResult.promise;
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ProductLibraryPage />);

    expect(await screen.findByDisplayValue("Alpha Agent")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "解析官网" }));
    fireEvent.click(screen.getByRole("button", { name: /Beta CRM/ }));

    parseResult.resolve(
      Response.json({
        ok: true,
        notes: "Alpha 官网解析结果,不应该写进 Beta",
        title: "Alpha",
        description: "Alpha description",
      })
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue("Beta CRM")).toBeInTheDocument();
    });
    expect(
      screen.queryByDisplayValue("Alpha 官网解析结果,不应该写进 Beta")
    ).not.toBeInTheDocument();
  });

  it("shows website parsing depth in the success message", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/products/parse-website") {
        return Promise.resolve(
          Response.json({
            ok: true,
            notes: "Alpha 官网解析结果",
            title: "Alpha",
            description: "Alpha description",
            readableTextLength: 4588,
            productSignalCount: 83,
          })
        );
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ProductLibraryPage />);

    expect(await screen.findByDisplayValue("Alpha Agent")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "解析官网" }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        "官网资料已解析: 4588 字正文,83 个产品线索"
      );
    });
  });

  it("shows metadata-based website parsing depth for SPA pages", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/products/parse-website") {
        return Promise.resolve(
          Response.json({
            ok: true,
            notes: "Alpha 官网 metadata 解析结果",
            title: "Alpha",
            description: "Alpha description",
            quality: "metadata",
            readableTextLength: 612,
            productSignalCount: 12,
          })
        );
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ProductLibraryPage />);

    expect(await screen.findByDisplayValue("Alpha Agent")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "解析官网" }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        "官网资料已解析: metadata 素材 612 字,12 个产品线索"
      );
    });
  });

  it("keeps the server notes when website parsing only finds shallow content", async () => {
    const shallowNotes =
      "官网链接：https://alpha.example.com/\n页面已响应,但只解析到少量官网正文或导航文本。请手动补充官网定位、核心页面、产品模块、客户角色和文章要强调的卖点。";
    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/products/parse-website") {
        return Promise.resolve(
          Response.json(
            {
              ok: false,
              error: "shallow website text",
              notes: shallowNotes,
              quality: "shallow",
            },
            { status: 422 }
          )
        );
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ProductLibraryPage />);

    expect(await screen.findByDisplayValue("Alpha Agent")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "解析官网" }));
    await waitFor(() => {
      expect(
        screen
          .getAllByRole("textbox")
          .some((input) => (input as HTMLInputElement).value === shallowNotes)
      ).toBe(true);
    });
  });

  it("shows immediate feedback while generating a product understanding card", async () => {
    const understandResult = deferred<Response>();
    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/products/understand") {
        return understandResult.promise;
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ProductLibraryPage />);

    expect(await screen.findByDisplayValue("Alpha Agent")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "生成产品理解卡" }));

    expect(screen.getByRole("button", { name: "正在生成..." })).toBeDisabled();
    expect(
      screen.getByText("正在基于产品资料生成理解卡,这一步可能需要几十秒。")
    ).toBeInTheDocument();
  });

  it("shows a local service hint when product understanding fetch fails", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/products/understand") {
        return Promise.reject(new TypeError("Failed to fetch"));
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ProductLibraryPage />);

    expect(await screen.findByDisplayValue("Alpha Agent")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "生成产品理解卡" }));

    expect(
      await screen.findByText("本地小信服务连接失败。请确认开发服务还在运行,然后刷新页面重试。")
    ).toBeInTheDocument();
  });
});
