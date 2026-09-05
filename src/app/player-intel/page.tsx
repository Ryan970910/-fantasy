import { ChartNoAxesCombined } from "lucide-react";
import { redirect } from "next/navigation";

import { AppTopbar } from "@/components/app-topbar";
import { PageBackLink } from "@/components/page-back-link";
import { PlayerIntelBoard } from "@/components/player-intel-board";
import { getCurrentUser } from "@/lib/auth";
import { loadPlayerIntelDashboard } from "@/lib/player-intel-data";

export const dynamic = "force-dynamic";

export default async function PlayerIntelPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");

  const dashboard = await loadPlayerIntelDashboard();
  return (
    <main className="shell">
      <AppTopbar subtitle="赛前情报" />
      {dashboard.state === "ready" ? <PlayerIntelBoard players={dashboard.players} /> : (
        <section className="intelEmpty" aria-labelledby="intel-empty-title">
          <ChartNoAxesCombined aria-hidden="true" />
          <PageBackLink href="/pregame-intel">返回赛前情报</PageBackLink>
          <h1 id="intel-empty-title">{dashboard.state === "no-games" ? "暂无可用比赛日" : "暂无法生成球员情报"}</h1>
          <p>{dashboard.state === "no-games"
            ? "下一比赛日同步后，这里会展示今日推荐与角色变化。"
            : dashboard.state === "no-stats"
              ? "本赛季官方逐场数据尚未同步，无法计算指标。"
              : "每位球员至少需要 15 场官方出场数据，才能比较近 5 场与此前 10 场。"}</p>
        </section>
      )}
    </main>
  );
}
