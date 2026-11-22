import { BUILDING_IDS, HERO_IDS } from "./types";
import type { BuildingId, BuildingState, HeroId, MatchResult, Rewards, SaveData, Settings } from "./types";
import { ACHIEVEMENTS, MISSIONS } from "./data";
import { computeRewards, missionGoal, upgradeCost, upgradeDuration, xpToNext } from "./formulas";

const KEY = "frontier.frnt.v1";
const BAK = "frontier.frnt.v1.bak";

export const SAVE_VERSION = 1;

export function defaultSettings(): Settings {
  return {
    quality: "medium",
    fps: 60,
    master: 0.8,
    music: 0.55,
    sfx: 0.85,
    voice: 0.7,
    sensitivity: 1,
    autoTarget: true,
    camera: "mid",
    haptics: true,
    locale: "en",
  };
}

function building(level: number, placed: boolean): BuildingState {
  return { level, placed, upgradeEndsAt: null, upgradeMs: null };
}

export function defaultSave(now = Date.now()): SaveData {
  const mastery = Object.fromEntries(HERO_IDS.map((id) => [id, 0])) as Record<HeroId, number>;
  const buildings = Object.fromEntries(
    BUILDING_IDS.map((id) => [id, building(id === "beacon" ? 0 : 1, id !== "beacon")]),
  ) as Record<BuildingId, BuildingState>;
  return {
    version: 1,
    name: "Warden",
    energy: 40,
    xp: 0,
    level: 1,
    selectedHero: "kael",
    unlocked: ["kael", "nyx"],
    mastery,
    chapter: 0,
    tutorialRewarded: false,
    introSeen: false,
    buildings,
    lastCollect: now - 20 * 60_000,
    missionsDate: dayKey(now),
    missions: MISSIONS.map((m) => ({ id: m.id, progress: 0, claimed: false })),
    achievements: [],
    stats: { matches: 0, wins: 0, elims: 0, objectives: 0 },
    xpBoost: false,
    clanXp: 0,
    settings: defaultSettings(),
  };
}

export function dayKey(now = Date.now()) {
  const d = new Date(now);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function isHero(v: unknown): v is HeroId {
  return typeof v === "string" && (HERO_IDS as readonly string[]).includes(v);
}

export function migrate(raw: unknown): SaveData {
  const base = defaultSave();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Partial<SaveData>;
  if (o.version !== 1) return base;
  const unlocked = Array.isArray(o.unlocked) ? o.unlocked.filter(isHero) : base.unlocked;
  if (!unlocked.includes("kael")) unlocked.unshift("kael");
  const selected = isHero(o.selectedHero) && unlocked.includes(o.selectedHero) ? o.selectedHero : "kael";
  const mastery = { ...base.mastery };
  if (o.mastery && typeof o.mastery === "object") {
    for (const id of HERO_IDS) {
      const n = (o.mastery as Record<string, unknown>)[id];
      if (typeof n === "number" && Number.isFinite(n)) mastery[id] = Math.max(0, n);
    }
  }
  const buildings = { ...base.buildings };
  if (o.buildings && typeof o.buildings === "object") {
    for (const id of BUILDING_IDS) {
      const b = (o.buildings as Record<string, BuildingState>)[id];
      if (!b || typeof b !== "object") continue;
      buildings[id] = {
        level: clampInt(b.level, 0, 4),
        placed: Boolean(b.placed),
        upgradeEndsAt: typeof b.upgradeEndsAt === "number" ? b.upgradeEndsAt : null,
        upgradeMs: typeof b.upgradeMs === "number" ? b.upgradeMs : null,
      };
    }
  }
  const name = typeof o.name === "string" ? o.name.replace(/\s+/g, " ").trim().slice(0, 16) : base.name;
  return {
    ...base,
    ...o,
    version: 1,
    name: name || "Warden",
    energy: num(o.energy, base.energy),
    xp: num(o.xp, 0),
    level: clampInt(o.level ?? 1, 1, 50),
    selectedHero: selected,
    unlocked,
    mastery,
    chapter: clampInt(o.chapter ?? 0, 0, 8),
    tutorialRewarded: Boolean(o.tutorialRewarded),
    introSeen: Boolean(o.introSeen),
    buildings,
    lastCollect: num(o.lastCollect, base.lastCollect),
    missionsDate: typeof o.missionsDate === "string" ? o.missionsDate : base.missionsDate,
    missions: normalizeMissions(o.missions),
    achievements: Array.isArray(o.achievements) ? o.achievements.filter((a) => typeof a === "string") : [],
    stats: {
      matches: num(o.stats?.matches, 0),
      wins: num(o.stats?.wins, 0),
      elims: num(o.stats?.elims, 0),
      objectives: num(o.stats?.objectives, 0),
    },
    xpBoost: Boolean(o.xpBoost),
    clanXp: num(o.clanXp, 0),
    settings: { ...defaultSettings(), ...(o.settings ?? {}) },
  };
}

function normalizeMissions(raw: SaveData["missions"] | undefined) {
  const base = MISSIONS.map((m) => ({ id: m.id, progress: 0, claimed: false }));
  if (!Array.isArray(raw)) return base;
  return base.map((m) => {
    const found = raw.find((r) => r && r.id === m.id);
    if (!found) return m;
    return {
      id: m.id,
      progress: num(found.progress, 0),
      claimed: Boolean(found.claimed),
    };
  });
}

function num(v: unknown, fallback: number) {
  return typeof v === "number" && Number.isFinite(v) ? Math.max(0, v) : fallback;
}

function clampInt(v: unknown, min: number, max: number) {
  const n = typeof v === "number" ? v : min;
  return Math.max(min, Math.min(max, Math.round(n)));
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return ensureDaily(refreshBuildings(defaultSave()));
    return ensureDaily(refreshBuildings(migrate(JSON.parse(raw))));
  } catch {
    return ensureDaily(refreshBuildings(defaultSave()));
  }
}

