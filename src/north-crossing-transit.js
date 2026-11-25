import { MeshBatch, box, litSurface, prism } from './scenery-mesh.js';

function metroCar(batch, cab) {
  const nose = cab ? 8.78 : 9.25;
  const ring = [[-9.25, -1.38], [nose, -1.38], [9.25, -.98], [9.25, .98], [nose, 1.38], [-9.25, 1.38]];
  prism(batch, ring, .36, 1.02, '#42494a', '#667172');
  prism(batch, ring, 1, 2.03, '#d1d6d3', '#c5cbc5');
  prism(batch, ring, 2.03, 3.13, '#44535a', '#505d62', litSurface.hallWindow);
  prism(batch, ring, 3.13, 3.64, '#c4ccca', '#d7d9ce');
  box(batch, -.6, 0, 7.9, 1.78, 3.62, 3.79, '#afbab7', '#bfc8c1');
  for (const side of [-1, 1]) {
    box(batch, -.15, side * 1.39, 17.95, .045, 1.71, 1.86, '#d7974e', '#d7974e');
    for (const x of [-6.91, -2.4, 2.4, 6.91]) {
      box(batch, x, side * 1.4, .085, .055, 1.15, 3.15, '#bfc7c5', '#bdc5c1');
      box(batch, x + 1.42, side * 1.4, .08, .055, 1.15, 3.15, '#bfc7c5', '#bdc5c1');
    }
    if (cab) box(batch, 9.22, side * .68, .097, .26, 1.42, 1.62, '#d0d0bd', '#d9d7bb', litSurface.portico);
  }
}

export function northCrossingTransit(parent, roads, material, brtModels) {
  const brt = roads.find((road) => road.brt);
  const metro = roads.find((road) => road.metro).metro;
  const carriage = new MeshBatch(), cab = new MeshBatch();
  metroCar(carriage, false);
  metroCar(cab, true);
  const metroCarriage = carriage.finish(parent, material, '高集海堤 · 一号线车厢');
  const metroCab = cab.finish(parent, material, '高集海堤 · 一号线车头');
  const clone = (first) => {
    const mesh = first.clone();
    parent.add(mesh);
    return mesh;
  };
  const busFleet = Array.from({length: 4}, (_, i) => {
    const direction = i % 2 ? -1 : 1, express = i < 2;
    const bus = brtModels.create(parent, express ? '快1' : '快2', express ? '厦门北站' : '同安枢纽', express);
    const returning = brt.step(direction > 0 ? 1 : 0).z > brt.center.z;
    const sample = (s,out) => {
      const u = direction > 0 ? s : brt.length - s;
      return out.set(...brt.at(brt.step(u/brt.length), direction*2.30, .042));
    };
    return { bus, sample, returning };
  });
  const trains = [
    [metroCab, ...Array.from({ length: 4 }, () => clone(metroCarriage)), clone(metroCab)],
    [clone(metroCab), ...Array.from({ length: 4 }, () => clone(metroCarriage)), clone(metroCab)],
  ];
  function pose(mesh, road, d, lane, direction) {
    const n = road.step(d / road.length);
    mesh.position.set(...road.at(n, lane, .06));
    mesh.rotation.y = Math.atan2(n.rx * direction, n.rz * direction);
  }
  return (time, eye) => {
    const seeBuses = Math.hypot(eye.x - brt.center.x, eye.z - brt.center.z) < 5400;
    for (let i = 0; i < busFleet.length; i++) {
      const { bus, sample, returning } = busFleet[i];
      const s = ((.16 + i * .187 + time * 14.5 / brt.length) % 1) * brt.length;
      bus.group.visible = seeBuses && s > 10 && s < brt.length - 10;
      if (!bus.group.visible) continue;
      const p = brt.step((i % 2 ? brt.length - s : s) / brt.length);
      const near = Math.hypot(eye.x - p.x, eye.z - p.z) < 410;
      bus.place(s,sample,near);
      bus.show({ returning },near);
    }
    const seeMetro = Math.hypot(eye.x - metro.center.x, eye.z - metro.center.z) < 4300;
    for (let i = 0; i < trains.length; i++) {
      const direction = i ? -1 : 1;
      const lead = (time * 18 + 1240 + i * 142) % (metro.length + 520) - 70;
      for (let j = 0; j < trains[i].length; j++) {
        const car = trains[i][j], d = lead - 18.95 * j;
        car.visible = seeMetro && d > 9 && d < metro.length - 9;
        if (car.visible)
          pose(car, metro, direction > 0 ? d : metro.length - d, direction * 2.37, j === 5 ? -direction : direction);
      }
    }
  };
}
