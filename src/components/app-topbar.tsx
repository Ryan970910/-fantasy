import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { clearSession } from "@/lib/auth";

export function AppTopbar({
  subtitle,
  showLogout = true,
  backHref
}: {
  subtitle: string;
  showLogout?: boolean;
  backHref?: string;
}) {
  async function logoutAction() {
    "use server";

    await clearSession();
    redirect("/login");
  }

  return (
    <header className="appTopbar">
      {backHref ? (
        <Link className="topbarBack" href={backHref} aria-label="返回上一级" title="返回上一级">
          <ArrowLeft aria-hidden="true" />
        </Link>
      ) : null}
      <Link className="brandCluster" href="/" aria-label="返回首页">
        <strong>梦幻篮球</strong>
        <span>{subtitle}</span>
      </Link>
      {showLogout ? (
        <form action={logoutAction}>
          <button className="refreshButton" type="submit">退出</button>
        </form>
      ) : null}
    </header>
  );
}
