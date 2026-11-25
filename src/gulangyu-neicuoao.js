import survey from './gulangyu-neicuoao.json' with { type: 'json' };

export const neicuoaoSurvey = survey;
const surveyed = new Map(survey.buildings.map(record => [record.match, record]));

export function neicuoaoFootprintKey(ring) {
  let x = 0, z = 0;
  for (const point of ring) {
    x += point[0];
    z += point[1];
  }
  return [Math.round(2*x/ring.length),Math.round(2*z/ring.length),ring.length].join(',');
}

export function neicuoaoPieces(building) {
  const point = building.rings[0][0];
  if (point[0] < -6755 || point[0] > -6490 || point[1] < 3400 || point[1] > 3600)
    return undefined;
  const record = surveyed.get(neicuoaoFootprintKey(building.rings[0]));
  return record?.pieces.map(piece => ({
    ...building,
    ...neicuoaoHouse(piece),
    rings: piece.ring ? [piece.ring] : building.rings,
  }));
}

function neicuoaoHouse({ roof }) {
  return { base:0, use:1, height:roof[1]+roof[2], neicuoaoRoof:roof, reviewedDistrict:true };
}

export const neicuoaoImageHouses = survey.imageBuildings.map(piece => ({
  ...neicuoaoHouse(piece), rings:[piece.ring],
}));

export const neicuoaoViews = [
  {id:'neicuoao-roofs',name:'内厝澳 · 屋顶低空',viewOnly:true, x:-6631,z:3508,focusHeight:22,fov:54,portraitFovBoost:29,
    view:{x:-6752,y:118,z:3570}, portraitView:{x:-6804,y:161,z:3582}},
  {id:'bishan-lane',name:'笔山路 · 坡巷街口',viewOnly:true, x:-6573,z:3558,focusHeight:26,fov:63,
    view:{x:-6615,y:25.6,z:3552}},
];
