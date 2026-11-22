export type WallDef = {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  gate: boolean;
};

export const BOUNDS = { minX: -33, maxX: 33, minZ: -37, maxZ: 37 };
export const CORE = { x: 0, z: 0, r: 5.25 };
export const MOVE_BEACON = { x: 0, z: 14 };
export const DUMMY_POS = { x: 0, z: 10 };

export const RELAY_POS = [
  { x: 0, z: 34 },
  { x: 0, z: -34 },
] as const;

export const SPAWN = [
  { x: 0, z: 28 },
  { x: 0, z: -28 },
] as const;

export const ALLY_OFFSETS = [
  { x: -3.3, z: 30 },
  { x: 3.3, z: 30 },
] as const;

export const ENEMY_OFFSETS = [
  { x: 0, z: -28 },
  { x: -3.3, z: -30.2 },
  { x: 3.3, z: -30.2 },
] as const;

export const WISP_POS = [
  { x: -24, z: 16 },
  { x: 24, z: -16 },
] as const;

function box(id: string, x: number, z: number, hw: number, hd: number, gate = false): WallDef {
  return { id, minX: x - hw, maxX: x + hw, minZ: z - hd, maxZ: z + hd, gate };
}

export const WALLS: WallDef[] = [
  box("sep-l-n", -12, 16, 2.15, 7.2),
  box("sep-l-s", -12, -16, 2.15, 7.2),
  box("sep-r-n", 12, 16, 2.15, 7.2),
  box("sep-r-s", 12, -16, 2.15, 7.2),
  box("funnel-l-b", -9, 23.5, 3, 1.6),
  box("funnel-r-b", 9, 23.5, 3, 1.6),
  box("funnel-l-r", -9, -23.5, 3, 1.6),
  box("funnel-r-r", 9, -23.5, 3, 1.6),
  box("rock-l", -26, 24, 2.4, 2.2),
  box("rock-r", 26, -24, 2.4, 2.2),
  box("gate-l", -22, 0, 6.2, 1.25, true),
  box("gate-r", 22, 0, 6.2, 1.25, true),
];

export const LANES = [
  { x: 0, z: 0, w: 2.4, d: 54 },
  { x: -22, z: 0, w: 2.2, d: 48 },
  { x: 22, z: 0, w: 2.2, d: 48 },
];
