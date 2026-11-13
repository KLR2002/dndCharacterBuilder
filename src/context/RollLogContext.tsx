import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Dimensions, Platform } from "react-native";
import { useDiceAnimation } from "../components/dice/useDiceAnimation";
import { __setRandomSourceForTests, currentRandom, type D20Mode, type RandomSource, type Roll } from "../rules/dice.ts";
import { makeRollLogEntry, type RollFollowUp, type RollLogEntry } from "../rules/rollLog.ts";
import { runThrow, setThrowRandomForTests, throwDieSize, throwPhysicsRandom, type ThrowRecord } from "../rules/throwRoll.ts";

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

/** A Throw whose dice have settled: its batch waits in the Roll Log until the result is revealed. */
export type PendingThrow = ThrowRecord & {
  /** The batch the Throw made, already in the Roll Log. */
  entries: RollLogEntry[];
  /** The first id of the batch, identifying the Throw. */
  startId: number;
};

interface RollLogContextValue {
  /** The session Roll Log, newest first. Empty after a restart; never stored with a Character. */
  entries: RollLogEntry[];
  /** The batch whose result card is showing above the floating dice button, or null. */
  latest: RollLogEntry[] | null;
  /**
   * The one publishing seam for Rolls: adds the entry to the Roll Log (newest first) and shows it as
   * the result card. Returns the entry it added.
   */
  publishRoll: (input: PublishRollInput) => RollLogEntry;
  /**
   * Publishes several Rolls as one batch: the entries are added to the log in the order given, as one
   * group nearest the top, and shown together as the result card. Returns the entries in that order.
   */
  publishRolls: (inputs: PublishRollInput[]) => RollLogEntry[];
  /**
   * The roll seam every Roll source uses. `make(random)` builds the Roll(s) from the given random source;
   * with the Throw animation it runs twice (to learn the dice, then with the settled faces), the dice fly
   * from the floating button, and the entries are logged at once without showing the result card. Otherwise
   * it runs once with the default random source and publishes as `publishRolls` does.
   */
  rollAndPublish: (make: (random: RandomSource) => PublishRollInput | PublishRollInput[]) => RollLogEntry[];
  /** The Throw whose result has not been revealed yet, or null. */
  pendingThrow: PendingThrow | null;
  /** The Throw whose dice are on screen, or null. Outlives the reveal until `endFlight` clears it. */
  flight: PendingThrow | null;
  /** Clears the flight when it is the Throw that starts at `startId`; a newer Throw's flight is kept. */
  endFlight: (startId: number) => void;
  /** Shows the pending Throw's batch as the result card. */
  revealResult: () => void;
  /** Where the Throw's dice leave the screen, in px: the floating dice button's centre. */
  setThrowOrigin: (origin: [number, number]) => void;
  /** Hides the result card without touching the log. */
  dismissResult: () => void;
  trayVisible: boolean;
  traySegment: TraySegment;
  /** Opens the dice tray, on the Log segment when `segment` is "log". */
  openTray: (segment?: TraySegment) => void;
  closeTray: () => void;
  /** The tray's Roll Expression text. Kept for the session, never stored. */
  expression: string;
  setExpression: (text: string) => void;
  /** Switches the open tray's segment. */
  selectTraySegment: (segment: TraySegment) => void;
  /** Height of the screen's bottom primary-action bar in px, so the floating button sits above it on phones. */
  bottomObstruction: number;
  setBottomObstruction: (px: number) => void;
}

const RollLogContext = createContext<RollLogContextValue | null>(null);

