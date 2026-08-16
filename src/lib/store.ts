import { create } from "zustand";
import { parseAny, tableToWell } from "@/lib/rwt/ingest";
import { runPipeline } from "@/lib/rwt/pipeline";
import { sampleIngestText, synthesizePad } from "@/lib/rwt/synth";
import type { PadField, PipelineResult, Well } from "@/lib/rwt/types";

let playTimer: number | null = null;

interface HorizonState {
  pad: PadField;
  results: Record<string, PipelineResult>;
  activeWellId: string;
  targetWellId: string;
  station: number;
  running: boolean;
  playing: boolean;
  whatIf: number;
  ingestDraft: string;
  ingestError: string | null;
  lastFormat: string;
  setWell: (id: string) => void;
  setTarget: (id: string) => void;
  setStation: (i: number) => void;
  setWhatIf: (v: number) => void;
  runWell: (id?: string) => void;
  runPad: () => void;
  ingest: (text: string, name?: string) => void;
  setIngestDraft: (t: string) => void;
  loadSample: () => void;
  removeWell: (id: string) => void;
  play: () => void;
  stopPlay: () => void;
}

function ensurePad(): PadField {
  return synthesizePad(7);
}

function clearPlay() {
  if (playTimer != null) {
    window.clearTimeout(playTimer);
    playTimer = null;
  }
}

export const useHorizon = create<HorizonState>((set, get) => {
  const pad = ensurePad();
  return {
    pad,
    results: {},
    activeWellId: pad.wells[0]!.id,
    targetWellId: pad.wells[1]?.id ?? pad.wells[0]!.id,
    station: 0,
    running: false,
    playing: false,
    whatIf: 0,
    ingestDraft: "",
    ingestError: null,
    lastFormat: "synthetic-pad",
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
          const pad = get().pad.wells;
          const target = pad.find((w) => w.id === wid) ?? well;
          const result = runPipeline(target, pad);
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
      if (state.running) return;
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
      try {
        const table = parseAny(text);
        if (!table.rows.length) {
          set({ ingestError: "No numeric rows found." });
          return;
        }
        const well = tableToWell(table, {
          id: `ING-${Date.now().toString(36).slice(-5)}`,
          name: name ?? `INGEST ${table.format.toUpperCase()}`,
          typewell: get().pad.typewell,
        });
        set((s) => {
          const pad: PadField = {
            ...s.pad,
            wells: [...s.pad.wells.filter((w) => w.id !== well.id), well],
          };
          return {
            pad,
            activeWellId: well.id,
            station: Math.floor(well.stations.length * 0.62),
            ingestError: null,
            lastFormat: table.format,
            results: { ...s.results },
          };
        });
        get().runWell(well.id);
      } catch (e) {
        set({ ingestError: e instanceof Error ? e.message : "Parse failed" });
      }
    },
    setIngestDraft: (t) => set({ ingestDraft: t, ingestError: null }),
    loadSample: () => {
      const w = get().pad.wells[0];
      if (!w) return;
      set({ ingestDraft: sampleIngestText(w), lastFormat: "data-index" });
    },
    removeWell: (id) => {
      set((s) => {
        const wells = s.pad.wells.filter((w) => w.id !== id);
        if (!wells.length) return s;
        const next = s.activeWellId === id ? wells[0]!.id : s.activeWellId;
        const { [id]: _drop, ...rest } = s.results;
        void _drop;
        return {
          pad: { ...s.pad, wells },
          activeWellId: next,
          results: rest,
        };
      });
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