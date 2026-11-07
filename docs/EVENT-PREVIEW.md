# 下一场赛事票券

`public/season.js` 的 `nextEventPreview` 渲染三栏票券，赛事字段来自 `/api/season`。起止日期、星期、跨月日期与状态由赛事数据计算，详情按钮沿用原有日历定位。

桌面端高度 276px，三栏比例为 30% / 19% / 51%。外圆角 18px；六层 CSS mask 取交集，左右边界各两个半径 13px 的半圆凹口，圆心位于高度 33.75% 和 71.25%（间距为原 40% / 65% 的 1.5 倍）。虚线上下两端另保留原有半径 18px 的凹槽，与虚线共用分隔位置变量。内部虚线位置保持不变；外层 shell 的 drop-shadow 沿真实透明轮廓生成。右侧无文字或 Logo，以斜向冰蓝渐变衔接照片，保留照片原本的蓝色。

`public/data/event-previews.json` 为素材替换接口：`_default` 配置通用图片，赛事 ID 对象可覆盖 `image`、`imageAlt`、`subtitle`。本地 JPG / PNG / WebP 放在 `public/assets/`，无图时显示深蓝渐变。

当前图片为用户本轮提供并选定的 B 图，原文件 codex-clipboard-08f72070-c33d-4c33-b1a6-3a0ff21c1604.png，原样复制为 public/assets/events/blue-skate-spray.png。该图片作为花滑主题配图使用，不标作官方宣传素材；未提供独立的作者或许可资料。
