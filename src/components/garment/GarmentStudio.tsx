"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TokenNotice } from "@/lib/auth/tokenNotice";
import { ACCEPTED_EXTENSIONS, ACCEPTED_MIME_TYPES } from "@/lib/constants";
import { errorMessage } from "@/lib/errors";
import type { GarmentViewer, GuideSettings } from "@/lib/garment3d";
import {
  AREA_LABELS,
  availableAreas,
  collarY,
  DEFAULT_FABRIC,
  DEFAULT_GARMENT,
  DEFAULT_POSE,
  DEFAULT_SIZE,
  FABRIC_COLORS,
  FABRIC_GROUPS,
  GARMENT_CATEGORIES,
  GARMENT_SIZES,
  GARMENTS,
  garmentDims,
  garmentSpec,
  printAreas,
  type GarmentCategory,
  type Pose,
} from "@/lib/garments";
import { loadImage, releaseImage } from "@/lib/imageProcessor";
import {
  alignToCollar,
  clampPlacement,
  COLLAR_GUIDE_CM,
  defaultPlacement,
  distanceFromCollar,
  formatPrintSize,
  maxWidthFor,
  MIN_PRINT_CM,
} from "@/lib/placement";
import { canvasHasTransparency, withoutWhiteBackground } from "@/lib/removeWhite";
import type { Design, GarmentId, GarmentSize, GarmentView, Placement, PrintArea, PrintAreaId } from "@/types/garment";
import { RegMark, Header } from "../Header";
import { Modal } from "../Modal";
import { Panel } from "../Panel";
import { SegmentedControl } from "../SegmentedControl";
import { TokenReminder } from "../TokenReminder";
import { btn, eyebrow } from "../ui";
import { GarmentStage } from "./GarmentStage";
import { ProofModal } from "./ProofModal";

const ACCEPT = [...ACCEPTED_MIME_TYPES, ...ACCEPTED_EXTENSIONS].join(",");
const MAX_DESIGNS = 8;

