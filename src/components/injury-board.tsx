"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, FileClock, RefreshCw } from "lucide-react";
import { PageBackLink } from "@/components/page-back-link";
import { INJURY_STATUS, REPORT_RETENTION_MS, type InjuryReport } from "@/lib/nba-injuries";
import { normalizeTranslationName } from "@/lib/player-name-translations";

const beijingTime = (value: string) => new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
}).format(new Date(value));

export function InjuryBoard() {
  const [report, setReport] = useState<InjuryReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [team, setTeam] = useState("");
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const response = await fetch("/api/nba/injuries", { cache: "no-store", signal });
      if (!response.ok) throw new Error(response.status === 401 ? "登录已失效，请重新登录后查看。" : "NBA 官方报告暂时无法读取，请重试或前往官网查看原文。");
      const data: InjuryReport = await response.json();
      if (signal?.aborted) return;
      setReport(data);
      setError("");
    } catch (failure) {
      if (signal?.aborted) return;
      setReport(null);
      setError(failure instanceof Error ? failure.message : "报告读取失败，请重试。");
    } finally { if (!signal?.aborted) setLoading(false); }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    const refresh = () => { if (!document.hidden) void load(controller.signal); };
    const timer = setInterval(refresh, 5 * 60 * 1000);
    document.addEventListener("visibilitychange", refresh);
    return () => { controller.abort(); clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, [load]);
  useEffect(() => {
    if (!report?.publishedAt) return;
    const remaining = Date.parse(report.publishedAt) + REPORT_RETENTION_MS - Date.now();
    const timer = setTimeout(() => { setReport(null); void load(); }, Math.max(0, remaining));
    return () => clearTimeout(timer);
  }, [report, load]);

  const expired = !!report?.publishedAt && Date.now() - Date.parse(report.publishedAt) >= REPORT_RETENTION_MS;
  const visibleReport = expired ? null : report;
  const entries = visibleReport?.entries ?? [];
  const needle = normalizeTranslationName(query);
  const filtered = entries.filter(entry => (!status || entry.status === status) && (!team || entry.team === team) && normalizeTranslationName(`${entry.name} ${entry.englishName}`).includes(needle));
  const teams = [...new Set(entries.map(entry => entry.team))].sort();
  const stale = !!visibleReport?.publishedAt && Date.now() - Date.parse(visibleReport.publishedAt) > 24 * 60 * 60 * 1000;

  return <section className="intelHub injuryBoard" aria-labelledby="injury-title">
    <header className="intelHubHeader">
      <PageBackLink href="/pregame-intel">返回赛前情报</PageBackLink>
      <h1 id="injury-title" className="streetTitle"><span>INJURY REPORT</span><small>球员伤病</small></h1>
      <p>查看 NBA 官方出场状态，确定阵容前再确认一次。</p>
    </header>
    <div className="injurySource">
      <div><strong>NBA 官方伤病报告</strong><p>仅保留最近 7 天 · 每 5 分钟检查更新</p>
        {visibleReport?.publishedAt && <p>报告发布：{beijingTime(visibleReport.publishedAt)}（北京时间）</p>}
        {visibleReport && <p>最近查询：{beijingTime(visibleReport.fetchedAt)}（北京时间）</p>}
      </div>
      <div className="injuryActions">
        <button className="refreshButton" disabled={loading} onClick={() => void load()}><RefreshCw aria-hidden="true" />{loading ? "正在读取…" : "刷新报告"}</button>
        <a href={visibleReport?.reportUrl || visibleReport?.sourceUrl || "https://official.nba.com/"} target="_blank" rel="noopener noreferrer">{visibleReport?.reportUrl ? "官方 PDF 原文" : "NBA 官方报告入口"}<ExternalLink aria-hidden="true" /></a>
      </div>
    </div>
    {stale && <p className="injuryNotice" role="status">这份报告已超过 24 小时，仅供参考。出场状态可能已改变，请核对官方最新报告。</p>}
    {error && <p className="injuryNotice" role="alert">{error}{error.includes("登录") && <> <a href="/login">重新登录</a></>}</p>}
    {loading && !visibleReport && <p className="injuryEmpty" role="status">正在读取 NBA 官方报告…</p>}
    {!loading && visibleReport && !visibleReport.reportUrl && <div className="injuryEmpty"><FileClock aria-hidden="true" /><h2>暂无最近 7 天的已发布报告</h2><p>NBA 官方页面目前没有可读取的近期报告。休赛期或球队尚未提交时可能出现此状态，不代表所有球员都可出战。</p></div>}
    {visibleReport?.reportUrl && <>
      <form className="injuryFilters" onSubmit={event => event.preventDefault()} aria-label="筛选伤病报告">
        <label>搜索球员<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="中文或英文姓名" /></label>
        <label>球队<select value={team} onChange={event => setTeam(event.target.value)}><option value="">全部球队</option>{teams.map(value => <option key={value}>{value}</option>)}</select></label>
        <label>出场状态<select value={status} onChange={event => setStatus(event.target.value)}><option value="">全部状态</option>{Object.entries(INJURY_STATUS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      </form>
      <p className="injuryCount" role="status">显示 {filtered.length} / {entries.length} 名球员 · 比赛日期采用美东日期</p>
      <div className="injuryRows">
        {filtered.map(entry => <article className="injuryRow" key={`${entry.gameDate}-${entry.matchup}-${entry.team}-${entry.englishName}`}>
          <div><h2>{entry.name}</h2>{entry.name !== entry.englishName && <p>{entry.englishName}</p>}<p>{entry.team}</p></div>
          <div><span className="injuryStatus" data-status={entry.status}>{INJURY_STATUS[entry.status]}</span><small>{entry.status}</small></div>
          <div className="injuryReason"><p>{entry.reason || "官方未提供具体原因"}</p><small>{entry.gameDate} · {entry.matchup}</small></div>
        </article>)}
      </div>
      {!filtered.length && <p className="injuryEmpty">{entries.length ? "没有符合条件的球员，请调整搜索或筛选条件。" : "报告尚无球员条目，请查看下方球队提交状态。"}</p>}
      {!!visibleReport.pendingTeams.length && <details className="injuryPending"><summary>{visibleReport.pendingTeams.length} 项球队报告尚未提交</summary><ul>{visibleReport.pendingTeams.map(item => <li key={`${item.gameDate}-${item.matchup}-${item.team}`}>{item.gameDate} · {item.team} · {item.matchup} · 待提交</li>)}</ul></details>}
      <p className="injuryFootnote">伤病原因保留 NBA 英文原文，含轮休、下放及其他缺阵原因。可出战不等于确认首发；未列入报告也不保证出战。</p>
    </>}
  </section>;
}
