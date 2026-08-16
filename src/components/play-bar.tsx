import { Button } from "@/components/ui/button";
import { useHorizon } from "@/lib/store";

export function PlayBar({ max }: { max: number }) {
  const station = useHorizon((s) => s.station);
  const setStation = useHorizon((s) => s.setStation);
  const playing = useHorizon((s) => s.playing);
  const play = useHorizon((s) => s.play);
  const stopPlay = useHorizon((s) => s.stopPlay);
  const whatIf = useHorizon((s) => s.whatIf);
  const setWhatIf = useHorizon((s) => s.setWhatIf);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant={playing ? "default" : "secondary"} onClick={() => (playing ? stopPlay() : play())}>
          {playing ? "Pause" : "Play MD"}
        </Button>
        <span className="font-mono text-xs text-muted">what-if {whatIf >= 0 ? "+" : ""}{whatIf.toFixed(1)} ft</span>
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] uppercase tracking-[0.12em] text-muted">Station</span>
        <input
          type="range"
          min={0}
          max={Math.max(max, 0)}
          value={Math.min(station, max)}
          onChange={(e) => {
            stopPlay();
            setStation(Number(e.target.value));
          }}
          className="w-full"
          aria-label="Station"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] uppercase tracking-[0.12em] text-muted">Last-known bias along toe</span>
        <input
          type="range"
          min={-8}
          max={8}
          step={0.2}
          value={whatIf}
          onChange={(e) => setWhatIf(Number(e.target.value))}
          className="w-full"
          aria-label="What-if bias"
        />
      </label>
    </div>
  );
}