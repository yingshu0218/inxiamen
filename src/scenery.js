import * as THREE from 'three';
import { MeshBatch, LampBatch, ObstacleIndex, archMaterial } from './scenery-mesh.js';
import { buildAirport } from './scenery-airport.js';
import { buildLandmarks } from './scenery-landmarks.js';
import { vegetate, maritime } from './scenery-life.js';
import { addGroves } from './scenery-groves.js';
import { addStreets, bridgeCorridors } from './scenery-streets.js';
import { islandForeshore } from './gulangyu-neighborhoods.js';
import { applyGulangyuMaterials } from './landmark-gulangyu.js';
import { addSunlightVisitors } from './sunlight-visitors.js';

import { buildSiliGround } from './sili-community.js';
import { buildCity } from './city-layout.js';
import { addDistrictSigns, addOldTownSigns } from './old-town-signs.js';
import { hubinBuses } from './hubin-transit.js';
import { oldTownWalkers } from './old-town-walkers.js';
import { addRailwaySigns } from './landmark-railway.js';
import { addRailwayTrains } from './railway-traffic.js';
import { wucunCoaches } from './wucun-transit.js';
import { buildBrtScenery } from './brt-scenery.js';
import { addBrtTraffic } from './brt-traffic.js';
import { brtVehicleFactory } from './brt-vehicle.js';
import { northCrossingTransit } from './north-crossing-transit.js';
import { buildHuandao } from './coast/scenery.js';
import { addVenueSigns } from './venue-signs.js';

async function readJSON(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error('建筑资源读取失败 ' + path);
  return response.json();
}

async function readBinary(path) {
  const response=await fetch(path);
  if(!response.ok) throw new Error('城市资源读取失败 '+path);
  return response.arrayBuffer();
}

