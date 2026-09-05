import Link from "next/link";
import { redirect } from "next/navigation";

import { clearSession } from "@/lib/auth";
import { CircleDot, LogOut } from "lucide-react";
import { AppNavigation } from "@/components/app-navigation";

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
    <header className="appTopbar">
      <Link className="brandCluster" href="/" aria-label="返回首页">
        <CircleDot className="brandIcon" aria-hidden="true" /><strong>梦幻篮球</strong>
        <span>{subtitle}</span>
      </Link>
      <AppNavigation />
      {showLogout ? (
        <form action={logoutAction}>
          <button className="refreshButton" type="submit"><LogOut aria-hidden="true" /><span>退出</span></button>
        </form>
      ) : null}
    </header>
  );
}
