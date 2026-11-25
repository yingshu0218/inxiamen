import * as THREE from 'three';
import { loadGeography } from './geography.js';
import { createAtmosphere, lightPresetMinute } from './atmosphere.js';
import { createAircraft } from './aircraft.js';
import { createScenery } from './scenery.js';
import { Flight } from './flight.js';
import { AirlinerArrival } from './airliner-arrival.js';
import { FlightCamera } from './view.js';
import { fitIslandView } from './free-camera.js';
import { routeHeading, routePoint, runway, selectedFlightPlace } from './route.js';
import { createNightBloom } from './night-bloom.js';

export async function createGame(host, sound, onFrame, onArrival, loading) {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  const mobile = matchMedia('(pointer:coarse)').matches;
  const renderScene = createNightBloom(renderer, mobile);
  const baseRatio = Math.min(devicePixelRatio, mobile ? 1.45 : 1.65);
  renderer.setPixelRatio(baseRatio);
  renderer.shadowMap.enabled = !mobile;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const canvas = renderer.domElement;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', '可拖动视角的厦门三维飞行场景');
  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera(55, 1, 0.55, 82000);
  loading('正在加载厦门地形…');
  let geo, scenery, atmosphere, aircraft, flight;
  try {
    geo = await loadGeography(renderer, runway);
    scene.add(geo.group);
    loading('正在准备地标、飞机与天空…');
    [scenery, atmosphere] = await Promise.all([
      createScenery({ scene, geo, runway }),
      createAtmosphere(scene, geo, renderer),
    ]);
    scenery.bindFacadeSky(atmosphere.facadeSky);
    atmosphere.shadeSurfaces(scene);
  } catch (error) {
    renderer.dispose();
    throw error;
  }
  host.replaceChildren(canvas);
  const rig = new FlightCamera(camera, aircraft, geo, canvas, scenery.obstacleHeight),
    input = { roll: 0, pitch: 0, throttle: 0, brake: false };
  let touring, arrival, touringWeather;
  async function selectAircraft(airliner) {
    if (airliner && !arrival) {
      loading('正在准备厦航 787 与进场区域地形…');
      const [{ createDreamliner }, { loadArrivalTerrain }] = await Promise.all([
        import('./dreamliner.js'), import('./arrival-terrain.js'),
      ]);
      const [plane, terrain] = await Promise.all([createDreamliner(), loadArrivalTerrain(geo)]);
      atmosphere.shadeSurfaces(plane.group);
      atmosphere.shadeSurfaces(terrain);
      scene.add(terrain);
      arrival = { plane, flight: new AirlinerArrival(plane.groundClearance), terrain };
    } else if (!airliner && !touring) {
      const plane = createAircraft();
      atmosphere.shadeSurfaces(plane.group);
      touring = { plane, flight: new Flight(geo, scenery, plane.groundClearance) };
    }
    if (airliner && !flight?.airliner) {
      touringWeather = atmosphere.state.mode;
      atmosphere.state.mode = 'cumulus';
    } else if (!airliner && flight?.airliner) {
      atmosphere.state.mode = touringWeather;
    }
    if (aircraft) scene.remove(aircraft.group);
    const selected = airliner ? arrival : touring;
    aircraft = selected.plane;
    flight = selected.flight;
    rig.aircraft = aircraft;
    if (arrival) arrival.terrain.visible = !!airliner;
    scene.add(aircraft.group);
  }
  let running = false,
    paused = false,
    cabinOnly = false,
    arrivalShown = false,
    lastTime = 0,
    tick = 0,
    lagTime = 0;
  let flybyEnd=0, flybyRate=1, departureStation=null;
  let aircraftWasVisible;
  const inFlyby=()=>flybyEnd>0 && flight.autopilot && rig.mode==='aerial' && flight.progress<flybyEnd;
  const resize = () => {
    const w = host.clientWidth,
      h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(host);
  resize();
  function render(dt) {
    const free = rig.free.active;
    aircraft.group.position.set(flight.x, flight.altitude, flight.z);
    aircraft.group.rotation.set(flight.pitch, -flight.heading, -flight.bank, 'YXZ');
    if (free) rig.free.apply();
    else rig.update(flight);
    const viewer = free ? camera.position : aircraft.group.position;
    atmosphere.update(dt, camera, flight, viewer);
    if (!free) aircraft.update(dt, flight, atmosphere.state.darkness);
    scenery.update?.(dt, atmosphere.state.time, atmosphere.state.darkness, viewer, atmosphere.state.minute);
    renderScene(scene, camera, atmosphere.state.darkness, atmosphere.state.mist, atmosphere.clouds);
  }
  function frame(now) {
    const raw = lastTime ? (now - lastTime) / 1000 : 1 / 60;
    lastTime = now;
    if (!running || paused) return;
    const dt = Math.min(0.13, Math.max(0, raw));
    if (!cabinOnly) {
      if (rig.free.active) {
        rig.free.move(dt);
        render(dt);
      } else {
        const n = Math.max(1, Math.ceil(dt / (1 / 60)));
        // Close flybys slow the aircraft while the independent scenery clock keeps moving.
        const flightStep = dt / n * (inFlyby() ? flybyRate : 1);
        for (let i = 0; i < n; i++) flight.update(flightStep, input, atmosphere.state.wind);
        render(dt * (flight.playback || 1));
      }
    }
    tick += dt;
    if (tick >= 0.1) {
      if (!rig.free.active) sound.update(flight, atmosphere.state, rig.mode);
      onFrame();
      tick = 0;
    }
    if (cabinOnly) return;
    if (raw > 0.048 && raw < 0.5) lagTime += dt;
    else lagTime = Math.max(0, lagTime - dt * 0.24);
    if (lagTime > 4.5 && renderer.getPixelRatio() > 0.9) {
      renderer.setPixelRatio(Math.max(0.85, renderer.getPixelRatio() * 0.83));
      resize();
      lagTime = 0;
    }
    if (!rig.free.active && flight.arrived && !arrivalShown) {
      arrivalShown = true;
      onFrame();
      onArrival();
    }
  }
  function setExploring(active) {
    if (!!rig.free.active === active) return;
    rig.clearPointers();
    if (active) {
      rig.free.enter(flight.airliner ? arrival.terrain.userData.geography : geo);
      aircraftWasVisible = aircraft.group.visible;
      aircraft.group.visible = false;
      sound.quiet();
    } else {
      aircraft.group.visible = aircraftWasVisible;
      rig.free.leave();
    }
    lastTime = 0;
    renderer.shadowMap.needsUpdate = true;
  }
  function preview() {
    if (!running) return;
    render(0);
    onFrame();
  }
  function visit({ station, x, z }) {
    const view = station?.view;
    const base = station?.groundRelative ? geo.heightAt(station.x, station.z) : 0;
    const portrait = THREE.MathUtils.clamp((.98 - camera.aspect) / .5, 0, 1);
    const position = view ? new THREE.Vector3(view.x, base + view.y, view.z) :
      station ? routePoint(station.distance) : new THREE.Vector3(x, 0, z);
    const narrow = station?.portraitView;
    if (narrow) position.lerp(new THREE.Vector3(narrow.x, base + narrow.y, narrow.z), portrait);
    if (!station) position.y = Math.max(380, geo.heightAt(x, z) + 190);
    else if (station.id === 'airport' || station.id === 'arrival') position.y = 240;
    position.y = Math.max(position.y, geo.heightAt(position.x, position.z) + 2);
    const target = station?.lookAt ?? station;
    const focus = station?.portraitFocus;
    const targetX = target ? THREE.MathUtils.lerp(target.x, focus?.x ?? target.x, portrait) : position.x;
    const targetZ = target ? THREE.MathUtils.lerp(target.z, focus?.z ?? target.z, portrait) : position.z;
    const focusHeight = station?.focusHeight;
    const targetY = base + THREE.MathUtils.lerp(focusHeight ?? 0, focus?.y ?? focusHeight ?? 0, portrait);
    const fov = Math.min(94, (station?.fov ?? 55) + portrait * (station?.portraitFovBoost ?? 14));
    if (station?.frameIsland) fitIslandView(position,targetX,targetZ,targetY,fov,camera.aspect,geo.islands[station.frameIsland]);
    const dx = targetX-position.x, dz = targetZ-position.z;
    const range = Math.hypot(dx, dz);
    const aimAt = range > 5 && focusHeight !== undefined;
    const heading = aimAt ? Math.atan2(dx, -dz) : station ? routeHeading(station.distance) : rig.free.heading;
    const tilt = aimAt ? Math.atan2(targetY-position.y, range) : -.60;
    setExploring(true);
    rig.free.goTo({ position, heading, tilt, fov, name: station?.name });
    renderer.shadowMap.needsUpdate = true;
    preview();
  }
  function setPaused(value, playArrivalAudio = false) {
    paused = value;
    cabinOnly = playArrivalAudio;
    lastTime = 0;
    if (value) sound.quiet();
    else if (running) onFrame();
  }
  async function launch(station, fresh = true, lightPreset) {
    setExploring(false);
    await selectAircraft(station.airliner);
    if (fresh) atmosphere.reset();
    if (fresh && station.airliner) {
      lightPreset ||= 'afternoon';
      if (atmosphere.state.mode === 'cumulus') atmosphere.state.cloud = .49;
    }
    if (lightPreset) atmosphere.state.minute = lightPresetMinute(atmosphere.state.day, lightPreset);
    flight.spawnAt(station.distance);
    flybyEnd=station.flybyMetres ? station.distance+station.flybyMetres : 0;
    flybyRate=flybyEnd ? .25 : 1;
    departureStation=station.airliner ? null : station;
    sound.resetFlight(!!flight.airliner);
    resize();
    if (station.airliner) {
      const mode = { '787-city': 'leftWindow', '787-harbor': 'rightWindow' }[station.id] || 'chase';
      rig.setMode(mode, flight);
      if (station.id === '787') rig.reset(flight.heading, -1.15);
      if (station.id === '787-final') {
        rig.reset(flight.heading, 2.64);
        rig.tilt = .16;
      }
      if (station.id === '787-taxi') rig.reset(flight.heading, 1.62);
    } else if (station.focusHeight !== undefined) {
      const portrait = THREE.MathUtils.clamp((.98 - camera.aspect) / .50, 0, 1);
      const target = station.lookAt ?? station, narrow = station.portraitFocus;
      const focus = narrow ? {x:THREE.MathUtils.lerp(target.x,narrow.x,portrait),
        z:THREE.MathUtils.lerp(target.z,narrow.z,portrait)} : target;
      const focusHeight = narrow ? THREE.MathUtils.lerp(station.focusHeight,narrow.y,portrait) : station.focusHeight;
      const bearing = Math.atan2(focus.x - flight.x, flight.z - focus.z);
      const range = Math.hypot(focus.x - flight.x, focus.z - flight.z);
      let framing = bearing;
      if (station.id === 'haicang') {
        // Both ends of a receding span fit best around their angular midpoint.
        const west = Math.atan2(station.x-324-flight.x, flight.z-station.z+7.7);
        const east = Math.atan2(station.x+324-flight.x, flight.z-station.z-7.7);
        framing = (west+east)*.5 - portrait*.023;
      }
      rig.setMode('aerial', flight);
      rig.reset(flight.heading, framing - flight.heading);
      rig.tilt = Math.atan2(focusHeight - flight.altitude - 1.8, range) - .036;
      rig.fov = station.fov + portrait * (station.portraitFovBoost ?? 7);
      if (station.followFocus) rig.flybySubject={x:focus.x,z:focus.z,y:focusHeight,end:flybyEnd};
    } else {
      const offset = { beach: .86, bridge: .82, wuyuan: 1.05 }[station.id] || 0;
      const portraitTurn = station.id === 'bridge'
        ? .245 * THREE.MathUtils.clamp((1.05 - camera.aspect) / .55, 0, 1) : 0;
      rig.setMode('chase', flight);
      rig.reset(flight.heading, offset + portraitTurn);
    }
    Object.assign(input, { roll: 0, pitch: 0, throttle: 0, brake: false });
    arrivalShown = false;
    running = true;
    paused = false;
    cabinOnly = false;
    lastTime = 0;
    lagTime = 0;
    render(0);
    onFrame();
    renderer.setAnimationLoop(frame);
  }
  return {
    renderer,
    scene,
    camera,
    geo,
    rig,
    get flight() { return flight; },
    get departurePlace() { return selectedFlightPlace(departureStation, flight, inFlyby()); },
    get playbackRate() { return flight.airliner ? flight.playback : inFlyby() ? flybyRate : null; },
    cyclePlayback() {
      if (flight.airliner) flight.playback=flight.playback===4 ? 1 : flight.playback*2;
      else if (inFlyby()) flybyRate=flybyRate===1 ? .25 : flybyRate*2;
    },
    input,
    atmosphere,
    scenery,
    launch,
    visit,
    toggleExplore() {
      setExploring(!rig.free.active);
      preview();
    },
    setPaused,
    stop() {
      running = false;
      renderer.setAnimationLoop(null);
      setExploring(false);
      sound.quiet();
      sound.resetFlight();
    },
    preview,
    cycleCamera() {
      if (rig.free.active) return;
      const modes = flight.airliner ? ['chase', 'rightWindow', 'leftWindow', 'aerial'] : ['chase', 'cockpit', 'aerial'];
      rig.setMode(modes[(modes.indexOf(rig.mode) + 1) % modes.length], flight);
      render(0);
      onFrame();
    },
  };
}
