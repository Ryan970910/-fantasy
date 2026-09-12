---
name: 梦幻篮球 / Retro Courtside
description: 重度磨损红蓝旧纸篮球杂志，承载真实比赛日操作
colors:
  red: "#b63822"
  action: "#a6321f"
  navy: "#10323b"
  cream: "#eee0ba"
  paper: "#e8d7ab"
  paper-edge: "#b9a37b"
  paper-line: "#b9a47b"
  paper-muted: "#675335"
  action-text: "#fff0ce"
  focus: "#e7b46b"
typography:
  display:
    fontFamily: "Anton, sans-serif"
    fontSize: "clamp(52px,5.5vw,88px)"
    fontWeight: 400
    lineHeight: 1.04
    letterSpacing: "-.025em"
  headline:
    fontFamily: "Anton, sans-serif"
    fontSize: "clamp(32px,3.3vw,48px)"
    fontWeight: 400
  body:
    fontFamily: "'Segoe UI', 'Microsoft YaHei', 'PingFang SC', sans-serif"
    fontSize: "14px"
    lineHeight: 1.6
  handwriting:
    fontFamily: "Kalam, cursive"
    fontWeight: 400
rounded:
  control: "3px 5px 2px 4px"
  paper: "5px 8px 6px 4px"
  search: "4px"
spacing:
  compact: "8px"
  gutter: "12px"
  mobile-inset: "16px"
  paper-inset: "18px"
  page-inset: "28px"
components:
  action-link:
    backgroundColor: "{colors.action}"
    textColor: "{colors.action-text}"
    padding: "10px 12px"
  search:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.navy}"
    rounded: "{rounded.search}"
    padding: "0px 10px"
  paper:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.navy}"
    rounded: "{rounded.paper}"
    padding: "18px"
---

# Design System: 梦幻篮球 / Retro Courtside

## Overview

**Creative North Star: "The Courtside Magazine / 场边旧刊"**

重度磨损的篮球旧刊成为真实比赛日工作区：褪色红墨、石油蓝和陈旧奶油纸覆盖首页、阵容、排名、情报与认证页。Anton 的赛事标题与 Kalam 的手写边注营造印刷物气氛，中文正文和原生控件保持清楚。

用户批准的 Retro Courtside 世界取代旧黑橙与更早绿金方向。源侧栏艺术保留印刷字形，全局材质延续同一参考；不宣称整个站点逐像素一致。当前依据为 `src/app/retro.css` 及继承的 `globals.css`、`street.css`，组件行为以正式源代码为准。

**Key Characteristics:**

- 全局红蓝旧墨与磨损奶油纸，包含控件、球场和手机版。
- 凝练英文标题、短手写边注与可读中文说明并置。
- 桌面印刷侧栏和编辑栏，手机只保留固定底部导航。
- 装饰封面与真实阵容、数据日期、空状态明确区分。

## Colors

### Primary

red 用于封面和引导面，action 用于主要操作、已选筛选与个人排名摘要；主要动作搭配 action-text。

### Secondary

navy 是背景旧墨，也是纸面标题、姓名与数字的颜色。focus 是深底暖色焦点；纸面主要工作区使用 action 焦点。

### Neutral

cream 是深底文字，paper 是阅读面与输入底色；paper-edge、paper-line 和 paper-muted 分别承担纸边、分隔和辅助说明。纸面覆盖共享 CSS 变量，不要将深底文字颜色直接搬到浅纸上。

**The Limited Ink Rule.** 延用红、蓝、奶油纸与暖色强调的角色，先复用现有局部变量再增加颜色。

**The State Has Words Rule.** 加载、错误、锁定、缺少数据和选中状态都必须有可理解的文字或语义，不能只靠颜色。

## Typography

Anton 使用已有本地字体与 `--font-anton`，承担英文标题、位置和分数；Kalam 使用 `public/fonts/kalam.ttf`，以 swap 加载，承担短手写注释。中文姓名、说明、表单使用系统无衬线字体栈。许可保留在 `public/fonts/`。

display 是首页封面标题；内部页面使用 headline，手机为（34px）。首页手机标题为（62px），超宽桌面为（94px）；纸面小节通常是 Anton（24px）。手写注释按空间采用（23–34px），保留各统计组件自身字号。

**The Two Reading Speeds Rule.** 凝练字体用于快速扫描，普通无衬线用于姓名和操作说明；Kalam 只承担短边注。

## Layout

桌面侧栏固定左侧，可纵向滚动，原始画布为（269px × 1009px），工作区留出（269px）。在（701–1000px）范围，占位为（230px），原图按（0.855）缩放。首页最大宽度（1600px），主编辑栏旁为（292px）右栏、（12px）间距；（1250px）以下右栏移到主内容下方，（1000px）以下进一步单列。

