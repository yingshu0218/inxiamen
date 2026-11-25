import * as THREE from 'three';
import { localFrame, rect } from './landmark-forms.js';
import { litSurface, MeshBatch, prism, TAU } from './scenery-mesh.js';

const blue = '#4a7aaa', noseBlue = '#6091bd', roofWhite = '#e2e6df';
const glass = '#243740', pillar = '#28343a', trim = '#8aa3af';
const wheelRadius = .50, archRadius = .563, doorWidth = 1.28, jointLength = 1.64;
const standard = { length: 12, front: true, rear: true, axles: [-2.80, 3.12], doors: [-.44, 4.68] };
const tractor = { length: 9.1, front: true, axles: [-3.54, 2.20], doors: [-.73, 3.37] };
const trailer = { length: 7.6, rear: true, axles: [-1.79], doors: [1.95] };
const offsets = [9 - tractor.length / 2, -9 + trailer.length / 2];
const frame = localFrame([0, 0]);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function halfWidth(y) {
  return 1.275 - Math.max(0, .68 - y) * .21 - Math.max(0, y - 2.83) * .40;
}

function capPoint(spec, end, lateral, y, lift = 0) {
  const curved = end > 0 ? spec.front : spec.rear;
  const corner = Math.max(0, (Math.abs(lateral) - .63) / .37);
  const bonnet = end > 0 ? .145 * Math.max(0, y - 1.57) : .036 * Math.abs(y - 1.75);
  const bevel = curved ? .29 * corner ** 1.7 + bonnet + .10 * Math.max(0, .75 - y) : 0;
  return [end * (spec.length / 2 - bevel + lift), y, lateral * halfWidth(y)];
}

function sideFace(batch, side, points, color, style = 0) {
  batch.face(side > 0 ? points : points.toReversed(), color, style);
}

function slab(batch, u, v, w, d, bottom, top, color, cap = color) {
  prism(batch, rect(frame, u, v, w, d), bottom, top, color, cap);
}

function wheel(batch, u, side) {
  const at = (theta, radius, depth) => [u + radius * Math.cos(theta), wheelRadius + radius * Math.sin(theta), side * depth];
  for (let i = 0; i < 18; i++) {
    const a = i * TAU / 18, b = (i + 1) * TAU / 18;
    const tread = [at(a, .492, 1.00), at(b, .492, 1.00), at(b, .50, 1.192), at(a, .50, 1.192)];
    sideFace(batch, side, tread, '#242a2b');
    sideFace(batch, side, [at(a, .50, 1.192), at(b, .50, 1.192), at(b, .439, 1.29), at(a, .439, 1.29)], '#303539');
  }
  for (const [r, depth, color] of [[.44,1.291,'#20282b'], [.33,1.299,'#929c9e'], [.265,1.307,'#bbc2bf'], [.136,1.319,'#48575d']]) {
    const disc = Array.from({ length: 18 }, (_, i) => at(i * TAU / 18, r, depth));
    sideFace(batch, side, disc, color);
  }
  for (let i = 0; i < 8; i++) {
    const angle = i * TAU / 8, [x,y] = at(angle, .218, 1.322);
    const ring = Array.from({ length: 6 }, (_, j) => [x + .025 * Math.cos(j * TAU / 6), y + .025 * Math.sin(j * TAU / 6), side * 1.323]);
    sideFace(batch, side, ring, '#526064');
  }
}

