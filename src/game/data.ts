import type { Ability, BuildingId, HeroDef, HeroId } from "./types";

const dash = (name: string, blurb: string, cd: number, dist: number, aoe?: number, dmg?: number, stun?: number): Ability => ({
  name,
  blurb,
  cd,
  effect: { type: "dash", dist, aoe, dmg, stun },
});

export const HEROES: Record<HeroId, HeroDef> = {
  kael: {
    id: "kael",
    name: "Kael Voss",
    short: "Kael",
    title: "The Bulwark",
    role: "Vanguard",
    passive: "Fortify — incoming damage is reduced by 8%.",
    passiveKey: "fortify",
    color: "#3ecfff",
    hex: 0x3ecfff,
    accent: 0xc5d4e0,
    hp: 980,
    speed: 6.2,
    atk: 78,
    atkCd: 0.72,
    range: 2.35,
    ranged: false,
    unlock: 0,
    abilities: [
      dash("Rampart", "Dash and slam, stunning anyone in the landing.", 7, 4.4, 2.15, 86, 0.45),
      { name: "Bulwark", blurb: "Raise a personal shield that eats the next hits.", cd: 11, effect: { type: "shield", amount: 230 } },
      {
        name: "Citadel",
        blurb: "Ultimate. Slam the ground. Heavy damage and a slow around you.",
        cd: 26,
        effect: { type: "aoe", radius: 4.3, dmg: 175, slow: 1.1, at: "self" },
      },
    ],
  },
  nyx: {
    id: "nyx",
    name: "Nyx Shade",
    short: "Nyx",
    title: "Umbral Edge",
    role: "Assassin",
    passive: "Execute — deal 15% more damage to targets below 40% health.",
    passiveKey: "execute",
    color: "#d7b4ff",
    hex: 0xd7b4ff,
    accent: 0x2a2340,
    hp: 640,
    speed: 7.6,
    atk: 64,
    atkCd: 0.52,
    range: 2.15,
    ranged: false,
    unlock: 0,
    abilities: [
      dash("Umbral Step", "Blink through a gap. No damage — pure angle.", 6, 7.2),
      { name: "Fang", blurb: "A close cut that bites hard if someone is in reach.", cd: 7, effect: { type: "strike", range: 2.5, dmg: 128 } },
      {
        name: "Night Chain",
        blurb: "Ultimate. A piercing line that roots.",
        cd: 28,
        effect: { type: "projectile", dmg: 188, speed: 26, pierce: true, root: 1 },
      },
    ],
  },
  oria: {
    id: "oria",
    name: "Oria Lumen",
    short: "Oria",
    title: "Prism Saint",
    role: "Arcanist",
    passive: "Chill — your abilities slow enemies briefly.",
    passiveKey: "chill",
    color: "#e4c16a",
    hex: 0xe4c16a,
    accent: 0xf4efe2,
    hp: 620,
    speed: 6.4,
    atk: 54,
    atkCd: 0.86,
    range: 9.2,
    ranged: true,
    unlock: 320,
    abilities: [
      { name: "Arc Bolt", blurb: "A fast bolt of prism light.", cd: 4.6, effect: { type: "projectile", dmg: 102, speed: 20 } },
      { name: "Prism Field", blurb: "Drop a slowing field where you aim.", cd: 9, effect: { type: "zone", radius: 3.3, ttl: 3, slow: 1 } },
      { name: "Starfall", blurb: "Ultimate. Delayed strikes rain around your aim.", cd: 30, effect: { type: "rain", count: 5, spread: 4.2, radius: 1.45, dmg: 58 } },
    ],
  },
  vex: {
    id: "vex",
    name: "Vex Quill",
    short: "Vex",
    title: "Long Horizon",
    role: "Ranger",
    passive: "Mark — basic attacks slow the target.",
    passiveKey: "mark",
    color: "#9dcea0",
    hex: 0x9dcea0,
    accent: 0xd6a45a,
    hp: 680,
    speed: 6.6,
    atk: 58,
    atkCd: 0.68,
    range: 10,
    ranged: true,
    unlock: 360,
    abilities: [
      { name: "Line Shot", blurb: "A piercing shot down the lane.", cd: 5, effect: { type: "projectile", dmg: 94, speed: 24, pierce: true } },
      { name: "Quill Trap", blurb: "Arm a trap at your feet. It roots the first enemy.", cd: 12, effect: { type: "zone", radius: 1.5, ttl: 8, trap: true, root: 1.15 } },
      { name: "Horizon Rain", blurb: "Ultimate. A wide volley on your aim point.", cd: 28, effect: { type: "aoe", radius: 5, dmg: 154, at: "aim" } },
    ],
  },
  sera: {
    id: "sera",
    name: "Sera Bloom",
    short: "Sera",
    title: "Sanctuary",
    role: "Support",
    passive: "Ward — your heals also grant a small shield.",
    passiveKey: "ward",
    color: "#f0b7c8",
    hex: 0xf0b7c8,
    accent: 0x3ecfff,
    hp: 740,
    speed: 6.5,
    atk: 42,
    atkCd: 0.9,
    range: 8.2,
    ranged: true,
    unlock: 340,
    abilities: [
      { name: "Mend", blurb: "Heal the most wounded ally nearby, or yourself.", cd: 7, effect: { type: "heal", amount: 155, radius: 8 } },
      { name: "Aegis", blurb: "Shield that same ally.", cd: 10, effect: { type: "shield", amount: 180, ally: true } },
      { name: "Sanctuary", blurb: "Ultimate. A healing well on your position.", cd: 32, effect: { type: "zone", radius: 4.4, ttl: 3.2, heal: 48 } },
    ],
  },
  thorn: {
    id: "thorn",
    name: "Thorn Meridian",
    short: "Thorn",
    title: "Grid Warden",
    role: "Controller",
    passive: "Drag — your abilities drag extra slow onto enemies.",
    passiveKey: "drag",
    color: "#8eb7e8",
    hex: 0x8eb7e8,
    accent: 0x142033,
    hp: 760,
    speed: 6.3,
    atk: 48,
    atkCd: 0.8,
    range: 8.4,
    ranged: true,
    unlock: 420,
    abilities: [
      { name: "Spike", blurb: "A rooting spike.", cd: 7.5, effect: { type: "projectile", dmg: 64, speed: 18, root: 1.05 } },
      { name: "Lattice", blurb: "A slowing lattice where you aim.", cd: 9, effect: { type: "zone", radius: 3.5, ttl: 2.6, slow: 1 } },
      { name: "Gravity Well", blurb: "Ultimate. Pull enemies inward and crack them.", cd: 30, effect: { type: "pull", radius: 5.1, dmg: 108, dist: 3 } },
    ],
  },
};

