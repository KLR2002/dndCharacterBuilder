import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";
import { __setRandomSourceForTests, type D20Mode, type Roll } from "../rules/dice.ts";
import { makeRollLogEntry, type RollFollowUp, type RollLogEntry } from "../rules/rollLog.ts";

/** What one call of the publishing seam takes: a completed Roll, its source, and the optional extras. */
export interface PublishRollInput {
  /** A completed Roll from `src/rules/dice.ts`: every face already decided. */
  roll: Roll;
  /** Where the Roll came from, e.g. "Longsword attack", "Hit Points", "Dice tray". */
  source: string;
  /** The rolling character; absent for dice-tray rolls. */
  characterName?: string;
  /** The d20 mode the Roll was made with; "none" unless it is a d20 Roll. */
  d20Mode?: D20Mode;
  /** True when the Roll is critical damage, so the result shows "Critical". */
  critical?: boolean;
  /** An optional follow-up rendered as its own button on the result card, separate from the card's press target. */
  followUp?: RollFollowUp;
}

/** The tray's two segments. */
export type TraySegment = "dice" | "log";

interface RollLogContextValue {
  /** The session Roll Log, newest first. Empty after a restart; never stored with a Character. */
  entries: RollLogEntry[];
  /** The entry whose result card is showing above the floating dice button, or null. */
  latest: RollLogEntry | null;
  /**
   * The one publishing seam for Rolls: adds the entry to the Roll Log (newest first) and shows it as
   * the result card. Returns the entry it added.
   */
  publishRoll: (input: PublishRollInput) => RollLogEntry;
  /** Hides the result card without touching the log. */
  dismissResult: () => void;
  trayVisible: boolean;
  traySegment: TraySegment;
  /** Opens the dice tray, on the Log segment when `segment` is "log". */
  openTray: (segment?: TraySegment) => void;
  closeTray: () => void;
  /** Switches the open tray's segment. */
  selectTraySegment: (segment: TraySegment) => void;
  /** Height of the screen's bottom primary-action bar in px, so the floating button sits above it on phones. */
  bottomObstruction: number;
  setBottomObstruction: (px: number) => void;
}

const RollLogContext = createContext<RollLogContextValue | null>(null);

/** The session Roll Log and the dice tray state, mounted once at the root layout. React state only. */
export function RollLogProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = useState<RollLogEntry[]>([]);
  const [latest, setLatest] = useState<RollLogEntry | null>(null);
  const [trayVisible, setTrayVisible] = useState(false);
  const [traySegment, setTraySegment] = useState<TraySegment>("dice");
  const [bottomObstruction, setBottomObstruction] = useState(0);
  const nextId = useRef(1);

  const publishRoll = useCallback((input: PublishRollInput): RollLogEntry => {
    const entry = makeRollLogEntry(input, nextId.current, Date.now());
    nextId.current += 1;
    setEntries((prev) => [entry, ...prev]);
    setLatest(entry);
    return entry;
  }, []);

  const dismissResult = useCallback(() => setLatest(null), []);
  const openTray = useCallback((segment: TraySegment = "dice") => {
    setTraySegment(segment);
    setTrayVisible(true);
  }, []);
  const closeTray = useCallback(() => setTrayVisible(false), []);
  const selectTraySegment = useCallback((segment: TraySegment) => setTraySegment(segment), []);

  // Test-only hooks for the layout scenarios: on a web build flagged for E2E, expose the publishing seam
  // so a scenario can log a Roll no screen triggers yet, and the dice random source so a scenario can force
  // fixed faces (a natural 20). A production bundle never sets the flag.
  useEffect(() => {
    if (Platform.OS !== "web" || process.env.EXPO_PUBLIC_E2E !== "1") return;
    const scope = window as unknown as {
      __publishRoll?: (input: PublishRollInput) => RollLogEntry;
      __setRandomSource?: (faces: number[] | null) => void;
    };
    scope.__publishRoll = publishRoll;
    scope.__setRandomSource = (faces) => {
      if (faces === null) {
        __setRandomSourceForTests(null);
        return;
      }
      let index = 0;
      __setRandomSourceForTests((sides) => Math.min(sides, Math.max(1, faces[index++ % faces.length])));
    };
    return () => {
      delete scope.__publishRoll;
      delete scope.__setRandomSource;
      __setRandomSourceForTests(null);
    };
  }, [publishRoll]);

  const value = useMemo<RollLogContextValue>(
    () => ({
      entries,
      latest,
      publishRoll,
      dismissResult,
      trayVisible,
      traySegment,
      openTray,
      closeTray,
      selectTraySegment,
      bottomObstruction,
      setBottomObstruction,
    }),
    [entries, latest, publishRoll, dismissResult, trayVisible, traySegment, openTray, closeTray, selectTraySegment, bottomObstruction],
  );

  return <RollLogContext.Provider value={value}>{children}</RollLogContext.Provider>;
}

export function useRollLog(): RollLogContextValue {
  const ctx = useContext(RollLogContext);
  if (!ctx) throw new Error("useRollLog outside RollLogProvider");
  return ctx;
}
