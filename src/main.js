import { Vector3 } from 'three';
import { stations, tourStops, islandViews, sunlightView, crossingViews, airportViews, venueViews, nearbyStation, lightFlightPlace } from './route.js';
import { northInscriptionViews } from './north-inscription-layout.js';
import { summitLevel } from './sunlight-layout.js';
import { arrivalStops } from './airliner-arrival.js';
import { brtDetailViews, brtViews } from './brt-layout.js';
import { clockText, lightPresetMinute } from './atmosphere.js';
import { cameraNames } from './view.js';
import { FlightSound } from './sound.js';
import { cabinTracks } from './cabin-audio.js';
import { chartLabelAt, chartPoint, drawChart, drawCompass, hydrateIcons, icon } from './interface-art.js';

const byId = (id) => document.getElementById(id);
const gameRoot = byId('game'),
  lobby = byId('lobby'),
  hud = byId('hud'),
  sheet = byId('sheet');
const status = byId('load-status'),
  mini = byId('hud-chart').querySelector('canvas'),
  homeMap = byId('lobby-chart').querySelector('canvas'),
  chart = byId('chart'),
  brtDetails = byId('brt-views'),
  stick = byId('stick'),
  liftButtons = [...document.querySelectorAll('[data-thrust]')];
const sound = new FlightSound(),
  held = new Set(),
  touchCaptures = new Map(),
  touch = { pitch: 0, roll: 0, throttle: 0, brake: false };
const coarse = matchMedia('(pointer:coarse)');
const summitMarker = byId('summit-marker'), summitScreen = new Vector3();
const overview = islandViews.find(site => site.frameIsland === 'gulangyu');
summitMarker.onclick = () => chooseStation(sunlightView);
const allStops = [...tourStops, ...arrivalStops, ...crossingViews, ...northInscriptionViews, ...airportViews, ...venueViews, ...brtViews, ...brtDetailViews];
let chartAirliner = false;
let game,
  loadingGame,
  islands,
  inFlight = false,
  starting = false,
  activePanel = '',
  hiddenHud = false,
  hintTimer;
const reliefChart=new Image();
reliefChart.onload=renderCharts;
reliefChart.src='/geo/relief-chart.webp';
const regionalChart = new Image();
regionalChart.onload = renderCharts;
hydrateIcons();
const musicChoice = byId('cabin-music-choice');
for (const track of cabinTracks) musicChoice.add(new Option(track.title, track.file));
musicChoice.add(new Option('关闭音乐', 'off'));
syncSound();
function syncSound() {
  for (const el of document.querySelectorAll('.sound-toggle')) {
    el.querySelector('[data-icon]').innerHTML = icon(sound.enabled ? 'sound' : 'muted');
    el.setAttribute('aria-pressed', String(sound.enabled));
    el.setAttribute('aria-label', sound.enabled ? '关闭声音' : '开启声音');
    el.title = sound.enabled ? '关闭声音' : '开启声音';
    const cap = el.querySelector('.sound-caption');
    if (cap) cap.textContent = sound.enabled ? '声音已开启' : '声音已关闭';
  }
  musicChoice.value = sound.musicChoice;
  byId('cabin-speech').checked = sound.speechEnabled;
  byId('replay-speech').disabled = !sound.speechEnabled || !sound.enabled;
}
function renderCharts() {
  if (!islands) return;
  const exploring = !!(inFlight && game.rig.free.active);
  const free = exploring && game.rig.free;
  const viewer = exploring ? { x: free.position.x, z: free.position.z, heading: free.heading } : game?.flight;
  if (!inFlight) drawChart(homeMap, islands);
  if (inFlight && !hiddenHud) drawChart(mini, islands, viewer, false, null, !!viewer.airliner, exploring);
  if (activePanel === 'map') {
    const marker = inFlight && !!viewer.airliner === chartAirliner ? viewer : null;
    drawChart(chart, islands, marker, true, chartAirliner ? regionalChart : reliefChart, chartAirliner, exploring,
      !chartAirliner && brtDetails.open);
  }
}
function selectChart(airliner) {
  const exploring = !!(inFlight && game.rig.free.active);
  chartAirliner = !exploring && !!airliner;
  if (chartAirliner && !regionalChart.src) regionalChart.src = '/geo/arrival-coast.webp';
  byId('map-routes').hidden = exploring;
  byId('station-list').hidden = chartAirliner;
  byId('arrival-list').hidden = !chartAirliner;
  byId('crossing-views').hidden = chartAirliner;
  byId('venue-views').hidden = chartAirliner;
  brtDetails.hidden = chartAirliner;
  chart.classList.toggle('can-jump', exploring);
  chart.setAttribute('aria-label', chartAirliner ? '厦航 787 高崎 05 跑道进近航线图，向上为北' : '厦门环岛航线图，向上为北');
  byId('map-note').textContent = exploring
    ? '点地图前往任意位置，或选下方机位。飞机留在原处。'
    : chartAirliner ? '沿 ENVEN-8X 经杏林、海沧飞抵高崎 05 跑道。选择航段即可直接进入。'
      : '选择观景机位自由取景，或从环岛航线的一段开始飞行。';
  for (const button of byId('station-list').querySelectorAll('button'))
    button.setAttribute('aria-label', exploring || button.dataset.view ? '前往' + button.dataset.place : '从' + button.dataset.place + '开始');
  for (const b of byId('map-routes').children)
    b.setAttribute('aria-pressed', String((b.dataset.route === '787') === chartAirliner));
  renderCharts();
}
fetch('/geo/islands.json')
  .then((r) => (r.ok ? r.json() : null))
  .then((d) => {
    islands = d;
    renderCharts();
  })
  .catch(() => {});
