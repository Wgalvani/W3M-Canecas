import { ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from "@/lib/constants";

const stepButton =
  "grid size-11 shrink-0 place-items-center rounded-full border border-slate-200 text-xl text-slate-700 hover:bg-slate-50 disabled:opacity-40";

export function ZoomControl({ zoom, onChange }: { zoom: number; onChange: (zoom: number) => void }) {
  const percent = Math.round(zoom * 100);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label htmlFor="zoom" className="text-sm font-medium text-slate-700">
          Zoom
        </label>
        <span className="text-sm tabular-nums text-slate-500">{percent}%</span>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" className={stepButton} onClick={() => onChange(zoom - ZOOM_STEP)} disabled={zoom <= ZOOM_MIN} aria-label="Diminuir zoom">
          −
        </button>
        <input
          id="zoom"
          type="range"
          min={ZOOM_MIN}
          max={ZOOM_MAX}
          step={0.01}
          value={zoom}
          onChange={(event) => onChange(Number(event.target.value))}
          aria-valuetext={`${percent}%`}
          className="h-11 w-full cursor-pointer accent-blue-600"
        />
        <button type="button" className={stepButton} onClick={() => onChange(zoom + ZOOM_STEP)} disabled={zoom >= ZOOM_MAX} aria-label="Aumentar zoom">
          +
        </button>
      </div>
    </div>
  );
}