function sides(batch, spec, side) {
  const left = capPoint(spec, -1, side, 1.05)[0], right = capPoint(spec, 1, side, 1.05)[0];
  const stations = [left, right];
  for (const u of spec.axles) for (let j = 0; j <= 8; j++) {
    stations.push(u + archRadius * Math.cos(j * Math.PI / 8));
  }
  for (const u of spec.doors) stations.push(u - doorWidth / 2, u + doorWidth / 2);
  for (let u = left + 1.26; u < right - .4; u += 1.35) stations.push(u);
  stations.sort((a,b) => a-b);
  const edge = (u, y, lift = 0) => {
    if (u === left || u === right) {
      const [x, , z] = capPoint(spec, u === left ? -1 : 1, side, y);
      return [x, y, z + side * lift];
    }
    return [u, y, side * (halfWidth(y) + lift)];
  };
  const wheelOpening = (u, inside) => {
    if (!inside) return .38;
    const distance = u - inside.centre;
    return wheelRadius + Math.sqrt(Math.max(0, archRadius ** 2 - distance ** 2));
  };
  for (let i = 1; i < stations.length; i++) {
    const a = stations[i - 1], b = stations[i], centre = (a + b) / 2;
    if (b - a < .003) continue;
    const inDoor = side > 0 && spec.doors.some(u => Math.abs(u - centre) < doorWidth / 2);
    const axle = spec.axles.find(u => Math.abs(u - centre) < archRadius);
    const well = axle === undefined ? null : { centre: axle };
    const ah = wheelOpening(a, well), bh = wheelOpening(b, well);
    const skin = (a0,b0,a1,b1, color, style = 0, lift = 0) => sideFace(batch, side, [
      edge(a,a0,lift), edge(b,b0,lift), edge(b,b1,lift), edge(a,a1,lift),
    ], color, style);
    if (!inDoor) {
      skin(ah, bh, 1.66, 1.66, blue);
      const rise = u => clamp((-u - .8) / 1.4, 0, 1) * .46;
      for (const [height, w, color] of [[.53,.09,'#e5b243'], [.659,.079,'#d5e2dc']]) {
        const sa = height + rise(a), sb = height + rise(b);
        const lw = Math.max(ah, sa), rw = Math.max(bh, sb);
        const lh = Math.max(lw, sa + w), rh = Math.max(rw, sb + w);
        if (lh > lw + .001 || rh > rw + .001) skin(lw,rw,lh,rh,color,0,.009);
      }
      skin(1.66,1.66,1.732,1.732,'#304a59');
      skin(1.732,1.732,2.84,2.84,glass,litSurface.brtGlass);
      skin(2.538,2.538,2.56,2.56,'#647b82',0,.012);
    }
    skin(inDoor ? 2.74 : 2.84, inDoor ? 2.74 : 2.84, 2.93, 2.93, pillar);
    skin(2.93,2.93,3.14,3.14,noseBlue);
    skin(3.14,3.14,3.21,3.21,roofWhite);
  }
  for (let u = left + 1.26; u < right - .4; u += 1.35) {
    if (side > 0 && spec.doors.some(door => Math.abs(door - u) < doorWidth / 2 + .04)) continue;
    slab(batch, u, side * halfWidth(2.05), .041, .032, 1.735, 2.842, pillar);
  }
  for (const u of spec.axles) wheel(batch, u, side);
}

function caps(batch, spec, end) {
  const visible = end > 0 ? spec.front : spec.rear;
  const across = [-1,-.87,-.69,-.40,0,.40,.69,.87,1];
  const levels = visible ? [.38,.65,1.13,end>0?1.33:1.63,2.83,2.96,3.14,3.21] : [.38,2.89,3.21];
  const colors = visible ? ['#557d9c',noseBlue,end>0?'#273940':blue,glass,pillar,noseBlue,roofWhite] : [pillar,blue];
  for (let j = 1; j < levels.length; j++) {
    for (let i = 1; i < across.length; i++) {
      const a = across[i - 1], b = across[i], from = levels[j - 1], to = levels[j];
      const ring = [capPoint(spec,end,b,from),capPoint(spec,end,a,from),capPoint(spec,end,a,to),capPoint(spec,end,b,to)];
      batch.face(end > 0 ? ring : ring.toReversed(), colors[j-1], visible && j === 4 ? litSurface.brtGlass : 0);
    }
  }
  return across.map(d => capPoint(spec,end,d,3.21));
}

function lens(batch, spec, end, side, x1, x2, bottom, top, color, extension = .023) {
  const shape = [[x2,bottom+.033],[x1,bottom],[x1,top-.037],[x2,top]].map(([d,y]) => capPoint(spec,end,side*d,y,extension));
  batch.face(side === end ? shape : shape.toReversed(), color);
}

