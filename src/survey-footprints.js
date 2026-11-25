// XMC1 geometry keys remain valid when the shared file is reordered.
const footprintKey = rings => rings.map(ring => ring.join(';')).join('|');

export function surveyedFootprintFilter({ bounds:[west,north,east,south], retire }) {
  const footprints = new Set(retire.map(({ rings }) => footprintKey(rings)));
  return ({ rings }) => {
    const [x,z] = rings[0][0];
    return x>=west && x<=east && z>=north && z<=south && footprints.has(footprintKey(rings));
  };
}
