import { DEFAULT_ACTIVE_BOOK_CODES } from "../constants/books.ts";
import type { Character, Folder } from "../types/character.ts";

const SETTINGS_KEY = "@dnd5e_app_settings";
const CHARACTERS_KEY = "@dnd5e_characters";
const FOLDERS_KEY = "@dnd5e_folders";
const BACKUP_KEY = "@dnd5e_backup_pre_v2";

export interface AppSettings {
  schemaVersion: number;
  hasCompletedFirstRun: boolean;
  activeResourceBooks: string[];
  themeAccentId: string;
  fullHealOnLevelUp: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  schemaVersion: 2,
  hasCompletedFirstRun: false,
  activeResourceBooks: DEFAULT_ACTIVE_BOOK_CODES,
  themeAccentId: "crimson",
  fullHealOnLevelUp: true,
};

export interface StoredState {
  characters: Character[];
  folders: Folder[];
  settings: AppSettings;
}

export type LoadResult =
  | { ok: true; data: StoredState }
  | { ok: false; error: string; raw: string | null };

let testKv: Map<string, string> | undefined;
let loaded = false;
let writeQueue: Promise<unknown> = Promise.resolve();

export function __setKvForTests(kv: Map<string, string>) {
  testKv = kv;
  loaded = false;
  writeQueue = Promise.resolve();
}

async function getItem(key: string): Promise<string | null> {
  if (testKv) return testKv.get(key) ?? null;
  const { default: storage } = await import("@react-native-async-storage/async-storage");
  return storage.getItem(key);
}

async function setItem(key: string, value: string): Promise<void> {
  if (testKv) { testKv.set(key, value); return; }
  const { default: storage } = await import("@react-native-async-storage/async-storage");
  await storage.setItem(key, value);
}

function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  // ponytail: one process-wide queue; use transactions if multi-writer storage is needed.
  const result = writeQueue.then(operation);
  writeQueue = result.catch(() => undefined); // Recover the queue, not the caller's promise.
  return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function records<T>(value: unknown, label: string): T[] {
  if (!Array.isArray(value) || !value.every(entry =>
    isRecord(entry) && typeof entry.id === "string" && typeof entry.name === "string" &&
    typeof entry.createdAt === "number" && Number.isFinite(entry.createdAt))) {
    throw new Error(`Invalid ${label}: expected an array of records with id, name and createdAt`);
  }
  // Character choice validation/migration belongs to the later character-schema task.
  return value as T[];
}

function normalizeSettings(value: unknown): AppSettings {
  if (!isRecord(value)) throw new Error("Invalid settings: expected an object");
  if (value.schemaVersion !== undefined && value.schemaVersion !== 1 && value.schemaVersion !== 2) {
    throw new Error(`Unsupported schemaVersion: ${String(value.schemaVersion)}`);
  }
  if (value.hasCompletedFirstRun !== undefined && typeof value.hasCompletedFirstRun !== "boolean") {
    throw new Error("Invalid settings: hasCompletedFirstRun must be boolean");
  }
  if (value.themeAccentId !== undefined && typeof value.themeAccentId !== "string") {
    throw new Error("Invalid settings: themeAccentId must be a string");
  }
  if (value.fullHealOnLevelUp !== undefined && typeof value.fullHealOnLevelUp !== "boolean") {
    throw new Error("Invalid settings: fullHealOnLevelUp must be boolean");
  }
  if (value.activeResourceBooks !== undefined && (!Array.isArray(value.activeResourceBooks) ||
    !value.activeResourceBooks.every(book => typeof book === "string"))) {
    throw new Error("Invalid settings: activeResourceBooks must be a string array");
  }
  return {
    ...DEFAULT_SETTINGS,
    ...value,
    schemaVersion: 2,
    activeResourceBooks: [...(value.activeResourceBooks as string[] | undefined ?? DEFAULT_ACTIVE_BOOK_CODES)],
  } as AppSettings;
}

/** Normalize the envelope only; preserve character/folder content verbatim. */
export function migrateIfNeeded(raw: unknown): StoredState & { version: 2 } {
  if (!isRecord(raw)) throw new Error("Invalid saved envelope: expected an object");
  return {
    version: 2,
    characters: records<Character>(raw.characters, "characters"),
    folders: records<Folder>(raw.folders, "folders"),
    settings: normalizeSettings(raw.settings),
  };
}

