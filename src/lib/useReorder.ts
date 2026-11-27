import { useLayoutEffect, useRef, type RefObject } from "react";
import { gsap } from "gsap";
import { Draggable } from "gsap/Draggable";
import { moveItem } from "./sidebarLayout";

gsap.registerPlugin(Draggable);

interface Options {
  handle?: string;
  enabled?: boolean;
  onDragState?: (dragging: boolean) => void;
}

export function useReorder(
  containerRef: RefObject<HTMLElement | null>,
  ids: string[],
  onReorder: (ids: string[]) => void,
  { handle, enabled = true, onDragState }: Options = {},
) {
  const commit = useRef(onReorder);
  commit.current = onReorder;
  const dragState = useRef(onDragState);
  dragState.current = onDragState;
  const key = ids.join("\u0001");

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || !enabled) return;
    const items = Array.from(container.querySelectorAll<HTMLElement>(":scope > [data-reorder-id]"));
    gsap.set(items, { clearProps: "transform,zIndex" });
    if (items.length < 2) return;

    let tops: number[] = [];
    let heights: number[] = [];
    let from = -1;
    let target = -1;
    const order = items.map((el) => el.dataset.reorderId ?? "");

    const measure = () => {
      tops = items.map((el) => el.offsetTop);
      heights = items.map((el) => el.offsetHeight);
    };

    const gapAt = (i: number) => {
      if (items.length < 2) return 0;
      const j = i + 1 < items.length ? i + 1 : i - 1;
      const [a, b] = j > i ? [i, j] : [j, i];
      return Math.max(0, tops[b] - tops[a] - heights[a]);
    };

    const shiftOthers = (to: number) => {
      const span = heights[from] + gapAt(from);
      items.forEach((el, j) => {
        if (j === from) return;
        let y = 0;
        if (from < to && j > from && j <= to) y = -span;
        if (from > to && j >= to && j < from) y = span;
        gsap.to(el, { y, duration: 0.22, ease: "power3.out", overwrite: "auto" });
      });
    };

    const slotOffset = (to: number) => {
      if (to === from) return 0;
      if (to > from) return tops[to] + heights[to] - heights[from] - tops[from];
      return tops[to] - tops[from];
    };

    const draggables = items.map((el, index) =>
      Draggable.create(el, {
        type: "y",
        trigger: handle ? (el.querySelector<HTMLElement>(handle) ?? el) : el,
        dragClickables: true,
        minimumMovement: 6,
        zIndexBoost: true,
        cursor: "grab",
        activeCursor: "grabbing",
        onPress() {
          measure();
          from = index;
          target = index;
        },
        onDragStart() {
          el.classList.add("is-dragging");
          dragState.current?.(true);
        },
        onDrag() {
          const center = tops[from] + heights[from] / 2 + this.y;
          let next = 0;
          items.forEach((_, j) => {
            if (j !== from && tops[j] + heights[j] / 2 < center) next++;
          });
          next = Math.max(0, Math.min(items.length - 1, next));
          if (next !== target) {
            target = next;
            shiftOthers(next);
          }
        },
        onDragEnd() {
          const to = target;
          gsap.to(el, {
            y: slotOffset(to),
            duration: 0.2,
            ease: "power3.out",
            onComplete: () => {
              el.classList.remove("is-dragging");
              dragState.current?.(false);
              if (to !== from) commit.current(moveItem(order, from, to));
              else gsap.set(items, { clearProps: "transform,zIndex" });
            },
          });
        },
      })[0],
    );

    return () => {
      draggables.forEach((d) => d.kill());
      gsap.killTweensOf(items);
    };
  }, [containerRef, key, handle, enabled]);
}
