"use client";

import { Search, TrendingDown, TrendingUp } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";

type BallSharePlayer = {
  englishName: string;
  chineseName: string;
  team: string;
  role: string;
  usageLevel: string;
  summary: string;
  metrics: Array<{
    label: string;
    description: string;
    percentile: number;
    last5: string;
    last10: string;
    season: string;
    trend: string;
    rising: boolean;
  }>;
};

const players: BallSharePlayer[] = [
  {
    englishName: "Luka Doncic",
    chineseName: "卢卡·东契奇",
    team: "LAL",
    role: "持球核心",
    usageLevel: "核心球权",
    summary: "最近 5 场使用率、持球时间、触球和潜在助攻都高于赛季平均，进攻更集中由他发起和终结。",
    metrics: [
      { label: "使用率", description: "由自己终结的进攻回合占比", percentile: 97, last5: "36.2%", last10: "35.1%", season: "33.8%", trend: "+2.4 pct", rising: true },
      { label: "持球时间", description: "每场实际控制篮球的总时间", percentile: 96, last5: "8.8 min", last10: "8.4 min", season: "8.0 min", trend: "+0.8 min", rising: true },
      { label: "场均触球", description: "每场获得并控制篮球的次数", percentile: 93, last5: "92.6", last10: "89.7", season: "86.4", trend: "+6.2", rising: true },
      { label: "潜在助攻", description: "传球后队友一次运球内出手的机会", percentile: 95, last5: "16.8", last10: "15.4", season: "14.6", trend: "+2.2", rising: true }
    ]
  },
  {
    englishName: "Jalen Brunson",
    chineseName: "杰伦·布伦森",
    team: "NYK",
    role: "持球核心",
    usageLevel: "核心球权",
    summary: "近期组织和终结负担同步上升，尤其是潜在助攻增加，说明他创造队友出手机会的频率更高。",
    metrics: [
      { label: "使用率", description: "由自己终结的进攻回合占比", percentile: 91, last5: "31.4%", last10: "29.8%", season: "28.7%", trend: "+2.7 pct", rising: true },
      { label: "持球时间", description: "每场实际控制篮球的总时间", percentile: 90, last5: "7.5 min", last10: "7.1 min", season: "6.8 min", trend: "+0.7 min", rising: true },
      { label: "场均触球", description: "每场获得并控制篮球的次数", percentile: 88, last5: "88.1", last10: "83.5", season: "80.7", trend: "+7.4", rising: true },
      { label: "潜在助攻", description: "传球后队友一次运球内出手的机会", percentile: 92, last5: "14.4", last10: "12.9", season: "11.8", trend: "+2.6", rising: true }
    ]
  },
  {
    englishName: "Nikola Jokic",
    chineseName: "尼古拉·约基奇",
    team: "DEN",
    role: "中轴组织者",
    usageLevel: "高球权",
    summary: "触球和潜在助攻依然处于极高水平，但持球时间较控卫核心更短，更多通过高位接球和快速传导组织进攻。",
    metrics: [
      { label: "使用率", description: "由自己终结的进攻回合占比", percentile: 86, last5: "27.9%", last10: "28.8%", season: "29.2%", trend: "-1.3 pct", rising: false },
      { label: "持球时间", description: "每场实际控制篮球的总时间", percentile: 82, last5: "5.1 min", last10: "5.5 min", season: "5.7 min", trend: "-0.6 min", rising: false },
      { label: "场均触球", description: "每场获得并控制篮球的次数", percentile: 98, last5: "94.2", last10: "96.4", season: "98.0", trend: "-3.8", rising: false },
      { label: "潜在助攻", description: "传球后队友一次运球内出手的机会", percentile: 99, last5: "17.2", last10: "17.8", season: "18.1", trend: "-0.9", rising: false }
    ]
  }
];

function normalize(value: string) {
  return value.toLowerCase().replace(/[\s.'·\-]/g, "");
}

export function BallShareDemo() {
  const [query, setQuery] = useState("卢卡·东契奇");
  const [selectedName, setSelectedName] = useState("Luka Doncic");

  const selectedPlayer = useMemo(
    () => players.find((player) => player.englishName === selectedName) || null,
    [selectedName]
  );

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedQuery = normalize(query);
    const match = players.find((player) => (
      normalize(player.englishName).includes(normalizedQuery)
      || normalize(player.chineseName).includes(normalizedQuery)
    ));
    setSelectedName(match?.englishName || "");
  }

  return (
    <section className="ballShareDemo" aria-labelledby="ball-share-title">
      <header className="ballShareHeader">
        <div>
          <p className="eyebrow">球员查询</p>
          <h1 id="ball-share-title">近期球权</h1>
        </div>
        <span className="demoStatus">Demo 示例数据</span>
      </header>

      <form className="ballShareSearch" onSubmit={submitSearch}>
        <label htmlFor="ball-share-player">球员姓名</label>
        <div>
          <Search aria-hidden="true" />
          <input
            id="ball-share-player"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="输入中文或英文姓名"
            autoComplete="off"
          />
          <button type="submit">查询</button>
        </div>
        <p>可试：卢卡·东契奇、Jalen Brunson、尼古拉·约基奇</p>
      </form>

      {selectedPlayer ? (
        <article className="ballShareReport">
          <header className="ballSharePlayerHeader">
            <div>
              <span>{selectedPlayer.team}</span>
              <h2>{selectedPlayer.chineseName}</h2>
              <p>{selectedPlayer.englishName}</p>
            </div>
            <div className="ballShareLabels">
              <strong>{selectedPlayer.usageLevel}</strong>
              <span>{selectedPlayer.role}</span>
            </div>
          </header>

          <div className="ballShareInsight">
            <strong>近期解读</strong>
            <p>{selectedPlayer.summary}</p>
          </div>

          <div className="ballShareTable" role="table" aria-label={`${selectedPlayer.chineseName}近期球权数据`}>
            <div className="ballShareTableHead" role="row">
              <span>指标与含义</span><span>最近 5 场</span><span>最近 10 场</span><span>赛季</span><span>趋势</span>
            </div>
            {selectedPlayer.metrics.map((metric) => (
              <div className="ballShareTableRow" role="row" key={metric.label}>
                <span className="ballShareMetric">
                  <strong>{metric.label}</strong>
                  <small>{metric.description}</small>
                  <span className="ballSharePercentile">
                    <i><b style={{ width: `${metric.percentile}%` }} /></i>
                    同位置前 {100 - metric.percentile}%
                  </span>
                </span>
                <span>{metric.last5}</span>
                <span>{metric.last10}</span>
                <span>{metric.season}</span>
                <span className={metric.rising ? "up" : "down"}>
                  {metric.rising ? <TrendingUp aria-hidden="true" /> : <TrendingDown aria-hidden="true" />}
                  {metric.trend}
                </span>
              </div>
            ))}
          </div>
          <footer>示例数据仅用于展示查询页面和趋势呈现方式；尚未接入 NBA 官方 Tracking 同步。</footer>
        </article>
      ) : (
        <div className="ballShareEmpty">
          <strong>暂无该球员的 Demo 数据</strong>
          <span>当前样例支持卢卡·东契奇、杰伦·布伦森和尼古拉·约基奇。</span>
        </div>
      )}
    </section>
  );
}