new ResizeObserver(renderCharts).observe(gameRoot);
brtDetails.addEventListener('toggle', renderCharts);
function showHint(text, duration = 4100) {
  clearTimeout(hintTimer);
  const el = byId('hint');
  el.textContent = text;
  el.classList.add('show');
  hintTimer = setTimeout(() => el.classList.remove('show'), duration);
}
const phases = {
  runway: '跑道准备',
  climb: '离场爬升',
  tour: '沿海巡航',
  approach: '进近着陆',
  descent: '进场下降',
  flare: '拉平接地',
  rollout: '着陆滑跑',
  taxi: '机坪滑行',
  parked: '已停稳',
};
function updateHUD() {
  if (!game || !inFlight) return;
  const f = game.flight,
    w = game.atmosphere.state,
    free = game.rig.free,
    exploring = !!free.active;
  const caption = f.airliner && !exploring ? sound.cabinCaption : '';
  const captionEl = byId(activePanel === 'arrived' ? 'parked-caption' : 'cabin-track');
  if (captionEl.textContent !== caption) captionEl.textContent = caption;
  const needsAudio = !sound.enabled || sound.ctx?.state !== 'running';
  if (activePanel === 'arrived') {
    byId('parked-enable-audio').hidden = !needsAudio;
    byId('parked-mute').hidden = needsAudio;
    return;
  }
  const position = exploring ? free.position : f;
  const markSummit = exploring && free.name === overview.name && !hiddenHud;
  if (markSummit) {
    summitScreen.set(sunlightView.x,summitLevel+1,sunlightView.z).project(game.camera);
    const visible = Math.abs(summitScreen.x)<.90 && Math.abs(summitScreen.y)<.78 && Math.abs(summitScreen.z)<1;
    summitMarker.hidden = !visible;
    if (visible) {
      summitMarker.style.left = (50 + 50*summitScreen.x)+'%';
      summitMarker.style.top = (50 - 50*summitScreen.y)+'%';
    }
  } else summitMarker.hidden = true;
  const nearest = nearbyStation(position.x, position.z);
  const nearby = nearest.gap < 3000 ? nearest.station.name : '厦门近海';
  const place = exploring ? free.name ?? nearby : f.airliner ? f.place :
    lightFlightPlace(f, game.departurePlace, nearby);
  byId('location').textContent = place;
  byId('phase').textContent =
    exploring ? '自由移动 · 飞行已暂停' : f.airliner ? '厦航 787-9 · ' + phases[f.phase] :
      (f.assisted ? '飞行辅助' : phases[f.phase]) + ' · ' + (f.autopilot ? '自动驾驶' : '手动驾驶');
  byId('cabin-track').hidden = !caption;
  byId('enable-cabin-audio').hidden = exploring || !f.airliner || !needsAudio;
  byId('speed-name').textContent = exploring ? '移速' : f.grounded ? '地速' : '空速';
  byId('speed').textContent = Math.round((exploring ? free.speed : f.speed) * 3.6);
  byId('alt').textContent = Math.round(exploring ? free.position.y : f.altitude);
  byId('throttle').textContent = Math.round(f.throttle * 100);
  byId('touch-power').textContent = exploring ? free.rate + '×' : Math.round(f.throttle * 100) + '%';
  byId('clock').textContent = clockText(w.minute);
  byId('weather').textContent = w.weather;
  const lightIcon = byId('weather-button').querySelector('[data-icon]');
  const symbol = w.darkness > 0.72 ? 'moon' : 'sun';
  if (lightIcon.dataset.icon !== symbol) {
    lightIcon.dataset.icon = symbol;
    lightIcon.innerHTML = icon(symbol);
  }
  byId('autopilot').setAttribute('aria-pressed', String(f.autopilot));
  byId('autopilot').hidden = exploring || !!f.airliner;
  const rate=game.playbackRate;
  byId('play-rate').hidden = exploring || rate===null;
  if (rate!==null) byId('play-rate-label').textContent = (f.airliner?'播放 ':'航拍 ')+rate+'×';
  byId('camera-name').textContent = cameraNames[game.rig.mode];
  byId('camera').hidden = exploring;
  const explore = byId('explore');
  explore.setAttribute('aria-pressed', String(exploring));
  explore.title = exploring ? '返回飞行（F）' : '自由移动（F）';
  byId('explore-label').textContent = exploring ? '返回飞行' : '自由移动';
  byId('explore-rate').hidden = !exploring;
  byId('explore-rate-label').textContent = '移速 ' + free.rate + '×';
  const mobile = coarse.matches;
  const showStick = mobile && (exploring || !f.autopilot);
  gameRoot.classList.toggle('free-mode', exploring);
  gameRoot.classList.toggle('touch-mode', showStick);
  hud.querySelector('.touch-flight').hidden = !showStick;
  stick.setAttribute('aria-label', exploring ? '方向杆，平移相机' : '方向杆，上下俯仰、左右转弯');
  byId('touch-axis-name').textContent = exploring ? '升降' : '油门';
  liftButtons[0].setAttribute('aria-label', exploring ? '升高' : '加油门');
  liftButtons[1].setAttribute('aria-label', exploring ? '降低' : '减油门');
  byId('touch-brake').hidden = exploring || !f.grounded;
  if (!hiddenHud) {
    drawCompass(byId('compass'), exploring ? free.heading : f.heading);
    renderCharts();
  }
}
function updateInput() {
  if (!game) return;
  const axis = (positive, negative) =>
    Number(positive.some((k) => held.has(k))) - Number(negative.some((k) => held.has(k)));
  const limit = (v) => Math.max(-1, Math.min(1, v));
  const free = game.rig.free;
  if (free.active) {
    Object.assign(free.input, {
      forward: limit(axis(['KeyW', 'ArrowUp'], ['KeyS', 'ArrowDown']) + touch.pitch),
      right: limit(axis(['KeyD', 'ArrowRight'], ['KeyA', 'ArrowLeft']) + touch.roll),
      up: limit(axis(['KeyE'], ['KeyQ']) + touch.throttle),
      boost: held.has('ShiftLeft') || held.has('ShiftRight'),
    });
    return;
  }
  game.input.pitch = limit(axis(['ArrowUp'], ['ArrowDown']) + touch.pitch);
  game.input.roll = limit(axis(['ArrowRight', 'KeyD'], ['ArrowLeft', 'KeyA']) + touch.roll);
  game.input.throttle = limit(axis(['KeyW', 'Equal'], ['KeyS', 'Minus']) + touch.throttle);
  game.input.brake = held.has('Space') || touch.brake;
}
function clearInput() {
  held.clear();
  for (const [id, control] of touchCaptures)
    if (control.hasPointerCapture(id)) control.releasePointerCapture(id);
  touchCaptures.clear();
  Object.assign(touch, { pitch: 0, roll: 0, throttle: 0, brake: false });
  if (game) Object.assign(game.rig.free.input, { forward: 0, right: 0, up: 0, boost: false });
  updateInput();
  stick.firstElementChild.style.transform = '';
  game?.rig.clearPointers();
}
async function ensureGame() {
  if (game) return game;
  if (!loadingGame)
    loadingGame = import('./game.js')
      .then(({ createGame }) =>
        createGame(
          byId('world'),
          sound,
          updateHUD,
          () => {
            byId('trip-summary').textContent =
              (game.flight.airliner ? '厦航 787-9 已从 05 跑道滑入高崎机场机坪并停稳。本段飞行 ' : '已在高崎机场停稳。本次飞行 ') +
              (game.flight.elapsed / 60).toFixed(1) +
              ' 分钟，航程 ' +
              game.flight.km.toFixed(1) +
              ' 公里。';
            openPanel('arrived');
          },
          (message) => {
            if (starting) status.textContent = message;
          }
        )
      )
      .then((value) => {
        game = value;
        islands = game.geo.islands;
        return game;
      })
      .catch((error) => {
        loadingGame = null;
        throw error;
      });
  return loadingGame;
}
async function launch(id, lightPreset, { deferAudio = false, restart = false } = {}) {
  if (starting) return;
  const station = allStops.find((s) => s.id === id) || stations[0];
  starting = true;
  clearInput();
  if (!deferAudio) {
    sound.unlock();
  } else {
    // Deep links can start a flight before the first user gesture.
    const pending = new AbortController();
    const enableAudio = () => {
      pending.abort();
      sound.unlock();
    };
    for (const gesture of ['pointerup', 'keydown'])
      window.addEventListener(gesture, enableAudio, { signal: pending.signal });
  }
  status.classList.remove('error');
  status.textContent = '正在准备飞行…';
  for (const button of lobby.querySelectorAll('.depart-actions button')) button.disabled = true;
  try {
    const sim = await ensureGame();
    const departure = station.distance === undefined ? stations[0] : station;
    const light = lightPreset ?? (!inFlight ? station.entryLight : undefined);
    await sim.launch(departure, restart || !inFlight, light);
    if (sheet.open) sheet.close();
    activePanel = '';
    inFlight = true;
    hiddenHud = false;
    lobby.hidden = true;
    hud.hidden = false;
    byId('show-hud').hidden = true;
    gameRoot.classList.toggle('airliner', !!station.airliner);
    if (station.view) sim.visit({ station });
    updateHUD();
    status.textContent = '';
    if (station.view) showExploreHint();
    else showHint(
      station.airliner
        ? (coarse.matches ? '自动进场中。点视角可换舷窗，双指缩放。' : '自动进场中。按 C 换舷窗，拖动环顾，H 隐藏仪表。')
        : station.id === 'airport'
        ? coarse.matches
          ? '按＋加油门，达到 90 km/h 后向上推方向杆。'
          : '按住 W 加油门，达到 90 km/h 后按 ↑ 抬头。P 可随时接手起飞。'
        : station.focusHeight !== undefined
          ? (coarse.matches ? '拖动画面环顾，双指缩放。' : '拖动画面环顾，滚轮缩放。')
          : '自动驾驶已接手。拖动画面环顾，切换视角可进入驾驶舱或稳定航拍。',
      7300
    );
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  } catch (error) {
    console.error('Flight could not start', error);
    game?.stop();
    inFlight = false;
    lobby.hidden = false;
    hud.hidden = true;
    status.classList.add('error');
    status.textContent = /webgl|context/i.test(String(error))
      ? '当前浏览器未能启用 WebGL 2，请打开硬件加速后重试。'
      : '场景加载未完成，请点起飞重试。';
  } finally {
    starting = false;
    for (const button of lobby.querySelectorAll('.depart-actions button')) button.disabled = false;
  }
}
function toLobby() {
  inFlight = false;
  activePanel = '';
  if (sheet.open) sheet.close();
  clearInput();
  game?.stop();
  gameRoot.classList.remove('airliner', 'free-mode', 'touch-mode');
  hiddenHud = false;
  hud.hidden = true;
  byId('show-hud').hidden = true;
  lobby.hidden = false;
  status.textContent = '';
  renderCharts();
  byId('depart').focus({ preventScroll: true });
}
function togglePilot() {
  if (!game || game.rig.free.active || game.flight.airliner || game.flight.arrived) return;
  game.flight.toggleAutopilot();
  clearInput();
  updateHUD();
  showHint(game.flight.autopilot ? '自动驾驶已接手 · 拖动画面看风景' : '已交还驾驶权', 2300);
}
function showExploreHint() {
  showHint(coarse.matches
    ? '方向杆平移，＋/− 升降，拖动画面环顾。点航线图前往景点。'
    : 'WASD 平移 · E / Q 升降 · 拖动环顾 · Shift 加速 · M 前往景点', 7200);
}
function toggleExplore() {
  if (!inFlight || starting || sheet.open) return;
  clearInput();
  game.toggleExplore();
  if (game.rig.free.active) showExploreHint();
  else showHint('已返回原飞行视角', 2300);
}
function chooseStation(station) {
  if (inFlight && !starting && (station.view || game.rig.free.active)) {
    const wasExploring = game.rig.free.active;
    clearInput();
    game.visit({ station });
    closePanel();
    if (!wasExploring) showExploreHint();
  } else launch(station.id);
}
function toggleHUD() {
  hiddenHud = !hiddenHud;
  hud.hidden = hiddenHud;
  byId('show-hud').hidden = !hiddenHud;
  updateHUD();
}
const panelTitles = {
  map: '观光航线',
  environment: '时间与天气',
  help: '飞行操作',
  pause: '飞行暂停',
  arrived: '欢迎回到高崎',
};
function openPanel(name) {
  if (starting || (!inFlight && !['help', 'map'].includes(name))) return;
  clearInput();
  const jet = inFlight && game.flight.airliner;
  const exploring = inFlight && game.rig.free.active;
  const arrivalAudio = name === 'arrived' && jet;
  activePanel = name;
  game?.setPaused(document.hidden || (!arrivalAudio && (!exploring || name === 'pause')), arrivalAudio);
  for (const el of sheet.querySelectorAll('[data-panel]')) el.hidden = el.dataset.panel !== name;
  byId('sheet-title').textContent = name === 'arrived' && jet ? '已抵达厦门' :
    name === 'pause' && exploring ? '自由移动已暂停' : panelTitles[name];
  if (!sheet.open) sheet.showModal();
  if (name === 'map') selectChart(jet);
  if (name === 'arrived') {
    byId('again').textContent = jet ? '再乘一次厦航 787' : '再次从高崎出发';
    byId('parked-cabin').hidden = !jet;
  }
  if (name === 'help') {
    byId('help-cameras').textContent = jet ? '机外 / 右窗 / 左窗 / 航拍' : '机外 / 座舱 / 航拍';
    byId('jet-reset-help').hidden = !jet;
    byId('help-note').textContent = jet ? '客机自动进场。拖动环顾，双指或滚轮缩放。点播放速度可切换 1×、2× 和 4×。' :
      '触屏可拖动方向杆驾驶，滑动画面环顾，双指缩放。自动驾驶可以接管起飞、观光和着陆。';
  }
  if (name === 'environment') {
    byId('return-from-environment').textContent = exploring ? '继续自由移动' : '返回飞行';
    syncEnvironment();
  }
  if (name === 'pause') {
    byId('resume-session').textContent = exploring ? '继续自由移动' : '继续飞行';
    byId('cabin-settings').hidden = !jet;
    byId('paused-info').textContent =
      byId('location').textContent +
      ' · ' +
      clockText(game.atmosphere.state.minute) +
      ' · 已飞行 ' +
      game.flight.km.toFixed(1) +
      ' 公里';
  }
}
function closePanel() {
  if (sheet.open) sheet.close();
}
sheet.addEventListener('close', () => {
  if (sheet.open) return;
  activePanel = '';
  clearInput();
  if (inFlight) game.setPaused(document.hidden);
});
sheet.addEventListener('click', (event) => {
  if (event.target === sheet) {
    const r = sheet.getBoundingClientRect();
    if (
      event.clientX < r.left ||
      event.clientX > r.right ||
      event.clientY < r.top ||
      event.clientY > r.bottom
    )
      closePanel();
  }
});
byId('close-sheet').onclick = closePanel;
for (const b of document.querySelectorAll('[data-open]'))
  b.addEventListener('click', () => openPanel(b.dataset.open));
