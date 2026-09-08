---
name: 梦幻篮球 / Street Court
description: 美式街头篮球海报语言的真实比赛日阵容工作区
colors:
  bg: "#121210"
  surface: "#1b1b18"
  raised: "#24241f"
  line: "#383831"
  text: "#eeeada"
  muted: "#aaa99a"
  accent: "#ff6b2b"
  ink: "#121210"
  focus: "#d8ed91"
  danger: "#f0a49a"
typography:
  display:
    fontFamily: "Anton, sans-serif"
    fontSize: "clamp(58px, 6vw, 86px)"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "-.025em"
  headline:
    fontFamily: "Anton, sans-serif"
    fontSize: "clamp(38px, 4.3vw, 60px)"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "-.025em"
  body:
    fontFamily: "'Segoe UI', 'Microsoft YaHei', 'PingFang SC', sans-serif"
    fontSize: "14px"
    lineHeight: 1.6
  label:
    fontSize: "12px"
rounded:
  control: "0px"
  surface: "0px"
spacing:
  compact: "8px"
  small: "12px"
  medium: "16px"
  section: "24px"
  large: "32px"
  page: "40px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "10px 22px"
  button-primary-hover:
    backgroundColor: "#f68a51"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
  input:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
  module:
    backgroundColor: "{colors.text}"
    textColor: "{colors.ink}"
    rounded: "{rounded.surface}"
    padding: "32px"
---

# Design System: 梦幻篮球 / Street Court

## Overview

**Creative North Star: "Street Court / 街头主场"**

美式室外篮球赛事海报成为可操作的范特西工作区：沥青黑、橙色与奶油白构成强烈色面，Anton 英文标题和记分数字建立赛事气氛，中文说明与原生控件保持清楚。球场线、五个位置和 CSS 篮球是共同视觉线索，首页、阵容、排名、情报与认证页使用同一世界。

**Key Characteristics:**

- 英文海报标题与清楚的中文功能说明并置。
- 方正工作面、细分隔线、橙色操作和奶油白重点报告。
- 桌面球场编排与手机完整原生操作共存。

本文件替换旧深绿金色方向，记录正式版已实现界面；产品与发布授权见 `PRODUCT.md`。视觉证据为 `outputs/street-release-review/*.jpg` 的八类页面桌面/手机版：受保护组件使用 fixture API，登录和注册来自实际 Next 构建。类型检查、37 项测试及构建通过；这些证据不代表生产登录、数据库写入或部署已验证。

## Colors

### Primary

`accent` 是球场橙，用于主要动作、选中边界、关键数字和个人排名摘要；`ink` 是橙色或浅色实底上的文字。主按钮悬停采用 frontmatter 的较亮橙色。

### Secondary

`focus` 是浅青柠键盘焦点；排名区保持橙色焦点。`danger` 标识错误、超预算与下降指标，并配文字或符号。

### Neutral

`bg` 是沥青黑底，`surface` 与 `raised` 区分工作面和展开状态，`line` 分隔行。`text` 是奶油白正文，同时承担首页组队入口和球员主报告的浅色面；`muted` 用于辅助说明。浅色面中的说明采用深灰，第一名与个人行保留独立色面。

**The State Has Words Rule.** 加载、错误、锁定、缺少数据和选中状态都必须有可理解的文字或语义，不能只靠颜色。

## Typography

Anton 由 `next/font/local` 加载 `public/fonts/anton.ttf`，通过 `--font-anton` 使用，字重（400）、`display: swap`；许可保留于 `public/fonts/OFL.txt`。英文海报标题、PG/SG/SF/PF/C、排名和预算数字使用 Anton；中文和正文采用 frontmatter 的系统字体栈。

首页标题采用 display 层级，内部主词另放大；手机标题为（64px）。内页标题采用 headline，手机通常为（38px）；中文伴随标题为桌面（23px）、手机（18px）。认证标题为桌面（46–72px）、手机（44px）。分数使用等宽数字，长英文姓名可换行，说明文本通常不超过（65ch）。

