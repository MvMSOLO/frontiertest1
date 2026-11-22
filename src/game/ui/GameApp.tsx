import { useEffect, useRef, useState } from "react";
import { audio } from "../audio";
import { kindForChapter } from "../data";
import type { FrontierEngine } from "../engine/engine";
import { labCdr, towerHpMul } from "../formulas";
import { queuePractice } from "../matchmaking";
import { persistSave } from "../save";
import { useGame } from "../store";
import type { BuildingId, GameEvent, HeroId, MatchResult, Screen, SessionKind } from "../types";
import { BattleHud } from "./hud";
import {
  BaseScreen,
  Boot,
  Cinematic,
  ClanScreen,
  HeroesScreen,
  LoadingScreen,
  LobbyScreen,
  MenuScreen,
  ResultsScreen,
  RewardScreen,
  SettingsScreen,
  ShopScreen,
  Toasts,
} from "./screens";

const NAV: Screen[] = ["menu", "heroes", "base", "lobby", "clan", "shop", "settings"];

export function GameApp() {
  const glRef = useRef<HTMLCanvasElement>(null);
  const fxRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<FrontierEngine | null>(null);
  const handleRef = useRef<(e: GameEvent) => void>(() => {});
  const granted = useRef(false);
  const orientationRequested = useRef(false);
  const returnTo = useRef<Screen>("menu");
  const [load, setLoad] = useState({ p: 0.02, label: "Reading the archive" });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [casts, setCasts] = useState<[boolean, boolean, boolean]>([false, false, false]);
  const [lessonReady, setLessonReady] = useState(false);
  const [picked, setPicked] = useState<BuildingId | null>("generator");

  const screen = useGame((s) => s.screen);
  const save = useGame((s) => s.save);
  const ready = useGame((s) => s.ready);
  const hydrated = useGame((s) => s.hydrated);
  const paused = useGame((s) => s.paused);
  const tutoring = useGame((s) => s.tutoring);

  const previewHero = (id: HeroId) => {
    if (useGame.getState().screen === "heroes") engineRef.current?.setPreviewHero(id);
  };

  const mods = () => {
    const current = useGame.getState().save;
    return {
      labCdr: labCdr(current.buildings.lab.level),
      hpMul: towerHpMul(current.buildings.tower.level),
      coreBonus: Math.max(0, current.buildings.core.level - 1),
    };
  };

  const startKind = (kind: SessionKind, instant = false) => {
    const eng = engineRef.current;
    const st = useGame.getState();
    if (!eng) return;
    granted.current = false;
    setCasts([false, false, false]);
    setLessonReady(false);
    const ticket = queuePractice(st.save.selectedHero);
    eng.startSession({
      kind,
      heroId: ticket.heroId,
      seed: ticket.seed,
      instant: instant || (kind !== "match" && kind !== "battle"),
      enemyHpMul: kind === "battle" ? 0.85 : 1,
      ...mods(),
    });
    eng.setLock(kind === "move" && st.save.chapter === 0);
    eng.setPaused(false);
    useGame.setState({ screen: "battle", paused: false, sessionLive: true, tutoring: kind !== "match" ? st.tutoring : false });
    audio().setMode("battle");
  };

  const startPractice = (instant = false) => {
    useGame.getState().tickBuildings();
    useGame.setState({ tutoring: false, replay: false });
    startKind("match", instant);
  };

  const grantEnd = (result: MatchResult) => {
    if (granted.current) return;
    granted.current = true;
    const st = useGame.getState();
    useGame.setState({ resultsNext: st.tutoring ? "tutorial-base" : "menu" });
    const grant = !(st.tutoring && st.replay);
    st.applyResult(result, grant);
    if (st.tutoring && grant) {
      const next = useGame.getState().save;
      if (!next.tutorialRewarded) useGame.getState().patch({ ...next, tutorialRewarded: true });
    }
    audio().setMode("menu");
  };

  handleRef.current = (event) => {
    const st = useGame.getState();
    if (event.t === "match-end") {
      grantEnd(event.result);
      return;
    }
    if (event.t === "bridges") st.toast("Side routes open.");
    if (!st.tutoring) return;
    const chapter = st.save.chapter;
    if (event.t === "zone" && chapter === 1) {
      st.setChapterOnly(2);
      startKind("attack");
    } else if (event.t === "dummy" && chapter === 2 && event.n >= 3) {
      st.setChapterOnly(3);
      startKind("abilities");
    } else if (event.t === "ability" && chapter === 3) {
      setCasts((prev) => {
        const next: [boolean, boolean, boolean] = [prev[0], prev[1], prev[2]];
        next[event.i] = true;
        if (next[0] && next[1] && next[2]) {
          queueMicrotask(() => {
            if (useGame.getState().save.chapter === 3) {
              useGame.getState().setChapterOnly(4);
              startKind("core");
            }
          });
        }
        return next;
      });
    } else if (event.t === "core" && chapter === 4) {
      st.setChapterOnly(5);
      useGame.setState({ tutoring: true });
      startKind("battle");
    } else if (event.t === "elim" && chapter === 5) {
      setLessonReady(true);
    }
  };

  useEffect(() => {
    useGame.getState().hydrate();
    const unlock = () => {
      audio().unlock();
      if (orientationRequested.current) return;
      const orientation = window.screen.orientation as ScreenOrientation & {
        lock?: (value: "landscape") => Promise<void>;
      };
      if (typeof orientation?.lock !== "function") return;
      orientationRequested.current = true;
      void orientation.lock("landscape").catch(() => {
        // Some browsers only allow orientation lock from installed fullscreen PWAs.
        // The portrait CSS gate remains the reliable fallback.
        orientationRequested.current = false;
      });
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    const onVis = () => {
      if (document.visibilityState === "visible") audio().unlock();
      else persistSave(useGame.getState().save);
    };
    document.addEventListener("visibilitychange", onVis);
    let dead = false;
    let eng: FrontierEngine | null = null;
    const boot = async () => {
      try {
        setLoad({ p: 0.08, label: "Reading the archive" });
        const canvas = glRef.current;
        const overlay = fxRef.current;
        if (!canvas || !overlay) throw new Error("The arena surface did not mount.");
        setLoad({ p: 0.22, label: "Loading the renderer" });
        const mod = await import("../engine/engine");
        if (dead) return;
        const settings = useGame.getState().save.settings;
        eng = await mod.createEngine(canvas, overlay, settings, (p, label) => setLoad({ p: 0.22 + p * 0.7, label }));
        if (dead) {
          eng.dispose();
          return;
        }
        eng.hooks.onEvent = (e) => handleRef.current(e);
        eng.hooks.onPick = (id) => {
          if (id) setPicked(id);
        };
        eng.hooks.onPause = () => {
          if (useGame.getState().screen !== "battle") return;
          const next = !useGame.getState().paused;
          useGame.getState().setPaused(next);
          eng?.setPaused(next);
        };
        eng.setPreviewHero(useGame.getState().save.selectedHero);
        engineRef.current = eng;
        audio().unlock();
        useGame.getState().setReady(true);
        setLoad({ p: 1, label: "Ready" });
      } catch (err) {
        if (!dead) setLoadError(err instanceof Error ? err.message : "The arena failed to start.");
      }
    };
    void boot();
    return () => {
      dead = true;
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      document.removeEventListener("visibilitychange", onVis);
      eng?.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!hydrated || screen !== "boot") return;
    if (new URLSearchParams(window.location.search).get("qa") === "1") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const id = window.setTimeout(() => {
      const seen = useGame.getState().save.introSeen;
      useGame.getState().setScreen(seen ? "loading" : "cine");
    }, reduced ? 500 : 1800);
    return () => window.clearTimeout(id);
  }, [hydrated, screen]);

  useEffect(() => {
    if (screen !== "cine") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const id = window.setTimeout(() => finishCine(), reduced ? 700 : 7000);
    return () => window.clearTimeout(id);
  }, [screen]);

  useEffect(() => {
    if (screen !== "loading" || !ready || loadError) return;
    const id = window.setTimeout(() => enterAfterLoad(), 650);
    return () => window.clearTimeout(id);
  }, [screen, ready, loadError]);

  useEffect(() => {
    if (!ready || !hydrated) return;
    if (new URLSearchParams(window.location.search).get("qa") !== "1") return;
    if (useGame.getState().sessionLive) return;
    startPractice(true);
    // QA launches one practice match.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    const id = window.setInterval(() => {
      const done = useGame.getState().tickBuildings();
      if (done.length) {
        audio().play("upgrade");
        useGame.getState().toast("Upgrade complete.");
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [hydrated]);

  useEffect(() => {
    const eng = engineRef.current;
    if (!eng || !ready) return;
    eng.applySettings(save.settings);
    audio().setVolumes(save.settings);
    if (screen !== "heroes") eng.setPreviewHero(save.selectedHero);
    eng.setBase(save.buildings);
    if (screen === "battle" || screen === "results") eng.setView("battle");
    else if (screen === "base") eng.setView("base");
    else if (screen === "boot") eng.setView("boot");
    else if (screen === "cine") eng.setView("cine");
    else if (screen === "loading") eng.setView("loading");
    else eng.setView("menu");
    const mode = screen === "battle" ? "battle" : screen === "cine" ? "cine" : screen === "boot" || screen === "loading" ? "none" : "menu";
    audio().setMode(mode);
  }, [screen, ready, save.settings, save.selectedHero, save.buildings, save.energy, save.level]);

  function finishCine() {
    useGame.getState().seeIntro();
    useGame.getState().setScreen("loading");
  }

  function enterAfterLoad() {
    const st = useGame.getState();
    const chapter = st.save.chapter;
    if (chapter >= 8) {
      st.setScreen("menu");
      useGame.setState({ tutoring: false });
      return;
    }
    useGame.setState({ tutoring: true, replay: false });
    const kind = kindForChapter(chapter);
    if (kind) startKind(kind);
    else if (chapter === 6) st.setScreen("base");
    else if (chapter === 7) st.setScreen("reward");
    else st.setScreen("menu");
  }

  function finishLesson() {
    const eng = engineRef.current;
    const snap = eng?.snap;
    if (!eng || !snap?.live) return;
    const result: MatchResult = {
      victory: true,
      duration: Math.max(20, 150 - snap.timeLeft),
      elims: Math.max(1, snap.elims),
      assists: snap.assists,
      deaths: snap.deaths,
      objectives: snap.objectives,
      damage: snap.damage,
      scores: [snap.scores[0], snap.scores[1]],
      forfeit: false,
      heroId: useGame.getState().save.selectedHero,
    };
    eng.stopSession();
    grantEnd(result);
  }

  function skipTutorial() {
    const st = useGame.getState();
    st.patch({ ...st.save, chapter: 8 });
    useGame.setState({ tutoring: false, replay: false, paused: false, sessionLive: false, screen: "menu" });
    engineRef.current?.setPaused(false);
    engineRef.current?.stopSession();
    audio().setMode("menu");
  }

  function replayTutorial() {
    const st = useGame.getState();
    st.patch({ ...st.save, chapter: 0 });
    useGame.setState({ tutoring: true, replay: true, paused: false });
    startKind("move");
    engineRef.current?.setLock(true);
  }

  function resultsHome() {
    const st = useGame.getState();
    engineRef.current?.stopSession();
    if (st.resultsNext === "tutorial-base" && st.tutoring) {
      st.setChapterOnly(6);
      st.setScreen("base");
      useGame.setState({ sessionLive: false });
      return;
    }
    useGame.setState({ tutoring: false, sessionLive: false });
    st.setScreen("menu");
  }

  const hint =
    !tutoring || screen !== "battle"
      ? null
      : save.chapter === 1
        ? "stick"
        : save.chapter === 2
          ? "attack"
          : save.chapter === 3
            ? !casts[0]
              ? "q"
              : !casts[1]
                ? "e"
                : !casts[2]
                  ? "r"
                  : null
            : null;

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-bg text-fg">
      <canvas ref={glRef} className="absolute inset-0 h-full w-full touch-none" />
      <canvas ref={fxRef} className="pointer-events-none absolute inset-0 h-full w-full" />
      <div className="pointer-events-none absolute inset-0 z-10">
        {screen === "boot" && <Boot onSkip={() => useGame.getState().setScreen(save.introSeen ? "loading" : "cine")} />}
        {screen === "cine" && <Cinematic onSkip={finishCine} />}
        {screen === "loading" && (
          <LoadingScreen progress={load.p} label={load.label} error={loadError} onRetry={() => window.location.reload()} />
        )}
        {screen === "menu" && <MenuScreen onPlay={() => startPractice(false)} />}
        {screen === "heroes" && <HeroesScreen onPreview={previewHero} />}
        {screen === "base" && <BaseScreen picked={picked} onPick={setPicked} tutoring={tutoring} />}
        {screen === "lobby" && <LobbyScreen onStart={() => startPractice(false)} />}
        {screen === "clan" && <ClanScreen />}
        {screen === "shop" && <ShopScreen />}
        {screen === "settings" && (
          <SettingsScreen
            onReplay={replayTutorial}
            onBack={() => {
              const dest = returnTo.current;
              returnTo.current = "menu";
              if (dest === "battle") {
                useGame.getState().setPaused(false);
                engineRef.current?.setPaused(false);
              }
              useGame.getState().setScreen(dest);
            }}
          />
        )}
        {screen === "results" && <ResultsScreen onHome={resultsHome} onAgain={() => startPractice(false)} />}
        {screen === "reward" && (
          <RewardScreen
            onDone={() => {
              useGame.getState().completeBriefing();
              useGame.getState().setScreen("menu");
            }}
          />
        )}
        {screen === "battle" && (
          <BattleHud
            engineRef={engineRef}
            heroId={save.selectedHero}
            paused={paused}
            tutoring={tutoring}
            chapter={save.chapter}
            casts={casts}
            lessonReady={lessonReady}
            hint={hint}
            onPause={() => {
              useGame.getState().setPaused(true);
              engineRef.current?.setPaused(true);
            }}
            onResume={() => {
              useGame.getState().setPaused(false);
              engineRef.current?.setPaused(false);
            }}
            onSettings={() => {
              returnTo.current = "battle";
              useGame.getState().setPaused(true);
              engineRef.current?.setPaused(true);
              useGame.getState().setScreen("settings");
            }}
            onForfeit={() => {
              useGame.getState().setPaused(false);
              engineRef.current?.setPaused(false);
              engineRef.current?.giveUp();
            }}
            onSkipTutorial={skipTutorial}
            onBegin={() => {
              audio().play("ui");
              useGame.getState().setChapterOnly(1);
              engineRef.current?.setLock(false);
            }}
            onLessonContinue={finishLesson}
          />
        )}
        {loadError && screen !== "loading" && (
          <div className="absolute inset-x-0 bottom-6 flex justify-center px-4">
            <p className="pointer-events-auto rounded-lg bg-bg-elev px-4 py-3 text-sm text-danger">{loadError}</p>
          </div>
        )}
        <Toasts />
      </div>
      {NAV.includes(screen) ? null : null}
    </div>
  );
}
