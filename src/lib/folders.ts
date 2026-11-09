export function inFolder(path: string, dir: string): boolean {
  const base = dir.replace(/[\\/]+$/, "");
  return (
    path.length > base.length &&
    path.startsWith(base) &&
    (path[base.length] === "/" || path[base.length] === "\\")
  );
}

export function folderLabel(dir: string): string {
  const parts = dir.split(/[\\/]+/).filter(Boolean);
  return parts[parts.length - 1] ?? dir;
}

export function subfolderOf(path: string, dir: string): string | null {
  if (!inFolder(path, dir)) return null;
  const base = dir.replace(/[\\/]+$/, "");
  const rest = path.slice(base.length + 1).split(/[\\/]+/).filter(Boolean);
  return rest.length > 1 ? rest[0] : null;
}

export function folderGroups(
  families: { name: string; faces: { path: string }[] }[],
  dir: string,
  perSubfolder: boolean,
): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const family of families) {
    for (const face of family.faces) {
      if (!inFolder(face.path, dir)) continue;
      const key = perSubfolder ? subfolderOf(face.path, dir) : folderLabel(dir);
      if (!key) continue;
      const list = groups.get(key) ?? [];
      if (!list.includes(family.name)) list.push(family.name);
      groups.set(key, list);
    }
  }
  return groups;
}
