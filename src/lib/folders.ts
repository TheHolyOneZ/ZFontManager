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
