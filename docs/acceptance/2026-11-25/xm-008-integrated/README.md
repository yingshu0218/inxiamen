# XM-011 鼓浪屿整合独立验收

2026-11-25 16:15:20 的 `game-DKtNn0Dx.js` 完成六个原机位复拍、地形、地标、街坊和海岸独立实测。17:02:15 发布黄荣远堂机位修正的 `game-BflBCur6.js` 至[正常起飞大厅 5187](http://127.0.0.1:5187/)。最终游戏分块 SHA-256 为 `f018b0f987c17d59face2ca5e27aa75d1aa2504fa694e6c6b385b11eebf5f904`，桌面正常大厅和窄屏直达均实际加载该分块。首页和分块与本地构建一致，两个整合包的地形、街巷、建筑库及海岸资源逐字节相同。首次打开历史链接曾命中旧浏览器缓存，在本验证页关闭缓存并核对分块后重新取证。[首轮构建](release.json) · [最终构建](final-release.json) · [最终游戏实载](final-huang-runtime.json)

## 分项验收

17:39:23 的大厅正式包 `game-C98ZEVWr.js` 已通过 XM-001 地名与罗盘窄屏复验。本页保留对应构建的三维原始证据及修订前的窄屏现象。[最终大厅指纹、三种视口分项及回执](../xm-001-island-hud/README.md)

| 对话及项目 | 正常入口、独立实测及结果 | 限制 |
| --- | --- | --- |
| XM-004 岛形、山脊和岸坡 | `gulangyu`、`garden`、`haoyue`、`neicuoao`。旧全岛近同机位的岛形和地点相对格局保留。港仔后沙带较平缓并向山脚过渡，覆鼎岩台面和建筑坡脚可识别。内厝澳过渡、临岸码头和山坡住宅在所经视角可辨。**现有画面与路线通过。** [港仔后同点](shuzhuang-south.png) · [覆鼎岩](site-haoyue.png) · [码头起始帧](neicuoao-coast-start.png) | 局部断面数值属于游戏地形。2026-11-10 的 10 m 光学影像支持岸线总体走势、连续沙带与岬角，约 30 m 的 DSM 只支持相对起伏。现场潮位、滩坡、岩块和桥脚精确高程待证。 |
| XM-008 八卦楼 | `island` 与 `bagua-gallery`。海上可辨红穹顶及其与日光岩的相对位置，低空可辨鼓座、柱廊、两翼红褐门窗和入口台阶，进出正常。**通过。** [海侧斜视](bagua-north.png) · [柱廊](site-bagua-gallery.png) | 屋面与立面几何细尺仍为估绘。修缮后识别以 2024 重开、2026 定年远景为据。[实景时相与限制](../xm-008-sources/README.md) |
| XM-008 菽庄花园 | `garden-bridge`、`garden-shore`。正式大厅 M 菜单和午后原样直达均成功，HUD 显示「四十四桥与渡月亭」，触摸视口也能返回飞行。南岸俯视与近水视角可见连续桥面、桥墩、礁石、无顶渡月亭、西门屋段和两岸铺地。北侧用近景看临岸接入，南侧低空视线受园地树木与建筑遮挡，结合较高角度及生成网格复算落点。**入口和已见场景通过。** [大厅菜单](site-garden-bridge.png) · [原样直达](site-direct-garden-bridge.png) · [北岸近景](garden-north-landing.png) · [南岸视角](garden-south-join-visible.png) · [当前网格复算](heritage-recheck.json) | 早先的窄屏超时来自验收自动等待 HUD 小地图坐标，画面与返回按钮实际已显示。现场桥脚、水下岩石和通行尺度待证，未测完整逐步行走。 |
| XM-008 黄荣远堂及海天堂构街侧 | [原 URL](http://127.0.0.1:5187/?tour=huangrongyuan&time=morning)。`game-DKtNn0Dx.js` 旧眼点约 X −5751.6、Z 3795.2、海拔 26 m，转至约 230° 时树冠遮去大半幅。最终包桌面新点 X −5744.9、Z 3791.7、设计海拔 23.4 m，正视仍见门廊和双棕榈，原位转到 232° 可见福建路与对街翼楼、入口。390×844 触屏模拟经两次实际触摸拖动也可见入口。两次均返回高崎跑道。**原地回望复验通过。** [旧点遮挡](site-huang-to-haitian.png) · [最终正面](final-huang-desktop-front.png) · [最终桌面回望](final-huang-desktop-reverse.png) · [最终窄屏回望](final-huang-narrow-reverse.png) | 树冠仍部分遮住上部屋顶。现实中为两个分别列名的建筑与地块，黄荣远堂的前院、叠石属于其宅园。“邻园”无可核实的独立正式身份。具体株位、产权界、当日营运与室内未验。[来源核查](../xm-008-sources/README.md) |
| XM-008 日光岩及 HUD | `rock-profile` 和海上至山脊原位通过，主峰立岩、东南卧岩、阶道和山顶平台可辨。大厅选择 `island` 和 `sanqiutian` 分别显示「鼓浪屿」与「三丘田码头」，原 HUD 回归通过。[原位双岩](sunlight-south.png) · [侧景](site-rock-profile.png) · [鼓浪屿](site-island.png) · [三丘田](site-sanqiutian.png) | 裂隙、坡面形状和栏杆为模型近似。地形、地标相对轮廓可追溯到 2026-08-22 同框影像，照片于 10-31 发布。 |
| XM-009 内厝澳至笔山路 | `neicuoao-roofs`、`bishan-lane`。屋顶低空可辨红瓦双坡、四坡、灰平顶、错台与院落开口。从巷口按 W 实际推进约 21.6 m，HUD 海拔从 26 m 到 26 m，转看侧巷时看清近墙、铺地和墙基。本段未见楼体压路或墙脚悬空。两入口及返回通过，窄屏巷口可读。交付为 34 条旧记录重整后的 43 个屋面，浏览器视觉抽验采用局部街段。**交付范围通过。** [屋顶](site-neicuoao-roofs.png) · [入巷](site-bishan-lane-advanced.png) · [支巷](site-bishan-lane-side-branch.png) · [街巷交付时相](../../../urban-review/neicuoao/README.md) | 原位对照中 19–21 m 的旧居民巷取景位于新精修段以北，只能用于同一连续路线回归。新增南段的近空和入巷另有实拍。定年高分图为 2025-03-20，逐屋 2026 年增改建和实地道宽仍待证。 |

390×844 触摸视口串行抽查菽庄桥、黄荣远堂、笔山路及双岩，均可进入及返回。部分较长的景点名和顶部罗盘相邻或重叠，主画面和返回可用。实际手机性能及触控精度未测。[窄屏菽庄](site-narrow-garden-bridge.png) · [窄屏笔山路](site-narrow-bishan-lane.png) · [窄屏双岩](site-narrow-rock-profile.png) · [实际运行记录](entrances.ndjson)

## 六个原位前后与海上进巷

两版均从 `gulangyu&time=afternoon` 开始，1120×680。全岛站点位置完全相同，自定义机位与原点水平误差不超过 2.36 m，海拔误差不超过 2 m。相机连续从海上、八卦楼到日光岩南侧，再落到内厝澳居民巷，按实际 HUD 地图记录约 3.02 km、176 个采样点，无航点跳转。随后继续到菽庄南岸并返回原飞行。[机位和实际坐标](stops.ndjson) · [完整连续轨迹](continuous-camera.json)

| 机位 | `game-BILZYVRU.js` 制作前 | `game-DKtNn0Dx.js` 整合后 |
| --- | --- | --- |
| 全岛海上斜视 | [旧](../xm-008-baseline/island-overview.png) | [新](island-overview.png) |
| 八卦楼北斜视 | [旧](../xm-008-baseline/bagua-north.png) | [新](bagua-north.png) |
| 日光岩南侧 | [旧](../xm-008-baseline/sunlight-south.png) | [新](sunlight-south.png) |
| 内厝澳片区低空 | [旧](../xm-008-baseline/neicuoao-quarter.png) | [新](neicuoao-quarter.png) |
| 内厝澳居民巷 | [旧](../xm-008-baseline/neicuoao-lane.png) | [新](neicuoao-lane.png) |
| 菽庄花园南岸 | [旧](../xm-008-baseline/shuzhuang-south.png) | [新](shuzhuang-south.png) |

### 内厝澳海岸动态抽查

从 `neicuoao&time=afternoon` 的 35 m 机位开始，按静止、1–4 像素往返微转、短距侧移、升高取样，保留海浪、湿岸与码头相对运动。800×450 同条件录屏实际 81 帧、首尾 8.224 秒、9.7 帧/秒，低于旧基线 15.3 帧/秒。另以同机位 640×360 录屏达到 103 帧、首尾 4.306 秒、23.7 帧/秒，动画回调中位 33.4 ms、P95 50.1 ms。检查该较高采样的片段与抽帧，未见大面积整块突然亮灭，反光、波浪与细岸线仍可辨。此项为局部海岸动态抽验。高于录制带宽的瞬态、其他时段、其他 GPU 和真实潮位仍未覆盖。[制作前短片](../xm-008-baseline/neicuoao-coast.webm) · [同尺寸整合片](neicuoao-coast.webm) · [23.7 帧/秒短片](neicuoao-coast-640.webm) · [采样汇总](sampling-summary.json)

本次正式实测未见资源 HTTP 失败或应用脚本异常。Apple M5 的 16 纹理单元仍有 17、18 的请求告警。历史与定年资料独立核对见 [实景来源与范围](../xm-008-sources/README.md)。证据落盘后仅收尾自建的 Space 63，已等待 `await task.finish({ keep: [] })`，结果 `closedSpace: true`，列表再次查询无该 Space。[收尾回执](space-finish.json)
