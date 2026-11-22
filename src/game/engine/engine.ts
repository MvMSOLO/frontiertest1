import * as THREE from "three";
import { audio } from "../audio";
import { HEROES } from "../data";
import type { BuildingId, GameEvent, HeroId, HudSnap, SaveData, SessionKind, Settings } from "../types";
import { buildArena, buildBase, buildHero, buildMenu, disposeTree, poseHero } from "./meshes";
import { createSim, forfeit, skipFinale, stepSim, type SessionOpts, type Sim } from "./sim";

export type ViewId = "boot" | "cine" | "loading" | "menu" | "base" | "battle";

const CAM = {
  near: { y: 16, z: 11 },
  mid: { y: 22, z: 16 },
  far: { y: 30, z: 22 },
};

function emptySnap(): HudSnap {
  return {
    live: false,
    phase: "idle",
    finale: null,
    timeLeft: 0,
    scores: [0, 0],
    hp: 1,
    maxHp: 1,
    shield: 0,
    dead: false,
    respawn: 0,
    cds: [0, 0, 0],
    cdMax: [1, 1, 1],
    atkCd: 0,
    atkMax: 1,
    coreOwner: -1,
    coreP: 0,
    coreMode: "neutral",
    gates: false,
    relays: [
      { hp: 1, max: 1 },
      { hp: 1, max: 1 },
    ],
    feed: [],
    elims: 0,
    assists: 0,
    deaths: 0,
    objectives: 0,
    damage: 0,
    minimap: [],
    wisps: [],
    speed: 0,
    yaw: 0,
    px: 0,
    pz: 0,
    countdown: 0,
    locked: false,
    heroId: null,
  };
}

export class FrontierEngine {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(46, 1, 0.1, 150);
  readonly snap: HudSnap = emptySnap();
  readonly hooks = {
    onEvent: (_e: GameEvent) => {},
    onPick: (_id: BuildingId | null) => {},
    onPause: () => {},
  };

  moveX = 0;
  moveY = 0;
  attack = false;
  queue: number[] = [];
  qaKeys: Set<string> | null = null;

  private overlay: HTMLCanvasElement;
  private octx: CanvasRenderingContext2D;
  private timer = new THREE.Timer();
  private keys = new Set<string>();
  private sim: Sim | null = null;
  private view: ViewId = "boot";
  private paused = false;
  private lockInput = false;
  private simAcc = 0;
  private frameAcc = 0;
  private elapsed = 0;
  private fps: 30 | 60 = 60;
  private pr = 1;
  private quality: Settings["quality"] = "medium";
  private cameraMode: Settings["camera"] = "mid";
  private sens = 1;
  private autoTarget = true;
  private haptics = true;
  private finaleLift = 0;
  private orbit = 0.4;
  private dragging: { x: number; y: number; orbit: number; moved: boolean } | null = null;
  private preview: THREE.Group | null = null;
  private previewId: HeroId | null = null;
  private unitMeshes = new Map<number, THREE.Group>();
  private battleGroup: THREE.Group;
  private gates: THREE.Mesh[] = [];
  private coreMesh: THREE.Mesh;
  private relays: THREE.Mesh[] = [];
  private marker: THREE.Mesh;
  private coreLight: THREE.PointLight;
  private menuGroup: THREE.Group;
  private menuAnchor: THREE.Group;
  private baseGroup: THREE.Group;
  private baseNodes: ReturnType<typeof buildBase>["nodes"];
  private cineGroup: THREE.Group;
  private projMesh: THREE.InstancedMesh;
  private projDummy = new THREE.Object3D();
  private zoneMeshes: THREE.Mesh[] = [];
  private wispMeshes: THREE.Mesh[] = [];
  private rangeRing: THREE.Mesh;
  private look = new THREE.Vector3();
  private desired = new THREE.Vector3();
  private ndc = new THREE.Vector2();
  private raycaster = new THREE.Raycaster();
  private v = new THREE.Vector3();
  private trauma = 0;
  private buzzed = false;
  private cssW = 1;
  private cssH = 1;
  private onKeyDown: (e: KeyboardEvent) => void;
  private onKeyUp: (e: KeyboardEvent) => void;
  private onBlur = () => this.keys.clear();
  private onPointerDown: (e: PointerEvent) => void;
  private onPointerMove: (e: PointerEvent) => void;
  private onPointerUp: (e: PointerEvent) => void;
  private resizeObs: ResizeObserver;

