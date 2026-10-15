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
import type { ExportKind, FitMode, Framing, LoadedImage, ProductPreset } from "@/types/image";
import { ExportModal } from "./ExportModal";
import { Header } from "./Header";
import { HelpDialog } from "./HelpDialog";
import { FilePickerButton, ImageUploader } from "./ImageUploader";
import { ImageQuality } from "./ImageQuality";
import { MirrorBadge, MirrorToggle } from "./MirrorToggle";
import { Mug3DDialog } from "./Mug3DDialog";
import { MugEditor } from "./MugEditor";
import { PrintNotice } from "./PrintNotice";
import { SegmentedControl } from "./SegmentedControl";
import { SizeControl } from "./SizeControl";
import { ZoomControl } from "./ZoomControl";

/** Deixa o navegador pintar o indicador de carregamento antes de um trabalho pesado. */
const nextPaint = () => new Promise<void>((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));

export function MugPreparer() {
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

  return (
    <div className="flex min-h-dvh flex-col" {...dropHandlers}>
      <Header preset={preset} onHelp={() => setHelpOpen(true)} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-4 lg:pb-8">
        {error && (
          <div role="alert" className="mb-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-red-900">
            <span aria-hidden className="font-bold">✕</span>
            <p className="flex-1">{error}</p>
            <button type="button" onClick={() => setError(null)} className="text-sm font-medium underline">
              Fechar
            </button>
          </div>
        )}

        {!image ? (
          <ImageUploader preset={preset} onFile={handleFile} onTestPattern={handleTestPattern} />
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
            {/* Preview */}
            {/* No celular em pé a prévia fica fixa no topo: o cliente vê a arte enquanto ajusta os controles. */}
            <section
              aria-label="Preview"
              className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200 sm:p-5 phone-tall:sticky phone-tall:top-2 phone-tall:z-[5] phone-tall:shadow-md phone-tall:[--editor-max-height:34dvh]"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <span className="max-sm:hidden">
                  <MirrorBadge mirror={mirror} />
                </span>
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
                    className="h-11 shrink-0 rounded-full border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 max-sm:ml-auto"
                  >
                    Ver em 3D
                  </button>
                </div>
              </div>

              <div className="rounded-xl bg-[repeating-conic-gradient(#f1f5f9_0_25%,#f8fafc_0_50%)] bg-[length:16px_16px] p-1.5 sm:p-6">
                <MugEditor
                  image={image}
                  preset={preset}
                  framing={framing}
                  onFramingChange={updateFraming}
                  mirroredView={mirror && mirroredView}
                  showSafeArea={showSafeArea}
                />
              </div>

              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500 sm:mt-3">
                {/* No celular o tamanho já aparece no cabeçalho; o selo de espelhamento ocupa o lugar. */}
                <span className="max-sm:hidden">
                  {sizeLabel} • {preset.ppi} PPI
                </span>
                <span className="sm:hidden">
                  <MirrorBadge mirror={mirror} compact />
                </span>
                <label className="flex min-h-10 cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={showSafeArea}
                    onChange={(event) => setShowSafeArea(event.target.checked)}
                    className="size-4 accent-sky-600"
                  />
                  Área segura ({preset.safeMarginMm} mm)
                </label>
              </div>
            </section>

            {/* Configurações */}
            {/* No celular os controles seguem a ordem de uso (zoom e enquadramento primeiro). */}
            <section aria-label="Configurações" className="flex flex-col gap-5 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5">
              <div className="max-lg:order-4">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Imagem</h2>
                <p className="mt-1 truncate font-medium" title={image.name}>
                  {image.name}
                </p>
                <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 text-sm text-slate-600">
                  <dt>Resolução</dt>
                  <dd className="tabular-nums">
                    {image.width} × {image.height} px
                  </dd>
                  <dt>Proporção</dt>
                  <dd>{formatAspectRatio(image.width, image.height)}</dd>
                  <dt>Tamanho</dt>
                  <dd>{formatFileSize(image.sizeBytes)}</dd>
                </dl>
                <h3 className="mb-1.5 mt-3 text-sm font-medium text-slate-700">Qualidade para {sizeLabel}</h3>
                {quality && <ImageQuality quality={quality} sizeLabel={sizeLabel} />}
              </div>

              <div className="max-lg:order-3">
                <SizeControl preset={preset} onChange={changePreset} />
              </div>

              <div className="max-lg:order-2">
                <SegmentedControl<FitMode>
                  label="Enquadramento"
                  value={framing.mode}
                  onChange={setMode}
                  options={[
                    { value: "fill", label: "Preencher", description: "Cobre toda a área" },
                    { value: "fit", label: "Encaixar", description: "Imagem inteira" },
                  ]}
                />
              </div>

              <div className="max-lg:order-1">
                <ZoomControl zoom={framing.zoom} onChange={(zoom) => updateFraming((f) => zoomAround(f, zoom))} />
              </div>

              <div className="max-lg:order-5">
                <MirrorToggle mirror={mirror} onChange={setMirror} />
              </div>

              <div className="flex gap-2 max-lg:order-6">
                <button
                  type="button"
                  onClick={resetFraming}
                  className="h-11 flex-1 rounded-full border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <span aria-hidden>↻ </span>Redefinir
                </button>
                <FilePickerButton
                  onFile={handleFile}
                  className="h-11 flex-1 rounded-full border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Trocar imagem
                </FilePickerButton>
              </div>

              <div className="hidden gap-2 lg:flex">
                <button
                  type="button"
                  onClick={() => handleExport("png")}
                  disabled={!!busy}
                  className="h-12 flex-1 rounded-full border-2 border-blue-600 font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-60"
                >
                  Gerar PNG
                </button>
                <button
                  type="button"
                  onClick={() => openExport("pdf-single")}
                  disabled={!!busy}
                  className="h-12 flex-1 rounded-full bg-blue-600 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  Gerar PDF
                </button>
              </div>
              <p className="hidden text-center text-xs text-slate-500 lg:block">
                Arte de {pixels.width} × {pixels.height} px · com marcas de corte
              </p>

              {exported && (
                <div role="status" className="space-y-2 max-lg:order-7">
                  <p className="text-sm font-medium text-emerald-800">
                    <span aria-hidden>✓ </span>
                    {exported} gerado.
                  </p>
                  <PrintNotice compact />
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      {image && (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:hidden">
          <button
            type="button"
            onClick={() => openExport("png")}
            disabled={!!busy}
            className="h-12 w-full rounded-full bg-blue-600 text-base font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
          >
            Gerar arquivo
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
        <div className="fixed inset-0 z-50 grid place-items-center bg-white/70 backdrop-blur-sm" role="status" aria-live="assertive">
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-white px-8 py-6 shadow-lg ring-1 ring-slate-200">
            <span aria-hidden className="size-9 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />
            <p className="font-medium">{busy}</p>
          </div>
        </div>
      )}

      {dragDepth > 0 && (
        <div className="pointer-events-none fixed inset-0 z-40 grid place-items-center bg-blue-600/10 p-6">
          <div className="rounded-3xl border-4 border-dashed border-blue-600 bg-white/90 px-10 py-8 text-xl font-semibold text-blue-700">
            Solte a imagem aqui
          </div>
        </div>
      )}
    </div>
  );
}
