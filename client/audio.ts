import type { GameState, MixingTool, RhythmAction, Theme } from "../shared/game";
import type { DisplayAudioSettings } from "./preferences";

import menuMusicUrl from "./assets/audio/music/menu-once-upon-a-time.mp3";
import cozyMusicUrl from "./assets/audio/music/cozy-crowded-pub.ogg";
import hauntedMusicUrl from "./assets/audio/music/haunted-void-estate.ogg";
import pirateMusicUrl from "./assets/audio/music/pirate-sailors-chant.ogg";
import bellUrl from "./assets/audio/sfx/service-bell.mp3";
import catMeowUrl from "./assets/audio/sfx/cat-meow.mp3";
import coinUrl from "./assets/audio/sfx/coin.mp3";
import ectoplasmUrl from "./assets/audio/sfx/ectoplasm.mp3";
import failureUrl from "./assets/audio/sfx/failure.mp3";
import fireUrl from "./assets/audio/sfx/fire-loop.mp3";
import gameOverUrl from "./assets/audio/sfx/game-over.mp3";
import levelUpUrl from "./assets/audio/sfx/level-up.mp3";
import newOrderUrl from "./assets/audio/sfx/new-order.mp3";
import pickupUrl from "./assets/audio/sfx/pickup.mp3";
import pourUrl from "./assets/audio/sfx/pour.mp3";
import shakerUrl from "./assets/audio/sfx/shaker.mp3";
import spoonUrl from "./assets/audio/sfx/spoon-stir.mp3";
import successUrl from "./assets/audio/sfx/success.mp3";
import trashUrl from "./assets/audio/sfx/trash.mp3";
import clickUrl from "./assets/audio/sfx/ui-click.mp3";
import splashUrl from "./assets/audio/sfx/water-splash.mp3";

const MUSIC_SOURCES = {
  menu: menuMusicUrl,
  cozy: cozyMusicUrl,
  haunted: hauntedMusicUrl,
  pirate: pirateMusicUrl
} as const;

const EFFECT_SOURCES = {
  bell: bellUrl,
  "cat-meow": catMeowUrl,
  coin: coinUrl,
  ectoplasm: ectoplasmUrl,
  failure: failureUrl,
  fire: fireUrl,
  "game-over": gameOverUrl,
  "level-up": levelUpUrl,
  "new-order": newOrderUrl,
  pickup: pickupUrl,
  pour: pourUrl,
  shaker: shakerUrl,
  spoon: spoonUrl,
  success: successUrl,
  trash: trashUrl,
  "ui-click": clickUrl,
  splash: splashUrl
} as const;

export type MusicKey = keyof typeof MUSIC_SOURCES;
export type EffectName = keyof typeof EFFECT_SOURCES;

const THEME_MUSIC: Record<Theme, MusicKey> = {
  "Cozy Village Pub": "cozy",
  "Haunted Moonlit Inn": "haunted",
  "Pirate Cat Tavern": "pirate"
};

const TOOL_EFFECT: Record<MixingTool, EffectName> = {
  shaker: "shaker",
  spoon: "spoon",
  pourer: "pour"
};

interface ActiveEffect {
  audio: HTMLAudioElement;
  gain: number;
}

function makeAudio(source: string, loop = false) {
  const audio = new Audio(source);
  audio.preload = "auto";
  audio.loop = loop;
  return audio;
}

/**
 * Owns every sound emitted by the client. Browsers require a user gesture before
 * playback, so callers may choose music immediately and unlock it on the first
 * pointer or keyboard input without losing the requested track.
 */
export class AudioDirector {
  private settings: DisplayAudioSettings;
  private readonly music = new Map<MusicKey, HTMLAudioElement>();
  private readonly effects = new Map<EffectName, HTMLAudioElement>();
  private readonly activeEffects = new Set<ActiveEffect>();
  private readonly loops = new Map<string, ActiveEffect>();
  private desiredMusic: MusicKey = "menu";
  private currentMusic?: MusicKey;
  private unlocked = false;
  private hidden = document.hidden;
  private ducked = false;
  private transition = 0;
  private toolLoop?: string;

  constructor(settings: DisplayAudioSettings) {
    this.settings = settings;
    for (const [key, source] of Object.entries(MUSIC_SOURCES) as [MusicKey, string][]) {
      this.music.set(key, makeAudio(source, true));
    }
    for (const [key, source] of Object.entries(EFFECT_SOURCES) as [EffectName, string][]) {
      this.effects.set(key, makeAudio(source));
    }
    this.chooseMusic("menu", false);
  }