export const HERO_LIST: HeroDef[] = ["kael", "nyx", "oria", "vex", "sera", "thorn"].map((id) => HEROES[id as HeroId]);

export type BuildingDef = {
  id: BuildingId;
  name: string;
  purpose: string;
  max: number;
};

export const BUILDINGS: BuildingDef[] = [
  { id: "hq", name: "Headquarters", purpose: "Match Energy payout grows with each level.", max: 4 },
  { id: "generator", name: "Resource Generator", purpose: "Produces Energy over time. Collect it here.", max: 4 },
  { id: "tower", name: "Defense Tower", purpose: "Your Warden enters battle with more health.", max: 4 },
  { id: "training", name: "Hero Training Center", purpose: "Match mastery gains increase.", max: 4 },
  { id: "lab", name: "Technology Laboratory", purpose: "Ability cooldowns shorten slightly.", max: 4 },
  { id: "core", name: "Energy Core", purpose: "Capturing the arena Core scores more.", max: 4 },
  { id: "beacon", name: "Signal Beacon", purpose: "Optional pad. Place it to earn bonus match XP.", max: 4 },
];

export const TIPS = [
  "Hold the Core to open the side routes.",
  "Retreat under a third of your health. Respawns are short, but relays are not.",
  "Supports should mend the lowest ally, not the nearest full one.",
  "Jungle wisps restore health. They are worth the detour.",
  "Your base changes battle stats. It never sells a win.",
  "Ultimates swing a fight. Do not spend them on an empty lane.",
  "Assassins want the side route once the bridges unlock.",
];

export const MISSIONS = [
  { id: "play", name: "Enter the arena", detail: "Finish a practice match.", goal: 1, reward: 25 },
  { id: "elims", name: "Three eliminations", detail: "Eliminate enemy wardens.", goal: 3, reward: 30 },
  { id: "core", name: "Take the Core", detail: "Be on the team that captures the Core.", goal: 1, reward: 30 },
];

export const ACHIEVEMENTS = [
  { id: "first-steps", name: "First Steps", detail: "Finish the Frontier briefing." },
  { id: "first-blood", name: "First Blood", detail: "Eliminate an enemy warden." },
  { id: "core-keeper", name: "Core Keeper", detail: "Capture the living Core." },
  { id: "architect", name: "Architect", detail: "Upgrade a building." },
  { id: "veteran", name: "Veteran", detail: "Finish five practice matches." },
];

export const CLAN = {
  name: "Northline Compact",
  motto: "Hold the line. Feed the Core.",
  members: [
    { name: "Warden", role: "Recruit", you: true },
    { name: "Ivo Quill", role: "Pathfinder", you: false },
    { name: "Mara Venn", role: "Mason", you: false },
    { name: "Pell Ash", role: "Lookout", you: false },
    { name: "Senn", role: "Archivist", you: false },
  ],
};

export const LOBBY_NOTE =
  "Offline practice. You and two AI wardens versus three AI wardens. Ranked online (Photon Fusion) is not connected.";

export function kindForChapter(ch: number) {
  if (ch <= 1) return "move" as const;
  if (ch === 2) return "attack" as const;
  if (ch === 3) return "abilities" as const;
  if (ch === 4) return "core" as const;
  if (ch === 5) return "battle" as const;
  return null;
}
