import type {
  RaceData,
  ClassData,
  FeatData,
  BackgroundData,
  ItemData,
  SpellData,
  ConditionData,
  OptionFeatureData,
  BeastData,
} from "../types/dnd5e.ts";

/**
 * Minimum Integrated Catalog format the application requires. A catalog saved with a lower
 * number, or with none (saved by an older app), is stale: it still loads, but Settings asks for a re-sync.
 * Format 3 adds Proficiency Grants to class, subclass and feat features (ADR 0015).
 * Format 4 adds the Kensei weapon choices and the Artificer firearm fix, and keeps same-named
 * classes from different sources apart.
 * Format 5 changes the class, race, background, skill, weapon and armor Proficiency Grants, the Tiger
 * grants and the grant ids (now stable, with aliases for the former position-based ids).
 * Format 6 adds the class starting equipment slots, which a catalog saved at format 5 does not carry.
 */
export const REQUIRED_CATALOG_FORMAT = 6;

/** True for an Integrated Catalog saved below the required format (or with none). The SRD Baseline is never stale. */
export function isCatalogStale(collections: Pick<CompendiumCollections, "hasIntegratedCatalog" | "catalogFormat">): boolean {
  return collections.hasIntegratedCatalog && (collections.catalogFormat ?? 0) < REQUIRED_CATALOG_FORMAT;
}

export interface CompendiumCollections {
  hasIntegratedCatalog: boolean;
  integratedAt?: string;
  /** Format of the catalog when it was saved. Absent on catalogs saved before formats existed. */
  catalogFormat?: number;
  races: RaceData[];
  classes: ClassData[];
  feats: FeatData[];
  backgrounds: BackgroundData[];
  items: ItemData[];
  spells: SpellData[];
  beasts: BeastData[];
  conditions: ConditionData[];
  optionsAndFeatures: OptionFeatureData[];
  books: any[];
}

const DB_NAME = "dnd5e_compendium_db";
const DB_VERSION = 2;
const STORE_NAME = "collections";
const STORAGE_KEY = "@dnd5e_integrated_compendium";
const COMPENDIUM_FILE_NAME = "dnd5e_compendium.json";

let testKv: Map<string, string> | undefined;
let mockFsForTests: any | undefined;

export function __setCompendiumKvForTests(kv: Map<string, string> | undefined) {
  testKv = kv;
}

export function __setNativeFsForTests(fs: any | undefined) {
  mockFsForTests = fs;
}

function isWebIndexedDBAvailable(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.indexedDB !== "undefined" &&
    !testKv &&
    !mockFsForTests
  );
}

async function getNativeFileSystem() {
  if (mockFsForTests) return mockFsForTests;
  if (testKv) return null;
  try {
    const fs = await import("expo-file-system/legacy");
    if (fs && fs.documentDirectory) {
      return fs;
    }
  } catch {
    // Not available (e.g. web or test runner)
  }
  return null;
}

function openIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const nextVersion = db.version + 1;
        db.close();
        const upgradeReq = window.indexedDB.open(DB_NAME, nextVersion);
        upgradeReq.onupgradeneeded = () => {
          const upDb = upgradeReq.result;
          if (!upDb.objectStoreNames.contains(STORE_NAME)) {
            upDb.createObjectStore(STORE_NAME);
          }
        };
        upgradeReq.onsuccess = () => resolve(upgradeReq.result);
        upgradeReq.onerror = () => reject(upgradeReq.error);
        return;
      }
      resolve(db);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function saveCompendiumData(input: CompendiumCollections): Promise<void> {
  const data: CompendiumCollections = { ...input, catalogFormat: REQUIRED_CATALOG_FORMAT };
  if (testKv) {
    testKv.set(STORAGE_KEY, JSON.stringify(data));
    return;
  }

  if (isWebIndexedDBAvailable()) {
    try {
      const db = await openIndexedDB();
      if (db.objectStoreNames.contains(STORE_NAME)) {
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, "readwrite");
          const store = tx.objectStore(STORE_NAME);
          const req = store.put(data, STORAGE_KEY);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });
        return;
      }
    } catch (idbErr) {
      console.warn("IndexedDB saveCompendiumData failed, falling back to FileSystem/AsyncStorage:", idbErr);
    }
  }

  // Native mobile environment: Use expo-file-system (no CursorWindow 2MB SQLite limit!)
  const fs = await getNativeFileSystem();
  if (fs && fs.documentDirectory) {
    try {
      const fileUri = `${fs.documentDirectory}${COMPENDIUM_FILE_NAME}`;
      await fs.writeAsStringAsync(fileUri, JSON.stringify(data));
      return;
    } catch (fsErr) {
      console.warn("FileSystem saveCompendiumData failed, falling back to AsyncStorage:", fsErr);
    }
  }

  try {
    const { default: storage } = await import("@react-native-async-storage/async-storage");
    await storage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn("Failed to persist compendium in storage", err);
  }
}

