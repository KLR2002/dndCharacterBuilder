import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { DEFAULT_ACTIVE_BOOK_CODES, SRD_SOURCE } from "../constants/books";
import {
  DEFAULT_SETTINGS,
  loadAll,
  saveCharacters,
  saveFolders,
  updateSettings,
} from "../services/storage";
import type { Character, Folder } from "../types/character";
import { applyCharacterUpdate } from "./characterUpdates";
import { migrateCharacter } from "../rules/migrateCharacter";
import { reconcileForActiveBooks } from "../rules/characterReconciler";
import { checkActiveBooksIntegrity } from "../rules/builderTransitions";
import { getClasses, getRaces } from "../services/dataService";
import { currentCompendium, integrate as integrateCompendium, revertToSrd as revertCompendiumToSrd } from "../services/compendium";
import {
  clearCompendiumData,
  loadCompendiumData,
} from "../services/compendiumStorage";
import { runInAppIntegration } from "../services/scraper/runner";

interface CharacterContextValue {
  characters: Character[];
  folders: Folder[];
  activeBooks: string[];
  hasCompletedFirstRun: boolean;
  isFirstRun: boolean;
  isLoading: boolean;
  initError: string | null;
  retryInitialization: () => Promise<void>;
  currentCharacter: Character | null;
  selectCharacter: (id: string | null) => void;
  completeFirstRun: (books?: string[]) => Promise<void>;
  createCharacter: (initialData: {
    name: string;
    gender?: string;
    alignment?: string;
    faction?: { name: string; rank: string; renown: string; notes: string };
    folderId?: string | null;
  }) => Promise<Character>;
  updateCharacter: {
    (id: string, updater: (c: Character) => Character): Promise<void>;
    /** @deprecated Use an updater when reading existing state. */
    (id: string, updates: Partial<Character>): Promise<void>;
  };
  deleteCharacter: (id: string) => Promise<void>;
  createFolder: (name: string) => Promise<Folder>;
  deleteFolder: (id: string) => Promise<void>;
  moveCharacterToFolder: (charId: string, folderId: string | null) => Promise<void>;
  setActiveBooks: (books: string[]) => Promise<void>;
  fullHealOnLevelUp: boolean;
  setFullHealOnLevelUp: (on: boolean) => Promise<void>;
  setFirstRunCompleted: (books: string[]) => Promise<void>;
  getCharacter: (id: string) => Character | undefined;

  // Compendium Integration
  isIntegrated: boolean;
  integratedAt: string | null;
  /** The loaded Integrated Catalog is below the format the application requires. Always false for the SRD Baseline. */
  catalogStale: boolean;
  triggerIntegration: (onProgress?: (category: string, step: number, total: number) => void) => Promise<void>;
  revertToSrd: () => Promise<void>;
}

const CharacterContext = createContext<CharacterContextValue | null>(null);

// Persist only committed state, never inside a replayable React updater. Each
// mutation promise resolves/rejects with its batch's actual queued storage write.
function usePersistedCollection<T>(save: (items: T[]) => Promise<void>) {
  const [snapshot, setSnapshot] = useState<{ items: T[]; operations: symbol[] }>({ items: [], operations: [] });
  const pending = useRef(new Map<symbol, { resolve: () => void; reject: (error: unknown) => void }>());
  useEffect(() => {
    // Only IDs carried by this render's state can be acknowledged by its save.
    const included = new Set(snapshot.operations);
    const waiting = snapshot.operations.flatMap(id => {
      const waiter = pending.current.get(id);
      pending.current.delete(id); // Claim once, including when effects replay.
      return waiter ? [waiter] : [];
    });
    if (!waiting.length) return;
    const prune = () => setSnapshot(previous => ({
      ...previous,
      operations: previous.operations.filter(id => !included.has(id)),
    }));
    save(snapshot.items).then(
      () => { prune(); waiting.forEach(waiter => waiter.resolve()); },
      error => { prune(); waiting.forEach(waiter => waiter.reject(error)); },
    );
  }, [snapshot, save]);
  const setItems = useCallback((items: T[]) => {
    setSnapshot(previous => ({ ...previous, items }));
  }, []);
  const change = (updater: (previous: T[]) => T[]): Promise<void> => new Promise((resolve, reject) => {
    const id = Symbol();
    pending.current.set(id, { resolve, reject });
    setSnapshot(previous => ({
      items: updater(previous.items),
      operations: [...previous.operations, id],
    }));
  });
  return [snapshot.items, setItems, change] as const;
}

