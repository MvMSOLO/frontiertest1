import { HEROES } from "../data";
import { ALLY_OFFSETS, BOUNDS, CORE, DUMMY_POS, ENEMY_OFFSETS, MOVE_BEACON, RELAY_POS, SPAWN, WALLS, WISP_POS } from "../map";
import type { GameEvent, HeroId, MatchResult, SessionKind } from "../types";
import { rosterFor } from "../formulas";

export type SessionOpts = {
  kind: SessionKind;
  heroId: HeroId;
  seed?: number;
  instant?: boolean;
  labCdr: number;
  hpMul: number;
  coreBonus: number;
  enemyHpMul: number;
};

type Team = 0 | 1;

export type Unit = {
  id: number;
  heroId: HeroId;
  name: string;
  team: Team;
  player: boolean;
  dummy: boolean;
  x: number;
  z: number;
  yaw: number;
  hp: number;
  maxHp: number;
  shield: number;
  speed: number;
  range: number;
  atk: number;
  atkCd: number;
  atkTimer: number;
  cds: [number, number, number];
  stun: number;
  root: number;
  slow: number;
  alive: boolean;
  respawn: number;
  invuln: number;
  hitFlash: number;
  atkAnim: number;
  skillAnim: number;
  ultAnim: number;
  deathAnim: number;
  moving: boolean;
  bonusNext: number;
  goalX: number;
  goalZ: number;
  think: number;
  stuck: number;
  hurtByPlayer: number;
  radius: number;
  ranged: boolean;
  vx: number;
  vz: number;
};

type Projectile = {
  alive: boolean;
  x: number;
  z: number;
  vx: number;
  vz: number;
  ttl: number;
  dmg: number;
  team: Team;
  r: number;
  pierce: boolean;
  hits: number[];
  stun: number;
  root: number;
  slow: number;
  owner: number;
  basic: boolean;
};

type Zone = {
  alive: boolean;
  kind: "slow" | "heal" | "trap";
  x: number;
  z: number;
  r: number;
  ttl: number;
  team: Team;
  armed: boolean;
  root: number;
  heal: number;
  owner: number;
};

type Delayed = {
  alive: boolean;
  t: number;
  x: number;
  z: number;
  r: number;
  dmg: number;
  team: Team;
  owner: number;
};

export type Floater = {
  x: number;
  z: number;
  y: number;
  text: string;
  life: number;
  max: number;
  kind: "dmg" | "hurt" | "heal" | "info";
};

export type StepInput = {
  x: number;
  y: number;
  attack: boolean;
  cast: number | null;
  autoTarget: boolean;
  lock: boolean;
};

export type Sim = {
  kind: SessionKind;
  units: Unit[];
  projectiles: Projectile[];
  zones: Zone[];
  delayed: Delayed[];
  gatesOpen: boolean;
  charge: number;
  owner: -1 | 0 | 1;
  relays: [{ hp: number; max: number; x: number; z: number }, { hp: number; max: number; x: number; z: number }];
  scores: [number, number];
  time: number;
  duration: number;
  phase: "countdown" | "play" | "end" | "sandbox";
  countdown: number;
  endTimer: number;
  emitted: boolean;
  hitStop: number;
  elims: number;
  assists: number;
  deaths: number;
  damage: number;
  objectives: number;
  seed: number;
  rng: () => number;
  feed: string[];
  events: GameEvent[];
  sfx: string[];
  floaters: Floater[];
  dummyHits: number;
  zoneHit: boolean;
  labCdr: number;
  coreBonus: number;
  coreTick: number;
  coreMode: "neutral" | "ally" | "enemy" | "capping" | "losing" | "contest";
  coreP: number;
  lock: boolean;
  result: MatchResult | null;
  forfeit: boolean;
  wisps: { x: number; z: number; alive: boolean; respawn: number }[];
  heroId: HeroId;
};

let uid = 1;

