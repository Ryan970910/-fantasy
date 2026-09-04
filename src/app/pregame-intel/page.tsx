import { ArrowRight, ChartNoAxesCombined, ClipboardList } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppTopbar } from "@/components/app-topbar";
import { getCurrentUser } from "@/lib/auth";

export default async function PregameIntelPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    redirect("/login");
  }

  return (
    <main className="shell">
      <AppTopbar subtitle="赛前情报" backHref="/" />
      <section className="intelHub" aria-labelledby="intel-hub-title">
        <header className="intelHubHeader">
          <p className="eyebrow">比赛工具</p>
          <h1 id="intel-hub-title">赛前情报</h1>
          <p>在确定阵容前，查看首发预期、角色变化与今日推荐。</p>
        </header>

        <div className="intelHubGrid">
          <Link className="intelModule starterIntel" href="/predicted-starters">
            <span className="intelModuleIcon"><ClipboardList aria-hidden="true" /></span>
            <span className="intelModuleCopy">
              <small>比赛日预测</small>
              <strong>预测首发</strong>
              <span>按比赛日查看各队预计首发阵容。</span>
            </span>
            <ArrowRight className="intelModuleArrow" aria-hidden="true" />
          </Link>

          <Link className="intelModule playerIntel" href="/player-intel">
            <span className="intelModuleIcon"><ChartNoAxesCombined aria-hidden="true" /></span>
            <span className="intelModuleCopy">
              <small>比赛日分析</small>
              <strong>球员情报</strong>
              <span>查看近期角色变化与今日推荐指数。</span>
            </span>
            <ArrowRight className="intelModuleArrow" aria-hidden="true" />
          </Link>

        </div>
      </section>
    </main>
  );
}
