import { create } from "zustand";
import { parseTypewellText } from "@/lib/rwt/ingest";
import { emptyPad } from "@/lib/rwt/empty";
import { synthesizePad } from "@/lib/rwt/synth";
import { wrapIngest, type IngestBundle } from "@/lib/rwt/wrapper";
import type { PadField, PipelineResult, Well } from "@/lib/rwt/types";
import { runPipeline } from "@/lib/rwt/pipeline";
import { evolveNet, type EvolveReport, type GenStat } from "@/lib/rwt/evolve";

let playTimer: number | null = null;

export type BookKind = "empty" | "imported" | "test";

const PERSIST_KEY = "horizon-session-v1";

interface Persisted {
  pad: PadField;
  bookKind: BookKind;
  activeWellId: string;
  targetWellId: string;
}

function readPersisted(): Persisted | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PERSIST_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Persisted;
    if (!parsed?.pad?.wells?.length) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writePersisted(s: {
  pad: PadField;
  bookKind: BookKind;
  activeWellId: string;
  targetWellId: string;
}) {
  if (typeof window === "undefined") return;
  try {
    if (s.bookKind === "empty" || !s.pad.wells.length) {
      window.localStorage.removeItem(PERSIST_KEY);
      return;
    }
    const payload: Persisted = {
      pad: s.pad,
      bookKind: s.bookKind,
      activeWellId: s.activeWellId,
      targetWellId: s.targetWellId,
    };
    window.localStorage.setItem(PERSIST_KEY, JSON.stringify(payload));
  } catch {
    /* quota */
  }
}

interface HorizonState {
  pad: PadField;
  bookKind: BookKind;
  results: Record<string, PipelineResult>;
  activeWellId: string;
  targetWellId: string;
  station: number;
  running: boolean;
  playing: boolean;
  whatIf: number;
  ingestDraft: string;
  ingestError: string | null;
  ingestBusy: boolean;
  lastFormat: string;
  lastBundle: IngestBundle | null;
  ingestStatus: string;
  hydrated: boolean;
  setWell: (id: string) => void;
  setTarget: (id: string) => void;
  setStation: (i: number) => void;
  setWhatIf: (v: number) => void;
  runWell: (id?: string) => void;
  runPad: () => void;
  ingest: (text: string, name?: string) => void;
  ingestFiles: (files: { name: string; text: string }[], opts?: { useAssistant?: boolean }) => Promise<void>;
  ingestTypewell: (text: string, name?: string) => void;
  setIngestDraft: (t: string) => void;
  loadTestPad: () => void;
  clearPad: () => void;
  removeWell: (id: string) => void;
  rehydrate: () => void;
  evolve: (id?: string) => void;
  evolves: Record<string, EvolveReport>;
  evolving: boolean;
  evolveTick: GenStat | null;
  play: () => void;
  stopPlay: () => void;
}

function clearPlay() {
  if (playTimer != null) {
    window.clearTimeout(playTimer);
    playTimer = null;
  }
}

function applyWells(current: PadField, incoming: Well[], name = "Imported"): PadField {
  const byId = new Map(current.wells.map((w) => [w.id, w]));
  for (const w of incoming) byId.set(w.id, w);
  const wells = [...byId.values()];
  return {
    ...current,
    id: current.id === "empty" ? "imported" : current.id,
    name: wells.length ? (current.id === "empty" ? name : current.name) : "No wells loaded",
    wells,
    typewell: incoming[0]?.typewell ?? current.typewell,
  };
}

