"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadSavedPreset, savePreset } from "@/lib/artSize";
import { DEFAULT_PRESET, EXPORT_FILENAMES } from "@/lib/constants";
import { errorMessage } from "@/lib/errors";
import { clampFraming, initialFraming, zoomAround } from "@/lib/framing";
import { assessQuality } from "@/lib/imageQuality";
import { downloadBlob, loadImage, releaseImage, renderArtPng, renderPrintPng } from "@/lib/imageProcessor";
import { formatAspectRatio, formatFileSize, formatPresetSize, targetPixels } from "@/lib/measurements";
import { generateA4Pdf, generateArtPdf } from "@/lib/pdfGenerator";
import { a4Capacity } from "@/lib/sheetLayout";
import { createTestPatternFile } from "@/lib/testPattern";
import type { TokenNotice } from "@/lib/auth/tokenNotice";
import type { ExportKind, FitMode, Framing, LoadedImage, ProductPreset } from "@/types/image";
import { ExportModal } from "./ExportModal";
import { Header, RegMark, type Step } from "./Header";
import { HelpDialog } from "./HelpDialog";
import { FilePickerButton, ImageUploader } from "./ImageUploader";
import { ImageQuality } from "./ImageQuality";
import { MirrorBadge, MirrorToggle } from "./MirrorToggle";
import { Mug3DDialog } from "./Mug3DDialog";
import { MugEditor } from "./MugEditor";
import { PrintNotice } from "./PrintNotice";
import { SegmentedControl } from "./SegmentedControl";
import { SizeControl } from "./SizeControl";
import { btn, eyebrow } from "./ui";
import { TokenReminder } from "./TokenReminder";
import { ZoomControl } from "./ZoomControl";

/** Deixa o navegador pintar o indicador de carregamento antes de um trabalho pesado. */
const nextPaint = () => new Promise<void>((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));

