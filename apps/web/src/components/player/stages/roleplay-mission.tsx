"use client";

import * as React from "react";
import Image from "next/image";
import {
  ArrowRight,
  Bot,
  Check,
  CircleUserRound,
  Eye,
  Flag,
  HeartHandshake,
  LockKeyhole,
  MessageCircleMore,
  PackageSearch,
  Pause,
  Play,
  RotateCcw,
  ScanLine,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  Volume2,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/kit/chip";
import { reactPip } from "@/components/learning/course-companion";
import { sfxFor, unlockSfx } from "@/components/player/hook/sfx";
import { useVoice, type Voice } from "@/components/player/hook/voice";
import { useLocalJson, writeLocal } from "@/lib/local-store";
import type { RoleplayChoice, RoleplayMeterId, RoleplayMission as Mission, RoleplayScene } from "@/data/types";
import type { Support } from "@/lib/setup";
import "./roleplay-mission.css";

const METERS: { id: RoleplayMeterId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "goal", label: "Goal", icon: Target },
  { id: "trust", label: "Trust", icon: HeartHandshake },
  { id: "safety", label: "Safety", icon: ShieldCheck },
];

export type RoleplaySave = {
  version: 1;
  missionId: string;
  started: boolean;
  scene: number;
  meters: Record<RoleplayMeterId, number>;
  history: { sceneId: string; choiceId: string; best: boolean }[];
  revealedChoice?: string;
  helped: boolean;
  complete: boolean;
};

export function initialRoleplaySave(mission: Mission): RoleplaySave {
  return { version: 1, missionId: mission.id, started: false, scene: 0, meters: mission.start, history: [], helped: false, complete: false };
}

const clamp = (value: number) => Math.max(0, Math.min(100, value));

function updateMeters(current: Record<RoleplayMeterId, number>, choice: RoleplayChoice) {
  return {
    goal: clamp(current.goal + choice.effects.goal),
    trust: clamp(current.trust + choice.effects.trust),
    safety: clamp(current.safety + choice.effects.safety),
  };
}

function endingFor(meters: Record<RoleplayMeterId, number>) {
  if (meters.goal >= 75 && meters.trust >= 75 && meters.safety >= 75) return { title: "Mission accomplished", label: "TRUSTED RESOLUTION", tone: "great" as const, copy: "Scout kept Nia safe, used real evidence, and handed off well." };
  if (meters.safety >= 65) return { title: "Safe recovery", label: "SAFE HANDOFF", tone: "safe" as const, copy: "Scout kept Nia safe. Replay to make it more helpful." };
  return { title: "A risky route", label: "REPLAY RECOMMENDED", tone: "retry" as const, copy: "Nia was put at risk. Try another path and watch Safety." };
}

