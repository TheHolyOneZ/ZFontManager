import { useVirtualizer } from "@tanstack/react-virtual";
import { motion } from "motion/react";
import { useEffect, useRef } from "react";
import { spring, staggerDelay } from "../design/springs";
import { FamilyCard } from "./FamilyCard";
import type { Family } from "../state/fontStore";
import { SIZES, useFontStore } from "../state/fontStore";

export function FontGrid({ families }: { families: Family[] }) {
  const parentRef = useRef<HTMLDivElement>(null);
  const mountedAt = useRef(Date.now());
  const sizeIndex = useFontStore((s) => s.sizeIndex);
  const estimate = 120 + SIZES[sizeIndex] * 1.5;

  const virtualizer = useVirtualizer({
    count: families.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimate,
    overscan: 6,
    getItemKey: (i) => families[i].name,
  });


  const selectedFamily = useFontStore((s) => s.selectedFamily);
  useEffect(() => {
    if (!selectedFamily) return;
    const idx = families.findIndex((f) => f.name === selectedFamily);
    if (idx >= 0) virtualizer.scrollToIndex(idx, { align: "auto" });

  }, [selectedFamily]);


  const arriving = Date.now() - mountedAt.current < 1200;

  return (
    <div ref={parentRef} className="grid-scroll">
      <div
        className="grid-inner"
        style={{ height: virtualizer.getTotalSize(), position: "relative" }}
      >
        {virtualizer.getVirtualItems().map((item) => (
          <div
            key={item.key}
            data-index={item.index}
            ref={virtualizer.measureElement}
            className="grid-row"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              transform: `translateY(${item.start}px)`,
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                ...spring,
                delay: arriving ? staggerDelay(item.index) : 0,
              }}
            >
              <FamilyCard family={families[item.index]} />
            </motion.div>
          </div>
        ))}
      </div>
    </div>
  );
}
