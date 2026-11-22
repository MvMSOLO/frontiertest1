import * as THREE from "three";
import { HEROES } from "../data";
import { LANES, WALLS } from "../map";
import type { BuildingId, HeroId } from "../types";
import { BUILDING_IDS } from "../types";

export type Rig = {
  body: THREE.Object3D;
  lLeg: THREE.Object3D;
  rLeg: THREE.Object3D;
  lArm: THREE.Object3D;
  rArm: THREE.Object3D;
  weapon: THREE.Object3D;
  extras: THREE.Object3D[];
};

function mat(color: number, emissive = 0x000000, intensity = 0.18, opacity = 1) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive,
    emissiveIntensity: intensity,
    roughness: 0.48,
    metalness: 0.32,
    flatShading: true,
    transparent: opacity < 1,
    opacity,
  });
}

function box(w: number, h: number, d: number, color: number, x: number, y: number, z: number, emissive = 0x000000) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, emissive, emissive ? 0.45 : 0.12));
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}

export function buildHero(heroId: HeroId, team: 0 | 1, player: boolean) {
  const def = HEROES[heroId];
  const group = new THREE.Group();
  group.name = def.id;
  const teamColor = team === 0 ? 0x3ecfff : 0xff6d5a;
  const extras: THREE.Object3D[] = [];
  const body = new THREE.Group();
  body.userData.baseY = 0;
  const lLeg = new THREE.Group();
  const rLeg = new THREE.Group();
  const lArm = new THREE.Group();
  const rArm = new THREE.Group();
  const weapon = new THREE.Group();
  weapon.userData.baseZ = 0;

  const blob = new THREE.Mesh(new THREE.CircleGeometry(0.72, 16), mat(0x041018, 0x000000, 0, 0.45));
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.03;
  blob.castShadow = false;
  group.add(blob);

  if (player) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.82, 0.045, 6, 18), mat(0x3ecfff, 0x3ecfff, 0.9));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.06;
    group.add(ring);
  }

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.34, 4), mat(teamColor, teamColor, 0.7));
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 0.16, 0.95);
  group.add(nose);

  const banner = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), mat(teamColor, teamColor, 0.95));
  banner.position.y = 2.25;
  group.add(banner);

  if (heroId === "kael") {
    body.add(box(1.05, 0.72, 0.62, def.accent, 0, 1.15, 0));
    body.add(box(0.42, 0.36, 0.4, def.hex, 0, 1.72, 0, def.hex));
    const shield = box(0.12, 0.95, 0.78, def.hex, -0.78, 1.2, 0.1, def.hex);
    lArm.add(shield);
    lArm.position.set(-0.2, 1.2, 0);
    weapon.add(box(0.08, 0.7, 0.08, 0x8aa0b4, 0.55, 1.15, 0.35));
    weapon.add(box(0.34, 0.22, 0.34, def.hex, 0.55, 1.55, 0.35, def.hex));
    lLeg.add(box(0.28, 0.55, 0.28, 0x243140, -0.24, 0.4, 0));
    rLeg.add(box(0.28, 0.55, 0.28, 0x243140, 0.24, 0.4, 0));
  } else if (heroId === "nyx") {
    body.add(box(0.42, 0.85, 0.34, def.accent, 0, 1.15, 0));
    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.46, 5), mat(def.accent));
    hood.position.set(0, 1.78, 0);
    body.add(hood);
    weapon.add(box(0.08, 0.08, 1.15, def.hex, 0.28, 1.15, 0.35, def.hex));
    lArm.add(box(0.08, 0.08, 1.05, def.hex, -0.28, 1.15, 0.3, def.hex));
    lLeg.add(box(0.16, 0.6, 0.16, 0x1a1424, -0.12, 0.38, 0));
    rLeg.add(box(0.16, 0.6, 0.16, 0x1a1424, 0.12, 0.38, 0));
  } else if (heroId === "oria") {
    const robe = new THREE.Mesh(new THREE.ConeGeometry(0.62, 1.15, 7), mat(def.accent, def.hex, 0.25));
    robe.position.y = 0.85;
    body.add(robe);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), mat(0xf4efe2));
    head.position.y = 1.62;
    body.add(head);
    for (let i = 0; i < 3; i++) {
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.14), mat(def.hex, def.hex, 0.8));
      crystal.userData.rad = 0.85;
      crystal.userData.hy = 1.35;
      extras.push(crystal);
      group.add(crystal);
    }
    weapon.add(box(0.06, 1.1, 0.06, def.hex, 0.32, 1.1, 0.15, def.hex));
    lLeg.add(box(0.01, 0.01, 0.01, def.accent, 0, 0.2, 0));
    rLeg.add(box(0.01, 0.01, 0.01, def.accent, 0, 0.2, 0));
  } else if (heroId === "vex") {
    body.add(box(0.48, 0.8, 0.36, 0x1e3a2f, 0, 1.15, 0));
    body.add(box(0.28, 0.28, 0.28, def.hex, 0, 1.7, 0));
    const bow = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.045, 6, 14), mat(def.accent, def.accent, 0.4));
    bow.position.set(0, 1.25, 0.35);
    weapon.add(bow);
    lArm.add(box(0.12, 0.48, 0.12, def.hex, -0.36, 1.2, 0));
    const quiver = box(0.18, 0.46, 0.18, def.accent, 0, 1.25, -0.32);
    body.add(quiver);
    lLeg.add(box(0.16, 0.58, 0.16, 0x14241c, -0.14, 0.38, 0));
    rLeg.add(box(0.16, 0.58, 0.16, 0x14241c, 0.14, 0.38, 0));
  } else if (heroId === "sera") {
    const torso = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), mat(def.hex, def.hex, 0.2));
    torso.position.y = 1.15;
    body.add(torso);
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.55, 0.55, 8), mat(0xf7e7ee));
    skirt.position.y = 0.62;
    body.add(skirt);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.04, 6, 16), mat(def.accent, def.accent, 0.9));
    halo.rotation.x = Math.PI / 2;
    halo.position.y = 1.85;
    body.add(halo);
    weapon.add(new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), mat(def.accent, def.accent, 0.8)));
    weapon.children[0].position.set(0.4, 1.35, 0.2);
    lLeg.add(box(0.14, 0.4, 0.14, 0xf7e7ee, -0.14, 0.28, 0));
    rLeg.add(box(0.14, 0.4, 0.14, 0xf7e7ee, 0.14, 0.28, 0));
  } else {
    const hex = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.52, 0.9, 6), mat(def.accent, def.hex, 0.35));
    hex.position.y = 1.05;
    body.add(hex);
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.18), mat(def.hex, def.hex, 0.9));
    core.position.y = 1.15;
    body.add(core);
    for (let i = 0; i < 4; i++) {
      const node = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), mat(def.hex, def.hex, 0.8));
      node.userData.rad = 0.95;
      node.userData.hy = 1.2;
      extras.push(node);
      group.add(node);
    }
    lLeg.add(box(0.12, 0.35, 0.12, def.hex, -0.28, 0.28, 0, def.hex));
    rLeg.add(box(0.12, 0.35, 0.12, def.hex, 0.28, 0.28, 0, def.hex));
    weapon.add(box(0.08, 0.5, 0.08, def.hex, 0.42, 1.2, 0.2, def.hex));
  }

  group.add(body, lLeg, rLeg, lArm, rArm, weapon);
  const rig: Rig = { body, lLeg, rLeg, lArm, rArm, weapon, extras };
  group.userData.rig = rig;
  group.userData.team = team;
  return group;
}

