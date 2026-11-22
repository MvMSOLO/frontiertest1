import { HEROES, MISSIONS } from "./data";
import type { BuildingId, HeroId, MatchResult, Rewards, SaveData } from "./types";

export function xpToNext(level: number) {
  return 80 + level * 40;
}

export function upgradeCost(id: BuildingId, level: number) {
  if (id === "beacon" && level <= 0) return 90;
  return Math.round(80 * Math.pow(1.55, Math.max(0, level - 1)));
}

export function upgradeDuration(level: number) {
  if (level <= 1) return 15_000;
  if (level === 2) return 40_000;
  return 90_000;
}

export function generatorRate(level: number) {
  return 2 + Math.max(0, level - 1) * 1.5;
}

export function pendingEnergy(save: SaveData, now = Date.now()) {
  const lvl = save.buildings.generator.level;
  if (!save.buildings.generator.placed || lvl < 1) return 0;
  const mins = Math.min(180, Math.max(0, (now - save.lastCollect) / 60_000));
  return Math.floor(mins * generatorRate(lvl));
}

export function clanLevel(xp: number) {
  return 1 + Math.floor(xp / 100);
}

export function masteryLevel(xp: number) {
  return 1 + Math.floor(xp / 120);
}

export function labCdr(level: number) {
  return 1 - 0.04 * Math.max(0, level - 1);
}

export function towerHpMul(level: number) {
  return 1 + 0.03 * Math.max(0, level - 1);
}

export function beaconXpMul(save: SaveData) {
  const b = save.buildings.beacon;
  if (!b.placed || b.level < 1) return 1;
  return 1 + 0.04 * b.level;
}

export function computeRewards(save: SaveData, result: MatchResult): Omit<Rewards, "levels"> {
  const win = result.victory ? 1 : 0;
  let xp =
    36 +
    result.elims * 14 +
    result.assists * 7 +
    result.objectives * 12 +
    win * 48 +
    Math.round(result.damage / 90);
  if (result.forfeit) xp = Math.round(xp * 0.45);
  let energy = 22 + result.elims * 6 + result.objectives * 10 + win * 32;
  if (result.forfeit) energy = Math.round(energy * 0.4);
  const hq = save.buildings.hq.level;
  energy = Math.round(energy * (1 + 0.02 * Math.max(0, hq - 1)));
  xp = Math.round(xp * beaconXpMul(save));
  if (save.xpBoost) xp = Math.round(xp * 1.25);
  const training = save.buildings.training.level;
  const mastery = Math.round(xp * (0.7 + 0.04 * Math.max(0, training - 1)));
  return { xp, energy, mastery };
}

export function rosterFor(heroId: HeroId): { allies: HeroId[]; enemies: HeroId[] } {
  const prefer: HeroId[] = ["sera", "thorn", "vex", "oria", "kael", "nyx"];
  const rest = prefer.filter((id) => id !== heroId);
  return { allies: [rest[0], rest[1]], enemies: [rest[2], rest[3], rest[4]] };
}

export function heroOf(id: HeroId) {
  return HEROES[id];
}

export function missionGoal(id: string) {
  return MISSIONS.find((m) => m.id === id)?.goal ?? 1;
}

export function missionReward(id: string) {
  return MISSIONS.find((m) => m.id === id)?.reward ?? 20;
}
