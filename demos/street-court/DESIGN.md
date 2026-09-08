---
name: Street Court
description: 街头篮球海报语言的四页本地范特西交互演示。
colors:
  black: "#121210"
  panel: "#1b1b18"
  raised: "#24241f"
  orange: "#ff6b2b"
  cream: "#eeeada"
  muted: "#aaa99a"
  line: "#383831"
  lime: "#d8ed91"
typography:
  display:
    fontFamily: "Anton"
    fontWeight: 400
    fontSize: "clamp(66px, 7vw, 96px)"
    lineHeight: 0.93
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Segoe UI, Microsoft YaHei, sans-serif"
    fontSize: "14px"
components:
  button-primary:
    backgroundColor: "{colors.orange}"
    textColor: "{colors.black}"
    padding: "12px 20px"
  button-primary-hover:
    backgroundColor: "#f68a51"
---

# Design System: Street Court
## Overview
街头主场：将室外篮球赛事海报的粗体、球场线和球衣轮廓用于真实可操作的工作区。四个 hash 页面为主场首页、我的阵容、实时排名、赛前情报；阵容保存与预测首发分别是页面内切换视图。
本文件只约束此独立 demo。球员归属、价格、比分、角色报告及首发全部模拟；状态仅驻留页面内存，刷新重置。没有业务 API、数据库写入或生产页面接入。

## Colors
`street.css` 的根变量是颜色来源。沥青黑承载页面，panel/raised 区分工作面；cream 用于主文字、首页组队入口和球探主报告。橙色用于主操作、数值重点与选中边框，lime 用于状态与键盘焦点。muted 承载次级说明，line 分隔内容。排名第一名使用独立浅色底 `#dedbc9`，个人行使用暖暗底 `#282019`。

## Typography

Anton 承担英文海报标题、位置缩写与记分牌数字；中文与正文使用系统字体。标题维持紧凑行距，正文说明保留清晰层级；榜单分数采用等宽数字。桌面页面标题为 58px，手机为 40px；首页主词另有放大比例。
字体本地文件为 `assets/anton.ttf`，通过 `@font-face` 加载并设置 `font-display:swap`，无远程字体请求。来源为 [Google Fonts / Anton](https://github.com/google/fonts/tree/main/ofl/anton)，版权为 The Anton Project Authors；SIL Open Font License 1.1 全文随附于 `assets/OFL.txt`。

## Layout

桌面容器最大 1320px、左右内边距 40px；提示条高 30px，主导航高 92px。首页为文字与橙色篮球图形双栏，接三场比赛与模块入口；阵容为球场/球员池双栏；排名主栏配 328px 阵容侧栏；情报为宽版球探报告与下方分析。
断点为 1100、760、500px。760px 以下组队与排名主区域改为单栏；500px 以下导航独占第二行、页面边距 18px、首页装饰篮球隐藏、比赛条与首发球队纵排。组队球场保留五个位置，手机槽位宽 74px；选人可点击完成。排名专用底部控制栏固定，手机适配安全区并预留正文底部空间。

## Elevation & Depth

工作区以色面、细分隔线和少量边框组织。阴影集中在篮球、球衣、球场标记、拖拽预览与得分提示，表示物体或临时状态；球场通过透视和鼠标倾斜形成浅层深度。

## Shapes

控件、榜单和工作面以直角为主；圆形用于篮球、头像、球场标记及播放按钮。篮球、球衣和场地均由 CSS 几何绘制，海报面板有切角，没有交付栅格素材。

## Components

- 球员情报在宽版报告上方提供一个姓名搜索栏，支持中文或英文匹配。选择结果更新同一份报告；回车选择首项，上下键移动，清空按钮恢复搜索空状态。没有匹配时提供明确提示，数据仍为本地样例。
- 操作按钮通常至少 44px 高；橙色主按钮悬停变亮并上移 2px。禁用按钮透明度为 .4；球员池已选行保持 opacity:1，以橙色“已上场”文字识别。选中槽位由虚线变为橙色实线。
- 按钮、链接和 summary 的键盘焦点为 2px lime 外框、5px 偏移；球场槽位偏移为 2px。搜索使用橙色下划线焦点与光标。文本选择为橙底黑字；筛选选中为 cream 底黑字，页面导航选中为橙色底线并设置 `aria-current`。
- 点击或桌面鼠标拖拽选人；错误位置与超出 $125 预算显示状态说明。五个位置齐全才可保存；保存页提供编辑、删除和空状态。筛选支持位置和中英文姓名。
- 排名复用确定性的七回合模型。下一次得分、自动/暂停、重置、附近筛选和个人定位驱动同一状态；原生 details 展开已开赛球员，半场标记可点选查看。得分更新同步数字、名次、场边公告和球场反馈。
- 动效包括页面 500ms 入场、数字 650ms 递增、名次 700ms 位移、投篮轨迹和 2.5s 得分提示；自动演示每 4.2s 推进一步，离开排名或隐藏页面即暂停。`prefers-reduced-motion` 关闭 CSS 动画/过渡、数字插值、排名位移与指针倾斜，保留静态提示和操作结果。

## Do's and Don'ts

- Do 保留中英文层级、球场空间和模拟数据标识；保持点击与键盘可用，勿让拖拽成为唯一选人方式。
- Don't 把样例球队归属、预测首发、榜单或内存保存描述为当前 NBA 数据或生产功能。
- 完成检查记录：桌面 1440×900、手机 390×844 视觉复查通过；导航、拖拽/预算、保存与排名交互已验证。证据位于工作区 `outputs/street-court-review/`，不属于交付源码。
