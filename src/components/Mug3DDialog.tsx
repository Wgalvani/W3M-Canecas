"use client";

import { useEffect, useRef, useState } from "react";
import { renderArt } from "@/lib/imageProcessor";
import { mugShape } from "@/lib/mugShape";
import type { Framing, LoadedImage, ProductPreset } from "@/types/image";
import { Modal } from "./Modal";

/** Maior lado da textura da arte no 3D: nítido na tela sem pesar na memória da GPU. */
const TEXTURE_MAX_SIDE = 2048;

interface Mug3DDialogProps {
  open: boolean;
  onClose: () => void;
  image: LoadedImage;
  preset: ProductPreset;
  framing: Framing;
}

/**
 * "Ver em 3D": a cena só é montada enquanto o diálogo está aberto. Ao fechar,
 * o visualizador é desmontado e libera WebGL, texturas e o laço de renderização.
 */
export function Mug3DDialog({ open, onClose, image, preset, framing }: Mug3DDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title="Ver em 3D">
      {open && <MugViewer image={image} preset={preset} framing={framing} />}
      <p className="mt-4 text-sm leading-relaxed text-muted">
        Arraste para girar · pinça ou roda do mouse para aproximar. A arte aparece como ficará na caneca (sem o
        espelhamento do arquivo).
        {!preset.object && " Formato do objeto aproximado, estimado pelo tamanho da arte."}
      </p>
    </Modal>
  );
}

function MugViewer({ image, preset, framing }: Omit<Mug3DDialogProps, "open" | "onClose">) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;
    let viewer: { dispose: () => void } | null = null;

    // Mesma arte do editor, sem espelhamento: é o que se vê na caneca pronta.
    const scale = TEXTURE_MAX_SIDE / Math.max(preset.widthMm, preset.heightMm);
    const art = document.createElement("canvas");
    art.width = Math.round(preset.widthMm * scale);
    art.height = Math.round(preset.heightMm * scale);
    const ctx = art.getContext("2d");
    if (ctx) renderArt(ctx, image.preview, image, preset, framing, art, { mirror: false });

    import("@/lib/mug3d")
      .then(({ createMugViewer }) => {
        if (disposed) return;
        viewer = createMugViewer(container, art, mugShape(preset), preset.heightMm);
        setStatus("ready");
      })
      .catch(() => {
        if (!disposed) setStatus("error");
      });

    return () => {
      disposed = true;
      viewer?.dispose();
      art.width = 0;
      art.height = 0;
    };
  }, [image, preset, framing]);

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-line bg-[radial-gradient(120%_90%_at_50%_15%,#fffefa_0%,#e9e6dd_70%,#dcd8cd_100%)]">
      <div ref={containerRef} className="absolute inset-0 touch-none" aria-label="Caneca em 3D com a sua arte" role="img" />
      {status === "loading" && (
        <div className="absolute inset-0 grid place-items-center" role="status">
          <span aria-hidden className="size-8 animate-spin rounded-full border-[3px] border-line border-t-signal" />
          <span className="sr-only">Carregando visualização 3D…</span>
        </div>
      )}
      {status === "error" && (
        <p role="alert" className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-ink-soft">
          Não foi possível abrir a visualização 3D neste navegador. A arte e os arquivos não são afetados.
        </p>
      )}
    </div>
  );
}