export const useHorizon = create<HorizonState>((set, get) => {
  const pad = emptyPad();
  return {
    pad,
    bookKind: "empty",
    results: {},
    activeWellId: "",
    targetWellId: "",
    station: 0,
    running: false,
    playing: false,
    whatIf: 0,
    ingestDraft: "",
    ingestError: null,
    ingestBusy: false,
    lastFormat: "",
    lastBundle: null,
    ingestStatus: "",
    hydrated: false,
    evolves: {},
    evolving: false,
    evolveTick: null,
    setWell: (id) => {
      const s = get();
      const w = s.pad.wells.find((x) => x.id === id);
      const target =
        s.targetWellId === id
          ? (s.pad.wells.find((x) => x.id !== id)?.id ?? id)
          : s.targetWellId;
      set({
        activeWellId: id,
        targetWellId: target,
        station: w ? Math.floor(w.stations.length * 0.62) : 0,
      });
    },
    setTarget: (id) => set({ targetWellId: id }),
    setStation: (i) => set({ station: i }),
    setWhatIf: (v) => set({ whatIf: v }),
    runWell: (id) => {
      const state = get();
      const wid = id ?? state.activeWellId;
      const well = state.pad.wells.find((w) => w.id === wid);
      if (!well || state.running) return;
      set({ running: true });
      window.setTimeout(() => {
        try {
          const padWells = get().pad.wells;
          const target = padWells.find((w) => w.id === wid) ?? well;
          const result = runPipeline(target, padWells);
          set((s) => ({
            results: { ...s.results, [wid]: result },
            running: false,
            station: Math.min(s.station, target.stations.length - 1),
          }));
        } catch (err) {
          console.error(err);
          set({ running: false });
        }
      }, 16);
    },
    runPad: () => {
      const state = get();
      if (state.running || !state.pad.wells.length) return;
      set({ running: true });
      const ids = state.pad.wells.map((w) => w.id);
      let i = 0;
      const step = () => {
        const current = get();
        if (i >= ids.length) {
          set({ running: false });
          return;
        }
        const wid = ids[i++]!;
        const well = current.pad.wells.find((w) => w.id === wid);
        if (!well) {
          window.setTimeout(step, 0);
          return;
        }
        try {
          const result = runPipeline(well, current.pad.wells);
          set((s) => ({ results: { ...s.results, [wid]: result } }));
        } catch (err) {
          console.error(err);
        }
        window.setTimeout(step, 0);
      };
      window.setTimeout(step, 16);
    },
    ingest: (text, name) => {
      void get().ingestFiles([{ name: name ?? "paste.txt", text }]);
    },
    ingestFiles: async (files, opts) => {
      if (get().ingestBusy) return;
      set({ ingestBusy: true, ingestError: null, ingestStatus: "Parsing…" });
      try {
        const bundle = await wrapIngest(files, opts);
        if (!bundle.wells.length && !bundle.typewells.length) {
          set({
            ingestBusy: false,
            lastBundle: bundle,
            ingestError: bundle.skipped[0]?.reason ?? "No wells found in the files.",
            ingestStatus: "",
          });
          return;
        }
        set((s) => {
          let pad = s.pad;
          if (bundle.wells.length) pad = applyWells(pad, bundle.wells);
          if (bundle.typewells.length) {
            const tw = bundle.typewells[0]!.tw;
            const wid = bundle.wells[0]?.id ?? s.activeWellId;
            pad = {
              ...pad,
              typewell: tw,
              wells: pad.wells.map((w) =>
                !wid || w.id === wid || bundle.wells.some((n) => n.id === w.id)
                  ? { ...w, typewell: w.typewell.tvt.length ? w.typewell : tw }
                  : w,
              ),
            };
          }
          const nextId = bundle.wells[0]?.id ?? s.activeWellId;
          const nextWell = pad.wells.find((w) => w.id === nextId);
          return {
            pad,
            bookKind: "imported" as const,
            activeWellId: nextId,
            targetWellId: pad.wells.find((w) => w.id !== nextId)?.id ?? nextId,
            station: nextWell ? Math.floor(nextWell.stations.length * 0.62) : 0,
            ingestError: null,
            ingestBusy: false,
            lastFormat: bundle.plans.map((p) => p.format).join(", "),
            lastBundle: bundle,
            ingestStatus: `Imported ${bundle.wells.length} well${bundle.wells.length === 1 ? "" : "s"}${
              bundle.typewells.length ? `, ${bundle.typewells.length} type well` : ""
            }.`,
          };
        });
        for (const w of bundle.wells) get().runWell(w.id);
      } catch (e) {
        set({
          ingestBusy: false,
          ingestError: e instanceof Error ? e.message : "Parse failed",
          ingestStatus: "",
        });
      }
    },
    ingestTypewell: (text, name) => {
      try {
        const tw = parseTypewellText(text);
        if (tw.tvt.length < 8) {
          set({ ingestError: "Type well needs TVT and GR columns." });
          return;
        }
        const wid = get().activeWellId;
        set((s) => {
          const wells = s.pad.wells.map((w) =>
            !wid || w.id === wid ? { ...w, typewell: tw } : w,
          );
          return {
            pad: { ...s.pad, wells, typewell: tw },
            ingestError: null,
            lastFormat: name ?? "typewell",
            results: wid
              ? Object.fromEntries(Object.entries(s.results).filter(([k]) => k !== wid))
              : s.results,
          };
        });
        if (wid) get().runWell(wid);
      } catch (e) {
        set({ ingestError: e instanceof Error ? e.message : "Type well parse failed" });
      }
    },
    setIngestDraft: (t) => set({ ingestDraft: t, ingestError: null }),
    loadTestPad: () => {
      clearPlay();
      const next = synthesizePad(7);
      set({
        pad: next,
        bookKind: "test",
        results: {},
        activeWellId: next.wells[0]?.id ?? "",
        targetWellId: next.wells[1]?.id ?? next.wells[0]?.id ?? "",
        station: Math.floor((next.wells[0]?.stations.length ?? 1) * 0.62),
        playing: false,
        lastFormat: "test-generated",
        ingestError: null,
        lastBundle: null,
        ingestStatus: "Test wells generated. Not field data.",
      });
    },
    clearPad: () => {
      clearPlay();
      set({
        pad: emptyPad(),
        bookKind: "empty",
        results: {},
        activeWellId: "",
        targetWellId: "",
        station: 0,
        playing: false,
        lastFormat: "",
        ingestError: null,
        lastBundle: null,
        ingestStatus: "",
        evolves: {},
        evolveTick: null,
      });
    },
    removeWell: (id) => {
      set((s) => {
        const wells = s.pad.wells.filter((w) => w.id !== id);
        const { [id]: _drop, ...rest } = s.results;
        void _drop;
        const next = s.activeWellId === id ? (wells[0]?.id ?? "") : s.activeWellId;
        return {
          pad: {
            ...s.pad,
            wells,
            name: wells.length ? s.pad.name : "No wells loaded",
            id: wells.length ? s.pad.id : "empty",
          },
          bookKind: wells.length ? s.bookKind : "empty",
          activeWellId: next,
          targetWellId: wells.find((w) => w.id !== next)?.id ?? next,
          results: rest,
          evolves: Object.fromEntries(Object.entries(s.evolves).filter(([k]) => k !== id)),
        };
      });
    },
    rehydrate: () => {
      if (get().hydrated) return;
      const saved = readPersisted();
      if (!saved) {
        set({ hydrated: true });
        return;
      }
      const well = saved.pad.wells.find((w) => w.id === saved.activeWellId) ?? saved.pad.wells[0];
      set({
        pad: saved.pad,
        bookKind: saved.bookKind,
        activeWellId: well?.id ?? "",
        targetWellId:
          saved.pad.wells.find((w) => w.id === saved.targetWellId && w.id !== well?.id)?.id ??
          saved.pad.wells.find((w) => w.id !== well?.id)?.id ??
          well?.id ??
          "",
        station: well ? Math.floor(well.stations.length * 0.62) : 0,
        hydrated: true,
        results: {},
      });
    },
    evolve: (id) => {
      const state = get();
      const wid = id ?? state.activeWellId;
      const result = state.results[wid];
      if (!result || state.evolving) return;
      set({ evolving: true, evolveTick: null });
      window.setTimeout(() => {
        try {
          const report = evolveNet(result, {
            pop: 20,
            gens: 16,
            mutation: 0.05,
            seed: 11 + wid.length,
            station: get().station,
            onGen: (stat) => set({ evolveTick: stat }),
          });
          set((s) => ({
            evolves: { ...s.evolves, [wid]: report },
            evolving: false,
            evolveTick: report.history[report.history.length - 1] ?? s.evolveTick,
          }));
        } catch (err) {
          console.error(err);
          set({ evolving: false });
        }
      }, 16);
    },
    play: () => {
      if (get().playing) {
        get().stopPlay();
        return;
      }
      set({ playing: true });
      const tick = () => {
        const s = get();
        if (!s.playing) return;
        const well = s.pad.wells.find((w) => w.id === s.activeWellId);
        if (!well) {
          get().stopPlay();
          return;
        }
        const next = s.station + 3;
        if (next >= well.stations.length) {
          const ps = well.stations.findIndex((x) => x.isPredict);
          set({ station: Math.max(ps, 0) });
        } else {
          set({ station: next });
        }
        playTimer = window.setTimeout(tick, 70);
      };
      playTimer = window.setTimeout(tick, 70);
    },
    stopPlay: () => {
      clearPlay();
      set({ playing: false });
    },
  };
});

export function activeWell(): Well | undefined {
  const s = useHorizon.getState();
  return s.pad.wells.find((w) => w.id === s.activeWellId);
}

if (typeof window !== "undefined") {
  useHorizon.subscribe((s) => {
    if (!s.hydrated) return;
    writePersisted(s);
  });
}