export function persistSave(save: SaveData) {
  try {
    const prev = localStorage.getItem(KEY);
    if (prev) localStorage.setItem(BAK, prev);
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    /* private mode / quota — keep the in-memory save */
  }
}

export function refreshBuildings(save: SaveData, now = Date.now()): SaveData {
  let changed = false;
  const buildings = { ...save.buildings };
  let achievements = save.achievements;
  for (const id of BUILDING_IDS) {
    const b = buildings[id];
    if (b.upgradeEndsAt != null && now >= b.upgradeEndsAt) {
      const nextLevel = Math.min(4, b.level + 1);
      buildings[id] = {
        level: nextLevel,
        placed: true,
        upgradeEndsAt: null,
        upgradeMs: null,
      };
      changed = true;
      achievements = addAchievement(achievements, "architect");
    }
  }
  if (!changed) return save;
  return { ...save, buildings, achievements };
}

export function ensureDaily(save: SaveData, now = Date.now()): SaveData {
  const key = dayKey(now);
  if (save.missionsDate === key) return save;
  return {
    ...save,
    missionsDate: key,
    missions: MISSIONS.map((m) => ({ id: m.id, progress: 0, claimed: false })),
  };
}

function addAchievement(list: string[], id: string) {
  if (list.includes(id)) return list;
  if (!ACHIEVEMENTS.some((a) => a.id === id)) return list;
  return [...list, id];
}

export function withXp(save: SaveData, amount: number): { save: SaveData; levels: number } {
  let level = save.level;
  let xp = save.xp + Math.max(0, amount);
  let levels = 0;
  while (level < 50 && xp >= xpToNext(level)) {
    xp -= xpToNext(level);
    level += 1;
    levels += 1;
  }
  return { save: { ...save, level, xp }, levels };
}

function bumpMission(save: SaveData, id: string, amount: number): SaveData {
  if (amount <= 0) return save;
  const goal = missionGoal(id);
  return {
    ...save,
    missions: save.missions.map((m) =>
      m.id === id && !m.claimed ? { ...m, progress: Math.min(goal, m.progress + amount) } : m,
    ),
  };
}

