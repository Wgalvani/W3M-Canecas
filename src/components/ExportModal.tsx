"use client";

import { useEffect, useRef, useState } from "react";
import { A4_ART_GAP_MM, A4_BORDERLESS, CROP_MARKS } from "@/lib/constants";
import { renderSheet } from "@/lib/imageProcessor";
import { formatCm, formatPresetSize, mmToPx, targetPixels } from "@/lib/measurements";
import { a4Counts, a4Sheet, singleSheet } from "@/lib/sheetLayout";
import type { ExportKind, Framing, LoadedImage, ProductPreset } from "@/types/image";
import { Modal } from "./Modal";
import { PrintNotice } from "./PrintNotice";
import { SegmentedControl } from "./SegmentedControl";
import { btn } from "./ui";

const formatMm = (mm: number) => mm.toLocaleString("pt-BR");

interface ExportModalProps {
  open: boolean;
  kind: ExportKind;
  onKindChange: (kind: ExportKind) => void;
  image: LoadedImage;
  preset: ProductPreset;
  framing: Framing;
  mirror: boolean;
  busy: boolean;
  onClose: () => void;
  onExport: (kind: ExportKind, a4Count: number) => void;
}

export function ExportModal({
  open,
  kind,
  onKindChange,
  image,
  preset,
  framing,
  mirror,
  busy,
  onClose,
  onExport,
}: ExportModalProps) {
  const [a4Choice, setA4Choice] = useState<"1" | "2" | "3">("1");
  const counts = a4Counts(preset);
  // A escolha é preservada; só a quantidade usada respeita o que cabe no tamanho atual.
  const a4Count = counts.includes(Number(a4Choice)) ? a4Choice : "1";
  const pixels = targetPixels(preset);
  const sizeLabel = formatPresetSize(preset);
  const margin = mmToPx(CROP_MARKS.sheetMarginMm, preset.ppi);
  const sheet = singleSheet(preset);
  const sheetLabel = `${formatCm(sheet.widthMm)} × ${formatCm(sheet.heightMm)} cm`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Gerar arquivo"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className={`h-12 flex-1 ${btn.secondary}`}
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onExport(kind, Number(a4Count))}
            className={`h-12 flex-[2] ${btn.primary}`}
          >
            {busy ? "Gerando…" : kind === "png" ? "Baixar PNG" : "Baixar PDF"}
            {!busy && <span aria-hidden className="text-signal">↓</span>}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <SegmentedControl<ExportKind>
          label="Formato"
          value={kind}
          onChange={onKindChange}
          options={[
            { value: "png" as const, label: "PNG", description: "Imagem" },
            { value: "pdf-single" as const, label: "PDF", description: "Uma arte" },
            ...(counts.length > 0 ? [{ value: "pdf-a4" as const, label: "PDF A4", description: "Folha" }] : []),
          ]}
        />

        {counts.length === 0 && (
          <p className="text-xs text-muted">
            PDF A4 indisponível: {sizeLabel} não cabe na folha com as marcas de corte.
          </p>
        )}

        {kind === "pdf-a4" && counts.length >= 2 && (
          <SegmentedControl
            label="Quantidade na A4"
            value={a4Count}
            onChange={setA4Choice}
            options={[
              { value: "1" as const, label: "1 arte", description: "Deitada" },
              ...(counts.includes(2) ? [{ value: "2" as const, label: "2 artes", description: "Deitada" }] : []),
              ...(counts.includes(A4_BORDERLESS.count)
                ? [{ value: "3" as const, label: "3 artes", description: "Em pé, sem margem" }]
                : []),
            ]}
          />
        )}

        {open && (
          <OutputPreview
            a4Count={kind === "pdf-a4" ? Number(a4Count) : 0}
            image={image}
            preset={preset}
            framing={framing}
            mirror={mirror}
          />
        )}

        <p className="text-sm leading-relaxed text-muted">
          {kind === "png" &&
            `Arte de ${pixels.width} × ${pixels.height} px (${sizeLabel} a ${preset.ppi} PPI) com marcas de corte; imagem total de ${pixels.width + 2 * margin} × ${pixels.height + 2 * margin} px.`}
          {kind === "pdf-single" && `Arte de ${sizeLabel} com marcas de corte, em página de ${sheetLabel}.`}
          {kind === "pdf-a4" &&
            a4Count !== "3" &&
            `A4 paisagem com ${a4Count === "1" ? `1 arte de ${sizeLabel}` : `2 artes de ${sizeLabel}, separadas por ${A4_ART_GAP_MM} mm,`} e marcas de corte. A distância entre as marcas confere a escala.`}
          {kind === "pdf-a4" && a4Count === "3" && (
            <>
              A4 em pé com 3 artes de {sizeLabel}, separadas por {formatMm(A4_BORDERLESS.gapMm)} mm. Corte sobre as
              linhas-guia.{" "}
              <strong className="font-semibold text-ink">
                Ative a impressão sem margem (borderless) na impressora
              </strong>
              ; sem ela, a impressora corta as laterais da arte.
            </>
          )}
        </p>

        <PrintNotice compact />
      </div>
    </Modal>
  );
}

/** Miniatura do arquivo que será gerado, com as marcas de corte. `a4Count = 0` mostra a arte avulsa. */
function OutputPreview({
  a4Count,
  image,
  preset,
  framing,
  mirror,
}: {
  a4Count: number;
  image: LoadedImage;
  preset: ProductPreset;
  framing: Framing;
  mirror: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isA4 = a4Count > 0;
  const portrait = isA4 && a4Sheet(preset, a4Count).guide === "cut-lines";

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const layout = isA4 ? a4Sheet(preset, a4Count) : singleSheet(preset);
    const pxPerMm = (isA4 ? 560 : 840) / layout.widthMm;
    canvas.width = Math.round(layout.widthMm * pxPerMm);
    canvas.height = Math.round(layout.heightMm * pxPerMm);
    renderSheet(ctx, image.preview, image, preset, framing, layout, pxPerMm, { mirror });
  }, [image, preset, framing, mirror, isA4, a4Count]);

  const caption = mirror ? "arquivo final (espelhado)" : "arquivo final (sem espelhamento)";
  return (
    <figure className="pasteboard flex flex-col items-center rounded-2xl border border-line px-4 py-6">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`Prévia do ${caption}, com marcas de corte`}
        className={`rounded-[2px] bg-white shadow-[0_0_0_1px_rgb(22_24_29/0.12),0_18px_30px_-16px_rgb(22_24_29/0.45)] ${isA4 ? (portrait ? "w-52" : "w-72") : "h-auto max-h-[45vh] w-auto max-w-full"}`}
      />
      <figcaption className="mt-3 text-center font-mono text-[11px] uppercase tracking-wider text-muted">
        {isA4 ? `Folha A4 ${portrait ? "em pé" : "paisagem"} · ` : "Prévia do "}
        {caption}
      </figcaption>
    </figure>
  );
}
