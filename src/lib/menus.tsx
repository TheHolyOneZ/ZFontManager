import { open, save } from "@tauri-apps/plugin-dialog";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import {
  Columns2,
  Copy,
  Plus,
  Download,
  FileText,
  FolderOpen,
  FolderPlus,
  Image as ImageIcon,
  Power,
  Star,
  Timer,
  Trash2,
} from "lucide-react";
import type { MenuItem } from "../design/primitives/ContextMenu";
import { toast } from "../design/primitives/Toast";
import { allTags, familiesFor, useFontStore, type Family } from "../state/fontStore";
import { ipc } from "./ipc";
import { exportSpecimen } from "./specimen";

export async function exportFamily(family: Family) {
  const dir = await open({
    directory: true,
    title: `Export ${family.name} — choose a folder`,
  });
  if (!dir) return;
  const paths = [...new Set(family.faces.map((f) => f.path))];
  try {
    const n = await ipc.exportFonts(paths, dir);
    toast.success(
      `Exported ${family.name}`,
      `${n} file${n === 1 ? "" : "s"} copied to ${dir}`,
    );
  } catch (e) {
    toast.error("Export failed", String(e));
  }
}

export async function exportFace(path: string, suggestedName: string) {
  const dest = await save({
    defaultPath: suggestedName,
    title: "Export font file",
  });
  if (!dest) return;
  try {
    await ipc.exportFont(path, dest);
    toast.success("Font exported", dest);
  } catch (e) {
    toast.error("Export failed", String(e));
  }
}

function copyText(text: string, what: string) {
  navigator.clipboard
    .writeText(text)
    .then(() => toast.success(`${what} copied`, undefined, "tick"))
    .catch((e) => toast.error("Couldn't copy", String(e)));
}

async function exportFamilies(families: Family[]) {
  const dir = await open({
    directory: true,
    title: `Export ${families.length} families — choose a folder`,
  });
  if (!dir) return;
  const paths = [...new Set(families.flatMap((f) => f.faces.map((x) => x.path)))];
  try {
    const n = await ipc.exportFonts(paths, dir);
    toast.success(`Exported ${families.length} families`, `${n} files copied to ${dir}`);
  } catch (e) {
    toast.error("Export failed", String(e));
  }
}


export async function exportFontList(families: Family[], title: string) {
  const dest = await save({
    defaultPath: `${title.replace(/[^\w-]+/g, "-").toLowerCase()}-fonts.md`,
    title: "Export font list (metadata only)",
  });
  if (!dest) return;
  const lines = [
    `# ${title} — font list`,
    "",
    `${families.length} families · exported by ZFontManager`,
    "",
    ...families.flatMap((f) => [
      `## ${f.name}`,
      `- Styles: ${f.faces.map((x) => x.style).join(", ")}`,
      `- Format: ${f.formats.join(", ").toUpperCase()}${f.isVariable ? " (variable)" : ""}`,
      ...(f.foundry ? [`- Foundry: ${f.foundry}`] : []),
      "",
    ]),
  ];
  try {
    await ipc.writeTextFile(dest, lines.join("\n"));
    toast.success("Font list exported", dest);
  } catch (e) {
    toast.error("Export failed", String(e));
  }
}