export function applyMatch(save: SaveData, result: MatchResult): { save: SaveData; rewards: Rewards } {
  const baseRewards = computeRewards(save, result);
  const leveled = withXp(save, baseRewards.xp);
  let next: SaveData = {
    ...leveled.save,
    energy: leveled.save.energy + baseRewards.energy,
    xpBoost: false,
    mastery: {
      ...leveled.save.mastery,
      [result.heroId]: (leveled.save.mastery[result.heroId] ?? 0) + baseRewards.mastery,
    },
    stats: {
      matches: leveled.save.stats.matches + 1,
      wins: leveled.save.stats.wins + (result.victory ? 1 : 0),
      elims: leveled.save.stats.elims + result.elims,
      objectives: leveled.save.stats.objectives + result.objectives,
    },
  };
  next = bumpMission(next, "play", 1);
  next = bumpMission(next, "elims", result.elims);
  next = bumpMission(next, "core", result.objectives);
  let achievements = next.achievements;
  if (result.elims > 0 || next.stats.elims > 0) achievements = addAchievement(achievements, "first-blood");
  if (result.objectives > 0) achievements = addAchievement(achievements, "core-keeper");
  if (next.stats.matches >= 5) achievements = addAchievement(achievements, "veteran");
  next = { ...next, achievements };
  return {
    save: next,
    rewards: { ...baseRewards, levels: leveled.levels },
  };
}

export function claimMission(save: SaveData, id: string): SaveData | null {
  const m = save.missions.find((x) => x.id === id);
  if (!m || m.claimed || m.progress < missionGoal(id)) return null;
  const reward = MISSIONS.find((x) => x.id === id)?.reward ?? 0;
  return {
    ...save,
    energy: save.energy + reward,
    missions: save.missions.map((x) => (x.id === id ? { ...x, claimed: true } : x)),
  };
}

export function collectEnergy(save: SaveData, now = Date.now()): SaveData | null {
  const gain = pendingEnergy(save, now);
  if (gain <= 0) return null;
  return { ...save, energy: save.energy + gain, lastCollect: now };
}

export function beginUpgrade(save: SaveData, id: BuildingId, now = Date.now()): SaveData | null {
  const b = save.buildings[id];
  if (!b || b.upgradeEndsAt) return null;
  if (b.level >= 4) return null;
  if (id !== "beacon" && !b.placed) return null;
  const cost = upgradeCost(id, b.level);
  if (save.energy < cost) return null;
  const ms = id === "beacon" && b.level === 0 ? 10_000 : upgradeDuration(Math.max(1, b.level));
  return {
    ...save,
    energy: save.energy - cost,
    buildings: {
      ...save.buildings,
      [id]: { ...b, upgradeEndsAt: now + ms, upgradeMs: ms },
    },
  };
}

export function contributeClan(save: SaveData): SaveData | null {
  if (save.energy < 25) return null;
  return { ...save, energy: save.energy - 25, clanXp: save.clanXp + 25 };
}

export function unlockHero(save: SaveData, id: HeroId): SaveData | null {
  if (save.unlocked.includes(id)) return null;
  const cost = HERO_IDS.includes(id) ? costOf(id) : 0;
  if (save.energy < cost) return null;
  return { ...save, energy: save.energy - cost, unlocked: [...save.unlocked, id] };
}

function costOf(id: HeroId) {
  const table: Record<HeroId, number> = { kael: 0, nyx: 0, oria: 320, vex: 360, sera: 340, thorn: 420 };
  return table[id];
}

export function buyBoost(save: SaveData): SaveData | null {
  if (save.xpBoost || save.energy < 40) return null;
  return { ...save, energy: save.energy - 40, xpBoost: true };
}

export function markIntro(save: SaveData): SaveData {
  if (save.introSeen) return save;
  return { ...save, introSeen: true };
}

export function setChapter(save: SaveData, chapter: number): SaveData {
  return { ...save, chapter };
}

export function finishBriefing(save: SaveData): SaveData {
  return { ...save, chapter: 8, achievements: addAchievement(save.achievements, "first-steps") };
}
