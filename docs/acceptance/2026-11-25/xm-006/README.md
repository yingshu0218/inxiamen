# XM-006 · 厦门航空产业园（高崎园区）

实景资料基准日为 2026 年 11 月 25 日。模型覆盖湖里区高崎机场东南侧、枋钟路北侧的艾德楼群和厦门国际航材中心。省投资促进网列出艾德航空工业园 1.46 万平方米、艾德航空产业园 3.19 万平方米及厦门国际航材中心 2.58 万平方米。项目范围按三处园区核对，游戏铺装线按影像描绘，宗地红线待核。[福建投资促进网](https://fdi.swt.fujian.gov.cn/projects-show-25286.html)

## 游戏入口

在正式构建打开航线图，进入「高崎机场观景机位」。也可以用同一游戏地址加下列参数直接打开。

| 机位 | 地址参数 | 开发截图 | 观察要点 |
| --- | --- | --- | --- |
| 总览，550 米 | `?tour=gaoqi-industry` | [总览](gaoqi-industry.png) | 南侧枋钟路、两组楼群、机场机库及 T4 的相对位置 |
| 艾德楼群，190 米 | `?tour=gaoqi-industry-ed` | [艾德楼群](gaoqi-industry-ed.png) | 两排平行厂房、错向的临街配套、内部车道与屋顶设备 |
| 国际航材中心，125 米 | `?tour=gaoqi-industry-materials` | [国际航材中心](gaoqi-industry-materials.png) | 两座方整楼和玻璃办公体量围合前庭，窗格与屋顶边线 |

三处均通过航线图进入，显示相应地点与自由移动状态。[开发实机记录](development-views.json)包含三次取景。截图后离线移除了航材中心车道边一株估绘树。开发浏览器 Space 41 已关闭。返回飞行、手机取景、帧率及最新共享构建的独立验收由 XM-011 合批复核。

## 现状依据

[三处取样点的影像采集元数据](imagery-metadata.json)记录影像服务原始返回和复查地址。

| 范围 | 可核时间和证据 | 游戏处理与估算 |
| --- | --- | --- |
| 三处楼群、枋钟路、园区临机场一侧道路 | Esri World Imagery 的高分辨率图层查询，Vantor Vivid Advanced，原始采集日 **2025-02-11**，分辨率 0.34 米，公开定位精度 8.47 米。覆盖精修建筑与周边路口。资料服务版本为 Raster Basemaps 2026.R01。 [影像采集日查询方法](https://support.esri.com/en-us/knowledge-base/how-to-view-the-world-imagery-basemap-metadata-in-arcgi-000018129) · [影像服务](https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer) | 对照正射影像和项目普通建筑轮廓，保留全体主楼平面、方向和楼间隔。地面仅绘制园内庭院和连接车道，公共车道沿用城市道路数据。 |
| 艾德航空工业园 | 汉印公开地址确认高崎南十二路 8 至 10 号楼。**2026-11-23** 货梯更新采购确认既有建筑设施，范围为 3 台货梯。8 号楼地图定位用于核对组团。 [入驻单位地址](https://www.hprtec.com/about-us/) · [8 号楼定位](https://xm.city8.com/enterprise/8a393072bn6jbb456f_address) · [采购公告镜像](https://www.yfbzb.com/inviteBid/detail/20261123_650239407.html) | 做出厂房列、临街配套和院内进出关系。精修的楼高、屋顶设备和门窗节奏属估绘。 |
| 艾德航空产业园 | 省商务厅记录该园区 **2022-01-11** 前已有办公孵化场所。园方 **2026-09-04** 招商列 A 型研发楼 A1、A2 栋及楼层，**2026-10-19** 有后续招商批次。园区数据库地图点用于辅助定位。 [省商务厅](https://swt.fujian.gov.cn/xxgk/jgzn/jgcs/zmsyq/zmzhc_tpxw/202201/t20220111_5812711.htm) · [9 月招商公告镜像](https://yfbzb.com/inviteBid/detail/20260904_628401912.html) · [10 月招商公告镜像](https://yfbzb.com/inviteBid/detail/20261019_639559013.html) · [园区地图点](https://y.qianzhan.com/yuanqu/item/99d49e276a4ac364.html) | 两处艾德园区共用一个近景。楼号与部分宗地分界待园方总图确认，游戏保留沿街实建轮廓，并以通用厂房、研发办公和配套的体量表现。 |
| 厦门国际航材中心 | 高崎南七路 18 号。省投资促进网列 A 航材仓、B 航空部件维修车间、C 创新协同中心。**2021-03-29** 航材保税物流启动，**2023-05-24** B 栋豪富太古设施启用，**2026-09-29** 省商务厅报道中心内服务驿站近日启用。现场照片刊于 **2021-05-19**，展示石牌、办公玻璃和两侧窗格，原始拍摄日未核。 [区位和用途](https://fdi.swt.fujian.gov.cn/projects-show-23006.html) · [航材保税物流](https://swt.fujian.gov.cn/zgfjzmsyqzq/zwdt/rdgz/202211/t20221118_6954900.htm) · [B 栋位置](https://www.fjdaily.com/app/content/2022-05/20/content_1451537.html) · [B 栋启用](https://k.sina.com.cn/article_1003816574_3bd5067e001015vgo.html) · [服务驿站记录](https://swt.fujian.gov.cn/zgfjzmsyqzq/zwdt/mtbd/202609/t20260928_7218852.htm) · [现场照片与项目示意](https://bbs.jying.cn/thread-222164-1-1.html) | 对照影像和现场照片建两座窗格楼、玻璃办公楼、前庭和石牌。A、B 的单体标号未写入模型。建筑高度、女儿墙、设备和铺装细节为估绘。 |

厦门国际航材中心新增屋顶光伏于 2026-09-30 招标，2026-11-13 公布中标结果。基准日前未找到完工或并网验收记录，模型采用可验证的屋顶时相。[业主招标](https://www.xmztb.com/freecms/site/wxpt/ggxx/info/2026/ff808081a0ef9c6801a0f142c36d0f41.html) · [中标结果镜像](https://www.yfbzb.com/winbid/detail/20261113_647621368.html)

## 构建和去重

- `airport-industry-layout.js` 存 14 个与普通建筑库一致的基底，其中 9 个是艾德楼群细化体量、3 个是航材中心、2 个是邻接配套街廓。核查窗口约为游戏坐标 X 1393–1903、Z −6862 至 −6572。
- 生产 `city-layout.bin` 解码共 31,221 条建筑记录，去重规则命中 14 条，对应 14 个替换基底。地理交集核查中，新楼彼此、与邻近保留普通建筑、与既有机场手工机库的相交面积均为 0 平方米。四条院内车道与新模型建筑也无面积交叠。
- `npm run build` 通过。Vite 报告部分分块超过默认 500 kB 提示阈值。[构建与去重复核记录](production-check.json)
