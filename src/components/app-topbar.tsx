import Link from "next/link";
import { redirect } from "next/navigation";

import { clearSession } from "@/lib/auth";
import { LogOut, Search } from "lucide-react";
import { AppNavigation } from "@/components/app-navigation";
import { RetroSidebar } from "@/components/retro-sidebar";

export function AppTopbar({
  subtitle,
  showLogout = true
}: {
  subtitle: string;
  showLogout?: boolean;
}) {
  async function logoutAction() {
    "use server";

    await clearSession();
    redirect("/login");
  }

  return (
    <><RetroSidebar /><header className="appTopbar">
      <Link className="brandCluster" href="/" aria-label="返回首页">
        <span className="retroBrandArt" aria-hidden="true" /><strong className="sr-label">梦幻篮球</strong>
        <span className="retroTopCaption">MORE THAN<br />A GAME.<small>{subtitle}</small></span>
      </Link>
      <form className="retroGlobalSearch" action="/player-intel" method="get" role="search"><label htmlFor="global-player-search" className="sr-label">搜索球员情报</label><Search aria-hidden="true" /><input id="global-player-search" name="q" type="search" placeholder="搜索球员姓名 / Search players…" /><button type="submit" aria-label="搜索球员情报">搜索</button></form>
      <AppNavigation />
      {showLogout ? (
        <form action={logoutAction}>
          <button className="refreshButton" type="submit" aria-label="退出登录"><LogOut aria-hidden="true" /><span>退出</span></button>
        </form>
      ) : null}
      <span className="retroTopMotto" aria-hidden="true">BALL<br />NEVER LIES.</span>
    </header></>
  );
}