function body(material, spec) {
  const batch = new MeshBatch();
  sides(batch,spec,-1); sides(batch,spec,1);
  const tail = caps(batch,spec,-1), nose = caps(batch,spec,1);
  for (let i=1; i<nose.length; i++) {
    batch.top([tail[i-1],nose[i-1],nose[i],tail[i]],roofWhite);
  }
  const [rear, front] = [-1,1].map(end => capPoint(spec,end,0,.38)[0]);
  slab(batch,(front+rear)/2,0,front-rear-.1,2.17,.35,.44,'#425453','#8c9590');
  const [u, boxWidth] = spec.front ? [-.72,spec.length*.37] : [.36,spec.length*.43];
  slab(batch,u,0,boxWidth,1.63,3.20,3.36,'#aeb9b4','#d5dbd5');
  slab(batch,u-.06,0,boxWidth-.22,1.46,3.36,3.445,'#98aaa9','#c9d3cb');
  for (let x = u - boxWidth/2 + .24; x < u + boxWidth/2 - .12; x += .22) {
    slab(batch,x,-.44,.055,.39,3.44,3.45,'#657777');
    slab(batch,x,.44,.055,.39,3.44,3.45,'#657777');
  }
  for (const x of [rear+.94,front-1.08]) slab(batch,x,0,.58,.66,3.209,3.246,'#bec7c2');

  const headlights = new MeshBatch(), taillights = new MeshBatch();
  if (spec.front) {
    for (const side of [-1,1]) {
      lens(batch,spec,1,side,.47,.895,.667,1.00,'#b8c5c5',.03);
      lens(batch,spec,1,side,.516,.85,.697,.959,'#374449',.045);
      lens(headlights,spec,1,side,.536,.838,.718,.796,'#fff0cb',.055);
      const h = capPoint(spec,1,side,2.60)[0];
      slab(batch,h-.048,side*1.378,.09,.37,2.51,2.6,pillar);
      slab(batch,h-.073,side*1.568,.16,.113,2.22,2.60,'#2d3f45','#4b595c');
      slab(batch,h-.159,side*1.568,.013,.097,2.25,2.566,'#a6bec2');
      const wiper = capPoint(spec,1,side*.32,1.46,.018);
      const end = capPoint(spec,1,side*.76,1.61,.020);
      const strip = [wiper,end,[end[0],end[1]+.027,end[2]],[wiper[0],wiper[1]+.027,wiper[2]]];
      batch.face(side > 0 ? strip.toReversed() : strip,pillar);
    }
    const logo=Array.from({length:14},(_,i)=> {
      const t=i*TAU/14;
      return capPoint(spec,1,.067*Math.cos(t),.8+.066*Math.sin(t),.022);
    });
    batch.face(logo.toReversed(),'#c0ccc8');
    lens(batch,spec,1,1,-.03,.03,.778,.820,'#475a5e',.028);
  }
  if (spec.rear) {
    for (const side of [-1,1]) {
      lens(batch,spec,-1,side,.86,.951,.76,1.347,'#34454e',.029);
      lens(taillights,spec,-1,side,.878,.939,.79,1.309,'#d64437',.042);
    }
  }
  for (const end of [-1,1]) {
    if (end > 0 ? !spec.front : !spec.rear) continue;
    lens(batch,spec,end,1,-.184,.184,.55,.68,'#90bb75',.026);
  }
  const doors = spec.doors.map(u => {
    slab(batch,u,1.154,doorWidth,.06,.395,.448,'#7b8787');
    slab(batch,u,1.045,doorWidth,.10,.52,.57,'#6f7876','#b2b1a3');
    slab(batch,u,1.008,doorWidth,.035,.566,2.68,'#2c3436');
    for (const side of [-1,1]) {
      slab(batch,u + side * .623,1.251,.052,.065,.449,2.73,'#263640');
      slab(batch,u + side * .58,1.191,.026,.032,.54,2.51,'#c5ae5e');
    }
    return u;
  });
  const empty = new THREE.Group();
  return { ...spec, doors,
    shell: batch.finish(empty, material).geometry,
    headlights: headlights.finish(empty, material)?.geometry,
    taillights: taillights.finish(empty, material)?.geometry,
  };
}

function doorGeometry(material) {
  const batch = new MeshBatch();
  slab(batch,0,0,.572,.043,.426,2.712,'#344750');
  slab(batch,0,.029,.485,.023,.492,1.017,blue);
  sideFace(batch,1,[[-.248,1.04,.047],[.248,1.04,.047],[.248,2.654,.047],[-.248,2.654,.047]],glass,litSurface.brtGlass);
  slab(batch,0,.042,.49,.021,1.753,1.777,trim);
  slab(batch,0,.035,.482,.015,.621,.680,'#e4af49');
  return batch.finish(new THREE.Group(),material).geometry;
}

