import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JOTO 内容工厂",
  description: "企业级合规 AI 公众号内容生产平台",
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        {children}
      </body>
    </html>
  );
}
