"use client";
import type { CSSProperties } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const items = [
  ['home', 'HOME', 202],
  ['live', 'LIVE', 257],
  ['players', 'PLAYERS', 312],
  ['team', 'MY TEAM', 367],
  ['matchup', 'MATCHUP', 422],
  ['rankings', 'RANKINGS', 477],
  ['news', 'NEWS', 532],
  ['tools', 'TOOLS', 587],
  ['community', 'COMMUNITY', 642],
] as const;

export function RetroSidebar() {
  const path = usePathname();
  const page = path === '/lineups' ? 'team' : path === '/rankings' ? 'rankings' : path === '/player-intel' ? 'players' : path === '/predicted-starters' ? 'matchup' : path === '/pregame-intel' ? 'news' : 'home';
  const destinations: Record<string,string> = {home:'/',live:'/#nba-games',players:'/player-intel',team:'/lineups',matchup:'/predicted-starters',rankings:'/rankings',news:'/pregame-intel',tools:'/#rules'};
  const selected = page;
  return (
    <aside className="reference-sidebar" aria-label="Micro Fantasy">
      <div className="reference-sidebar-art"><svg className="print-filters" aria-hidden="true" width="0" height="0">
        <defs>
          <filter id="selected-menu-ink" colorInterpolationFilters="sRGB">
            <feColorMatrix type="saturate" values="0" />
            <feComponentTransfer>
              <feFuncR type="linear" slope="20" intercept="-10" />
              <feFuncG type="linear" slope="20" intercept="-10" />
              <feFuncB type="linear" slope="20" intercept="-10" />
            </feComponentTransfer>
            <feColorMatrix values="-.870 0 0 0 .933  0 -.682 0 0 .878  0 0 -.498 0 .729  0 0 0 1 0" />
          </filter>
          <filter id="unselected-home-ink" colorInterpolationFilters="sRGB">
            <feColorMatrix type="saturate" values="0" />
            <feComponentTransfer>
              <feFuncR type="linear" slope="20" intercept="-10" />
              <feFuncG type="linear" slope="20" intercept="-10" />
              <feFuncB type="linear" slope="20" intercept="-10" />
            </feComponentTransfer>
            <feColorMatrix values="-.215 0 0 0 .933  0 -.659 0 0 .878  0 0 -.596 0 .729  0 0 0 1 0" />
          </filter>
        </defs>
      </svg>
      <nav aria-label="Desktop navigation">
        {items.map(([id, label, top]) => (
          <Link
            key={id}
            href={destinations[id] ?? "#community-note"} title={id === "community" ? "社区功能尚未开放" : label}
            aria-label={label}
            aria-current={selected === id ? 'page' : undefined}
            className={`printed-menu ${id === 'home' ? 'printed-home' : ''} ${selected === id ? 'is-current' : ''}`}
            style={{ top, '--print-y': `-${top}px` } as CSSProperties}
            onClick={id === "community" ? event => { event.preventDefault(); document.getElementById("community-note")?.toggleAttribute("hidden"); } : undefined}
          >
            <span className="menu-print" aria-hidden="true" />
            <span className="sr-label">{label}</span>
          </Link>
        ))}
      </nav><p id="community-note" className="community-note" hidden>社区功能尚未开放。你可以在 RANKINGS 查看比赛日排名。</p></div>
    </aside>
  );
}
