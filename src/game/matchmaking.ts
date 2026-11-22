import type { HeroId } from "./types";
import { rosterFor } from "./formulas";

/**
 * FRONTIER match entry.
 *
 * This build only queues offline practice. A future online ticket would be
 * issued by a Go matchmaker (Postgres player record, Redis presence) and
 * played on a server-authoritative Photon Fusion 2 room. Combat validation
 * would call the same damage helpers the practice sim uses — no secrets live
 * in the client, and this module does not pretend a room is connected.
 */
export type MatchMode = "offline-practice";

export type MatchTicket = {
  mode: MatchMode;
  seed: number;
  heroId: HeroId;
  allies: HeroId[];
  enemies: HeroId[];
  label: string;
};

export function queuePractice(heroId: HeroId): MatchTicket {
  const roster = rosterFor(heroId);
  return {
    mode: "offline-practice",
    seed: (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0,
    heroId,
    allies: roster.allies,
    enemies: roster.enemies,
    label: "Offline practice · 3v3",
  };
}
