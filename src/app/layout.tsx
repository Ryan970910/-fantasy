import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "梦幻篮球",
  description: "工资帽模式的梦幻篮球阵容系统。"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
