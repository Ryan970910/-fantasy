import Link from "next/link";
import { redirect } from "next/navigation";

import { clearSession } from "@/lib/auth";

export function AppTopbar({ subtitle }: { subtitle: string }) {
  async function logoutAction() {
    "use server";

    await clearSession();
    redirect("/login");
  }

  return (
    <header className="appTopbar">
      <Link className="brandCluster" href="/" aria-label="返回首页">
        <strong>梦幻篮球</strong>
        <span>{subtitle}</span>
      </Link>
      <form action={logoutAction}>
        <button className="refreshButton" type="submit">退出</button>
      </form>
    </header>
  );
}