for (const b of document.querySelectorAll('[data-return]')) b.addEventListener('click', closePanel);
byId('depart').onclick = () => launch('airport');
byId('jet-arrival').onclick = () => launch('787');
function enableCabinAudio() {
  if (sound.enabled) sound.unlock();
  else sound.toggle();
  syncSound();
}
byId('enable-cabin-audio').onclick = enableCabinAudio;
byId('parked-enable-audio').onclick = enableCabinAudio;
musicChoice.onchange = () => sound.chooseMusic(musicChoice.value);
byId('cabin-speech').onchange = (event) => {
  sound.setSpeech(event.target.checked);
  syncSound();
};
byId('replay-speech').onclick = () => {
  sound.unlock();
  sound.replaySpeech(game.flight.cabinStage);
  closePanel();
};
byId('tour').onclick = () => launch('beach');
byId('night-tour').onclick = () => launch('bridge', 'night');
byId('autopilot').onclick = togglePilot;
byId('explore').onclick = toggleExplore;
byId('explore-rate').onclick = () => {
  game.rig.free.cycleRate();
  updateHUD();
};
byId('play-rate').onclick = () => {
  game.cyclePlayback();
  updateHUD();
};
for (const b of byId('map-routes').children) b.onclick = () => selectChart(b.dataset.route === '787');
chart.addEventListener('click', (event) => {
  const landmark=chartLabelAt(chart,event.clientX,event.clientY);
  if (landmark) { chooseStation(landmark); return; }
  if (!inFlight || !game.rig.free.active) return;
  const point = chartPoint(chart, event.clientX, event.clientY, true);
  const { xmin, xmax, zmin, zmax } = game.geo.bounds;
  if (point.x < xmin || point.x > xmax || point.z < zmin || point.z > zmax) return;
  game.visit(point);
  closePanel();
});
byId('camera').onclick = () => game.cycleCamera();
byId('back-lobby').onclick = toLobby;
byId('finish-trip').onclick = toLobby;
byId('again').onclick = () => launch(game.flight.airliner ? '787' : 'airport', undefined, { restart: true });
byId('hide-hud').onclick = toggleHUD;
byId('show-hud').onclick = toggleHUD;
for (const b of document.querySelectorAll('.sound-toggle'))
  b.onclick = () => {
    sound.toggle();
    syncSound();
  };