  async unlock() {
    if (this.unlocked) return;
    this.unlocked = true;
    if (!this.hidden) {
      await this.playDesiredMusic();
      for (const entry of this.loops.values()) void entry.audio.play().catch(() => undefined);
    }
  }

  setSettings(settings: DisplayAudioSettings) {
    this.settings = settings;
    this.applyVolumes();
  }

  setPageHidden(hidden: boolean) {
    this.hidden = hidden;
    const current = this.currentMusic && this.music.get(this.currentMusic);
    if (hidden) {
      current?.pause();
      for (const entry of this.loops.values()) entry.audio.pause();
    } else if (this.unlocked) {
      void this.playDesiredMusic();
      for (const entry of this.loops.values()) void entry.audio.play().catch(() => undefined);
    }
  }

  syncMenu() {
    this.ducked = false;
    this.stopTool();
    this.stopLoop("hazard");
    this.chooseMusic("menu");
  }

  syncState(previous: GameState | null, next: GameState, playerId: string) {
    this.ducked = next.pausedAt !== null || next.phase === "complete";
    this.chooseMusic(next.phase === "lobby" ? "menu" : THEME_MUSIC[next.tavern.theme]);

    if (next.pausedAt !== null || !next.mixing[playerId]) this.stopTool();
    if (next.phase === "shift") this.syncHazard(previous?.hazard ?? null, next.hazard);
    else this.stopLoop("hazard");

    if (!previous) return;

    if (previous.phase !== next.phase) {
      if (next.phase === "shift") this.playEffect("bell", { gain: 0.85 });
      else if (next.phase === "upgrades") this.playEffect("level-up", { gain: 0.9 });
      else if (next.phase === "complete") this.playEffect("game-over", { gain: 0.95 });
    }

    const previousOrderIds = new Set(previous.orders.map(({ id }) => id));
    if (next.orders.some(({ id }) => !previousOrderIds.has(id))) {
      this.playEffect("new-order", { gain: 0.7, playbackRate: 1.05 });
    }

    if (previous.phase === "lobby" && next.phase === "lobby" &&
      Object.keys(next.players).some((id) => id !== playerId && !previous.players[id])) {
      this.playEffect("cat-meow", { gain: 0.65, playbackRate: 1.08 });
    }

    const before = previous.players[playerId];
    const after = next.players[playerId];
    if (before && after) {
      if (after.carrying.length > before.carrying.length) {
        this.playEffect("pickup", { gain: 0.65, playbackRate: 1.12 });
      }

      const previousMix = previous.mixing[playerId];
      const nextMix = next.mixing[playerId];
      if (previousMix && nextMix && nextMix.mistakes > previousMix.mistakes) {
        this.playEffect("failure", { gain: 0.48, playbackRate: 1.15 });
      }
      if (previousMix && !nextMix) {
        this.stopTool();
        if (after.drink && after.drink !== before.drink) this.playEffect("success", { gain: 0.8 });
        else if (!/cancel|stepped away/i.test(next.message)) this.playEffect("failure", { gain: 0.72 });
      }

      if (before.drink && !after.drink) {
        if (/discard|toss/i.test(next.message)) this.playEffect("trash", { gain: 0.75 });
        else if (next.coins > previous.coins || /purrs with delight|served/i.test(next.message)) {
          this.playEffect("bell", { gain: 0.65, playbackRate: 1.08 });
          window.setTimeout(() => this.playEffect("coin", { gain: 0.72 }), 120);
        }
      }
      if (after.carrying.length < before.carrying.length && /discard|toss/i.test(next.message)) {
        this.playEffect("trash", { gain: 0.75 });
      }
    }

    if (next.health < previous.health) this.playEffect("failure", { gain: 0.78, playbackRate: 0.92 });

    if (next.message !== previous.message) {
      if (/chopped/i.test(next.message)) this.playEffect("ui-click", { gain: 0.5, playbackRate: 0.72 });
      else if (/placed|picked up|handed/i.test(next.message)) this.playEffect("ui-click", { gain: 0.42, playbackRate: 1.08 });
    }
  }

  playUiClick() {
    this.playEffect("ui-click", { gain: 0.34, playbackRate: 1.12 });
  }

  playIngredient() {
    this.playEffect("pickup", { gain: 0.58, playbackRate: 1.18 });
  }

  playRhythm(style: RhythmAction["style"], hand?: "left" | "right") {
    const playbackRate = style === "chop" ? 0.72 : hand === "left" ? 0.92 : 1.02;
    this.playEffect("ui-click", { gain: style === "chop" ? 0.62 : 0.46, playbackRate });
  }

  startTool(tool: MixingTool) {
    this.stopTool();
    const key = `tool:${tool}`;
    this.toolLoop = key;
    this.startLoop(key, TOOL_EFFECT[tool], tool === "spoon" ? 0.65 : 0.72);
  }

