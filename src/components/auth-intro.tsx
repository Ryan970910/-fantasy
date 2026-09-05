import { CircleDot } from "lucide-react";

export function AuthIntro() {
  return (
    <aside className="authIntro">
      <div className="authBrand"><CircleDot aria-hidden="true" /><strong>梦幻篮球</strong></div>
      <h2>五人上阵。<br />由你定局。</h2>
      <p>研究球员，权衡身价。<br />在 $125 工资帽内，选出你的比赛日阵容。</p>
      <div className="positionRoster" aria-label="阵容位置">
        <span><b>PG</b>控球后卫</span><span><b>SG</b>得分后卫</span><span><b>SF</b>小前锋</span><span><b>PF</b>大前锋</span><span><b>C</b>中锋</span>
      </div>
    </aside>
  );
}