function mulberry(seed: number) {
  let a = seed >>> 0 || 1;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeUnit(heroId: HeroId, team: Team, player: boolean, x: number, z: number, hpMul: number): Unit {
  const h = HEROES[heroId];
  const max = Math.round(h.hp * (player ? hpMul : 1));
  return {
    id: uid++,
    heroId,
    name: h.name,
    team,
    player,
    dummy: false,
    x,
    z,
    yaw: team === 0 ? 0 : Math.PI,
    hp: max,
    maxHp: max,
    shield: 0,
    speed: h.speed,
    range: h.range,
    atk: h.atk,
    atkCd: h.atkCd,
    atkTimer: 0.2,
    cds: [0, 0, 0],
    stun: 0,
    root: 0,
    slow: 0,
    alive: true,
    respawn: 0,
    invuln: 0.4,
    hitFlash: 0,
    atkAnim: 0,
    skillAnim: 0,
    ultAnim: 0,
    deathAnim: 0,
    moving: false,
    bonusNext: 0,
    goalX: x,
    goalZ: z,
    think: 0.2,
    stuck: 0,
    hurtByPlayer: 0,
    radius: 0.72,
    ranged: h.ranged,
    vx: 0,
    vz: 0,
  };
}

export function createSim(opts: SessionOpts): Sim {
  uid = 1;
  const roster = rosterFor(opts.heroId);
  const units: Unit[] = [];
  const player = makeUnit(opts.heroId, 0, true, SPAWN[0].x, opts.kind === "move" ? 26 : SPAWN[0].z, opts.hpMul);
  units.push(player);
  if (opts.kind === "attack" || opts.kind === "abilities") {
    const dummy = makeUnit("thorn", 1, false, DUMMY_POS.x, DUMMY_POS.z, 1);
    dummy.dummy = true;
    dummy.name = "Construct";
    dummy.maxHp = 5000;
    dummy.hp = 5000;
    dummy.speed = 0;
    units.push(dummy);
  }
  if (opts.kind === "battle" || opts.kind === "match") {
    roster.allies.forEach((id, i) => {
      const p = ALLY_OFFSETS[i];
      units.push(makeUnit(id, 0, false, p.x, p.z, 1));
    });
    roster.enemies.forEach((id, i) => {
      const p = ENEMY_OFFSETS[i];
      const u = makeUnit(id, 1, false, p.x, p.z, 1);
      if (opts.kind === "battle") {
        u.maxHp = Math.round(u.maxHp * opts.enemyHpMul);
        u.hp = u.maxHp;
      } else {
        u.maxHp = Math.round(u.maxHp * opts.enemyHpMul);
        u.hp = u.maxHp;
      }
      units.push(u);
    });
  }
  const sandbox = opts.kind !== "battle" && opts.kind !== "match";
  const relayMax = opts.kind === "battle" ? 3600 : 4800;
  return {
    kind: opts.kind,
    units,
    projectiles: [],
    zones: [],
    delayed: [],
    gatesOpen: false,
    charge: 0,
    owner: -1,
    relays: [
      { hp: relayMax, max: relayMax, x: RELAY_POS[0].x, z: RELAY_POS[0].z },
      { hp: relayMax, max: relayMax, x: RELAY_POS[1].x, z: RELAY_POS[1].z },
    ],
    scores: [0, 0],
    time: 0,
    duration: opts.kind === "battle" ? 150 : 180,
    phase: sandbox ? "sandbox" : opts.instant ? "play" : "countdown",
    countdown: opts.instant ? 0 : 3,
    endTimer: 0,
    emitted: false,
    hitStop: 0,
    elims: 0,
    assists: 0,
    deaths: 0,
    damage: 0,
    objectives: 0,
    seed: opts.seed ?? 1,
    rng: mulberry(opts.seed ?? 1),
    feed: [],
    events: [],
    sfx: [],
    floaters: [],
    dummyHits: 0,
    zoneHit: false,
    labCdr: opts.labCdr,
    coreBonus: opts.coreBonus,
    coreTick: 0,
    coreMode: "neutral",
    coreP: 0,
    lock: false,
    result: null,
    forfeit: false,
    wisps:
      opts.kind === "battle" || opts.kind === "match"
        ? WISP_POS.map((w) => ({ x: w.x, z: w.z, alive: true, respawn: 0 }))
        : [],
    heroId: opts.heroId,
  };
}

function dist(ax: number, az: number, bx: number, bz: number) {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.hypot(dx, dz);
}

function blocked(sim: Sim, x: number, z: number, rad: number) {
  if (x < BOUNDS.minX + rad || x > BOUNDS.maxX - rad || z < BOUNDS.minZ + rad || z > BOUNDS.maxZ - rad) return true;
  for (const w of WALLS) {
    if (w.gate && sim.gatesOpen) continue;
    const cx = Math.max(w.minX, Math.min(w.maxX, x));
    const cz = Math.max(w.minZ, Math.min(w.maxZ, z));
    const dx = x - cx;
    const dz = z - cz;
    if (dx * dx + dz * dz < rad * rad) return true;
  }
  return false;
}

function moveAxis(sim: Sim, u: Unit, dx: number, dz: number) {
  if (dx !== 0 && !blocked(sim, u.x + dx, u.z, u.radius)) u.x += dx;
  if (dz !== 0 && !blocked(sim, u.x, u.z + dz, u.radius)) u.z += dz;
  for (const r of sim.relays) {
    const ddx = u.x - r.x;
    const ddz = u.z - r.z;
    const d = Math.hypot(ddx, ddz) || 0.0001;
    if (d < 1.7) {
      u.x = r.x + (ddx / d) * 1.7;
      u.z = r.z + (ddz / d) * 1.7;
    }
  }
}

function face(u: Unit, x: number, z: number) {
  const dx = x - u.x;
  const dz = z - u.z;
  if (dx * dx + dz * dz < 0.0004) return;
  u.yaw = Math.atan2(-dx, -dz);
}

function forward(u: Unit) {
  return { x: -Math.sin(u.yaw), z: -Math.cos(u.yaw) };
}

function nearestEnemy(sim: Sim, u: Unit, range: number) {
  let best: Unit | null = null;
  let bestD = range;
  for (const o of sim.units) {
    if (!o.alive || o.team === u.team || o.dummy) continue;
    const d = dist(u.x, u.z, o.x, o.z);
    if (d < bestD) {
      bestD = d;
      best = o;
    }
  }
  return best;
}

function lowestAlly(sim: Sim, u: Unit, range: number) {
  let best: Unit | null = null;
  let pct = 0.99;
  for (const o of sim.units) {
    if (!o.alive || o.team !== u.team || o.dummy) continue;
    const d = dist(u.x, u.z, o.x, o.z);
    if (d > range) continue;
    const p = o.hp / o.maxHp;
    if (p < pct) {
      pct = p;
      best = o;
    }
  }
  return best;
}

function pushFloater(sim: Sim, x: number, z: number, text: string, kind: Floater["kind"]) {
  if (sim.floaters.length > 24) sim.floaters.shift();
  sim.floaters.push({ x, z, y: 1.7, text, life: 0.75, max: 0.75, kind });
}

function pushFeed(sim: Sim, text: string) {
  sim.feed.unshift(text);
  if (sim.feed.length > 4) sim.feed.pop();
  sim.events.push({ t: "feed", text });
}

function kill(sim: Sim, src: Unit | null, tgt: Unit) {
  tgt.alive = false;
  tgt.hp = 0;
  tgt.deathAnim = 0.55;
  tgt.respawn = tgt.dummy ? 999 : 6;
  tgt.moving = false;
  if (tgt.player) sim.deaths += 1;
  if (src && src.team !== tgt.team && !tgt.dummy) {
    sim.scores[src.team] += 8;
    if (src.player) {
      sim.elims += 1;
      sim.events.push({ t: "elim" });
      sim.sfx.push("elim");
      sim.hitStop = Math.max(sim.hitStop, 0.045);
    } else if (src.team === 0 && tgt.hurtByPlayer > 0) {
      sim.assists += 1;
    }
    pushFeed(sim, `${src.name} eliminated ${tgt.name}`);
  }
}

function deal(
  sim: Sim,
  src: Unit | null,
  tgt: Unit,
  amount: number,
  opts: { stun?: number; slow?: number; root?: number; basic?: boolean } = {},
) {
  if (!tgt.alive || tgt.invuln > 0 || sim.phase === "countdown" || sim.phase === "end") return 0;
  if (tgt.dummy && src && !src.player) return 0;
  let dmg = amount;
  if (HEROES[tgt.heroId].passiveKey === "fortify") dmg *= 0.92;
  if (src && HEROES[src.heroId].passiveKey === "execute" && tgt.hp / tgt.maxHp < 0.4) dmg *= 1.15;
  if (src && opts.basic) dmg += src.bonusNext;
  if (src && opts.basic) src.bonusNext = 0;
  if (src && !opts.basic && HEROES[src.heroId].passiveKey === "chill") opts = { ...opts, slow: Math.max(opts.slow ?? 0, 1) };
  if (src && !opts.basic && HEROES[src.heroId].passiveKey === "drag") opts = { ...opts, slow: Math.max(opts.slow ?? 0, 1) };
  if (src && opts.basic && HEROES[src.heroId].passiveKey === "mark") opts = { ...opts, slow: Math.max(opts.slow ?? 0, 0.7) };
  let dealt = 0;
  if (tgt.shield > 0) {
    const absorbed = Math.min(tgt.shield, dmg);
    tgt.shield -= absorbed;
    dmg -= absorbed;
    dealt += absorbed;
  }
  const before = tgt.hp;
  tgt.hp = Math.max(0, tgt.hp - dmg);
  dealt += before - tgt.hp;
  if (src?.player) {
    sim.damage += dealt;
    tgt.hurtByPlayer = 8;
    pushFloater(sim, tgt.x, tgt.z, String(Math.max(1, Math.round(dealt))), "dmg");
    sim.sfx.push("hit");
  } else if (tgt.player && dealt > 0) {
    pushFloater(sim, tgt.x, tgt.z, String(Math.max(1, Math.round(dealt))), "hurt");
    sim.sfx.push("hurt");
  }
  tgt.hitFlash = 0.12;
  if (opts.stun) tgt.stun = Math.max(tgt.stun, opts.stun);
  if (opts.slow) tgt.slow = Math.max(tgt.slow, opts.slow);
  if (opts.root) tgt.root = Math.max(tgt.root, opts.root);
  if (tgt.dummy && src?.player) {
    sim.dummyHits += 1;
    sim.events.push({ t: "dummy", n: sim.dummyHits });
  }
  if (tgt.hp <= 0) kill(sim, src, tgt);
  return dealt;
}

function healUnit(sim: Sim, src: Unit | null, tgt: Unit, amount: number) {
  if (!tgt.alive || amount <= 0) return;
  const before = tgt.hp;
  tgt.hp = Math.min(tgt.maxHp, tgt.hp + amount);
  const got = tgt.hp - before;
  if (got > 0 && (tgt.player || src?.player)) pushFloater(sim, tgt.x, tgt.z, `+${Math.round(got)}`, "heal");
  if (src && HEROES[src.heroId].passiveKey === "ward") tgt.shield = Math.min(320, tgt.shield + 40);
  if (src?.player || tgt.player) sim.sfx.push("heal");
}

function damageAoe(sim: Sim, src: Unit, x: number, z: number, radius: number, dmg: number, stun = 0, slow = 0) {
  for (const o of sim.units) {
    if (!o.alive || o.team === src.team) continue;
    if (dist(x, z, o.x, o.z) <= radius + o.radius) deal(sim, src, o, dmg, { stun, slow });
  }
}

function spawnProj(
  sim: Sim,
  src: Unit,
  dmg: number,
  speed: number,
  opts: { pierce?: boolean; stun?: number; root?: number; slow?: number; basic?: boolean; life?: number } = {},
) {
  if (sim.projectiles.filter((p) => p.alive).length > 42) return;
  const f = forward(src);
  let slot = sim.projectiles.find((p) => !p.alive);
  if (!slot) {
    slot = {
      alive: false,
      x: 0,
      z: 0,
      vx: 0,
      vz: 0,
      ttl: 0,
      dmg: 0,
      team: src.team,
      r: 0.35,
      pierce: false,
      hits: [],
      stun: 0,
      root: 0,
      slow: 0,
      owner: src.id,
      basic: false,
    };
    sim.projectiles.push(slot);
  }
  slot.alive = true;
  slot.x = src.x + f.x * 0.8;
  slot.z = src.z + f.z * 0.8;
  slot.vx = f.x * speed;
  slot.vz = f.z * speed;
  slot.ttl = opts.life ?? 1.15;
  slot.dmg = dmg;
  slot.team = src.team;
  slot.r = 0.38;
  slot.pierce = Boolean(opts.pierce);
  slot.hits = [];
  slot.stun = opts.stun ?? 0;
  slot.root = opts.root ?? 0;
  slot.slow = opts.slow ?? 0;
  slot.owner = src.id;
  slot.basic = Boolean(opts.basic);
}

function dash(sim: Sim, u: Unit, distance: number) {
  const f = forward(u);
  const steps = 8;
  for (let i = 1; i <= steps; i++) {
    const nx = u.x + f.x * (distance / steps);
    const nz = u.z + f.z * (distance / steps);
    if (blocked(sim, nx, nz, u.radius)) break;
    u.x = nx;
    u.z = nz;
  }
}

function aimPoint(sim: Sim, u: Unit, auto: boolean) {
  const foe = nearestEnemy(sim, u, 12);
  if (foe && (auto || !u.player)) {
    face(u, foe.x, foe.z);
    return { x: foe.x, z: foe.z, foe };
  }
  const f = forward(u);
  return { x: u.x + f.x * 6, z: u.z + f.z * 6, foe: foe };
}

export function castAbility(sim: Sim, u: Unit, index: number, autoTarget: boolean) {
  if (!u.alive || u.stun > 0 || u.cds[index] > 0) return false;
  if (sim.phase === "countdown" || sim.phase === "end") return false;
  const ability = HEROES[u.heroId].abilities[index];
  const effect = ability.effect;
  const aim = aimPoint(sim, u, autoTarget || !u.player);
  const cdr = u.player ? sim.labCdr : 1;
  switch (effect.type) {
    case "dash": {
      if (aim.foe && (autoTarget || !u.player)) face(u, aim.foe.x, aim.foe.z);
      dash(sim, u, effect.dist);
      if (effect.aoe && effect.dmg) damageAoe(sim, u, u.x, u.z, effect.aoe, effect.dmg, effect.stun ?? 0, 0);
      break;
    }
    case "shield": {
      const tgt = effect.ally ? lowestAlly(sim, u, 8) ?? u : u;
      tgt.shield = Math.min(400, tgt.shield + effect.amount);
      pushFloater(sim, tgt.x, tgt.z, "SHIELD", "info");
      break;
    }
    case "projectile":
      spawnProj(sim, u, effect.dmg, effect.speed, effect);
      break;
    case "strike": {
      const foe = nearestEnemy(sim, u, effect.range + 0.4);
      if (!foe) return false;
      face(u, foe.x, foe.z);
      deal(sim, u, foe, effect.dmg, {});
      break;
    }
    case "aoe": {
      const x = effect.at === "self" ? u.x : aim.x;
      const z = effect.at === "self" ? u.z : aim.z;
      damageAoe(sim, u, x, z, effect.radius, effect.dmg, 0, effect.slow ?? 0);
      break;
    }
    case "heal": {
      const tgt = lowestAlly(sim, u, effect.radius) ?? u;
      healUnit(sim, u, tgt, effect.amount);
      break;
    }
    case "zone": {
      if (sim.zones.filter((z) => z.alive).length > 14) return false;
      sim.zones.push({
        alive: true,
        kind: effect.trap ? "trap" : effect.heal ? "heal" : "slow",
        x: effect.trap ? u.x : aim.x,
        z: effect.trap ? u.z : aim.z,
        r: effect.radius,
        ttl: effect.ttl,
        team: u.team,
        armed: !effect.trap,
        root: effect.root ?? 0,
        heal: effect.heal ?? 0,
        owner: u.id,
      });
      break;
    }
    case "rain": {
      for (let i = 0; i < effect.count; i++) {
        const ang = sim.rng() * Math.PI * 2;
        const rad = sim.rng() * effect.spread;
        sim.delayed.push({
          alive: true,
          t: 0.18 * i + 0.12,
          x: aim.x + Math.cos(ang) * rad,
          z: aim.z + Math.sin(ang) * rad,
          r: effect.radius,
          dmg: effect.dmg,
          team: u.team,
          owner: u.id,
        });
      }
      break;
    }
    case "pull": {
      for (const o of sim.units) {
        if (!o.alive || o.team === u.team) continue;
        const d = dist(aim.x, aim.z, o.x, o.z);
        if (d > effect.radius || d < 0.05) continue;
        const nx = o.x + ((aim.x - o.x) / d) * Math.min(effect.dist, d - 0.4);
        const nz = o.z + ((aim.z - o.z) / d) * Math.min(effect.dist, d - 0.4);
        if (!blocked(sim, nx, o.z, o.radius)) o.x = nx;
        if (!blocked(sim, o.x, nz, o.radius)) o.z = nz;
        deal(sim, u, o, effect.dmg, { slow: 0.8 });
      }
      break;
    }
    default:
      return false;
  }
  u.cds[index] = ability.cd * cdr;
  if (index === 2) u.ultAnim = 0.62;
  else u.skillAnim = 0.34;
  sim.sfx.push(index === 2 ? "ult" : "cast");
  if (u.player) sim.events.push({ t: "ability", i: index });
  return true;
}

function tryBotCast(sim: Sim, u: Unit) {
  const order = [2, 0, 1] as const;
  for (const i of order) {
    if (u.cds[i] > 0) continue;
    const effect = HEROES[u.heroId].abilities[i].effect;
    if (effect.type === "heal" || (effect.type === "shield" && effect.ally)) {
      const ally = lowestAlly(sim, u, 8);
      if (ally && ally.hp / ally.maxHp < 0.62) {
        castAbility(sim, u, i, true);
        return;
      }
      continue;
    }
    const foe = nearestEnemy(sim, u, 11);
    if (!foe) continue;
    if (i === 2 && foe.hp / foe.maxHp > 0.72 && sim.rng() > 0.2) continue;
    if (i !== 2 && sim.rng() > 0.5) continue;
    face(u, foe.x, foe.z);
    castAbility(sim, u, i, true);
    return;
  }
}

function botThink(sim: Sim, u: Unit, dt: number) {
  if (!u.alive || u.dummy || sim.phase === "countdown" || sim.phase === "end") return;
  u.think -= dt;
  if (u.stun > 0) return;
  if (u.think <= 0) {
    u.think = 0.4;
    const foe = nearestEnemy(sim, u, 13);
    const hpPct = u.hp / u.maxHp;
    if (hpPct < 0.3 && foe && dist(u.x, u.z, foe.x, foe.z) < 9) {
      const s = SPAWN[u.team];
      u.goalX = s.x;
      u.goalZ = s.z;
    } else if (foe && dist(u.x, u.z, foe.x, foe.z) < 12) {
      u.goalX = foe.x;
      u.goalZ = foe.z;
    } else if (sim.owner !== u.team) {
      u.goalX = CORE.x + (u.id % 2 === 0 ? 1.2 : -1.2);
      u.goalZ = CORE.z;
    } else if (!sim.gatesOpen) {
      u.goalX = CORE.x;
      u.goalZ = CORE.z;
    } else {
      const relay = sim.relays[u.team === 0 ? 1 : 0];
      u.goalX = relay.x;
      u.goalZ = relay.z + (u.team === 0 ? 2 : -2);
    }
    tryBotCast(sim, u);
  }
  const foe = nearestEnemy(sim, u, u.range + 0.2);
  let move = true;
  if (foe && dist(u.x, u.z, foe.x, foe.z) <= u.range) {
    face(u, foe.x, foe.z);
    move = false;
    tryAttack(sim, u, foe);
    if (u.ranged && dist(u.x, u.z, foe.x, foe.z) < 3.1) {
      move = true;
      u.goalX = u.x + (u.x - foe.x);
      u.goalZ = u.z + (u.z - foe.z);
    }
  } else {
    const relay = sim.relays[u.team === 0 ? 1 : 0];
    const nearFoe = nearestEnemy(sim, u, 8);
    if (!nearFoe && dist(u.x, u.z, relay.x, relay.z) < u.range + 1.2 && sim.gatesOpen) {
      face(u, relay.x, relay.z);
      move = false;
      tryAttackRelay(sim, u, relay);
    }
  }
  if (!move || u.root > 0 || u.stun > 0) {
    u.moving = false;
    u.vx = 0;
    u.vz = 0;
    return;
  }
  const dx = u.goalX - u.x;
  const dz = u.goalZ - u.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.4) {
    u.moving = false;
    return;
  }
  const slow = u.slow > 0 ? 0.62 : 1;
  const step = u.speed * slow * dt;
  const mx = (dx / d) * step;
  const mz = (dz / d) * step;
  const beforeX = u.x;
  const beforeZ = u.z;
  moveAxis(sim, u, mx, mz);
  const moved = Math.hypot(u.x - beforeX, u.z - beforeZ);
  if (moved < step * 0.2) u.stuck += dt;
  else u.stuck = 0;
  if (u.stuck > 0.55) {
    u.goalX += u.id % 2 === 0 ? 5 : -5;
    u.stuck = 0;
  }
  u.vx = (u.x - beforeX) / dt;
  u.vz = (u.z - beforeZ) / dt;
  u.moving = moved > 0.01;
  if (u.moving) u.yaw = Math.atan2(-(u.x - beforeX), -(u.z - beforeZ));
}

