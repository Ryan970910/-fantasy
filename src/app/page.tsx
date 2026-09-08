import { ArrowRight, Radar, UsersRound, Trophy } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppTopbar } from "@/components/app-topbar";
import { StreetScoreboard } from "@/components/street-scoreboard";
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
        <header className="streetHero">
          <div className="productHomeHeader">
            <h1 id="product-home-title"><span>THIS IS YOUR</span><strong>COURT.</strong></h1>
            <p><b>你的主场，由你定局。</b><br />选好五人阵容，为下一个比赛日做好准备。</p>
            <Link className="streetPrimary" href="/lineups">组建我的阵容 <ArrowRight aria-hidden="true" /></Link>
          </div>
          <div className="streetHeroArt" aria-hidden="true"><span className="streetArtWord">MAKE<br />YOUR MARK.</span><div className="streetBall"><span /></div><span className="streetArtTag">五人上阵<br /><small>$125 / ONE TEAM</small></span></div>
        </header>
        <StreetScoreboard />

        <div className="productHomeGrid">
          <Link className="productModule fantasyModule" href="/lineups">
            <span className="productModuleIcon"><UsersRound aria-hidden="true" /></span>
            <span className="productModuleCopy">
              <strong>范特西阵容</strong>
              <span>创建五人阵容，查看当前与历史阵容。</span>
              <span className="homePositions" aria-label="五个阵容位置"><b>PG</b><b>SG</b><b>SF</b><b>PF</b><b>C</b></span>
              <span className="moduleAction">进入阵容工作台 <ArrowRight aria-hidden="true" /></span>
            </span>
            <ArrowRight className="productModuleArrow" aria-hidden="true" />
          </Link>

          <Link className="productModule intelModule" href="/pregame-intel">
            <span className="productModuleIcon"><Radar aria-hidden="true" /></span>
            <span className="productModuleCopy">
              <strong>赛前情报</strong>
              <span>查看球员角色变化、今日推荐与预测首发页面。</span>
              <span className="moduleAction">查看情报 <ArrowRight aria-hidden="true" /></span>
            </span>
            <ArrowRight className="productModuleArrow" aria-hidden="true" />
          </Link>
          <Link className="productModule rankingModule" href="/rankings">
            <span className="productModuleIcon"><Trophy aria-hidden="true" /></span>
            <span className="productModuleCopy"><strong>实时排名</strong><span>追踪比赛日梦幻分，查看已开赛阵容与名次变化。</span><span className="moduleAction">进入排名赛道 <ArrowRight aria-hidden="true" /></span></span>
            <ArrowRight className="productModuleArrow" aria-hidden="true" />
          </Link>
        </div>
        <div className="homeRules"><h2>上场之前</h2><p>每个位置选择一人，总薪资不超过 <strong>$125</strong>。比赛开赛后，对应球队的球员锁定；其他位置仍可调整。</p></div>
      </section>
    </main>
  );
}
