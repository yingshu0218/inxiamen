# XM-011 最后一次正式构建验收

2026-11-25 **02:20:07（北京时间）** 从共享源码构建，**02:22:44** 发布到 [本机起飞大厅](http://127.0.0.1:5187/)。先同步资源，再切换首页，保留既有会话可能还会请求的旧哈希分块。HTTP 首页和构建逐字节一致，SHA-256 为 `8466362c7f5b0d35feb1fb6ceb605c191fcc1ec69ea7b5dbdc9f21ab0e85c3c1`。正式大厅点击「从高崎起飞」后加载 `index-DH9P2BEs.js` 和 `game-BILZYVRU.js`，游戏分块 SHA-256 为 `8d430bb110dc3384a6f66dfd0e5db936df51d99ad218c1aa605678e8d674352e`。13 项共 32 个验收用入口均在当前菜单出现。[发布回执](release.json) · [实际加载](normal-lobby.json) · [入口逐项核对](city-menu.json)

## XM-012 五缘大桥桥下及主桥

从正式大厅进入航线图「五缘湾 · 东路终点」，用自由镜头复拍。四个桥下机位海拔均为 26 m，平面偏差 0.46–2.68 m。旧包为 `game-C7qBMkZ3.js`。前三张旧图为上轮独立实拍，西岸外海方向旧图来自候选版的前后对照记录。最新包的四张均由 XM-011 从正常运行画面取得。[完整坐标与航向](stops.ndjson)

| 位置和航向 | 前后证据 | 独立复验 |
| --- | --- | --- |
| 东岸内湾，约 23° | [修订前](../rework-live/wuyuan-east-under-bay.png) · [正式包](wuyuan-east-under-bay.png) | 掉头线靠内湾一侧的弯段及连续边线可辨，近岸蓝道跨过原铺面缺口。 |
| 东岸外海，约 214° | [修订前](../rework-live/wuyuan-east-under-sea.png) · [正式包](wuyuan-east-under-sea.png) | 掉头线从另一侧显示连续进出，近侧蓝道和对岸折返段可接续辨认。 |
| 西岸内湾，约 11° | [修订前](../rework-live/wuyuan-west-cycle-bay.png) · [正式包](wuyuan-west-cycle-bay.png) | 蓝道在岸角转折连续，原露地间隙已消失。 |
| 西岸外海，约 197° | [修订前](../../../huandao-review/wuyuan-lower/wuyuan-before-west-cycle-sea.png) · [正式包](wuyuan-west-cycle-sea.png) | 反向可辨蓝道、桥下连续转弯、贴岸铺地和临水岸基。 |

三个曾低于地形的中心点按原坐标复算，东岸掉头道、东岸蓝道、西岸蓝道的对应铺面分别高于地形 **0.471、0.510、0.570 m**。189 m 复拍双幅主桥跨白色主拱接两岸，主桥衔接与返回飞行正常。桥面会从单侧遮住部分下层路段，连续性由相反方向的画面合看。**游戏范围通过。** [三处独立射线复算](wuyuan-surface-independent.json) · [双幅主桥与两岸](wuyuan-main-west.png) · [返回飞行及资源](bridge-runtime.json)

实际桥头位置、掉头和蓝道格局以 2025-01-19 定年原始影像为主要依据，2026-04 发布资料确认横三路已完工及沿线蓝道。2026-06-30 发布报道记录桥梁修复提升概算获批。竣工后铺面、现场净空、岸墙尺寸和夜间实际可见度待核实。[日期及覆盖范围](../../../huandao-review/wuyuan-lower/README.md) · [福建省交通运输厅横三路记录](https://jtyst.fujian.gov.cn/zwgk/jtyw/mtsy/202604/t20260429_7132749.htm) · [修复提升概算报道](https://news.xmnn.cn/xmxw/202606/t20260630_437175.html)

## XM-003 国铁高崎站前院

从正式大厅航线图选「高崎站房侧」。从停车区南侧 X −1513.0、Z −6676.8、海拔 40 m、20.2°，以及北侧 X −1512.2、Z −6731.8、海拔 34 m、158.0° 对照同方向旧图。南北取景显示小楼、东南楼组均保留，前院铺地绕开两处建筑，车位及划线可辨。另从中埔路看进场支路接入前院，并从 78 m 俯视核对两处铺地间隔。选点及返回飞行正常。**前院视觉及连接通过。** [南侧修订前](../supplemental-live/spatial-gaoqi-yard-south.png) · [南侧正式包](gaoqi-parking-south-matched.png) · [北侧修订前](../supplemental-live/spatial-gaoqi-parking-north.png) · [北侧正式包](gaoqi-parking-north.png) · [俯视](gaoqi-forecourt-top.png) · [支路与中埔路](gaoqi-driveway.png)

独立复算将当前铺地与旧轮次从城市数据识出的两栋完整轮廓相交测试，两处均无交叠，最近间隔为 **1.50 m** 和 **15.15 m**。14 个场景车位及其划线角点均在铺地内，支路与铺地相交，起点和 `dist` 的中埔路中心线共用端点。[独立轮廓及支路复算](rail-boundary-independent.json) · [站场运行与返回](rail-runtime.json)

两栋现实屋面和露天停车边缘来自 **2025-03-20** 定年原始影像。2026-01-29 铁路工可评审确认既有货站Ⅰ、Ⅱ场，福建省发改委于 2026-02-13 发布。旧站名牌是否仍在、前院产权和进出管理、实地车位数量、楼高及近期围挡具体位置仍待证。[站区及影像范围](../XM-003-gaoqi-railway.md#补验后的前院边界修订) · [省发改委铁路审查记录](https://fgw.fujian.gov.cn/ztzl/tljsbgs/fjstlfzqk/fjtljscg/202602/t20260213_7098341.htm)

## XM-004 三个防闪关键入口

800×450 窗口串行抽样。演武外海日落和东坪山午后执行静止、微转、平移、升降及缩放，787 午后海沧湾在右舷窗中实际自动飞行。三处各记录 **120、120、107** 次动画回调，中位间隔均约 **33.4 ms**，P95 分别为 **41.8、42.0、41.7 ms**。反光和海浪、远岸、东坪山地表道路、787 正常舷窗均可见。**最新包三个入口和动作抽验通过。** 本轮证据为动作前后画面与动画时间戳，频闪连续逐帧判定沿用先前已保存的实机视频，高频瞬态及树冠细边留在采样限制内。[最新运行与时间戳](p0-smoke.json) · [演武](p0-bridge-after.png) · [东坪山](p0-mountain-after.png) · [787 右舷窗](p0-787-harbor-after.png) · [原三段动态验收](../merged-live/README.md#xm-004-频闪-p0)

Apple M5、ANGLE Metal 的 16 个纹理单元仍触发 Three.js 的 17、18 个单元请求告警。实测未见资源失败、脚本异常或包围球 NaN。逐材质细节及其他硬件未测。白城至五缘湾的全程自动航线、海沧和高崎两处 HUD 复用上一正式包的独立记录。[全航线及 HUD](../rework-live/README.md) · [13 项总台账](../../README.md#本批-13-项与频闪结论)

自建 Space 60 在证据落盘后执行并等待 `await task.finish({ keep: [] })`，回执 `closedSpace: true`，再次查询已从列表消失。5187 正常起飞服务仍可用。[收尾回执](space-finish.json)
