import { open, save } from "@tauri-apps/plugin-dialog";
import { Check, ClipboardCopy, FileDown, FileUp, RotateCcw } from "lucide-react";
import { useContext, useSyncExternalStore } from "react";
import {
  deriveTokens,
  PRESETS,
  RADIUS_STEPS,
  resolvedPreset,
  themeFromJson,
  themeToJson,
  TOKEN_GROUPS,
  tokensFor,
  type Preset,
  type PresetCustom,
  type TokenGroup,
  type TokenKey,
} from "../../lib/appearance";
import { resolveTheme } from "../../lib/theme";
import { ipc } from "../../lib/ipc";
import { useT, type TKey } from "../../lib/i18n";
import { toast } from "../../design/primitives/Toast";
import { PillToggle } from "../../design/primitives/PillToggle";
import { useFontStore } from "../../state/fontStore";
import { ColorField } from "../ColorPicker";
import { FontPicker } from "../FontPicker";
import { Group, matchesQuery, Row, Segmented, SettingsQuery } from "./kit";

const lightQuery = window.matchMedia("(prefers-color-scheme: light)");
function subscribeScheme(cb: () => void) {
  lightQuery.addEventListener("change", cb);
  return () => lightQuery.removeEventListener("change", cb);
}

function PresetCard({
  preset,
  custom,
  selected,
  live,
  onPick,
}: {
  preset: Preset;
  custom?: PresetCustom;
  selected: boolean;
  live: boolean;
  onPick: () => void;
}) {
  const t = useT();
  const k = deriveTokens(preset, custom);
  return (
    <button
      className={`preset ${selected ? "is-selected" : ""} ${live ? "is-live" : ""}`}
      onClick={onPick}
      aria-pressed={selected}
      title={live ? t("appearance.presetLive") : undefined}
    >
      <span className="preset-art" style={{ background: k.canvas, borderColor: k.line }}>
        <span className="preset-side" style={{ background: k.sidebar, borderColor: k.line }}>
          <span style={{ background: k.textMuted }} />
          <span style={{ background: k.accent, opacity: 0.9 }} />
          <span style={{ background: k.textMuted }} />
        </span>
        <span className="preset-card" style={{ background: k.card, borderColor: k.line }}>
          <span className="preset-aa" style={{ color: k.specimen }}>
            Ag
          </span>
          <span className="preset-toggle" style={{ background: k.toggleOn }}>
            <span style={{ background: k.toggleThumb }} />
          </span>
        </span>
      </span>
      <span className="preset-meta">
        <span className="preset-name">{preset.name}</span>
        {selected && <Check size={12} strokeWidth={2.4} />}
      </span>
    </button>
  );
}

const TOKEN_LABEL = (key: TokenKey) => `token.${key}` as TKey;
const GROUP_LABEL = (key: TokenGroup) => `token.group.${key}` as TKey;

