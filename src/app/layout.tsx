import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "JOTO小信",
  description: "企业级合规 AI 公众号内容生产平台",
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-[#f5f5f7] text-slate-950">
        {children}
        {/* Global toast surface — sonner's <Toaster> must be mounted once
            at app root so every client component can call `toast()`.
            (Previously only mounted in wizard/style/page.tsx, so toasts
            in editor / batch / etc. silently dropped.) */}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
