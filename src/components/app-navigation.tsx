"use client";

import { House, Radar, UsersRound, Trophy } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function AppNavigation() {
  const pathname = usePathname();
  return (
    <nav className="appNavigation" aria-label="主导航">
      <Link href="/" aria-current={pathname === "/" ? "page" : undefined}><House aria-hidden="true" />首页</Link>
      <Link href="/lineups" aria-current={pathname === "/lineups" ? "page" : undefined}><UsersRound aria-hidden="true" />我的阵容</Link>
      <Link href="/rankings" aria-current={pathname === "/rankings" ? "page" : undefined}><Trophy aria-hidden="true" />实时排名</Link>
      <Link href="/pregame-intel" aria-current={["/pregame-intel", "/predicted-starters", "/player-intel"].includes(pathname) ? "page" : undefined}><Radar aria-hidden="true" />赛前情报</Link>
    </nav>
  );
}
