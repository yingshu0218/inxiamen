import { crossingViews, mapRoute, stations, runway, sunlightView, venueViews } from './route.js';
import { arrivalMap, arrivalStops } from './airliner-arrival.js';
import { brtChartLines, brtViews } from './brt-layout.js';

const symbols = {
  sound:
    '<path d="M3 9h4l5-4v14l-5-4H3z"/><path d="M15.5 8.5a5 5 0 0 1 0 7m2.7-10a9.4 9.4 0 0 1 0 13"/>',
  muted: '<path d="M3 9h4l5-4v14l-5-4H3z"/><path d="m16.5 9 5 6m0-6-5 6"/>',
  help: '<circle cx="12" cy="12" r="9.4"/><path d="M9.5 8.8a2.55 2.55 0 0 1 5 .65c0 1.8-2.5 2.2-2.5 4.1"/><path d="M12 16.2h.02"/>',
  pause: '<path d="M8 5v14m8-14v14" stroke-width="2.6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  moon: '<path d="M20.5 14.1A8.9 8.9 0 0 1 9.9 3.5a8.8 8.8 0 1 0 10.6 10.6Z"/>',
  landing: '<path d="m3 7 2 .4 2.5 3.3 4.2 1.1-2.3-6.7 2 .4 4.4 7.4 4.2 1.2c2 .6 1.6 2.8-.6 2.3l-13.6-3.6L3 7Z"/><path d="M3 20h18"/>',
  rate: '<path d="m3.5 6.5 7.5 5.5-7.5 5.5zM12.5 6.5 20 12l-7.5 5.5z"/>',
  pilot:
    '<path d="m3 13 7-2 2-7 2 0 .8 6 5.8 3.2-.3 1.6-6.2-1-1.4 5 2 2-1 .9-3-1.6-2 .5.3-1.6 1.3-1.8.1-4.6-7.4.9z"/>',
  camera:
    '<rect x="2.3" y="6.2" width="19.4" height="13.8" rx="2.5"/><path d="m7.2 6 1.5-2h6.6l1.5 2"/><circle cx="12" cy="13" r="3.4"/>',
  explore: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/><path d="m12 7 4.7 9.6-4.7-2-4.7 2L12 7Z"/>',
  map: '<path d="m2.5 5.7 6-2.5 7 2.5 6-2.5v15l-6 2.5-7-2.5-6 2.5zM8.5 3.7v14.1m7-11.8v14.1"/>',
  frame: '<path d="M8 3.5H3.5V8m12-4.5h5V8M3.5 16v4.5H8m12.5-4.5v4.5H16"/>',
  home: '<path d="m2.8 11 9.2-8 9.2 8M5 10v10h14V10M10 20v-6h4v6"/>',
};
export function icon(name) {
  if (name === 'tern')
    return '<svg viewBox="0 0 70 40" aria-hidden="true"><path fill="currentColor" d="M1 2c18 5 29 12 38 23 4 2 8 1 13-1.7 4.2-2.2 7.5-1.9 10.9.7l6 1.6-7.2.7c-3 .2-4.9 1-9.4 4.3-7.2 5.4-16.4 5-23.4 3.6l-9.1 3.1 5-5.8C20.6 28.5 16 22.8 12.2 17 8.2 10.7 5.5 6.1 1 2z"/><path fill="currentColor" d="m28 29-15-4 8.7 1 4.7 1.4z"/></svg>';
  return (
    '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
    (symbols[name] || '') +
    '</svg>'
  );
}
export function hydrateIcons(root = document) {
  for (const el of root.querySelectorAll('[data-icon]')) el.innerHTML = icon(el.dataset.icon);
}
function surface(canvas) {
  const w = canvas.clientWidth,
    h = canvas.clientHeight;
  if (w < 1 || h < 1) return null;
  const d = Math.min(devicePixelRatio || 1, 2),
    pw = Math.round(w * d),
    ph = Math.round(h * d);
  if (canvas.width !== pw) canvas.width = pw;
  if (canvas.height !== ph) canvas.height = ph;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(d, 0, 0, d, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return { ctx, w, h };
}
const arrivalMarks = [...arrivalStops, { id: 'threshold05', name: '高崎 05', ...runway.start }];
function chartLayout(w, h, large, airliner, exploring) {
  const bounds = airliner ? { left: -26000, right: 9800, top: -32300, bottom: 10100 }
    : exploring ? { left: -13400, right: 14600, top: -14700, bottom: 9700 }
    : { left: -9400, right: 10800, top: -13300, bottom: 7400 };
  const margin = large ? 14 : 5,
    scale = Math.min(
      (w - 2 * margin) / (bounds.right - bounds.left),
      (h - 2 * margin) / (bounds.bottom - bounds.top)
    );
  const centerX = (bounds.left + bounds.right) / 2,
    centerZ = (bounds.top + bounds.bottom) / 2;
  return { scale, centerX, centerZ,
    tx: (x) => w / 2 + (x - centerX) * scale,
    ty: (z) => h / 2 + (z - centerZ) * scale };
}
export function chartPoint(canvas, clientX, clientY, exploring) {
  const { left, top, width, height } = canvas.getBoundingClientRect();
  const { scale, centerX, centerZ } = chartLayout(width, height, true, false, exploring);
  return {
    x: centerX + (clientX - left - width / 2) / scale,
    z: centerZ + (clientY - top - height / 2) / scale,
  };
}
const islandMarks = [...stations.slice(0, -1), sunlightView, ...crossingViews, ...venueViews.filter(({ chartName }) => chartName)];
const chartLabels = new WeakMap();
export function chartLabelAt(canvas, clientX, clientY) {
  const bounds=canvas.getBoundingClientRect(), x=clientX-bounds.left, y=clientY-bounds.top;
  return chartLabels.get(canvas)?.find(label=>x>=label.left && x<=label.right && y>=label.top && y<=label.bottom)?.site;
}
export function drawChart(canvas, islands, flight = null, large = false, relief = null, airliner = !!flight?.airliner, exploring = false, showBrt = false) {
  if (!islands) return;
  const s = surface(canvas);
  if (!s) return;
  const { ctx, w, h } = s;
  const labels = [];
  if (large) chartLabels.set(canvas,labels);
  const { scale, tx, ty } = chartLayout(w, h, large, airliner, exploring);
  function ring(list) {
    ctx.beginPath();
    list.forEach(([x, z], i) => (i ? ctx.lineTo(tx(x), ty(z)) : ctx.moveTo(tx(x), ty(z))));
    ctx.closePath();
  }
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const shaded = large && relief?.complete && relief.naturalWidth>0;
  if (large) {
    if (shaded && airliner) {
      ctx.globalAlpha = .50;
      ctx.drawImage(relief, tx(-42000), ty(-35000), 84000 * scale, 67500 * scale);
      ctx.globalAlpha = 1;
    } else if (shaded) ctx.drawImage(relief,tx(-19000),ty(-16000),38000*scale,32000*scale);
    ctx.strokeStyle = 'rgba(205,222,207,.065)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    if (!airliner || !shaded) {
      for (const item of islands.neighbors) {
        ring(item);
        ctx.fillStyle = '#334c49';
        if (!shaded) ctx.fill();
        ctx.strokeStyle = '#6d80704d';
        ctx.stroke();
      }
    }
  }
  for (const item of [islands.xiamen, islands.gulangyu]) {
    ring(item);
    ctx.fillStyle = large ? '#53665c' : 'rgba(14,38,39,.3)';
    if (!shaded) ctx.fill();
    ctx.strokeStyle = large ? '#c1c5a6' : '#f9e6b9';
    ctx.lineWidth = large ? 1.45 : 1.25;
    ctx.stroke();
  }
  ctx.strokeStyle = airliner ? '#9fe4ee' : large ? '#f0c882' : '#f6d8a3';
  ctx.lineWidth = large ? 1.5 : 1.05;
  ctx.setLineDash(large ? [3.8, 3.4] : [2.5, 3]);
  ctx.beginPath();
  (airliner ? arrivalMap : mapRoute).forEach(([x, z], i) => (i ? ctx.lineTo(tx(x), ty(z)) : ctx.moveTo(tx(x), ty(z))));
  ctx.stroke();
  ctx.setLineDash([]);
  if (showBrt) {
    ctx.beginPath();
    for (const line of brtChartLines)
      line.forEach(([x, z], i) => i ? ctx.lineTo(tx(x), ty(z)) : ctx.moveTo(tx(x), ty(z)));
    ctx.strokeStyle = '#183c47';
    ctx.lineWidth = 4.3;
    ctx.stroke();
    ctx.strokeStyle = '#82cde9';
    ctx.lineWidth = 2.25;
    ctx.stroke();
    ctx.fillStyle = '#e0f7ff';
    for (const station of brtViews) {
      ctx.beginPath();
      ctx.arc(tx(station.x), ty(station.z), 1.68, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  for (const station of airliner ? arrivalMarks : islandMarks) {
    const crossing = !!station.view;
    const x = tx(station.x),
      y = ty(station.z);
    ctx.beginPath();
    ctx.fillStyle = airliner || crossing ? '#c3f0e1' : '#ffe5b6';
    ctx.arc(x, y, large ? 2.6 : 1.8, 0, Math.PI * 2);
    ctx.fill();
    if (large) {
      const shift = station.chartOffset ?? {
        '787': [8, 5], '787-city': [-8, -7], '787-harbor': [-6, 13],
        '787-final': [-8, 0], '787-taxi': [8, -18], threshold05: [8, -2],
        airport: [-8, -8],
        wuyuan: [8, -4],
        lake: [13, -4],
        broadcast: [10, -18],
        railway: [11, 10],
        park: [-12, 7],
        campus: [19, 14],
        temple: [18, -7],
        mountain: [8, -3],
        beach: [10, 6],
        bridge: [-6, 27],
        island: [-12, 13],
        zhongshan: [18,-3],
        ferry: [-14,-7],
        lujiang: [-9,-24],
        haicang: [-8, -6],
      }[station.id];
      if (crossing || ['park','campus','temple','bridge','zhongshan','ferry','lujiang','broadcast'].includes(station.id)) {
        ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+shift[0]*.85,y+shift[1]-3);
        ctx.strokeStyle='#cabb95';ctx.lineWidth=.7;ctx.stroke();
      }
      ctx.font = '11px system-ui,sans-serif';
      ctx.textAlign = shift[0] < 0 ? 'right' : 'left';
      ctx.strokeStyle = '#263f3a';
      ctx.lineWidth = 3;
      const label = station.chartName ?? station.name;
      if (station === sunlightView) {
        const width=ctx.measureText(label).width;
        const left=x+shift[0]-(shift[0]<0 ? width : 0);
        labels.push({site:station,left:left-4,right:left+width+4,top:y+shift[1]-14,bottom:y+shift[1]+4});
        labels.push({site:station,left:x-3,right:x+3,top:y-3,bottom:y+3});
      }
      ctx.strokeText(label, x + shift[0], y + shift[1]);
      ctx.fillStyle = crossing ? '#c3f0e1' : '#f7edd4';
      ctx.fillText(label, x + shift[0], y + shift[1]);
    }
  }
  if (large) {
    ctx.fillStyle = '#e4d9bc';
    ctx.font = '11px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('N', w - 17, 17);
    ctx.beginPath();
    ctx.moveTo(w - 17, 20);
    ctx.lineTo(w - 19.8, 29);
    ctx.lineTo(w - 17, 27);
    ctx.lineTo(w - 14.3, 29);
    ctx.closePath();
    ctx.fill();
  }
  if (flight) {
    ctx.save();
    ctx.translate(tx(flight.x), ty(flight.z));
    ctx.rotate(flight.heading);
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4.5, 5);
    ctx.lineTo(0, 2.8);
    ctx.lineTo(-4.5, 5);
    ctx.closePath();
    ctx.fillStyle = exploring ? '#a5efdc' : '#ffbd6e';
    ctx.strokeStyle = '#2c3932';
    ctx.lineWidth = 1;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}
export function drawCompass(canvas, heading) {
  const s = surface(canvas);
  if (!s) return;
  const { ctx, w, h } = s,
    degrees = ((((heading * 180) / Math.PI) % 360) + 360) % 360,
    cx = w / 2,
    px = w / 103;
  const names = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  ctx.textAlign = 'center';
  ctx.font = '11px system-ui';
  ctx.lineWidth = 1;
  for (let a = Math.floor((degrees - 52) / 5) * 5; a <= degrees + 52; a += 5) {
    const x = cx + (a - degrees) * px,
      angle = ((a % 360) + 360) % 360,
      fade = Math.min(1, (w / 2 - Math.abs(x - cx)) / 18);
    if (fade < 0) continue;
    ctx.globalAlpha = fade;
    ctx.strokeStyle = '#fff2d6b5';
    ctx.beginPath();
    ctx.moveTo(x, h - 13);
    ctx.lineTo(x, h - (angle % 15 === 0 ? 20 : 16));
    ctx.stroke();
    if (angle % 45 === 0 || (w > 205 && angle % 15 === 0)) {
      ctx.fillStyle = '#fff3d8';
      ctx.fillText(angle % 45 === 0 ? names[angle / 45] : String(angle), x, h - 25);
    }
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#ffd49c';
  ctx.beginPath();
  ctx.moveTo(cx, h - 11);
  ctx.lineTo(cx - 3.4, h - 5);
  ctx.lineTo(cx + 3.4, h - 5);
  ctx.closePath();
  ctx.fill();
  canvas.setAttribute('aria-label', '航向 ' + Math.round(degrees) + ' 度');
}