for (const station of brtViews) {
  const button = document.createElement('button');
  button.type = 'button';
  const point = document.createElement('span'), dot = document.createElement('i');
  point.dataset.point = '';
  dot.className = 'route-dot';
  point.append(dot, station.name);
  button.append(point);
  button.setAttribute('aria-label', '前往 BRT ' + station.name + '观景位');
  button.addEventListener('click', () => chooseStation(station));
  byId('brt-list').append(button);
}
for (const [listId, stops] of [
  ['venue-list', venueViews], ['crossing-list', crossingViews], ['station-list', stations], ['arrival-list', arrivalStops],
]) {
  const list = byId(listId);
  for (const station of stops) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.innerHTML =
      '<span data-point><i class="route-dot"></i>' +
      station.name +
      '</span><small>' +
      station.kind +
      '</small>';
    btn.dataset.place = station.name;
    btn.setAttribute('aria-label', station.view ? '前往' + station.name + '观景位' : '从' + station.name + '开始');
    btn.onclick = () => chooseStation(station);
    const inscription = listId === 'crossing-list' && northInscriptionViews.find(view => view.parent === station.id);
    if (inscription) {
      const crossing = document.createElement('div');
      crossing.className = 'crossing-stop';
      const closeup = document.createElement('button');
      closeup.type = 'button';
      closeup.className = 'crossing-inscription';
      closeup.dataset.inscription = inscription.id;
      closeup.textContent = inscription.label;
      closeup.setAttribute('aria-label', '前往' + inscription.name);
      closeup.onclick = () => chooseStation(inscription);
      crossing.append(btn, closeup);
      list.append(crossing);
    } else {
      list.append(btn);
    }
    const closeViews = station.id === 'island' ? islandViews : tourStops.filter(site => site.parent === station.id);
    if (closeViews.length) {
      const views = document.createElement('div');
      views.className = 'island-views';
      for (const site of closeViews) {
        const view = document.createElement('button');
        view.type = 'button';
        view.textContent = site.name;
        view.dataset.place = site.name;
        if (site.view) view.dataset.view = 'true';
        view.setAttribute('aria-label', site.view ? '前往' + site.name : '从' + site.name + '开始');
        view.onclick = () => chooseStation(site);
        views.append(view);
      }
      list.append(views);
    }
  }
}
function makeChoices(id, items, callback) {
  for (const [value, label] of items) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.value = value;
    b.textContent = label;
    b.addEventListener('click', () => callback(value));
    byId(id).append(b);
  }
}
makeChoices('airport-views', airportViews.map(({ id, name }) => [id, name]),
  (id) => chooseStation(airportViews.find(site => site.id === id)));
