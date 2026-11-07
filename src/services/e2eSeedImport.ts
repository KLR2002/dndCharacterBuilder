import type { Character, Folder } from "../types/character.ts";
import { migrateIfNeeded, saveAll, type AppSettings, type StoredState } from "./storage.ts";
import { saveCompendiumData, type CompendiumCollections } from "./compendiumStorage.ts";

/** The seed file the E2E runner copies into the app's private folder; read once on launch, then deleted. */
export const E2E_SEED_FILE_NAME = "dnd5e_e2e_seed.json";

/** The seed envelope, the same shape the web seed uses: app state plus an optional Integrated Catalog. */
export interface E2eSeed {
  characters: Character[];
  folders: Folder[];
  settings: AppSettings;
  integrated: CompendiumCollections | null;
}

const COMPENDIUM_COLLECTION_KEYS = [
  "races",
  "classes",
  "feats",
  "backgrounds",
  "items",
  "spells",
  "beasts",
  "conditions",
  "optionsAndFeatures",
  "books",
] as const;

let mockFsForTests: any | undefined;

export function __setE2eSeedFsForTests(fs: any | undefined) {
  mockFsForTests = fs;
}

async function getNativeFileSystem() {
  if (mockFsForTests) return mockFsForTests;
  try {
    const fs = await import("expo-file-system/legacy");
    if (fs && fs.documentDirectory) {
      return fs;
    }
  } catch {
    // Not available (web or test runner): no documentDirectory, so no seed.
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Parses and fully validates a seed before anything is written. Returns null for invalid JSON, a missing
 * required key, or content the app's own migration rejects.
 */
export function parseE2eSeed(raw: string): E2eSeed | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(value)) return null;
  if (!Array.isArray(value.characters) || !Array.isArray(value.folders) || !isRecord(value.settings)) return null;
  if (!("integrated" in value)) return null;
  const integrated = value.integrated;
  if (integrated !== null) {
    if (!isRecord(integrated) || typeof integrated.hasIntegratedCatalog !== "boolean") return null;
    for (const key of COMPENDIUM_COLLECTION_KEYS) {
      if (!Array.isArray(integrated[key])) return null;
    }
  }
  let normalized: StoredState & { version: 2 };
  try {
    normalized = migrateIfNeeded({ characters: value.characters, folders: value.folders, settings: value.settings });
  } catch {
    return null;
  }
  return {
    characters: normalized.characters,
    folders: normalized.folders,
    settings: normalized.settings,
    integrated: integrated as CompendiumCollections | null,
  };
}

/**
 * Reads the seed file from the app's private folder, deletes it, and imports it through the app's own
 * storage writers. Returns true when a valid seed was imported. On web there is no documentDirectory, so
 * this does nothing. An unreadable or invalid seed is never written, partially or otherwise.
 */
export async function importE2eSeed(): Promise<boolean> {
  const fs = await getNativeFileSystem();
  if (!fs || !fs.documentDirectory) return false;
  const uri = `${fs.documentDirectory}${E2E_SEED_FILE_NAME}`;
  let exists = false;
  try {
    const info = await fs.getInfoAsync(uri);
    exists = Boolean(info && info.exists);
  } catch {
    return false;
  }
  if (!exists) return false;
  let raw: string;
  try {
    raw = await fs.readAsStringAsync(uri);
  } catch {
    return false; // Cannot be read: nothing is written and the file is left alone.
  }
  await fs.deleteAsync(uri, { idempotent: true });
  const seed = parseE2eSeed(raw);
  if (!seed) return false; // Validate before any write: a broken seed leaves no partial state.
  await saveAll({ characters: seed.characters, folders: seed.folders, settings: seed.settings });
  if (seed.integrated !== null) await saveCompendiumData(seed.integrated);
  return true;
}