export function RoleplayMission({ mission, support, storageKey, onFinished, onExploreCases }: { mission: Mission; support: Support; storageKey: string; onFinished: (save: RoleplaySave) => void; onExploreCases: () => void }) {
  const fallback = React.useMemo(() => initialRoleplaySave(mission), [mission]);
  const raw = useLocalJson<RoleplaySave>(storageKey, fallback);
  const save = raw.version === 1 && raw.missionId === mission.id ? raw : fallback;
  const scene = mission.scenes[Math.min(save.scene, mission.scenes.length - 1)]!;
  const [hintFor, setHintFor] = React.useState<string | null>(null);
  const [decisionOpen, setDecisionOpen] = React.useState(true);
  const narrationRun = React.useRef(0);
  const voice = useVoice(true);
  const sfx = React.useMemo(() => sfxFor(true), []);
  const showHint = support === "extra" || hintFor === scene.id;
  const revealed = save.revealedChoice ? scene.choices.find((choice) => choice.id === save.revealedChoice) : undefined;

  const persist = (next: RoleplaySave) => writeLocal(storageKey, JSON.stringify(next));
  const audioSrc = (sceneIndex: number) => `/audio/roleplay-${mission.id}-s${sceneIndex}.mp3`;
  const playScene = (sceneIndex: number) => {
    const run = ++narrationRun.current;
    setDecisionOpen(false);
    voice.unlock();
    unlockSfx();
    sfx.pop();
    void voice.say(audioSrc(sceneIndex)).then(() => {
      if (narrationRun.current === run) setDecisionOpen(true);
    });
  };
  const stopScene = () => {
    narrationRun.current += 1;
    voice.stop();
    setDecisionOpen(true);
  };
  const start = () => {
    persist({ ...fallback, started: true });
    reactPip("wave", "You are in control.");
    unlockSfx();
    sfx.whoosh();
    playScene(0);
  };
  const commit = (choiceId: string) => {
    const choice = scene.choices.find((item) => item.id === choiceId);
    if (!choice) return;
    const next = {
      ...save,
      meters: updateMeters(save.meters, choice),
      history: [...save.history.filter((item) => item.sceneId !== scene.id), { sceneId: scene.id, choiceId: choice.id, best: !!choice.best }],
      revealedChoice: choice.id,
      helped: save.helped || showHint,
    };
    persist(next);
    if (choice.best) sfx.ping(); else sfx.alarm();
    reactPip(choice.best ? "celebrate" : "think", choice.best ? "Strong decision." : "Watch the consequence.");
  };
  const advance = () => {
    if (!revealed) return;
    if (save.scene === mission.scenes.length - 1) {
      const next = { ...save, complete: true, revealedChoice: undefined };
      persist(next);
      voice.stop();
      onFinished(next);
      reactPip("celebrate", "Roleplay complete!");
      sfx.ping();
      return;
    }
    const nextScene = save.scene + 1;
    persist({ ...save, scene: nextScene, revealedChoice: undefined });
    voice.stop();
    sfx.whoosh();
    playScene(nextScene);
  };
  const replay = () => {
    persist({ ...fallback, started: true });
    reactPip("wave", "New route. New outcome.");
    voice.stop();
    sfx.whoosh();
    playScene(0);
  };

  if (!save.started) return <RoleplayBrief mission={mission} onStart={start} />;
  if (save.complete) return <RoleplayEnding mission={mission} save={save} onReplay={replay} onExploreCases={onExploreCases} />;

  return (
    <section className="roleplay-shell" aria-labelledby="roleplay-scene-title">
      <header className="roleplay-topbar">
        <div className="roleplay-mission-id"><span className="roleplay-live-dot" />ROLEPLAY IN PROGRESS<span>Scene {save.scene + 1} of {mission.scenes.length}</span></div>
        <div className="roleplay-meters" aria-label="Mission signals">
          {METERS.map(({ id, label, icon: Icon }) => <div className="roleplay-meter" key={id}>
            <span><Icon />{label}<strong>{save.meters[id]}</strong></span>
            <div className="roleplay-meter-track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={save.meters[id]}><i style={{ width: `${save.meters[id]}%` }} /></div>
          </div>)}
        </div>
      </header>

      <div className="roleplay-progress" aria-label="Roleplay progress">
        {mission.scenes.map((item, index) => <div key={item.id} data-state={index < save.scene ? "done" : index === save.scene ? "current" : "upcoming"}>
          <span>{index < save.scene ? <Check /> : index + 1}</span><small>{item.label}</small>
        </div>)}
      </div>

      <RoleplayFilm mission={mission} scene={scene} sceneIndex={save.scene} voice={voice} revealed={revealed} decisionOpen={decisionOpen} showHint={showHint} onPlay={() => playScene(save.scene)} onStop={stopScene} onCommit={commit} onHint={() => setHintFor(scene.id)} onAdvance={advance} isLast={save.scene === mission.scenes.length - 1} />
    </section>
  );
}

