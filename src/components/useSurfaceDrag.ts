"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  assemblyPlacementError,
  snapPartAt,
  translateAttachmentGroup,
  type MountHit,
  type Part,
} from "@/game/data";

export type SurfacePicker = (
  x: number,
  y: number,
  ignored?: ReadonlySet<string>,
) => MountHit | null;
export type DragSource = {
  kind: "catalog" | "mounted" | "preview";
  parts: Part[];
};
export interface DragView {
  source: DragSource;
  x: number;
  y: number;
  hit: MountHit | null;
  parts: Part[];
  error: string | null;
}
interface Options {
  parts: Part[];
  allowance: number;
  step: number;
  stage: RefObject<HTMLDivElement | null>;
  picker: RefObject<SurfacePicker | null>;
  onActivate: (source: DragSource) => void;
  onPlace: (view: DragView) => void;
  onInvalid: (message: string) => void;
}
interface Gesture {
  id: number;
  x: number;
  y: number;
  startX: number;
  startY: number;
  touch: boolean;
  source: DragSource;
  ignored: Set<string>;
  capture: HTMLElement;
  active: boolean;
  frame: number;
  pendingDrop: number;
  previous: DragView | null;
}
const DROP_HINT = "Point at a surface on the vehicle.";

export default function useSurfaceDrag(options: Options) {
  const settings = useRef(options);
  settings.current = options;
  const active = useRef<Gesture | null>(null);
  const suppressUntil = useRef(0);
  const [view, setView] = useState<DragView | null>(null);

  const clear = useCallback((update = true) => {
    const g = active.current;
    if (!g) return;
    active.current = null;
    cancelAnimationFrame(g.frame);
    if (g.capture.hasPointerCapture(g.id))
      g.capture.releasePointerCapture(g.id);
    if (update && g.active) setView(null);
  }, []);

  const prepare = useCallback(
    (
      event: Pick<
        PointerEvent,
        | "pointerId"
        | "pointerType"
        | "clientX"
        | "clientY"
        | "button"
        | "isPrimary"
      >,
      capture: HTMLElement,
      source: DragSource,
    ) => {
      if (!event.isPrimary || event.button !== 0 || active.current)
        return false;
      suppressUntil.current = 0;
      active.current = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        startX: event.clientX,
        startY: event.clientY,
        touch: event.pointerType === "touch",
        source,
        capture,
        ignored: new Set(source.parts.map((p) => p.id)),
        active: false,
        previous: null,
        frame: 0,
        pendingDrop: 0,
      };
      try {
        capture.setPointerCapture(event.pointerId);
      } catch {
        /* Window listeners still cover the gesture. */
      }
      return true;
    },
    [],
  );

  const consumeClick = useCallback((detail: number) => {
    if (detail === 0 || performance.now() > suppressUntil.current) return false;
    suppressUntil.current = 0;
    return true;
  }, []);

  useEffect(() => {
    function evaluate(g: Gesture): DragView {
      const o = settings.current;
      const hit = o.picker.current?.(g.x, g.y, g.ignored) ?? null;
      const anchor =
        hit && o.parts.find((p) => p.id === hit.id && !g.ignored.has(p.id));
      if (!hit || !anchor)
        return {
          source: g.source,
          x: g.x,
          y: g.y,
          hit: null,
          parts: [],
          error: DROP_HINT,
        };
      const root = snapPartAt(
        g.source.parts[0],
        anchor,
        hit.face,
        hit.point,
        o.step,
      );
      const parts = translateAttachmentGroup(g.source.parts, root);
      const base = o.parts.filter((p) => !g.ignored.has(p.id));
      return {
        source: g.source,
        x: g.x,
        y: g.y,
        hit,
        parts,
        error: assemblyPlacementError(parts, base, o.allowance),
      };
    }
    function finish(g: Gesture) {
      const target = evaluate(g);
      if (g.source.kind === "catalog")
        suppressUntil.current = performance.now() + 650;
      clear();
      if (target.hit && (!target.error || g.source.kind === "preview")) {
        settings.current.onPlace(target);
      } else if (target.error) {
        settings.current.onInvalid(
          target.error === DROP_HINT
            ? "No part moved. Drop directly onto a vehicle surface."
            : target.error,
        );
      }
    }
    function paint() {
      const g = active.current;
      if (!g?.active) return;
      const o = settings.current;
      if (g.pendingDrop) {
        if (o.picker.current || performance.now() > g.pendingDrop) finish(g);
        else g.frame = requestAnimationFrame(paint);
        return;
      }
      if (
        g.source.kind === "catalog" &&
        g.x > 4 &&
        g.x < window.innerWidth - 4
      ) {
        const top = 90,
          bottom = window.innerHeight - 80;
        if (g.y < top && window.scrollY > 0)
          window.scrollBy(0, -Math.min(19, (top - g.y) * 0.21 + 2));
        else if (g.y > bottom)
          window.scrollBy(0, Math.min(14, (g.y - bottom) * 0.18 + 2));
      }
      const next = evaluate(g),
        prev = g.previous;
      if (
        !prev ||
        prev.x !== next.x ||
        prev.y !== next.y ||
        prev.error !== next.error ||
        prev.hit?.id !== next.hit?.id ||
        prev.hit?.face !== next.hit?.face ||
        next.hit?.point.some(
          (n, i) => Math.abs(n - (prev.hit?.point[i] ?? 0)) > 0.008,
        ) ||
        next.parts[0]?.pos.some((n, i) => n !== prev.parts[0]?.pos[i])
      ) {
        g.previous = next;
        setView(next);
      }
      g.frame = requestAnimationFrame(paint);
    }
    const move = (e: PointerEvent) => {
      const g = active.current;
      if (!g || g.id !== e.pointerId || g.pendingDrop) return;
      g.x = e.clientX;
      g.y = e.clientY;
      if (
        !g.active &&
        Math.hypot(g.x - g.startX, g.y - g.startY) >= (g.touch ? 8 : 6)
      ) {
        g.active = true;
        const o = settings.current;
        o.onActivate(g.source);
        const r = o.stage.current?.getBoundingClientRect();
        if (
          g.source.kind === "catalog" &&
          g.touch &&
          r &&
          r.bottom < window.innerHeight * 0.46
        ) {
          o.stage.current?.scrollIntoView({
            block: "center",
            behavior: "instant",
          });
        }
        paint();
      }
      if (g.active && e.cancelable) e.preventDefault();
    };
    const up = (e: PointerEvent) => {
      const g = active.current;
      if (!g || g.id !== e.pointerId) return;
      if (!g.active) {
        clear();
        return;
      }
      g.x = e.clientX;
      g.y = e.clientY;
      if (g.source.kind === "catalog")
        suppressUntil.current = performance.now() + 650;
      const o = settings.current,
        r = o.stage.current?.getBoundingClientRect();
      if (
        !o.picker.current &&
        r &&
        g.x >= r.left &&
        g.x <= r.right &&
        g.y >= r.top &&
        g.y <= r.bottom
      ) {
        g.pendingDrop = performance.now() + 2400;
        return;
      }
      finish(g);
    };
    const cancel = (e: PointerEvent) => {
      if (active.current?.id === e.pointerId) clear();
    };
    const blur = () => clear();
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("blur", blur);
      clear(false);
    };
  }, [clear]);
  return {
    view,
    prepare,
    consumeClick,
    cancel: clear,
    isActive: () => !!active.current?.active,
  };
}