async function writeState(state: StoredState): Promise<void> {
  // Serialize all fields before the first write; settings/version is the last migration marker.
  const characters = JSON.stringify(state.characters);
  const folders = JSON.stringify(state.folders);
  const settings = JSON.stringify(state.settings);
  await setItem(CHARACTERS_KEY, characters);
  await setItem(FOLDERS_KEY, folders);
  await setItem(SETTINGS_KEY, settings);
}

// Called only inside the queue, so reads cannot observe an in-flight snapshot/migration.
async function readState(): Promise<LoadResult> {
  let raw: string | null = null;
  try {
    const originals: [string, string][] = [];
    async function read<T>(key: string, fallback: T, validate: (value: unknown) => T): Promise<T> {
      raw = null;
      raw = await getItem(key);
      if (raw === null) return fallback;
      originals.push([key, raw]);
      let parsed: unknown;
      try { parsed = JSON.parse(raw); }
      catch { throw new Error(`Unable to parse saved JSON at ${key}. Retry or restore your backup.`); }
      return validate(parsed);
    }
    const characters = await read(CHARACTERS_KEY, [] as Character[], value => records<Character>(value, "characters"));
    const folders = await read(FOLDERS_KEY, [] as Folder[], value => records<Folder>(value, "folders"));
    let version: unknown;
    const settings = await read(SETTINGS_KEY, normalizeSettings({}), value => {
      const normalized = normalizeSettings(value);
      version = (value as Record<string, unknown>).schemaVersion;
      return normalized;
    });
    const data = { characters, folders, settings };
    if (originals.length && version !== 2) {
      raw = originals[0][1];
      // Keep exact raw strings, including whitespace. Never overwrite an earlier backup on retry.
      for (const [index, [key, original]] of originals.entries()) {
        const backupKey = index === 0 ? BACKUP_KEY : `${BACKUP_KEY}:${key}`;
        if (await getItem(backupKey) === null) await setItem(backupKey, original);
      }
      await writeState(data);
    }
    loaded = true;
    return { ok: true, data };
  } catch (error) {
    loaded = false;
    return { ok: false, error: error instanceof Error ? error.message : String(error), raw };
  }
}

export function loadAll(): Promise<LoadResult> {
  return enqueue(readState);
}

function requireData(result: LoadResult): StoredState {
  if (!result.ok) throw new Error(result.error);
  return result.data;
}

export function saveAll(state: StoredState, options: { requireLoaded?: boolean } = {}): Promise<void> {
  return enqueue(async () => {
    if (options.requireLoaded && !loaded) throw new Error("Load saved data successfully before saving.");
    const { version: _version, ...normalized } = migrateIfNeeded(state);
    requireData(await readState()); // Protect unreadable originals even when saving before first load.
    await writeState(normalized);
  });
}

function savePatch(patch: Partial<StoredState>, settingsPatch?: Partial<AppSettings>): Promise<void> {
  return enqueue(async () => {
    const current = requireData(await readState());
    const settings = settingsPatch ? { ...current.settings, ...settingsPatch } : current.settings;
    const { version: _version, ...normalized } = migrateIfNeeded({ ...current, settings, ...patch });
    await writeState(normalized);
  });
}

export function updateSettings(patch: Partial<AppSettings>): Promise<void> {
  return savePatch({}, patch);
}

// Compatibility exports throw on failed loads/saves; no empty-success fallbacks.
export async function loadCharacters(): Promise<Character[]> { return requireData(await loadAll()).characters; }
export async function loadFolders(): Promise<Folder[]> { return requireData(await loadAll()).folders; }
export async function loadSettings(): Promise<AppSettings> { return requireData(await loadAll()).settings; }
export function saveCharacters(characters: Character[]): Promise<void> { return savePatch({ characters }); }
export function saveFolders(folders: Folder[]): Promise<void> { return savePatch({ folders }); }
export function saveSettings(settings: AppSettings): Promise<void> { return updateSettings(settings); }