function bellows(material) {
  const batch = new MeshBatch();
  const ring = (x, r) => [[x,.42,-1.155*r],[x,.42,1.155*r],[x,2.77,1.155*r],
    [x,3.16,.98*r],[x,3.16,-.98*r],[x,2.77,-1.155*r]];
  for (let i = 0; i < 20; i++) {
    const a = ring((i/20-.5)*jointLength,i%2 ? 1.017 : .932);
    const b = ring(((i+1)/20-.5)*jointLength,i%2 ? .932 : 1.017);
    for (let j = 0; j < a.length; j++) {
      const next = (j+1)%a.length;
      batch.face([b[j],b[next],a[next],a[j]],i%2 ? '#445051' : '#293234');
    }
  }
  return batch.finish(new THREE.Group(),material).geometry;
}

function flexibleSleeve(geometry) {
  const original = geometry.attributes.position.array, normals = geometry.attributes.normal.array;
  const t = new Float32Array(original.length / 3), rows = new Map();
  for (let i=0; i<t.length; i++) {
    t[i] = original[i*3] / jointLength + .5;
    if (!rows.has(t[i])) rows.set(t[i], { q: new THREE.Quaternion(), centre: new THREE.Vector3() });
  }
  const skin = geometry.clone();
  const position = skin.attributes.position.setUsage(THREE.DynamicDrawUsage);
  const normal = skin.attributes.normal.setUsage(THREE.DynamicDrawUsage);
  const point = new THREE.Vector3();
  return {
    skin,
    bend(front, rear, a, b, centre) {
      for (const [p, row] of rows) {
        row.q.slerpQuaternions(rear.quaternion, front.quaternion, p);
        row.centre.lerpVectors(b,a,p).sub(centre);
      }
      for (let i=0; i<t.length; i++) {
        const { q, centre } = rows.get(t[i]), j=i*3;
        point.set(0,original[j+1],original[j+2]).applyQuaternion(q).add(centre);
        position.setXYZ(i,point.x,point.y,point.z);
        point.set(normals[j],normals[j+1],normals[j+2]).applyQuaternion(q);
        normal.setXYZ(i,point.x,point.y,point.z);
      }
      position.needsUpdate = normal.needsUpdate = true;
    },
  };
}