  constructor(canvas: HTMLCanvasElement, overlay: HTMLCanvasElement, settings: Settings) {
    this.overlay = overlay;
    const ctx = overlay.getContext("2d");
    if (!ctx) throw new Error("Overlay canvas is unavailable.");
    this.octx = ctx;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: settings.quality !== "low",
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = settings.quality !== "low";
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene.background = new THREE.Color(0x071018);
    this.scene.fog = new THREE.Fog(0x071018, 28, 92);

    const hemi = new THREE.HemisphereLight(0x9ad7ff, 0x1a1208, 0.85);
    const dir = new THREE.DirectionalLight(0xfff1d2, 1.35);
    dir.position.set(16, 28, 12);
    dir.castShadow = true;
    dir.shadow.mapSize.set(settings.quality === "high" ? 1024 : 512, settings.quality === "high" ? 1024 : 512);
    dir.shadow.camera.near = 2;
    dir.shadow.camera.far = 70;
    const cam = dir.shadow.camera as THREE.OrthographicCamera;
    cam.left = -34;
    cam.right = 34;
    cam.top = 34;
    cam.bottom = -34;
    this.scene.add(hemi, dir, dir.target);

    const arena = buildArena();
    this.battleGroup = arena.group;
    this.gates = arena.gates;
    this.coreMesh = arena.core;
    this.relays = arena.relays;
    this.marker = arena.marker;
    this.coreLight = arena.light;
    this.scene.add(this.battleGroup);

    const menu = buildMenu();
    this.menuGroup = menu.group;
    this.menuAnchor = menu.anchor;
    this.scene.add(this.menuGroup);

    const base = buildBase();
    this.baseGroup = base.group;
    this.baseNodes = base.nodes;
    this.baseGroup.visible = false;
    this.scene.add(this.baseGroup);

    this.cineGroup = menu.group.clone(true);
    this.cineGroup.visible = false;
    this.scene.add(this.cineGroup);

    this.projMesh = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.22, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.4, roughness: 0.3 }),
      48,
    );
    this.projMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.projMesh.count = 0;
    this.projMesh.frustumCulled = false;
    this.battleGroup.add(this.projMesh);

    for (let i = 0; i < 10; i++) {
      const zone = new THREE.Mesh(
        new THREE.CircleGeometry(1, 20),
        new THREE.MeshBasicMaterial({ color: 0x3ecfff, transparent: true, opacity: 0.28, depthWrite: false }),
      );
      zone.rotation.x = -Math.PI / 2;
      zone.visible = false;
      this.zoneMeshes.push(zone);
      this.battleGroup.add(zone);
    }
    for (const spot of [
      { x: -24, z: 16 },
      { x: 24, z: -16 },
    ]) {
      const wisp = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.28),
        new THREE.MeshStandardMaterial({ color: 0xe4c16a, emissive: 0xe4c16a, emissiveIntensity: 0.9, flatShading: true }),
      );
      wisp.position.set(spot.x, 0.8, spot.z);
      wisp.visible = false;
      this.wispMeshes.push(wisp);
      this.battleGroup.add(wisp);
    }
    this.rangeRing = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.04, 4, 24),
      new THREE.MeshBasicMaterial({ color: 0x3ecfff, transparent: true, opacity: 0.45 }),
    );
    this.rangeRing.rotation.x = Math.PI / 2;
    this.rangeRing.visible = false;
    this.battleGroup.add(this.rangeRing);

    this.applySettings(settings);
    this.setView("boot");
    this.timer.connect(document);
    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(canvas);
    this.resize();

    this.onKeyDown = (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      this.keys.add(e.code);
      if (this.view !== "battle") return;
      if (e.code === "Space" || e.code.startsWith("Arrow")) e.preventDefault();
      if (e.repeat) return;
      if (e.code === "KeyQ") this.queue.push(0);
      if (e.code === "KeyE") this.queue.push(1);
      if (e.code === "KeyR") this.queue.push(2);
      if (e.code === "Escape") this.hooks.onPause();
    };
    this.onKeyUp = (e) => this.keys.delete(e.code);
    this.onPointerDown = (e) => {
      if (this.view !== "base") return;
      this.dragging = { x: e.clientX, y: e.clientY, orbit: this.orbit, moved: false };
    };
    this.onPointerMove = (e) => {
      if (!this.dragging || this.view !== "base") return;
      const dx = e.clientX - this.dragging.x;
      if (Math.abs(dx) > 6 || Math.abs(e.clientY - this.dragging.y) > 6) this.dragging.moved = true;
      if (this.dragging.moved) this.orbit = this.dragging.orbit + dx * 0.008;
    };
    this.onPointerUp = (e) => {
      if (!this.dragging) return;
      const moved = this.dragging.moved;
      this.dragging = null;
      if (!moved && this.view === "base") this.hooks.onPick(this.pick(e.clientX, e.clientY));
    };
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    canvas.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);

    window.__controlsTest = {
      getYaw: () => this.sim?.units[0]?.yaw ?? 0,
      getSpeed: () => Math.hypot(this.sim?.units[0]?.vx ?? 0, this.sim?.units[0]?.vz ?? 0),
      getPos: () => ({ x: this.sim?.units[0]?.x ?? 0, z: this.sim?.units[0]?.z ?? 0 }),
      setKeys: (codes) => {
        this.qaKeys = new Set(codes);
      },
      setSteer: () => {},
    };

    this.renderer.setAnimationLoop(() => this.frame());
  }

  applySettings(settings: Settings) {
    this.sens = settings.sensitivity;
    this.autoTarget = settings.autoTarget;
    this.cameraMode = settings.camera;
    this.fps = settings.fps;
    this.quality = settings.quality;
    this.haptics = settings.haptics;
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    this.pr = settings.quality === "low" ? 1 : settings.quality === "high" ? Math.min(1.75, dpr) : Math.min(1.35, dpr);
    this.renderer.shadowMap.enabled = settings.quality !== "low";
    this.resize();
  }

  setView(view: ViewId) {
    this.view = view;
    this.battleGroup.visible = view === "battle";
    this.baseGroup.visible = view === "base";
    this.menuGroup.visible = view === "menu" || view === "loading";
    this.cineGroup.visible = view === "cine" || view === "boot";
    if (view !== "battle") this.octx.clearRect(0, 0, this.overlay.width, this.overlay.height);
  }

  setPreviewHero(id: HeroId) {
    if (this.previewId === id && this.preview) return;
    if (this.preview) {
      this.menuAnchor.remove(this.preview);
      disposeTree(this.preview);
    }
    this.preview = buildHero(id, 0, true);
    this.preview.position.y = 0.2;
    this.menuAnchor.add(this.preview);
    this.previewId = id;
  }

  setBase(buildings: SaveData["buildings"]) {
    for (const id of Object.keys(this.baseNodes) as BuildingId[]) {
      const node = this.baseNodes[id];
      const state = buildings[id];
      const built = node.getObjectByName("built");
      const stage2 = node.getObjectByName("stage2");
      const stage3 = node.getObjectByName("stage3");
      const up = node.getObjectByName("up");
      if (built) built.visible = state.placed && state.level > 0;
      if (stage2) stage2.visible = state.level >= 2;
      if (stage3) stage3.visible = state.level >= 3;
      if (up) up.visible = state.upgradeEndsAt != null;
      const s = state.placed ? 0.92 + state.level * 0.06 : 1;
      node.scale.setScalar(s);
    }
  }

  startSession(opts: SessionOpts) {
    this.clearUnits();
    this.sim = createSim(opts);
    this.paused = false;
    this.finaleLift = 0;
    this.queue.length = 0;
    for (const unit of this.sim.units) {
      const mesh = buildHero(unit.heroId, unit.team, unit.player);
      mesh.position.set(unit.x, 0, unit.z);
      this.battleGroup.add(mesh);
      this.unitMeshes.set(unit.id, mesh);
    }
    this.setView("battle");
    this.publish();
  }

  stopSession() {
    this.clearUnits();
    this.sim = null;
    this.snap.live = false;
  }

  setLock(lock: boolean) {
    this.lockInput = lock;
  }

  setPaused(paused: boolean) {
    this.paused = paused;
  }

  skipFinale() {
    if (this.sim) skipFinale(this.sim);
  }

  giveUp() {
    if (this.sim) forfeit(this.sim);
  }

  resize() {
    const canvas = this.renderer.domElement;
    const w = Math.max(1, canvas.clientWidth);
    const h = Math.max(1, canvas.clientHeight);
    this.cssW = w;
    this.cssH = h;
    this.renderer.setPixelRatio(this.pr);
    this.renderer.setSize(w, h, false);
    this.overlay.width = Math.floor(w * this.pr);
    this.overlay.height = Math.floor(h * this.pr);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    this.renderer.setAnimationLoop(null);
    this.timer.disconnect();
    this.resizeObs.disconnect();
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    this.renderer.domElement.removeEventListener("pointerdown", this.onPointerDown);
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerup", this.onPointerUp);
    if (window.__controlsTest) delete window.__controlsTest;
    this.clearUnits();
    disposeTree(this.scene);
    this.renderer.dispose();
  }

  private clearUnits() {
    for (const mesh of this.unitMeshes.values()) {
      this.battleGroup.remove(mesh);
      disposeTree(mesh);
    }
    this.unitMeshes.clear();
  }

  private sample(consume: boolean) {
    const keys = this.qaKeys ?? this.keys;
    let x = this.qaKeys ? 0 : this.moveX;
    let y = this.qaKeys ? 0 : this.moveY;
    if (keys.has("KeyA") || keys.has("ArrowLeft")) x -= 1;
    if (keys.has("KeyD") || keys.has("ArrowRight")) x += 1;
    if (keys.has("KeyW") || keys.has("ArrowUp")) y += 1;
    if (keys.has("KeyS") || keys.has("ArrowDown")) y -= 1;
    if (!this.qaKeys) {
      x *= this.sens;
      y *= this.sens;
    }
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    const cast = consume && this.queue.length ? this.queue.shift()! : null;
    const attack = this.attack || keys.has("Space") || keys.has("KeyJ");
    return { x, y, attack, cast, autoTarget: this.autoTarget, lock: this.lockInput };
  }

  private frame() {
    this.timer.update();
    const dt = Math.min(this.timer.getDelta(), 0.1);
    this.elapsed += dt;
    this.frameAcc += dt;
    const budget = this.fps === 30 ? 1 / 30 : 0;
    const renderNow = budget === 0 || this.frameAcc >= budget - 0.0001;
    if (renderNow && budget > 0) this.frameAcc = 0;

    if (this.sim && this.view === "battle" && !this.paused && !this.sim.emitted) {
      this.simAcc += dt;
      if (this.simAcc > 0.25) this.simAcc = 0.25;
      let steps = 0;
      const fixed = 1 / 60;
      while (this.simAcc >= fixed && steps < 8) {
        const input = this.sample(this.sim.hitStop <= 0);
        stepSim(this.sim, fixed, input);
        this.simAcc -= fixed;
        steps += 1;
      }
      this.drain();
    } else if (this.sim && this.view === "battle" && this.paused) {
      this.publish();
    }

    this.updateVisuals(dt);
    if (this.renderer.domElement.clientWidth !== this.cssW || this.renderer.domElement.clientHeight !== this.cssH) {
      this.resize();
    }
    if (renderNow) {
      this.renderer.render(this.scene, this.camera);
      this.drawOverlay();
    }
    audio().tick();
  }

  private drain() {
    const sim = this.sim;
    if (!sim) return;
    let played = 0;
    for (const name of sim.sfx) {
      if (played < 4) audio().play(name);
      played += 1;
      if (name === "hurt" && this.haptics && typeof navigator !== "undefined" && navigator.vibrate) {
        if (!this.buzzed) {
          navigator.vibrate(12);
          this.buzzed = true;
        }
      }
    }
    if (!sim.sfx.includes("hurt")) this.buzzed = false;
    sim.sfx.length = 0;
    const events = sim.events.splice(0, sim.events.length);
    for (const event of events) this.hooks.onEvent(event);
    this.publish();
  }

  private publish() {
    const sim = this.sim;
    const snap = this.snap;
    if (!sim) {
      snap.live = false;
      return;
    }
    const player = sim.units[0];
    const hero = HEROES[player.heroId];
    snap.live = true;
    snap.phase = sim.phase;
    snap.finale = sim.phase === "end" ? (sim.result?.victory ? "win" : "lose") : null;
    snap.timeLeft = Math.max(0, sim.duration - sim.time);
    snap.scores = [sim.scores[0], sim.scores[1]];
    snap.hp = player.hp;
    snap.maxHp = player.maxHp;
    snap.shield = player.shield;
    snap.dead = !player.alive;
    snap.respawn = player.respawn;
    snap.cds = [player.cds[0], player.cds[1], player.cds[2]];
    const cdr = sim.labCdr;
    snap.cdMax = [hero.abilities[0].cd * cdr, hero.abilities[1].cd * cdr, hero.abilities[2].cd * cdr];
    snap.atkCd = Math.max(0, player.atkTimer);
    snap.atkMax = hero.atkCd;
    snap.coreOwner = sim.owner;
    snap.coreP = sim.coreP;
    snap.coreMode = sim.coreMode;
    snap.gates = sim.gatesOpen;
    snap.relays = [
      { hp: sim.relays[0].hp, max: sim.relays[0].max },
      { hp: sim.relays[1].hp, max: sim.relays[1].max },
    ];
    snap.feed = sim.feed.slice(0, 3);
    snap.elims = sim.elims;
    snap.assists = sim.assists;
    snap.deaths = sim.deaths;
    snap.objectives = sim.objectives;
    snap.damage = Math.round(sim.damage);
    snap.minimap = sim.units
      .filter((u) => u.alive)
      .map((u) => ({ x: u.x, z: u.z, team: u.team, player: u.player, dummy: u.dummy }));
    snap.wisps = sim.wisps.filter((w) => w.alive).map((w) => ({ x: w.x, z: w.z }));
    snap.speed = Math.hypot(player.vx, player.vz);
    snap.yaw = player.yaw;
    snap.px = player.x;
    snap.pz = player.z;
    snap.countdown = Math.max(0, sim.countdown);
    snap.locked = this.lockInput;
    snap.heroId = player.heroId;
  }

  private updateVisuals(dt: number) {
    const camOff = CAM[this.cameraMode];
    if (this.view === "battle" && this.sim) {
      const player = this.sim.units[0];
      if (this.sim.phase === "end") this.finaleLift = Math.min(6, this.finaleLift + dt * 2.2);
      else this.finaleLift = Math.max(0, this.finaleLift - dt * 3);
      this.desired.set(player.x, camOff.y + this.finaleLift, player.z + camOff.z);
      const k = 1 - Math.exp(-5 * dt);
      this.camera.position.lerp(this.desired, k);
      this.look.set(player.x, 0.8, player.z - 2);
      this.camera.lookAt(this.look);
      if (this.trauma > 0) {
        const s = this.trauma * this.trauma;
        this.camera.position.x += (Math.random() - 0.5) * s;
        this.camera.position.y += (Math.random() - 0.5) * s * 0.4;
        this.trauma = Math.max(0, this.trauma - dt * 1.8);
      }
      for (const unit of this.sim.units) {
        const mesh = this.unitMeshes.get(unit.id);
        if (!mesh) continue;
        mesh.visible = unit.alive || unit.deathAnim > 0;
        mesh.position.set(unit.x, 0, unit.z);
        mesh.rotation.y = unit.yaw + Math.PI;
        const pose = !unit.alive
          ? "defeat"
          : unit.ultAnim > 0.05
            ? "ult"
            : unit.atkAnim > 0.05
              ? "attack"
              : unit.skillAnim > 0.05
                ? "skill"
                : unit.hitFlash > 0.06
                  ? "hit"
                  : unit.moving
                    ? "run"
                    : "idle";
        poseHero(mesh, pose, this.elapsed);
      }
      for (const gate of this.gates) gate.visible = !this.sim.gatesOpen;
      const ownerColor = this.sim.owner < 0 ? 0xe4c16a : this.sim.owner === 0 ? 0x3ecfff : 0xff6d5a;
      const coreMat = this.coreMesh.material as THREE.MeshStandardMaterial;
      coreMat.color.setHex(ownerColor);
      coreMat.emissive.setHex(ownerColor);
      this.coreMesh.rotation.y += dt * 0.8;
      this.coreMesh.position.y = 1.5 + Math.sin(this.elapsed * 2) * 0.12;
      this.coreLight.color.setHex(ownerColor);
      this.marker.visible = this.sim.kind === "move" && !this.sim.zoneHit;
      this.marker.scale.setScalar(1 + Math.sin(this.elapsed * 3) * 0.08);
      this.relays.forEach((mesh, i) => {
        const relay = this.sim!.relays[i];
        mesh.scale.setScalar(0.45 + 0.55 * (relay.hp / relay.max));
        mesh.visible = relay.hp > 0;
      });
      this.wispMeshes.forEach((mesh, i) => {
        const wisp = this.sim?.wisps[i];
        mesh.visible = Boolean(wisp?.alive);
        mesh.rotation.y += dt;
        mesh.position.y = 0.75 + Math.sin(this.elapsed * 3 + i) * 0.12;
      });
      let zi = 0;
      for (const zone of this.sim.zones) {
        const mesh = this.zoneMeshes[zi++];
        if (!mesh) break;
        mesh.visible = zone.alive;
        mesh.position.set(zone.x, 0.07, zone.z);
        mesh.scale.setScalar(zone.r);
        const mat = mesh.material as THREE.MeshBasicMaterial;
        mat.color.setHex(zone.kind === "heal" ? 0x9dcea0 : zone.kind === "trap" ? 0xe4c16a : 0x8eb7e8);
      }
      for (; zi < this.zoneMeshes.length; zi++) this.zoneMeshes[zi].visible = false;
      let n = 0;
      for (const proj of this.sim.projectiles) {
        if (!proj.alive || n >= 48) continue;
        this.projDummy.position.set(proj.x, 0.85, proj.z);
        this.projDummy.scale.setScalar(1);
        this.projDummy.rotation.set(0, 0, 0);
        this.projDummy.updateMatrix();
        this.projMesh.setMatrixAt(n, this.projDummy.matrix);
        this.projMesh.setColorAt(n, proj.team === 0 ? this.allyColor : this.enemyColor);
        n += 1;
      }
      this.projMesh.count = n;
      this.projMesh.instanceMatrix.needsUpdate = true;
      if (this.projMesh.instanceColor) this.projMesh.instanceColor.needsUpdate = true;
      const showRange = this.attack && player.alive;
      this.rangeRing.visible = showRange;
      if (showRange) {
        this.rangeRing.position.set(player.x, 0.08, player.z);
        this.rangeRing.scale.setScalar(player.range);
      }
      if (player.hitFlash > 0.1) this.trauma = Math.max(this.trauma, player.player ? 0.35 : 0);
    } else if (this.view === "base") {
      this.baseGroup.rotation.y = this.orbit;
      this.camera.position.set(8, 12.5, 14);
      this.camera.lookAt(0, 0.6, 0);
      const up = this.baseGroup.getObjectByName("up");
      if (up) up.rotation.z = this.elapsed;
    } else if (this.view === "cine" || this.view === "boot") {
      const k = (Math.sin(this.elapsed * 0.15) * 0.5 + 0.5);
      const dist = this.view === "boot" ? 18 : 22 - k * 8;
      this.camera.position.set(Math.sin(this.elapsed * 0.12) * 4, 6 + (this.view === "boot" ? 2 : 0), dist);
      this.camera.lookAt(0, 1.4, 0);
      this.cineGroup.children.forEach((child, i) => {
        if (child === this.menuAnchor) return;
        const bob = (child.userData.bob as number) || child.position.y;
        child.position.y = bob + Math.sin(this.elapsed * 0.8 + i) * 0.25;
      });
    } else {
      this.camera.position.lerp(this.desired.set(3.4, 2.6, 6.4), 1 - Math.exp(-3 * dt));
      this.camera.lookAt(0, 1.25, 0);
      if (this.preview) {
        poseHero(this.preview, "idle", this.elapsed);
        this.preview.rotation.y = this.elapsed * 0.4;
      }
      this.menuGroup.children.forEach((child, i) => {
        if (child === this.menuAnchor) return;
        const base = (child.userData.bob as number) || 1;
        child.position.y = base + Math.sin(this.elapsed * 0.7 + i) * 0.18;
      });
    }
  }

  private allyColor = new THREE.Color(0x9aefff);
  private enemyColor = new THREE.Color(0xff8d7a);

  private drawOverlay() {
    const ctx = this.octx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.overlay.width, this.overlay.height);
    if (!this.sim || this.view !== "battle") return;
    ctx.setTransform(this.pr, 0, 0, this.pr, 0, 0);
    ctx.font = "600 11px Outfit, sans-serif";
    ctx.textAlign = "center";
    for (const unit of this.sim.units) {
      if (!unit.alive) continue;
      const p = this.project(unit.x, 2.35, unit.z);
      if (!p) continue;
      const w = unit.player ? 54 : 40;
      const h = 5;
      ctx.fillStyle = "rgba(7,16,24,0.7)";
      ctx.fillRect(p.x - w / 2, p.y, w, h);
      const pct = Math.max(0, unit.hp / unit.maxHp);
      ctx.fillStyle = unit.team === 0 ? "#3ecfff" : "#ff6d5a";
      ctx.fillRect(p.x - w / 2, p.y, w * pct, h);
      if (unit.shield > 0) {
        ctx.fillStyle = "#e4c16a";
        ctx.fillRect(p.x - w / 2, p.y - 3, w * Math.min(1, unit.shield / 250), 2);
      }
      ctx.fillStyle = "#e7eef6";
      ctx.fillText(unit.player ? "You" : unit.dummy ? "Construct" : unit.name.split(" ")[0], p.x, p.y - 4);
    }
    for (const floater of this.sim.floaters) {
      const p = this.project(floater.x, floater.y, floater.z);
      if (!p) continue;
      ctx.globalAlpha = Math.max(0, floater.life / floater.max);
      ctx.fillStyle = floater.kind === "heal" ? "#9dcea0" : floater.kind === "hurt" ? "#ff6d5a" : floater.kind === "info" ? "#e4c16a" : "#e7eef6";
      ctx.font = "700 13px Outfit, sans-serif";
      ctx.fillText(floater.text, p.x, p.y);
      ctx.globalAlpha = 1;
    }
  }

  private project(x: number, y: number, z: number) {
    this.v.set(x, y, z).project(this.camera);
    if (this.v.z > 1) return null;
    return {
      x: (this.v.x * 0.5 + 0.5) * this.cssW,
      y: (-this.v.y * 0.5 + 0.5) * this.cssH,
    };
  }

  private pick(clientX: number, clientY: number): BuildingId | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.baseGroup.children, true);
    for (const hit of hits) {
      let obj: THREE.Object3D | null = hit.object;
      while (obj) {
        if (typeof obj.userData.buildingId === "string") return obj.userData.buildingId as BuildingId;
        obj = obj.parent;
      }
    }
    return null;
  }
}

export async function createEngine(
  canvas: HTMLCanvasElement,
  overlay: HTMLCanvasElement,
  settings: Settings,
  onProgress?: (p: number, label: string) => void,
) {
  onProgress?.(0.25, "Raising the arena");
  await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
  const engine = new FrontierEngine(canvas, overlay, settings);
  onProgress?.(0.7, "Lighting the Core");
  engine.renderer.compile(engine.scene, engine.camera);
  engine.renderer.render(engine.scene, engine.camera);
  await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
  onProgress?.(1, "Ready");
  return engine;
}

export function sessionFromKind(kind: SessionKind, heroId: HeroId, mods: Omit<SessionOpts, "kind" | "heroId">): SessionOpts {
  return { kind, heroId, ...mods };
}