const nextPaint = () => new Promise<void>((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
const newId = () => (typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

function prepareArt(design: Pick<Design, "image" | "removeWhite" | "hasAlpha">): HTMLCanvasElement {
  return design.removeWhite && !design.hasAlpha ? withoutWhiteBackground(design.image.preview) : design.image.preview;
}

function releaseArt(design: Design) {
  if (design.art !== design.image.preview) design.art.width = design.art.height = 0;
}

export function GarmentStudio({ tokenNotice }: { tokenNotice?: TokenNotice | null }) {
  const [garmentId, setGarmentId] = useState<GarmentId>(DEFAULT_GARMENT);
  const [size, setSize] = useState<GarmentSize>(DEFAULT_SIZE);
  const [color, setColor] = useState(DEFAULT_FABRIC);
  /** Gola, punhos e debruns em outra cor (null = mesma cor da peça). */
  const [trim, setTrim] = useState<string | null>(null);
  const [pose, setPose] = useState<Pose>(DEFAULT_POSE);
  /** Corpo do manequim; a baby look começa no feminino, mas qualquer peça pode usar os dois. */
  const [figure, setFigure] = useState<"male" | "female">("male");
  const [guide, setGuide] = useState<GuideSettings>({ enabled: true, distanceCm: COLLAR_GUIDE_CM });
  const [notice, setNotice] = useState<string | null>(null);
  const [designs, setDesigns] = useState<Design[]>([]);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<{ view: GarmentView; request: number }>({ view: "front", request: 0 });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [proofOpen, setProofOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [dragDepth, setDragDepth] = useState(0);
  const viewerRef = useRef<GarmentViewer | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const spec = useMemo(() => ({ ...garmentSpec(garmentId), female: figure === "female" }), [garmentId, figure]);
  const areas = useMemo(() => printAreas(spec, size, pose), [spec, size, pose]);
  const dims = useMemo(() => garmentDims(spec, size, pose), [spec, size, pose]);
  const areaIds = availableAreas(spec);
  const designById = useMemo(() => new Map(designs.map((d) => [d.id, d])), [designs]);
  const selected = placements.find((p) => p.id === selectedId) ?? null;

  // Libera imagens e artes ao sair da página.
  const designsRef = useRef(designs);
  useEffect(() => {
    designsRef.current = designs;
  });
  useEffect(
    () => () => {
      for (const design of designsRef.current) {
        releaseArt(design);
        releaseImage(design.image);
      }
    },
    [],
  );

  const goTo = (next: GarmentView) => setView((current) => ({ view: next, request: current.request + 1 }));

  /** Reajusta as estampas aos limites de outra peça/tamanho; regata não tem manga. */
  const refit = (nextId: GarmentId, nextSize: GarmentSize, nextPose: Pose) => {
    const nextSpec = garmentSpec(nextId);
    const nextAreas = printAreas(nextSpec, nextSize, nextPose);
    const allowed = availableAreas(nextSpec);
    const dropped = placements.filter((p) => !allowed.includes(p.area));
    if (dropped.length) {
      setNotice(
        `${dropped.length === 1 ? "A estampa da manga foi removida" : `${dropped.length} estampas de manga foram removidas`}: ${nextSpec.name.toLowerCase()} não tem manga.`,
      );
      if (dropped.some((p) => p.id === selectedId)) setSelectedId(null);
    }
    setPlacements((current) =>
      current
        .filter((p) => allowed.includes(p.area))
        .map((p) => {
          const design = designById.get(p.designId);
          return design ? clampPlacement(p, nextAreas[p.area], design.aspect) : p;
        }),
    );
  };

  const changeGarment = (id: GarmentId) => {
    setGarmentId(id);
    if (garmentSpec(id).female) setFigure("female");
    setNotice(null);
    refit(id, size, pose);
  };
  const changeSize = (next: GarmentSize) => {
    setSize(next);
    refit(garmentId, next, pose);
  };
  const changePose = (next: Pose) => {
    setPose(next);
    refit(garmentId, size, next);
  };

  /** Frente, costas e peito entram com o topo na guia da gola (4 dedos), centralizados. */
  const placeAt = useCallback(
    (placement: Placement, design: Design, area: PrintArea) =>
      guide.enabled && (area.id === "front" || area.id === "back" || area.id === "chest")
        ? alignToCollar(placement, area, design.aspect, collarY(spec, dims, area.id), guide.distanceCm)
        : placement,
    [guide, spec, dims],
  );

  const addPlacement = useCallback(
    (design: Design, area: PrintAreaId) => {
      const placement = placeAt(defaultPlacement(newId(), design.id, areas[area], design.aspect), design, areas[area]);
      setPlacements((current) => [...current, placement]);
      setSelectedId(placement.id);
      setView((current) => ({ view: areas[area].view, request: current.request + 1 }));
    },
    [areas, placeAt],
  );

  const handleFiles = async (files: File[]) => {
    if (!files.length) return;
    setError(null);
    const room = MAX_DESIGNS - designs.length;
    if (room <= 0) {
      setError(`Limite de ${MAX_DESIGNS} desenhos por prova. Remova algum para enviar outro.`);
      return;
    }
    setBusy(files.length > 1 ? "Preparando os desenhos…" : "Preparando o desenho…");
    await nextPaint();
    const added: Design[] = [];
    try {
      for (const file of files.slice(0, room)) {
        const image = await loadImage(file);
        const hasAlpha = canvasHasTransparency(image.preview);
        // Sem transparência (JPG, PNG chapado): o fundo branco sai por padrão, como no DTF.
        const base = { image, hasAlpha, removeWhite: !hasAlpha };
        added.push({ ...base, id: newId(), art: prepareArt(base), aspect: image.width / image.height });
      }
    } catch (err) {
      setError(errorMessage(err, "corrupt"));
    } finally {
      setBusy(null);
    }
    if (!added.length) return;
    setDesigns((current) => [...current, ...added]);
    if (files.length > room) setError(`Só cabem ${MAX_DESIGNS} desenhos por prova; os demais não foram enviados.`);
    // Primeiro desenho da prova já entra na frente.
    if (placements.length === 0) addPlacement(added[0], "front");
  };

  const toggleRemoveWhite = (id: string) => {
    setDesigns((current) =>
      current.map((design) => {
        if (design.id !== id) return design;
        releaseArt(design);
        const next = { ...design, removeWhite: !design.removeWhite };
        return { ...next, art: prepareArt(next) };
      }),
    );
  };

  const removeDesign = (id: string) => {
    const design = designById.get(id);
    setDesigns((current) => current.filter((d) => d.id !== id));
    setPlacements((current) => current.filter((p) => p.designId !== id));
    if (selected?.designId === id) setSelectedId(null);
    if (design) {
      releaseArt(design);
      releaseImage(design.image);
    }
  };

  const updatePlacement = useCallback(
    (placement: Placement) => {
      const design = designById.get(placement.designId);
      if (!design) return;
      const fixed = clampPlacement(placement, areas[placement.area], design.aspect);
      setPlacements((current) => current.map((p) => (p.id === fixed.id ? fixed : p)));
    },
    [areas, designById],
  );

  const patchSelected = (patch: Partial<Placement>) => {
    if (selected) updatePlacement({ ...selected, ...patch });
  };

  const moveSelectedTo = (area: PrintAreaId) => {
    if (!selected) return;
    const design = designById.get(selected.designId);
    if (!design) return;
    const moved = placeAt(defaultPlacement(selected.id, design.id, areas[area], design.aspect), design, areas[area]);
    setPlacements((current) => current.map((p) => (p.id === moved.id ? moved : p)));
    goTo(areas[area].view);
  };

  const alignSelected = () => {
    if (!selected) return;
    const design = designById.get(selected.designId);
    if (!design) return;
    const area = areas[selected.area];
    setPlacements((current) =>
      current.map((p) =>
        p.id === selected.id ? alignToCollar(p, area, design.aspect, collarY(spec, dims, area.id), guide.distanceCm) : p,
      ),
    );
  };

  const removeSelected = () => {
    if (!selected) return;
    setPlacements((current) => current.filter((p) => p.id !== selected.id));
    setSelectedId(null);
  };

  const dropHandlers = {
    onDragEnter: (event: React.DragEvent) => {
      if (!event.dataTransfer.types.includes("Files")) return;
      event.preventDefault();
      setDragDepth((depth) => depth + 1);
    },
    onDragOver: (event: React.DragEvent) => {
      if (event.dataTransfer.types.includes("Files")) event.preventDefault();
    },
    onDragLeave: () => setDragDepth((depth) => Math.max(0, depth - 1)),
    onDrop: (event: React.DragEvent) => {
      event.preventDefault();
      setDragDepth(0);
      void handleFiles([...event.dataTransfer.files]);
    },
  };

  const openPicker = () => fileInputRef.current?.click();
  const sizeInfo = spec.sizes[size];

  return (
    <div className="flex min-h-dvh flex-col lg:pl-60" {...dropHandlers}>
      <Header product="camisetas" subtitle={`${spec.short} · ${size}`} onHelp={() => setHelpOpen(true)} />
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          event.target.value = "";
          void handleFiles(files);
        }}
      />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-28 pt-4 sm:px-6 sm:pt-6 lg:pb-10">
        {tokenNotice && <TokenReminder notice={tokenNotice} />}
        {notice && (
          <div role="status" className="mb-4 flex animate-rise items-start gap-3 rounded-2xl border border-line bg-card p-3.5 pl-4">
            <span aria-hidden className="grid size-6 shrink-0 place-items-center rounded-full bg-process text-xs font-bold text-white">
              i
            </span>
            <p className="flex-1 pt-0.5 text-sm text-ink-soft">{notice}</p>
            <button type="button" onClick={() => setNotice(null)} className="text-sm font-medium underline underline-offset-4">
              Ok
            </button>
          </div>
        )}
        {error && (
          <div
            role="alert"
            className="mb-4 flex animate-rise items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-3.5 pl-4 text-red-900"
          >
            <span aria-hidden className="grid size-6 shrink-0 place-items-center rounded-full bg-red-600 text-xs font-bold text-white">
              ✕
            </span>
            <p className="flex-1 pt-0.5 text-sm">{error}</p>
            <button type="button" onClick={() => setError(null)} className="text-sm font-medium underline underline-offset-4">
              Fechar
            </button>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start lg:gap-6">
          {/* Palco 3D */}
          <section
            aria-label="Prova 3D"
            className="animate-rise overflow-hidden rounded-[22px] border border-line bg-card shadow-[0_20px_50px_-35px_rgb(22_24_29/0.45)] phone-tall:sticky phone-tall:top-2 phone-tall:z-[5] phone-tall:shadow-lg lg:sticky lg:top-[84px]"
          >
            <div className="flex items-center gap-2 border-b border-line-soft px-4 py-2">
              <div className="flex min-w-0 items-baseline gap-3">
                <span className={`shrink-0 whitespace-nowrap ${eyebrow}`}>Prova 3D</span>
                <span className="truncate font-mono text-xs tabular-nums text-muted max-sm:hidden">
                  {spec.name} · {size} · {sizeInfo.chestCm} × {sizeInfo.lengthCm} cm
                </span>
              </div>
              <span className="flex-1" />
              <button
                type="button"
                onClick={() => changePose(pose === "mannequin" ? "ghost" : "mannequin")}
                aria-pressed={pose === "mannequin"}
                title="Mostrar a peça vestida num manequim ou solta (manequim invisível)"
                className={`flex h-9 shrink-0 items-center gap-2 rounded-full border px-3 text-[13px] font-medium transition ${
                  pose === "mannequin" ? "border-ink bg-ink text-paper" : "border-line bg-card text-ink-soft hover:border-ink"
                }`}
              >
                <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
                  <circle cx="12" cy="5" r="2.6" />
                  <path d="M7 21v-7.5C7 10.5 9 9 12 9s5 1.5 5 4.5V21M9.5 21v-5M14.5 21v-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Manequim
              </button>
              {pose === "mannequin" && (
                <div role="group" aria-label="Corpo do manequim" className="flex shrink-0 rounded-full border border-line bg-paper p-0.5">
                  {(
                    [
                      ["male", "Masculino", "Masc."],
                      ["female", "Feminino", "Fem."],
                    ] as const
                  ).map(([value, label, short]) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={figure === value}
                      onClick={() => setFigure(value)}
                      className={`h-8 rounded-full px-3 text-[13px] font-medium transition ${
                        figure === value ? "bg-ink text-paper" : "text-muted hover:text-ink"
                      }`}
                    >
                      <span className="sm:hidden">{short}</span>
                      <span className="max-sm:hidden">{label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <GarmentStage
              spec={spec}
              size={size}
              pose={pose}
              color={color}
              trim={trim}
              guide={guide}
              designs={designs}
              placements={placements}
              selectedId={selectedId}
              view={view}
              onViewChange={goTo}
              onSelect={setSelectedId}
              onPlacementChange={updatePlacement}
              onReady={(viewer) => (viewerRef.current = viewer)}
            />
            <ColorPalette color={color} trim={trim} onColor={setColor} onTrim={setTrim} />
          </section>

          {/* Configurações */}
          <aside
            aria-label="Configurações da prova"
            className="flex animate-rise flex-col overflow-hidden rounded-[22px] border border-line bg-card shadow-[0_20px_50px_-35px_rgb(22_24_29/0.45)]"
            style={{ animationDelay: "80ms" }}
          >
            <div className="flex flex-col divide-y divide-line-soft">
              <Panel number="01" title="Peça" className="max-lg:order-3">
                <GarmentPicker value={garmentId} onChange={changeGarment} />
                <div className="mt-4">
                  <SegmentedControl<GarmentSize>
                    label="Tamanho"
                    value={size}
                    onChange={changeSize}
                    options={GARMENT_SIZES.map((s) => ({ value: s, label: s }))}
                  />
                  <p className="mt-2 text-xs text-muted">
                    Largura {sizeInfo.chestCm} cm × comprimento {sizeInfo.lengthCm} cm (referência; varia por fornecedor). A
                    estampa aparece na proporção real da peça.
                  </p>
                </div>
              </Panel>

              <Panel
                number="02"
                title="Desenhos"
                className="max-lg:order-1"
                aside={
                  designs.length > 0 && (
                    <span className="font-mono text-[11px] tabular-nums text-muted">
                      {designs.length}/{MAX_DESIGNS}
                    </span>
                  )
                }
              >
                <DesignList
                  designs={designs}
                  placements={placements}
                  selected={selected}
                  onAdd={openPicker}
                  areaIds={areaIds}
                  onApply={addPlacement}
                  onSelectPlacement={(id) => {
                    setSelectedId(id);
                    const p = placements.find((q) => q.id === id);
                    if (p) goTo(areas[p.area].view);
                  }}
                  onToggleWhite={toggleRemoveWhite}
                  onRemove={removeDesign}
                />
              </Panel>

              <Panel number="03" title="Posição e tamanho" className="max-lg:order-2">
                {selected && designById.get(selected.designId) ? (
                  <PlacementEditor
                    placement={selected}
                    design={designById.get(selected.designId)!}
                    areas={areas}
                    areaIds={areaIds}
                    collar={collarY(spec, dims, selected.area)}
                    guide={guide}
                    onGuideChange={setGuide}
                    onAlign={alignSelected}
                    onChange={patchSelected}
                    onMove={moveSelectedTo}
                    onRemove={removeSelected}
                  />
                ) : (
                  <p className="text-sm text-muted">
                    {placements.length
                      ? "Toque numa estampa (na peça ou na lista acima) para ajustar posição, tamanho e rotação."
                      : "Aplique um desenho em uma área da peça para ajustar aqui."}
                  </p>
                )}
              </Panel>
            </div>

            <div className="hidden bg-ink px-5 pb-5 pt-4 text-paper lg:block">
              <div className="mb-3 flex items-baseline justify-between">
                <span className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-paper/60">Prova</span>
                <span className="font-mono text-[11px] tabular-nums text-paper/60">
                  {placements.length} {placements.length === 1 ? "estampa" : "estampas"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setProofOpen(true)}
                disabled={!!busy}
                className="group h-12 w-full rounded-full bg-signal font-semibold text-ink shadow-[0_10px_24px_-10px_rgb(255_90_31/0.8)] transition hover:-translate-y-px hover:brightness-105 disabled:opacity-55"
              >
                Gerar prova para o cliente <span aria-hidden className="inline-block transition group-hover:translate-y-0.5">↓</span>
              </button>
              <p className="mt-3 text-center text-xs text-paper/60">Imagem PNG com as vistas, cores e medidas DTF</p>
            </div>
          </aside>
        </div>
      </main>

      <footer className="mx-auto w-full max-w-7xl px-4 pb-24 sm:px-6 lg:hidden">
        <p className="flex items-center gap-2 border-t border-line pt-4 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
          <RegMark className="size-3" /> W3M Studio · processamento 100% local
        </p>
      </footer>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-paper/90 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md lg:hidden">
        <button type="button" onClick={() => setProofOpen(true)} disabled={!!busy} className={`h-12 w-full text-base ${btn.primary}`}>
          Gerar prova <span aria-hidden className="text-signal">↓</span>
        </button>
      </div>

      <ProofModal
        open={proofOpen}
        onClose={() => setProofOpen(false)}
        viewer={viewerRef}
        spec={spec}
        size={size}
        pose={pose}
        color={color}
        trim={trim}
        designs={designById}
        placements={placements}
        areas={areas}
      />
      <GarmentHelp open={helpOpen} onClose={() => setHelpOpen(false)} />

      {busy && (
        <div className="fixed inset-0 z-50 grid animate-fade place-items-center bg-paper/70 backdrop-blur-sm" role="status" aria-live="assertive">
          <div className="flex animate-rise flex-col items-center gap-4 rounded-[22px] border border-line bg-card px-10 py-8 shadow-2xl shadow-ink/15">
            <span aria-hidden className="relative grid size-12 place-items-center">
              <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-line border-t-signal" />
              <RegMark className="size-5 text-ink" />
            </span>
            <p className="font-medium">{busy}</p>
          </div>
        </div>
      )}

      {dragDepth > 0 && (
        <div className="pointer-events-none fixed inset-0 z-40 grid animate-fade place-items-center bg-ink/25 p-6 backdrop-blur-[2px]">
          <div className="flex flex-col items-center gap-3 rounded-[28px] border-2 border-dashed border-ink bg-card/95 px-14 py-10 shadow-2xl">
            <RegMark className="size-8 text-signal" />
            <span className="font-display text-2xl font-semibold tracking-tight">Solte os desenhos aqui</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------ */

/** Silhuetas simples de cada peça para os cartões de escolha (viewBox 48 × 44). */
const TANK_WIDE = "M15 4h5c0 5 3 7 4 7s4-2 4-7h5c-1 6 1 9 4 11v25H11V15c3-2 5-5 4-11Z";
const TANK_NARROW = "M17 4h3c0 6 2 9 4 9s4-3 4-9h3c-2 7 0 11 6 13v23H11V17c6-2 8-6 6-13Z";
const SILHOUETTES: Record<GarmentId, string> = {
  camiseta: "M17 6 8 10l-4 9 6 3 3-5v19h22V17l3 5 6-3-4-9-9-4a7 7 0 0 1-14 0Z",
  "gola-v": "M17 6 8 10l-4 9 6 3 3-5v19h22V17l3 5 6-3-4-9-9-4-7 11Z",
  "baby-look": "M18 6 11 9l-4 7 5 3 2-3c1 4 0 8-2 12 0 5 2 8 2 8h20s2-3 2-8c-2-4-3-8-2-12l2 3 5-3-4-7-7-3a6 6 0 0 1-12 0Z",
  regata: TANK_WIDE,
  "regata-cavada": TANK_NARROW,
  "regata-machao": "M18 4h2c0 7 2 10 4 10s4-3 4-10h2c-2 8 1 13 7 15v21H11V19c6-2 9-7 7-15Z",
  "regata-nadador": "M17 4h3c0 6 2 9 4 9s4-3 4-9h3c-2 7 0 11 6 13v23H11V17c6-2 8-6 6-13Zm7 9v4",
  "regata-longline": "M17 2h3c0 6 2 9 4 9s4-3 4-9h3c-2 7 0 11 6 13v25c-4 2-8 3-13 3s-9-1-13-3V15c6-2 8-6 6-13Z",
  "regata-canelada": `${TANK_WIDE}M18 20v18M24 20v18M30 20v18`,
  "regata-oversized": "M13 4h6c0 5 3 7 5 7s5-2 5-7h6c-1 7 2 10 6 12v24H7V16c4-2 7-5 6-12Z",
  moletom: "M17 6 8 10 4 38h6l3-20v18l-1 4h24l-1-4V18l3 20h6l-4-28-9-4a7 7 0 0 1-14 0Z",
  "moletom-capuz":
    "M17 8 8 11 4 39h6l3-20v18l-1 4h24l-1-4V19l3 20h6l-4-28-9-3c1-5-3-6-7-6s-8 1-7 6Zm3 16h8l3 8H17Z",
};

function GarmentPicker({ value, onChange }: { value: GarmentId; onChange: (id: GarmentId) => void }) {
  const current = garmentSpec(value).category;
  // A aba começa na categoria da peça escolhida; a peça só muda por este seletor.
  const [category, setCategory] = useState<GarmentCategory>(current);
  const items = GARMENTS.filter((garment) => garment.category === category);
  return (
    <div>
      <SegmentedControl<GarmentCategory>
        label="Tipo de peça"
        hideLabel
        value={category}
        onChange={setCategory}
        options={GARMENT_CATEGORIES.map((c) => ({ value: c.id, label: c.label }))}
      />
      <fieldset className="mt-3">
        <legend className="sr-only">Modelo</legend>
        <div className="grid grid-cols-4 gap-1.5">
          {items.map((garment) => (
            <label
              key={garment.id}
              title={garment.name}
              className="group flex cursor-pointer flex-col items-center gap-1 rounded-xl border border-line bg-paper px-1 pb-1.5 pt-2 text-center transition hover:border-ink has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-paper has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-signal-ink"
            >
              <input
                type="radio"
                name="garment"
                value={garment.id}
                checked={value === garment.id}
                onChange={() => onChange(garment.id)}
                className="sr-only"
              />
              <svg viewBox="0 0 48 44" className="h-8 w-9" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
                <path d={SILHOUETTES[garment.id]} strokeLinejoin="round" />
              </svg>
              <span className="text-[11px] font-medium leading-tight">{garment.short}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

/** Paleta da malha, logo abaixo da peça: o cliente escolhe vendo a cor mudar no 3D. */
function ColorPalette({
  color,
  trim,
  onColor,
  onTrim,
}: {
  color: string;
  trim: string | null;
  onColor: (hex: string) => void;
  onTrim: (hex: string | null) => void;
}) {
  const [target, setTarget] = useState<"fabric" | "trim">("fabric");
  const value = target === "fabric" ? color : (trim ?? color);
  const onChange = target === "fabric" ? onColor : onTrim;
  const current = FABRIC_COLORS.find((c) => c.hex.toLowerCase() === value.toLowerCase());
  const tabClass = (active: boolean) =>
    `flex h-8 items-center gap-2 rounded-full px-3 text-[13px] font-medium transition ${active ? "bg-ink text-paper" : "text-muted hover:text-ink"}`;
  return (
    <fieldset className="min-w-0 border-t border-line-soft px-4 pb-4 pt-3 sm:px-5">
      <legend className="sr-only">{target === "fabric" ? "Cor da peça" : "Cor da gola e acabamento"}</legend>
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex rounded-full border border-line bg-paper p-0.5" role="group" aria-label="O que colorir">
          <button type="button" aria-pressed={target === "fabric"} onClick={() => setTarget("fabric")} className={tabClass(target === "fabric")}>
            <span aria-hidden className="size-3.5 rounded-full border border-ink/20" style={{ backgroundColor: color }} />
            Peça
          </button>
          <button type="button" aria-pressed={target === "trim"} onClick={() => setTarget("trim")} className={tabClass(target === "trim")}>
            <span aria-hidden className="size-3.5 rounded-full border-[3px] border-ink/20" style={{ borderColor: trim ?? color }} />
            Gola e acabamento
          </button>
        </div>
        <p className="flex min-w-0 items-baseline gap-2">
          <span className="truncate font-display text-[15px] font-semibold tracking-tight">
            {target === "trim" && !trim ? "Igual à peça" : (current?.name ?? "Personalizada")}
          </span>
          <span className="shrink-0 font-mono text-[11px] uppercase tabular-nums text-muted">{value}</span>
          {target === "trim" && trim && (
            <button type="button" onClick={() => onTrim(null)} className="shrink-0 text-xs font-medium text-muted underline underline-offset-2 hover:text-ink">
              Igual à peça
            </button>
          )}
        </p>
      </div>
      <div className="-mx-1 flex gap-x-5 gap-y-3 overflow-x-auto px-1 pb-1 [scrollbar-width:thin] sm:flex-wrap sm:overflow-visible">
        {FABRIC_GROUPS.map((group) => (
          <div key={group.name} className="shrink-0">
            <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{group.name}</p>
            <div className="flex gap-1.5">
              {group.colors.map((color) => (
                <label key={color.hex} title={color.name} className="relative cursor-pointer">
                  <input
                    type="radio"
                    name="fabric-color"
                    checked={(target === "fabric" || trim !== null) && color.hex.toLowerCase() === value.toLowerCase()}
                    onChange={() => onChange(color.hex)}
                    className="peer sr-only"
                  />
                  <span className="sr-only">{color.name}</span>
                  <span
                    aria-hidden
                    className="block size-8 rounded-full border border-ink/15 shadow-[inset_0_-3px_6px_rgb(0_0_0/0.12)] transition hover:scale-110 peer-checked:scale-110 peer-checked:ring-2 peer-checked:ring-ink peer-checked:ring-offset-2 peer-checked:ring-offset-card peer-focus-visible:ring-2 peer-focus-visible:ring-signal-ink peer-focus-visible:ring-offset-2"
                    style={{ backgroundColor: color.hex }}
                  />
                </label>
              ))}
            </div>
          </div>
        ))}
        <div className="shrink-0">
          <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">Outra</p>
          <label
            title="Escolher outra cor"
            className={`relative grid size-8 cursor-pointer place-items-center rounded-full border border-dashed border-ink/40 text-muted transition hover:scale-110 hover:border-ink hover:text-ink ${
              current ? "" : "scale-110 border-solid ring-2 ring-ink ring-offset-2 ring-offset-card"
            }`}
            style={current ? undefined : { backgroundColor: value }}
          >
            <input
              type="color"
              value={value}
              onChange={(event) => onChange(event.target.value)}
              className="absolute inset-0 cursor-pointer opacity-0"
              aria-label="Escolher outra cor"
            />
            {current && (
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
            )}
          </label>
        </div>
      </div>
    </fieldset>
  );
}

const AREA_SHORT: Record<PrintAreaId, string> = {
  front: "Frente",
  back: "Costas",
  chest: "Peito",
  "sleeve-left": "Manga E",
  "sleeve-right": "Manga D",
};

function DesignList({
  designs,
  placements,
  selected,
  areaIds,
  onAdd,
  onApply,
  onSelectPlacement,
  onToggleWhite,
  onRemove,
}: {
  designs: Design[];
  placements: Placement[];
  selected: Placement | null;
  areaIds: PrintAreaId[];
  onAdd: () => void;
  onApply: (design: Design, area: PrintAreaId) => void;
  onSelectPlacement: (id: string) => void;
  onToggleWhite: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  if (designs.length === 0) {
    return (
      <button
        type="button"
        onClick={onAdd}
        className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-line bg-paper px-4 py-7 text-center transition hover:border-ink"
      >
        <span aria-hidden className="grid size-11 place-items-center rounded-full bg-ink text-xl text-paper">
          +
        </span>
        <span className="font-display text-base font-semibold">Inserir desenhos</span>
        <span className="text-xs text-muted">PNG transparente (ideal para DTF), JPG ou WEBP · até {MAX_DESIGNS}</span>
      </button>
    );
  }
  return (
    <div className="space-y-3">
      <ul className="space-y-3">
        {designs.map((design) => {
          const uses = placements.filter((p) => p.designId === design.id);
          return (
            <li key={design.id} className="rounded-2xl border border-line bg-paper p-3">
              <div className="flex items-start gap-3">
                <DesignThumb design={design} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium" title={design.image.name}>
                    {design.image.name}
                  </p>
                  <p className="font-mono text-[11px] tabular-nums text-muted">
                    {design.image.width} × {design.image.height} px · {design.hasAlpha ? "transparente" : "com fundo"}
                  </p>
                  {!design.hasAlpha && (
                    <label className="mt-1.5 flex cursor-pointer items-center gap-2 text-[13px] text-ink-soft">
                      <input
                        type="checkbox"
                        checked={design.removeWhite}
                        onChange={() => onToggleWhite(design.id)}
                        className="size-4 accent-[#16181d]"
                      />
                      Remover fundo branco
                    </label>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(design.id)}
                  aria-label={`Remover ${design.image.name}`}
                  className="-mr-1 -mt-1 grid size-8 shrink-0 place-items-center rounded-full text-muted transition hover:bg-paper-deep hover:text-red-700"
                >
                  <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                    <path d="M5 7h14M10 7V5h4v2m-7 0 1 12h8l1-12" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>

              {uses.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1.5" aria-label="Estampas deste desenho">
                  {uses.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => onSelectPlacement(p.id)}
                      aria-pressed={selected?.id === p.id}
                      className={`h-8 rounded-full px-3 text-xs font-medium transition ${
                        selected?.id === p.id ? "bg-signal text-ink" : "bg-ink text-paper hover:bg-ink-soft"
                      }`}
                    >
                      {AREA_SHORT[p.area]} · {formatPrintSize(p.widthCm, design.aspect)}
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-2.5">
                <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-muted">Aplicar em</p>
                <div className="flex flex-wrap gap-1.5">
                  {areaIds.map((area) => (
                    <button
                      key={area}
                      type="button"
                      onClick={() => onApply(design, area)}
                      className="h-8 rounded-full border border-line bg-card px-2.5 text-xs font-medium text-ink-soft transition hover:border-ink hover:text-ink"
                    >
                      + {AREA_SHORT[area]}
                    </button>
                  ))}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {designs.length < MAX_DESIGNS && (
        <button type="button" onClick={onAdd} className={`h-10 w-full text-sm ${btn.secondary}`}>
          <span aria-hidden>+</span> Inserir outro desenho
        </button>
      )}
    </div>
  );
}

function DesignThumb({ design }: { design: Design }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !design.art.width) return;
    const scale = Math.min(canvas.width / design.art.width, canvas.height / design.art.height);
    const w = design.art.width * scale;
    const h = design.art.height * scale;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(design.art, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
  }, [design.art]);
  return <canvas ref={ref} width={128} height={128} className="checker size-16 shrink-0 rounded-lg border border-line" aria-hidden />;
}

function RangeRow({
  label,
  value,
  display,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  const fill = ((value - min) / (max - min || 1)) * 100;
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between text-[13px]">
        <span className="font-medium text-ink-soft">{label}</span>
        <span className="font-mono text-xs tabular-nums text-ink">{display}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="range h-6 w-full cursor-pointer"
        style={{ "--fill": `${fill}%` } as React.CSSProperties}
      />
    </label>
  );
}

const GUIDE_PRESETS = [
  { cm: 5, label: "5 cm" },
  { cm: COLLAR_GUIDE_CM, label: "4 dedos" },
  { cm: 10, label: "10 cm" },
];

function PlacementEditor({
  placement,
  design,
  areas,
  areaIds,
  collar,
  guide,
  onGuideChange,
  onAlign,
  onChange,
  onMove,
  onRemove,
}: {
  placement: Placement;
  design: Design;
  areas: ReturnType<typeof printAreas>;
  areaIds: PrintAreaId[];
  /** Altura da gola acima da área (cm). */
  collar: number;
  guide: GuideSettings;
  onGuideChange: (guide: GuideSettings) => void;
  onAlign: () => void;
  onChange: (patch: Partial<Placement>) => void;
  onMove: (area: PrintAreaId) => void;
  onRemove: () => void;
}) {
  const area = areas[placement.area];
  const maxWidth = Math.floor(maxWidthFor(area, design.aspect) * 2) / 2;
  const fromNeck = Math.max(0, distanceFromCollar(placement, area, design.aspect, collar));
  const format = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  const usesCollar = placement.area === "front" || placement.area === "back" || placement.area === "chest";
  const onGuide = guide.enabled && Math.abs(fromNeck - guide.distanceCm) < 0.15;
  const centered = placement.area === "chest" || Math.abs(placement.x) < 0.15;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 rounded-2xl bg-paper-deep/70 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-[13px] text-muted" title={design.image.name}>
            {AREA_LABELS[placement.area]} · {design.image.name}
          </p>
          <p className="font-display text-xl font-semibold tabular-nums tracking-tight">
            {formatPrintSize(placement.widthCm, design.aspect)}
          </p>
        </div>
        {usesCollar && (
          <p className={`shrink-0 text-right text-xs leading-tight ${onGuide ? "text-process" : "text-muted"}`}>
            Topo a<br />
            <span className={`font-mono text-sm ${onGuide ? "font-semibold text-process" : "text-ink"}`}>{format(fromNeck)} cm</span>
            <br />
            da gola{onGuide ? " ✓" : ""}
          </p>
        )}
      </div>

      {usesCollar && (
        <div className="rounded-2xl border border-line p-3.5">
          <div className="flex items-center justify-between gap-3">
            <label className="flex cursor-pointer items-center gap-2.5 text-[13px] font-medium text-ink-soft">
              <input
                type="checkbox"
                checked={guide.enabled}
                onChange={(event) => onGuideChange({ ...guide, enabled: event.target.checked })}
                className="size-4 accent-[#0089c2]"
              />
              <span aria-hidden className="h-0 w-4 border-t-2 border-dashed border-process" />
              Guia da gola
            </label>
            <span className="text-[11px] text-muted">só na tela · não sai na prova</span>
          </div>
          {guide.enabled && (
            <>
              <div className="mt-3 flex items-center gap-1.5" role="group" aria-label="Distância da guia até a gola">
                {GUIDE_PRESETS.map((preset) => (
                  <button
                    key={preset.cm}
                    type="button"
                    aria-pressed={guide.distanceCm === preset.cm}
                    onClick={() => onGuideChange({ ...guide, distanceCm: preset.cm })}
                    className={`h-8 flex-1 rounded-full border text-xs font-medium transition ${
                      guide.distanceCm === preset.cm ? "border-process bg-process text-white" : "border-line bg-card text-ink-soft hover:border-ink"
                    }`}
                  >
                    {preset.label}
                    {preset.cm === COLLAR_GUIDE_CM && <span className="opacity-75"> · {format(preset.cm)}</span>}
                  </button>
                ))}
                <label className="flex h-8 w-[4.5rem] shrink-0 items-center rounded-full border border-line bg-card pl-2.5 pr-2 text-xs focus-within:border-ink">
                  <span className="sr-only">Distância personalizada (cm)</span>
                  <input
                    type="number"
                    min={2}
                    max={20}
                    step={0.5}
                    value={guide.distanceCm}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      if (value >= 2 && value <= 20) onGuideChange({ ...guide, distanceCm: value });
                    }}
                    className="w-full bg-transparent tabular-nums outline-none"
                  />
                  cm
                </label>
              </div>
              <button
                type="button"
                onClick={onAlign}
                disabled={onGuide && centered}
                className={`mt-3 h-10 w-full text-sm ${btn.secondary}`}
              >
                {onGuide && centered ? "✓ Alinhada à guia" : "Alinhar à guia e centralizar"}
              </button>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                Ao arrastar, a estampa “gruda” na guia e no centro da peça.
              </p>
            </>
          )}
        </div>
      )}

      <RangeRow
        label="Largura"
        value={placement.widthCm}
        display={`${format(placement.widthCm)} cm`}
        min={MIN_PRINT_CM}
        max={maxWidth}
        step={0.5}
        onChange={(widthCm) => onChange({ widthCm })}
      />
      <RangeRow
        label="Rotação"
        value={placement.rotationDeg}
        display={`${placement.rotationDeg}°`}
        min={-180}
        max={180}
        step={1}
        onChange={(rotationDeg) => onChange({ rotationDeg: Math.abs(rotationDeg) < 3 ? 0 : rotationDeg })}
      />

      <label className="block text-[13px]">
        <span className="mb-1.5 block font-medium text-ink-soft">Área</span>
        <select
          value={placement.area}
          onChange={(event) => onMove(event.target.value as PrintAreaId)}
          className="h-11 w-full rounded-xl border border-line bg-paper px-3 text-sm font-medium text-ink outline-none focus-visible:border-ink"
        >
          {areaIds.map((id) => (
            <option key={id} value={id}>
              {AREA_LABELS[id]} (até {areas[id].maxWidthCm} × {areas[id].maxHeightCm} cm)
            </option>
          ))}
        </select>
      </label>

      <div className="flex gap-2">
        <button type="button" onClick={() => onChange({ x: 0, rotationDeg: 0 })} className={`h-10 flex-1 text-sm ${btn.secondary}`}>
          <span aria-hidden>⌖</span> Centralizar
        </button>
        <button
          type="button"
          onClick={onRemove}
          className={`h-10 flex-1 text-sm ${btn.secondary} hover:!border-red-700 hover:!text-red-700`}
        >
          Remover estampa
        </button>
      </div>
    </div>
  );
}

function GarmentHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Prova 3D de camisetas">
      <div className="space-y-4 text-sm leading-relaxed text-ink-soft [&_strong]:font-semibold [&_strong]:text-ink">
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            Escolha a <strong>peça</strong> (camisetas, regatas ou moletons), o <strong>tamanho</strong> e a{" "}
            <strong>cor</strong>. Em <em>Gola e acabamento</em> a gola, os punhos e os debruns ganham outra cor.
          </li>
          <li>
            <strong>Insira os desenhos</strong> (até {MAX_DESIGNS}). PNG transparente é o ideal para DTF; em JPG ou PNG com
            fundo, a opção <em>Remover fundo branco</em> apaga só o branco que encosta nas bordas.
          </li>
          <li>
            Use <strong>Aplicar em</strong> para colocar o desenho na frente, costas, peito ou mangas. Frente, costas e peito
            já entram com o topo a <strong>4 dedos (7,5 cm) da gola</strong>, centralizados.
          </li>
          <li>
            <strong>Arraste a estampa</strong> na peça: ela “gruda” na guia da gola e no centro. A guia (linha azul) é só de
            tela e nunca sai na prova.
          </li>
          <li>
            <strong>Gere a prova</strong>: vistas, cor, tamanho e, para cada estampa, a medida e a distância da gola.
          </li>
        </ol>
        <p className="rounded-2xl border border-line bg-paper p-4">
          Referência de mercado: topo da estampa da frente a 5–10 cm da gola; costas a 7,5–10 cm; escudo no peito com ~9 cm
          de largura. A peça 3D é uma simulação: caimento e tom da malha variam por fornecedor e tela.
        </p>
        <p className="text-muted">Seus desenhos são processados no navegador e não são enviados nem armazenados.</p>
      </div>
    </Modal>
  );
}