export async function createScenery({ scene, geo, runway }) {
  const group = new THREE.Group();
  group.name = '厦门城市与滨海地标';
  const darkness = { value: 0 }, minute = { value: 0 };
  const lamps = new LampBatch(),
    obstacles = new ObstacleIndex();
  const [buildings, residentialBlocks, streets, trees, coastalCover, bankTrees, atlas, occlusion, signAtlas, reflection, inscriptionMask, graniteDetail] = await Promise.all([
    readBinary('/geo/city-layout.bin'),
    readJSON('/geo/residential-blocks.json'),
    readJSON('/geo/urban-streets.json'),
    readBinary('/scenery/canopies.bin'),
    readBinary('/scenery/gulangyu-cover.bin'),
    readBinary('/geo/lake-canopies.bin'),
    new THREE.TextureLoader().loadAsync('/scenery/canopy-atlas.webp'),
    new THREE.TextureLoader().loadAsync('/scenery/city-occlusion.webp'),
    new THREE.TextureLoader().loadAsync('/scenery/old-town-signs.webp'),
    new THREE.TextureLoader().loadAsync('/scenery/hubin-reflection.webp'),
    new THREE.TextureLoader().loadAsync('/scenery/sunlight-inscriptions.png'),
    new THREE.TextureLoader().loadAsync('/scenery/sunlight-granite.webp'),
  ]);
  inscriptionMask.anisotropy = 4;
  graniteDetail.wrapS = graniteDetail.wrapT = THREE.RepeatWrapping;
  graniteDetail.anisotropy = 4;
  const material = applyGulangyuMaterials(archMaterial(darkness, minute), inscriptionMask, graniteDetail);
  reflection.colorSpace = THREE.SRGBColorSpace;
  reflection.wrapS = THREE.RepeatWrapping;
  reflection.anisotropy = 4;
  const facade = {facadeView: {value: reflection}};
  const broadcastMaterial = archMaterial(darkness, minute, facade);
  const groundMaterials = new Map();
  if (geo.group)
    geo.group.traverse((node) => {
      const mat = node.material;
      if (!mat?.isMeshStandardMaterial || groundMaterials.has(mat)) return;
      groundMaterials.set(mat, [mat.aoMap, mat.aoMapIntensity]);
      mat.aoMap = occlusion;
      mat.aoMapIntensity = 0.62;
      mat.needsUpdate = true;
    });
  const frame = buildAirport(group, geo, runway, material, lamps, obstacles);
  const signs = [], cliffPlantings = [];
  const roads = buildLandmarks(group, geo, material, lamps, obstacles, signs, broadcastMaterial, cliffPlantings);
  buildSiliGround(group,geo,material,obstacles,signs,cliffPlantings);
  const lightSigns = addOldTownSigns(group, signs, signAtlas);
  const railwaySigns = addRailwaySigns(group);
  const districtSigns = addDistrictSigns(group, signs);
  const venueSigns = addVenueSigns(group, signs);
  const brtSigns = buildBrtScenery(group, geo, material, lamps, obstacles);
  const coastSign = buildHuandao(group, geo, material, lamps, obstacles);
  const roadVegetationBlocked = addStreets(group, geo, streets.roads, material, frame, lamps, roads);
  const bridgeFootprint = bridgeCorridors(roads.filter((road) => road.carOffsets)
    .flatMap((road) => road.metro ? [road, road.metro] : [road]));
  const updateCity = await buildCity(group, geo, frame, material, obstacles, buildings, bridgeFootprint, residentialBlocks.blocks);
  const islandCover = new Int16Array(coastalCover), shoreline = new MeshBatch();
  islandForeshore(shoreline, islandCover, geo, obstacles);
  const rocks = shoreline.finish(group, material, '鼓浪屿岸礁');
  if (rocks) rocks.castShadow = rocks.receiveShadow = true;
  addGroves(group, geo, new Int16Array(trees), islandCover, new Int16Array(bankTrees), atlas, darkness, frame, obstacles, cliffPlantings, roadVegetationBlocked);
  vegetate(group, geo, frame, obstacles, material, roadVegetationBlocked);
  const moveTraffic = maritime(group, geo, material, roads, darkness);
  const moveBuses = hubinBuses(group, geo, material);
  const moveWalkers = oldTownWalkers(group, geo);
  const updateSunlightVisitors = addSunlightVisitors(group);
  const moveTrains = addRailwayTrains(group, geo, material);
  const updateCoaches = wucunCoaches(group, geo, material);
  const brtModels = brtVehicleFactory(material);
  const moveBrt = addBrtTraffic(group, geo, brtModels);
  const moveCrossingTransit = northCrossingTransit(group, roads, material, brtModels);
  lamps.finish(group, darkness);
  scene.add(group);
  return {
    group,
    bindFacadeSky(sky) { Object.assign(facade, sky); },
    obstacleHeight: (x, z) => obstacles.heightAt(x, z),
    update(_dt, simSeconds, night, viewer, localMinute=minute.value) {
      darkness.value = THREE.MathUtils.clamp(night, 0, 1);
      minute.value = localMinute;
      updateCity(viewer.x, viewer.z);
      lightSigns(darkness.value);
      railwaySigns.update(darkness.value);
      districtSigns.update(darkness.value);
      venueSigns.update(darkness.value);
      brtSigns.update(darkness.value);
      moveTraffic(simSeconds, viewer);
      moveBuses(simSeconds, viewer);
      moveWalkers(simSeconds, viewer);
      updateSunlightVisitors(viewer, darkness.value);
      moveTrains(simSeconds, viewer);
      updateCoaches(viewer);
      brtModels.update(darkness.value);
      moveBrt(simSeconds, viewer);
      moveCrossingTransit(simSeconds, viewer);
    },
    dispose() {
      group.removeFromParent();
      coastSign.dispose();
      atlas.dispose();
      inscriptionMask.dispose();
      graniteDetail.dispose();
      signAtlas.dispose();
      railwaySigns.texture.dispose();
      districtSigns.texture.dispose();
      venueSigns.texture.dispose();
      brtSigns.texture.dispose();
      brtModels.dispose();
      reflection.dispose();
      for (const [mat, [oldMap, oldStrength]] of groundMaterials) {
        if (mat.aoMap === occlusion) {
          mat.aoMap = oldMap;
          mat.aoMapIntensity = oldStrength;
          mat.needsUpdate = true;
        }
      }
      occlusion.dispose();
      const geometries = new Set(),
        materials = new Set();
      group.traverse((obj) => {
        if (obj.geometry) geometries.add(obj.geometry);
        if (obj.material) materials.add(obj.material);
        if (obj.isInstancedMesh) obj.dispose();
      });
      for (const geometry of geometries) geometry.dispose();
      for (const mat of materials) mat.dispose();
    },
  };
}
