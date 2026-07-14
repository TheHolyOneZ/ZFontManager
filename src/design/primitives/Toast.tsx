import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, XCircle } from "lucide-react";
import { create } from "zustand";
import { springBouncy } from "../springs";
import { playError, playKind } from "../../lib/sound";

type Kind = "success" | "error";

interface ToastAction {
  label: string;
  run: () => void;
}

interface ToastItem {
  id: number;
  kind: Kind;
  title: string;
  detail?: string;
  action?: ToastAction;
}

interface ToastStore {
  toasts: ToastItem[];
  push: (kind: Kind, title: string, detail?: string, sound?: string, action?: ToastAction) => void;
  dismiss: (id: number) => void;
  pause: (id: number) => void;
  resume: (id: number) => void;
}

let nextId = 1;
const timers = new Map<number, ReturnType<typeof setTimeout>>();

function arm(id: number, ms: number, dismiss: (id: number) => void) {
  clearTimeout(timers.get(id));
  timers.set(
    id,
    setTimeout(() => {
      timers.delete(id);
      dismiss(id);
    }, ms),
  );
}

const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],
  push: (kind, title, detail, sound, action) => {
    if (kind === "success") playKind(sound ?? "success");
    else playError();
    const id = nextId++;
    set({ toasts: [...get().toasts, { id, kind, title, detail, action }] });

    arm(id, kind === "error" ? 7000 : action ? 6500 : 4000, get().dismiss);
  },
  dismiss: (id) => {
    clearTimeout(timers.get(id));
    timers.delete(id);
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },

  pause: (id) => clearTimeout(timers.get(id)),
  resume: (id) => arm(id, 1600, get().dismiss),
}));

export const toast = {

  success: (title: string, detail?: string, sound?: string, action?: ToastAction) =>
    useToastStore.getState().push("success", title, detail, sound, action),
  error: (title: string, detail?: string) =>
    useToastStore.getState().push("error", title, detail),
};

export function Toaster() {
  const { toasts, dismiss, pause, resume } = useToastStore();
  return (
    <div className="toaster">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            className={`toast glass-e3 toast-${t.kind}`}
            role="status"
            initial={{ opacity: 0, x: 40, y: -10, scale: 0.94 }}
            animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
            exit={{
              opacity: 0,
              x: 32,
              scale: 0.96,
              transition: { duration: 0.16, ease: "easeIn" },
            }}
            transition={springBouncy}
            onClick={() => dismiss(t.id)}
            onMouseEnter={() => pause(t.id)}
            onMouseLeave={() => resume(t.id)}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.97 }}
            layout
          >
            {t.kind === "success" ? (
              <CheckCircle2 size={16} strokeWidth={2} className="toast-icon success" />
            ) : (
              <XCircle size={16} strokeWidth={2} className="toast-icon error" />
            )}
            <span>
              <span className="toast-title">{t.title}</span>
              {t.detail && <span className="toast-detail">{t.detail}</span>}
            </span>
            {t.action && (
              <button
                className="toast-action"
                onClick={(e) => {
                  e.stopPropagation();
                  dismiss(t.id);
                  t.action?.run();
                }}
              >
                {t.action.label}
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