  stopTool() {
    if (!this.toolLoop) return;
    this.stopLoop(this.toolLoop);
    this.toolLoop = undefined;
  }

  playEffect(name: EffectName, options: { gain?: number; playbackRate?: number } = {}) {
    if (!this.unlocked || this.settings.muted || this.settings.masterVolume <= 0 || this.settings.effectsVolume <= 0) return;
    const base = this.effects.get(name);
    if (!base) return;
    const audio = base.cloneNode(true) as HTMLAudioElement;
    const entry: ActiveEffect = { audio, gain: options.gain ?? 1 };
    audio.playbackRate = options.playbackRate ?? 1;
    audio.volume = this.effectVolume(entry.gain);
    const cleanUp = () => this.activeEffects.delete(entry);
    audio.addEventListener("ended", cleanUp, { once: true });
    audio.addEventListener("error", cleanUp, { once: true });
    this.activeEffects.add(entry);
    void audio.play().catch(cleanUp);
  }

  private syncHazard(previous: GameState["hazard"], next: GameState["hazard"]) {
    if (previous?.id === next?.id) return;
    this.stopLoop("hazard");
    if (previous && !next) this.playEffect("splash", { gain: 0.62, playbackRate: 1.08 });
    if (!next) return;
    if (next.kind === "napkins") this.playEffect("new-order", { gain: 0.72, playbackRate: 1.2 });
    else if (next.kind === "ectoplasm") this.playEffect("ectoplasm", { gain: 0.62 });
    else this.startLoop("hazard", "fire", 0.42);
  }

  private startLoop(key: string, name: EffectName, gain: number) {
    this.stopLoop(key);
    const audio = makeAudio(EFFECT_SOURCES[name], true);
    const entry = { audio, gain };
    audio.volume = this.effectVolume(gain);
    this.loops.set(key, entry);
    if (this.unlocked && !this.hidden) void audio.play().catch(() => undefined);
  }

  private stopLoop(key: string) {
    const entry = this.loops.get(key);
    if (!entry) return;
    entry.audio.pause();
    entry.audio.currentTime = 0;
    this.loops.delete(key);
  }

  private chooseMusic(key: MusicKey, fade = true) {
    this.desiredMusic = key;
    if (this.currentMusic === key) {
      if (this.unlocked && !this.hidden) void this.playDesiredMusic();
      return;
    }

    const previousKey = this.currentMusic;
    const previous = previousKey && this.music.get(previousKey);
    const next = this.music.get(key)!;
    this.currentMusic = key;
    const transition = ++this.transition;
    next.currentTime = 0;
    next.volume = fade ? 0 : this.musicVolume();
    if (this.unlocked && !this.hidden) void next.play().catch(() => undefined);

    if (!fade) {
      previous?.pause();
      this.applyMusicVolume();
      return;
    }

    const startedAt = performance.now();
    const previousStart = previous?.volume ?? 0;
    const frame = (now: number) => {
      if (transition !== this.transition) return;
      const progress = Math.min(1, (now - startedAt) / 850);
      const target = this.musicVolume();
      next.volume = Math.max(0, Math.min(1, target * progress));
      if (previous) previous.volume = Math.max(0, Math.min(1, previousStart * (1 - progress)));
      if (progress < 1) window.requestAnimationFrame(frame);
      else if (previous) { previous.pause(); previous.currentTime = 0; }
    };
    window.requestAnimationFrame(frame);
  }

  private async playDesiredMusic() {
    const desired = this.music.get(this.desiredMusic);
    if (!desired || this.hidden) return;
    this.currentMusic = this.desiredMusic;
    desired.volume = this.musicVolume();
    try { await desired.play(); } catch { this.unlocked = false; }
  }

  private applyVolumes() {
    this.applyMusicVolume();
    for (const entry of this.activeEffects) entry.audio.volume = this.effectVolume(entry.gain);
    for (const entry of this.loops.values()) entry.audio.volume = this.effectVolume(entry.gain);
  }

  private applyMusicVolume() {
    if (!this.currentMusic) return;
    const current = this.music.get(this.currentMusic);
    if (current) current.volume = this.musicVolume();
  }

  private musicVolume() {
    if (this.settings.muted) return 0;
    const duck = this.ducked ? 0.38 : 1;
    return Math.max(0, Math.min(1, this.settings.masterVolume / 100 * this.settings.musicVolume / 100 * duck));
  }

  private effectVolume(gain: number) {
    if (this.settings.muted) return 0;
    return Math.max(0, Math.min(1, this.settings.masterVolume / 100 * this.settings.effectsVolume / 100 * gain));
  }
}
