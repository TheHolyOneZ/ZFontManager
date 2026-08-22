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
import { t } from "./i18n";

export async function exportFamily(family: Family) {
  const dir = await open({
    directory: true,
    title: t("menu.exportFamilyTitle", { name: family.name }),
  });
  if (!dir) return;
  const paths = [...new Set(family.faces.map((f) => f.path))];
  try {
    const n = await ipc.exportFonts(paths, dir);
    toast.success(
      t("toast.exported", { name: family.name }),
      t("toast.filesCopied", { count: n, dir }),
    );
  } catch (e) {
    toast.error(t("toast.exportFailed"), String(e));
  }
}

export async function exportFace(path: string, suggestedName: string) {
  const dest = await save({
    defaultPath: suggestedName,
    title: t("menu.exportFontFile"),
  });
  if (!dest) return;
  try {
    await ipc.exportFont(path, dest);
    toast.success(t("toast.fontExported"), dest);
  } catch (e) {
    toast.error(t("toast.exportFailed"), String(e));
  }
}

function copyText(text: string, what: string) {
  navigator.clipboard
    .writeText(text)
    .then(() => toast.success(t("toast.copied", { what }), undefined, "tick"))
    .catch((e) => toast.error(t("toast.couldntCopy"), String(e)));
}

async function exportFamilies(families: Family[]) {
  const dir = await open({
    directory: true,
    title: t("menu.exportFamiliesTitle", { count: families.length }),
  });
  if (!dir) return;
  const paths = [...new Set(families.flatMap((f) => f.faces.map((x) => x.path)))];
  try {
    const n = await ipc.exportFonts(paths, dir);
    toast.success(
      t("toast.exportedFamilies", { count: families.length }),
      t("toast.filesCopied", { count: n, dir }),
    );
  } catch (e) {
    toast.error(t("toast.exportFailed"), String(e));
  }
}


export async function exportFontList(families: Family[], title: string) {
  const dest = await save({
    defaultPath: `${title.replace(/[^\w-]+/g, "-").toLowerCase()}-fonts.md`,
    title: t("menu.exportListTitle"),
  });
  if (!dest) return;
  const lines = [
    `# ${t("fontlist.title", { title })}`,
    "",
    t("fontlist.sub", { count: families.length }),
    "",
    ...families.flatMap((f) => [
      `## ${f.name}`,
      `- ${t("fontlist.styles")}: ${f.faces.map((x) => x.style).join(", ")}`,
      `- ${t("fontlist.format")}: ${f.formats.join(", ").toUpperCase()}${
        f.isVariable ? ` (${t("fontlist.variable")})` : ""
      }`,
      ...(f.foundry ? [`- ${t("fontlist.foundry")}: ${f.foundry}`] : []),
      "",
    ]),
  ];
  try {
    await ipc.writeTextFile(dest, lines.join("\n"));
    toast.success(t("toast.fontListExported"), dest);
  } catch (e) {
    toast.error(t("toast.exportFailed"), String(e));
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
    { kind: "heading", label: t("menu.selectedCount", { count: n }) },
    {
      label: t("menu.compareCount", { count: Math.min(n, 4) }),
      icon: <Columns2 size={14} strokeWidth={1.5} />,
      disabled: n < 2,
      action: () => s.openCompare(names),
    },
    { kind: "separator" },
    {
      label: t("menu.activateCount", { count: n }),
      icon: <Power size={14} strokeWidth={1.5} />,
      action: () => void s.setFamiliesActiveBulk(names, true),
    },
    {
      label: t("menu.deactivateCount", { count: n }),
      icon: <Power size={14} strokeWidth={1.5} />,
      action: () => void s.setFamiliesActiveBulk(names, false),
    },
    { kind: "separator" },
    { kind: "heading", label: t("menu.addAllToCollection") },
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
    { kind: "heading", label: t("menu.tagAll") },
    ...[...allTags(s.tags).keys()].map(
      (tag): MenuItem => ({
        kind: "check",
        label: tag,
        checked: names.every((f) => (s.tags[f] ?? []).includes(tag)),
        action: () => void s.applyTagToFamilies(tag, names),
      }),
    ),
    {
      label: t("menu.newTag"),
      icon: <Plus size={14} strokeWidth={1.5} />,
      action: () => s.setBulkTagFor(names),
    },
    { kind: "separator" },
    {
      label: t("menu.exportFamiliesCount", { count: n }),
      icon: <Download size={14} strokeWidth={1.5} />,
      action: () => void exportFamilies(families),
    },
    {
      label: t("menu.exportFontList"),
      icon: <FileText size={14} strokeWidth={1.5} />,
      action: () => void exportFontList(families, t("menu.selection")),
    },
    {
      label: t("menu.moveCountToTrash", { count: n }),
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
      label: t(family.active ? "menu.deactivate" : "menu.activate"),
      icon: <Power size={14} strokeWidth={1.5} />,
      disabled: !family.deactivatable,
      action: () => void s.setFamilyActive(family.name, !family.active),
    },
    ...(!family.active && family.deactivatable
      ? [
          {
            label: t("menu.activateUntilClose"),
            icon: <Timer size={14} strokeWidth={1.5} />,
            action: () => void useFontStore.getState().activateFamilySession(family.name),
          } satisfies MenuItem,
        ]
      : []),
    {
      label: t(favorite ? "menu.removeFromFavorites" : "menu.addToFavorites"),
      icon: <Star size={14} strokeWidth={1.5} />,
      action: () => void s.toggleFavorite(family.name),
    },
    { kind: "separator" },
    { kind: "heading", label: t("menu.collections") },
    ...collectionNames.map(
      (name): MenuItem => ({
        kind: "check",
        label: name,
        checked: (s.collections[name] ?? []).includes(family.name),
        action: () => void s.toggleFamilyInCollection(name, family.name),
      }),
    ),
    {
      label: t("menu.newCollection"),
      icon: <FolderPlus size={14} strokeWidth={1.5} />,
      action: () => useFontStore.setState({ pendingCollectionFor: family.name }),
    },
    { kind: "separator" },
    {
      label: t("menu.exportFamily"),
      icon: <Download size={14} strokeWidth={1.5} />,
      action: () => void exportFamily(family),
    },
    {
      label: t("menu.exportSpecimen"),
      icon: <ImageIcon size={14} strokeWidth={1.5} />,
      action: () => void exportSpecimen(family, useFontStore.getState().sampleText),
    },
    {
      label: t("menu.copyFamilyName"),
      icon: <Copy size={14} strokeWidth={1.5} />,
      action: () => copyText(family.name, t("copy.familyName")),
    },
    {
      label: t("menu.copyFilePath"),
      icon: <Copy size={14} strokeWidth={1.5} />,
      action: () => copyText(lead.path, t("copy.filePath")),
    },
    {
      label: t("menu.showInFileManager"),
      icon: <FolderOpen size={14} strokeWidth={1.5} />,
      action: () =>
        revealItemInDir(lead.path).catch((e) =>
          toast.error(t("toast.couldntOpenFileManager"), String(e)),
        ),
    },
  ];

  if (canUninstall) {
    items.push(
      { kind: "separator" },
      {
        label: t("menu.moveToTrash"),
        icon: <Trash2 size={14} strokeWidth={1.5} />,
        danger: true,
        action: () => void s.uninstallFamily(family.name),
      },
    );
  }
  return items;
}
