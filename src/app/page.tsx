import { ArrowRight, Radar, UsersRound } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppTopbar } from "@/components/app-topbar";
import { getCurrentUser } from "@/lib/auth";

export default async function Home() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    redirect("/login");
  }

  return (
    <main className="shell">
      <AppTopbar subtitle="比赛中心" />
      <section className="productHome" aria-labelledby="product-home-title">
        <header className="productHomeHeader">
          <p className="eyebrow">比赛工具</p>
          <h1 id="product-home-title">选择你的赛前任务</h1>
        </header>

        <div className="productHomeGrid">
          <Link className="productModule fantasyModule" href="/lineups">
            <span className="productModuleIcon"><UsersRound aria-hidden="true" /></span>
            <span className="productModuleCopy">
              <small>阵容管理</small>
              <strong>范特西阵容</strong>
              <span>创建五人阵容，查看当前与历史阵容。</span>
            </span>
            <ArrowRight className="productModuleArrow" aria-hidden="true" />
          </Link>

          <Link className="productModule intelModule" href="/pregame-intel">
            <span className="productModuleIcon"><Radar aria-hidden="true" /></span>
            <span className="productModuleCopy">
              <small>赛前情报</small>
              <strong>赛前情报</strong>
              <span>查看预测首发与近期球权，辅助比赛日前的阵容选择。</span>
            </span>
            <ArrowRight className="productModuleArrow" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </main>
  );
}
