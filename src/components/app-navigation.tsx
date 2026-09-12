"use client";

import { House, Radar, UsersRound, Trophy } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export const navigationItems = [
  { href: "/", label: "首页", icon: House },
  { href: "/lineups", label: "我的阵容", icon: UsersRound },
  { href: "/rankings", label: "实时排名", icon: Trophy },
  { href: "/player-intel", label: "球员情报", icon: Radar }
] as const;

export function AppNavigation({ sidebar = false }: { sidebar?: boolean }) {
  const pathname = usePathname();
  return <nav className={sidebar ? "retroSidebarNavigation" : "appNavigation"} aria-label={sidebar ? "桌面导航" : "主导航"}>
    {navigationItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}><Icon aria-hidden="true" /><span>{label}</span></Link>)}
  </nav>;
}