export async function loadCompendiumData(): Promise<CompendiumCollections | null> {
  if (testKv) {
    const raw = testKv.get(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  if (isWebIndexedDBAvailable()) {
    try {
      const db = await openIndexedDB();
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        return null;
      }
      return await new Promise<CompendiumCollections | null>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(STORAGE_KEY);
        req.onsuccess = () => resolve((req.result as CompendiumCollections) || null);
        req.onerror = () => reject(req.error);
      });
    } catch (idbErr) {
      console.warn("IndexedDB loadCompendiumData failed, falling back to FileSystem/AsyncStorage:", idbErr);
    }
  }

  // Native mobile environment: Use expo-file-system
  const fs = await getNativeFileSystem();
  if (fs && fs.documentDirectory) {
    try {
      const fileUri = `${fs.documentDirectory}${COMPENDIUM_FILE_NAME}`;
      const info = await fs.getInfoAsync(fileUri);
      if (info && info.exists) {
        const raw = await fs.readAsStringAsync(fileUri);
        return raw ? JSON.parse(raw) : null;
      }
      return null;
    } catch (fsErr) {
      console.warn("FileSystem loadCompendiumData failed, falling back to AsyncStorage:", fsErr);
    }
  }

  try {
    const { default: storage } = await import("@react-native-async-storage/async-storage");
    const raw = await storage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function clearCompendiumData(): Promise<void> {
  if (testKv) {
    testKv.delete(STORAGE_KEY);
    return;
  }

  if (isWebIndexedDBAvailable()) {
    try {
      const db = await openIndexedDB();
      if (db.objectStoreNames.contains(STORE_NAME)) {
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, "readwrite");
          const store = tx.objectStore(STORE_NAME);
          const req = store.delete(STORAGE_KEY);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });
        return;
      }
    } catch (idbErr) {
      console.warn("IndexedDB clearCompendiumData failed, falling back to FileSystem/AsyncStorage:", idbErr);
    }
  }

  // Native mobile environment: Use expo-file-system
  const fs = await getNativeFileSystem();
  if (fs && fs.documentDirectory) {
    try {
      const fileUri = `${fs.documentDirectory}${COMPENDIUM_FILE_NAME}`;
      await fs.deleteAsync(fileUri, { idempotent: true });
      return;
    } catch (fsErr) {
      console.warn("FileSystem clearCompendiumData failed, falling back to AsyncStorage:", fsErr);
    }
  }

  try {
    const { default: storage } = await import("@react-native-async-storage/async-storage");
    await storage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore error
  }
}

export async function hasIntegratedCatalog(): Promise<boolean> {
  if (testKv) {
    const raw = testKv.get(STORAGE_KEY);
    if (!raw) return false;
    try {
      return Boolean(JSON.parse(raw)?.hasIntegratedCatalog);
    } catch {
      return false;
    }
  }

  const fs = await getNativeFileSystem();
  if (fs && fs.documentDirectory) {
    try {
      const fileUri = `${fs.documentDirectory}${COMPENDIUM_FILE_NAME}`;
      const info = await fs.getInfoAsync(fileUri);
      return Boolean(info && info.exists);
    } catch {
      // fallback
    }
  }

  try {
    const data = await loadCompendiumData();
    return Boolean(data && data.hasIntegratedCatalog);
  } catch {
    return false;
  }
}
