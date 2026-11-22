import { useEffect, useState } from "react";
import { Castle, Home, Settings, Store, Swords, Users, Zap } from "lucide-react";
import { ACHIEVEMENTS, BUILDINGS, CLAN, HERO_LIST, LOBBY_NOTE, MISSIONS, TIPS } from "../data";
import { clanLevel, masteryLevel, missionGoal, pendingEnergy, upgradeCost, xpToNext } from "../formulas";
import { audio } from "../audio";
import { useGame } from "../store";
import type { BuildingId, HeroId, Screen } from "../types";
import { Emblem, GhostButton, GoldButton, Panel, PrimaryButton } from "./ui";

function ping(fn: () => void) {
  return () => {
    audio().unlock();
    audio().play("ui");
    fn();
  };
}

const NAV: { id: Screen; label: string; icon: typeof Home }[] = [
  { id: "menu", label: "Home", icon: Home },
  { id: "heroes", label: "Heroes", icon: Swords },
  { id: "base", label: "Base", icon: Castle },
  { id: "lobby", label: "Battle", icon: Swords },
  { id: "clan", label: "Clan", icon: Users },
  { id: "shop", label: "Shop", icon: Store },
  { id: "settings", label: "Settings", icon: Settings },
];

export function NavBar() {
  const screen = useGame((s) => s.screen);
  const setScreen = useGame((s) => s.setScreen);
  return (
    <nav className="pointer-events-auto grid grid-cols-7 border-t border-line bg-bg-elev/90 backdrop-blur-md">
      {NAV.map((item) => {
        const Icon = item.icon;
        const active = screen === item.id || (item.id === "menu" && screen === "menu");
        return (
          <button
            key={item.id}
            type="button"
            aria-label={item.label}
            className={`flex min-h-14 flex-col items-center justify-center gap-1 text-xs ${active ? "text-primary" : "text-muted"}`}
            onClick={ping(() => setScreen(item.id))}
          >
            <Icon className="h-5 w-5" />
            <span className="hidden sm:block">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export function Boot({ onSkip }: { onSkip: () => void }) {
  return (
    <button type="button" onClick={onSkip} className="pointer-events-auto flex h-full w-full flex-col items-center justify-center bg-bg text-primary">
      <div className="anim-emblem flex flex-col items-center">
        <Emblem className="h-24 w-24" />
        <p className="mt-6 font-display text-4xl tracking-[0.28em] text-fg">FRONTIER</p>
        <p className="mt-2 text-xs tracking-[0.45em] text-accent">FRNT</p>
        <p className="mt-8 text-sm text-muted">Tap to continue</p>
      </div>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {Array.from({ length: 10 }).map((_, i) => (
          <span
            key={i}
            className="mote absolute h-1 w-1 rounded-full bg-primary"
            style={{ left: `${8 + i * 9}%`, bottom: `${12 + (i % 4) * 10}%`, animationDelay: `${i * 0.25}s` }}
          />
        ))}
      </div>
    </button>
  );
}

export function Cinematic({ onSkip }: { onSkip: () => void }) {
  return (
    <div className="pointer-events-none flex h-full flex-col">
      <div className="safe flex justify-end p-4">
        <GhostButton className="pointer-events-auto" onClick={ping(onSkip)}>
          Skip
        </GhostButton>
      </div>
      <div className="anim-late mt-auto px-6 pb-16 text-center">
        <div className="mx-auto mb-4 w-fit text-primary">
          <Emblem className="h-14 w-14" />
        </div>
        <h1 className="font-display text-4xl tracking-[0.22em] text-fg">FRONTIER</h1>
        <p className="mt-3 text-sm text-accent">Build Your Power. Shape The Battlefield.</p>
      </div>
    </div>
  );
}

export function LoadingScreen({
  progress,
  label,
  error,
  onRetry,
}: {
  progress: number;
  label: string;
  error: string | null;
  onRetry: () => void;
}) {
  const [tip, setTip] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTip((n) => (n + 1) % TIPS.length), 2400);
    return () => clearInterval(id);
  }, []);
  const pct = Math.max(0, Math.min(100, Math.round(progress * 100)));
  return (
    <div className="flex h-full flex-col justify-end p-4 sm:p-8">
      <Panel className="mx-auto w-full max-w-md p-5">
        <div className="flex items-center gap-3 text-primary">
          <Emblem className="h-8 w-8" />
          <div>
            <p className="font-display text-lg tracking-widest text-fg">FRONTIER</p>
            <p className="text-xs text-muted">FRNT</p>
          </div>
        </div>
        {error ? (
          <div className="mt-4">
            <p className="text-sm text-danger">{error}</p>
            <PrimaryButton className="mt-3" onClick={ping(onRetry)}>
              Retry
            </PrimaryButton>
          </div>
        ) : (
          <>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-line">
              <div className="h-full bg-primary transition-[width] duration-300" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-2 flex justify-between text-xs text-muted">
              <span>{label}</span>
              <span>{pct}%</span>
            </div>
            <p className="mt-4 min-h-10 text-sm text-fg">{TIPS[tip]}</p>
          </>
        )}
      </Panel>
    </div>
  );
}

export function MenuScreen({ onPlay }: { onPlay: () => void }) {
  const save = useGame((s) => s.save);
  const ready = useGame((s) => s.ready);
  const hero = HERO_LIST.find((h) => h.id === save.selectedHero) ?? HERO_LIST[0];
  const next = xpToNext(save.level);
  return (
    <div className="safe flex h-full flex-col">
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 p-3 landscape:grid-cols-[18rem_1fr_18rem]">
        <Panel className="scroll max-h-44 p-4 landscape:max-h-none">
          <p className="text-xs tracking-widest text-primary">WARDEN</p>
          <h2 className="mt-1 font-display text-2xl">{save.name}</h2>
          <p className="text-sm text-muted">
            Level {save.level} · {hero.short}
          </p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line">
            <div className="h-full bg-primary" style={{ width: `${Math.min(100, (save.xp / next) * 100)}%` }} />
          </div>
          <p className="mt-1 text-xs text-muted">
            {Math.floor(save.xp)} / {next} XP
          </p>
          <p className="mt-3 flex items-center gap-2 text-accent">
            <Zap className="h-4 w-4" />
            <span className="font-display text-lg">{Math.floor(save.energy)} Energy</span>
          </p>
          <p className="mt-3 text-xs text-muted">
            {save.stats.wins} wins · {save.stats.matches} matches · {save.stats.elims} eliminations
          </p>
        </Panel>
        <div className="relative min-h-48">
          <div className="pointer-events-none absolute inset-x-0 bottom-2 flex flex-col items-center gap-2 px-4 text-center">
            <p className="font-display text-sm tracking-[0.35em] text-primary">FRNT</p>
            <p className="font-display text-2xl text-fg">{hero.name}</p>
            <p className="text-xs text-muted">{hero.title}</p>
            <PrimaryButton className="pointer-events-auto mt-1 px-10 text-lg" disabled={!ready} onClick={ping(onPlay)}>
              PLAY
            </PrimaryButton>
            <p className="text-xs text-muted">Offline practice · 3v3 with AI</p>
            <p className="text-xs text-muted landscape:hidden">Landscape shows more of the arena.</p>
          </div>
        </div>
        <Panel className="scroll max-h-52 p-4 landscape:max-h-none">
          <p className="text-xs tracking-widest text-accent">TODAY</p>
          <ul className="mt-2 space-y-3">
            {MISSIONS.map((mission) => {
              const prog = save.missions.find((m) => m.id === mission.id);
              const goal = missionGoal(mission.id);
              const done = (prog?.progress ?? 0) >= goal;
              return (
                <li key={mission.id}>
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span>{mission.name}</span>
                    <span className="text-muted">
                      {Math.min(goal, prog?.progress ?? 0)}/{goal}
                    </span>
                  </div>
                  {done && !prog?.claimed && (
                    <GhostButton className="mt-1 px-3 py-2 text-xs" onClick={ping(() => useGame.getState().doClaim(mission.id))}>
                      Claim {mission.reward} Energy
                    </GhostButton>
                  )}
                  {prog?.claimed && <p className="text-xs text-primary">Claimed</p>}
                </li>
              );
            })}
          </ul>
          <p className="mt-4 text-xs tracking-widest text-muted">HONORS</p>
          <ul className="mt-2 space-y-1 text-sm">
            {ACHIEVEMENTS.map((item) => (
              <li key={item.id} className={save.achievements.includes(item.id) ? "text-accent" : "text-muted"}>
                {item.name}
              </li>
            ))}
          </ul>
        </Panel>
      </div>
      <NavBar />
    </div>
  );
}

export function HeroesScreen({ onPreview }: { onPreview: (id: HeroId) => void }) {
  const save = useGame((s) => s.save);
  const [focus, setFocus] = useState<HeroId>(save.selectedHero);
  const hero = HERO_LIST.find((h) => h.id === focus) ?? HERO_LIST[0];
  const unlocked = save.unlocked.includes(hero.id);
  useEffect(() => {
    onPreview(focus);
  }, [focus, onPreview]);
  return (
    <div className="safe flex h-full min-h-0 flex-col">
      <div className="scroll flex gap-2 p-3 landscape:hidden">
        {HERO_LIST.map((item) => (
          <HeroChip key={item.id} id={item.id} active={item.id === focus} onPick={() => setFocus(item.id)} />
        ))}
      </div>
      <div className="grid min-h-0 flex-1 landscape:grid-cols-[14rem_1fr_20rem]">
        <div className="scroll hidden gap-2 p-4 landscape:flex landscape:flex-col">
          {HERO_LIST.map((item) => (
            <HeroChip key={item.id} id={item.id} active={item.id === focus} onPick={() => setFocus(item.id)} />
          ))}
        </div>
        <div className="relative min-h-40">
          <div className="pointer-events-none absolute inset-x-0 bottom-3 text-center">
            <p className="font-display text-2xl text-fg">{hero.name}</p>
            <p className="text-sm text-muted">
              {hero.role} · {hero.title}
            </p>
          </div>
        </div>
        <Panel className="scroll m-3 max-h-[42vh] p-4 landscape:m-4 landscape:max-h-none">
          <p className="text-sm text-muted">{hero.passive}</p>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <Stat label="Health" value={String(hero.hp)} />
            <Stat label="Damage" value={String(hero.atk)} />
            <Stat label="Range" value={hero.ranged ? "Ranged" : "Melee"} />
            <Stat label="Mastery" value={String(masteryLevel(save.mastery[hero.id] ?? 0))} />
          </dl>
          <ul className="mt-4 space-y-2">
            {hero.abilities.map((ability, index) => (
              <li key={ability.name} className="rounded-lg border border-line px-3 py-2">
                <p className="text-sm text-fg">
                  {index === 2 ? "Ultimate · " : ""}
                  {ability.name}
                  <span className="text-muted"> · {ability.cd}s</span>
                </p>
                <p className="text-xs text-muted">{ability.blurb}</p>
              </li>
            ))}
          </ul>
          {unlocked ? (
            <PrimaryButton className="mt-4 w-full" onClick={ping(() => useGame.getState().selectHero(hero.id))}>
              {save.selectedHero === hero.id ? "Selected" : "Select warden"}
            </PrimaryButton>
          ) : (
            <GoldButton className="mt-4 w-full" onClick={ping(() => useGame.getState().doUnlock(hero.id))}>
              Unlock · {hero.unlock} Energy
            </GoldButton>
          )}
        </Panel>
      </div>
      <NavBar />
    </div>
  );
}

function HeroChip({ id, active, onPick }: { id: HeroId; active: boolean; onPick: () => void }) {
  const hero = HERO_LIST.find((h) => h.id === id)!;
  const unlocked = useGame((s) => s.save.unlocked.includes(id));
  return (
    <button
      type="button"
      onClick={ping(onPick)}
      className={`pointer-events-auto min-w-28 rounded-lg border px-3 py-2 text-left ${active ? "border-primary text-fg" : "border-line text-muted"}`}
    >
      <span className="block h-2 w-8 rounded-full" style={{ background: hero.color }} />
      <span className="mt-1 block text-sm text-fg">{hero.short}</span>
      <span className="block text-xs">{unlocked ? hero.role : "Locked"}</span>
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-bg/60 px-2 py-1">
      <dt className="text-xs text-muted">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function BaseScreen({
  picked,
  onPick,
  tutoring,
}: {
  picked: BuildingId | null;
  onPick: (id: BuildingId) => void;
  tutoring: boolean;
}) {
  const save = useGame((s) => s.save);
  const [now, setNow] = useState<number | null>(null);
  const [sawCollect, setSawCollect] = useState(false);
  const [sawUpgrade, setSawUpgrade] = useState(false);
  useEffect(() => {
    setNow(Date.now());
  }, []);
  const focus = picked ?? "generator";
  const def = BUILDINGS.find((b) => b.id === focus)!;
  const state = save.buildings[focus];
  const pending = now == null ? 0 : pendingEnergy(save, now);
  const cost = upgradeCost(focus, state.level);
  const busy = state.upgradeEndsAt != null && now != null && now < state.upgradeEndsAt;
  const left = busy && state.upgradeEndsAt && now ? Math.ceil((state.upgradeEndsAt - now) / 1000) : 0;
  const pct = busy && state.upgradeMs && state.upgradeEndsAt && now ? 1 - (state.upgradeEndsAt - now) / state.upgradeMs : 0;
  const canPlace = focus === "beacon" && !state.placed;
  return (
    <div className="safe flex h-full min-h-0 flex-col">
      <div className="min-h-[34vh] flex-1" />
      <Panel className="scroll mx-3 mb-3 max-h-[48vh] p-4 landscape:absolute landscape:top-4 landscape:right-4 landscape:bottom-20 landscape:m-0 landscape:w-80">
        {tutoring && save.chapter === 6 && (
          <p className="mb-3 text-sm text-accent">
            Collect Energy from the Generator, then start an upgrade.
            {sawCollect && sawUpgrade ? " The base has your order." : ""}
          </p>
        )}
        <div className="mb-3 flex items-center justify-between">
          <p className="flex items-center gap-2 text-accent">
            <Zap className="h-4 w-4" />
            {Math.floor(save.energy)}
          </p>
          <GhostButton
            className={`px-3 py-2 text-xs ${tutoring && save.chapter === 6 && !sawCollect ? "pulse-hint" : ""}`}
            onClick={ping(() => {
              const ok = useGame.getState().doCollect();
              if (ok) setSawCollect(true);
            })}
          >
            Collect {pending}
          </GhostButton>
        </div>
        <div className="scroll flex gap-2 pb-2">
          {BUILDINGS.map((b) => (
            <button
              key={b.id}
              type="button"
              className={`pointer-events-auto rounded-lg border px-2 py-1 text-xs ${b.id === focus ? "border-primary text-fg" : "border-line text-muted"}`}
              onClick={ping(() => onPick(b.id))}
            >
              {b.name.split(" ")[0]}
            </button>
          ))}
        </div>
        <h2 className="mt-2 font-display text-xl">{def.name}</h2>
        <p className="text-sm text-muted">{def.purpose}</p>
        <p className="mt-2 text-sm">
          Level {state.placed ? state.level : 0}
          {state.level >= def.max ? " · Max" : ""}
        </p>
        {busy && (
          <div className="mt-2">
            <div className="h-1.5 overflow-hidden rounded-full bg-line">
              <div className="h-full bg-accent" style={{ width: `${Math.max(0, Math.min(100, pct * 100))}%` }} />
            </div>
            <p className="mt-1 text-xs text-muted">{left}s remaining</p>
          </div>
        )}
        {!busy && state.level < def.max && (
          <PrimaryButton
            className={`mt-3 w-full ${tutoring && save.chapter === 6 && sawCollect && !sawUpgrade && focus === "generator" ? "pulse-hint" : ""}`}
            onClick={ping(() => {
              const ok = useGame.getState().doUpgrade(focus);
              if (ok) setSawUpgrade(true);
            })}
          >
            {canPlace ? `Place · ${cost} Energy` : `Upgrade · ${cost} Energy`}
          </PrimaryButton>
        )}
        {tutoring && save.chapter === 6 && sawCollect && sawUpgrade && (
          <PrimaryButton
            className="mt-3 w-full"
            onClick={ping(() => {
              useGame.getState().setChapterOnly(7);
              useGame.getState().setScreen("reward");
            })}
          >
            Continue
          </PrimaryButton>
        )}
        {tutoring && (
          <button
            type="button"
            className="mt-3 text-xs text-muted"
            onClick={ping(() => {
              const st = useGame.getState();
              st.patch({ ...st.save, chapter: 8 });
              useGame.setState({ tutoring: false, screen: "menu" });
            })}
          >
            Skip briefing
          </button>
        )}
        <p className="mt-3 text-xs text-muted">Drag the island to look around. Tap a structure to select it.</p>
      </Panel>
      <NavBar />
    </div>
  );
}

export function LobbyScreen({ onStart }: { onStart: () => void }) {
  const save = useGame((s) => s.save);
  const ready = useGame((s) => s.ready);
  const hero = HERO_LIST.find((h) => h.id === save.selectedHero)!;
  return (
    <div className="safe flex h-full flex-col">
      <div className="grid flex-1 place-items-center p-4">
        <Panel className="w-full max-w-lg p-6">
          <p className="text-xs tracking-widest text-primary">PRACTICE</p>
          <h2 className="mt-1 font-display text-3xl">Frontier Arena</h2>
          <p className="mt-2 text-sm text-muted">{LOBBY_NOTE}</p>
          <p className="mt-4 text-sm">
            Warden · <span className="text-fg">{hero.name}</span>
          </p>
          <PrimaryButton className="mt-5 w-full text-lg" disabled={!ready} onClick={ping(onStart)}>
            Start practice
          </PrimaryButton>
          <div className="mt-4 rounded-lg border border-line px-3 py-3 text-sm text-muted">
            Ranked online is not connected. No matchmaking room is being simulated.
          </div>
        </Panel>
      </div>
      <NavBar />
    </div>
  );
}

export function ResultsScreen({ onHome, onAgain }: { onHome: () => void; onAgain: () => void }) {
  const result = useGame((s) => s.result);
  const rewards = useGame((s) => s.rewards);
  const save = useGame((s) => s.save);
  const tutoring = useGame((s) => s.tutoring);
  if (!result || !rewards) {
    return (
      <div className="grid h-full place-items-center">
        <GhostButton onClick={ping(onHome)}>Home</GhostButton>
      </div>
    );
  }
  const next = xpToNext(save.level);
  return (
    <div className="safe grid h-full place-items-center p-4">
      <Panel className="scroll max-h-full w-full max-w-lg p-6">
        <p className="text-xs tracking-widest text-primary">{result.forfeit ? "FORFEIT" : "ARENA"}</p>
        <h2 className={`mt-1 font-display text-4xl ${result.victory ? "text-accent" : "text-danger"}`}>
          {result.victory ? "Victory" : "Defeat"}
        </h2>
        <p className="mt-1 text-sm text-muted">
          {Math.floor(result.duration / 60)}:{String(Math.floor(result.duration % 60)).padStart(2, "0")} · score {result.scores[0]}–
          {result.scores[1]}
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <Stat label="Eliminations" value={String(result.elims)} />
          <Stat label="Assists" value={String(result.assists)} />
          <Stat label="Objectives" value={String(result.objectives)} />
          <Stat label="Damage" value={String(result.damage)} />
        </dl>
        <div className="mt-4 rounded-lg border border-line px-3 py-3 text-sm">
          <p>
            +{rewards.xp} XP · +{rewards.energy} Energy · +{rewards.mastery} mastery
          </p>
          {rewards.levels > 0 && <p className="text-accent">Level {save.level}</p>}
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
            <div className="h-full bg-primary" style={{ width: `${Math.min(100, (save.xp / next) * 100)}%` }} />
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-2">
          <PrimaryButton onClick={ping(onHome)}>{tutoring ? "Continue briefing" : "Continue"}</PrimaryButton>
          {!tutoring && <GhostButton onClick={ping(onAgain)}>Play again</GhostButton>}
          {!tutoring && (
            <button type="button" className="py-2 text-sm text-muted" onClick={ping(onHome)}>
              Return home
            </button>
          )}
        </div>
      </Panel>
    </div>
  );
}

export function RewardScreen({ onDone }: { onDone: () => void }) {
  const rewards = useGame((s) => s.rewards);
  return (
    <div className="safe grid h-full place-items-center p-4">
      <Panel className="w-full max-w-lg p-6 text-center">
        <p className="text-xs tracking-widest text-accent">REWARDS</p>
        <h2 className="mt-2 font-display text-3xl">The Frontier remembers</h2>
        <p className="mt-3 text-sm text-muted">
          Matches pay XP, Energy, and hero mastery. Your base spends Energy on upgrades that nudge the next fight — never a purchased win.
        </p>
        {rewards && (
          <p className="mt-4 text-sm">
            Last lesson · +{rewards.xp} XP · +{rewards.energy} Energy
          </p>
        )}
        <PrimaryButton className="mt-5 w-full" onClick={ping(onDone)}>
          Enter the Frontier
        </PrimaryButton>
      </Panel>
    </div>
  );
}

export function ClanScreen() {
  const save = useGame((s) => s.save);
  const level = clanLevel(save.clanXp);
  return (
    <div className="safe flex h-full flex-col">
      <div className="scroll flex-1 p-4">
        <Panel className="mx-auto max-w-lg p-5">
          <p className="text-xs tracking-widest text-primary">CLAN BOARD</p>
          <h2 className="mt-1 font-display text-3xl">{CLAN.name}</h2>
          <p className="text-sm text-accent">{CLAN.motto}</p>
          <p className="mt-2 text-sm text-muted">
            Local board only. Live clans are not connected. Level {level} · {save.clanXp} contribution.
          </p>
          <ul className="mt-4 divide-y divide-line">
            {CLAN.members.map((member) => (
              <li key={member.name} className="flex items-center justify-between py-2 text-sm">
                <span>{member.you ? save.name : member.name}</span>
                <span className="text-muted">{member.you ? "You" : member.role}</span>
              </li>
            ))}
          </ul>
          <PrimaryButton className="mt-4 w-full" onClick={ping(() => useGame.getState().doClan())}>
            Contribute 25 Energy
          </PrimaryButton>
        </Panel>
      </div>
      <NavBar />
    </div>
  );
}

export function ShopScreen() {
  const save = useGame((s) => s.save);
  return (
    <div className="safe flex h-full flex-col">
      <div className="scroll flex-1 p-4">
        <div className="mx-auto grid max-w-3xl gap-3">
          <Panel className="p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl">Exchange</h2>
              <p className="flex items-center gap-1 text-accent">
                <Zap className="h-4 w-4" />
                {Math.floor(save.energy)}
              </p>
            </div>
            <p className="mt-1 text-sm text-muted">Spend Energy on wardens and a training boost. Nothing here raises combat stats directly.</p>
          </Panel>
          <Panel className="flex items-center justify-between gap-3 p-4">
            <div>
              <p className="font-display">Focus Philter</p>
              <p className="text-sm text-muted">+25% XP on the next practice match. 40 Energy.</p>
            </div>
            <GhostButton disabled={save.xpBoost} onClick={ping(() => useGame.getState().doBoost())}>
              {save.xpBoost ? "Primed" : "Buy"}
            </GhostButton>
          </Panel>
          {HERO_LIST.map((hero) => {
            const owned = save.unlocked.includes(hero.id);
            return (
              <Panel key={hero.id} className="flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-display">{hero.name}</p>
                  <p className="text-sm text-muted">
                    {hero.role} · {owned ? "Owned" : `${hero.unlock} Energy`}
                  </p>
                </div>
                {owned ? (
                  <GhostButton onClick={ping(() => useGame.getState().selectHero(hero.id))}>
                    {save.selectedHero === hero.id ? "Selected" : "Select"}
                  </GhostButton>
                ) : (
                  <GoldButton onClick={ping(() => useGame.getState().doUnlock(hero.id))}>Unlock</GoldButton>
                )}
              </Panel>
            );
          })}
        </div>
      </div>
      <NavBar />
    </div>
  );
}

export function SettingsScreen({ onReplay, onBack }: { onReplay: () => void; onBack: () => void }) {
  const save = useGame((s) => s.save);
  const update = useGame((s) => s.updateSettings);
  const [confirm, setConfirm] = useState(false);
  const [name, setName] = useState(save.name);
  const settings = save.settings;
  return (
    <div className="safe flex h-full flex-col">
      <div className="scroll flex-1 p-4">
        <Panel className="mx-auto max-w-lg space-y-4 p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl">Settings</h2>
            <GhostButton className="px-3 py-2" onClick={ping(onBack)}>
              Back
            </GhostButton>
          </div>
          <label className="block text-sm">
            Graphics
            <select
              className="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-3 text-fg"
              value={settings.quality}
              onChange={(e) => update({ quality: e.target.value as typeof settings.quality })}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
          <label className="block text-sm">
            Frame rate
            <select
              className="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-3"
              value={settings.fps}
              onChange={(e) => update({ fps: Number(e.target.value) as 30 | 60 })}
            >
              <option value={60}>60</option>
              <option value={30}>30</option>
            </select>
          </label>
          <Slider label="Master" value={settings.master} onChange={(master) => update({ master })} />
          <Slider label="Music" value={settings.music} onChange={(music) => update({ music })} />
          <Slider label="Effects" value={settings.sfx} onChange={(sfx) => update({ sfx })} />
          <Slider label="Voice" value={settings.voice} onChange={(voice) => update({ voice })} />
          <Slider
            label="Stick sensitivity"
            value={(settings.sensitivity - 0.6) / 0.8}
            onChange={(v) => update({ sensitivity: 0.6 + v * 0.8 })}
          />
          <label className="flex items-center justify-between text-sm">
            Auto-target
            <input type="checkbox" checked={settings.autoTarget} onChange={(e) => update({ autoTarget: e.target.checked })} />
          </label>
          <label className="block text-sm">
            Camera
            <select
              className="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-3"
              value={settings.camera}
              onChange={(e) => update({ camera: e.target.value as typeof settings.camera })}
            >
              <option value="near">Near</option>
              <option value="mid">Mid</option>
              <option value="far">Far</option>
            </select>
          </label>
          <label className="flex items-center justify-between text-sm">
            Haptics
            <input type="checkbox" checked={settings.haptics} onChange={(e) => update({ haptics: e.target.checked })} />
          </label>
          <label className="block text-sm">
            Language
            <select className="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-3" value="en" onChange={() => undefined}>
              <option value="en">English</option>
            </select>
            <span className="mt-1 block text-xs text-muted">More languages plug into the locale table. English ships in this build.</span>
          </label>
          <label className="block text-sm">
            Warden name
            <input
              className="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-3 select-text"
              value={name}
              maxLength={16}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => useGame.getState().rename(name)}
            />
          </label>
          <GhostButton className="w-full" onClick={ping(onReplay)}>
            Replay briefing
          </GhostButton>
          {!confirm ? (
            <button type="button" className="text-sm text-danger" onClick={() => setConfirm(true)}>
              Reset progress on this device
            </button>
          ) : (
            <PrimaryButton className="w-full bg-danger text-bg" onClick={ping(() => useGame.getState().resetProgress())}>
              Confirm reset
            </PrimaryButton>
          )}
        </Panel>
      </div>
      <NavBar />
    </div>
  );
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block text-sm">
      <span className="flex justify-between">
        {label}
        <span className="text-muted">{Math.round(value * 100)}</span>
      </span>
      <input
        className="mt-1 w-full"
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

export function Toasts() {
  const toasts = useGame((s) => s.toasts);
  return (
    <div className="pointer-events-none absolute top-4 left-1/2 z-20 flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto rounded-lg border border-line bg-bg-elev/95 px-3 py-2 text-center text-sm">
          {toast.text}
        </div>
      ))}
    </div>
  );
}