export function poseHero(group: THREE.Group, pose: string, time: number) {
  const rig = group.userData.rig as Rig | undefined;
  if (!rig) return;
  const bob = Math.sin(time * 2.3 + group.position.x) * 0.045;
  rig.body.position.y = bob;
  rig.lLeg.rotation.x = 0;
  rig.rLeg.rotation.x = 0;
  rig.lArm.rotation.x = 0;
  rig.rArm.rotation.x = 0;
  rig.body.rotation.x = 0;
  rig.body.rotation.z = 0;
  rig.weapon.rotation.z = 0;
  if (pose === "run") {
    const s = Math.sin(time * 10);
    rig.lLeg.rotation.x = s * 0.65;
    rig.rLeg.rotation.x = -s * 0.65;
    rig.lArm.rotation.x = -s * 0.4;
    rig.rArm.rotation.x = s * 0.4;
  } else if (pose === "attack") {
    rig.weapon.rotation.z = -0.9;
    rig.rArm.rotation.x = -0.7;
  } else if (pose === "skill" || pose === "ult") {
    rig.lArm.rotation.x = -1.15;
    rig.rArm.rotation.x = -1.15;
    rig.body.position.y += pose === "ult" ? 0.16 : 0.06;
  } else if (pose === "hit") {
    rig.body.rotation.z = 0.18;
  } else if (pose === "defeat") {
    rig.body.rotation.x = 1;
    rig.body.position.y = 0.25;
  }
  for (let i = 0; i < rig.extras.length; i++) {
    const obj = rig.extras[i];
    const rad = (obj.userData.rad as number) ?? 0.9;
    const y = (obj.userData.hy as number) ?? 1.3;
    const a = time * 1.5 + i * 1.6;
    obj.position.set(Math.cos(a) * rad, y + bob, Math.sin(a) * rad);
  }
}

