"use client";

import { useEffect, useId, useState, type RefObject } from "react";
import { downloadBlob } from "@/lib/imageProcessor";
import type { GarmentViewer } from "@/lib/garment3d";
import { AREA_LABELS, AREA_ORDER, collarY, fabricColorName, garmentDims, type GarmentSpec, type Pose } from "@/lib/garments";
import { distanceFromCollar, formatPrintSize } from "@/lib/placement";
import { proofViewSize, renderProof } from "@/lib/proofSheet";
import type { Design, GarmentSize, GarmentView, Placement, PrintArea, PrintAreaId } from "@/types/garment";
import { Modal } from "../Modal";
import { btn } from "../ui";

const VIEW_LABELS: Record<GarmentView, string> = {
  front: "Frente",
  back: "Costas",
  left: "Lado esquerdo",
  right: "Lado direito",
};
const VIEW_ORDER: GarmentView[] = ["front", "back", "left", "right"];

interface ProofModalProps {
  open: boolean;
  onClose: () => void;
  viewer: RefObject<GarmentViewer | null>;
  spec: GarmentSpec;
  size: GarmentSize;
  pose: Pose;
  color: string;
  trim: string | null;
  designs: Map<string, Design>;
  placements: Placement[];
  areas: Record<PrintAreaId, PrintArea>;
}

/** Nome de arquivo seguro a partir do cliente: "prova-maria-silva.png". */
function proofFilename(client: string) {
  const slug = client
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `prova${slug ? `-${slug}` : ""}.png`;
}

export function ProofModal(props: ProofModalProps) {
  const { open, onClose } = props;
  return (
    <Modal open={open} onClose={onClose} title="Prova para o cliente">
      {open && <ProofForm {...props} />}
    </Modal>
  );
}