function RoleplayFilm({ mission, scene, sceneIndex, voice, revealed, decisionOpen, showHint, onPlay, onStop, onCommit, onHint, onAdvance, isLast }: { mission: Mission; scene: RoleplayScene; sceneIndex: number; voice: Voice; revealed?: RoleplayChoice; decisionOpen: boolean; showHint: boolean; onPlay: () => void; onStop: () => void; onCommit: (choiceId: string) => void; onHint: () => void; onAdvance: () => void; isLast: boolean }) {
  const playing = voice.progress !== null;
  return <div className="roleplay-film" key={scene.id} data-scene={scene.visual} data-playing={playing ? "true" : "false"} data-revealed={revealed ? "true" : "false"}>
    <div className="roleplay-film-light roleplay-film-light-one" /><div className="roleplay-film-light roleplay-film-light-two" /><div className="roleplay-film-grain" aria-hidden="true" />
    <div className="roleplay-film-heading"><div><span>{scene.label}</span><h2 id="roleplay-scene-title">{scene.title}</h2></div><span className="roleplay-film-take">TAKE {sceneIndex + 1}</span></div>
    <NiaCharacter speaking={playing} mood={scene.visual === "twist" ? "worried" : revealed?.best ? "relieved" : "ready"} name={mission.customer.name} />
    <ScoutCharacter speaking={false} mood={scene.visual === "twist" ? "protect" : revealed?.best ? "happy" : "focus"} />
    <SceneAction scene={scene} />
    <div className="roleplay-dialogue" data-speaker="nia">
      <button type="button" onClick={playing ? onStop : onPlay} aria-label={playing ? "Pause Nia" : "Hear Nia"}>{playing ? <Pause /> : <Play />}</button>
      <div><span><i />NIA</span><p>{scene.narration}</p><b><i style={{ width: `${Math.round((voice.progress ?? 0) * 100)}%` }} /></b></div>
      {!decisionOpen && playing ? <button className="roleplay-skip" type="button" onClick={onStop}>Your turn <ArrowRight /></button> : null}
    </div>
    {decisionOpen || revealed ? <div className="roleplay-choice-overlay">
      {!revealed ? <>
        <div className="roleplay-choice-question"><small>DIRECT THE NEXT MOMENT</small><strong>{scene.prompt}</strong></div>
        <div className="roleplay-film-choices" role="group" aria-label={scene.prompt}>
          {scene.choices.map((choice, index) => <button className="roleplay-film-choice" type="button" key={choice.id} onClick={() => onCommit(choice.id)} aria-label={`Play: ${choice.text}`}><ChoiceScene scene={scene} index={index} /><i><Play /></i></button>)}
        </div>
        <div className="roleplay-overlay-actions"><span>Pick a scene</span>{!showHint ? <Button variant="ghost" onClick={onHint}>Pip nudge</Button> : null}</div>
        {showHint ? <div className="roleplay-film-hint"><Sparkles /><span><strong>Pip whispers</strong>{scene.hint}</span></div> : null}
      </> : <div className="roleplay-result" data-best={revealed.best ? "true" : "false"}>
        <div className="roleplay-result-icon">{revealed.best ? <Check /> : <Eye />}</div><div><small>{revealed.best ? "THE STORY MOVES FORWARD" : "THE SCENE CHANGES"}</small><h3>{revealed.best ? "Nia feels confident" : "Nia hesitates"}</h3><p>{revealed.feedback}</p></div>
        <div className="roleplay-deltas" aria-label="Effect on mission signals">{METERS.map(({ id, label }) => <span key={id} data-positive={revealed.effects[id] >= 0}>{label} {revealed.effects[id] >= 0 ? "+" : ""}{revealed.effects[id]}</span>)}</div>
        <Button variant="brand" onClick={onAdvance}>{isLast ? "See ending" : "Continue"}<ArrowRight /></Button>
      </div>}
    </div> : <div className="roleplay-watching"><span><i /><i /><i /></span>Nia is speaking. Your turn is next.</div>}
  </div>;
}

function NiaCharacter({ speaking, mood, name }: { speaking: boolean; mood: "ready" | "worried" | "relieved"; name: string }) {
  return <div className="roleplay-actor roleplay-nia" data-speaking={speaking ? "true" : "false"} data-mood={mood} aria-label={`${name}, the customer`}><span className="roleplay-actor-tag"><i />{name} · CUSTOMER</span><div className="roleplay-character-shadow" /><Image src="/images/roleplay/nia-3d.webp" alt="" width={768} height={1152} priority /></div>;
}

function ScoutCharacter({ speaking, mood }: { speaking: boolean; mood: "focus" | "protect" | "happy" }) {
  return <div className="roleplay-actor roleplay-scout" data-speaking={speaking ? "true" : "false"} data-mood={mood} aria-label="Scout, the AI agent"><span className="roleplay-actor-tag"><i />SCOUT · AI AGENT</span><div className="roleplay-character-shadow" /><Image src="/images/roleplay/scout-3d.webp" alt="" width={768} height={1152} priority /></div>;
}

const CHOICE_TITLES: Record<RoleplayScene["visual"], string[]> = {
  incoming: ["Scout checks the live order", "Scout promises the change", "Nia must start over"],
  tool: ["Open Nia's order", "Track a parcel", "Ask for a password"],
  evidence: ["Respect Scout's limit", "Focus only on status", "Rush because of time"],
  twist: ["Protect Nia and hand off", "Ask for card digits", "Collect the full number"],
  send: ["Explain and hand off", "Send a vague update", "Guarantee the change"],
};

const CHOICE_ICONS = [PackageSearch, MessageCircleMore, Flag];