export function CharacterProvider({ children }: { children: React.ReactNode }) {
  const [characters, setCharacters, changeCharacters] = usePersistedCollection<Character>(saveCharacters);
  const [folders, setFolders, changeFolders] = usePersistedCollection<Folder>(saveFolders);
  const ready = useRef(false);
  const initialization = useRef<Promise<void> | null>(null);
  const requireReady = () => {
    if (!ready.current) throw new Error("Load characters successfully before editing. Retry initialization or restore your backup.");
  };
  const [activeBooks, setActiveBooksState] = useState<string[]>(DEFAULT_ACTIVE_BOOK_CODES);
  const [fullHealOnLevelUp, setFullHealOnLevelUpState] = useState<boolean>(DEFAULT_SETTINGS.fullHealOnLevelUp);
  const [hasCompletedFirstRun, setHasCompletedFirstRun] = useState<boolean>(true); // default true to avoid flash
  const [isIntegrated, setIsIntegrated] = useState<boolean>(false);
  const [integratedAt, setIntegratedAt] = useState<string | null>(null);
  const [catalogStale, setCatalogStale] = useState<boolean>(false);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [initError, setInitError] = useState<string | null>(null);

  // Retry failed initialization only; share pending attempts and never reload edits.
  // Validate the entire load before scheduling any loaded state changes.
  const loadNow = useCallback((): Promise<void> => {
    if (ready.current) return Promise.resolve();
    if (initialization.current) return initialization.current;
    setIsLoading(true);
    setInitError(null);
    initialization.current = (async () => {
      try {
        const result = await loadAll();
        if (!result.ok) throw new Error(result.error);
        const { characters: loadedChars, folders: loadedFolds, settings: loadedSettings } = result.data;
        let compData = null;
        try {
          compData = await loadCompendiumData();
        } catch (storageErr) {
          console.warn("Compendium storage load failed, defaulting to SRD baseline:", storageErr);
        }
        if (compData && compData.hasIntegratedCatalog) {
          integrateCompendium(compData);
          setIsIntegrated(true);
          setIntegratedAt(compData.integratedAt || null);
        } else {
          revertCompendiumToSrd();
          setIsIntegrated(false);
          setIntegratedAt(null);
        }
        setCatalogStale(currentCompendium().stale);
        const raceCatalog = getRaces();
        const classCatalog = getClasses();
        const migratedCharacters = loadedChars.map((c) => migrateCharacter(c, raceCatalog, classCatalog));
        setActiveBooksState(loadedSettings.activeResourceBooks || DEFAULT_ACTIVE_BOOK_CODES);
        setFullHealOnLevelUpState(loadedSettings.fullHealOnLevelUp);
        setHasCompletedFirstRun(Boolean(loadedSettings.hasCompletedFirstRun));
        setCharacters(migratedCharacters);
        setFolders(loadedFolds);
        ready.current = true;
      } catch (err) {
        console.error("Initialization error:", err);
        setInitError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsLoading(false);
      }
    })().finally(() => { initialization.current = null; });
    return initialization.current;
  }, [setCharacters, setFolders]);

  useEffect(() => {
    async function init() { await loadNow(); }
    void init();
  }, [loadNow]);

  const retryInitialization = loadNow;

  const createCharacter = async (initialData: {
    name: string;
    gender?: string;
    alignment?: string;
    faction?: { name: string; rank: string; renown: string; notes: string };
    folderId?: string | null;
  }): Promise<Character> => {
    requireReady();
    const newChar: Character = migrateCharacter({
      id: `char_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: initialData.name.trim(),
      folderId: initialData.folderId || null,
      gender: initialData.gender || "",
      alignment: initialData.alignment || "",
      faction: initialData.faction || { name: "", rank: "", renown: "", notes: "" },
      avatarUri: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),

      // Builder defaults
      abilityMethod: "pointBuy",
      baseAbilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      customLineage: false,
      lineageReplacement: null,
      race: null,
      racialAbilityBonuses: {},
      background: null,
      startingOption: "equipment",
      classes: [],
      chosenSkills: [],
      chosenExpertise: [],
      asiSelections: [],

      // Stats defaults
      currentHp: 10,
      maxHpOverride: null,
      tempHp: 0,
      conditions: [],
      usedHitDice: {},
      deathSaves: { successes: 0, failures: 0 },

      // Spells defaults
      knownSpells: [],
      preparedSpells: [],
      usedSpellSlots: {},
      usedPactSlots: 0,
      sorceryPointsUsed: 0,
      chosenMetamagic: [],

      // Inventory defaults
      items: [],
      pouch: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
      useWeightLimit: false,

      // Feature resources
      resourceCounters: {},

      // Journal defaults
      description: "",
      backstory: "",
      personalityTraits: "",
      ideals: "",
      bonds: "",
      flaws: "",
      notes: "",
    });

    await changeCharacters(previous => [...previous, newChar]);
    return newChar;
  };

  const updateCharacter = async (id: string, updates: Partial<Character> | ((c: Character) => Character)) => {
    requireReady();
    const updatedAt = Date.now();
    const updater = typeof updates === "function" ? updates : (c: Character) => ({ ...c, ...updates });
    await changeCharacters(previous => applyCharacterUpdate(previous, id, c => ({ ...updater(c), updatedAt })));
  };

  const deleteCharacter = async (id: string) => {
    requireReady();
    await changeCharacters(previous => previous.filter(c => c.id !== id));
  };

  const createFolder = async (name: string): Promise<Folder> => {
    requireReady();
    const newFolder: Folder = {
      id: `folder_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: name.trim(),
      createdAt: Date.now(),
    };
    await changeFolders(previous => [...previous, newFolder]);
    return newFolder;
  };

  const deleteFolder = async (id: string) => {
    requireReady();
    await Promise.all([
      changeFolders(previous => previous.filter(f => f.id !== id)),
      changeCharacters(previous => previous.map(c => c.folderId === id ? { ...c, folderId: null } : c)),
    ]);
  };

  const moveCharacterToFolder = async (charId: string, folderId: string | null) => {
    await updateCharacter(charId, c => ({ ...c, folderId }));
  };

  const setActiveBooks = async (books: string[]) => {
    setActiveBooksState(books);
    await updateSettings({ activeResourceBooks: books });
    const activeSet = new Set(books.map((b) => b.toUpperCase()));
    await changeCharacters((previous) =>
      previous.map((c) => {
        const warnings = checkActiveBooksIntegrity(c, books);
        const existing = (c.needsReview || []).filter((w) => {
          const match = w.match(/from disabled sourcebook "([^"]+)"/);
          if (match && match[1]) {
            return !activeSet.has(match[1].toUpperCase());
          }
          return true;
        });
        const combined = new Set([...existing, ...warnings]);
        const nextReview = combined.size > 0 ? Array.from(combined) : undefined;
        const currentReview = c.needsReview;
        if (
          (!currentReview && !nextReview) ||
          (currentReview &&
            nextReview &&
            currentReview.length === nextReview.length &&
            currentReview.every((v, i) => v === nextReview[i]))
        ) {
          return c;
        }
        return { ...c, needsReview: nextReview };
      })
    );
  };

  const setFullHealOnLevelUp = async (on: boolean) => {
    setFullHealOnLevelUpState(on);
    await updateSettings({ fullHealOnLevelUp: on });
  };

  const setFirstRunCompleted = async (books: string[]) => {
    setHasCompletedFirstRun(true);
    setActiveBooksState(books);
    await updateSettings({ hasCompletedFirstRun: true, activeResourceBooks: books });
  };

  const completeFirstRun = async (books?: string[]) => {
    await setFirstRunCompleted(books || activeBooks);
  };

  const triggerIntegration = async (
    onProgress?: (category: string, step: number, total: number) => void
  ) => {
    const compendium = await runInAppIntegration(onProgress);
    integrateCompendium(compendium);
    setIsIntegrated(true);
    setIntegratedAt(compendium.integratedAt || new Date().toISOString());
    setCatalogStale(currentCompendium().stale);
    await setActiveBooks(DEFAULT_ACTIVE_BOOK_CODES);
  };

  const revertToSrd = async () => {
    await clearCompendiumData();
    revertCompendiumToSrd();
    setIsIntegrated(false);
    setIntegratedAt(null);
    setCatalogStale(false);
    await setActiveBooks([SRD_SOURCE]);
  };

  const getCharacter = (id: string) => {
    return characters.find((c) => c.id === id);
  };

  const selectCharacter = (id: string | null) => {
    setSelectedCharacterId(id);
  };

  // The open character is reconciled against the active books when it is opened, when the books change,
  // when the catalog is swapped, and once loading finishes (it may be selected before its record loads).
  // Unopened characters are reconciled when they are opened. The committed characters are read through a
  // ref, so the check runs at those moments only. The save goes through updateCharacter, and only when
  // reconciling changed the character.
  const committed = useRef({ characters, updateCharacter });
  useEffect(() => {
    committed.current = { characters, updateCharacter };
  });
  useEffect(() => {
    if (isLoading || selectedCharacterId === null) return;
    const { characters: loaded, updateCharacter: update } = committed.current;
    const character = loaded.find((c) => c.id === selectedCharacterId);
    if (!character) return;
    const compendium = currentCompendium();
    if (reconcileForActiveBooks(character, compendium, activeBooks) === character) return;
    update(selectedCharacterId, (c) => reconcileForActiveBooks(c, compendium, activeBooks)).catch((error) =>
      console.error("Could not save the character reconciled to the active books:", error)
    );
  }, [selectedCharacterId, activeBooks, integratedAt, isLoading]);

  const currentCharacter = characters.find((c) => c.id === selectedCharacterId) || null;

  return (
    <CharacterContext.Provider
      value={{
        characters,
        folders,
        activeBooks,
        hasCompletedFirstRun,
        isFirstRun: !hasCompletedFirstRun,
        isLoading,
        initError,
        retryInitialization,
        currentCharacter,
        selectCharacter,
        completeFirstRun,
        createCharacter,
        updateCharacter,
        deleteCharacter,
        createFolder,
        deleteFolder,
        moveCharacterToFolder,
        setActiveBooks,
        fullHealOnLevelUp,
        setFullHealOnLevelUp,
        setFirstRunCompleted,
        getCharacter,
        isIntegrated,
        integratedAt,
        catalogStale,
        triggerIntegration,
        revertToSrd,
      }}>
      {children}
    </CharacterContext.Provider>
  );
}

export function useCharacters(): CharacterContextValue {
  const ctx = useContext(CharacterContext);
  if (!ctx) {
    throw new Error("useCharacters must be used within a CharacterProvider");
  }
  return ctx;
}
