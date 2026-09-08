import { redirect } from "next/navigation";

import { AppTopbar } from "@/components/app-topbar";
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
      <PlayerIntelBoard players={dashboard.players} emptyMessage={dashboard.state === "ready" ? undefined : dashboard.state === "no-games"
            ? "下一比赛日同步后，这里会展示今日推荐与角色变化。"
            : dashboard.state === "no-stats"
              ? "本赛季官方逐场数据尚未同步，无法计算指标。"
              : "每位球员至少需要 15 场官方出场数据，才能比较近 5 场与此前 10 场。"} />
    </main>
  );
}
