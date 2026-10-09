import type { SoloSnapshot } from "../shared/solo-save";

export interface DisplayAudioSettings {
  scale: 1 | 0.85 | 1.15;
  pixelPerfect: boolean;
  reducedMotion: boolean;
  masterVolume: number;
  musicVolume: number;
  effectsVolume: number;
  muted: boolean;
}

export interface SoloProfile {
  name: string;
  role: string;
  fur: string;
  accessory: string;
}

export interface SoloSave {
  version: 1;
  profile: SoloProfile;
  savedAt: number;
  summary: { coins: number; reputation: number; round: number; phase: string };
  snapshot?: SoloSnapshot;
}

const settingsKey = "paws-pours-settings-v1";
const soloKey = "paws-pours-solo-v1";
const slotsKey = "paws-pours-solo-slots-v2";
export const SOLO_SLOT_COUNT = 3;
export function loadSoloSlots(): (SoloSave | null)[] {
  const stored = read<unknown>(slotsKey);
  if (Array.isArray(stored)) return Array.from({ length: SOLO_SLOT_COUNT }, (_, index) => {
    const item = stored[index] as SoloSave | undefined;
    return item?.version === 1 && item.profile && typeof item.profile.name === "string" && item.summary && Number.isFinite(item.savedAt) ? item : null;
  });
  const legacy = loadSoloSave();
  return [legacy ?? null, null, null];
}
export function saveSoloSlot(index: number, save: SoloSave): boolean {
  if (!Number.isInteger(index) || index < 0 || index >= SOLO_SLOT_COUNT) return false;
  const slots = loadSoloSlots(); slots[index] = save;
  try { localStorage.setItem(slotsKey, JSON.stringify(slots)); return true; } catch { return false; }
}

export const defaultSettings: DisplayAudioSettings = {
  scale: 1, pixelPerfect: true, reducedMotion: false,
  masterVolume: 80, musicVolume: 65, effectsVolume: 80, muted: false
};

function read<T>(key: string): T | undefined {
  try { return JSON.parse(localStorage.getItem(key) ?? "") as T; } catch { return undefined; }
}

export function loadSettings(): DisplayAudioSettings {
  const saved = read<Partial<DisplayAudioSettings>>(settingsKey);
  if (!saved) return { ...defaultSettings };
  return {
    scale: saved.scale === .85 || saved.scale === 1.15 ? saved.scale : 1,
    pixelPerfect: saved.pixelPerfect !== false, reducedMotion: Boolean(saved.reducedMotion),
    masterVolume: Math.max(0, Math.min(100, Number(saved.masterVolume ?? defaultSettings.masterVolume))),
    musicVolume: Math.max(0, Math.min(100, Number(saved.musicVolume ?? defaultSettings.musicVolume))),
    effectsVolume: Math.max(0, Math.min(100, Number(saved.effectsVolume ?? defaultSettings.effectsVolume))),
    muted: Boolean(saved.muted)
  };
}

export function saveSettings(settings: DisplayAudioSettings) { localStorage.setItem(settingsKey, JSON.stringify(settings)); }
export function loadSoloSave() {
  const saved = read<SoloSave>(soloKey);
  return saved?.version === 1 && saved.profile && saved.summary ? saved : undefined;
}
export function saveSoloSave(save: SoloSave) { localStorage.setItem(soloKey, JSON.stringify(save)); }
export function clearSoloSave() { localStorage.removeItem(soloKey); }