function tryAttack(sim: Sim, u: Unit, target: Unit) {
  if (u.atkTimer > 0 || u.stun > 0 || !target.alive) return;
  face(u, target.x, target.z);
  if (u.ranged) spawnProj(sim, u, u.atk, 22, { basic: true, life: 1.05 });
  else deal(sim, u, target, u.atk, { basic: true });
  u.atkTimer = u.atkCd;
  u.atkAnim = 0.28;
}

function tryAttackRelay(
  sim: Sim,
  u: Unit,
  relay: { hp: number; max: number; x: number; z: number },
) {
  if (u.atkTimer > 0 || u.stun > 0 || relay.hp <= 0) return;
  if (dist(u.x, u.z, relay.x, relay.z) > u.range + 1.3) return;
  relay.hp = Math.max(0, relay.hp - u.atk);
  if (u.player) {
    sim.damage += u.atk;
    pushFloater(sim, relay.x, relay.z, String(u.atk), "dmg");
  }
  u.atkTimer = u.atkCd;
  u.atkAnim = 0.28;
  sim.sfx.push("hit");
}

function playerAttack(sim: Sim, u: Unit, auto: boolean) {
  if (u.atkTimer > 0 || u.stun > 0) return;
  const foe = auto ? nearestEnemy(sim, u, Math.max(u.range + 0.3, u.ranged ? u.range : 2.5)) : coneTarget(sim, u);
  if (foe && dist(u.x, u.z, foe.x, foe.z) <= u.range + foe.radius) {
    tryAttack(sim, u, foe);
    return;
  }
  if (u.ranged && !auto) {
    spawnProj(sim, u, u.atk, 22, { basic: true, life: 1.05 });
    u.atkTimer = u.atkCd;
    u.atkAnim = 0.28;
    return;
  }
  const relay = sim.relays[1];
  if (sim.kind === "match" || sim.kind === "battle") {
    if (!foe && dist(u.x, u.z, relay.x, relay.z) <= u.range + 1.4) tryAttackRelay(sim, u, relay);
  }
}

