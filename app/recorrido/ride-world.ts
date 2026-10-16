import * as THREE from "three";
import { RIDE_STOPS } from "./ride-stops";
import { TRAVEL_SECONDS, initialJourney, startJourney, pauseJourney, advanceJourney } from "./ride-journey.mjs";
import { createRidePath, placeStation, ARTWORK_WIDTH, FRAME_THICKNESS, FRAME_DEPTH, HORIZONTAL_FRAME_Z } from "./ride-geometry.mjs";
import { createRideTextures } from "./ride-textures";

export type RideSnapshot = ReturnType<typeof initialJourney> & { speed: number };
export type RideController = { start(): void; pause(): void; reset(): void; dispose(): void };

const UP = new THREE.Vector3(0, 1, 0);
const smoothstep = (t: number) => t * t * (3 - 2 * t);

/** All scenery is geometry; the complete production sequence uses opaque textures. */
export async function createRide(host: HTMLElement, onUpdate: (state: RideSnapshot) => void): Promise<RideController> {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .85;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  let dirty = true;
  scene.background = new THREE.Color("#c5dfef");
  scene.fog = new THREE.Fog("#c5dfef", 145, 430);
  const camera = new THREE.PerspectiveCamera(58, 1, .1, 460);
  scene.add(camera);
  scene.add(new THREE.HemisphereLight("#e6f7ff", "#a1afbd", 1.6));
  const sun = new THREE.DirectionalLight("#fff8e8", 1.8);
  sun.position.set(-45, 75, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -95, right: 95, top: 130, bottom: -110, near: 1, far: 240 });
  sun.target.position.set(0, 0, -65);
  sun.shadow.bias = -.0003;
  scene.add(sun, sun.target);

  const materials = new Set<THREE.Material>();
  const geometries = new Set<THREE.BufferGeometry>();
  const standard = (color: string, roughness = .85, metalness = 0) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness, metalness, flatShading: true });
    materials.add(m); return m;
  };
  const sand = standard("#b8c6b1");
  const stone = [standard("#9caab2"), standard("#bac2c7"), standard("#829ba7")];
  const blue = standard("#004289", .5, .18);
  const pale = standard("#f1f6fa", .65, .1);
  const concrete = standard("#777e85", .95);
  const dark = standard("#234f7b", .5, .3);
  const pipeMaterial = standard("#43a8d8", .45, .35);
  const jointMaterial = standard("#004289", .5, .35);
  const cyan = standard("#33bbed", .55, .1);
  const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D = scene) => {
    geometries.add(geometry);
    const object = new THREE.Mesh(geometry, material);
    object.castShadow = true; object.receiveShadow = true;
    parent.add(object); return object;
  };
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, material: THREE.Material, parent: THREE.Object3D = scene) => {
    const object = mesh(new THREE.BoxGeometry(w, h, d), material, parent);
    object.position.set(x, y, z); return object;
  };
  const path = createRidePath(RIDE_STOPS.length);
  const pathLength = path.getLength();
  const endZ = path.getPointAt(1).z;
  const worldLength = Math.abs(endZ - 18);
  const worldCenter = (endZ + 18) / 2;

  // Seeded placement keeps the prototype identical on every visit.
  let seed = 92;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const ground = new THREE.PlaneGeometry(650, worldLength + 650, 55, Math.ceil((worldLength + 650) / 12));
  ground.rotateX(-Math.PI / 2);
  ground.translate(0, 0, worldCenter);
  const vertices = ground.attributes.position;
  for (let i = 0; i < vertices.count; i++) {
    const x = vertices.getX(i), z = vertices.getZ(i);
    vertices.setY(i, -4 + Math.sin(x * .035) * Math.cos(z * .04) * 1.7);
  }
  ground.computeVertexNormals();
  mesh(ground, sand).receiveShadow = true;

  // Three continuous, faceted mountain ranges surround the whole route.
  // Layered blue silhouettes and pale summits keep the illustration-like aesthetic.
  for (const [layer, radius, baseHeight, color] of [
    [0, 290, 76, "#a4cce4"], [1, 220, 61, "#7ca9c5"], [2, 150, 39, "#6594ad"],
  ] as const) for (const side of [-1, 1]) {
    const positions: number[] = [], colors: number[] = [], indices: number[] = [];
    const segments = Math.ceil((worldLength + 360) / 10);
    const rock = new THREE.Color(color), snow = new THREE.Color("#eaf4fc");
    for (let i = 0; i <= segments; i++) {
      const z = 180 - i / segments * (worldLength + 360);
      const peak = baseHeight + Math.sin(z * .065 + layer + side) * 13 + Math.sin(z * .14 + layer * 2) * 8 + Math.cos(z * .22) * 4;
      const ridgeRadius = radius + Math.sin(z * .043 + layer) * 12;
      for (let row = 0; row < 4; row++) {
        const r = ridgeRadius + [-43, -15, 0, 48][row];
        const height = [-4, peak * .48, peak, -4][row];
        positions.push(side * r, height, z);
        const tint = row === 2 && layer < 2 && peak > baseHeight - 2 ? snow : rock;
        colors.push(tint.r, tint.g, tint.b);
      }
      if (i < segments) for (let row = 0; row < 3; row++) {
        const a = i * 4 + row, b = a + 4;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, side: THREE.DoubleSide });
    materials.add(material);
    const range = mesh(geometry, material);
    range.castShadow = false; range.receiveShadow = false;
  }

  mesh(new THREE.TubeGeometry(path, Math.ceil(pathLength * 2), .72, 12, false), pipeMaterial);

  const ringGeometry = new THREE.TorusGeometry(.75, .075, 6, 18);
  const footingGeometry = new THREE.BoxGeometry(2.5, .45, 2.4);
  const postGeometry = new THREE.CylinderGeometry(.22, .3, 1, 6);
  const ringAxis = new THREE.Vector3(0, 0, 1);
  const collarCount = Math.ceil(pathLength / 2.2);
  const supportCount = Math.floor(collarCount / 6) + 1;
  const instance = (geometry: THREE.BufferGeometry, material: THREE.Material, count: number) => {
    geometries.add(geometry);
    const object = new THREE.InstancedMesh(geometry, material, count);
    object.castShadow = true; object.receiveShadow = true;
    scene.add(object); return object;
  };
  const collars = instance(ringGeometry, jointMaterial, collarCount + 1);
  const supports = instance(postGeometry, dark, supportCount);
  const footings = instance(footingGeometry, stone[1], supportCount);
  const saddles = instance(new THREE.BoxGeometry(1.8, .22, 1), blue, supportCount);
  const markerPosts = instance(new THREE.BoxGeometry(.12, 2.4, .12), dark, supportCount);
  const markers = instance(new THREE.BoxGeometry(.65, .32, .1), cyan, supportCount);
  const transform = new THREE.Object3D();
  let supportIndex = 0;
  for (let i = 0; i <= collarCount; i++) {
    const u = i / collarCount, point = path.getPointAt(u), tangent = path.getTangentAt(u);
    transform.position.copy(point); transform.scale.set(1, 1, 1); transform.quaternion.setFromUnitVectors(ringAxis, tangent);
    transform.updateMatrix(); collars.setMatrixAt(i, transform.matrix);
    if (i % 6 === 0) {
      const groundY = -4 + Math.sin(point.x * .035) * Math.cos(point.z * .04) * 1.7;
      const height = point.y - .7 - groundY;
      transform.quaternion.identity(); transform.scale.set(1, height, 1); transform.position.set(point.x, groundY + height / 2, point.z);
      transform.updateMatrix(); supports.setMatrixAt(supportIndex, transform.matrix);
      transform.scale.set(1, 1, 1); transform.position.set(point.x, groundY, point.z);
      transform.updateMatrix(); footings.setMatrixAt(supportIndex, transform.matrix);
      transform.position.set(point.x, point.y - .65, point.z);
      transform.updateMatrix(); saddles.setMatrixAt(supportIndex, transform.matrix);
      const offset = new THREE.Vector3().crossVectors(tangent, UP).normalize().multiplyScalar(2.5);
      const p = point.clone().add(offset);
      transform.position.set(p.x, p.y + .1, p.z);
      transform.updateMatrix(); markerPosts.setMatrixAt(supportIndex, transform.matrix);
      transform.position.y = p.y + 1.2;
      transform.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), tangent);
      transform.updateMatrix(); markers.setMatrixAt(supportIndex, transform.matrix);
      supportIndex++;
    }
  }

  const rockGeometry = new THREE.IcosahedronGeometry(1, 0);
  const shrubGeometry = new THREE.IcosahedronGeometry(1, 0);
  const shrubMaterial = standard("#7e9f93");
  // Keep clutter away from the gas pipeline and the station.
  const routePoints = path.getSpacedPoints(Math.ceil(pathLength / 3));
  const rockCount = Math.ceil(worldLength * 1.6);
  const rocks = [instance(rockGeometry, stone[0], rockCount), instance(rockGeometry, stone[1], rockCount), instance(rockGeometry, stone[2], rockCount), instance(shrubGeometry, shrubMaterial, rockCount)];
  const rockIndices = [0, 0, 0, 0];
  for (let i = 0; i < rockCount; i++) {
    const x = (random() - .5) * 220, z = 60 - random() * (worldLength + 120);
    if (routePoints.some(p => Math.hypot(x - p.x, z - p.z) < 7)) continue;
    const scale = .4 + random() * 2.3;
    const group = i % 4;
    const groundY = -4 + Math.sin(x * .035) * Math.cos(z * .04) * 1.7;
    transform.position.set(x, groundY + scale * .2, z); transform.scale.set(scale, scale * .6, scale * .8); transform.rotation.set(0, random() * 6, 0);
    transform.updateMatrix(); rocks[group].setMatrixAt(rockIndices[group]++, transform.matrix);
  }
  rocks.forEach((rock, index) => { rock.count = rockIndices[index]; });

  const cloudMaterial = standard("#f4f8fc");
  for (let i = 0; i < Math.ceil(worldLength / 30); i++) {
    const cloud = mesh(new THREE.IcosahedronGeometry(1, 1), cloudMaterial);
    cloud.position.set((random() - .5) * 340, 52 + random() * 35, 40 - random() * (worldLength + 120));
    cloud.scale.set(10 + random() * 14, 2 + random() * 2, 5);
    cloud.castShadow = false;
  }

  const artworkMaterials: THREE.MeshBasicMaterial[] = [];
  let textureCache: Awaited<ReturnType<typeof createRideTextures>>;
  try {
    textureCache = await createRideTextures(RIDE_STOPS, Math.min(8, renderer.capabilities.getMaxAnisotropy()), (index, texture) => {
      const material = artworkMaterials[index];
      if (material) { material.map = texture; material.needsUpdate = true; dirty = true; }
    });
  } catch (error) { dispose(); throw error; }

  // Stations sit beside the track, leaving the pipe clear to continue the journey.
  const stations: THREE.Group[] = [];
  const stationTargets = RIDE_STOPS.map((stop, index) => {
    const station = placeStation(path, stop.u, stop.side);
    scene.add(station);
    stations.push(station);
    // Keep illustration pixels in their original sRGB colors, independent of
    // exposure, lighting and atmospheric fog used for the surrounding world.
    const material = new THREE.MeshBasicMaterial({ map: textureCache.preview(index), side: THREE.DoubleSide, toneMapped: false, fog: false });
    artworkMaterials.push(material);
    materials.add(material);
    // Each complete, opaque artwork keeps its original aspect ratio.
    const width = ARTWORK_WIDTH;
    const height = width * stop.height / stop.width;
    const bottom = 2.5, center = bottom + height / 2;
    const artwork = mesh(new THREE.PlaneGeometry(width, height), material, station);
    artwork.position.set(0, center, .38); artwork.castShadow = false; artwork.receiveShadow = false;
    const backingMaterial = new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false, fog: false });
    materials.add(backingMaterial);
    const backing = box(0, center, .12, width + .35, height + .35, .12, backingMaterial, station);
    backing.receiveShadow = false;
    const sideX = width / 2 + FRAME_THICKNESS / 2;
    for (const x of [-sideX, sideX]) box(x, center, 0, FRAME_THICKNESS, height + 2 * FRAME_THICKNESS, FRAME_DEPTH, blue, station);
    // Forward offset removes coplanar corner faces. Both crossbars share size.
    const frameWidth = width + 2 * FRAME_THICKNESS;
    box(0, bottom + height + FRAME_THICKNESS / 2, HORIZONTAL_FRAME_Z, frameWidth, FRAME_THICKNESS, FRAME_DEPTH, cyan, station);
    box(0, bottom - FRAME_THICKNESS / 2, HORIZONTAL_FRAME_Z, frameWidth, FRAME_THICKNESS, FRAME_DEPTH, blue, station);
    // Two independent posts meet the terrain directly; no platform or plinth.
    for (const x of [-5.4, 5.4]) {
      const world = station.localToWorld(new THREE.Vector3(x, 0, -.25));
      const groundY = -4 + Math.sin(world.x * .035) * Math.cos(world.z * .04) * 1.7;
      const foot = groundY - station.position.y - .25;
      const top = bottom - FRAME_THICKNESS;
      box(x, (foot + top) / 2, -.25, .4, top - foot, .4, concrete, station);
    }
    return station.localToWorld(new THREE.Vector3(0, center, .38));
  });
  await textureCache.warm(0);

  // The camera is the passenger's head; these parts remain attached to the car.
  const car = new THREE.Group();
  camera.add(car);
  const nose = mesh(new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), blue, car);
  nose.scale.set(1.48, .48, 1.7); nose.position.set(0, -1.42, -1.95);
  box(0, -1.42, -1.4, 2.6, .23, 1.3, pale, car);
  // Small accent strip on the nose, geometry rather than an additional texture.
  box(0, -1.12, -2.35, .7, .045, .14, cyan, car);
  car.traverse(object => { if (object instanceof THREE.Mesh) { object.castShadow = false; object.receiveShadow = false; } });

  let journey = initialJourney();
  let frame = 0;
  let previous = 0;
  let reported = 0;
  let hidden = document.hidden;
  let lost = false;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const point = new THREE.Vector3(), ahead = new THREE.Vector3();
  const position = new THREE.Vector3(), target = new THREE.Vector3();
  let disposed = false;

  function notify(speed = 0) { onUpdate({ ...journey, speed }); }
  function resize() {
    dirty = true;
    const width = host.clientWidth, height = host.clientHeight;
    camera.aspect = width / Math.max(height, 1);
    camera.fov = width < 600 ? 86 : 58;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host); resize();

  function visibility() {
    hidden = document.hidden;
    if (hidden && journey.phase === "riding") { journey = pauseJourney(journey); notify(); }
    previous = 0;
  }
  function contextLost(event: Event) {
    event.preventDefault(); lost = true;
    if (journey.phase === "riding") { journey = pauseJourney(journey); notify(); }
  }
  function contextRestored() { lost = false; previous = 0; dirty = true; }
  document.addEventListener("visibilitychange", visibility);
  renderer.domElement.addEventListener("webglcontextlost", contextLost);
  renderer.domElement.addEventListener("webglcontextrestored", contextRestored);

  function draw(now: number) {
    if (disposed) return;
    frame = requestAnimationFrame(draw);
    if (hidden || lost) return;
    if (journey.phase !== "riding" && !dirty) return;
    dirty = false;
    const dt = previous ? Math.max(0, (now - previous) / 1000) : 0;
    previous = now;
    const wasRiding = journey.phase === "riding";
    journey = advanceJourney(journey, dt);
    if (wasRiding && journey.phase === "arrived") notify();
    const { progress, from, to } = journey;
    const nearbyStop = journey.phase === "riding" || journey.phase === "paused" ? to : journey.stop;
    stations.forEach((station, index) => { station.visible = Math.abs(index - nearbyStop) <= 2; });
    const eased = smoothstep(progress);
    const u = THREE.MathUtils.lerp(RIDE_STOPS[from].u, RIDE_STOPS[to].u, eased);
    path.getPointAt(u, point);
    path.getPointAt(Math.min(1, u + 6 / pathLength), ahead);
    position.copy(point); position.y += 2.15;
    target.copy(ahead); target.y += 2.08;
    // Turn away from the previous illustration, follow the pipe, then face the next.
    const departure = 1 - smoothstep(Math.min(1, progress / .24));
    const arrival = smoothstep(Math.max(0, (progress - .72) / .28));
    target.lerp(stationTargets[from], departure);
    target.lerp(stationTargets[to], arrival);
    camera.position.copy(position);
    sun.position.copy(position).add(new THREE.Vector3(-45, 75, 20));
    sun.target.position.copy(position).add(new THREE.Vector3(0, 0, -40));
    camera.up.copy(UP);
    if (!reducedMotion.matches) {
      const bank = THREE.MathUtils.clamp((ahead.x - point.x) * -.012, -.055, .055) * Math.sin(progress * Math.PI);
      camera.up.set(bank, 1, 0).normalize();
    }
    camera.lookAt(target);
    const moving = journey.phase === "riding" ? Math.sin(progress * Math.PI) : 0;
    car.position.y = reducedMotion.matches ? 0 : Math.sin(now * .012) * .007 * moving;
    renderer.render(scene, camera);
    if (now - reported > 120) {
      const velocity = journey.phase === "riding" ? pathLength * (RIDE_STOPS[to].u - RIDE_STOPS[from].u) * 6 * progress * (1 - progress) / TRAVEL_SECONDS : 0;
      notify(velocity * 3.6); reported = now;
    }
  }
  frame = requestAnimationFrame(draw);

  function dispose() {
    // Also safe during image-load failure, before the animation has been initialized.
    scene.traverse(object => {
      if (object instanceof THREE.Mesh) {
        if (object instanceof THREE.InstancedMesh) object.dispose();
        object.geometry.dispose();
        const list = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of list) material.dispose();
      }
    });
    renderer.dispose(); renderer.domElement.remove();
  }

  return {
    start() { if (lost) return; journey = startJourney(journey, RIDE_STOPS.length); void textureCache.warm(journey.to); previous = performance.now(); dirty = true; notify(); },
    pause() { journey = pauseJourney(journey); notify(); },
    reset() { journey = initialJourney(); void textureCache.warm(0); previous = 0; dirty = true; notify(); },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame); resizeObserver.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      renderer.domElement.removeEventListener("webglcontextlost", contextLost);
      renderer.domElement.removeEventListener("webglcontextrestored", contextRestored);
      textureCache.dispose();
      scene.traverse(object => { if (object instanceof THREE.InstancedMesh) object.dispose(); });
      sun.shadow.dispose();
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      renderer.dispose(); renderer.domElement.remove();
    },
  };
}