function ProofForm({ viewer, spec, size, pose, color, trim, designs, placements, areas }: ProofModalProps) {
  const dims = garmentDims(spec, size, pose);
  const [client, setClient] = useState("");
  const [order, setOrder] = useState("");
  const usedViews = new Set(placements.map((p) => areas[p.area].view));
  const [views, setViews] = useState<Set<GarmentView>>(
    () => new Set<GarmentView>(["front", "back", ...VIEW_ORDER.filter((v) => (v === "left" || v === "right") && usedViews.has(v))]),
  );
  const [status, setStatus] = useState<"idle" | "busy" | "error">("idle");
  const [result, setResult] = useState<{ blob: Blob; url: string } | null>(null);
  const clientId = useId();
  const orderId = useId();

  useEffect(() => () => {
    if (result) URL.revokeObjectURL(result.url);
  }, [result]);

  const toggleView = (view: GarmentView) =>
    setViews((current) => {
      const next = new Set(current);
      if (next.has(view)) {
        if (next.size > 1) next.delete(view);
      } else next.add(view);
      return next;
    });

  const generate = async () => {
    const scene = viewer.current;
    if (!scene) {
      setStatus("error");
      return;
    }
    setStatus("busy");
    try {
      const chosen = VIEW_ORDER.filter((v) => views.has(v));
      const shot = proofViewSize(chosen.length);
      const images = [];
      for (const view of chosen) images.push({ label: VIEW_LABELS[view], image: await scene.snapshot(view, shot.width, shot.height) });
      const prints = [...placements]
        .sort((a, b) => AREA_ORDER.indexOf(a.area) - AREA_ORDER.indexOf(b.area))
        .flatMap((p) => {
          const design = designs.get(p.designId);
          if (!design) return [];
          // Para a produção: distância do topo até a gola e se está centralizada.
          const notes: string[] = [];
          if (p.area === "front" || p.area === "back" || p.area === "chest") {
            const cm = distanceFromCollar(p, areas[p.area], design.aspect, collarY(spec, dims, p.area));
            notes.push(`topo a ${cm.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} cm da gola`);
            if (p.area !== "chest" && Math.abs(p.x) < 0.15) notes.push("centralizada");
          }
          if (p.rotationDeg) notes.push(`girada ${p.rotationDeg}°`);
          return [
            {
              area: AREA_LABELS[p.area],
              file: design.image.name,
              size: formatPrintSize(p.widthCm, design.aspect),
              note: notes.join(" · ") || undefined,
            },
          ];
        });
      const blob = await renderProof({
        client: client.trim(),
        order: order.trim(),
        garment: spec.name,
        size,
        colorName: fabricColorName(color),
        colorHex: color,
        trimName: trim ? fabricColorName(trim) : undefined,
        trimHex: trim ?? undefined,
        views: images,
        prints,
        date: new Date(),
      });
      setResult({ blob, url: URL.createObjectURL(blob) });
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  };

  const filename = proofFilename(client);
  const file = result ? new File([result.blob], filename, { type: "image/png" }) : null;
  const canShare = !!file && typeof navigator !== "undefined" && !!navigator.canShare?.({ files: [file] });

  if (result) {
    return (
      <div className="space-y-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- blob local gerado no navegador */}
        <img src={result.url} alt="Prova gerada" className="w-full rounded-xl border border-line" />
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => downloadBlob(result.blob, filename)} className={`h-12 flex-1 px-5 ${btn.primary}`}>
            Baixar PNG <span aria-hidden className="text-signal">↓</span>
          </button>
          {canShare && (
            <button
              type="button"
              onClick={() => navigator.share({ files: [file!], title: "Prova de estampa" }).catch(() => undefined)}
              className={`h-12 flex-1 px-5 ${btn.secondary}`}
            >
              Compartilhar (WhatsApp…)
            </button>
          )}
        </div>
        <button type="button" onClick={() => setResult(null)} className={`h-10 w-full text-sm ${btn.ghost}`}>
          ← Editar dados da prova
        </button>
      </div>
    );
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        void generate();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr]">
        <label htmlFor={clientId} className="block text-[13px]">
          <span className="mb-1.5 block font-medium text-ink-soft">Cliente</span>
          <input
            id={clientId}
            value={client}
            onChange={(event) => setClient(event.target.value)}
            maxLength={60}
            placeholder="Nome do cliente"
            autoComplete="off"
            className="h-11 w-full rounded-xl border border-line bg-paper px-3 text-sm text-ink outline-none focus-visible:border-ink"
          />
        </label>
        <label htmlFor={orderId} className="block text-[13px]">
          <span className="mb-1.5 block font-medium text-ink-soft">Pedido (opcional)</span>
          <input
            id={orderId}
            value={order}
            onChange={(event) => setOrder(event.target.value)}
            maxLength={24}
            placeholder="Nº ou referência"
            autoComplete="off"
            className="h-11 w-full rounded-xl border border-line bg-paper px-3 text-sm text-ink outline-none focus-visible:border-ink"
          />
        </label>
      </div>

      <fieldset>
        <legend className="mb-2 text-[13px] font-medium text-ink-soft">Vistas na prova</legend>
        <div className="grid grid-cols-2 gap-2">
          {VIEW_ORDER.map((view) => (
            <label
              key={view}
              className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border border-line bg-paper px-3 text-sm font-medium transition has-[:checked]:border-ink"
            >
              <input type="checkbox" checked={views.has(view)} onChange={() => toggleView(view)} className="size-4 accent-[#16181d]" />
              {VIEW_LABELS[view]}
            </label>
          ))}
        </div>
      </fieldset>

      <p className="rounded-2xl bg-paper-deep/70 px-4 py-3 text-xs leading-relaxed text-muted">
        {spec.name} · {size} · {fabricColorName(color)} · {placements.length}{" "}
        {placements.length === 1 ? "estampa" : "estampas"}. A imagem traz as medidas de cada estampa e um campo para a
        aprovação do cliente.
      </p>

      {status === "error" && (
        <p role="alert" className="text-sm text-red-700">
          Não foi possível gerar a prova. Tente de novo.
        </p>
      )}

      <button type="submit" disabled={status === "busy"} className={`h-12 w-full ${btn.primary}`}>
        {status === "busy" ? "Gerando a prova…" : "Gerar prova"}
      </button>
    </form>
  );
}
