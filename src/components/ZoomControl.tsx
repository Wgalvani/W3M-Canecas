import { ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from "@/lib/constants";

const stepButton =
  "grid size-10 shrink-0 place-items-center rounded-full border border-line bg-card text-lg text-ink-soft transition hover:border-ink hover:text-ink disabled:pointer-events-none disabled:opacity-35";

export function ZoomControl({ zoom, onChange }: { zoom: number; onChange: (zoom: number) => void }) {
  const percent = Math.round(zoom * 100);
  const fill = ((zoom - ZOOM_MIN) / (ZOOM_MAX - ZOOM_MIN)) * 100;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label htmlFor="zoom" className="text-[13px] font-medium text-ink-soft">
          Zoom
        </label>
        <span className="rounded-md bg-paper-deep px-1.5 py-0.5 font-mono text-xs tabular-nums text-ink">{percent}%</span>
      </div>
      <div className="flex items-center gap-3">
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
          className="range h-10 w-full cursor-pointer"
          style={{ "--fill": `${fill}%` } as React.CSSProperties}
        />
        <button type="button" className={stepButton} onClick={() => onChange(zoom + ZOOM_STEP)} disabled={zoom >= ZOOM_MAX} aria-label="Aumentar zoom">
          +
        </button>
      </div>
    </div>
  );
}