/** A seeded random source in [0, 1) (mulberry32), so a test can replay one Throw exactly. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The session Roll Log and the dice tray state, mounted once at the root layout. React state only. */
export function RollLogProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = useState<RollLogEntry[]>([]);
  const [latest, setLatest] = useState<RollLogEntry[] | null>(null);
  const [trayVisible, setTrayVisible] = useState(false);
  const [traySegment, setTraySegment] = useState<TraySegment>("dice");
  const [bottomObstruction, setBottomObstruction] = useState(0);
  const [expression, setExpression] = useState("");
  const [pendingThrow, setPendingThrow] = useState<PendingThrow | null>(null);
  const [flight, setFlight] = useState<PendingThrow | null>(null);
  const nextId = useRef(1);

  // The seam reads the animation through a ref, so its callback stays stable across setting changes.
  const animation = useDiceAnimation();
  const animationRef = useRef(animation);
  useEffect(() => {
    animationRef.current = animation;
  }, [animation]);
  const throwOriginRef = useRef<[number, number] | null>(null);

  /** Adds a batch to the Roll Log, newest first, and returns its entries in order. Shows nothing. */
  const logBatch = useCallback((inputs: PublishRollInput[]): RollLogEntry[] => {
    const time = Date.now();
    const batchId = nextId.current;
    const batch = inputs.map((input, index) =>
      makeRollLogEntry(input, batchId + index, time, { batchId, batchIndex: index, batchSize: inputs.length }),
    );
    nextId.current += inputs.length;
    if (batch.length > 0) setEntries((prev) => [...batch, ...prev]);
    return batch;
  }, []);

  const publishRolls = useCallback(
    (inputs: PublishRollInput[]): RollLogEntry[] => {
      if (inputs.length === 0) return [];
      const batch = logBatch(inputs);
      // A Roll published now replaces a Throw still in the air, dice included.
      setPendingThrow(null);
      setFlight(null);
      setLatest(batch);
      return batch;
    },
    [logBatch],
  );

  const publishRoll = useCallback((input: PublishRollInput): RollLogEntry => publishRolls([input])[0], [publishRolls]);

  const rollAndPublish = useCallback(
    (make: (random: RandomSource) => PublishRollInput | PublishRollInput[]): RollLogEntry[] => {
      const toInputs = (made: PublishRollInput | PublishRollInput[]) => (Array.isArray(made) ? made : [made]);
      if (animationRef.current !== "throw") return publishRolls(toInputs(make(currentRandom())));

      const world = Dimensions.get("window");
      const size = { W: world.width, H: world.height };
      // Before the floating button reports its centre, the throw leaves from its usual corner.
      const origin: [number, number] = throwOriginRef.current ?? [size.W - 44, size.H - 44];
      const { result, thrown } = runThrow(make, {
        world: size,
        origin,
        size: throwDieSize(size),
        physics: throwPhysicsRandom(),
        fallback: currentRandom(),
      });
      if (!thrown) return publishRolls(toInputs(result));

      const startId = nextId.current;
      const entries = logBatch(toInputs(result));
      // The old result card hides as the new Throw starts; the new one appears when the dice stop.
      setLatest(null);
      const throwInFlight = { ...thrown, entries, startId };
      setPendingThrow(throwInFlight);
      setFlight(throwInFlight);
      return entries;
    },
    [logBatch, publishRolls],
  );

  const revealResult = useCallback(() => {
    if (!pendingThrow) return;
    setPendingThrow(null);
    setLatest(pendingThrow.entries);
  }, [pendingThrow]);

  const endFlight = useCallback((startId: number) => {
    setFlight((current) => (current?.startId === startId ? null : current));
  }, []);

  const setThrowOrigin = useCallback((origin: [number, number]) => {
    throwOriginRef.current = origin;
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
      __publishRolls?: (inputs: PublishRollInput[]) => RollLogEntry[];
      __setRandomSource?: (faces: number[] | null) => void;
      __setThrowRandom?: (seed: number | null) => void;
    };
    scope.__publishRoll = publishRoll;
    scope.__publishRolls = publishRolls;
    scope.__setRandomSource = (faces) => {
      if (faces === null) {
        __setRandomSourceForTests(null);
        return;
      }
      let index = 0;
      __setRandomSourceForTests((sides) => Math.min(sides, Math.max(1, faces[index++ % faces.length])));
    };
    scope.__setThrowRandom = (seed) => setThrowRandomForTests(seed === null ? null : seededRandom(seed));
    return () => {
      delete scope.__publishRoll;
      delete scope.__publishRolls;
      delete scope.__setRandomSource;
      delete scope.__setThrowRandom;
      __setRandomSourceForTests(null);
      setThrowRandomForTests(null);
    };
  }, [publishRoll, publishRolls]);

  const value = useMemo<RollLogContextValue>(
    () => ({
      entries,
      latest,
      publishRoll,
      publishRolls,
      rollAndPublish,
      pendingThrow,
      flight,
      endFlight,
      revealResult,
      setThrowOrigin,
      dismissResult,
      trayVisible,
      traySegment,
      openTray,
      closeTray,
      expression,
      setExpression,
      selectTraySegment,
      bottomObstruction,
      setBottomObstruction,
    }),
    [
      entries,
      latest,
      publishRoll,
      publishRolls,
      rollAndPublish,
      pendingThrow,
      flight,
      endFlight,
      revealResult,
      setThrowOrigin,
      dismissResult,
      trayVisible,
      traySegment,
      openTray,
      closeTray,
      expression,
      selectTraySegment,
      bottomObstruction,
    ],
  );

  return <RollLogContext.Provider value={value}>{children}</RollLogContext.Provider>;
}

export function useRollLog(): RollLogContextValue {
  const ctx = useContext(RollLogContext);
  if (!ctx) throw new Error("useRollLog outside RollLogProvider");
  return ctx;
}
