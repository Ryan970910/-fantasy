"use client";

import { Search, TrendingDown, TrendingUp } from "lucide-react";
import { FormEvent, useState } from "react";

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

type LookupResult = { status: string; season?: string; message?: string; error?: string; player?: BallSharePlayer & { reason?: string; sourceUrl?: string; syncedAt?: string } };

export function BallShareLookup() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<LookupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const selectedPlayer = result?.status === "AVAILABLE" ? result.player || null : null;

  async function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const response = await fetch(`/api/ball-share?q=${encodeURIComponent(query)}`);
      setResult(await response.json() as LookupResult);
    } catch {
      setResult({ status: "ERROR", error: "近期球权数据暂时不可用，请稍后重试。" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="ballShareDemo" aria-labelledby="ball-share-title">
      <header className="ballShareHeader">
        <div>
          <p className="eyebrow">球员查询</p>
          <h1 id="ball-share-title">近期球权</h1>
        </div>
        <span className="demoStatus">NBA 官方 Tracking</span>
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
        <p>支持中文或英文姓名查询。</p>
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
          <footer>数据来源：NBA 官方 Tracking，所选赛季 {result?.season}。同位置百分位仅比较有完整数据的球员。</footer>
        </article>
      ) : result ? (
        <div className="ballShareEmpty">
          <strong>{result.status === "NOT_FOUND" ? "未找到球员" : "暂无可展示的球权数据"}</strong>
          <span>{result.player?.reason || result.message || result.error || "请输入球员姓名后查询。"}</span>
        </div>
      ) : <div className="ballShareEmpty"><strong>{loading ? "正在查询" : "查询球员近期球权"}</strong><span>{loading ? "正在读取 NBA 官方 Tracking 数据。" : "输入中文或英文姓名，查看最近 5 场、最近 10 场和赛季数据。"}</span></div>}
    </section>
  );
}