function setMinute(minute) {
  game.atmosphere.state.minute = minute;
  syncEnvironment();
  game.preview();
}
makeChoices('light-presets', [['afternoon', '午后'], ['sunset', '日落前'], ['blue', '蓝调时刻'], ['night', '厦门夜景']], (preset) =>
  setMinute(lightPresetMinute(game.atmosphere.state.day, preset))
);
makeChoices(
  'rates',
  [
    [1, '1×'],
    [3, '3×'],
    [12, '12×'],
    [60, '60×'],
  ],
  (v) => {
    game.atmosphere.state.rate = v;
    syncEnvironment();
  }
);
makeChoices(
  'weathers',
  [
    ['natural', '自然演变'],
    ['clear', '晴朗'],
    ['cumulus', '晴间积云'],
    ['mist', '海雾'],
    ['rain', '阵雨'],
  ],
  (v) => {
    game.atmosphere.state.mode = v;
    syncEnvironment();
  }
);
function syncEnvironment() {
  const w = game.atmosphere.state;
  byId('time-range').value = Math.floor(w.minute);
  byId('time-value').textContent = clockText(w.minute);
  byId('sunset-label').textContent = '日落 ' + clockText(w.day.sunset);
  for (const b of byId('light-presets').children)
    b.setAttribute('aria-pressed', String(Math.floor(w.minute) === lightPresetMinute(w.day, b.dataset.value)));
  for (const b of byId('rates').children)
    b.setAttribute('aria-pressed', String(Number(b.dataset.value) === w.rate));
  for (const b of byId('weathers').children)
    b.setAttribute('aria-pressed', String(b.dataset.value === w.mode));
}
byId('time-range').addEventListener('input', () => {
  setMinute(Number(byId('time-range').value));
});
const movementKeys = new Set([
  'KeyW',
  'KeyS',
  'KeyA',
  'KeyD',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Equal',
  'Minus',
  'Space',
]);
const exploreKeys = new Set(['KeyQ', 'KeyE', 'ShiftLeft', 'ShiftRight']);
const shortcuts = new Set([
  'KeyP',
  'KeyC',
  'KeyF',
  'KeyH',
  'KeyM',
  'KeyR',
  'Escape',
  'Slash',
]);
document.addEventListener('keydown', (event) => {
  const exploring = !!game?.rig.free.active;
  if (
    !inFlight ||
    sheet.open ||
    (!shortcuts.has(event.code) && !movementKeys.has(event.code) && !(exploring && exploreKeys.has(event.code))) ||
    event.metaKey ||
    event.ctrlKey ||
    event.altKey
  )
    return;
  if (event.code === 'Space' && (exploring || (document.activeElement?.tagName === 'BUTTON' && !game.flight.grounded)))
    return;
  event.preventDefault();
  if (shortcuts.has(event.code)) {
    if (event.repeat) return;
    if (event.code === 'KeyP') togglePilot();
    if (event.code === 'KeyC') game.cycleCamera();
    if (event.code === 'KeyF') toggleExplore();
    if (event.code === 'KeyH') toggleHUD();
    if (event.code === 'KeyM') openPanel('map');
    if (event.code === 'KeyR') {
      game.rig.resetLook();
      showHint('镜头已回正', 1300);
    }
    if (event.code === 'Escape') openPanel('pause');
    if (event.code === 'Slash') openPanel('help');
    return;
  }
  held.add(event.code);
  updateInput();
});
document.addEventListener('keyup', (event) => {
  held.delete(event.code);
  updateInput();
});
window.addEventListener('blur', clearInput);
document.addEventListener('visibilitychange', () => {
  if (!inFlight) return;
  if (document.hidden) {
    clearInput();
    game.setPaused(true);
  } else if (!sheet.open || (game.rig.free.active && activePanel !== 'pause') ||
    (activePanel === 'arrived' && game.flight.airliner)) {
    game.setPaused(false, activePanel === 'arrived' && game.flight.airliner);
  }
});
function captureTouch(event) {
  const control = event.currentTarget;
  control.setPointerCapture(event.pointerId);
  touchCaptures.set(event.pointerId, control);
}
function moveStick(event) {
  const box = stick.getBoundingClientRect(),
    x = (event.clientX - box.left - box.width / 2) / (box.width * 0.4),
    y = (event.clientY - box.top - box.height / 2) / (box.height * 0.4),
    length = Math.max(1, Math.hypot(x, y));
  touch.roll = x / length;
  touch.pitch = -y / length;
  stick.firstElementChild.style.transform =
    'translate(' + touch.roll * 28 + 'px,' + -touch.pitch * 28 + 'px)';
  updateInput();
}
stick.addEventListener('pointerdown', (event) => {
  if ([...touchCaptures.values()].includes(stick)) return;
  captureTouch(event);
  moveStick(event);
});
stick.addEventListener('pointermove', (event) => {
  if (stick.hasPointerCapture(event.pointerId)) moveStick(event);
});
stick.addEventListener('lostpointercapture', (event) => {
  touchCaptures.delete(event.pointerId);
  touch.pitch = 0;
  touch.roll = 0;
  stick.firstElementChild.style.transform = '';
  updateInput();
});
for (const b of liftButtons) {
  b.addEventListener('pointerdown', (event) => {
    captureTouch(event);
    touch.throttle = Number(b.dataset.thrust);
    if (!game.rig.free.active)
      game.flight.throttle = Math.max(0, Math.min(1, game.flight.throttle + touch.throttle * 0.055));
    updateInput();
  });
  b.addEventListener('lostpointercapture', (event) => {
    touchCaptures.delete(event.pointerId);
    const thrust = [...touchCaptures.values()].findLast((control) => control.dataset.thrust);
    touch.throttle = thrust ? Number(thrust.dataset.thrust) : 0;
    updateInput();
  });
}
byId('touch-brake').addEventListener('pointerdown', (event) => {
  captureTouch(event);
  touch.brake = true;
  updateInput();
});
byId('touch-brake').addEventListener('lostpointercapture', (event) => {
  touchCaptures.delete(event.pointerId);
  touch.brake = false;
  updateInput();
});
const entry = new URLSearchParams(location.search);
const tour = entry.get('tour') === 'brt' ? 'brt-wenzao' : entry.get('tour');
if (tour === 'night') launch('bridge', 'night', { deferAudio: true });
else if (tour && allStops.some((station) => station.id === tour))
  launch(tour, ['sunset','night','blue','afternoon','morning'].includes(entry.get('time')) ? entry.get('time') : undefined, { deferAudio: true });
