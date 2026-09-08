# Street Court 整站交互 Demo

本地启动：在仓库根目录执行 `node demos/street-court/serve.mjs`，打开 http://localhost:4177/ 。所有状态只存于当前页面内存，刷新恢复初始数据。

- 首页：街球海报、可切换对阵、四个核心板块入口。
- 我的阵容：按位置/中英文姓名筛选、点击或桌面拖拽选人、移除球员、$125 工资帽、五人完整性校验、保存/编辑/删除演示阵容。
- 实时排名：单次/自动加分、暂停/重置、名次反超、我的附近、已开赛阵容展开、右侧半场球员查看。复用原交互 Demo 的确定性 7 事件模型。
- 赛前情报：一个姓名搜索栏，支持中英文匹配、键盘选择和无结果提示；选中球员后更新报告，可从报告加入阵容；保留预测首发切换。

球员、球队阵容、身价、比赛、首发和分数均为设计演示，不代表当前 NBA 信息。没有请求业务 API、修改数据库或部署正式页面。模拟首发中的球队归属仅服务于视觉样例。

桌面优先，移动端保留完整操作；减少动态效果设置下关闭入场、反超、指针倾斜和得分动效。拖拽也有点击选人的等效操作。

字体：Anton，来自 https://github.com/google/fonts/tree/main/ofl/anton 。SIL Open Font License 位于 `assets/OFL.txt`。篮球、球衣和球场均使用 CSS 几何绘制，没有第三方品牌图片或远程字体依赖。

代码检查：`node --check demos/street-court/street.mjs`。排名模型回归：`node demos/live-ranking/check.mjs`。浏览器验证证据保存于工作区 `outputs/street-court-review/`，不属于交付源码。
