"use client";

import Link from "next/link";
import { ArrowRight, Check, Flame, LockKeyhole, Sparkles, Star, Trophy, Zap } from "lucide-react";
import { ProgressBar } from "@/components/kit/progress-ring";
import { Button } from "@/components/ui/button";
import type { GameBadge, GameProgress, GameQuest, ModuleMastery } from "@/lib/gamification";

export function GameStatus({ game }: { game: GameProgress }) {
  return <section className="game-status" aria-label="Your game progress">
    <div className="game-rank"><span className="game-level">{game.level}</span><span><small>LEVEL {game.level}</small><strong>{game.rank}</strong></span></div>
    <div className="game-stat"><Zap aria-hidden /><span><strong>{game.xp}</strong><small>XP</small></span></div>
    <div className="game-stat"><Flame aria-hidden /><span><strong>{game.streak}</strong><small>DAY STREAK</small></span></div>
    <div className="game-stat"><Sparkles aria-hidden /><span><strong>{game.sparks}</strong><small>SPARKS</small></span></div>
    <div className="game-rank-progress"><div className="mb-1 flex justify-between text-[10px] text-ink-muted"><span>{game.rank}</span><span>{game.nextRank ? `${game.nextXp! - game.xp} XP to ${game.nextRank}` : "Top rank"}</span></div><ProgressBar value={game.levelProgress} size="sm" /></div>
  </section>;
}

export function DailyMission({ quest }: { quest: GameQuest }) {
  return <section className="daily-mission" aria-labelledby="daily-mission-title">
    <div className="daily-mission-icon"><Trophy aria-hidden /></div>
    <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="journey-kicker">{quest.eyebrow}</span>{quest.dailyDone && <span className="game-complete"><Check />Daily goal complete</span>}</div><h2 id="daily-mission-title">{quest.title}</h2><p>{quest.detail}</p></div>
    <div className="daily-reward"><Zap aria-hidden />+{quest.xp} XP</div>
    <Button asChild variant="brand"><Link href={quest.href}>{quest.dailyDone ? "Bonus mission" : "Start mission"}<ArrowRight /></Link></Button>
  </section>;
}

export function MasteryStars({ mastery, label }: { mastery: ModuleMastery; label: string }) {
  return <span className="mastery-stars" aria-label={`${mastery.stars} of 3 mastery stars for ${label}`}>
    {[1, 2, 3].map((star) => <Star key={star} aria-hidden data-earned={star <= mastery.stars} />)}
  </span>;
}

export function CapabilityRack({ mastery }: { mastery: ModuleMastery[] }) {
  return <div className="capability-rack" aria-label="Scout upgrades">
    {mastery.map((item) => <div key={item.moduleId} data-earned={item.earned}><span className="capability-icon" aria-hidden>{item.earned ? item.icon : <LockKeyhole />}</span><span><small>{item.earned ? "INSTALLED" : "LOCKED"}</small><strong>{item.upgrade}</strong></span></div>)}
  </div>;
}

export function BadgeCabinet({ badges }: { badges: GameBadge[] }) {
  const earned = badges.filter((badge) => badge.earned).length;
  return <section className="journey-section" aria-labelledby="badge-title">
    <div className="flex items-start justify-between gap-4"><div><p className="journey-kicker"><Trophy className="size-4" />Capability badges</p><h2 id="badge-title" className="mt-2 font-semibold">Proof of what you can do</h2></div><span className="text-xs text-ink-muted">{earned}/{badges.length} earned</span></div>
    <div className="badge-grid">{badges.map((badge) => <div key={badge.id} className="game-badge" data-earned={badge.earned}><span>{badge.earned ? <Trophy /> : <LockKeyhole />}</span><div><strong>{badge.name}</strong><small>{badge.detail}</small></div></div>)}</div>
  </section>;
}
