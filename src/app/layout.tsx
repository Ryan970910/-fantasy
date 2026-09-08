import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import "./street.css";

const anton = localFont({ src: "../../public/fonts/anton.ttf", variable: "--font-anton", display: "swap", weight: "400" });

export const metadata: Metadata = {
  title: "梦幻篮球",
  description: "工资帽模式的梦幻篮球阵容系统。"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className={anton.variable}>{children}</body>
    </html>
  );
}
