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
    // Artes em retrato limitadas pela altura da tela; as de paisagem ocupam toda a largura.
    <div
      className="mx-auto"
      style={{ width: `min(100%, calc(var(--editor-max-height, 65dvh) * ${preset.widthMm / preset.heightMm}))` }}
    >
    <Ruler widthMm={preset.widthMm} />
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
      className={`relative w-full touch-none select-none overflow-hidden rounded-[3px] bg-white shadow-[0_0_0_1px_rgb(22_24_29/0.1),0_24px_40px_-20px_rgb(22_24_29/0.45)] outline-offset-4 focus-visible:outline-2 focus-visible:outline-signal-ink ${
        dragging ? "cursor-grabbing" : "cursor-grab"
      }`}
      style={{ aspectRatio: `${preset.widthMm} / ${preset.heightMm}` }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 size-full" />

      {/* A margem segura é apenas uma camada visual: nunca entra no arquivo exportado. */}
      {showSafeArea && (
        <div
          aria-hidden
          className="pointer-events-none absolute border border-dashed border-process/90"
          style={{ left: `${marginX}%`, right: `${marginX}%`, top: `${marginY}%`, bottom: `${marginY}%` }}
        />
      )}

      <div
        aria-hidden
        className={`pointer-events-none absolute inset-x-0 bottom-2 flex justify-center sm:bottom-3 transition-opacity duration-500 ${
          hintVisible ? "opacity-100" : "opacity-0"
        }`}
      >
        <span className="rounded-full bg-ink/80 px-2.5 py-0.5 text-[11px] font-medium text-paper backdrop-blur sm:px-3 sm:py-1 sm:text-xs">
          <span className="pointer-coarse:hidden">Arraste para posicionar · Ctrl + roda para zoom</span>
          <span className="pointer-fine:hidden">Arraste · pinça para zoom</span>
        </span>
      </div>
    </div>
    </div>
  );
}

/** Régua em cm sobre a arte: cada traço está na posição física real (mm relativos à largura). */
function Ruler({ widthMm }: { widthMm: number }) {
  const cm = Math.floor(widthMm / 10);
  const labelEvery = widthMm > 220 ? 5 : widthMm > 120 ? 2 : 1;
  const halfCm = `${(5 / widthMm) * 100}%`;
  return (
    <div aria-hidden className="relative mb-1.5 h-4 select-none font-mono text-[9px] leading-none text-muted max-sm:hidden">
      <div
        className="absolute inset-x-0 bottom-0 h-1"
        style={{
          backgroundImage: "linear-gradient(to right, rgb(22 24 29 / 0.28) 1px, transparent 1px)",
          backgroundSize: `${halfCm} 100%`,
        }}
      />
      {Array.from({ length: cm + 1 }, (_, i) => (
        <span key={i} className="absolute bottom-0 h-2 w-px bg-ink/45" style={{ left: `${((i * 10) / widthMm) * 100}%` }}>
          {i > 0 && i * 10 < widthMm && i % labelEvery === 0 && (
            <span className="absolute bottom-2.5 left-0 -translate-x-1/2">{i}</span>
          )}
        </span>
      ))}
    </div>
  );
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
