# Retro Courtside production surface

Mode: Operate. 用户批准将认可的 Retro Courtside demo 世界应用到正式应用并部署；本文件记录已实现方向，不代表部署已经完成。

## Direction contract

THESIS: 让真实五人阵容与球员研究发生在一本重度磨损的场边篮球旧刊里。

OWN-WORLD: 全局褪色红墨、石油蓝和陈旧奶油纸；擦痕、掉墨与破旧纸边覆盖所有页面、控件和手机版。源侧栏保留印刷字形，Anton 用于赛事标题，Kalam 用于短手写边注，中文操作用可读系统字体。

STORY: 从封面进入真实阵容，读取最近保存快照、日期与预算；搜索球员资料，查看比赛日排名和比赛状态。空数据、上游不可用与未开放功能保持可见。

FIRST VIEWPORT: 桌面是源艺术侧栏、真实球员搜索、红色封面与装饰 Curry、奶油纸阵容摘要和比赛/排名右栏。手机隐藏侧栏，以品牌、纵向内容、固定底部导航重新编排，去掉重复顶部快捷入口。桌面与手机使用相同四项中文导航。

FORM: 批准参考是 demos/retro-courtside/DESIGN.md 与 outputs/retro-sidebar/desktop.jpg。正式产物是 src/app/retro.css 与实际组件；demo 行为不成为正式能力。手机保留原生输入、可见焦点和导航上方的阵容操作条。

FINISH: 八类页面桌面/手机证据位于 outputs/retro-release-review/。受保护预览为明确标识的隔离 fixture，认证页来自实际 Next 构建；完成阶段报告类型检查、37 项测试、构建和独立视觉审查通过。DESIGN.md、PRODUCT.md、.impeccable/design.json 同步当前系统；public/retro/*.webp.json 保留来源。生产发布状态另行验证。

## Scope guardrails

- 保留认证、API、数据库、同步、$125 工资帽、位置唯一性、服务端定价、开赛锁定与排名隐私规则。
- 首页展示最近保存阵容及日期，不暗示它一定属于当前比赛日。装饰封面人物不属于阵容数据。
- 桌面顶栏 GET q 连接球员情报；手机通过 PLAYERS 进入实际搜索。
- LIVE 和 TOOLS 是首页锚点；MATCHUP 到预测首发空状态；COMMUNITY 只说明尚未开放。
- 不引入 demo 自动填充、拖拽、模拟得分、社区发布或虚构实时状态。
- 独立审查确认参考材质、整体一致性和可用性；文档更新不替代生产认证、数据写入和部署验证。