## Layout

常规页面最大宽度（1240px），左右留白共（80px），顶部（40px）；手机左右各（18px）、顶部（28px）。顶栏桌面至少（92px），手机为品牌与四项导航两行、至少（116px）。首页双栏海报在手机改为单栏并隐藏装饰篮球；入口随之纵排。

阵容编辑最大宽度（1320px），高度扣除顶栏。超过（1000px）时，左侧半场内排布五个可点击位置，右侧为球员池；中等宽度使用（260px）位置栏；（700px）及以下变为五列位置条和纵向球员池。底部预算与保存操作保持可见，并计入安全区。球队、排序与日期继续使用原生控件。

排名桌面为主列表与（270px）球场/公告侧栏；（900px）以下改单列，（560px）以下进一步压缩行与日期布局。情报主报告桌面为姓名、等级、指标三列，（1000px）以下隐藏装饰性大等级，（700px）以下指标横排在姓名下方。认证页桌面双栏、手机纵排。

## Elevation & Depth

主体依靠色面与细线形成层级。阴影集中在首页 CSS 篮球、贴纸和预算对话框；普通数据行不叠加浮动卡片。篮球悬停旋转并轻微上移，入口悬停上移（3px）。交互过渡通常（180–250ms），篮球为（700ms）；减少动态效果偏好下关闭动画与过渡。

## Shapes

主要按钮、输入、模块和排名行采用直角。圆形用于篮球、品牌图标、头像和篮筐；首页橙色画面使用切角。球场由边线和几何弧线组成。位置槽位默认虚线，当前槽位用实线强调；少量内嵌选择标记保留小圆角。图标使用 Lucide，篮球与球场以 CSS 绘制，无新增栅格素材。

## Components

- **Buttons / Fields:** 主要按钮橙底深字，一般至少（44px）高，首页主入口为（48px）。保留原生禁用、loading 和表单验证；通用焦点是（2px）浅青柠轮廓、偏移（4px），排名焦点为橙色、偏移（3px）。
- **Navigation:** 首页、我的阵容、实时排名、赛前情报共用导航。当前页用浅色文字、橙色底线与 `aria-current` 表达；手机四列均分。
- **Scoreboard:** 首页比赛条读取真实 API，横向溢出可滚动；加载、无比赛、错误与刷新状态有文字，不放入演示比赛。
- **Player intelligence:** 只保留一个球员姓名搜索栏，支持中文或英文。结果为可聚焦按钮，回车可选首项，清空后恢复默认报告；没有实现 demo 的上下键结果导航。选择更新同一份奶油白报告，下方原生 `details` 展开详细指标；排序、空结果和数据不可用状态保持可见。
- **Lineup / Budget:** 点击位置与球员按钮选人，保留当前/历史、编辑、删除及预算反馈。正式版不把 demo 拖拽、内存保存或模拟控制当作已实现能力；服务器仍决定定价、锁定与保存结果。
- **Rankings:** 个人摘要为橙色，第一名为浅色，当前用户行有橙色边界。日期、范围筛选、刷新和原生展开行复用真实排名流程；球场通过原生下拉选择阵容、点击位置查看已开赛球员，未开赛球员隐藏。没有演示得分、自动播放或重置比赛控制。
- **Empty / Auth:** 预测首发保持无数据源的诚实空状态。登录与注册沿用真实认证表单，橙色顶线与英文海报引导统一视觉。

## Do's and Don'ts

- **Do** 复用沥青黑、橙色、奶油白、本地 Anton 和中文系统字体。
- **Do** 验证桌面球场、手机长姓名、底部预算、日期输入和空状态。
- **Do** 保留原生操作、可见焦点、减少动态效果偏好和清楚的状态文字。
- **Don't** 恢复深绿金色武侠主题，或给普通数据行堆叠阴影卡片。
- **Don't** 用 demo 模拟数据、拖拽或动画控制描述正式版能力。
- **Don't** 用视觉截图或构建通过暗示生产数据写入、部署或认证流程已经验证。