function coneTarget(sim: Sim, u: Unit) {
  let best: Unit | null = null;
  let bestD = u.range + 0.8;
  const f = forward(u);
  for (const o of sim.units) {
    if (!o.alive || o.team === u.team || o.dummy) continue;
    const dx = o.x - u.x;
    const dz = o.z - u.z;
    const d = Math.hypot(dx, dz);
    if (d > bestD || d < 0.001) continue;
    const dot = (dx / d) * f.x + (dz / d) * f.z;
    if (dot > 0.55) {
      bestD = d;
      best = o;
    }
  }
  return best;
}

function separate(sim: Sim) {
  const list = sim.units.filter((u) => u.alive);
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      let dx = b.x - a.x;
      let dz = b.z - a.z;
      let d = Math.hypot(dx, dz);
      const min = a.radius + b.radius;
      if (d >= min) continue;
      if (d < 0.001) {
        dx = 0.02 * (a.id % 2 === 0 ? 1 : -1);
        dz = 0.02;
        d = Math.hypot(dx, dz);
      }
      const push = (min - d) / 2;
      const nx = (dx / d) * push;
      const nz = (dz / d) * push;
      if (!a.dummy) {
        a.x = Math.max(BOUNDS.minX + 0.8, Math.min(BOUNDS.maxX - 0.8, a.x - nx));
        a.z = Math.max(BOUNDS.minZ + 0.8, Math.min(BOUNDS.maxZ - 0.8, a.z - nz));
      }
      if (!b.dummy) {
        b.x = Math.max(BOUNDS.minX + 0.8, Math.min(BOUNDS.maxX - 0.8, b.x + nx));
        b.z = Math.max(BOUNDS.minZ + 0.8, Math.min(BOUNDS.maxZ - 0.8, b.z + nz));
      }
    }
  }
}

