import { getCurrentWindow } from "@tauri-apps/api/window";

type Direction = Parameters<
  ReturnType<typeof getCurrentWindow>["startResizeDragging"]
>[0];

const GRIPS: { cls: string; dir: Direction }[] = [
  { cls: "resize-n", dir: "North" },
  { cls: "resize-s", dir: "South" },
  { cls: "resize-w", dir: "West" },
  { cls: "resize-e", dir: "East" },
  { cls: "resize-nw", dir: "NorthWest" },
  { cls: "resize-ne", dir: "NorthEast" },
  { cls: "resize-sw", dir: "SouthWest" },
  { cls: "resize-se", dir: "SouthEast" },
];

export function ResizeGrips() {
  const start = (dir: Direction) => (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    void getCurrentWindow().startResizeDragging(dir);
  };

  return (
    <>
      {GRIPS.map((g) => (
        <div
          key={g.cls}
          className={`resize-grip ${g.cls}`}
          onPointerDown={start(g.dir)}
          aria-hidden="true"
        />
      ))}
    </>
  );
}
