"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { ZOOM_STEP } from "@/lib/constants";
import { initialFraming, zoomAround } from "@/lib/framing";
import { renderArt } from "@/lib/imageProcessor";
import type { Framing, LoadedImage, ProductPreset } from "@/types/image";

type FramingUpdater = (update: (framing: Framing) => Framing) => void;

interface MugEditorProps {
  image: LoadedImage;
  preset: ProductPreset;
  framing: Framing;
  onFramingChange: FramingUpdater;
  /** Mostra o preview como sairá no arquivo (espelhado). */
  mirroredView: boolean;
  showSafeArea: boolean;
}

interface Point {
  x: number;
  y: number;
}

export function MugEditor({ image, preset, framing, onFramingChange, mirroredView, showSafeArea }: MugEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointers = useRef(new Map<number, Point>());
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [dragging, setDragging] = useState(false);
  const [hintVisible, setHintVisible] = useState(true);

  // Mantém o canvas na resolução real da tela (nítido em telas retina).
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      setSize({
        width: Math.round(entry.contentRect.width * dpr),
        height: Math.round(entry.contentRect.height * dpr),
      });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !size.width || !size.height) return;
    const frame = requestAnimationFrame(() => {
      if (canvas.width !== size.width) canvas.width = size.width;
      if (canvas.height !== size.height) canvas.height = size.height;
      const ctx = canvas.getContext("2d");
      if (ctx) renderArt(ctx, image.preview, image, preset, framing, size, { mirror: mirroredView });
    });
    return () => cancelAnimationFrame(frame);
  }, [image, preset, framing, mirroredView, size]);

  /** Converte coordenadas da tela em mm relativos ao centro da arte (já desfazendo o espelho da visualização). */
  const toArtMm = (clientX: number, clientY: number): Point => {
    const rect = containerRef.current!.getBoundingClientRect();
    const mmPerCssPx = preset.widthMm / rect.width;
    const x = (clientX - rect.left - rect.width / 2) * mmPerCssPx;
    const y = (clientY - rect.top - rect.height / 2) * mmPerCssPx;
    return { x: mirroredView ? -x : x, y };
  };

  // Ctrl + roda do mouse (e pinça no trackpad) amplia em torno do cursor.
  // Registrado manualmente porque o React adiciona "wheel" como passivo.
  const handleWheel = useEffectEvent((event: WheelEvent) => {
    if (!event.ctrlKey) return;
    event.preventDefault();
    const anchor = toArtMm(event.clientX, event.clientY);
    const factor = Math.exp(-event.deltaY * 0.0025);
    onFramingChange((f) => zoomAround(f, f.zoom * factor, anchor));
  });
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const listener = (event: WheelEvent) => handleWheel(event);
    container.addEventListener("wheel", listener, { passive: false });
    return () => container.removeEventListener("wheel", listener);
  }, []);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    setDragging(true);
    setHintVisible(false);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const active = pointers.current;
    const previous = active.get(event.pointerId);
    if (!previous) return;

    if (active.size === 1) {
      const from = toArtMm(previous.x, previous.y);
      const to = toArtMm(event.clientX, event.clientY);
      onFramingChange((f) => ({ ...f, offsetXMm: f.offsetXMm + to.x - from.x, offsetYMm: f.offsetYMm + to.y - from.y }));
    } else if (active.size === 2) {
      // Pinça: zoom pela variação da distância e arraste pelo ponto médio.
      const other = [...active].find(([id]) => id !== event.pointerId)![1];
      const before = { mid: midpoint(previous, other), dist: distance(previous, other) };
      const current = { x: event.clientX, y: event.clientY };
      const after = { mid: midpoint(current, other), dist: distance(current, other) };
      const fromMid = toArtMm(before.mid.x, before.mid.y);
      const toMid = toArtMm(after.mid.x, after.mid.y);
      const ratio = before.dist > 0 ? after.dist / before.dist : 1;
      onFramingChange((f) => {
        const moved = { ...f, offsetXMm: f.offsetXMm + toMid.x - fromMid.x, offsetYMm: f.offsetYMm + toMid.y - fromMid.y };
        return zoomAround(moved, f.zoom * ratio, toMid);
      });
    }
    active.set(event.pointerId, { x: event.clientX, y: event.clientY });
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size === 0) setDragging(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 5 : 1;
    const direction = mirroredView ? -1 : 1;
    const moves: Record<string, Point> = {
      ArrowLeft: { x: -step * direction, y: 0 },
      ArrowRight: { x: step * direction, y: 0 },
      ArrowUp: { x: 0, y: -step },
      ArrowDown: { x: 0, y: step },
    };
    const move = moves[event.key];
    if (move) {
      onFramingChange((f) => ({ ...f, offsetXMm: f.offsetXMm + move.x, offsetYMm: f.offsetYMm + move.y }));
    } else if (event.key === "+" || event.key === "=") {
      onFramingChange((f) => zoomAround(f, f.zoom + ZOOM_STEP));
    } else if (event.key === "-") {
      onFramingChange((f) => zoomAround(f, f.zoom - ZOOM_STEP));
    } else if (event.key === "0") {
      onFramingChange((f) => initialFraming(f.mode));
    } else {
      return;
    }
    event.preventDefault();
    setHintVisible(false);
  };

  const marginX = (preset.safeMarginMm / preset.widthMm) * 100;
  const marginY = (preset.safeMarginMm / preset.heightMm) * 100;

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      role="group"
      aria-roledescription="área de enquadramento"
      aria-label="Arte da caneca. Arraste para posicionar. Teclado: setas movem, + e − ajustam o zoom, 0 redefine."
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onKeyDown={handleKeyDown}
      className={`relative mx-auto touch-none select-none overflow-hidden rounded-lg bg-white shadow-[0_0_0_1px_rgb(203_213_225),0_8px_24px_-12px_rgb(15_23_42/0.35)] outline-offset-4 focus-visible:outline-2 focus-visible:outline-blue-600 ${
        dragging ? "cursor-grabbing" : "cursor-grab"
      }`}
      // Artes em retrato limitadas pela altura da tela; as de paisagem ocupam toda a largura.
      style={{
        aspectRatio: `${preset.widthMm} / ${preset.heightMm}`,
        width: `min(100%, calc(var(--editor-max-height, 65dvh) * ${preset.widthMm / preset.heightMm}))`,
      }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 size-full" />

      {/* A margem segura é apenas uma camada visual: nunca entra no arquivo exportado. */}
      {showSafeArea && (
        <div
          aria-hidden
          className="pointer-events-none absolute border border-dashed border-sky-500/80"
          style={{ left: `${marginX}%`, right: `${marginX}%`, top: `${marginY}%`, bottom: `${marginY}%` }}
        />
      )}

      <div
        aria-hidden
        className={`pointer-events-none absolute inset-x-0 bottom-2 flex justify-center sm:bottom-3 transition-opacity duration-500 ${
          hintVisible ? "opacity-100" : "opacity-0"
        }`}
      >
        <span className="rounded-full bg-slate-900/70 px-2.5 py-0.5 text-[11px] font-medium text-white sm:px-3 sm:py-1 sm:text-xs">
          <span className="pointer-coarse:hidden">Arraste para posicionar · Ctrl + roda para zoom</span>
          <span className="pointer-fine:hidden">Arraste · pinça para zoom</span>
        </span>
      </div>
    </div>
  );
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