function updateCore(sim: Sim, dt: number) {
  if (sim.phase !== "play" && sim.phase !== "sandbox") return;
  let t0 = 0;
  let t1 = 0;
  for (const u of sim.units) {
    if (!u.alive || u.dummy) continue;
    if (dist(u.x, u.z, CORE.x, CORE.z) <= CORE.r) {
      if (u.team === 0) t0 += 1;
      else t1 += 1;
    }
  }
  const only0 = t0 > 0 && t1 === 0;
  const only1 = t1 > 0 && t0 === 0;
  if (t0 > 0 && t1 > 0) sim.coreMode = "contest";
  else if (only0 && sim.owner !== 0) {
    sim.charge = Math.min(1, sim.charge + dt * 0.26);
    sim.coreMode = "capping";
  } else if (only1 && sim.owner !== 1) {
    sim.charge = Math.max(-1, sim.charge - dt * 0.26);
    sim.coreMode = sim.owner === 0 ? "losing" : "capping";
  } else if (sim.owner === 0) sim.coreMode = "ally";
  else if (sim.owner === 1) sim.coreMode = "enemy";
  else sim.coreMode = "neutral";

  if (sim.charge >= 1 && sim.owner !== 0) capture(sim, 0);
  if (sim.charge <= -1 && sim.owner !== 1) capture(sim, 1);
  if (sim.owner < 0) sim.coreP = Math.abs(sim.charge);
  else if (sim.coreMode === "capping" || sim.coreMode === "losing") sim.coreP = (sim.charge + 1) / 2;
  else sim.coreP = 1;

  if (sim.owner === 0 || sim.owner === 1) {
    sim.coreTick += dt;
    if (sim.coreTick >= 1) {
      sim.coreTick -= 1;
      sim.scores[sim.owner] += 2;
    }
  }
}

