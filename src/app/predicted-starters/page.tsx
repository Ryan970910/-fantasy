import { CalendarDays } from "lucide-react";
import { redirect } from "next/navigation";

import { AppTopbar } from "@/components/app-topbar";
import { getCurrentUser } from "@/lib/auth";

const positions = ["PG", "SG", "SF", "PF", "C"];

export default async function PredictedStartersPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    redirect("/login");
  }

  return (
    <main className="shell">
      <AppTopbar subtitle="赛前情报" />
      <section className="startersPage" aria-labelledby="starters-title">
        <header className="startersHeader">
          <p className="eyebrow">比赛日预测</p>
          <h1 id="starters-title">预测首发</h1>
          <span><CalendarDays aria-hidden="true" /> 当前比赛日</span>
        </header>

        <div className="startersEmpty">
          <div className="starterPositions" aria-hidden="true">
            {positions.map((position) => (
              <span key={position}><b>{position}</b><small>待公布</small></span>
            ))}
          </div>
          <strong>当前比赛日暂无预测数据</strong>
          <p>预测首发发布后，会按球队展示在这里。</p>
        </div>
      </section>
    </main>
  );
}
