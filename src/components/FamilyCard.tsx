import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, ChevronRight, Star } from "lucide-react";
import { memo, useState } from "react";
import { PillToggle } from "../design/primitives/PillToggle";
import { spring, springSnappy, springSoft, staggerDelay } from "../design/springs";
import { useFontCss } from "../lib/fontLoader";
import { buildFamilyMenu } from "../lib/menus";
import { openContextMenu } from "../design/primitives/ContextMenu";
import { conflictsFor, SIZES, useFontStore, type Family } from "../state/fontStore";
import { playStar } from "../lib/sound";
import type { FontFace } from "../lib/ipc";

export function FormatBadge({ format, isVariable }: { format: string; isVariable: boolean }) {
  if (isVariable) return <span className="badge badge-variable">VAR</span>;
  return <span className={`badge badge-${format}`}>{format.toUpperCase()}</span>;
}

function FacePreview({
  face,
  text,
  size,
  index,
  synthesize,
}: {
  face: FontFace;
  text: string;
  size: number;
  index: number;
  synthesize: boolean;
}) {
  const { fontFamily, failed } = useFontCss(face);
  return (
    <motion.div
      className="face-row"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring, delay: staggerDelay(index) }}
    >
      <span className="face-style">{face.style}</span>
      <AnimatePresence mode="wait">
        {fontFamily ? (
          <motion.span
            key="real"
            className="face-sample"
            style={{
              fontFamily,
              fontSize: Math.min(size, 32),
              fontStyle: face.italic ? "italic" : "normal",


              fontWeight: synthesize ? face.weight : undefined,
            }}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={spring}
          >
            {text}
          </motion.span>
        ) : failed ? (
          <span key="failed" className="face-sample face-failed">
            preview unavailable
          </span>
        ) : (
          <motion.span
            key="skeleton"
            className="skeleton face-skeleton"
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export const FamilyCard = memo(function FamilyCard({ family }: { family: Family }) {
  const sampleText = useFontStore((s) => s.sampleText);
  const sizeIndex = useFontStore((s) => s.sizeIndex);
  const setFamilyActive = useFontStore((s) => s.setFamilyActive);
  const selectWith = useFontStore((s) => s.selectWith);
  const selected = useFontStore((s) => s.selection.includes(family.name));
  const favorite = useFontStore((s) => s.favorites.includes(family.name));
  const toggleFavorite = useFontStore((s) => s.toggleFavorite);
  const hasConflict = useFontStore((s) => conflictsFor(s.fonts).has(family.name));
  const [expanded, setExpanded] = useState(false);

  const size = SIZES[sizeIndex];
  const lead = family.faces.find((f) => f.style === "Regular") ?? family.faces[0];
  const { fontFamily, failed } = useFontCss(lead);
  const text = sampleText.trim() || family.name;

  return (
    <motion.article
      className={`family-card ${selected ? "card-selected" : ""} ${
        family.active ? "" : "card-inactive"
      }`}
      data-family={family.name}
      tabIndex={0}
      role="button"
      aria-label={family.name}
      aria-pressed={selected}
      onClick={(e) => {
        const st = useFontStore.getState();


        if (st.comparePicking) {
          st.togglePick(family.name);
          return;
        }
        const mode = e.ctrlKey || e.metaKey ? "toggle" : e.shiftKey ? "range" : "single";
        selectWith(family.name, mode, st.visibleOrder);
      }}
      onKeyDown={(e) => {
        if (e.key !== "Enter" || e.target !== e.currentTarget) return;
        e.preventDefault();
        selectWith(family.name, "single", useFontStore.getState().visibleOrder);
      }}
      onContextMenu={(e) => openContextMenu(e, buildFamilyMenu(family))}


      animate={{ scale: family.active ? 1 : 0.99 }}
      whileHover={{ y: -1 }}
      whileTap={{ scale: family.active ? 0.99 : 0.98 }}
      transition={spring}
      layout="position"
    >
      <header className="card-head">
        <FormatBadge format={family.formats[0]} isVariable={family.isVariable} />
        <span className="card-name">{family.name}</span>
        {family.faces.length > 1 && (
          <motion.button
            className="card-expand"
            aria-label={expanded ? "Collapse styles" : "Expand styles"}
            aria-expanded={expanded}
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((v) => !v);
            }}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.94 }}
          >
            <motion.span
              className="chevron"
              animate={{ rotate: expanded ? 90 : 0 }}
              transition={springSnappy}
            >
              <ChevronRight size={13} strokeWidth={1.5} />
            </motion.span>
            <span className="tabular">
              {family.faces.length} styles
            </span>
          </motion.button>
        )}
        <span className="card-spacer" />
        {hasConflict && (
          <span
            className="conflict-badge"
            title=""
            aria-label="Name conflict with another installed font"
          >
            <AlertTriangle size={13} strokeWidth={1.5} />
          </span>
        )}
        <motion.button
          className={`star-btn ${favorite ? "star-on" : ""}`}
          aria-label={favorite ? `Unfavorite ${family.name}` : `Favorite ${family.name}`}
          aria-pressed={favorite}
          onClick={(e) => {
            e.stopPropagation();
            playStar(!favorite);
            void toggleFavorite(family.name);
          }}
          whileTap={{ scale: 0.85 }}
        >
          <Star size={14} strokeWidth={1.5} />
        </motion.button>
        <PillToggle
          on={family.active}
          disabled={!family.deactivatable}
          onChange={(on) => void setFamilyActive(family.name, on)}
          label={`${family.active ? "Deactivate" : "Activate"} ${family.name}`}
        />
      </header>

      <div className="card-preview" style={{ minHeight: size * 1.35 }}>
        <AnimatePresence mode="wait">
          {fontFamily ? (
            <motion.p
              key="real"
              className="preview-text"
              style={{
                fontFamily,
                fontSize: size,
                fontStyle: lead.italic ? "italic" : "normal",
              }}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={spring}
            >
              {text}
            </motion.p>
          ) : failed ? (
            <p key="failed" className="preview-text preview-failed">
              This format can't be previewed yet
            </p>
          ) : (
            <motion.span
              key="skeleton"
              className="skeleton preview-skeleton"
              style={{ height: size * 1.1 }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
            />
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            className="card-styles"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0, transition: { ...springSnappy } }}
            transition={springSoft}
          >
            {family.faces.map((face, i) => (
              <FacePreview
                key={face.id}
                face={face}
                text={text}
                size={size}
                index={i}
                synthesize={family.faces.filter((f) => f.path === face.path).length > 1}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
});
