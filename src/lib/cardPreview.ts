import { useEffect, useState, type RefObject } from "react";
import { ipc } from "./ipc";
import { createCardQueue } from "./cardQueue";

export function cardFontName(id: string): string {
  return `zfm-card-${id}`;
}

const queue = createCardQueue(async (id) => {
  const bytes = await ipc.onlineCardPreview(id);
  const face = new FontFace(cardFontName(id), bytes);
  await face.load();
  document.fonts.add(face);
}, 4);

export type CardPreview = "pending" | "loaded" | "failed";

export function useCardPreview(id: string, ref: RefObject<Element | null>, enabled: boolean): CardPreview {
  const [, bump] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    let leave: (() => void) | null = null;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((e) => e.isIntersecting);
        if (visible && !leave) leave = queue.want(id, () => bump((n) => n + 1));
        if (!visible && leave) {
          leave();
          leave = null;
        }
      },
      { rootMargin: "200px 0px" },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      leave?.();
    };
  }, [id, ref, enabled]);

  if (!enabled) return "failed";
  const state = queue.state(id);
  return state === "loaded" ? "loaded" : state === "failed" ? "failed" : "pending";
}
