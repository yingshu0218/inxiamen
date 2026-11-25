import { inRing, signedArea } from './scenery-mesh.js';

const finishes = {
  warm: {
    walls: ['#c4aaa0', '#c0a599', '#c9b1a3'],
    roofs: ['#9c7262', '#a37b69', '#947061'],
  },
  sunlit: {
    walls: ['#c8b497', '#c4b094', '#cdbba4'],
    roofs: ['#a59b89', '#a99e8e', '#9e9485'],
  },
  cool: {
    walls: ['#b7b6a7', '#afafa0', '#bcbbad'],
    roofs: ['#91968e', '#969a92', '#8d9088'],
  },
};

function bounds(ring) {
  let west = Infinity, east = -Infinity, north = Infinity, south = -Infinity;
  for (const [x, z] of ring) {
    west = Math.min(west, x);
    east = Math.max(east, x);
    north = Math.min(north, z);
    south = Math.max(south, z);
  }
  return { west, east, north, south };
}

function edges(ring) {
  return ring.map((point, i) => [point, ring[(i + 1) % ring.length]]);
}

function side([ax, az], [bx, bz], [x, z]) {
  return (bx - ax) * (z - az) - (bz - az) * (x - ax);
}

function touches([a, b], [c, d]) {
  return (
    Math.max(a[0], b[0]) >= Math.min(c[0], d[0]) && Math.max(c[0], d[0]) >= Math.min(a[0], b[0]) &&
    Math.max(a[1], b[1]) >= Math.min(c[1], d[1]) && Math.max(c[1], d[1]) >= Math.min(a[1], b[1]) &&
    side(a, b, c) * side(a, b, d) <= 0 && side(c, d, a) * side(c, d, b) <= 0
  );
}

function covers(block, ring) {
  const { west, east, north, south } = block.bounds;
  return ring.every(([x, z]) => x > west && x < east && z > north && z < south &&
    inRing(x, z, block.ring) && !block.holes?.some(hole => inRing(x, z, hole))) &&
    !block.holes?.some(hole => inRing(...hole[0], ring)) &&
    !edges(ring).some(edge => block.edges.some(boundary => touches(edge, boundary)));
}

function overlap(a, b) {
  return a.west <= b.east && a.east >= b.west && a.north <= b.south && a.south >= b.north;
}

function intersects(a, b) {
  return inRing(...a[0], b) || inRing(...b[0], a) ||
    edges(a).some(edge => edges(b).some(other => touches(edge, other)));
}

const cellSize = 300;
const key = (i, j) => i * 2048 + j;

function* cells({ west, east, north, south }) {
  for (let i = Math.floor(west / cellSize); i <= Math.floor(east / cellSize); i++)
    for (let j = Math.floor(north / cellSize); j <= Math.floor(south / cellSize); j++)
      yield key(i, j);
}

function spatialIndex(items) {
  const index = new Map();
  for (const item of items) {
    for (const cell of cells(item.bounds)) {
      if (!index.has(cell)) index.set(cell, []);
      index.get(cell).push(item);
    }
  }
  return index;
}

export function* applyResidentialBlocks(buildings, plans) {
  const blocks = plans.map(plan => ({
    ...plan, bounds: bounds(plan.ring),
    edges: [plan.ring, ...(plan.holes ?? [])].flatMap(edges), finish: finishes[plan.style],
  }));
  const additions = blocks.flatMap(block => block.roofs
    .filter(roof => covers(block, roof.rings[0]))
    .map(roof => ({ roof, block, bounds: bounds(roof.rings[0]), occupied: false })));
  const blocksByCell = spatialIndex(blocks);
  const roofsByCell = spatialIndex(additions);

  for (const building of buildings) {
    const ring = building.rings[0];
    const [x, z] = ring[0];
    const local = blocksByCell.get(key(Math.floor(x / cellSize), Math.floor(z / cellSize)));
    const block = local?.find(block => covers(block, ring));
    if (block && !block.keepFrontage && building.streetFrontage && building.use === 1 && !building.base) continue;

    // A later base dataset may already contain this building. Keep the base geometry.
    if (additions.length) {
      const roofBounds = bounds(ring);
      for (const cell of cells(roofBounds)) {
        for (const item of roofsByCell.get(cell) ?? []) {
          if (!item.occupied && overlap(roofBounds, item.bounds) && intersects(ring, item.roof.rings[0])) item.occupied = true;
        }
      }
    }

    const home = block && !building.base && (building.use === 1 ||
      (!building.use && building.height < 72 && Math.abs(signedArea(ring)) < 1100));
    yield home ? {
      ...building, residentialFinish: block.finish, reviewedDistrict: building.reviewedDistrict || block.kind === 'pilot',
    } : building;
  }

  for (const { roof, block, occupied } of additions) {
    if (!occupied) yield {
      rings: roof.rings, height: roof.height, base: 0, use: 1,
      mappedHeight: roof.heightSource === 'mapped',
      residentialFinish: block.finish, reviewedDistrict: block.kind === 'pilot',
    };
  }
}
