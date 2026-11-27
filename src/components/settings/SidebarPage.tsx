import { Eye, EyeOff, GripVertical, RotateCcw } from "lucide-react";
import { useContext, useRef } from "react";
import { useT } from "../../lib/i18n";
import { useReorder } from "../../lib/useReorder";
import { useFontStore } from "../../state/fontStore";
import { FOOTER_IDS, mergeOrder, SIDEBAR_DEFAULT_WIDTH } from "../../lib/sidebarLayout";
import { SIDEBAR_ICONS, SIDEBAR_LABELS } from "../Sidebar";
import { Group, matchesQuery, Row, SettingsQuery } from "./kit";

function ItemRow({ id, draggable }: { id: string; draggable: boolean }) {
  const t = useT();
  const hidden = useFontStore((s) => s.sidebarHidden.includes(id));
  const setSidebarHidden = useFontStore((s) => s.setSidebarHidden);
  const label = t(SIDEBAR_LABELS[id]);
  return (
    <div data-reorder-id={id} className={`side-item ${hidden ? "is-hidden" : ""}`}>
      {draggable ? (
        <span className="side-item-grip" aria-hidden>
          <GripVertical size={14} strokeWidth={1.6} />
        </span>
      ) : (
        <span className="side-item-grip side-item-grip-off" aria-hidden />
      )}
      <span className="side-item-icon">{SIDEBAR_ICONS[id]}</span>
      <span className="side-item-label">{label}</span>
      <button
        className="side-item-eye"
        aria-pressed={!hidden}
        aria-label={t(hidden ? "side.showItem" : "side.hideItem", { name: label })}
        title={t(hidden ? "side.showItem" : "side.hideItem", { name: label })}
        onClick={() => setSidebarHidden(id, !hidden)}
      >
        {hidden ? <EyeOff size={14} strokeWidth={1.6} /> : <Eye size={14} strokeWidth={1.6} />}
      </button>
    </div>
  );
}

function OrderedList({
  ids,
  onReorder,
}: {
  ids: string[];
  onReorder: (next: string[]) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useReorder(ref, ids, onReorder, { handle: ".side-item-grip" });
  return (
    <div ref={ref} className="side-list">
      {ids.map((id) => (
        <ItemRow key={id} id={id} draggable />
      ))}
    </div>
  );
}

export function SidebarPage() {
  const t = useT();
  const query = useContext(SettingsQuery);
  const sidebarWidth = useFontStore((s) => s.sidebarWidth);
  const sidebarOrder = useFontStore((s) => s.sidebarOrder);
  const sectionOrder = useFontStore((s) => s.sectionOrder);
  const setSidebarOrder = useFontStore((s) => s.setSidebarOrder);
  const setSectionOrder = useFontStore((s) => s.setSectionOrder);
  const setSidebarWidth = useFontStore((s) => s.setSidebarWidth);
  const resetSidebar = useFontStore((s) => s.resetSidebar);

  const listsMatch = matchesQuery(
    query,
    t("sidebarSettings.items"),
    t("sidebarSettings.itemsSub"),
    "hide show order reorder drag",
    ...[...sidebarOrder, ...sectionOrder, ...FOOTER_IDS].map((id) => t(SIDEBAR_LABELS[id])),
  );

  return (
    <>
      <Group title={t("sidebarSettings.layout")}>
        <Row
          label={t("sidebarSettings.width")}
          sub={t("sidebarSettings.widthSub")}
          keywords="resize size"
        >
          <div className="width-readout">
            <span className="tabular">{t("sidebarSettings.px", { px: sidebarWidth })}</span>
            <button
              className="set-btn"
              disabled={sidebarWidth === SIDEBAR_DEFAULT_WIDTH}
              onClick={() => setSidebarWidth(SIDEBAR_DEFAULT_WIDTH)}
            >
              {t("sidebarSettings.resetWidth")}
            </button>
          </div>
        </Row>
      </Group>

      {listsMatch && (
        <Group
          title={t("sidebarSettings.items")}
          aside={
            <button className="set-btn" onClick={resetSidebar}>
              <RotateCcw size={13} strokeWidth={1.6} />
              {t("sidebarSettings.reset")}
            </button>
          }
        >
          <p className="set-note">{t("sidebarSettings.itemsSub")}</p>
          <div className="side-lists">
            <div className="side-col">
              <div className="side-col-title">{t("side.browse")}</div>
              <OrderedList ids={sidebarOrder} onReorder={(next) => setSidebarOrder(mergeOrder(sidebarOrder, next))} />
            </div>
            <div className="side-col">
              <div className="side-col-title">{t("sidebarSettings.sections")}</div>
              <OrderedList ids={sectionOrder} onReorder={(next) => setSectionOrder(mergeOrder(sectionOrder, next))} />
              <div className="side-col-title">{t("sidebarSettings.bottom")}</div>
              <div className="side-list">
                {FOOTER_IDS.map((id) => (
                  <ItemRow key={id} id={id} draggable={false} />
                ))}
              </div>
            </div>
          </div>
        </Group>
      )}
    </>
  );
}
