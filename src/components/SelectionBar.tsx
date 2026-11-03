import { AnimatePresence, motion } from "motion/react";
import {
  CheckCheck,
  Columns2,
  MousePointerClick,
  MoreHorizontal,
  Power,
  PowerOff,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { springSoft } from "../design/springs";
import { openContextMenuAt } from "../design/primitives/ContextMenu";
import { buildSelectionMenu } from "../lib/menus";
import { familiesFor, useFontStore, type Family } from "../state/fontStore";
import { useT } from "../lib/i18n";

function selectionState(selection: string[], families: Map<string, Family>) {
  let canActivate = false;
  let canDeactivate = false;
  let canTrash = false;
  for (const name of selection) {
    const fam = families.get(name);
    if (!fam) continue;
    if (fam.deactivatable) {
      for (const f of fam.faces) {
        if (!f.deactivatable) continue;
        if (f.active) canDeactivate = true;
        else canActivate = true;
      }
    }
    if (fam.faces.some((f) => f.source !== "system")) canTrash = true;
  }
  return { canActivate, canDeactivate, canTrash };
}

export function SelectionBar() {
  const t = useT();
  const selection = useFontStore((s) => s.selection);
  const picking = useFontStore((s) => s.comparePicking);
  const compare = useFontStore((s) => s.compare);
  const fonts = useFontStore((s) => s.fonts);
  const tags = useFontStore((s) => s.tags);
  const favorites = useFontStore((s) => s.favorites);
  const visibleOrder = useFontStore((s) => s.visibleOrder);
  const openCompare = useFontStore((s) => s.openCompare);
  const setComparePicking = useFontStore((s) => s.setComparePicking);
  const selectedFamily = useFontStore((s) => s.selectedFamily);
  const ready = selection.length >= 2;
  const ticked = selection.length === 1 && selectedFamily !== selection[0];
  const show = (picking || ready || ticked) && !compare;

  const { canActivate, canDeactivate, canTrash } = selectionState(
    selection,
    familiesFor(fonts, tags),
  );
  const chosen = new Set(selection);
  const allVisible = visibleOrder.length > 0 && visibleOrder.every((f) => chosen.has(f));
  const allFavorite = selection.length > 0 && selection.every((f) => favorites.includes(f));

  const dismiss = () => {
    setComparePicking(false);
    useFontStore.getState().select(null);
  };

  const act = (fn: (names: string[]) => void) => () => fn(useFontStore.getState().selection);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className={`selection-bar glass-e3 ${picking ? "selection-picking" : ""}`}
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.98 }}
          transition={springSoft}
          role="toolbar"
          aria-label={t("sel.aria")}
        >
          {picking ? (
            <>
              <span className="selection-step">
                <MousePointerClick size={15} strokeWidth={1.5} />
                {ready
                  ? t("sel.ready")
                  : selection.length === 1
                    ? t("sel.pickMore")
                    : t("sel.pickHint")}
              </span>
              <span className="selection-count tabular">{selection.length} / 4</span>
            </>
          ) : (
            <>
              <span className="selection-count tabular">{t("sel.count", { count: selection.length })}</span>
              {!allVisible && (
                <button
                  className="selection-action"
                  onClick={() => useFontStore.getState().selectAll()}
                  title={t("sel.selectAllCount", { count: visibleOrder.length })}
                >
                  <CheckCheck size={14} strokeWidth={1.5} />
                  <span className="selection-label">
                    {t("sel.selectAllCount", { count: visibleOrder.length })}
                  </span>
                </button>
              )}
              <span className="selection-sep" />
              <button
                className="selection-action"
                disabled={!canActivate}
                onClick={act((names) => void useFontStore.getState().setFamiliesActiveBulk(names, true))}
                title={t("menu.activateCount", { count: selection.length })}
              >
                <Power size={14} strokeWidth={1.5} />
                <span className="selection-label">{t("sel.activate")}</span>
              </button>
              <button
                className="selection-action"
                disabled={!canDeactivate}
                onClick={act((names) => void useFontStore.getState().setFamiliesActiveBulk(names, false))}
                title={t("menu.deactivateCount", { count: selection.length })}
              >
                <PowerOff size={14} strokeWidth={1.5} />
                <span className="selection-label">{t("sel.deactivate")}</span>
              </button>
              <button
                className={`selection-action selection-icon ${allFavorite ? "selection-star-on" : ""}`}
                onClick={act((names) => void useFontStore.getState().setFavorites(names, !allFavorite))}
                aria-label={t(allFavorite ? "sel.unfavorite" : "sel.favorite")}
                title={t(allFavorite ? "sel.unfavorite" : "sel.favorite")}
              >
                <Star size={14} strokeWidth={1.5} />
              </button>
              <button
                className="selection-action selection-icon selection-danger"
                disabled={!canTrash}
                onClick={act((names) => void useFontStore.getState().uninstallFamilies(names))}
                aria-label={t("menu.moveCountToTrash", { count: selection.length })}
                title={t("menu.moveCountToTrash", { count: selection.length })}
              >
                <Trash2 size={14} strokeWidth={1.5} />
              </button>
              <button
                className="selection-action selection-icon"
                aria-label={t("sel.more")}
                title={t("sel.more")}
                aria-haspopup="menu"
                onClick={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  openContextMenuAt(r.left, r.top - 8, buildSelectionMenu(useFontStore.getState().selection));
                }}
              >
                <MoreHorizontal size={15} strokeWidth={1.5} />
              </button>
              <span className="selection-sep" />
            </>
          )}
          <motion.button
            className={`selection-compare ${ready ? "" : "selection-compare-off"}`}
            disabled={!ready}
            onClick={() => openCompare(selection)}
            whileHover={ready ? { y: -1 } : undefined}
            whileTap={ready ? { scale: 0.97 } : undefined}
            animate={picking && ready ? { scale: [1, 1.06, 1] } : { scale: 1 }}
            transition={
              picking && ready
                ? { duration: 0.9, repeat: Infinity, ease: "easeInOut" }
                : undefined
            }
          >
            <Columns2 size={14} strokeWidth={1.5} />
            {ready ? t("compare.buttonCount", { count: Math.min(selection.length, 4) }) : t("compare.button")}
            <kbd className="kbd selection-kbd">C</kbd>
          </motion.button>
          <button
            className="detail-close"
            aria-label={picking ? t("sel.cancelCompare") : t("sel.clear")}
            title={picking ? t("sel.cancelCompare") : t("sel.clear")}
            onClick={dismiss}
          >
            <X size={14} strokeWidth={1.5} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