内页纸面最大宽度（1280px），桌面内边距（28px）。手机断点（700px）：侧栏隐藏、恢复全宽，纸面左右各（10px）外距，通常（20px 14px）内边距。保留品牌和固定（70px）底部导航，删除顶部重复快捷链接；页面预留（76px）底部空间，阵容保存栏位于导航上方。首页内容纵排，认证页双栏转单栏。

阵容位置、球员池、日期、历史和排名展开沿用真实工作流。验证长姓名、原生日期和固定操作区，不能等比缩小桌面画面。

## Elevation & Depth

`public/retro/red-worn.webp`、`navy-worn.webp`、`paper-worn.webp` 分别提供红墨、蓝墨和旧纸。擦痕、褪色和纸边遍布主要面板与控件。纸面采用 cover 裁切，border-image 使用（60 / 7px / 0 stretch）。薄边线、轻微旋转和封面插画重叠形成物件层次；普通数据行仍用分隔线组织。

**The Global Wear Rule.** 旧纸印刷材质必须覆盖每个主要界面和控件；只有侧栏做旧不构成这个世界。

沿用全局 reduced-motion 规则，关闭动画、过渡和顺滑滚动。印刷侧栏没有位移与过渡，悬停仅显细框。

## Shapes

纸面和控件使用小幅不对称圆角，保留印刷纸块轮廓。球场弧线和槽位是功能图形，空位置保留明确边界。导航和姓名仍是语义 HTML，功能图标使用 Lucide。

## Components

- **Navigation:** 桌面与手机共用四项中文语义链接：首页、我的阵容、实时排名、球员情报。桌面使用磨损红纸覆盖旧菜单区域，配 Lucide 图标、纸面选中态和 aria-current；焦点为浅色（2px），偏移（3px）。手机仅保留底部导航，顶部页头收紧。移除未实现功能的导航入口。
- **Search:** 桌面纸面搜索框以 GET q 进入球员情报页，支持中文和英文姓名。手机隐藏全局搜索，在球员情报页使用已有搜索；结果选择、清空、排序、空结果和数据不可用状态沿用真实组件。
- **Actions / Fields:** 红色纸墨承担主要操作，浅纸承担输入与次要控件；认证按钮悬停变深红。保留禁用、加载、原生验证和焦点。纸面焦点深红，深底焦点暖色。
- **Home data:** MY TEAM 显示 /api/lineups 的最近保存阵容，并标注比赛日与保存时薪资；球衣图标表达位置，不暗示肖像。排名读取当前美东比赛日 /api/rankings，保留日期、缺统计和无比赛状态。比赛条使用 /api/nba/live 的既有加载、刷新、错误和不可用状态。
- **Cover:** Curry 是装饰封面，空 alt 与独立标签不能让它冒充已选球员；不将 demo 肖像绑定到真实阵容成员。
- **Lineup / Rankings:** 纸面球场、位置、预算、历史、日期筛选与展开行服务真实操作。排名只揭示已经开赛的球员，服务器继续决定身份、定价、锁定和保存结果。
- **Empty / Auth:** 预测首发保持未接入数据源的空状态；登录与注册使用真实表单，错误与下一步保持可读。

无损 WebP 对应的 `public/retro/*.webp.json` 记录来源与转换信息。参考世界见 `demos/retro-courtside/DESIGN.md`、`outputs/retro-sidebar/desktop.jpg`。八类正式组件页面的桌面/手机证据位于 `outputs/retro-release-review/*-{desktop,mobile}.jpg`；受保护页面预览使用明确标识的隔离 fixture，登录/注册来自实际 Next 构建。完成阶段报告类型检查、37 项测试、构建及独立视觉审查通过；这些不等于生产认证、数据库写入或部署已验证。

## Do's and Don'ts

### Do:

- Do 在所有页面和手机视图使用重度磨损红蓝旧墨与奶油纸。
- Do 保持中文可读、原生控件、可见焦点和减少动态效果支持。
- Do 标注保存快照、比赛日、缺失数据与未开放能力。
- Do 保留每份交付栅格的来源记录与字体许可。

### Don't:

- Don't 将旧黑橙或绿金文件当作当前视觉权威。
- Don't 把 demo 数据、自动填充、拖拽或内存保存描述成正式版能力。
- Don't 将封面人物当作用户阵容成员，或为真实球员伪造肖像对应。
- Don't 用视觉预览或构建通过暗示生产写入、认证和部署已验证。
