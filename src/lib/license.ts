

export type LicenseClass = "open" | "restrictive" | "unknown";

const OPEN_MARKERS = [
  "sil open font license",
  "open font license",
  "ofl",
  "apache license",
  "mit license",
  "gnu general public license",
  "gpl",
  "public domain",
  "cc0",
  "free for commercial",
  "freely available",
  "ubuntu font licence",
];

const RESTRICTIVE_MARKERS = [
  "may not be modified",
  "may not be redistributed",
  "not be sold",
  "non-commercial",
  "noncommercial",
  "personal use only",
  "evaluation only",
  "evaluation purposes",
  "trial version",
  "demo version",
  "all rights reserved. this font",
  "purchase a license",
  "requires a license",
];

export function classifyLicense(text: string | null): LicenseClass {
  if (!text) return "unknown";
  const t = text.toLowerCase();
  if (RESTRICTIVE_MARKERS.some((m) => t.includes(m))) return "restrictive";
  if (OPEN_MARKERS.some((m) => t.includes(m))) return "open";
  return "unknown";
}