function buildBulkMenu(names: string[]): MenuItem[] {
  const s = useFontStore.getState();
  const familyMap = familiesFor(s.fonts, s.tags);
  const families = names
    .map((n) => familyMap.get(n))
    .filter((f): f is Family => Boolean(f));
  const collectionNames = Object.keys(s.collections).sort((a, b) => a.localeCompare(b));
  const n = names.length;

  return [
    { kind: "heading", label: `${n} fonts selected` },
    {
      label: `Compare ${Math.min(n, 4)} fonts`,
      icon: <Columns2 size={14} strokeWidth={1.5} />,
      disabled: n < 2,
      action: () => s.openCompare(names),
    },
    { kind: "separator" },
    {
      label: `Activate ${n}`,
      icon: <Power size={14} strokeWidth={1.5} />,
      action: () => void s.setFamiliesActiveBulk(names, true),
    },
    {
      label: `Deactivate ${n}`,
      icon: <Power size={14} strokeWidth={1.5} />,
      action: () => void s.setFamiliesActiveBulk(names, false),
    },
    { kind: "separator" },
    { kind: "heading", label: "Add all to collection" },
    ...collectionNames.map(
      (name): MenuItem => ({
        kind: "check",
        label: name,
        checked: names.every((f) => (s.collections[name] ?? []).includes(f)),
        action: () => {
          const current = s.collections[name] ?? [];
          const all = names.every((f) => current.includes(f));
          const next = all
            ? current.filter((f) => !names.includes(f))
            : [...new Set([...current, ...names])];
          void ipc.setCollection(name, next).then(() =>
            useFontStore.setState({
              collections: { ...useFontStore.getState().collections, [name]: next },
            }),
          );
        },
      }),
    ),
    { kind: "separator" },
    { kind: "heading", label: "Tag all" },
    ...[...allTags(s.tags).keys()].map(
      (tag): MenuItem => ({
        kind: "check",
        label: tag,
        checked: names.every((f) => (s.tags[f] ?? []).includes(tag)),
        action: () => void s.applyTagToFamilies(tag, names),
      }),
    ),
    {
      label: "New tag…",
      icon: <Plus size={14} strokeWidth={1.5} />,
      action: () => s.setBulkTagFor(names),
    },
    { kind: "separator" },
    {
      label: `Export ${n} families…`,
      icon: <Download size={14} strokeWidth={1.5} />,
      action: () => void exportFamilies(families),
    },
    {
      label: "Export font list (metadata)…",
      icon: <FileText size={14} strokeWidth={1.5} />,
      action: () => void exportFontList(families, "Selection"),
    },
    {
      label: `Move ${n} to Trash`,
      icon: <Trash2 size={14} strokeWidth={1.5} />,
      danger: true,
      action: () => {
        for (const f of names) void s.uninstallFamily(f);
      },
    },
  ];
}


export function buildFamilyMenu(family: Family): MenuItem[] {
  const s = useFontStore.getState();
  if (s.selection.length > 1 && s.selection.includes(family.name)) {
    return buildBulkMenu(s.selection);
  }
  const lead = family.faces[0];
  const collectionNames = Object.keys(s.collections).sort((a, b) =>
    a.localeCompare(b),
  );
  const canUninstall = family.faces.some((f) => f.source !== "system");

  const favorite = s.favorites.includes(family.name);
  const items: MenuItem[] = [
    {
      label: family.active ? "Deactivate" : "Activate",
      icon: <Power size={14} strokeWidth={1.5} />,
      disabled: !family.deactivatable,
      action: () => void s.setFamilyActive(family.name, !family.active),
    },
    ...(!family.active && family.deactivatable
      ? [
          {
            label: "Activate until close",
            icon: <Timer size={14} strokeWidth={1.5} />,
            action: () => void useFontStore.getState().activateFamilySession(family.name),
          } satisfies MenuItem,
        ]
      : []),
    {
      label: favorite ? "Remove from Favorites" : "Add to Favorites",
      icon: <Star size={14} strokeWidth={1.5} />,
      action: () => void s.toggleFavorite(family.name),
    },
    { kind: "separator" },
    { kind: "heading", label: "Collections" },
    ...collectionNames.map(
      (name): MenuItem => ({
        kind: "check",
        label: name,
        checked: (s.collections[name] ?? []).includes(family.name),
        action: () => void s.toggleFamilyInCollection(name, family.name),
      }),
    ),
    {
      label: "New collection…",
      icon: <FolderPlus size={14} strokeWidth={1.5} />,
      action: () => useFontStore.setState({ pendingCollectionFor: family.name }),
    },
    { kind: "separator" },
    {
      label: "Export family…",
      icon: <Download size={14} strokeWidth={1.5} />,
      action: () => void exportFamily(family),
    },
    {
      label: "Export specimen…",
      icon: <ImageIcon size={14} strokeWidth={1.5} />,
      action: () => void exportSpecimen(family, useFontStore.getState().sampleText),
    },
    {
      label: "Copy family name",
      icon: <Copy size={14} strokeWidth={1.5} />,
      action: () => copyText(family.name, "Family name"),
    },
    {
      label: "Copy file path",
      icon: <Copy size={14} strokeWidth={1.5} />,
      action: () => copyText(lead.path, "File path"),
    },
    {
      label: "Show in file manager",
      icon: <FolderOpen size={14} strokeWidth={1.5} />,
      action: () =>
        revealItemInDir(lead.path).catch((e) =>
          toast.error("Couldn't open file manager", String(e)),
        ),
    },
  ];

  if (canUninstall) {
    items.push(
      { kind: "separator" },
      {
        label: "Move to Trash",
        icon: <Trash2 size={14} strokeWidth={1.5} />,
        danger: true,
        action: () => void s.uninstallFamily(family.name),
      },
    );
  }
  return items;
}