function ChoiceScene({ scene, index }: { scene: RoleplayScene; index: number }) {
  const Icon = scene.visual === "twist" && index === 0 ? ShieldCheck : scene.visual === "tool" && index === 2 ? LockKeyhole : CHOICE_ICONS[index]!;
  return <div className="roleplay-choice-scene" data-variant={index} data-scene={scene.visual}>
    <div className="roleplay-choice-set"><i /><i /><i /></div>
    <Image className="roleplay-choice-nia" src="/images/roleplay/nia-3d.webp" alt="" width={768} height={1152} />
    <Image className="roleplay-choice-scout" src="/images/roleplay/scout-3d.webp" alt="" width={768} height={1152} />
    <span className="roleplay-choice-action"><Icon /></span>
    <strong>{CHOICE_TITLES[scene.visual][index]}</strong>
    <small>Preview this outcome</small>
  </div>;
}

function SceneAction({ scene }: { scene: RoleplayScene }) {
  if (scene.visual === "incoming") return <div className="roleplay-scene-action roleplay-action-phone" aria-hidden="true"><MessageCircleMore /><span>ORB-10621</span><i /><i /><i /></div>;
  if (scene.visual === "tool") return <div className="roleplay-scene-action roleplay-action-tools" aria-hidden="true"><span><PackageSearch /><b>Order</b></span><span><Eye /><b>Policy</b></span><span><Wrench /><b>Handoff</b></span><i /></div>;
  if (scene.visual === "evidence") return <div className="roleplay-scene-action roleplay-action-record" aria-hidden="true"><header><PackageSearch /><strong>ORB-10621</strong></header><p><span>STATUS</span><b>Processing</b></p><p><span>DISPATCH</span><b>16:00 today</b></p><p><span>ADDRESS</span><b><LockKeyhole />Locked</b></p><i /><ScanLine /></div>;
  if (scene.visual === "twist") return <div className="roleplay-scene-action roleplay-action-shield" aria-hidden="true"><ShieldCheck /><span>PRIVATE DATA</span><i>•••• 4821</i></div>;
  return <div className="roleplay-scene-action roleplay-action-handoff" aria-hidden="true"><span><Bot />Scout</span><i><Send /></i><span><CircleUserRound />Support</span><b><Flag />Urgent handoff</b></div>;
}

function RoleplayBrief({ mission, onStart }: { mission: Mission; onStart: () => void }) {
  return <section className="roleplay-brief"><div className="roleplay-brief-art" aria-hidden="true"><div className="roleplay-orbit roleplay-orbit-one" /><div className="roleplay-orbit roleplay-orbit-two" /><div className="roleplay-brief-media"><span><Play />ANIMATED STORY</span><span><Volume2 />Voice + captions</span></div><div className="roleplay-brief-customer"><span>{mission.customer.initials}</span><i /></div><div className="roleplay-brief-scout"><Bot /></div><div className="roleplay-brief-message"><MessageCircleMore /><span>Address change needed</span></div></div><div className="roleplay-brief-copy"><Chip size="sm" tone="lab" icon={<Sparkles />}>{mission.eyebrow}</Chip><h2>{mission.title}</h2><p>{mission.brief}</p><div className="roleplay-role-card"><CircleUserRound /><span><small>YOUR ROLE</small><strong>{mission.learner_role}</strong></span><span className="roleplay-ready">READY</span></div><div className="roleplay-brief-signals"><span><Target />Reach the goal</span><span><HeartHandshake />Keep trust</span><span><ShieldCheck />Protect safety</span></div><Button variant="brand" size="xl" onClick={onStart}><Play />Start roleplay</Button></div></section>;
}

function RoleplayEnding({ mission, save, onReplay, onExploreCases }: { mission: Mission; save: RoleplaySave; onReplay: () => void; onExploreCases: () => void }) {
  const ending = endingFor(save.meters);
  const best = save.history.filter((item) => item.best).length;
  return <section className="roleplay-ending" data-tone={ending.tone}><div className="roleplay-ending-burst" aria-hidden="true"><i /><i /><i /><i /><i /><span><Flag /></span></div><Chip size="sm" tone={ending.tone === "great" ? "ok" : ending.tone === "safe" ? "info" : "warn"}>{ending.label}</Chip><h2>{ending.title}</h2><p>{ending.copy}</p><div className="roleplay-final-score">{METERS.map(({ id, label, icon: Icon }) => <div key={id}><Icon /><span>{label}<strong>{save.meters[id]}</strong></span><i><b style={{ width: `${save.meters[id]}%` }} /></i></div>)}</div><div className="roleplay-ending-summary"><Sparkles /><p><strong>{best}/{mission.scenes.length} strongest decisions</strong>{mission.debrief}</p></div><div className="roleplay-ending-actions"><Button variant="brand" size="lg" onClick={onExploreCases}>Bonus cases<ArrowRight /></Button><Button variant="outline" size="lg" onClick={onReplay}><RotateCcw />Try another path</Button></div></section>;
}
