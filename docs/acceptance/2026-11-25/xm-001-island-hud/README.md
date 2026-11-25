# XM-001 鼓浪屿竖屏地名与罗盘复验

**通过。** 2026-11-25 17:39:23（北京时间）将竖屏 HUD 修订和鼓浪屿整合内容发布至[正常起飞大厅 5187](http://127.0.0.1:5187/)。从大厅起飞后，经航线图逐个进入景点。三种视口均实际加载首页脚本 `index-BeKlH6Y1.js`、游戏分块 `game-C98ZEVWr.js` 和鼓浪屿场景分块 `sunlight-layout-qT5a4tSe.js`，均返回 HTTP 200。游戏分块 SHA-256 为 `66cc11e0720c017b22cc1b2949131654956a58696a65478d2cd281c6ec4377d1`。[正式发布指纹](release.json) · [浏览器运行记录](result.ndjson)

| 景点与预期地名 | 390×844 触摸视口 | 430×800 触摸视口 | 1120×680 桌面 |
| --- | --- | --- | --- |
| `garden-bridge` · 四十四桥与渡月亭 | [通过](390-garden-bridge.png) | [通过](430-garden-bridge.png) | [通过](1120-garden-bridge.png) |
| `bishan-lane` · 笔山路 · 坡巷街口 | [通过](390-bishan-lane.png) | [通过](430-bishan-lane.png) | [通过](1120-bishan-lane.png) |
| `sanqiutian` · 三丘田码头 | [通过](390-sanqiutian.png) | [通过](430-sanqiutian.png) | [通过](1120-sanqiutian.png) |

9 组均显示完整地名。两种竖屏中，第二行罗盘顶边与地名文字底边相距约 25.7 CSS px。桌面地名、罗盘和天气／暂停控件横向分开。各组均在视口内显示底部操作栏，实际点按「返回飞行」后回到高崎机场跑道准备，显示手动驾驶。记录中没有失败请求。窄屏使用浏览器触摸视口，实际手机和其他尺寸未覆盖。[修前 390×844 菽庄截图](../xm-008-integrated/site-narrow-garden-bridge.png) · [同入口修后](390-garden-bridge.png)

地形、建筑、街道与海岸的四个资源文件和三维场景分块与上一轮发布一致。XM-004、XM-008、XM-009 的三维结论、实际覆盖与限制沿用[上一轮三维分项验收及六个原位对照](../xm-008-integrated/README.md#六个原位前后与海上进巷)。

截图与运行数据落盘后，已等待 `await task.finish({ keep: [] })`。自建 Space 69 返回 `closedSpace: true`，再次查询列表已无 69。[关闭回执与复查](space-finish.json)
