import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { elevationField, reliefCoverage } from '../src/geography.js';
import { gradeOldTown } from '../src/old-town-layout.js';
import { gradeShapoweiBank } from '../src/shapowei-bank.js';
import { gradeAirport } from '../src/airport-layout.js';
import { gradeHubin } from '../src/hubin-layout.js';
import { gradeRailway } from '../src/railway-layout.js';
import { gradeGaoqiRailway } from '../src/gaoqi-railway-layout.js';
import { gradeCampusPlayingFields } from '../src/campus-layout.js';
import { refineShoreTerrain } from '../src/shore-grading.js';
import { mazeWater } from '../src/parks/layout.js';
import { readLakes } from '../src/inland-water.js';
import { inRing } from '../src/scenery-mesh.js';
import { runway } from '../src/route.js';

// Load the island DEM, water polygons and coastline used by the offline road checks.
export function loadMainlandRoadGeography() {
  const dir = 'public/geo/';
  const read = name => readFileSync(dir + name);
  const json = name => JSON.parse(read(name));
  const i16 = name => {
    const bytes = read(name);
    return new Int16Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length));
  };
  const bounds = json('manifest.json');
  const relief = json('xiamen-relief.json');
  const islands = json('islands.json');
  const samples = i16('xiamen-relief.bin');
  const outer = i16('terrain.bin');
  for (const [grid, values] of [[relief, samples], [bounds, outer]]) {
    gradeAirport(runway, grid, values);
    gradeOldTown(grid, values);
    if (grid === relief) gradeShapoweiBank(grid, values);
    gradeHubin(grid, values);
    gradeRailway(grid, values);
    gradeGaoqiRailway(grid, values);
    gradeCampusPlayingFields(grid, values);
  }
  const { lakes, waterAt, isletAt } = readLakes([...json('inland-water.json').water, mazeWater]);
  const { width, height } = bounds.coastDistanceEncoding;
  const coastRaster = execFileSync('python3', ['-c',
    'import sys; from PIL import Image; sys.stdout.buffer.write(Image.open(sys.argv[1]).convert("L").tobytes())',
    dir + 'coast-distance.png'], { maxBuffer: width * height + 1000 });
  const distanceAt = elevationField({ ...bounds, width, height }, coastRaster);
  const coastDistance = (x, z) => (distanceAt(x, z) - 128) * 2;
  const step = (relief.xmax - relief.xmin) / (relief.width - 1);
  const islandDisplay = Float32Array.from(samples, (sample, i) => {
    const y = sample * relief.metresPerUnit;
    if (y <= -5 || y >= .88) return Math.max(-12, y);
    const x = relief.xmin + i % relief.width * step;
    const z = relief.zmin + Math.floor(i / relief.width) * step;
    return waterAt(x, z) ? y : .88;
  });
  const islandHeight = elevationField(relief, samples, relief.metresPerUnit);
  const outerHeight = elevationField(bounds, outer);
  const islandTerrain = elevationField(relief, islandDisplay);
  const inRelief = reliefCoverage(relief);
  const rendered = (x, z) => inRelief(x, z) ? islandTerrain(x, z) : outerHeight(x, z);
  const refinements = refineShoreTerrain(lakes, coastDistance, rendered, elevationField);
  const refinement = (x, z) => refinements.find(patch => patch.contains(x, z))?.sample(x, z);
  const roadTerrainAt = (x, z) => refinement(x, z) ?? rendered(x, z);
  const rawHeightAt = (x, z) => refinement(x, z) ?? (inRelief(x, z) ? islandHeight(x, z) : outerHeight(x, z));
  const heightAt = (x, z) => waterAt(x, z)?.h ?? Math.max(isletAt(x, z) ? .88 : 0, rawHeightAt(x, z));
  const onMainland = (x, z) => inRing(x, z, islands.xiamen);
  return {
    islands, coastDistance, heightAt, rawHeightAt, roadTerrainAt, onMainland,
    waterAt, isletAt, islandSurfaceHeightAt: islandTerrain,
  };
}
