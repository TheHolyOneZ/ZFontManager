

import { save } from "@tauri-apps/plugin-dialog";
import { toast } from "../design/primitives/Toast";
import { loadFaceCss } from "./fontLoader";
import { ipc } from "./ipc";
import type { Family } from "../state/fontStore";

const W = 1100;
const PAD = 72;
const SCALE = 2;
const WATERFALL = [14, 20, 28, 40, 56];
const INK = "#16161f";
const SUB = "rgba(22, 22, 32, 0.55)";
const FAINT = "rgba(22, 22, 32, 0.14)";
const UI = '"Inter Variable", "Inter", system-ui, sans-serif';

function ellipsize(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t}…`;
}

export async function exportSpecimen(family: Family, sampleText: string) {
  const dest = await save({
    title: "Export specimen",
    defaultPath: `${family.name.replace(/[\\/:*?"<>|]/g, "-")} specimen.png`,
    filters: [{ name: "PNG image", extensions: ["png"] }],
  });
  if (!dest) return;
  try {
    const bytes = await renderSpecimenPng(family, sampleText);
    await ipc.writeBinaryFile(dest, Array.from(bytes));
    toast.success("Specimen exported", dest, "install");
  } catch (e) {
    toast.error("Couldn't export specimen", String(e));
  }
}

export async function renderSpecimenPng(
  family: Family,
  sampleText: string,
): Promise<Uint8Array> {
  const lead =
    family.faces.find((f) => f.style === "Regular") ?? family.faces[0];
  {
    const css = await loadFaceCss(lead);
    await document.fonts.load(`16px "${css}"`);

    // Style names, each in its own face when it loads (best effort).
    const styles = await Promise.all(
      family.faces.slice(0, 12).map(async (f) => ({
        label: f.style,
        css: await loadFaceCss(f).catch(() => null),
        italic: f.italic,
      })),
    );

    const text = sampleText.trim() || "The quick brown fox jumps over the lazy dog";
    const inner = W - PAD * 2;

    // Measure style-row wrapping before sizing the canvas.
    const meter = document.createElement("canvas").getContext("2d");
    if (!meter) throw new Error("canvas unavailable");
    let styleLines = 1;
    {
      let x = 0;
      for (const s of styles) {
        meter.font = `${s.italic ? "italic " : ""}18px ${s.css ? `"${s.css}"` : UI}`;
        const w = meter.measureText(s.label).width + 28;
        if (x + w > inner && x > 0) {
          styleLines++;
          x = 0;
        }
        x += w;
      }
    }

    const headH = 148;
    const stripsH = 3 * 36 + 24;
    const waterfallH = WATERFALL.reduce((a, px) => a + px + 20, 0) + 24;
    const stylesH = styles.length > 1 ? 40 + styleLines * 30 : 0;
    const H = PAD + headH + stripsH + waterfallH + stylesH + 70;

    const canvas = document.createElement("canvas");
    canvas.width = W * SCALE;
    canvas.height = H * SCALE;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas unavailable");
    ctx.scale(SCALE, SCALE);

    ctx.fillStyle = "#fdfdfe";
    ctx.fillRect(0, 0, W, H);
    ctx.textBaseline = "alphabetic";

    let y = PAD;

    // Header: the family name set in itself
    ctx.fillStyle = INK;
    ctx.font = `44px "${css}"`;
    ctx.fillText(ellipsize(ctx, family.name, inner), PAD, y + 44);
    y += 74;
    ctx.fillStyle = SUB;
    ctx.font = `13px ${UI}`;
    const meta = [
      `${family.faces.length} style${family.faces.length === 1 ? "" : "s"}`,
      family.formats.join(" · ").toUpperCase(),
      family.foundry ?? undefined,
      family.classification !== "unknown" ? family.classification : undefined,
    ]
      .filter(Boolean)
      .join("   ·   ");
    ctx.fillText(ellipsize(ctx, meta, inner), PAD, y + 13);
    y += 44;
    ctx.strokeStyle = FAINT;
    ctx.beginPath();
    ctx.moveTo(PAD, y);
    ctx.lineTo(W - PAD, y);
    ctx.stroke();
    y += 30;

    // Alphabet strips
    ctx.fillStyle = INK;
    ctx.font = `22px "${css}"`;
    for (const strip of [
      "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
      "abcdefghijklmnopqrstuvwxyz",
      "0123456789 .,;:!?&@#%()[]{}",
    ]) {
      ctx.fillText(ellipsize(ctx, strip, inner), PAD, y + 22);
      y += 36;
    }
    y += 24;

    // Waterfall
    for (const px of WATERFALL) {
      ctx.fillStyle = SUB;
      ctx.font = `10px ${UI}`;
      ctx.fillText(String(px), PAD, y + px - 2);
      ctx.fillStyle = INK;
      ctx.font = `${px}px "${css}"`;
      ctx.fillText(ellipsize(ctx, text, inner - 34), PAD + 34, y + px);
      y += px + 20;
    }
    y += 24;

    // Styles, each in its own face
    if (styles.length > 1) {
      ctx.fillStyle = SUB;
      ctx.font = `10px ${UI}`;
      ctx.fillText("STYLES", PAD, y + 10);
      y += 34;
      let x = PAD;
      for (const s of styles) {
        ctx.font = `${s.italic ? "italic " : ""}18px ${s.css ? `"${s.css}"` : UI}`;
        const w = ctx.measureText(s.label).width + 28;
        if (x + w > PAD + inner && x > PAD) {
          x = PAD;
          y += 30;
        }
        ctx.fillStyle = INK;
        ctx.fillText(s.label, x, y);
        x += w;
      }
      y += 30;
    }

    // Footer
    ctx.strokeStyle = FAINT;
    ctx.beginPath();
    ctx.moveTo(PAD, H - 52);
    ctx.lineTo(W - PAD, H - 52);
    ctx.stroke();
    ctx.fillStyle = SUB;
    ctx.font = `10px ${UI}`;
    ctx.fillText(new Date().toISOString().slice(0, 10), PAD, H - 30);
    const brand = "Specimen · ZFontManager";
    ctx.fillText(brand, W - PAD - ctx.measureText(brand).width, H - 30);

    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
    if (!blob) throw new Error("couldn't encode PNG");
    return new Uint8Array(await blob.arrayBuffer());
  }
}
