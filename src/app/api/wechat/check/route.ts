import { NextResponse } from "next/server";
import {
  getAccessToken,
  getWechatConfigStatus,
  WechatApiError,
  WechatConfigError,
} from "@/lib/wechatDraft";

export const runtime = "nodejs";

export async function GET() {
  const config = getWechatConfigStatus();

  if (!config.ok) {
    return NextResponse.json(
      {
        ok: false,
        stage: "config",
        error: `微信公众号配置缺失：${config.missing.join(", ")}`,
        config,
      },
      { status: 400 }
    );
  }

  try {
    await getAccessToken();
    return NextResponse.json({
      ok: true,
      stage: "token",
      message:
        "公众号 API 配置可用，access_token 获取成功；封面会在推送草稿时自动生成并上传",
      config,
    });
  } catch (err: unknown) {
    if (err instanceof WechatConfigError) {
      return NextResponse.json(
        { ok: false, stage: "config", error: err.message, config },
        { status: 400 }
      );
    }
    if (err instanceof WechatApiError) {
      return NextResponse.json(
        {
          ok: false,
          stage: "token",
          error: err.message,
          errcode: err.code,
          config,
        },
        { status: 502 }
      );
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { ok: false, stage: "token", error: message, config },
      { status: 500 }
    );
  }
}
