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
}

const settingsKey = "paws-pours-settings-v1";
const soloKey = "paws-pours-solo-v1";

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
