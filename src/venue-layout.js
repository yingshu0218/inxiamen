import { localFrame, rect } from './landmark-forms.js';
import { inRing } from './scenery-mesh.js';

export const exhibitionPoint = localFrame([5440, 1130], .435);
export const culturePoint = localFrame([-2140, -1420], -.29);

// OpenStreetMap outlines, expressed in each site's axes. At the exhibition
// centre, positive u faces the sea and positive v follows the halls south.
const exhibitionRing = (ring) => ring.map(([u, v]) => exhibitionPoint(u, v));
export const exhibitionMain = exhibitionRing([
  [-103, -34], [-60, -35], [-71, -180], [-47, -180], [-47, -189], [-36, -194],
  [49, -195], [68, -188], [65, -22], [67, 66], [65, 158], [69, 230], [52, 230],
  [-35, 232], [-48, 219], [-70, 219], [-64, 144], [-59, 72], [-101, 73],
]);

export const exhibitionHalls = [
  {
    ring: exhibitionRing([
      [-304, -301], [-292, -215], [-262, -204], [-261, -175], [-177, -175],
      [-180, -210], [58, -210], [58, -219], [85, -221], [89, -239], [87, -271],
      [93, -272], [90, -334], [47, -338], [-216, -335], [-231, -325], [-259, -322], [-275, -299],
    ]),
    height: 19.6, roof: [-76, -271, 290, 96], skylights: 5,
  },
  {
    ring: exhibitionRing([
      [-301, 309], [-279, 309], [-279, 319], [-262, 319], [-262, 326], [-235, 335],
      [114, 336], [112, 286], [106, 277], [100, 278], [98, 247], [-60, 243],
      [-60, 234], [-126, 234], [-126, 203], [-159, 202], [-160, 175], [-244, 175],
      [-244, 192], [-280, 193], [-289, 202],
    ]),
    height: 19.6, roof: [-91, 289, 342, 64], skylights: 5,
  },
  {
    ring: exhibitionRing([[-279, 74], [-277, 170], [-157, 171], [-158, 73]]),
    height: 16.2, roof: [-218, 122, 109, 87], skylights: 3, entry: 73, label: 'A1',
  },
  {
    ring: exhibitionRing([[-275, -168], [-277, -37], [-158, -37], [-157, -169]]),
    height: 16.2, roof: [-217, -103, 109, 120], skylights: 3, entry: -37, label: 'B1',
  },
  {
    ring: exhibitionRing([[116, 254], [116, 314], [222, 316], [224, 281], [203, 253]]),
    height: 13.2, roof: [162, 284, 79, 51], skylights: 2,
  },
];

export const theatreCentre = [213.3, -264.7];
export const theatreFootprint = rect(exhibitionPoint, ...theatreCentre, 213.4, 119.3);
export const theatreCourt = [321.5, 366, -318, -210];

// The two seaward terraces follow the mapped outline. Each section stores
// its v position and landward and seaward edges at that position.
export const waterfrontSections = [
  [-144, 134, 140], [-132, 130, 168], [-114, 122, 160], [-67, 109, 145],
  [-28, 102, 139], [5, 100, 138], [35, 101, 136], [63, 102, 137],
  [100, 107, 143], [128, 113, 151], [170, 126, 166], [177, 129, 168], [188, 133, 138],
];
export const waterfrontFootprint = exhibitionRing([
  ...waterfrontSections.map(([v, west]) => [west, v]),
  ...waterfrontSections.toReversed().map(([v, , east]) => [east, v]),
]);
export const exhibitionLink = rect(exhibitionPoint, 94, 20, 91, 30);

export const cultureHalls = [
  { name: '厦门科技馆', u: -39.2, v: -82.3, width: 92.6, depth: 149.6, height: 17.7, entrance: 'court' },
  { name: '厦门市博物馆', u: 59.3, v: -82.3, width: 104.4, depth: 149.6, height: 20.0, entrance: 'east' },
  { name: '厦门市文化馆', u: -38.4, v: 100.9, width: 94.7, depth: 150.2, height: 16.4, entrance: 'court' },
  { name: '厦门市图书馆', u: 60.0, v: 100.2, width: 103.0, depth: 149.6, height: 18.7, entrance: 'east' },
].map((hall) => ({ ...hall, ring: rect(culturePoint, hall.u, hall.v, hall.width, hall.depth) }));

const culturePassage = rect(culturePoint, -9, 9.2, 295, 27.5);
const [courtWest, courtEast, courtNorth, courtSouth] = theatreCourt;
const theatreCourtFootprint = rect(exhibitionPoint, (courtWest + courtEast) / 2, (courtNorth + courtSouth) / 2,
  courtEast - courtWest, courtSouth - courtNorth);
const cultureEastCourt = rect(culturePoint, 146, 6, 68, 260);

const exhibitionFootprints = [exhibitionMain, theatreFootprint, theatreCourtFootprint, waterfrontFootprint, exhibitionLink,
  ...exhibitionHalls.map(({ ring }) => ring)];

export function venueReserved(x, z) {
  if (x > 5025 && x < 5935 && z > 720 && z < 1520)
    return exhibitionFootprints.some((ring) => inRing(x, z, ring));
  if (x > -2310 && x < -1920 && z > -1615 && z < -1215)
    return inRing(x, z, culturePassage) || inRing(x, z, cultureEastCourt) ||
      cultureHalls.some(({ ring }) => inRing(x, z, ring));
  return false;
}