export function groundTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const g = canvas.getContext("2d");
  if (!g) return null;
  g.fillStyle = "#102432";
  g.fillRect(0, 0, 512, 512);
  g.strokeStyle = "#1a3948";
  g.lineWidth = 2;
  for (let i = 0; i <= 512; i += 32) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i, 512);
    g.stroke();
    g.beginPath();
    g.moveTo(0, i);
    g.lineTo(512, i);
    g.stroke();
  }
  g.strokeStyle = "#245566";
  g.strokeRect(8, 8, 496, 496);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function buildArena() {
  const group = new THREE.Group();
  const tex = groundTexture();
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(48, 64),
    new THREE.MeshStandardMaterial({
      color: 0x163042,
      map: tex,
      roughness: 0.92,
      metalness: 0.05,
    }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  const allyTint = new THREE.Mesh(new THREE.CircleGeometry(16, 24), mat(0x3ecfff, 0x3ecfff, 0.2, 0.14));
  allyTint.rotation.x = -Math.PI / 2;
  allyTint.position.set(0, 0.02, 24);
  const enemyTint = new THREE.Mesh(new THREE.CircleGeometry(16, 24), mat(0xff6d5a, 0xff6d5a, 0.2, 0.14));
  enemyTint.rotation.x = -Math.PI / 2;
  enemyTint.position.set(0, 0.02, -24);
  group.add(allyTint, enemyTint);

  for (const lane of LANES) {
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(lane.w, lane.d), mat(0x3ecfff, 0x3ecfff, 0.35, 0.22));
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(lane.x, 0.04, lane.z);
    group.add(strip);
  }

  const gates: THREE.Mesh[] = [];
  for (const wall of WALLS) {
    const w = wall.maxX - wall.minX;
    const d = wall.maxZ - wall.minZ;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, wall.gate ? 1.6 : 1.35, d),
      wall.gate ? mat(0xe4c16a, 0xe4c16a, 0.55, 0.72) : mat(0x1b3342, 0x000000, 0),
    );
    mesh.position.set((wall.minX + wall.maxX) / 2, wall.gate ? 0.8 : 0.67, (wall.minZ + wall.maxZ) / 2);
    mesh.castShadow = !wall.gate;
    mesh.receiveShadow = true;
    if (wall.gate) gates.push(mesh);
    group.add(mesh);
  }

  const core = new THREE.Mesh(new THREE.OctahedronGeometry(1.15), mat(0xe4c16a, 0xe4c16a, 0.8));
  core.position.y = 1.5;
  const coreRing = new THREE.Mesh(new THREE.TorusGeometry(5.25, 0.08, 6, 40), mat(0xe4c16a, 0xe4c16a, 0.5));
  coreRing.rotation.x = Math.PI / 2;
  coreRing.position.y = 0.08;
  group.add(core, coreRing);

  const relays: THREE.Mesh[] = [];
  for (const z of [34, -34]) {
    const crystal = new THREE.Mesh(
      new THREE.ConeGeometry(0.7, 2.4, 6),
      mat(z > 0 ? 0x3ecfff : 0xff6d5a, z > 0 ? 0x3ecfff : 0xff6d5a, 0.7),
    );
    crystal.position.set(0, 1.2, z);
    relays.push(crystal);
    group.add(crystal);
  }

  const marker = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.08, 6, 20), mat(0xe4c16a, 0xe4c16a, 0.8));
  marker.rotation.x = Math.PI / 2;
  marker.position.set(0, 0.08, 14);
  marker.visible = false;
  group.add(marker);

  for (const spot of [
    { x: -24, z: 20 },
    { x: 24, z: -20 },
  ]) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.22, 0.8, 5), mat(0x3a2a1c));
    trunk.position.set(spot.x, 0.4, spot.z);
    const top = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.3, 6), mat(0x1d4a3c, 0x143028, 0.2));
    top.position.set(spot.x, 1.35, spot.z);
    group.add(trunk, top);
  }

  const light = new THREE.PointLight(0xe4c16a, 8, 18, 2);
  light.position.set(0, 2.4, 0);
  group.add(light);

  return { group, gates, core, coreRing, relays, marker, light };
}

const SPOTS: Record<BuildingId, [number, number]> = {
  hq: [0, 5.5],
  generator: [-5.5, 2],
  tower: [5.5, 2],
  training: [-4.6, -3.2],
  lab: [4.6, -3.2],
  core: [0, -0.4],
  beacon: [0, -5.6],
};