export function AppearancePage() {
  const t = useT();
  const query = useContext(SettingsQuery);
  const themePref = useFontStore((s) => s.themePref);
  const setThemePref = useFontStore((s) => s.setThemePref);
  const appearance = useFontStore((s) => s.appearance);
  const setAppearance = useFontStore((s) => s.setAppearance);
  const motionPref = useFontStore((s) => s.motionPref);
  const setMotionPref = useFontStore((s) => s.setMotionPref);
  const transparencyPref = useFontStore((s) => s.transparencyPref);
  const setTransparencyPref = useFontStore((s) => s.setTransparencyPref);
  const uiScale = useFontStore((s) => s.uiScale);
  const appliedScale = useFontStore((s) => s.appliedScale);
  const setUiScale = useFontStore((s) => s.setUiScale);
  useSyncExternalStore(subscribeScheme, () => lightQuery.matches);

  const base = resolveTheme(themePref);
  const preset = resolvedPreset(appearance, base);
  const custom = appearance.custom[preset.id] ?? {};
  const tokens = tokensFor(appearance, base);
  const pristine = deriveTokens(preset, custom.accent ? { accent: custom.accent } : undefined);
  const touched = Boolean(custom.accent) || Object.keys(custom.tokens ?? {}).length > 0;

  const setCustom = (next: PresetCustom) => {
    const all = { ...appearance.custom };
    const empty = !next.accent && Object.keys(next.tokens ?? {}).length === 0;
    if (empty) delete all[preset.id];
    else all[preset.id] = next;
    setAppearance({ ...appearance, custom: all });
  };

  const pickPreset = (p: Preset) => {
    const next = p.base === "dark" ? { ...appearance, darkPreset: p.id } : { ...appearance, lightPreset: p.id };
    setAppearance(next, true);
    if (themePref !== "system" && themePref !== p.base) setThemePref(p.base);
  };

  const setAccent = (hex: string) => {
    const tokensLeft = { ...(custom.tokens ?? {}) };
    for (const key of ["selection", "focus", "toggleOn", "slider", "badgeVariable"] as TokenKey[]) delete tokensLeft[key];
    setCustom({ ...custom, accent: hex === preset.seed.accent ? undefined : hex, tokens: tokensLeft });
  };

  const setToken = (key: TokenKey, hex: string) => {
    if (key === "accent") {
      setCustom({ ...custom, accent: hex === preset.seed.accent ? undefined : hex });
      return;
    }
    const next = { ...(custom.tokens ?? {}) };
    if (hex === pristine[key]) delete next[key];
    else next[key] = hex;
    setCustom({ ...custom, tokens: next });
  };

  const resetToken = (key: TokenKey) => {
    if (key === "accent") {
      setCustom({ ...custom, accent: undefined });
      return;
    }
    const next = { ...(custom.tokens ?? {}) };
    delete next[key];
    setCustom({ ...custom, tokens: next });
  };

  const exportTheme = async () => {
    const dest = await save({
      title: t("appearance.exportTitle"),
      defaultPath: `zfontmanager-${preset.id}.json`,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (!dest) return;
    try {
      await ipc.writeTextFile(dest, themeToJson(appearance, base));
      toast.success(t("appearance.exported"));
    } catch (e) {
      toast.error(t("appearance.exportFailed"), String(e));
    }
  };

  const importTheme = async () => {
    const src = await open({
      title: t("appearance.importTitle"),
      multiple: false,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (typeof src !== "string") return;
    try {
      const parsed = themeFromJson(await ipc.readTextFile(src));
      if (!parsed) {
        toast.error(t("appearance.importInvalid"));
        return;
      }
      const target = PRESETS.find((p) => p.id === parsed.preset)!;
      const { accent, ...rest } = parsed.tokens;
      const derived = deriveTokens(target, accent ? { accent } : undefined);
      const diff: Partial<Record<TokenKey, string>> = {};
      for (const [key, value] of Object.entries(rest) as [TokenKey, string][]) {
        if (derived[key] !== value) diff[key] = value;
      }
      const next = {
        ...appearance,
        [parsed.base === "dark" ? "darkPreset" : "lightPreset"]: target.id,
        custom: {
          ...appearance.custom,
          [target.id]: {
            accent: accent && accent !== target.seed.accent ? accent : undefined,
            tokens: diff,
          },
        },
      };
      setAppearance(next, true);
      if (themePref !== "system") setThemePref(parsed.base);
      toast.success(t("appearance.imported"));
    } catch (e) {
      toast.error(t("appearance.importFailed"), String(e));
    }
  };

  const copyTheme = () => {
    navigator.clipboard
      .writeText(themeToJson(appearance, base))
      .then(() => toast.success(t("appearance.copied")))
      .catch(() => {});
  };

  const showPresets = matchesQuery(query, t("appearance.themes"), t("appearance.themesSub"), "theme preset dark light");
  const radiusOptions = [
    { value: RADIUS_STEPS[0], label: t("appearance.cornersSquare") },
    { value: RADIUS_STEPS[1], label: t("appearance.cornersTight") },
    { value: RADIUS_STEPS[2], label: t("appearance.cornersDefault") },
    { value: RADIUS_STEPS[3], label: t("appearance.cornersRound") },
  ];

  return (
    <>
      <Group title={t("appearance.theme")}>
        <Row label={t("appearance.mode")} sub={t("settings.themeSub")} keywords="dark light system theme">
          <Segmented
            value={themePref}
            label={t("settings.theme")}
            onChange={(m) => setThemePref(m)}
            options={(["dark", "light", "system"] as const).map((m) => ({ value: m, label: t(`theme.${m}`) }))}
          />
        </Row>
        {showPresets && (
          <div className="set-row set-row-stack" data-tour="themes">
            <div className="set-row-text">
              <div className="set-label">{t("appearance.themes")}</div>
              <div className="set-sub">{t("appearance.themesSub")}</div>
            </div>
            {(["dark", "light"] as const).map((b) => (
              <div key={b} className="preset-band">
                <div className="preset-band-label">{t(`theme.${b}`)}</div>
                <div className="preset-grid">
                  {PRESETS.filter((p) => p.base === b).map((p) => (
                    <PresetCard
                      key={p.id}
                      preset={p}
                      custom={appearance.custom[p.id]}
                      selected={(b === "dark" ? appearance.darkPreset : appearance.lightPreset) === p.id}
                      live={p.id === preset.id}
                      onPick={() => pickPreset(p)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Group>

      <Group
        title={t("appearance.customize", { name: preset.name })}
        aside={
          <Segmented
            value={appearance.editor}
            label={t("appearance.editorMode")}
            onChange={(editor) => setAppearance({ ...appearance, editor })}
            options={[
              { value: "simple", label: t("appearance.simple") },
              { value: "advanced", label: t("appearance.advanced") },
            ]}
          />
        }
      >
        {appearance.editor === "simple" || query ? (
          <>
            <Row label={t("appearance.accent")} sub={t("appearance.accentSub")} keywords="color colour highlight">
              <div className="accent-row">
                {preset.swatches.map((sw) => (
                  <button
                    key={sw}
                    className={`accent-dot ${tokens.accent === sw ? "is-on" : ""}`}
                    style={{ background: sw }}
                    aria-label={sw}
                    title={sw}
                    onClick={() => setAccent(sw)}
                  />
                ))}
                <ColorField
                  value={tokens.accent}
                  onChange={setAccent}
                  label={t("appearance.accent")}
                  swatches={preset.swatches}
                />
              </div>
            </Row>
            <Row label={t("appearance.font")} sub={t("appearance.fontSub")} keywords="typeface interface ui">
              <FontPicker value={appearance.font} onChange={(font) => setAppearance({ ...appearance, font })} />
            </Row>
            <Row label={t("appearance.corners")} sub={t("appearance.cornersSub")} keywords="radius round">
              <Segmented
                value={appearance.radius}
                label={t("appearance.corners")}
                onChange={(radius) => setAppearance({ ...appearance, radius })}
                options={radiusOptions}
              />
            </Row>
          </>
        ) : null}

        {(appearance.editor === "advanced" || query) &&
          (Object.keys(TOKEN_GROUPS) as TokenGroup[]).map((group) => {
            const keys = TOKEN_GROUPS[group].filter((key) =>
              matchesQuery(query, t(TOKEN_LABEL(key)), t(GROUP_LABEL(group)), "color colour"),
            );
            if (keys.length === 0) return null;
            return (
              <div key={group} className="token-group">
                <div className="token-group-title">{t(GROUP_LABEL(group))}</div>
                {keys.map((key) => {
                  const modified = key === "accent" ? Boolean(custom.accent) : Boolean(custom.tokens?.[key]);
                  return (
                    <div key={key} className="token-row set-row">
                      <div className="set-row-text">
                        <div className="set-label">{t(TOKEN_LABEL(key))}</div>
                      </div>
                      <ColorField
                        value={tokens[key]}
                        onChange={(hex) => setToken(key, hex)}
                        label={t(TOKEN_LABEL(key))}
                        swatches={key === "accent" ? preset.swatches : undefined}
                        modified={modified}
                        onReset={() => resetToken(key)}
                      />
                    </div>
                  );
                })}
              </div>
            );
          })}

        <div className="set-actions">
          <button className="set-btn" disabled={!touched} onClick={() => setCustom({})}>
            <RotateCcw size={13} strokeWidth={1.6} />
            {t("appearance.reset", { name: preset.name })}
          </button>
          <span className="set-actions-gap" />
          <button className="set-btn" onClick={copyTheme}>
            <ClipboardCopy size={13} strokeWidth={1.6} />
            {t("appearance.copy")}
          </button>
          <button className="set-btn" onClick={() => void exportTheme()}>
            <FileDown size={13} strokeWidth={1.6} />
            {t("appearance.export")}
          </button>
          <button className="set-btn" onClick={() => void importTheme()}>
            <FileUp size={13} strokeWidth={1.6} />
            {t("appearance.import")}
          </button>
        </div>
      </Group>

      <Group title={t("appearance.display")}>
        <Row label={t("settings.reduceMotion")} sub={t("settings.reduceMotionSub")} keywords="animation">
          <PillToggle
            on={motionPref === "reduced"}
            onChange={(on) => setMotionPref(on ? "reduced" : "system")}
            label={t("settings.reduceMotion")}
          />
        </Row>
        <Row label={t("settings.reduceTransparency")} sub={t("settings.reduceTransparencySub")} keywords="blur glass">
          <PillToggle
            on={transparencyPref === "reduced"}
            onChange={(on) => setTransparencyPref(on ? "reduced" : "full")}
            label={t("settings.reduceTransparency")}
          />
        </Row>
        <Row
          label={t("settings.uiScale")}
          sub={
            uiScale === "auto"
              ? t("settings.uiScaleAutoSub", { percent: Math.round(appliedScale * 100) })
              : t("settings.uiScaleSub")
          }
          keywords="zoom size"
          stack
        >
          <Segmented
            value={uiScale}
            label={t("settings.uiScale")}
            onChange={(v) => setUiScale(v)}
            options={(["auto", 0.8, 0.9, 1, 1.1, 1.25] as const).map((step) => ({
              value: step,
              label: step === "auto" ? t("settings.uiScaleAuto") : `${Math.round(step * 100)}%`,
            }))}
          />
        </Row>
      </Group>
    </>
  );
}
