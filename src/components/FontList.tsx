import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useRef } from "react";
import { PillToggle } from "../design/primitives/PillToggle";
import { formatBytes } from "../lib/fontLoader";
import { useFontStore, type Family } from "../state/fontStore";
import { FormatBadge } from "./FamilyCard";
import { buildFamilyMenu } from "../lib/menus";
import { openContextMenu } from "../design/primitives/ContextMenu";

export function FontList({ families }: { families: Family[] }) {
  const parentRef = useRef<HTMLDivElement>(null);
  const setFamilyActive = useFontStore((s) => s.setFamilyActive);
  const selectWith = useFontStore((s) => s.selectWith);
  const selection = useFontStore((s) => s.selection);

  const virtualizer = useVirtualizer({
    count: families.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 20,
    getItemKey: (i) => families[i].name,
  });

  const selectedFamily = useFontStore((s) => s.selectedFamily);
  useEffect(() => {
    if (!selectedFamily) return;
    const idx = families.findIndex((f) => f.name === selectedFamily);
    if (idx >= 0) virtualizer.scrollToIndex(idx, { align: "auto" });

  }, [selectedFamily]);

  return (
    <div className="list-wrap">
      <div className="list-header">
        <span>Family</span>
        <span className="col-styles">Styles</span>
        <span className="col-format">Format</span>
        <span className="col-size">Size</span>
        <span className="col-status">Active</span>
      </div>
      <div ref={parentRef} className="list-scroll">
        <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
          {virtualizer.getVirtualItems().map((item) => {
            const fam = families[item.index];
            return (
              <button
                key={item.key}
                data-family={fam.name}
                className={`list-row ${fam.active ? "" : "row-inactive"} ${
                  selection.includes(fam.name) ? "row-selected" : ""
                }`}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: 40,
                  transform: `translateY(${item.start}px)`,
                }}
                onClick={(e) => {
                  const st = useFontStore.getState();


                  if (st.comparePicking) {
                    st.togglePick(fam.name);
                    return;
                  }
                  const mode =
                    e.ctrlKey || e.metaKey ? "toggle" : e.shiftKey ? "range" : "single";
                  selectWith(fam.name, mode, st.visibleOrder);
                }}
                onContextMenu={(e) => openContextMenu(e, buildFamilyMenu(fam))}
              >
                <span className="row-name">{fam.name}</span>
                <span className="col-styles tabular">{fam.faces.length}</span>
                <span className="col-format">
                  <FormatBadge format={fam.formats[0]} isVariable={fam.isVariable} />
                </span>
                <span className="col-size tabular">{formatBytes(fam.totalSize)}</span>
                <span className="col-status">
                  <PillToggle
                    on={fam.active}
                    disabled={!fam.deactivatable}
                    onChange={(on) => void setFamilyActive(fam.name, on)}
                    label={`${fam.active ? "Deactivate" : "Activate"} ${fam.name}`}
                  />
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
