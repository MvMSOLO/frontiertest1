import { create } from "zustand";
import type { BuildingId, GameEvent, HeroId, MatchResult, Rewards, SaveData, Screen, Settings } from "./types";
import { defaultSave } from "./save";
import {
  beginUpgrade,
  buyBoost,
  claimMission,
  collectEnergy,
  contributeClan,
  ensureDaily,
  finishBriefing,
  loadSave,
  markIntro,
  persistSave,
  refreshBuildings,
  setChapter,
  unlockHero,
  applyMatch,
} from "./save";

type State = {
  save: SaveData;
  hydrated: boolean;
  ready: boolean;
  screen: Screen;
  paused: boolean;
  tutoring: boolean;
  replay: boolean;
  sessionLive: boolean;
  result: MatchResult | null;
  rewards: Rewards | null;
  resultsNext: "menu" | "tutorial-base";
  toasts: { id: number; text: string }[];
  toastSeq: number;
  hydrate: () => void;
  setReady: (v: boolean) => void;
  setScreen: (s: Screen) => void;
  setPaused: (v: boolean) => void;
  patch: (save: SaveData) => void;
  toast: (text: string) => void;
  dismissToast: (id: number) => void;
  updateSettings: (partial: Partial<Settings>) => void;
  rename: (name: string) => void;
  selectHero: (id: HeroId) => void;
  doUnlock: (id: HeroId) => void;
  doBoost: () => void;
  doCollect: () => boolean;
  doUpgrade: (id: BuildingId) => boolean;
  doClaim: (id: string) => void;
  doClan: () => void;
  seeIntro: () => void;
  setChapterOnly: (n: number) => void;
  completeBriefing: () => void;
  beginReplay: () => void;
  applyResult: (result: MatchResult, grant: boolean) => void;
  resetProgress: () => void;
  tickBuildings: () => string[];
};

export const useGame = create<State>((set, get) => ({
  save: defaultSave(0),
  hydrated: false,
  ready: false,
  screen: "boot",
  paused: false,
  tutoring: false,
  replay: false,
  sessionLive: false,
  result: null,
  rewards: null,
  resultsNext: "menu",
  toasts: [],
  toastSeq: 1,
  hydrate: () => {
    const save = loadSave();
    set({ save, hydrated: true });
  },
  setReady: (v) => set({ ready: v }),
  setScreen: (screen) => set({ screen }),
  setPaused: (paused) => set({ paused }),
  patch: (save) => {
    const next = ensureDaily(refreshBuildings(save));
    persistSave(next);
    set({ save: next });
  },
  toast: (text) => {
    const id = get().toastSeq + 1;
    set({ toastSeq: id, toasts: [...get().toasts, { id, text }].slice(-4) });
    setTimeout(() => get().dismissToast(id), 3200);
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
  updateSettings: (partial) => {
    const save = { ...get().save, settings: { ...get().save.settings, ...partial } };
    get().patch(save);
  },
  rename: (name) => {
    const clean = name.replace(/\s+/g, " ").trim().slice(0, 16);
    if (!clean) return;
    get().patch({ ...get().save, name: clean });
  },
  selectHero: (id) => {
    if (!get().save.unlocked.includes(id)) return;
    get().patch({ ...get().save, selectedHero: id });
  },
  doUnlock: (id) => {
    const next = unlockHero(get().save, id);
    if (!next) {
      get().toast("Not enough Energy.");
      return;
    }
    get().patch({ ...next, selectedHero: id });
    get().toast("Warden unlocked.");
  },
  doBoost: () => {
    const next = buyBoost(get().save);
    if (!next) {
      get().toast(get().save.xpBoost ? "A boost is already primed." : "Not enough Energy.");
      return;
    }
    get().patch(next);
    get().toast("Next match grants bonus XP.");
  },
  doCollect: () => {
    const next = collectEnergy(get().save);
    if (!next) {
      get().toast("The generator is still spinning up.");
      return false;
    }
    get().patch(next);
    get().toast("Energy collected.");
    return true;
  },
  doUpgrade: (id) => {
    const next = beginUpgrade(get().save, id);
    if (!next) {
      get().toast("Cannot upgrade that building yet.");
      return false;
    }
    get().patch(next);
    get().toast("Upgrade started.");
    return true;
  },
  doClaim: (id) => {
    const next = claimMission(get().save, id);
    if (!next) return;
    get().patch(next);
    get().toast("Mission reward claimed.");
  },
  doClan: () => {
    const next = contributeClan(get().save);
    if (!next) {
      get().toast("Need 25 Energy to contribute.");
      return;
    }
    get().patch(next);
    get().toast("Contribution logged on the clan board.");
  },
  seeIntro: () => get().patch(markIntro(get().save)),
  setChapterOnly: (n) => get().patch(setChapter(get().save, n)),
  completeBriefing: () => {
    get().patch(finishBriefing(get().save));
    set({ tutoring: false, replay: false });
  },
  beginReplay: () => {
    get().patch(setChapter(get().save, 0));
    set({ tutoring: true, replay: true, screen: "battle" });
  },
  applyResult: (result, grant) => {
    if (!grant) {
      set({ result, rewards: { xp: 0, energy: 0, mastery: 0, levels: 0 }, screen: "results", sessionLive: false, paused: false });
      return;
    }
    const { save, rewards } = applyMatch(get().save, result);
    const prevAch = new Set(get().save.achievements);
    get().patch(save);
    for (const id of save.achievements) {
      if (!prevAch.has(id)) get().toast("Honor unlocked.");
    }
    if (rewards.levels > 0) get().toast(`Level ${save.level}.`);
    set({ result, rewards, screen: "results", sessionLive: false, paused: false });
  },
  resetProgress: () => {
    const settings = get().save.settings;
    const save = { ...defaultSave(), settings, introSeen: true, chapter: 8 };
    get().patch(save);
    set({
      screen: "menu",
      tutoring: false,
      replay: false,
      sessionLive: false,
      result: null,
      rewards: null,
      paused: false,
    });
    get().toast("Progress reset on this device.");
  },
  tickBuildings: () => {
    const before = JSON.stringify(get().save.buildings);
    const next = refreshBuildings(get().save);
    if (JSON.stringify(next.buildings) === before) return [];
    const finished: string[] = [];
    for (const id of Object.keys(next.buildings) as BuildingId[]) {
      if (next.buildings[id].level > get().save.buildings[id].level) finished.push(id);
    }
    get().patch(next);
    return finished;
  },
}));

export type { GameEvent };