function canvasTexture(w, h, paint) {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  paint(canvas.getContext('2d'),w,h);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function routeBoard(number, destination) {
  const map = canvasTexture(384,72,(ctx,w,h) => {
    ctx.fillStyle = '#10191f'; ctx.fillRect(0,0,w,h);
    ctx.font = '700 49px "PingFang SC","Microsoft Yahei",system-ui,sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#9efebf';
    ctx.fillText(number,16,39,102);
    ctx.fillText(destination,132,39,237);
  });
  return new THREE.MeshBasicMaterial({ map, toneMapped: false });
}

export function brtVehicleFactory(material) {
  const headlight = new THREE.MeshBasicMaterial({ color: '#e3e6d4', toneMapped: false });
  const tail = new THREE.MeshBasicMaterial({ color: '#9f3c31', toneMapped: false });
  const brake = new THREE.MeshBasicMaterial({ color: '#ff674e', toneMapped: false });
  const models = [body(material,standard),body(material,tractor),body(material,trailer)];
  const doors = doorGeometry(material), jointGeometry = bellows(material);
  const board = new THREE.PlaneGeometry(1.61,.29), sideBoard = new THREE.PlaneGeometry(1.62,.30);
  const badgeGeometry = new THREE.PlaneGeometry(1.20,.35);
  const badge = new THREE.MeshBasicMaterial({ map: canvasTexture(240,70,(ctx)=>{
    ctx.font = 'italic 900 58px system-ui,sans-serif'; ctx.fillStyle = '#f4ae4c'; ctx.fillText('BRT',12,57);
  }), transparent: true, alphaTest:.3 });
  const boards = new Map(), sleeveMeshes = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), forward = new THREE.Vector3();
  const jointA = new THREE.Vector3(), jointB = new THREE.Vector3();
  function boardMaterial(number, destination) {
    const key = number + destination;
    if (!boards.has(key)) boards.set(key,routeBoard(number,destination));
    return boards.get(key);
  }
  function part(model) {
    const node = new THREE.Group(), shell = new THREE.Mesh(model.shell,material);
    shell.receiveShadow = true;
    node.add(shell);
    const leaves = model.doors.flatMap(u => [-1,1].map(side => {
      const object = new THREE.Mesh(doors,material);
      object.position.set(u + side * .30,0,1.264);
      node.add(object);
      return { object, u, side };
    }));
    const route = [];
    if (model.front) {
      const screen = new THREE.Mesh(board);
      screen.position.fromArray(capPoint(model,1,0,2.739,.046));
      screen.rotation.y = Math.PI/2;
      node.add(screen); route.push(screen);
      for (const side of [-1,1]) {
        const display = new THREE.Mesh(sideBoard), logo = new THREE.Mesh(badgeGeometry,badge);
        display.position.set(1.08,2.665,side*1.282);
        logo.position.set(model.length/2-2.28,1.362,side*1.282);
        display.rotation.y = logo.rotation.y = side > 0 ? 0 : Math.PI;
        node.add(display,logo); route.push(display);
      }
    }
    if (model.headlights) node.add(new THREE.Mesh(model.headlights,headlight));
    const stopLamp = model.taillights ? new THREE.Mesh(model.taillights,tail) : null;
    if (stopLamp) node.add(stopLamp);
    return { node, shell, stopLamp, leaves, route, length:model.length };
  }
  function align(node, ahead, behind) {
    const dx = ahead.x-behind.x, dz = ahead.z-behind.z;
    node.rotation.set(0,Math.atan2(-dz,dx),Math.atan2(ahead.y-behind.y,Math.hypot(dx,dz)),'YXZ');
  }
  function pose(unit,sample,s) {
    const spread = unit.length*.366;
    sample(s+spread,a); sample(s-spread,b);
    unit.node.position.addVectors(a,b).multiplyScalar(.5);
    align(unit.node,a,b);
  }
  return {
    create(parent, routeName, outboundDestination, articulated) {
      const group = new THREE.Group();
      group.name = 'BRT · ' + routeName + (articulated ? ' 18 米铰接车' : ' 12 米单车');
      const front = part(models[articulated?1:0]), rear = articulated ? part(models[2]) : front;
      const units = articulated ? [front,rear] : [front];
      group.add(...units.map(unit=>unit.node));
      const sleeve = articulated ? flexibleSleeve(jointGeometry) : null;
      const joint = sleeve ? new THREE.Mesh(jointGeometry,material) : null;
      if (sleeve) {
        sleeveMeshes.push(sleeve.skin);
        joint.frustumCulled = false;
        group.add(joint);
      }
      const outbound = boardMaterial(routeName,outboundDestination), inbound = boardMaterial(routeName,'第一码头');
      for (const display of front.route) display.material = outbound;
      parent.add(group);
      return {
        group,
        place(s, sample, near) {
          pose(front,sample,s+(joint?offsets[0]:0));
          if (!joint) return;
          pose(rear,sample,s+offsets[1]);
          forward.set(1,0,0).applyQuaternion(front.node.quaternion);
          jointA.copy(front.node.position).addScaledVector(forward,-front.length/2+.13);
          forward.set(1,0,0).applyQuaternion(rear.node.quaternion);
          jointB.copy(rear.node.position).addScaledVector(forward,rear.length/2-.13);
          joint.position.addVectors(jointA,jointB).multiplyScalar(.5);
          joint.geometry = near ? sleeve.skin : jointGeometry;
          if (near) {
            joint.rotation.set(0,0,0);
            joint.scale.x = 1;
            sleeve.bend(front.node,rear.node,jointA,jointB,joint.position);
          } else {
            joint.scale.x = jointA.distanceTo(jointB)/jointLength;
            align(joint,jointA,jointB);
          }
        },
        show({ opening=0, braking=false, returning=false }, near) {
          for (const display of front.route) display.material = returning ? inbound : outbound;
          for (const unit of units) {
            unit.shell.castShadow = near;
            for (const { object, u, side } of unit.leaves) {
              object.position.x = u + side * (.30 + .31 * opening);
              object.position.z = 1.264 + .059 * opening;
            }
          }
          rear.stopLamp.material = braking ? brake : tail;
        },
      };
    },
    update(night) {
      headlight.color.set('#fff7de').multiplyScalar(.49+.64*night);
    },
    dispose() {
      for (const item of boards.values()) {
        item.map.dispose();
        item.dispose();
      }
      for (const sleeve of sleeveMeshes) sleeve.dispose();
      jointGeometry.dispose();
      badge.map.dispose();
    },
  };
}
