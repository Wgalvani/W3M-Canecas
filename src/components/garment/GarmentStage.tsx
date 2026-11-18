"use client";

import { useEffect, useRef, useState } from "react";
import type { GarmentViewer, GuideSettings } from "@/lib/garment3d";
import type { GarmentSpec, Pose } from "@/lib/garments";
import type { Design, GarmentSize, GarmentView, Placement } from "@/types/garment";

const VIEWS: { view: GarmentView; label: string; short: string }[] = [
  { view: "front", label: "Frente", short: "Frente" },
  { view: "back", label: "Costas", short: "Costas" },
  { view: "left", label: "Lado esquerdo", short: "Esq." },
  { view: "right", label: "Lado direito", short: "Dir." },
];

interface GarmentStageProps {
  spec: GarmentSpec;
  size: GarmentSize;
  pose: Pose;
  color: string;
  trim: string | null;
  guide: GuideSettings;
  designs: Design[];
  placements: Placement[];
  selectedId: string | null;
  /** Pedido de vista: muda o número para girar de novo para a mesma vista. */
  view: { view: GarmentView; request: number };
  onViewChange: (view: GarmentView) => void;
  onSelect: (id: string | null) => void;
  onPlacementChange: (placement: Placement) => void;
  onReady: (viewer: GarmentViewer | null) => void;
  empty?: React.ReactNode;
}

/**
 * Palco 3D. O three.js só é baixado quando a aba abre, e a cena é liberada
 * (WebGL, texturas, laço de renderização) quando o componente sai da tela.
 */
export function GarmentStage(props: GarmentStageProps) {
  const { spec, size, pose, color, trim, guide, designs, placements, selectedId, view, onViewChange, empty } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewer, setViewer] = useState<GarmentViewer | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  // Callbacks sempre atuais, sem recriar a cena a cada renderização.
  const callbacks = useRef(props);
  useEffect(() => {
    callbacks.current = props;
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;
    let created: GarmentViewer | null = null;
    import("@/lib/garment3d")
      .then(({ createGarmentViewer }) => {
        if (disposed) return;
        created = createGarmentViewer(container, {
          onSelect: (id) => callbacks.current.onSelect(id),
          onPlacementChange: (placement) => callbacks.current.onPlacementChange(placement),
        });
        setViewer(created);
        callbacks.current.onReady(created);
        setStatus("ready");
      })
      .catch(() => {
        if (!disposed) setStatus("error");
      });
    return () => {
      disposed = true;
      callbacks.current.onReady(null);
      created?.dispose();
    };
  }, []);

  useEffect(() => viewer?.setGarment(spec, size, pose), [viewer, spec, size, pose]);
  useEffect(() => viewer?.setColor(color), [viewer, color]);
  useEffect(() => viewer?.setTrim(trim), [viewer, trim]);
  useEffect(() => viewer?.setGuide(guide), [viewer, guide]);
  useEffect(() => viewer?.setPrints(designs, placements), [viewer, designs, placements, spec, size, pose]);
  useEffect(() => viewer?.setSelected(selectedId), [viewer, selectedId, placements]);
  useEffect(() => viewer?.setView(view.view), [viewer, view]);

  return (
    <div className="relative">
      <div className="garment-stage relative aspect-[4/5] w-full overflow-hidden sm:aspect-[5/5] lg:aspect-[6/6.2] phone-tall:aspect-auto phone-tall:h-[44dvh]">
        <div
          ref={containerRef}
          className="absolute inset-0 touch-none"
          role="img"
          aria-label={`${spec.name} em 3D. Arraste para girar; arraste uma estampa para movê-la.`}
        />
        {status === "loading" && (
          <div className="absolute inset-0 grid place-items-center" role="status">
            <span aria-hidden className="size-8 animate-spin rounded-full border-[3px] border-line border-t-signal" />
            <span className="sr-only">Carregando a peça em 3D…</span>
          </div>
        )}
        {status === "error" && (
          <p role="alert" className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-ink-soft">
            Não foi possível abrir a visualização 3D neste navegador (WebGL desativado ou sem memória de vídeo).
          </p>
        )}
        {status === "ready" && empty}
        {status === "ready" && !empty && (
          <p className="pointer-events-none absolute left-4 top-3 text-[11px] text-muted max-sm:hidden">
            Arraste para girar · arraste a estampa para mover · roda do mouse para aproximar
          </p>
        )}
      </div>

      {/* Vistas rápidas */}
      <div
        role="group"
        aria-label="Vistas"
        className="absolute inset-x-0 bottom-3 mx-auto flex w-max rounded-full border border-line bg-card/90 p-1 shadow-lg shadow-ink/10 backdrop-blur"
      >
        {VIEWS.map((item) => (
          <button
            key={item.view}
            type="button"
            onClick={() => onViewChange(item.view)}
            aria-pressed={view.view === item.view}
            className={`h-9 rounded-full px-3 text-[13px] font-medium transition sm:px-3.5 ${
              view.view === item.view ? "bg-ink text-paper" : "text-muted hover:text-ink"
            }`}
          >
            <span className="sm:hidden" aria-hidden>
              {item.short}
            </span>
            <span className="max-sm:sr-only">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