function capture(sim: Sim, team: 0 | 1) {
  sim.owner = team;
  sim.charge = team === 0 ? 1 : -1;
  const bonus = team === 0 ? sim.coreBonus : 0;
  sim.scores[team] += 6 + bonus;
  if (!sim.gatesOpen) {
    sim.gatesOpen = true;
    sim.events.push({ t: "bridges" });
    pushFeed(sim, "Side routes open");
  }
  pushFeed(sim, team === 0 ? "Your team holds the Core" : "Enemy holds the Core");
  sim.sfx.push("capture");
  if (team === 0) {
    sim.objectives += 1;
    sim.events.push({ t: "core" });
  }
}

function checkEnd(sim: Sim) {
  if (sim.phase !== "play") return;
  const relayDown = sim.relays[0].hp <= 0 || sim.relays[1].hp <= 0;
  const timed = sim.time >= sim.duration;
  if (!relayDown && !timed) return;
  let victory = false;
  if (sim.relays[1].hp <= 0 && sim.relays[0].hp > 0) victory = true;
  else if (sim.relays[0].hp <= 0 && sim.relays[1].hp > 0) victory = false;
  else if (sim.scores[0] !== sim.scores[1]) victory = sim.scores[0] > sim.scores[1];
  else victory = sim.relays[0].hp > sim.relays[1].hp;
  finish(sim, victory, false);
}