export function MugPreparer({ tokenNotice }: { tokenNotice?: TokenNotice | null }) {
  const [preset, setPreset] = useState<ProductPreset>(DEFAULT_PRESET);
  const [image, setImage] = useState<LoadedImage | null>(null);
  const [framing, setFraming] = useState<Framing>(() => initialFraming());
  const [mirror, setMirror] = useState(true);
  const [mirroredView, setMirroredView] = useState(false);
  const [showSafeArea, setShowSafeArea] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exported, setExported] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportKind, setExportKind] = useState<ExportKind>("pdf-single");
  const [helpOpen, setHelpOpen] = useState(false);
  const [view3dOpen, setView3dOpen] = useState(false);
  const [dragDepth, setDragDepth] = useState(0);

  // Libera a imagem anterior (memória e object URL) ao trocar ou sair da página.
  const imageRef = useRef<LoadedImage | null>(null);
  useEffect(() => () => {
    if (imageRef.current) releaseImage(imageRef.current);
  }, []);

  // O tamanho salvo só existe no navegador; lido após montar para não divergir do HTML do servidor.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- leitura única de um valor externo (localStorage)
    setPreset(loadSavedPreset());
  }, []);

  const changePreset = (next: ProductPreset) => {
    setPreset(next);
    savePreset(next);
    // Zoom e deslocamento ficam em mm: só precisam voltar aos limites do novo tamanho.
    if (image) setFraming((current) => clampFraming(image, next, current));
    if (exportKind === "pdf-a4" && a4Capacity(next) === 0) setExportKind("pdf-single");
    setExported(null);
  };

  const updateFraming = useCallback(
    (update: (framing: Framing) => Framing) => {
      if (!image) return;
      setFraming((current) => clampFraming(image, preset, update(current)));
    },
    [image, preset],
  );

  const handleFile = async (file: File) => {
    setError(null);
    setExported(null);
    setBusy("Preparando sua arte…");
    await nextPaint();
    try {
      const loaded = await loadImage(file);
      if (imageRef.current) releaseImage(imageRef.current);
      imageRef.current = loaded;
      setImage(loaded);
      setFraming(initialFraming("fill"));
      setMirroredView(false);
    } catch (err) {
      setError(errorMessage(err, "corrupt"));
    } finally {
      setBusy(null);
    }
  };

  const handleTestPattern = async () => {
    try {
      await handleFile(await createTestPatternFile(preset));
    } catch (err) {
      setError(errorMessage(err, "out-of-memory"));
    }
  };

  const handleExport = async (kind: ExportKind, a4Count = 1) => {
    if (!image) return;
    setError(null);
    setBusy("Gerando arquivo…");
    await nextPaint();
    try {
      if (kind === "png") {
        const png = await renderPrintPng(image, preset, framing, mirror);
        downloadBlob(new Blob([png as BlobPart], { type: "image/png" }), EXPORT_FILENAMES.png);
      } else {
        // No PDF a arte entra sem margem; as marcas de corte são desenhadas em vetor.
        const png = await renderArtPng(image, preset, framing, mirror);
        const pdf = kind === "pdf-a4" ? await generateA4Pdf(png, preset, a4Count) : await generateArtPdf(png, preset);
        downloadBlob(new Blob([pdf as BlobPart], { type: "application/pdf" }), EXPORT_FILENAMES[kind]);
      }
      setExported(EXPORT_FILENAMES[kind]);
      setExportOpen(false);
    } catch (err) {
      setError(errorMessage(err, "export-failed"));
    } finally {
      setBusy(null);
    }
  };

  const openExport = (kind: ExportKind) => {
    setExportKind(kind);
    setExportOpen(true);
  };

  const setMode = (mode: FitMode) => setFraming(initialFraming(mode));
  const resetFraming = () => setFraming((f) => initialFraming(f.mode));

  // Arrastar e soltar em qualquer lugar da página (com ou sem imagem carregada).
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
      const file = event.dataTransfer.files[0];
      if (file) void handleFile(file);
    },
  };

  const quality = image ? assessQuality(image, preset, framing) : null;
  const sizeLabel = formatPresetSize(preset);
  const pixels = targetPixels(preset);

  const step: Step = !image ? 1 : exported ? 3 : 2;

  return (
    <div className="flex min-h-dvh flex-col" {...dropHandlers}>
      <Header preset={preset} step={step} onHelp={() => setHelpOpen(true)} />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-28 pt-4 sm:px-6 sm:pt-6 lg:pb-10">
        {tokenNotice && <TokenReminder notice={tokenNotice} />}
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

        {!image ? (
          <ImageUploader preset={preset} onFile={handleFile} onTestPattern={handleTestPattern} />
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-6">
            {/* Preview */}
            {/* No celular em pé a prévia fica fixa no topo: o cliente vê a arte enquanto ajusta os controles. */}
            <section
              aria-label="Preview"
              className="animate-rise overflow-hidden rounded-[22px] border border-line bg-card shadow-[0_20px_50px_-35px_rgb(22_24_29/0.45)] phone-tall:sticky phone-tall:top-2 phone-tall:z-[5] phone-tall:shadow-lg phone-tall:[--editor-max-height:34dvh] lg:sticky lg:top-[84px]"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft px-3 py-2.5 sm:px-4">
                <div className="flex min-w-0 items-center gap-3 max-sm:hidden">
                  <span className={eyebrow}>Prancheta</span>
                  <MirrorBadge mirror={mirror} />
                </div>
                <div className="flex items-center gap-2 max-sm:w-full">
                  {mirror && (
                    <div className="flex-1 sm:w-56 sm:flex-none">
                      <SegmentedControl
                        label="Visualização"
                        hideLabel
                        value={mirroredView ? "mirrored" : "original"}
                        onChange={(value) => setMirroredView(value === "mirrored")}
                        options={[
                          { value: "original", label: "Original" },
                          { value: "mirrored", label: "Espelhado" },
                        ]}
                      />
                    </div>
                  )}
                  {/* O 3D só é carregado e renderizado quando o cliente pede. */}
                  <button
                    type="button"
                    onClick={() => setView3dOpen(true)}
                    className={`h-11 shrink-0 px-4 text-sm max-sm:ml-auto ${btn.secondary}`}
                  >
                    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                      <path d="M12 3 4 7.5v9L12 21l8-4.5v-9L12 3Z" strokeLinejoin="round" />
                      <path d="M4 7.5 12 12l8-4.5M12 12v9" strokeLinejoin="round" />
                    </svg>
                    Ver em 3D
                  </button>
                </div>
              </div>

              <div className="pasteboard px-2 py-2.5 sm:px-10 sm:py-10">
                <MugEditor
                  image={image}
                  preset={preset}
                  framing={framing}
                  onFramingChange={updateFraming}
                  mirroredView={mirror && mirroredView}
                  showSafeArea={showSafeArea}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line-soft px-3 py-1.5 text-sm sm:px-4">
                {/* No celular o tamanho já aparece no cabeçalho; o selo de espelhamento ocupa o lugar. */}
                <span className="font-mono text-xs tabular-nums text-muted max-sm:hidden">
                  {sizeLabel} · {preset.ppi} PPI · {pixels.width} × {pixels.height} px
                </span>
                <span className="sm:hidden">
                  <MirrorBadge mirror={mirror} compact />
                </span>
                <label className="flex min-h-10 cursor-pointer items-center gap-2 text-[13px] text-ink-soft">
                  <input
                    type="checkbox"
                    checked={showSafeArea}
                    onChange={(event) => setShowSafeArea(event.target.checked)}
                    className="size-4 accent-[#0089c2]"
                  />
                  <span aria-hidden className="h-0 w-4 border-t border-dashed border-process" />
                  Área segura ({preset.safeMarginMm} mm)
                </label>
              </div>
            </section>

            {/* Configurações */}
            {/* No celular os controles seguem a ordem de uso (zoom e enquadramento primeiro). */}
            <aside
              aria-label="Configurações"
              className="flex animate-rise flex-col overflow-hidden rounded-[22px] border border-line bg-card shadow-[0_20px_50px_-35px_rgb(22_24_29/0.45)]"
              style={{ animationDelay: "80ms" }}
            >
              <div className="flex flex-col divide-y divide-line-soft">
                <Panel number="01" title="Imagem" className="max-lg:order-4">
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden
                      className="grid size-10 shrink-0 place-items-center rounded-lg bg-paper-deep font-mono text-[10px] font-medium uppercase text-ink-soft"
                    >
                      {image.name.split(".").pop()?.slice(0, 4)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium" title={image.name}>
                        {image.name}
                      </p>
                      <dl className="flex flex-wrap gap-x-1.5 font-mono text-xs tabular-nums text-muted">
                        <dt className="sr-only">Resolução</dt>
                        <dd>
                          {image.width} × {image.height} px
                        </dd>
                        <dt className="sr-only">Proporção</dt>
                        <dd aria-hidden>·</dd>
                        <dd>{formatAspectRatio(image.width, image.height)}</dd>
                        <dt className="sr-only">Tamanho</dt>
                        <dd aria-hidden>·</dd>
                        <dd>{formatFileSize(image.sizeBytes)}</dd>
                      </dl>
                    </div>
                  </div>
                  <h3 className="mb-2 mt-4 text-[13px] font-medium text-ink-soft">Qualidade para {sizeLabel}</h3>
                  {quality && <ImageQuality quality={quality} sizeLabel={sizeLabel} />}
                </Panel>

                <Panel number="02" title="Enquadramento" className="max-lg:order-1">
                  <div className="space-y-5">
                    <ZoomControl zoom={framing.zoom} onChange={(zoom) => updateFraming((f) => zoomAround(f, zoom))} />
                    <SegmentedControl<FitMode>
                      label="Modo"
                      value={framing.mode}
                      onChange={setMode}
                      options={[
                        { value: "fill", label: "Preencher", description: "Cobre toda a área" },
                        { value: "fit", label: "Encaixar", description: "Imagem inteira" },
                      ]}
                    />
                    <div className="flex gap-2">
                      <button type="button" onClick={resetFraming} className={`h-10 flex-1 text-sm ${btn.secondary}`}>
                        <span aria-hidden>↻</span>Redefinir
                      </button>
                      <FilePickerButton onFile={handleFile} className={`h-10 flex-1 text-sm ${btn.secondary}`}>
                        Trocar imagem
                      </FilePickerButton>
                    </div>
                  </div>
                </Panel>

                <Panel number="03" title="Medidas" className="max-lg:order-3">
                  <SizeControl preset={preset} onChange={changePreset} />
                </Panel>

                <Panel number="04" title="Sublimação" className="max-lg:order-5">
                  <MirrorToggle mirror={mirror} onChange={setMirror} />
                </Panel>

                {exported && (
                  <div role="status" className="animate-rise space-y-2.5 bg-emerald-50/60 px-5 py-4 max-lg:order-7">
                    <p className="flex items-center gap-2 text-sm font-medium text-emerald-900">
                      <span aria-hidden className="grid size-5 place-items-center rounded-full bg-emerald-600 text-[11px] text-white">
                        ✓
                      </span>
                      {exported} gerado.
                    </p>
                    <PrintNotice compact />
                  </div>
                )}
              </div>

              {/* Saída: bloco escuro, como a "chapa" pronta para a impressora. */}
              <div className="hidden bg-ink px-5 pb-5 pt-4 text-paper lg:block">
                <div className="mb-3 flex items-baseline justify-between">
                  <span className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-paper/60">Exportar</span>
                  <span className="font-mono text-[11px] tabular-nums text-paper/60">
                    {pixels.width} × {pixels.height} px
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleExport("png")}
                    disabled={!!busy}
                    className="h-12 flex-1 rounded-full border border-paper/25 font-medium text-paper transition hover:border-paper hover:bg-paper/5 disabled:opacity-55"
                  >
                    Gerar PNG
                  </button>
                  <button
                    type="button"
                    onClick={() => openExport("pdf-single")}
                    disabled={!!busy}
                    className="group h-12 flex-[1.4] rounded-full bg-signal font-semibold text-ink shadow-[0_10px_24px_-10px_rgb(255_90_31/0.8)] transition hover:-translate-y-px hover:brightness-105 disabled:opacity-55"
                  >
                    Gerar PDF <span aria-hidden className="inline-block transition group-hover:translate-y-0.5">↓</span>
                  </button>
                </div>
                <p className="mt-3 text-center text-xs text-paper/60">Com marcas de corte, pronto para imprimir</p>
              </div>
            </aside>
          </div>
        )}
      </main>

      <footer className="mx-auto w-full max-w-7xl px-4 pb-24 sm:px-6 lg:pb-6">
        <p className="flex items-center gap-2 border-t border-line pt-4 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
          <RegMark className="size-3" /> W3M Canecas · processamento 100% local
        </p>
      </footer>

      {image && (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-paper/90 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md lg:hidden">
          <button
            type="button"
            onClick={() => openExport("png")}
            disabled={!!busy}
            className={`h-12 w-full text-base ${btn.primary}`}
          >
            Gerar arquivo <span aria-hidden className="text-signal">↓</span>
          </button>
        </div>
      )}

      {image && (
        <ExportModal
          open={exportOpen}
          kind={exportKind}
          onKindChange={setExportKind}
          image={image}
          preset={preset}
          framing={framing}
          mirror={mirror}
          busy={!!busy}
          onClose={() => setExportOpen(false)}
          onExport={handleExport}
        />
      )}
      {image && (
        <Mug3DDialog open={view3dOpen} onClose={() => setView3dOpen(false)} image={image} preset={preset} framing={framing} />
      )}
      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} preset={preset} onTestPattern={handleTestPattern} />

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
            <span className="font-display text-2xl font-semibold tracking-tight">Solte a imagem aqui</span>
          </div>
        </div>
      )}
    </div>
  );
}

/** Seção do painel de propriedades, numerada como uma ficha técnica. */
function Panel({
  number,
  title,
  className = "",
  children,
}: {
  number: string;
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`px-5 py-5 ${className}`}>
      <h2 className="mb-4 flex items-center gap-2.5">
        <span className="font-mono text-[11px] text-signal-ink">{number}</span>
        <span className="font-display text-[15px] font-semibold tracking-tight">{title}</span>
        <span aria-hidden className="h-px flex-1 bg-line-soft" />
      </h2>
      {children}
    </section>
  );
}
