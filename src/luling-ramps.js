// OSM defines one lane on these connectors around Lvling Road. The packaged
// street tiles split some ways at intersections, so match only surveyed pieces.
const connectors = new Map([
  ['554,-1088/767,-1586', '127162238'],
  ['767,-1586/785,-1669', '127162238'],
  ['738,-2034/745,-1725', '127162248'],
  ['745,-1725/770,-1675', '127162248'],
  ['785,-1669/797,-1660', '128826955'],
  ['763,-1823/785,-1676', '128827209'],
  ['746,-1618/769,-1671', '129281105'],
  ['666,-1312/746,-1618', '129281105'],
]);

export function lulingConnector(kind, flags, layer, flat) {
  if ((kind !== 4 && kind !== 5) || flags !== 2 || layer !== 0 || flat.length < 4) return undefined;
  const ax = flat[0], az = flat[1], bx = flat.at(-2), bz = flat.at(-1);
  if (ax < 500 || ax > 810 || bx < 500 || bx > 810 || az < -2040 || az > -1080 || bz < -2040 || bz > -1080)
    return undefined;
  return connectors.get([ax + ',' + az, bx + ',' + bz].sort().join('/'));
}

export const lulingConnectorWidth = 4.6;

const missingRampNodes = [
  { before: [756, -1672], point: [769, -1671], after: [785, -1669] },
  { before: [809, -1677], point: [785, -1676], after: [770, -1675] },
];

export function withLulingJunctions(kind, flags, layer, flat) {
  if (kind !== 4 || flags !== 0 || layer !== 0) return flat;
  for (let i = 0; i < flat.length - 2; i += 2) {
    const join = missingRampNodes.find(({ before, after }) =>
      flat[i] === before[0] && flat[i + 1] === before[1] &&
      flat[i + 2] === after[0] && flat[i + 3] === after[1]);
    if (join) return [...flat.slice(0, i + 2), ...join.point, ...flat.slice(i + 2)];
  }
  return flat;
}
