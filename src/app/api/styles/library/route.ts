import { NextRequest, NextResponse } from "next/server";
import {
  readPersistedLearnedStyles,
  removePersistedLearnedStyle,
  upsertPersistedLearnedStyle,
  writePersistedLearnedStyles,
} from "@/lib/persistentLibrary";
import type { LearnedWritingStyle } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const styles = await readPersistedLearnedStyles();
  return NextResponse.json({ ok: true, styles });
}

export async function PUT(req: NextRequest) {
  try {
    const body = (await req.json()) as { styles?: LearnedWritingStyle[] };
    const styles = body.styles ?? [];
    const saved = await writePersistedLearnedStyles(styles);
    return NextResponse.json({ ok: true, styles: saved });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "保存风格库失败" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { style?: LearnedWritingStyle };
    if (!body.style?.id) {
      return NextResponse.json(
        { ok: false, error: "缺少风格信息" },
        { status: 400 }
      );
    }
    const styles = await upsertPersistedLearnedStyle(body.style);
    return NextResponse.json({ ok: true, styles });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "保存风格失败" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id")?.trim();
    if (!id) {
      return NextResponse.json(
        { ok: false, error: "缺少风格 ID" },
        { status: 400 }
      );
    }
    const styles = await removePersistedLearnedStyle(id);
    return NextResponse.json({ ok: true, styles });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "删除风格失败" },
      { status: 500 }
    );
  }
}
