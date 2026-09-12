import { ArrowRight, ChartNoAxesColumnIncreasing, Newspaper } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppTopbar } from "@/components/app-topbar";
import { StreetScoreboard } from "@/components/street-scoreboard";
import { RetroHomeData } from "@/components/retro-home-data";
import { getCurrentUser } from "@/lib/auth";
import curryArt from "../../public/retro/curry.webp";
import { nbaGameDate } from "@/lib/game-window";
export default async function Home() {
  const currentUser = await getCurrentUser();
  if (!currentUser) { redirect("/login"); }
  const date = nbaGameDate();
  return <main className="shell">
    <AppTopbar subtitle="比赛中心" />
    <section className="retroHome" aria-labelledby="product-home-title">
      <div className="retroEditorial">
        <header className="retroHero">
          <div className="retroHeroCopy"><h1 id="product-home-title">FANTASY<br />MADE SIMPLE</h1><p>PICK / MANAGE / COMPETE / WIN</p><Link className="retroHeroLink" href="/lineups">选好五人，为你的主场而战 <ArrowRight aria-hidden="true" /></Link></div>
          {/* Approved cover art is decorative, never a saved-lineup player. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="retroHeroPlayer" src={curryArt.src} alt="" fetchPriority="high" />
          <span className="retroHeroSticker" aria-hidden="true">STEPH<br />CURRY</span>
        </header>
        <div className="retroHomeLower">
          <RetroHomeData section="team" date={date} />
          <Link className="retroPaper retroScoutLink" href="/player-intel"><h2>PLAYER SPOTLIGHT</h2><ChartNoAxesColumnIncreasing aria-hidden="true" /><strong>每个选择，<br />都有依据。</strong><p>搜索球员姓名，查看近期表现、角色变化与今日推荐。</p><span>查看球员报告 <ArrowRight aria-hidden="true" /></span></Link>
          <Link className="retroJoin" href="/rankings"><h2>JOIN THE GAME</h2><p>PLAY YOUR FIVE. MAKE YOUR MARK.</p><span>追踪真实阵容与比赛日排名 <ArrowRight aria-hidden="true" /></span></Link>
          <div className="retroUtility"><Link href="/player-intel"><ChartNoAxesColumnIncreasing aria-hidden="true" /><b>球员分析</b></Link><Link href="/pregame-intel"><Newspaper aria-hidden="true" /><b>赛前情报</b></Link></div>
        </div>
        <section className="retroPaper homeRules" id="rules"><h2>上场之前</h2><p>每个位置选择一人，总薪资不超过 <strong>$125</strong>。比赛开赛后，对应球队的球员锁定；其他位置仍可调整。</p></section>
      </div>
      <aside className="retroRail"><section className="retroPaper retroGames" id="nba-games"><h2>TODAY’S GAMES<small>NBA 比赛</small></h2><StreetScoreboard /></section><RetroHomeData section="rankings" date={date} /><div className="retroQuote" aria-hidden="true">GOOD PLAYERS<br />INSPIRE.<br />GREAT PLAYERS<br />ELEVATE.</div></aside>
    </section>
  </main>;
}