export function forfeit(sim: Sim) {
  if (sim.emitted || sim.phase === "end") return;
  finish(sim, false, true);
  sim.endTimer = 0.15;
}

function finish(sim: Sim, victory: boolean, gaveUp: boolean) {
  sim.phase = "end";
  sim.endTimer = gaveUp ? 0.2 : 1.25;
  sim.forfeit = gaveUp;
  sim.result = {
    victory,
    duration: sim.time,
    elims: sim.elims,
    assists: sim.assists,
    deaths: sim.deaths,
    objectives: sim.objectives,
    damage: Math.round(sim.damage),
    scores: [sim.scores[0], sim.scores[1]],
    forfeit: gaveUp,
    heroId: sim.heroId,
  };
  sim.sfx.push(victory ? "win" : "lose");
}

function stepProjectiles(sim: Sim, dt: number) {
  for (const p of sim.projectiles) {
    if (!p.alive) continue;
    p.x += p.vx * dt;
    p.z += p.vz * dt;
    p.ttl -= dt;
    if (p.ttl <= 0 || blocked(sim, p.x, p.z, 0.2)) {
      p.alive = false;
      continue;
    }
    const owner = sim.units.find((u) => u.id === p.owner) ?? null;
    for (const u of sim.units) {
      if (!u.alive || u.team === p.team || p.hits.includes(u.id)) continue;
      if (dist(p.x, p.z, u.x, u.z) > p.r + u.radius) continue;
      deal(sim, owner, u, p.dmg, { stun: p.stun, slow: p.slow, root: p.root, basic: p.basic });
      p.hits.push(u.id);
      if (!p.pierce || p.hits.length >= 3) {
        p.alive = false;
        break;
      }
    }
  }
}

function stepZones(sim: Sim, dt: number) {
  for (const z of sim.zones) {
    if (!z.alive) continue;
    z.ttl -= dt;
    const owner = sim.units.find((u) => u.id === z.owner) ?? null;
    if (z.kind === "trap") {
      if (!z.armed && z.ttl < 7.4) z.armed = true;
      if (z.armed) {
        for (const u of sim.units) {
          if (!u.alive || u.team === z.team) continue;
          if (dist(z.x, z.z, u.x, u.z) <= z.r + u.radius) {
            deal(sim, owner, u, 40, { root: z.root });
            z.ttl = 0;
            break;
          }
        }
      }
    } else if (z.kind === "slow") {
      for (const u of sim.units) {
        if (!u.alive || u.team === z.team) continue;
        if (dist(z.x, z.z, u.x, u.z) <= z.r) u.slow = Math.max(u.slow, 0.2);
      }
    } else if (z.kind === "heal" && owner) {
      for (const u of sim.units) {
        if (!u.alive || u.team !== z.team) continue;
        if (dist(z.x, z.z, u.x, u.z) <= z.r) healUnit(sim, owner, u, z.heal * dt);
      }
    }
    if (z.ttl <= 0) z.alive = false;
  }
  for (const d of sim.delayed) {
    if (!d.alive) continue;
    d.t -= dt;
    if (d.t > 0) continue;
    const owner = sim.units.find((u) => u.id === d.owner) ?? null;
    if (owner) damageAoe(sim, owner, d.x, d.z, d.r, d.dmg, 0, 0.4);
    d.alive = false;
  }
}