export function buildBase() {
  const group = new THREE.Group();
  const pad = new THREE.Mesh(new THREE.CircleGeometry(11, 40), mat(0x143044, 0x0a2030, 0.15));
  pad.rotation.x = -Math.PI / 2;
  pad.receiveShadow = true;
  group.add(pad);
  const nodes = {} as Record<BuildingId, THREE.Group>;
  for (const id of BUILDING_IDS) {
    const [x, z] = SPOTS[id];
    const node = new THREE.Group();
    node.position.set(x, 0, z);
    node.userData.buildingId = id;
    const basePad = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.25, 0.18, 6), mat(0x1c3344));
    basePad.name = "pad";
    node.add(basePad);
    const built = new THREE.Group();
    built.name = "built";
    if (id === "hq") {
      built.add(box(1.2, 0.7, 1.2, 0x8aa0b8, 0, 0.6, 0));
      built.add(box(0.7, 0.7, 0.7, 0x3ecfff, 0, 1.25, 0, 0x3ecfff));
    } else if (id === "generator") {
      const coil = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.1, 6, 12), mat(0xe4c16a, 0xe4c16a, 0.5));
      coil.rotation.x = Math.PI / 2;
      coil.position.y = 0.7;
      built.add(coil);
      built.add(box(0.4, 0.8, 0.4, 0xc5d0da, 0, 0.55, 0));
    } else if (id === "tower") {
      built.add(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.4, 1.5, 6), mat(0x9aa8b5)));
      const cap = built.children[0] as THREE.Mesh;
      cap.position.y = 0.9;
      const gun = box(0.55, 0.16, 0.16, 0x3ecfff, 0.2, 1.45, 0, 0x3ecfff);
      built.add(gun);
    } else if (id === "training") {
      const arch = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.08, 6, 14, Math.PI), mat(0xe4c16a, 0xe4c16a, 0.3));
      arch.position.y = 0.7;
      built.add(arch);
      built.add(box(0.25, 0.7, 0.25, 0xd7b4ff, 0, 0.55, 0, 0xd7b4ff));
    } else if (id === "lab") {
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.62, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x8eb7e8, 0x3ecfff, 0.3));
      dome.position.y = 0.35;
      built.add(dome);
      built.add(box(0.06, 0.8, 0.06, 0xe4c16a, 0, 1.1, 0, 0xe4c16a));
    } else if (id === "core") {
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.55), mat(0xe4c16a, 0xe4c16a, 0.8));
      crystal.position.y = 0.9;
      built.add(crystal);
    } else {
      built.add(box(0.12, 1.4, 0.12, 0x3ecfff, 0, 0.9, 0, 0x3ecfff));
      const dish = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.25, 6), mat(0xe4c16a, 0xe4c16a, 0.4));
      dish.position.y = 1.7;
      built.add(dish);
    }
    const stage2 = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.045, 5, 14), mat(0x3ecfff, 0x3ecfff, 0.6));
    stage2.rotation.x = Math.PI / 2;
    stage2.position.y = 0.16;
    stage2.name = "stage2";
    const stage3 = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), mat(0xe4c16a, 0xe4c16a, 0.8));
    stage3.position.y = 1.9;
    stage3.name = "stage3";
    const up = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.05, 5, 16), mat(0xe4c16a, 0xe4c16a, 0.9));
    up.rotation.x = Math.PI / 2;
    up.position.y = 0.22;
    up.name = "up";
    up.visible = false;
    node.add(built, stage2, stage3, up);
    group.add(node);
    nodes[id] = node;
  }
  return { group, nodes };
}

export function buildMenu() {
  const group = new THREE.Group();
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.45, 0.25, 8), mat(0x163348, 0x3ecfff, 0.25));
  pad.position.y = 0.05;
  group.add(pad);
  for (const spot of [
    { x: -6, y: 1.2, z: -4, s: 1.4 },
    { x: 7, y: 2.1, z: -6, s: 1.8 },
    { x: -8, y: 2.6, z: -8, s: 1.1 },
    { x: 5, y: 1.5, z: 4, s: 1.2 },
  ]) {
    const isle = new THREE.Group();
    const rock = new THREE.Mesh(new THREE.CylinderGeometry(1.1 * spot.s, 1.4 * spot.s, 0.45, 6), mat(0x1a3344));
    const tree = new THREE.Mesh(new THREE.ConeGeometry(0.55 * spot.s, 1.1 * spot.s, 5), mat(0x1d4a3c));
    tree.position.y = 0.7;
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.2 * spot.s), mat(0x3ecfff, 0x3ecfff, 0.8));
    crystal.position.y = 1.15;
    isle.add(rock, tree, crystal);
    isle.position.set(spot.x, spot.y, spot.z);
    isle.userData.bob = spot.y;
    group.add(isle);
  }
  const anchor = new THREE.Group();
  group.add(anchor);
  return { group, anchor };
}

export function disposeTree(root: THREE.Object3D) {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const material = mesh.material;
    if (Array.isArray(material)) material.forEach((m) => m.dispose());
    else if (material) material.dispose();
  });
}
