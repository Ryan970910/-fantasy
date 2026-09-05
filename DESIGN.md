---
name: 梦幻篮球
description: 深绿球场中的比赛日阵容工作台
colors:
  bg: "#101c1b"
  surface: "#192a27"
  raised: "#233731"
  line: "#364a42"
  text: "#f0f2e9"
  muted: "#afbeb4"
  accent: "#d9be83"
  ink: "#17231e"
  danger: "#f0a49a"
typography:
  headline:
    fontFamily: "'Segoe UI', 'Microsoft YaHei', 'PingFang SC', sans-serif"
    fontSize: "clamp(28px, 3.5vw, 44px)"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-.025em"
  body:
    fontFamily: "'Segoe UI', 'Microsoft YaHei', 'PingFang SC', sans-serif"
    fontSize: "14px"
    lineHeight: 1.6
  label:
    fontSize: "12px"
rounded:
  control: "8px"
  surface: "12px"
  panel: "16px"
spacing:
  compact: "8px"
  small: "12px"
  medium: "16px"
  section: "24px"
  large: "32px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "10px 20px"
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
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.surface}"
    padding: "32px"
---

# Design System: 梦幻篮球

## Overview

**Creative North Star: "Courtside roster desk / 场边阵容工作台"**

深绿背景、低饱和金色和象牙白文字构成安静、清楚的选人环境。球场与武侠线索通过中文语气、位置编排和有节制的强调表达；界面以阵容、数据和操作为中心。登录、注册和受保护页面共享同一套视觉语言。

**Key Characteristics:**

- 横向分组与清晰分隔线，兼顾桌面比较和手机操作。
- 金色标记主要操作、选择与关键数字；辅助说明保持低层级。
- 系统中文无衬线字体、Lucide 图标和原生表单控件；无栅格插画资产。

本文件记录已实现的前端，不承诺数据来源或后端能力。2026-09-05 finish review 的交付结论为 `ship`，无重大遗留发现；14 张修正后截图位于 `outputs/ui-review/`（七个页面各桌面/手机，使用 `*-v2.png`，阵容桌面使用 `lineup-desktop-v3.png`）。受保护页面证据来自 mock UI；登录与注册来自实际应用。该范围不等于生产登录、数据库写入或部署验证。

## Colors

### Primary

`accent` 是柔和金色，用于主要按钮、选中位置、导航下划线和重要金额；`ink` 是金色实底上的深色文字。

### Neutral

`bg` 是全局深绿底；`surface` 承载模块、表单和底部操作区；`raised` 表示选中或展开层级。`line` 组织行与边界。`text` 用于标题和正文，`muted` 用于解释、对手和统计标签。

错误、超预算与下降指标使用 `danger`，同时保留文字、符号或状态说明。**状态有文字规则：** 不让颜色成为唯一的状态信号。

## Typography

同一系统字体栈服务标题、正文和控件；没有外载展示字体。标题紧凑，中文正文保留充足行距。主标题使用前述 headline；手机主标题为（29px）。认证引导标题使用（36–58px）响应字号，手机为（36px）。模块标题通常为（23–28px），正文为（14px），次要标签为（11–12px）。

比分、身价和指标使用等宽数字 `tabular-nums`。说明文本通常限制在（65ch）以内。长球员名允许换行；手机位置槽位中的姓名采用紧凑两行高度，完整姓名在球员列表中显示。

## Layout

常规内容居中，最大宽度（1120px），桌面左右至少（24px）、上下（64px）；手机左右（20px）、上下（36px）。首页模块为（1.55:1）双列，手机叠为单列；这是一页的组合方式，不是所有页面的模板。

顶栏桌面高至少（76px）；手机变成品牌/退出与三项导航两行，高至少（116px）。认证页最大宽度（1100px），桌面为（1.15:1）双列，手机上下排列并隐藏装饰性位置行。

阵容编辑最大宽度（1280px），占据顶栏以外的动态视口。桌面位置栏宽（320px），中等屏为（260px），超宽屏为（360px）。球员列表独立滚动，预算操作区保持可见。手机位置栏变成五列，搜索独占一行，筛选/排序各占半行；操作区计入 `safe-area-inset-bottom`，金额与按钮分为两行。

断点为：最大（1000px）调整密度；最大（700px）切换手机结构；最大（370px）压缩导航与指标间距；最小（1600px）加宽位置栏。历史卡片桌面双列、手机单列；展开后的球员信息在手机纵向排列。

## Elevation & Depth

页面主要依靠底色层级和细线分组，不给普通模块堆叠阴影。预算提示对话框使用深色遮罩和单一阴影（`0 20px 60px rgb(5 13 10 / 35%)`），表达真正的临时覆盖层。

## Shapes

控件为轻圆角，模块为中等圆角，认证面板和弹窗为较大圆角，值见 frontmatter。球员列表与情报行保持平直分隔；状态选择标记为小圆角矩形，不把每一项都做成悬浮卡片。图标主要为（20px），导航与辅助图标略小。

## Components

### Buttons

主要动作使用金底深字，通常至少（46px）高；次要操作使用表面色或透明底和细边框，阵容底部按钮至少（44px）高。禁用状态降低不透明度至（0.55），保留原生 `disabled`。悬停通过底色、文字或边框变化表达。

### Inputs / Fields

输入框使用深底和细线，通用最小高度（44px），认证输入框为（48px）。保留真实标签、邮箱/密码类型、自动填写与原生校验。搜索有可访问名称和清除按钮；球队与排序使用原生 `select`，历史日期使用原生 `input type="date"`。

### Navigation

三项导航始终显示：首页、我的阵容、赛前情报。当前页通过金色文字、下划线及 `aria-current="page"` 表达；情报子页归属赛前情报。手机导航均分三列。Lucide 图标配可见文字，装饰图标对辅助技术隐藏。

### Cards / Containers

首页入口是整块链接，悬停提高背景层级并强调边框。情报入口和球员情报优先用分隔行；球员情报用原生 `details` / `summary` 展开。预测首发以明确的暂无数据说明及位置占位呈现。

### Selection / Budget

位置槽位、球员行和选择标记共同表达选择；槽位和球员按钮使用 `aria-pressed`。金额与梦幻分保持可见，超预算辅以提示文字。已保存阵容提供当前/历史切换及展开状态；加载和提交消息使用状态区域。

### Focus / Motion

全局键盘焦点为金色（2px）轮廓，偏移（4px）。预算弹窗使用 `alertdialog` 语义。不要以此文档替代实际键盘与辅助技术测试。

模块状态、箭头和情报折叠指示使用（180ms）过渡。首页标题仅在允许动态效果时作（400ms）向上（8px）的进入动画。`prefers-reduced-motion: reduce` 下禁用动画与过渡。

## Do's and Don'ts

- **Do** 复用上述色值、中文字体栈、原生控件与 Lucide 图标。
- **Do** 在桌面和手机验证长姓名、选人滚动、底部预算、日期输入和空状态。
- **Do** 用文字说明加载、错误、锁定和缺少数据，并维持可见焦点。
- **Don't** 为普通列表添加层层卡片、额外阴影或装饰图片。
- **Don't** 隐藏手机端关键金额和提交操作，或用颜色独自传递状态。
- **Don't** 用样例数据或视觉完成度暗示预测首发、生产数据或后端流程已经验证。
