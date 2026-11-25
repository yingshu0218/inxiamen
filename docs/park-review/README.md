# 厦门三处公园航拍复查

本页保留首轮交付及实机截图。五缘湾现状场景已撤下维修前精细走线，原有截图和桥面采样仅用于追溯。[现状复核与历史坐标](bay-fude-and-maze.md#xm-010--五缘湾迷宫木栈道补证)

2026-11-25。本轮在环岛航线图的「城市地标」中加入三个总览、三个低空机位。每个机位都可点「返回飞行」。下列入口使用本地生产预览的早晨光照。

| 园区 | 布局与近景 | 桌面实机图 |
|---|---|---|
| 思明 · 中山公园 | [湖岛总览](http://127.0.0.1:5269/?tour=zhongshan-park&time=morning) · [南门](http://127.0.0.1:5269/?tour=zhongshan-gate&time=morning) | [全园](zhongshan-park.jpg) · [三连拱](zhongshan-gate.jpg) |
| 湖里 · 五缘湾湿地公园 | [内湾与天鹅湖](http://127.0.0.1:5269/?tour=wuyuan-wetland&time=morning) · [迷宫湿地](http://127.0.0.1:5269/?tour=wuyuan-maze&time=morning) | [沿湾总览](wuyuan-wetland.jpg) · [历史桥面截图](wuyuan-maze.jpg) |
| 集美 · 厦门园林博览苑 | [四岛总览](http://127.0.0.1:5269/?tour=garden-expo&time=morning) · [闽台岛杏林阁](http://127.0.0.1:5269/?tour=xinglin-tower&time=morning) | [杏林湾四岛](garden-expo.jpg) · [杏林阁](xinglin-tower.jpg) |

## 现有覆盖与本轮取材

三个园区均使用游戏已有的米制坐标。原点为 WGS84 东经 118.125°、北纬 24.48°，向东、向南分别为正 X、正 Z。道路、岛岸及水面取自 OpenStreetMap。用 Esri World Imagery 的正射底图对照水岸走势、木栈道所在水塘及树冠密集区；按园界剔除水体、建筑和步道后采样绿植。图上可辨的植被分布用于安排树群，单株树位、树高与品种均为场景近似。园区数据收在 `src/parks/`。地图派生数据来源为 © OpenStreetMap contributors，采用 ODbL。[地图许可](https://www.openstreetmap.org/copyright) · [影像服务及署名](https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer)

**中山公园。** 园界取自公园南路、公园西路、公园东路之间的 OSM 园地。游戏原有湖面记录含五个内环，水面与岛岸直接沿用。补入 40 段园内路径（含桥）、近岸细地形和树群，并降低了园内从影像推算过高的小楼。南门取地图入口节点，三处拱洞、层叠绿瓦檐、中央题额依照南门正面照片建模。门东侧的醒狮球位置用于核对园门方位。本轮精细建筑为南门。[园界](https://www.openstreetmap.org/way/167145870) · [带岛的园湖](https://www.openstreetmap.org/relation/3773014) · [南门定位](https://www.openstreetmap.org/node/12229929698) · [南门照片](https://commons.wikimedia.org/wiki/File:The_South_Gate_of_Zhongshan_Park,_Xiamen.jpg) · [福建省政府文物走访](https://www.fujian.gov.cn/zwgk/ztzl/sxzygwzxsgzx/sdjj/wvjj/202502/t20250218_6765254.htm)

**五缘湾湿地公园。** 游戏已有内湾海岸、天鹅湖与部分通用道路。新增湖西南侧迷宫湿地的独立水面、坡岸与木栈道。65 条栈道地图折线合计约 3.06 公里，其中约 3.04 公里落在湿地多边形内，其余为接岸段。四条相连园路按交接点过渡到桥面高度。现场公开资料区分天鹅湖与迷宫。2025 年末园方启动迷宫检测维修，本轮还原有影像及地图依据的格局，维修后的桥面构造和开放状态尚待核实。[公园园界](https://www.openstreetmap.org/way/605642361) · [天鹅湖](https://www.openstreetmap.org/relation/3615187) · [迷宫湿地](https://www.openstreetmap.org/way/1135069833) · [木栈道折线示例](https://www.openstreetmap.org/way/1135132834) · [厦门市人大公开答复](https://www.xmrd.gov.cn/rdlz/dbjygk/jyhfh/201504/t20150411_4886109.htm) · [维修公告报道](https://news.xmnn.cn/xmxw/202512/t20251223_384773.html)

**厦门园林博览苑。** 省水利厅的景区介绍确认园林博览苑位于集美杏林湾水库。游戏已有水域和多岛岸线。本轮覆盖主展岛、温泉岛、闽台岛、中华教育岛的已绘园路、邻接岛岸与连接桥，合计 114 段道路与桥段；**建筑精模集中在闽台岛杏林阁**。东侧其他岛群、园外道路及各展园的建筑细部不在本次精细范围。杏林阁使用地图点位及建筑轮廓，七级八面、红色柱廊、灰瓦与金色塔刹依设计单位照片建模。[福建省水利厅](https://slt.fujian.gov.cn/wzsy/slyw/202302/t20230213_6108289.htm) · [主展岛](https://www.openstreetmap.org/way/174247436) · [温泉岛](https://www.openstreetmap.org/way/174247171) · [闽台岛](https://www.openstreetmap.org/way/174247168) · [中华教育岛](https://www.openstreetmap.org/way/174246340) · [杏林阁点位](https://www.openstreetmap.org/node/6325812924) · [东南大学建筑研究所项目及照片](https://ria.seu.edu.cn/2019/0909/c25317a285402/page.htm)

五缘湾迷宫的维修后实体、形态与开放状态另有逐项补证。[XM-010 补证与复核入口](bay-fude-and-maze.md#xm-010--五缘湾迷宫木栈道补证)

## 高程与估算

| 对象 | 游戏采用的尺寸或标高 | 依据与精度 |
|---|---|---|
| 中山公园湖、南门 | 湖面绘制高度 7.43 米；南门宽约 20 米、高约 14 米 | 湖面沿用原游戏高程。门楼外形比例按照片，柱径、拱顶、檐深和铺地均为估算。[南门尺寸记载](https://zh.wikipedia.org/wiki/厦门中山公园) |
| 迷宫木栈道 | 水面 3.13 米、桥面 4.25 米、宽约 1.85 米，栏顶高出桥面约 0.9 米 | 以邻近天鹅湖的游戏水位作为浅湿地估值；游戏中净空 1.12 米。现场会随水情变化。板缝与栏柱为近景表现，间距近似。 |
| 杏林阁 | 基座至塔刹 56.8 米 | 总高据公开报道，分层高度、出檐、基座和装饰近似。岛际桥梁依据地图中心线连接地形，桥宽、拱度与构造作了简化。[高度资料](https://www.hxnews.com/news/fj/mn/xm/201707/24/1265164.shtml) |
| 植被与园内配楼 | 新增树群使用 6–12 米冠幅/树高尺度；中山公园和园博苑估高配楼分别限高 8.4 米和 13 米 | 根据航拍中相对树冠的体量进行场景估算。保留地图或已公布来源的原建筑高度。 |

## 实机与几何检查

- 桌面 Chrome，1440 × 900。生产预览中，从正常航线图依次选择六个观景位，检查地点名、取景与低空模型，再点击返回飞行。每次均恢复飞行操作。园博苑总览据首轮截图从云层降至 578 米。
- 手机视口，390 × 844，启用触摸与移动布局。在同一生产预览中，从航线图选择三个总览并逐一返回飞行。这一项为桌面 Chrome 的手机视口复测。[中山公园](zhongshan-park-mobile.jpg) · [五缘湾](wuyuan-wetland-mobile.jpg) · [园博苑](garden-expo-mobile.jpg)
- 按 2 米间隔用运行时地形采样桥面中心线。中山公园 110 点、迷宫 1,563 点、园博苑 764 点均高于所在三角地表。迷宫有 1,547 个样点在湿地水面上，桥面到水面的高度均为 1.12 米。
- 沿四岛 OSM 岸线每 10 米抽取一点，取游戏已有岸线距离栅格的绝对值。各岛中位数为 2–4 米，95 分位均为 6 米，最大 8 米。此项衡量两套底图数据间的吻合度。
- 生产构建通过。Vite 提示两个公共资源块超过 500 kB。页面运行无异常。一次手机视口回归记录了 Chromium 音频设备错误，当次三个选点和返回均通过；用同一生产预览重新运行手机流程，三项再次通过，控制台错误数为零。
