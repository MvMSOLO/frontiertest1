import { useEffect, useRef } from "react";
import { Crosshair, Pause } from "lucide-react";
import { HEROES } from "../data";
import type { HeroId, HudSnap } from "../types";
import { audio } from "../audio";
import { GhostButton, PrimaryButton } from "./ui";

export type HudEngine = {
  moveX: number;
  moveY: number;
  attack: boolean;
  queue: number[];
  snap: HudSnap;
  setPaused: (v: boolean) => void;
  skipFinale: () => void;
  giveUp: () => void;
};

function clock(seconds: number) {
  const t = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}

function coreCopy(snap: HudSnap) {
  if (snap.coreMode === "ally") return "Core · Yours";
  if (snap.coreMode === "enemy") return "Core · Hostile";
  if (snap.coreMode === "contest" || snap.coreMode === "losing") return "Core · Contested";
  if (snap.coreMode === "capping") return "Core · Capturing";
  return "Core · Neutral";
}

export function BattleHud({
  engineRef,
  heroId,
  paused,
  tutoring,
  chapter,
  casts,
  lessonReady,
  hint,
  onPause,
  onResume,
  onSettings,
  onForfeit,
  onSkipTutorial,
  onBegin,
  onLessonContinue,
}: {
  engineRef: React.RefObject<HudEngine | null>;
  heroId: HeroId;
  paused: boolean;
  tutoring: boolean;
  chapter: number;
  casts: [boolean, boolean, boolean];
  lessonReady: boolean;
  hint: "stick" | "attack" | "q" | "e" | "r" | null;
  onPause: () => void;
  onResume: () => void;
  onSettings: () => void;
  onForfeit: () => void;
  onSkipTutorial: () => void;
  onBegin: () => void;
  onLessonContinue: () => void;
}) {
  const timeRef = useRef<HTMLSpanElement>(null);
  const scoreRef = useRef<HTMLSpanElement>(null);
  const coreRef = useRef<HTMLSpanElement>(null);
  const routeRef = useRef<HTMLSpanElement>(null);
  const hpRef = useRef<HTMLDivElement>(null);
  const hpText = useRef<HTMLSpanElement>(null);
  const shieldRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const cdRefs = [
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
  ];
  const atkRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLCanvasElement>(null);
  const countRef = useRef<HTMLDivElement>(null);
  const finaleRef = useRef<HTMLDivElement>(null);
  const finaleBtn = useRef<HTMLButtonElement>(null);
  const hero = HEROES[heroId];

  useEffect(() => {
    let frame = 0;
    const loop = () => {
      const snap = engineRef.current?.snap;
      if (snap?.live) {
        if (timeRef.current) timeRef.current.textContent = snap.phase === "sandbox" ? "DRILL" : clock(snap.timeLeft);
        if (scoreRef.current) scoreRef.current.textContent = `${snap.scores[0]}  –  ${snap.scores[1]}`;
        if (coreRef.current) coreRef.current.textContent = coreCopy(snap);
        if (routeRef.current) routeRef.current.textContent = snap.gates ? "Side routes open" : "Side routes sealed";
        if (hpRef.current) hpRef.current.style.width = `${Math.max(0, (snap.hp / snap.maxHp) * 100)}%`;
        if (hpText.current) hpText.current.textContent = snap.dead ? "Down" : `${Math.ceil(snap.hp)}`;
        if (shieldRef.current) shieldRef.current.style.width = `${Math.min(100, (snap.shield / snap.maxHp) * 100)}%`;
        if (statusRef.current) {
          statusRef.current.textContent = snap.dead ? `Respawn ${Math.ceil(snap.respawn)}s` : snap.locked ? "Standing by" : "";
        }
        if (feedRef.current) feedRef.current.textContent = snap.feed[0] ?? "";
        cdRefs.forEach((ref, i) => {
          if (!ref.current) return;
          const max = snap.cdMax[i] || 1;
          const pct = snap.cds[i] > 0 ? Math.min(1, snap.cds[i] / max) : 0;
          ref.current.style.height = `${pct * 100}%`;
        });
        if (atkRef.current) {
          const pct = snap.atkCd > 0 ? Math.min(1, snap.atkCd / (snap.atkMax || 1)) : 0;
          atkRef.current.style.height = `${pct * 100}%`;
        }
        if (countRef.current) {
          countRef.current.style.opacity = snap.countdown > 0 ? "1" : "0";
          countRef.current.textContent = snap.countdown > 0 ? String(Math.ceil(snap.countdown)) : "";
        }
        if (finaleRef.current) {
          finaleRef.current.style.opacity = snap.finale ? "1" : "0";
          finaleRef.current.textContent = snap.finale === "win" ? "VICTORY" : snap.finale === "lose" ? "DEFEAT" : "";
        }
        if (finaleBtn.current) finaleBtn.current.classList.toggle("hidden", !snap.finale);
        const map = mapRef.current;
        const g = map?.getContext("2d");
        if (map && g) {
          const w = map.width;
          const h = map.height;
          g.clearRect(0, 0, w, h);
          g.fillStyle = "rgba(16,32,51,0.72)";
          g.fillRect(0, 0, w, h);
          const X = (x: number) => ((x + 33) / 66) * w;
          const Y = (z: number) => ((z + 37) / 74) * h;
          g.fillStyle = "#e4c16a";
          g.beginPath();
          g.arc(X(0), Y(0), 3.5, 0, Math.PI * 2);
          g.fill();
          for (const wisp of snap.wisps) {
            g.fillStyle = "#e4c16a";
            g.fillRect(X(wisp.x) - 1.5, Y(wisp.z) - 1.5, 3, 3);
          }
          for (const unit of snap.minimap) {
            g.fillStyle = unit.player ? "#e7eef6" : unit.team === 0 ? "#3ecfff" : "#ff6d5a";
            const s = unit.player ? 5 : 3.5;
            g.fillRect(X(unit.x) - s / 2, Y(unit.z) - s / 2, s, s);
          }
        }
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [engineRef]);

  const press = (index: number) => {
    audio().unlock();
    audio().play("ui");
    engineRef.current?.queue.push(index);
  };

  return (
    <div className="safe pointer-events-none absolute inset-0 touch-none">
      <div className="relative h-full w-full">
        <div className="absolute top-2 right-2 left-2 flex items-start justify-between gap-2">
          <div className="pointer-events-auto min-w-36 rounded-lg border border-line bg-bg-elev/80 px-3 py-2 backdrop-blur-md">
            <div className="flex items-center justify-between gap-3 text-xs text-muted">
              <span>{hero.short}</span>
              <span ref={hpText}>—</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-line">
              <div ref={hpRef} className="h-full w-full bg-primary" />
            </div>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-line">
              <div ref={shieldRef} className="h-full w-0 bg-accent" />
            </div>
            <p ref={statusRef} className="mt-1 min-h-4 text-xs text-accent" />
          </div>
          <div className="pointer-events-none rounded-lg border border-line bg-bg-elev/80 px-4 py-2 text-center backdrop-blur-md">
            <span ref={timeRef} className="font-display text-lg text-fg">
              —:—
            </span>
            <div ref={scoreRef} className="text-sm text-primary">
              0 – 0
            </div>
            <div ref={coreRef} className="text-xs text-accent">
              Core
            </div>
            <div ref={routeRef} className="text-xs text-muted">
              Routes
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <button
              type="button"
              aria-label="Pause match"
              className="pointer-events-auto grid h-11 w-11 place-items-center rounded-lg border border-line bg-bg-elev/85 text-fg"
              onClick={() => {
                audio().play("ui");
                onPause();
              }}
            >
              <Pause className="h-5 w-5" />
            </button>
            <canvas ref={mapRef} width={108} height={108} className="h-24 w-24 rounded-lg border border-line" />
          </div>
        </div>

        <p ref={feedRef} className="absolute top-28 right-0 left-0 text-center text-sm text-fg" aria-live="polite" />
        <div ref={countRef} className="pointer-events-none absolute inset-0 grid place-items-center font-display text-6xl text-fg opacity-0" />
        <div ref={finaleRef} className="pointer-events-none absolute top-[38%] right-0 left-0 text-center font-display text-5xl tracking-widest text-accent opacity-0" />
        <button
          ref={finaleBtn}
          type="button"
          className="pointer-events-auto absolute top-36 right-4 hidden rounded-lg border border-line bg-bg-elev/85 px-3 py-2 text-xs text-fg"
          onClick={() => {
            audio().play("ui");
            engineRef.current?.skipFinale();
          }}
        >
          Skip
        </button>

        {tutoring && chapter === 0 && (
          <div className="absolute inset-0 grid place-items-center p-5">
            <div className="panel pointer-events-auto max-w-md p-6 text-center">
              <p className="text-xs tracking-widest text-primary">CHAPTER 1</p>
              <h2 className="mt-2 font-display text-2xl">Welcome to FRONTIER</h2>
              <p className="mt-3 text-sm text-muted">
                The Core wakes. Islands answer. You are a Warden — build your power, then take the battlefield with your squad.
              </p>
              <PrimaryButton className="mt-5 w-full" onClick={onBegin}>
                Begin
              </PrimaryButton>
            </div>
          </div>
        )}

        {tutoring && chapter > 0 && chapter <= 5 && (
          <div className="absolute top-36 right-4 left-4 flex justify-center">
            <div className="panel pointer-events-auto max-w-lg px-4 py-3 text-sm">
              <p className="text-fg">{chapterCopy(chapter)}</p>
              {lessonReady && (
                <PrimaryButton className="mt-3 w-full" onClick={onLessonContinue}>
                  Objective complete
                </PrimaryButton>
              )}
              <button type="button" className="mt-2 text-xs text-muted" onClick={onSkipTutorial}>
                Skip briefing
              </button>
            </div>
          </div>
        )}

        
        <Joystick engineRef={engineRef} hot={hint === "stick"} />

        <div className="absolute right-3 bottom-3 grid grid-cols-2 gap-2">
          <AbilityButton
            label="Q"
            name={hero.abilities[0].name}
            hot={hint === "q" || (chapter === 3 && !casts[0])}
            cover={cdRefs[0]}
            onPress={() => press(0)}
          />
          <AbilityButton
            label="R"
            name={hero.abilities[2].name}
            hot={hint === "r" || (chapter === 3 && casts[0] && casts[1] && !casts[2])}
            cover={cdRefs[2]}
            ultimate
            onPress={() => press(2)}
          />
          <AbilityButton
            label="E"
            name={hero.abilities[1].name}
            hot={hint === "e" || (chapter === 3 && casts[0] && !casts[1])}
            cover={cdRefs[1]}
            onPress={() => press(1)}
          />
          <button
            type="button"
            aria-label="Attack"
            className={`pointer-events-auto relative grid h-16 w-16 place-items-center overflow-hidden rounded-full border border-primary bg-bg-elev/90 text-primary ${hint === "attack" ? "pulse-hint" : ""}`}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              audio().unlock();
              if (engineRef.current) engineRef.current.attack = true;
            }}
            onPointerUp={() => {
              if (engineRef.current) engineRef.current.attack = false;
            }}
            onPointerCancel={() => {
              if (engineRef.current) engineRef.current.attack = false;
            }}
          >
            <Crosshair className="h-6 w-6" />
            <span className="sr-only">Attack</span>
            <div ref={atkRef} className="absolute right-0 bottom-0 left-0 bg-bg/70" />
          </button>
        </div>
        <p className="desk-hint pointer-events-none absolute bottom-3 left-36 hidden text-xs text-muted md:block">
          WASD move · Space attack · Q E R abilities
        </p>

        {paused && (
          <div className="absolute inset-0 grid place-items-center bg-bg/55 p-6">
            <div className="panel pointer-events-auto w-full max-w-sm p-6 text-center">
              <h2 className="font-display text-2xl">Paused</h2>
              <div className="mt-4 flex flex-col gap-2">
                <PrimaryButton onClick={onResume}>Resume</PrimaryButton>
                <GhostButton onClick={onSettings}>Settings</GhostButton>
                {tutoring ? (
                  <GhostButton onClick={onSkipTutorial}>Skip briefing</GhostButton>
                ) : (
                  <GhostButton onClick={onForfeit}>Forfeit match</GhostButton>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function chapterCopy(chapter: number) {
  if (chapter === 1) return "Drag the movement sigil. Reach the gold beacon ahead.";
  if (chapter === 2) return "Strike the construct. Land three hits with Attack.";
  if (chapter === 3) return "Cast Q, E, and your ultimate R.";
  if (chapter === 4) return "Stand in the Core until your team locks it. A full capture opens the side routes.";
  return "Your squad is here. Eliminate one enemy warden.";
}

function AbilityButton({
  label,
  name,
  hot,
  ultimate,
  cover,
  onPress,
}: {
  label: string;
  name: string;
  hot: boolean;
  ultimate?: boolean;
  cover: React.RefObject<HTMLDivElement | null>;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={name}
      className={`pointer-events-auto relative h-16 overflow-hidden rounded-lg border bg-bg-elev/90 text-left ${ultimate ? "border-accent text-accent" : "border-line text-fg"} ${hot ? "pulse-hint" : ""}`}
      onPointerDown={(e) => {
        e.preventDefault();
        onPress();
      }}
    >
      <span className="block px-2 pt-1 font-display text-xs">{label}</span>
      <span className="block px-2 text-xs text-muted">{name}</span>
      <div ref={cover} className="absolute right-0 bottom-0 left-0 bg-bg/70" />
    </button>
  );
}

function Joystick({ engineRef, hot }: { engineRef: React.RefObject<HudEngine | null>; hot: boolean }) {
  const knob = useRef<HTMLDivElement>(null);
  const origin = useRef({ x: 0, y: 0 });

  const move = (clientX: number, clientY: number) => {
    const dx = clientX - origin.current.x;
    const dy = clientY - origin.current.y;
    const max = 42;
    const mag = Math.min(max, Math.hypot(dx, dy));
    const ang = Math.atan2(dy, dx);
    const x = Math.cos(ang) * mag;
    const y = Math.sin(ang) * mag;
    if (knob.current) knob.current.style.transform = `translate(${x}px, ${y}px)`;
    const eng = engineRef.current;
    if (!eng) return;
    if (mag / max < 0.14) {
      eng.moveX = 0;
      eng.moveY = 0;
      return;
    }
    eng.moveX = x / max;
    eng.moveY = -y / max;
  };

  const end = () => {
    if (knob.current) knob.current.style.transform = "translate(0px, 0px)";
    const eng = engineRef.current;
    if (!eng) return;
    eng.moveX = 0;
    eng.moveY = 0;
  };

  return (
    <div
      className={`pointer-events-auto absolute bottom-4 left-4 grid h-28 w-28 place-items-center rounded-full border border-line bg-bg-elev/70 ${hot ? "pulse-hint" : ""}`}
      onPointerDown={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        origin.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        e.currentTarget.setPointerCapture(e.pointerId);
        audio().unlock();
        move(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) move(e.clientX, e.clientY);
      }}
      onPointerUp={end}
      onPointerCancel={end}
      role="slider"
      aria-label="Movement"
      aria-valuemin={-1}
      aria-valuemax={1}
    >
      <div ref={knob} className="h-12 w-12 rounded-full bg-primary" />
    </div>
  );
}
