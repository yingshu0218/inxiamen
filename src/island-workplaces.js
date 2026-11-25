import { ShapeUtils, Vector2 } from 'three';
import survey from './island-workplaces.json' with { type: 'json' };
import { litSurface, prism } from './scenery-mesh.js';

const finishes = {
  podium: ['#a0988b', '#b9b0a1', litSurface.shopfront],
  officeWest: ['#afaa99', '#c8beaa', 1],
  officeMiddle: ['#98a8a8', '#bdb2a3', litSurface.office],
  officeEast: ['#a4aaa1', '#c3b6a4', litSurface.office],
  crown: ['#b6a99a', '#a99580', 0],
  research: ['#c5cccb', '#d6d4c8', litSurface.office],
  wing: ['#b9bfc0', '#c5c1ad', litSurface.office],
  wingLink: ['#87979a', '#a6aaa3', litSurface.office],
  residence: ['#bcbbaf', '#ccc7ba', 20],
  campusOffice: ['#aea6a0', '#c8c6b9', litSurface.office],
  stair: ['#769096', '#b5bcb9', litSurface.office],
  plant: ['#b0b0a2', '#bebab0', 0],
};
const paving = {
  court: '#a9a594',
  courtInset: '#6f8892',
  forecourt: '#b4afa2',
};

// Suppression is tied to reviewed XMC1 geometry, independent of record order.
const footprintKey = rings => rings.map(ring => ring.join(';')).join('|');
const replacements = survey.map(({ bounds, retire }) => ({
  bounds, footprints: new Set(retire.map(({ rings }) => footprintKey(rings))),
}));

export function replacesWorkplaceFootprint({ rings }) {
  const [x,z] = rings[0][0];
  return replacements.some(({ bounds:[west,north,east,south], footprints }) =>
    x >= west && x <= east && z >= north && z <= south && footprints.has(footprintKey(rings)));
}

function drawPaving(batch, geo, { ring, finish }) {
  const points = ring.map(p => new Vector2(...p));
  const lift = finish === 'courtInset' ? .48 : .34;
  for (const face of ShapeUtils.triangulateShape(points, [])) {
    batch.top(face.map(i => {
      const [x,z] = ring[i];
      return [x,geo.heightAt(x,z)+lift,z];
    }),paving[finish],litSurface.railPlaza);
  }
}

function drawSite(batch, geo, index, { buildings, outdoor = [] }) {
  for (const surface of outdoor) drawPaving(batch,geo,surface);
  for (const { parts } of buildings) {
    const elevations = parts[0].ring.map(([x,z]) => geo.heightAt(x,z)).sort((a,b) => a-b);
    const floor = elevations[elevations.length >> 1];
    for (const { ring, bottom, height, finish } of parts) {
      const [wall,roof,style] = finishes[finish];
      const top = floor+height;
      if (bottom) {
        prism(batch,ring,floor+bottom,top,wall,roof,style,.46,0,22);
      } else {
        const earth = Math.min(...ring.map(([x,z]) => geo.heightAt(x,z))) - .35;
        const plinth = finish === 'research' ? 3.4 : finish === 'campusOffice' ? 2.5 : .55;
        const baseColor = finish === 'research' || finish === 'campusOffice' ? '#9c6c62' : '#a69c8b';
        prism(batch,ring,Math.min(earth,floor),floor+plinth,baseColor,null);
        prism(batch,ring,floor+plinth,top,wall,roof,style,.46,0,22);
      }
      index.add(ring,top);
    }
  }
}

export function buildBinbeiOffices(batch, geo, lamps, index) {
  drawSite(batch,geo,index,survey[0]);
}

export function buildTorchHightech(batch, geo, lamps, index) {
  drawSite(batch,geo,index,survey[1]);
}