function stepWisps(sim: Sim, dt: number) {
  for (const w of sim.wisps) {
    if (!w.alive) {
      w.respawn -= dt;
      if (w.respawn <= 0) w.alive = true;
      continue;
    }
    for (const u of sim.units) {
      if (!u.alive || u.dummy) continue;
      if (dist(u.x, u.z, w.x, w.z) < 1.35) {
        healUnit(sim, null, u, 90);
        w.alive = false;
        w.respawn = 16;
        break;
      }
    }
  }
}

export function stepSim(sim: Sim, dt: number, input: StepInput) {
  if (sim.hitStop > 0) {
    sim.hitStop -= dt;
    return;
  }
  if (sim.phase === "end") {
    sim.endTimer -= dt;
    if (sim.endTimer <= 0 && !sim.emitted && sim.result) {
      sim.emitted = true;
      sim.events.push({ t: "match-end", result: sim.result });
    }
    for (const u of sim.units) {
      if (u.deathAnim > 0) u.deathAnim -= dt;
      if (!u.alive) continue;
      u.ultAnim = Math.max(0, u.ultAnim - dt);
      if (sim.result?.victory && u.team === 0) u.ultAnim = 0.4;
    }
    return;
  }
  if (sim.phase === "countdown") {
    sim.countdown -= dt;
    if (sim.countdown <= 0) sim.phase = "play";
  }
  if (sim.phase === "play") sim.time += dt;

  const player = sim.units[0];
  for (const u of sim.units) {
    if (u.atkTimer > 0) u.atkTimer -= dt;
    if (u.stun > 0) u.stun -= dt;
    if (u.root > 0) u.root -= dt;
    if (u.slow > 0) u.slow -= dt;
    if (u.invuln > 0) u.invuln -= dt;
    if (u.hitFlash > 0) u.hitFlash -= dt;
    if (u.atkAnim > 0) u.atkAnim -= dt;
    if (u.skillAnim > 0) u.skillAnim -= dt;
    if (u.ultAnim > 0) u.ultAnim -= dt;
    if (u.deathAnim > 0) u.deathAnim -= dt;
    if (u.hurtByPlayer > 0) u.hurtByPlayer -= dt;
    if (u.alive) {
      u.cds[0] = Math.max(0, u.cds[0] - dt);
      u.cds[1] = Math.max(0, u.cds[1] - dt);
      u.cds[2] = Math.max(0, u.cds[2] - dt);
    } else if (!u.dummy) {
      u.respawn -= dt;
      if (u.respawn <= 0 && (sim.phase === "play" || sim.phase === "sandbox")) {
        const s = u.player ? SPAWN[0] : u.team === 0 ? ALLY_OFFSETS[u.id % 2] : ENEMY_OFFSETS[u.id % 3];
        u.x = s.x;
        u.z = s.z;
        u.hp = u.maxHp;
        u.alive = true;
        u.shield = 0;
        u.invuln = 1.2;
        u.stun = 0;
        u.root = 0;
      }
    }
  }

  if (player?.alive && !input.lock && sim.lock !== true && player.stun <= 0 && sim.phase !== "end") {
    if (input.cast != null) castAbility(sim, player, input.cast, input.autoTarget);
    const len = Math.hypot(input.x, input.y);
    let mx = input.x;
    let my = input.y;
    if (len > 1) {
      mx /= len;
      my /= len;
    }
    if (len > 0.12 && player.root <= 0) {
      const slow = player.slow > 0 ? 0.62 : 1;
      const dx = mx * player.speed * slow * dt;
      const dz = -my * player.speed * slow * dt;
      const bx = player.x;
      const bz = player.z;
      moveAxis(sim, player, dx, dz);
      const moved = Math.hypot(player.x - bx, player.z - bz);
      player.moving = moved > 0.001;
      player.vx = (player.x - bx) / dt;
      player.vz = (player.z - bz) / dt;
      if (player.moving && !(input.attack && input.autoTarget)) {
        player.yaw = Math.atan2(-(player.x - bx), -(player.z - bz));
      }
    } else {
      player.moving = false;
      player.vx = 0;
      player.vz = 0;
    }
    if (input.attack && (sim.phase === "play" || sim.phase === "sandbox")) playerAttack(sim, player, input.autoTarget);
    if (!sim.zoneHit && dist(player.x, player.z, MOVE_BEACON.x, MOVE_BEACON.z) < 2.15) {
      sim.zoneHit = true;
      sim.events.push({ t: "zone" });
    }
  } else if (player) {
    player.moving = false;
    player.vx = 0;
    player.vz = 0;
  }

  if (sim.phase === "play" || sim.kind === "battle") {
    for (const u of sim.units) {
      if (u.player || !u.alive) continue;
      botThink(sim, u, dt);
    }
  }

  stepProjectiles(sim, dt);
  stepZones(sim, dt);
  if (sim.kind === "core" || sim.kind === "battle" || sim.kind === "match") updateCore(sim, dt);
  stepWisps(sim, dt);
  separate(sim);
  for (const f of sim.floaters) {
    f.life -= dt;
    f.y += dt * 1.3;
  }
  sim.floaters = sim.floaters.filter((f) => f.life > 0);
  if (sim.phase === "play") checkEnd(sim);
}

export function skipFinale(sim: Sim) {
  if (sim.phase !== "end" || sim.emitted || !sim.result) return;
  sim.endTimer = 0;
  sim.emitted = true;
  sim.events.push({ t: "match-end", result: sim.result });
}
