# 鹭岛飞行

乘厦门航空波音 787-9 从云上飞抵高崎机场，也可以驾驶轻型飞机，从高崎出发环岛观光。太阳按厦门纬度和当天日期移动。客机默认午后进场，轻型飞机默认在当地日落前 45 分钟起飞。

## 开始游玩

macOS 双击同目录的 **开始飞行.command**，浏览器会打开游戏。已打包的版本位于 `dist/`。飞机、地图、光照和音效均在本机运行，游戏过程中可离线使用。

### 厦航 787 云上进场

选择 **厦航 787 云上进场**，从厦门西北约 3,000 米高度开始下降。客机沿 ENVEN-8X 进场程序末段，经杏林台、海沧和九龙江口转向高崎 05 跑道，沿约 3° 下滑道进近、拉平、接地，再经滑行道进入机坪停稳。全程约 67 公里，正常速度约 13 分 20 秒。空中航迹依据 2026 年 3 月生效的航图，转弯、地面路线和停车位按游戏场景模拟。[05 跑道进场图](https://chart.wuhanqing.cn/Terminal/ZSAM-%E5%8E%A6%E9%97%A8%E9%AB%98%E5%B4%8E/ZSAM-9C-STAR%20RNAV%20RWY05.pdf) · [05 跑道进近图](https://chart.wuhanqing.cn/Terminal/ZSAM-%E5%8E%A6%E9%97%A8%E9%AB%98%E5%B4%8E/ZSAM-20A-IAC%20RNAV%20ILS-DME%20z%20RWY05.pdf)

按 **C** 或点「视角」切换机外跟拍、右窗、左窗和稳定航拍。杏林附近从左窗看厦门本岛，海沧湾最后进近从右窗看西港和鼓浪屿。点「播放速度」切换 1×、2× 和 4×。按 **H** 隐藏仪表，按 **M** 可以直接选一段开始。

| 从哪里开始 | 默认视角 | 启动参数 |
| --- | --- | --- |
| 厦门西北云层上方 | 机外跟拍 | `?tour=787` |
| 杏林湾西侧，俯瞰厦门本岛 | 左侧舷窗 | `?tour=787-city` |
| 海沧湾，看西港与本岛 | 右侧舷窗 | `?tour=787-harbor` |
| 高崎 05 跑道短五边 | 机外跟拍 | `?tour=787-final` |
| 着陆滑跑末段至机坪停稳 | 侧面机外跟拍 | `?tour=787-taxi` |

机外跟拍可以绕机身拖动、滚轮拉近，观察厦航 B-7838 的驾驶舱风挡、风扇叶片、锯齿形发动机短舱和主轮转向架。模型取自 FlightGear 787-9，按波音公布的尺寸校准，配有按 B-7838 照片重绘的 4K 涂装。襟翼、前缘缝翼、扰流板、起落架舱门和反推套筒随飞行阶段动作。[波音机场规划资料](https://www.boeing.com/content/dam/boeing/v2/airports/acaps/787_Rev_P.pdf) · [B-7838 实机照片](https://www.jetphotos.com/photo/11950848)

发动机、反推和轮胎声取自 FlightGear 787 音效库，在游戏里按推力、速度和轮胎接地状态混音。主轮接地后先听到撞击和擦胎声，随后是反推和高速滚动声。前轮放下时有第二次较轻的撞击。驶离跑道后，推力随滑行加减速变化，低速时可以听到轮胎经过道面接缝。切换舷窗会削弱高频，客舱广播期间会自动降低飞机音量。[模型与音效上游](https://github.com/IskenderWang/787-family/tree/02626b5b659d89b9399943ee167bbb0b46f0c871) · [作者](public/aircraft/787/Authors.md) · [GPL 2 许可](public/aircraft/787/LICENSE) · [可编辑模型、原始贴图和转换脚本](public/aircraft/787/model-source.tar.xz)

厦航 787 的四段客舱音乐取自厦航使用过的曲目，游戏按沿途风景重新安排播放时机。广播为游戏编写，由普通话和英语合成语音依次播报。两声提示音响起后，音乐会降低音量，广播结束后恢复。[厦航客舱录音与曲目表](https://www.bilibili.com/video/BV1W3411v7mZ/)

| 飞行位置 | 客舱器乐选段 | 双语广播 |
| --- | --- | --- |
| 厦门西北云层上方 | DEPAPEPE《きっとまたいつか》（一定会再会），双吉他编配 | 开始下降，请回座系好安全带 |
| 飞入杏林城区 | Paul de Senneville《假日时光》，钢琴 | 杏林湾观景，从左窗看厦门本岛 |
| 海沧湾最后进近 | 钟立民《鼓浪屿之波》，钢琴 | 着陆准备，请收好小桌板、调直椅背 |
| 高崎 05 跑道接地后 | 雷蕾《蓝天白鹭之歌》，钢琴 | 欢迎抵达厦门，请保持就座 |

首次打开直达链接时，点「开启客舱声音」。按 **Esc** 或点「暂停」可在「客舱声音」里选曲、单独关闭音乐或广播，也可以点「重听本段广播」回到飞行。跳转到其他航段会播放该段的广播。加速飞行时声音保持原速，停稳后的欢迎词会继续播完。

钢琴由 Alexander Holm 的 Yamaha C5 实录采样混音演奏，吉他用 Meta Steel Guitar 的分弦采样演奏。四首音乐均为游戏重新录制的器乐编配。离线生成的语音和音乐随游戏分发。[钢琴采样](https://sfzinstruments.github.io/pianos/salamander/) · [钢琴采样许可 CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) · [吉他采样 CC0](https://github.com/facebookincubator/Meta-open-sound/tree/main/systems/instruments/meta-steel-guitar) · [MeloTTS](https://github.com/myshell-ai/MeloTTS)

编配时参考了原曲的录音和公开谱例。[《きっとまたいつか》乐谱](https://www.at-elise.com/elise/JPDPRM01118/) · [《假日时光》录音](https://music.apple.com/fr/song/1452257988) · [《假日时光》钢琴谱](https://www.tan8.com/yuepu-112111.html) · [《鼓浪屿之波》简谱](https://www.jianpujia.com/jianpu/161548.html) · [《蓝天白鹭之歌》钢琴谱](https://www.tan8.com/yuepu-110628.html)

### 轻型飞机环岛观光

选择 **从高崎起飞** 可以手动滑跑、起飞和着陆。完整航线从五缘湾、东坪山飞向黄厝，经厦大建南楼群、南普陀寺和演武大桥进入老城。飞过中山路、轮渡码头和鹭江道后，绕鼓浪屿和海沧大桥，经白鹭洲公园、筼筜湖东段和厦门火车站返航。**空中观光** 从黄厝外海接入自动驾驶。

按 **M** 打开航线图，可以直接选景点。首次从以下机位进入时，默认从日落前开始。飞机自动驾驶，拖动就能环顾。滚轮可拉近细节，按 **P** 可接手驾驶。

| 机位 | 从空中可以看到 | 启动参数 |
| --- | --- | --- |
| 厦大建南楼群 | 上弦场的弧形看台、建南大会堂的柱廊和两翼红瓦校舍 | `?tour=campus` |
| 南普陀寺 | 从放生池和双塔一路望向山坡上的四座殿堂 | `?tour=temple` |
| 中山路 | 沿骑楼的山墙、商铺和露台望向海面，西端是弧形转角的鹭江宾馆 | `?tour=zhongshan` |
| 轮渡码头 | 从双层客轮上方看两座候船厅、登船桥和浮码头 | `?tour=ferry` |
| 鹭江道 | 沿海滨公园回望滨海大道、旧海关钟楼和鼓浪屿对岸 | `?tour=lujiang` |
| 白鹭洲公园 | 临湖步道通向白鹭女神，绕过雕像可以回望园内草地与筼筜湖岸 | `?tour=park` |
| 广电大楼 | 从筼筜湖看主楼斜顶、湖景倒影和演播裙楼 | `?tour=broadcast` |
| 广电前庭 | 低空掠过双碟天线、三弧雨棚和入口题名石 | `?tour=broadcast-gate` |
| 湖滨北路街景 | 沿环湖步道看广电中心公交站和滨北电信营业厅 | `?tour=hubin-frontage` |
| 厦门火车站 | 从南广场看白鹭展翅的屋盖、玻璃立面和红色站名 | `?tour=railway` |
| 铁路站场 | 从站房东侧俯瞰站台雨棚和进站动车 | `?tour=railway-yard` |
| 厦门高崎站 | 俯瞰国铁货运Ⅰ、Ⅱ场、进出站线与铁路北咽喉 | `?tour=gaoqi-railway` |
| 高崎站房侧 | 从中埔路一侧低空看旧站房、前院、雨棚和鹰厦铁路 | `?tour=gaoqi-railway-front` |
| 梧村街区 | 沿厦禾路俯瞰 BRT 火车站、北广场和沿街商厦 | `?tour=wucun` |

把参数加在游戏地址末尾即可直达，也可加 `&time=blue` 或 `&time=night` 选择蓝调时刻或夜景。用 `?tour=lake` 俯瞰筼筜湖东段，用 `?tour=mountain` 近看东坪山水库。

### 鼓浪屿全岛

用 `?tour=gulangyu` 从鹭江上空看全岛。点岩顶上方的「日光岩」可停在岩前看石阶。按 **M** 打开航线图，在「鼓浪屿」下切换机位，按 **F** 从自由视角返回飞行。

| 区域 | 近景 | 启动参数 |
| --- | --- | --- |
| 北岸与东岸 | 三丘田的五座登船廊桥、钢琴码头的双泊位与靠泊客轮 | `?tour=sanqiutian`、`?tour=piano-wharf` |
| 西岸 | 内厝澳的拱顶候船厅、双翼雨棚和岸边礁石 | `?tour=neicuoao` |
| 岛内街区 | 龙头路沿街店面、三一堂的红砖山墙、天主堂钟楼、海天堂构的五栋别墅 | `?tour=longtou`、`?tour=trinity`、`?tour=catholic`、`?tour=haitiantang` |
| 日光岩 | 从晨光下的分道石阶看岩顶圆台与球形避雷针，从侧面看立岩、卧岩之间的岩缝、短桥与弧形平台，也可登顶望鹭江或近看东壁三处题刻 | `?tour=rock`、`?tour=rock-profile`、`?tour=rock-lookout`、`?tour=rock-inscriptions` |
| 八卦楼 | 从鹭江看红穹顶和八角鼓座，近看海侧通高石柱、砖翼和上坡台阶 | `?tour=island`、`?tour=bagua-gallery` |
| 福建路 | 海天堂构对面是黄荣远堂。沿院内水池轴线看半圆门廊和楼顶退台 | `?tour=huangrongyuan`、`?tour=haitiantang` |
| 菽庄花园与皓月园 | 从南岸看四十四桥绕过礁石，近看半月形渡月亭和拱跨，往东可看覆鼎岩上的郑成功像 | `?tour=garden`、`?tour=garden-bridge`、`?tour=garden-shore`、`?tour=haoyue` |
| 内厝澳街坊 | 从屋顶低空看连续街坊，进入笔山洞西侧坡巷 | `?tour=neicuoao-roofs`、`?tour=bishan-lane` |

### 高崎机场机位

打开航线图（**M**），可从两条航线直接切到机场的自由取景机位。按 **F** 返回原飞行。

| 机位 | 可以看到 | 启动参数 |
| --- | --- | --- |
| 高崎 T3 航站楼 | 玻璃采光屋顶、长指廊、登机桥与塔台 | `?tour=gaoqi-t3` |
| 高崎 T4 航站楼 | 起翘的折脊屋顶、两侧登机口与停机坪 | `?tour=gaoqi-t4` |
| T3 园林广场 | 园林广场的波浪步道、花坛与航站楼前的接送道路 | `?tour=gaoqi-t3-plaza` |
| T4 停车场 | 地面停车场、分区车道、落客匝道和航站楼前的绿地 | `?tour=gaoqi-t4-parking` |
| 高崎跑道全景 | 05/23 跑道、平行滑行道与两座航站楼 | `?tour=gaoqi-runway` |

机场布局参考公开航拍和机场图。航站楼细部、停机与灯光按游戏画面重建。[机场资料与模型说明](public/scenery/credits.json)

### 演武大桥与星光海岸

在航线图「演武大桥」下选择「海上看弯桥」或「平台望双子塔」。海上机位可沿贴海主线看沙坡尾旁的成功大道匝道、演武路盘道，以及白城接岸。平台机位位于外侧展望台，面向世茂双子塔。直达参数为 `?tour=yanwu-sea` 和 `?tour=yanwu-platform`。

主桥沿现行地图的成对车道定位，保留白色鱼腹箱梁、椭圆柱墩和贴海低段。白城两道落地匝道接环岛南路的分幅车道。观景平台保留西、中、东三个步行口，中入口还原 2022 年启用的十二组星光门廊。模型标高、桥墩孔位、栏杆和灯光按工程资料、照片与游戏地形估算。 [来源与时相](public/scenery/credits.json)

### 自由移动与北岸桥堤

飞行时按 **F** 或点仪表栏的「自由移动」，从当前镜头接手。用 **WASD** 或方向键平移，**E / Q** 升降，拖动画面环顾，滚轮缩放取景。点「移速」切换 **1×、4×、12×**，按住 **Shift** 临时加速，按 **R** 回正取景。触屏用方向杆平移、＋/− 升降，拖动环顾，双指缩放。

按 **M** 打开航线图，点地图落位，或直接选择桥堤和城区机位。自由移动时飞机停在进入前的位置，时间与天气继续推进。再次按 **F** 或点「返回飞行」恢复原镜头和驾驶状态。从起飞大厅直达桥堤后，返回飞行会回到高崎跑道。

| 机位 | 从空中辨认 | 启动参数 |
| --- | --- | --- |
| 翔安大桥 | 湖里至翔安的双向八车道钢箱梁、预制桥墩与通航跨 | `?tour=xiangan` |
| 集美大桥 | 高崎机场北侧弯桥、六车道与中央双向 BRT | `?tour=jimei` |
| 厦门大桥 | 高崎至集美的低矮双幅、密排等跨桥墩 | `?tour=xiamen-bridge` |
| 高集海堤 | 石砌实体堤身、高崎和集美两处过水口、海堤路与地铁 1 号线 | `?tour=gaoji` |

每座桥堤下方还有题字近景。翔安大桥是林胤祺题写的白石红字牌，厦门大桥是高崎桥头公园的江泽民题字金字碑。集美大桥按 2008 年通车原碑复原题字和落款，近景设在集美端。高集海堤可查看高崎纪念碑上朱德手书的「移山填海」。场景按照片还原题字轮廓，夜间碑面光照是场景估算。四个机位也可通过 `?tour=xiangan-plaque`、`?tour=jimei-plaque`、`?tour=xiamen-bridge-plaque`、`?tour=gaoji-plaque` 直达。

桥线和进岸匝道取自 OpenStreetMap。厦门大桥位于海堤路东侧，地铁 1 号线桥面位于海堤路西侧。高集海堤的高崎、集美开口分别按 850 米和 210 米制作。场景里的桥面标高、局部桥墩和匝道高程、护坡轮廓及灯光按工程资料和实景照片估算。 [桥堤资料与模型说明](public/scenery/credits.json)

### 岛内地标机位

按 **M** 打开航线图，在环岛航线的「岛内地标」选择机位。用滚轮或双指缩放，按 **F** 返回飞行。

| 机位 | 可以看到 | 启动参数 |
| --- | --- | --- |
| 国际会展中心 | 主馆的椭圆形屋盖、两翼展厅和面海的弧形廊台 | `?tour=exhibition` |
| 海峡大剧院 | 闽南式三重挑檐、方柱长廊、玻璃幕墙和入口雨棚 | `?tour=theatre&time=night` |
| 文化艺术中心 | 体育路旁的图书馆、博物馆、科技馆、文化馆和张拉雨棚 | `?tour=culture` |
| 东渡客运码头 | 白色波形候船楼、登船廊桥、浮码头与靠泊客轮 | `?tour=dongdu` |
| 狐尾山气象台 | 海上明珠观光塔、球幕影院和气象台建筑 | `?tour=weather` |
| 人民会堂 | 朝向筼筜湖的玻璃门厅、双柱雨棚和弧形台阶 | `?tour=people-hall` |
| 厦门市政府 | 石材两翼、内凹玻璃幕墙和门廊 | `?tour=city-hall` |
| 厦门体育中心 | 田径场、看台、训练场和综合健身馆的双片屋顶 | `?tour=sports` |
| 厦门万象城 | 一期双塔与屋顶花园、二期陶红裙楼、湖滨南路上方的 L 形连廊 | `?tour=mixc` / `?tour=mixc-link` |
| 南湖公园 | 桃花岛、白色湖亭与连接东西园路的后埭溪钢桥 | `?tour=nanhu` / `?tour=nanhu-link` |
| 莲坂国贸大厦 | 沿厦禾路斜看银灰色塔楼、拱顶玻璃带和红色屋顶桁架 | `?tour=lianban-guomao` |
| 国贸大厦屋顶 | 俯看屋顶钢桁架、沿街裙楼与莲坂路口 | `?tour=lianban-guomao-top` |
| 厦门 SM 城市广场 | 一至四期、两条嘉禾路天桥、voco 酒店和 CHAO BLOCK 蓝色内街 | `?tour=sm-xiamen` / `?tour=sm-xiamen-top` / `?tour=sm-chao` / `?tour=sm-chao-walk` |
| 中华城 | 思明南路圆角骑楼、屋顶露台与台光街新街堂 | `?tour=zhonghua-city` / `?tour=zhonghua-city-top` |
| 东渡海上世界 | 面海商业屋顶、潮汐之眼和通向东渡客运码头的滨水线 | `?tour=sea-world` / `?tour=sea-world-top` |

地标按地图轮廓定位，主要立面和屋顶参照实景。已知的拍摄、验收和投用日期及各自覆盖范围记在建模资料中。 [地标建模资料](public/scenery/credits.json)

莲坂国贸大厦位于湖滨南路 388 号。主塔按地图轮廓落位，总高沿用 168 米。裙楼边缘、拱窗尺寸和屋顶桁架的杆件间距按实景照片与航片估算。 [国贸物业项目页](https://www.itgservice.com.cn/project_detail.aspx?projectid=31) · [主塔地图轮廓](https://www.openstreetmap.org/way/653053985) · [实景照片](https://www.sohu.com/a/833058248_120823584)

SM 一期、二期以嘉禾路为界，两期之间的天桥长 94 米。三期可见 2026 年 6 月 1 日启用的 voco 酒店，以及通往一期的第二条跨街天桥。四期可见 B 地块的三栋办公塔楼和 9 月 25 日开放的 CHAO BLOCK 首开区，北侧 4C 以在建用地呈现。 [一期至二期天桥](https://www.smsupermalls.cn/newsdisp.aspx?aid=9123) · [三期酒店开业](https://www.smsupermalls.cn/newsdisp.aspx?aid=15062) · [四期开街](https://www.smsupermalls.cn/newsdisp.aspx?aid=15138)

中华城沿思明南路还原南北商业体及圆角骑楼，台光街保留新街堂与前院。2026 年 10 月的运营资料覆盖地下商业焕新。海上世界沿岸布局参照地图，搭建 62 米轮体、32 个球形轿厢、屋顶露台和步行岸线，并与东渡客运码头衔接。 [中华城焕新记录](https://dzb.sunnews.cn/html/2026-11/04/content_842900.htm?div=-1) · [海上世界资料](https://swt.fujian.gov.cn/xxgk/jgzn/jgcs/zmsyq/zmzhc_tpxw/202607/t20260706_7172587.htm)

南湖公园按已投用状态补齐 20 米钢桥的桥台和两岸园径，园路接到湖光路北侧。万象城二期按 2026 年 5 月 29 日投用状态重做沿街裙楼，以 56 米主跨及 94.4 米总长对齐两期的三层落点。桥台坐标、园路局部线形、二期塔高及屋顶布置按地图和照片估算。 [南湖通道投用](https://www.fjdaily.com/app/content/2026-03/23/content_3981217.html) · [万象城二期开业](https://fdi.swt.fujian.gov.cn/show-30504.html) · [连廊竣工资料](https://www.zqbao.com.cn/news/16268.html)

从中山路、轮渡码头、鹭江道、广电大楼或厦门火车站及其近景直接进入时，飞机以四分之一速掠过景点。点 **航拍 0.25×** 可切到半速或原速。飞机离开这一段后恢复原速，按 **P** 手动驾驶也会立即恢复原速。地面的行人、车船、动车和天气照常变化。

选择 **夜航观光** 会在游戏时间 20:30 从演武大桥外海开始自动驾驶。飞行中点击右上角的时钟，就能切到日落前、蓝调时刻或厦门夜景。建筑和街道随天色点亮。深链接 `?tour=haicang&time=night` 直接进入西港航段，可看见海沧大桥的金色悬索、月白桥塔和水面倒影。灯饰和月相按观光效果设计。

| 操作 | 控制 |
| --- | --- |
| 加油门 / 减油门 | W / S |
| 抬头 / 低头，向左 / 右转弯 | ↑ / ↓，← / → |
| 跑道刹车 | 空格 |
| 自动驾驶 / 接手 | P |
| 机外跟拍、驾驶舱、稳定航拍 | C |
| 环顾、缩放、复位视角 | 拖动、滚轮、R 或双击 |
| 航线图、隐藏界面、暂停 | M、H、Esc |

手动起飞时按住 W 提高油门，空速达到约 90–95 km/h 后按住 ↑ 抬头。在进近时对准跑道，减小油门、平稳接地，按空格减速。自动驾驶可在跑道和空中接手。触屏提供方向杆、油门、刹车和双指缩放。

点击飞行画面右上角的天气与时间可调整光照、时钟倍率、晴空、晴间积云、海雾或阵雨。默认天气连续演变。低空积云顺风移动，云隙日光会投到地面、机翼和海面，高空有较薄的卷云。机外与座舱相机随飞机移动，稳定航拍模式保持选定的世界朝向。

### 厦门快速公交

按 **M** 打开航线图，展开「BRT 沿线站台」查看蓝色线路并选择站台机位。岛内场景包含第一码头至前埔枢纽全段，以及东芳山庄经县后、高崎机场到 T4 候机楼的分支，共 21 站。高架站设有拱形雨棚、楼梯和站名牌。第一码头用单向回环，T4 候机楼使用地面站台。

厦禾路高架采用带斜腹板的箱梁、花瓶形桥墩和支座。文灶、蔡塘设有换乘夹层和有盖梯道，火车站的采光顶跨过车道，两侧站台经梯道接入梧村步行桥。站台上可以近看弧形钢肋、玻璃护栏、盲道和中英文方向牌。[厦门 BRT 建设资料](https://www.chinautc.com/upload/accessorychinautc/pdf/2010699284260393.pdf) · [文灶站实景](https://ishare.ifeng.com/c/s/7nx72EEsMp5)

| 机位 | 启动参数 |
| --- | --- |
| 文灶 | `?tour=brt` |
| 文灶站台与公交近景 | `?tour=brt-platform&time=afternoon` |
| 文灶桥下与换乘夹层 | `?tour=brt-viaduct&time=afternoon` |
| 火车站 | `?tour=brt-railway` |
| 第一码头 | `?tour=brt-wharf` |
| 前埔枢纽 | `?tour=brt-qianpu` |
| T4 候机楼夜景 | `?tour=brt-t4&time=night` |

快 1、快 3 的 12 米单车和 18 米铰接车双向运行，进站减速、开门停靠后发车。车身参考厦门金龙电动公交车的蓝底涂装、绿字路牌和轮廓，铰接车的风琴罩随弯道弯折。集美大桥中央车道也使用这套车辆。车灯、站牌与雨棚灯随天色变化。局部构件尺寸、班距和折返按游戏场景制作。快 1 在本岛场景覆盖至 T4 候机楼。 [厦门机场交通资料](https://www.xiamenairport.com.cn/jcjt/jtzy-ldjc.aspx) · [厦门金龙车型资料](https://www.xmklm.com.cn/info/2081/38511.htm) · [线路与场景数据署名](public/scenery/credits.json)

## 运行与开发

使用支持 WebGL 2 的浏览器。开发环境使用 Node.js 22.12+ 与 npm。

```sh
npm ci
npm run dev
```

`npm run build` 生成静态站点。可用任意本地 HTTP 服务提供 `dist/`，也可以运行 `npm run preview`。

## 场景数据

厦门本岛使用 Copernicus GLO-30 卫星表面高程推算地形，以 25 米间距生成网格。73 处内陆水域按各自标高建模，保留湖岸和湖心岛。地表使用 2025 年 Sentinel-2 影像，路网和岸线来自 OpenStreetMap。Contains modified Copernicus Sentinel data 2025. © OpenStreetMap contributors · OpenMapTiles · OpenFreeMap。[地理数据来源与署名](public/geo/credits.json)

普通建筑由地图轮廓、CMAB 遥感屋面和 Overture 建筑数据融合而成。梧村—莲坂、中山路、湖里工业片区及厦门大桥集美岸已按街坊复核，优先保留院落、楼列、临街方向及铁路与公交用地。四批合计采用 1,541 个 Overture 轮廓。街区外仍含按地块与道路估算的远景楼。高度依次采用已匹配的公开资料、地图高度或层数、遥感估计；缺项按同类邻楼估算。窗户、阳台、屋面及夜间亮灯按观光尺度绘制。[各批范围、实拍对照与数据复建](docs/urban-review/README.md) · [当前统计](public/geo/city-layout.json) · [数据署名](public/geo/credits.json)

第二批在绿泉新村修正一栋被拆成三段的住宅；集美大桥乐海路两侧纳入九个住宅地块，翔安大桥滨海东大道互通东侧补入海屿原 D07 的八栋成组估绘塔楼。在航线图中分别从厦门站、集美大桥和翔安大桥的子机位进入。[第二批实拍、来源和帧耗](docs/urban-review/bridge-districts/README.md)

鼓浪屿使用 10 米间距的地形网格。环岛岸线、三个客运码头的位置、历史建筑轮廓和街巷走向来自 OpenStreetMap。街区依坡布置石砌基座、瓦屋面和外廊，龙头路沿街设有店面和遮阳篷。码头与历史建筑的外观参考厦门轮渡和世界遗产申报资料，住宅立面、植栽、船只停靠与夜灯按观光尺度推定。[地标与景观来源](public/scenery/credits.json)

老城航段按地图铺设了约 1.2 公里的中山路、鹭江道滨水段的双向车道和约 1.65 公里的岸线。临街骑楼在巷口留出通道，鹭江宾馆、旧海关大楼、候船楼、浮码头和四座登船桥按地图轮廓定位。132 栋骑楼的立面、店招、客轮涂装和夜间照明按观光视距重建。钟楼的四面指针显示游戏内厦门时间。[中山路街史](https://xm.fjdsfzw.org.cn/2024-12-27/content_152978.html) · [鹭江道街史与照片](https://xm.fjdsfzw.org.cn/2024-11-13/content_152911.html) · [厦门轮渡码头资料](https://www.xmferry.com/mtjjt/shmldmt/mtjj/index.htm)

广电大楼位于湖滨北路北侧。临湖玻璃立面按照片中的窗格比例分成 24 格，沿斜线收顶，上层幕墙向后退约 7.5 米。入口一侧的石墙沿楼身向后延伸，每个标准层排七列凹窗。机房的四扇小窗、斜撑开口和屋顶天线按不同角度的实景照片定位，屋面进深和背立面为估算。幕墙反射附近湖岸、周边建筑和当前天气的天空，办公室窗灯随入夜亮起。[建筑轮廓](https://www.openstreetmap.org/way/539711834) · [主楼与天线照片](https://commons.wikimedia.org/wiki/File:Xiamen_Media_Group_headquarters.jpg) · [入口及侧立面照片](https://www.qibenlaw.cn/index.php?c=show&id=120)

按 **M** 打开航线图，在「广电大楼」下可直接选择「广电前庭」和「湖滨北路街景」。广电中心双向车站沿主路布置，公交减速停靠，环湖步道经绿带小径接到人行桥。滨北电信营业厅沿地图轮廓重建，立面参照营业厅现场照片。窗灯、植栽、转播车停放位置和公交运行节奏按游览体验设计。[滨北营业厅外观](https://fj.sina.com.cn/news/b/2020-05-01/detail-iirczymi9376852.shtml) · [滨北手机城开业报道](https://www.xmnn.cn/xxpd/xxlb/202512/t20251205_381698.html)

厦门火车站位于思明区梧村。南北广场、5 座站台和 9 条到发线以地图定位，双侧波浪檐口、站名和屋顶采光带参考实景。动车组外观、发车间隔和夜间照明按观光视距模拟。[站房地图](https://www.openstreetmap.org/way/164551392) · [南昌铁路站史](https://m.thepaper.cn/newsDetail_forward_3636591) · [南广场实景](https://commons.wikimedia.org/wiki/File:New_Xiamen_Railway_Station_South_Square.jpg)

在航线图的「厦门火车站」下选择「梧村街区」，可以看到禹悦汇、罗宾森广场、梧村汽车站和厦禾路上的快速公交。北广场一侧接湖滨东路，南广场一侧能看到双幅站南路、落客道路、绿化带和过街天桥。道路走向和主要地块以地图定位，部分建筑高度、车流和夜间灯光按航拍视距模拟。[禹悦汇项目资料](https://www.yuzhou-group.com/industry.aspx?id=336&type=21) · [BRT 实景](https://commons.wikimedia.org/wiki/File:Xiamen-BRT-Railway_station..JPG) · [南北广场交通组织](https://fjnews.fjsen.com/node_160285_2.htm)

天空摄影采用 Poly Haven 的 Industrial Sunset 02、Qwantani Dusk 2、Kloofendal 48d Partly Cloudy 纯天空全景（CC0）。封面使用 ImageGen 创作的厦门夕照航拍美术。飞行画面实时渲染。

在观光航线图选择 **环岛路 · 白城起飞**，可以从白城连续飞过曾厝垵、黄厝、椰风寨、会展和观音山，抵达五缘湾。其下有九个总览及低空复查机位。[分段范围、实景日期与落位图](docs/huandao-review/README.md)

### 重新生成城区数据

仓库已包含可直接游玩的离线资产。要重新生成城区，先安装 `tools/geo-requirements.txt` 中的 Python 依赖，然后运行以下命令。脚本会下载并缓存所需的厦门建筑数据、高程瓦片和地图数据。

```sh
uv run tools/prepare-urban-buildings.py --cache-dir /tmp/xm-urban-source
python tools/prepare-urban-hydrography.py --cache /tmp/xm-geo-cache
python tools/prepare-xiamen-relief.py --source /tmp/xm-urban-source/copernicus-n24e118.tif
python tools/prepare-city-layout.py --cache /tmp/xm-geo-cache --buildings /tmp/xm-urban-source/cmab-buildings.bin
uv run tools/prepare-district-buildings.py
python tools/prepare-old-town.py --cache /tmp/xm-old-town-map
python tools/prepare-hubin.py --cache /tmp/xm-hubin-map
python tools/prepare-wucun.py --map /tmp/xm-wucun-map/district.osm
python tools/prepare-night-lights.py --cache /tmp/xm-geo-cache
npm run build
```
