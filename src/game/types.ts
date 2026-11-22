export const HERO_IDS = ["kael", "nyx", "oria", "vex", "sera", "thorn"] as const;
export type HeroId = (typeof HERO_IDS)[number];

export const BUILDING_IDS = ["hq", "generator", "tower", "training", "lab", "core", "beacon"] as const;
export type BuildingId = (typeof BUILDING_IDS)[number];

export type Effect =
  | { type: "dash"; dist: number; aoe?: number; dmg?: number; stun?: number }
  | { type: "shield"; amount: number; ally?: boolean }
  | {
      type: "projectile";
      dmg: number;
      speed: number;
      pierce?: boolean;
      stun?: number;
      root?: number;
      slow?: number;
    }
  | { type: "aoe"; radius: number; dmg: number; slow?: number; at: "self" | "aim" }
  | { type: "heal"; amount: number; radius: number }
  | { type: "zone"; radius: number; ttl: number; slow?: number; heal?: number; trap?: boolean; root?: number }
  | { type: "rain"; count: number; spread: number; radius: number; dmg: number }
  | { type: "pull"; radius: number; dmg: number; dist: number }
  | { type: "strike"; range: number; dmg: number };

export type Ability = {
  name: string;
  blurb: string;
  cd: number;
  effect: Effect;
};

export type PassiveKey = "fortify" | "execute" | "chill" | "mark" | "ward" | "drag";

export type HeroDef = {
  id: HeroId;
  name: string;
  short: string;
  title: string;
  role: string;
  passive: string;
  passiveKey: PassiveKey;
  color: string;
  hex: number;
  accent: number;
  hp: number;
  speed: number;
  atk: number;
  atkCd: number;
  range: number;
  ranged: boolean;
  unlock: number;
  abilities: [Ability, Ability, Ability];
};

export type BuildingState = {
  level: number;
  placed: boolean;
  upgradeEndsAt: number | null;
  upgradeMs: number | null;
};

export type Settings = {
  quality: "low" | "medium" | "high";
  fps: 30 | 60;
  master: number;
  music: number;
  sfx: number;
  voice: number;
  sensitivity: number;
  autoTarget: boolean;
  camera: "near" | "mid" | "far";
  haptics: boolean;
  locale: "en";
};

export type MissionProgress = { id: string; progress: number; claimed: boolean };

export type SaveData = {
  version: 1;
  name: string;
  energy: number;
  xp: number;
  level: number;
  selectedHero: HeroId;
  unlocked: HeroId[];
  mastery: Record<HeroId, number>;
  chapter: number;
  tutorialRewarded: boolean;
  introSeen: boolean;
  buildings: Record<BuildingId, BuildingState>;
  lastCollect: number;
  missionsDate: string;
  missions: MissionProgress[];
  achievements: string[];
  stats: { matches: number; wins: number; elims: number; objectives: number };
  xpBoost: boolean;
  clanXp: number;
  settings: Settings;
};

export type MatchResult = {
  victory: boolean;
  duration: number;
  elims: number;
  assists: number;
  deaths: number;
  objectives: number;
  damage: number;
  scores: [number, number];
  forfeit: boolean;
  heroId: HeroId;
};

export type Rewards = { xp: number; energy: number; mastery: number; levels: number };

export type Screen =
  | "boot"
  | "cine"
  | "loading"
  | "menu"
  | "heroes"
  | "base"
  | "lobby"
  | "battle"
  | "results"
  | "clan"
  | "shop"
  | "settings"
  | "reward";

export type SessionKind = "move" | "attack" | "abilities" | "core" | "battle" | "match";

export type GameEvent =
  | { t: "zone" }
  | { t: "dummy"; n: number }
  | { t: "ability"; i: number }
  | { t: "core" }
  | { t: "elim" }
  | { t: "match-end"; result: MatchResult }
  | { t: "feed"; text: string }
  | { t: "bridges" };

export type HudSnap = {
  live: boolean;
  phase: string;
  finale: "win" | "lose" | null;
  timeLeft: number;
  scores: [number, number];
  hp: number;
  maxHp: number;
  shield: number;
  dead: boolean;
  respawn: number;
  cds: [number, number, number];
  cdMax: [number, number, number];
  atkCd: number;
  atkMax: number;
  coreOwner: -1 | 0 | 1;
  coreP: number;
  coreMode: "neutral" | "ally" | "enemy" | "capping" | "losing" | "contest";
  gates: boolean;
  relays: [{ hp: number; max: number }, { hp: number; max: number }];
  feed: string[];
  elims: number;
  assists: number;
  deaths: number;
  objectives: number;
  damage: number;
  minimap: { x: number; z: number; team: number; player: boolean; dummy: boolean }[];
  wisps: { x: number; z: number }[];
  speed: number;
  yaw: number;
  px: number;
  pz: number;
  countdown: number;
  locked: boolean;
  heroId: HeroId | null;
};

export type ControlsProbe = {
  getYaw: () => number;
  getSpeed: () => number;
  getPos: () => { x: number; z: number };
  setKeys: (codes: string[]) => void;
  setSteer?: (v: number) => void;
};

declare global {
  interface Window {
    __controlsTest?: ControlsProbe;
  }
}
