import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";

const TypographyMeshHero = lazy(() => import("./components/TypographyMeshHero.jsx"));

const MOTION_PRESETS = {
  calm: { flow: 0.78, drag: 0.74, camera: 0.72, settle: 0.9 },
  energetic: { flow: 1.28, drag: 1.22, camera: 1.18, settle: 1.24 },
  cinematic: { flow: 1, drag: 1, camera: 1, settle: 1.06 },
};
const MOTION_PRESET_IDS = ["calm", "energetic", "cinematic"];
const INTERACTION_MODE_IDS = [
  "fluid",
  "nebula",
  "tide",
  "vortex",
  "ripple",
  "magnet",
];
const MODE_STRENGTH_DEFAULTS = {
  fluid: 1,
  nebula: 1,
  tide: 1,
  vortex: 1,
  ripple: 1,
  magnet: 1,
};
const MODE_STRENGTH_PARAM_KEYS = {
  fluid: "msf",
  nebula: "msn",
  tide: "mst",
  vortex: "msv",
  ripple: "msr",
  magnet: "msm",
};

const FONT_PRESETS = {
  geist: {
    id: "geist",
    label: "Geist Pixel",
    line: '"Geist Pixel Line", ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
    solid: '"Geist Pixel Square", ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
    background:
      '"Geist Pixel Line", ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
  },
  mono: {
    id: "mono",
    label: "Mono",
    line: 'ui-monospace, SFMono-Regular, Menlo, Monaco, "Cascadia Mono", "Segoe UI Mono", monospace',
    solid:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, "Cascadia Mono", "Segoe UI Mono", monospace',
    background:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, "Cascadia Mono", "Segoe UI Mono", monospace',
  },
  sans: {
    id: "sans",
    label: "Sans",
    line: '"Helvetica Neue", Helvetica, Arial, sans-serif',
    solid: '"Helvetica Neue", Helvetica, Arial, sans-serif',
    background: '"Helvetica Neue", Helvetica, Arial, sans-serif',
  },
  serif: {
    id: "serif",
    label: "Serif",
    line: '"Times New Roman", Times, Georgia, serif',
    solid: '"Times New Roman", Times, Georgia, serif',
    background: '"Times New Roman", Times, Georgia, serif',
  },
};
const FONT_PRESET_IDS = Object.keys(FONT_PRESETS);
const PAPER_PALETTE_IDS = ["prism", "aurora", "mono"];
const PAPER_EFFECT_IDS = ["warp", "swirl", "waves", "rays"];
const BACKGROUND_MESH_STYLE_IDS = ["letters", "dotgrid", "grain"];
const PAPER_DOT_SHAPE_IDS = ["circle", "diamond", "square", "triangle"];
const PAPER_GRAIN_SHAPE_IDS = [
  "wave",
  "dots",
  "truchet",
  "corners",
  "ripple",
  "blob",
  "sphere",
];

function sanitizeWord(value) {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trimStart()
    .slice(0, 18);
}

function clampMotion(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(0.5, Math.min(1.6, parsed));
}

function clampPaperIntensity(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0.32;
  return Math.max(0, Math.min(1, parsed));
}

function clampPaperEffectAmount(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0.58;
  return Math.max(0, Math.min(1, parsed));
}

function clampPaperEffectSpeed(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(0.2, Math.min(2.2, parsed));
}

function clampPaperDotDensity(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0.58;
  return Math.max(0.1, Math.min(1, parsed));
}

function clampModeStrength(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(0.4, Math.min(1.8, parsed));
}

function sanitizeCustomFontFamily(value) {
  if (typeof value !== "string") return "";
  return value.replace(/[<>`]/g, "").trim().slice(0, 120);
}

function isFontPreset(value) {
  return FONT_PRESET_IDS.includes(value) || value === "custom";
}

function normalizeFontPreset(value, fallback = "geist") {
  return isFontPreset(value) ? value : fallback;
}

function normalizePaperPalette(value, fallback = "prism") {
  return PAPER_PALETTE_IDS.includes(value) ? value : fallback;
}

function normalizePaperEffect(value, fallback = "warp") {
  return PAPER_EFFECT_IDS.includes(value) ? value : fallback;
}

function normalizeBackgroundMeshStyle(value, fallback = "letters") {
  return BACKGROUND_MESH_STYLE_IDS.includes(value) ? value : fallback;
}

function normalizePaperDotShape(value, fallback = "circle") {
  return PAPER_DOT_SHAPE_IDS.includes(value) ? value : fallback;
}

function normalizePaperGrainShape(value, fallback = "corners") {
  return PAPER_GRAIN_SHAPE_IDS.includes(value) ? value : fallback;
}

function normalizeModeStrengths(value, fallback = MODE_STRENGTH_DEFAULTS) {
  const source = value && typeof value === "object" ? value : {};
  const normalized = {};
  for (const modeId of INTERACTION_MODE_IDS) {
    normalized[modeId] = clampModeStrength(source[modeId] ?? fallback[modeId] ?? 1);
  }
  return normalized;
}

function resolveForegroundFont(fontPreset, customFontFamily) {
  if (fontPreset === "custom") {
    const custom = sanitizeCustomFontFamily(customFontFamily);
    const family =
      custom.length > 0
        ? `${custom}, ui-monospace, SFMono-Regular, Menlo, Monaco, monospace`
        : FONT_PRESETS.geist.solid;
    return {
      line: family,
      solid: family,
      label: custom || "Custom",
    };
  }

  const preset = FONT_PRESETS[fontPreset] ?? FONT_PRESETS.geist;
  return {
    line: preset.line,
    solid: preset.solid,
    label: preset.label,
  };
}

function resolveBackgroundFont(fontPreset, customFontFamily) {
  if (fontPreset === "custom") {
    const custom = sanitizeCustomFontFamily(customFontFamily);
    const family =
      custom.length > 0
        ? `${custom}, ui-monospace, SFMono-Regular, Menlo, Monaco, monospace`
        : FONT_PRESETS.geist.background;
    return {
      background: family,
      label: custom || "Custom",
    };
  }

  const preset = FONT_PRESETS[fontPreset] ?? FONT_PRESETS.geist;
  return {
    background: preset.background,
    label: preset.label,
  };
}

function parseInitialState() {
  const fallback = {
    interactionMode: "fluid",
    colorMode: "white",
    word: "GEIST",
    modeStrengths: { ...MODE_STRENGTH_DEFAULTS },
    motionPreset: "cinematic",
    motionSettings: { ...MOTION_PRESETS.cinematic },
    foregroundFontPreset: "geist",
    foregroundCustomFontFamily: "",
    backgroundFontPreset: "geist",
    backgroundCustomFontFamily: "",
    paperFxEnabled: true,
    paperFxIntensity: 0.34,
    paperFxPalette: "prism",
    paperFxEffect: "warp",
    paperFxEffectAmount: 0.58,
    paperFxEffectSpeed: 1,
    backgroundMeshStyle: "letters",
    backgroundMeshAmount: 0.58,
    backgroundMeshDotShape: "circle",
    backgroundMeshDotDensity: 0.58,
    backgroundMeshGrainShape: "corners",
  };

  let saved = null;
  try {
    const raw = window.localStorage.getItem("typography-mesh-settings");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        saved = parsed;
      }
    }
  } catch {
    // Ignore malformed local storage.
  }

  const savedLegacyPreset = saved?.fontPreset;
  const savedLegacyCustom = saved?.customFontFamily;
  const base = saved
    ? {
        ...fallback,
        motionPreset:
          typeof saved.motionPreset === "string"
            ? saved.motionPreset
            : fallback.motionPreset,
        motionSettings: {
          flow: clampMotion(saved.motionSettings?.flow ?? fallback.motionSettings.flow),
          drag: clampMotion(saved.motionSettings?.drag ?? fallback.motionSettings.drag),
          camera: clampMotion(saved.motionSettings?.camera ?? fallback.motionSettings.camera),
          settle: clampMotion(saved.motionSettings?.settle ?? fallback.motionSettings.settle),
        },
        modeStrengths: normalizeModeStrengths(
          saved.modeStrengths,
          fallback.modeStrengths,
        ),
        foregroundFontPreset: normalizeFontPreset(
          saved.foregroundFontPreset ?? savedLegacyPreset,
          fallback.foregroundFontPreset,
        ),
        foregroundCustomFontFamily: sanitizeCustomFontFamily(
          saved.foregroundCustomFontFamily ?? savedLegacyCustom ?? "",
        ),
        backgroundFontPreset: normalizeFontPreset(
          saved.backgroundFontPreset ?? savedLegacyPreset,
          fallback.backgroundFontPreset,
        ),
        backgroundCustomFontFamily: sanitizeCustomFontFamily(
          saved.backgroundCustomFontFamily ?? savedLegacyCustom ?? "",
        ),
        paperFxEnabled:
          typeof saved.paperFxEnabled === "boolean"
            ? saved.paperFxEnabled
            : fallback.paperFxEnabled,
        paperFxIntensity: clampPaperIntensity(
          saved.paperFxIntensity ?? fallback.paperFxIntensity,
        ),
        paperFxPalette: normalizePaperPalette(
          saved.paperFxPalette,
          fallback.paperFxPalette,
        ),
        paperFxEffect: normalizePaperEffect(
          saved.paperFxEffect,
          fallback.paperFxEffect,
        ),
        paperFxEffectAmount: clampPaperEffectAmount(
          saved.paperFxEffectAmount ?? fallback.paperFxEffectAmount,
        ),
        paperFxEffectSpeed: clampPaperEffectSpeed(
          saved.paperFxEffectSpeed ?? fallback.paperFxEffectSpeed,
        ),
        backgroundMeshStyle: normalizeBackgroundMeshStyle(
          saved.backgroundMeshStyle ??
            (saved.paperFxEffect === "dotgrid" || saved.paperFxEffect === "grain"
              ? saved.paperFxEffect
              : undefined),
          fallback.backgroundMeshStyle,
        ),
        backgroundMeshAmount: clampPaperEffectAmount(
          saved.backgroundMeshAmount ??
            (saved.paperFxEffect === "dotgrid" || saved.paperFxEffect === "grain"
              ? saved.paperFxEffectAmount
              : undefined) ??
            fallback.backgroundMeshAmount,
        ),
        backgroundMeshDotShape: normalizePaperDotShape(
          saved.backgroundMeshDotShape ?? saved.paperFxDotShape,
          fallback.backgroundMeshDotShape,
        ),
        backgroundMeshDotDensity: clampPaperDotDensity(
          saved.backgroundMeshDotDensity ??
            saved.paperFxDotDensity ??
            fallback.backgroundMeshDotDensity,
        ),
        backgroundMeshGrainShape: normalizePaperGrainShape(
          saved.backgroundMeshGrainShape ?? saved.paperFxGrainShape,
          fallback.backgroundMeshGrainShape,
        ),
      }
    : fallback;

  const params = new URLSearchParams(window.location.search);
  const word = sanitizeWord(params.get("w") || base.word) || base.word;
  const interactionMode = INTERACTION_MODE_IDS.includes(params.get("m"))
    ? params.get("m")
    : base.interactionMode;
  const colorMode = ["white", "colorful"].includes(params.get("c"))
    ? params.get("c")
    : base.colorMode;

  const legacyFontPreset = params.get("f");
  const legacyFontCustom = params.get("cf");
  const foregroundFontPreset = normalizeFontPreset(
    params.get("ff") || legacyFontPreset || base.foregroundFontPreset,
    base.foregroundFontPreset,
  );
  const foregroundCustomFontFamily = sanitizeCustomFontFamily(
    params.get("ffc") || legacyFontCustom || base.foregroundCustomFontFamily,
  );
  const backgroundFontPreset = normalizeFontPreset(
    params.get("bf") || legacyFontPreset || base.backgroundFontPreset,
    base.backgroundFontPreset,
  );
  const backgroundCustomFontFamily = sanitizeCustomFontFamily(
    params.get("bfc") || legacyFontCustom || base.backgroundCustomFontFamily,
  );
  const paperFxEnabled = params.has("pe")
    ? params.get("pe") !== "0"
    : base.paperFxEnabled;
  const paperFxIntensity = clampPaperIntensity(
    params.get("pi") ?? base.paperFxIntensity,
  );
  const paperFxPalette = normalizePaperPalette(
    params.get("pp"),
    base.paperFxPalette,
  );
  const paperFxEffect = normalizePaperEffect(
    params.get("pfx"),
    base.paperFxEffect,
  );
  const paperFxEffectAmount = clampPaperEffectAmount(
    params.get("pfa") ?? base.paperFxEffectAmount,
  );
  const paperFxEffectSpeed = clampPaperEffectSpeed(
    params.get("pfs") ?? base.paperFxEffectSpeed,
  );
  const legacyBackgroundMeshStyle = params.get("pfx");
  const backgroundMeshStyle = normalizeBackgroundMeshStyle(
    params.get("bm") || legacyBackgroundMeshStyle,
    base.backgroundMeshStyle,
  );
  const backgroundMeshAmount = clampPaperEffectAmount(
    params.get("bma") ??
      ((legacyBackgroundMeshStyle === "dotgrid" ||
      legacyBackgroundMeshStyle === "grain"
        ? params.get("pfa")
        : undefined) ??
        base.backgroundMeshAmount),
  );
  const backgroundMeshDotShape = normalizePaperDotShape(
    params.get("bds") || params.get("pds"),
    base.backgroundMeshDotShape,
  );
  const backgroundMeshDotDensity = clampPaperDotDensity(
    params.get("bdd") ?? params.get("pdd") ?? base.backgroundMeshDotDensity,
  );
  const backgroundMeshGrainShape = normalizePaperGrainShape(
    params.get("bgs") || params.get("pgs"),
    base.backgroundMeshGrainShape,
  );

  const presetFromUrl = params.get("mp");
  const motionPreset = MOTION_PRESET_IDS.includes(presetFromUrl)
    ? presetFromUrl
    : base.motionPreset;

  const basePresetSettings = MOTION_PRESETS[motionPreset] ?? base.motionSettings;
  const hasCustomMotion =
    params.has("mf") || params.has("md") || params.has("mc") || params.has("ms");
  const motionSettings = hasCustomMotion
    ? {
        flow: clampMotion(params.get("mf") ?? basePresetSettings.flow),
        drag: clampMotion(params.get("md") ?? basePresetSettings.drag),
        camera: clampMotion(params.get("mc") ?? basePresetSettings.camera),
        settle: clampMotion(params.get("ms") ?? basePresetSettings.settle),
      }
    : { ...basePresetSettings };
  const modeStrengths = normalizeModeStrengths(
    Object.fromEntries(
      INTERACTION_MODE_IDS.map((modeId) => [
        modeId,
        params.get(MODE_STRENGTH_PARAM_KEYS[modeId]) ?? base.modeStrengths[modeId],
      ]),
    ),
    base.modeStrengths,
  );

  return {
    interactionMode,
    colorMode,
    word,
    modeStrengths,
    foregroundFontPreset,
    foregroundCustomFontFamily,
    backgroundFontPreset,
    backgroundCustomFontFamily,
    paperFxEnabled,
    paperFxIntensity,
    paperFxPalette,
    paperFxEffect,
    paperFxEffectAmount,
    paperFxEffectSpeed,
    backgroundMeshStyle,
    backgroundMeshAmount,
    backgroundMeshDotShape,
    backgroundMeshDotDensity,
    backgroundMeshGrainShape,
    motionPreset: hasCustomMotion ? "custom" : motionPreset,
    motionSettings,
  };
}

export default function App() {
  const initialState = useMemo(parseInitialState, []);

  const [controlsCollapsed, setControlsCollapsed] = useState(false);
  const [interactionMode, setInteractionMode] = useState(
    initialState.interactionMode,
  );
  const [modeStrengths, setModeStrengths] = useState(initialState.modeStrengths);
  const [colorMode, setColorMode] = useState(initialState.colorMode);
  const [wordInput, setWordInput] = useState(initialState.word);
  const [word, setWord] = useState(initialState.word);
  const [foregroundFontPreset, setForegroundFontPreset] = useState(
    initialState.foregroundFontPreset,
  );
  const [foregroundCustomFontFamily, setForegroundCustomFontFamily] = useState(
    initialState.foregroundCustomFontFamily,
  );
  const [backgroundFontPreset, setBackgroundFontPreset] = useState(
    initialState.backgroundFontPreset,
  );
  const [backgroundCustomFontFamily, setBackgroundCustomFontFamily] = useState(
    initialState.backgroundCustomFontFamily,
  );
  const [paperFxEnabled, setPaperFxEnabled] = useState(initialState.paperFxEnabled);
  const [paperFxIntensity, setPaperFxIntensity] = useState(
    initialState.paperFxIntensity,
  );
  const [paperFxPalette, setPaperFxPalette] = useState(initialState.paperFxPalette);
  const [paperFxEffect, setPaperFxEffect] = useState(initialState.paperFxEffect);
  const [paperFxEffectAmount, setPaperFxEffectAmount] = useState(
    initialState.paperFxEffectAmount,
  );
  const [paperFxEffectSpeed, setPaperFxEffectSpeed] = useState(
    initialState.paperFxEffectSpeed,
  );
  const [backgroundMeshStyle, setBackgroundMeshStyle] = useState(
    initialState.backgroundMeshStyle,
  );
  const [backgroundMeshAmount, setBackgroundMeshAmount] = useState(
    initialState.backgroundMeshAmount,
  );
  const [backgroundMeshDotShape, setBackgroundMeshDotShape] = useState(
    initialState.backgroundMeshDotShape,
  );
  const [backgroundMeshDotDensity, setBackgroundMeshDotDensity] = useState(
    initialState.backgroundMeshDotDensity,
  );
  const [backgroundMeshGrainShape, setBackgroundMeshGrainShape] = useState(
    initialState.backgroundMeshGrainShape,
  );
  const [motionPreset, setMotionPreset] = useState(initialState.motionPreset);
  const [motionSettings, setMotionSettings] = useState(
    initialState.motionSettings,
  );

  const foregroundFont = useMemo(
    () => resolveForegroundFont(foregroundFontPreset, foregroundCustomFontFamily),
    [foregroundFontPreset, foregroundCustomFontFamily],
  );
  const backgroundFont = useMemo(
    () => resolveBackgroundFont(backgroundFontPreset, backgroundCustomFontFamily),
    [backgroundFontPreset, backgroundCustomFontFamily],
  );
  const fontSet = useMemo(
    () => ({
      line: foregroundFont.line,
      solid: foregroundFont.solid,
      background: backgroundFont.background,
    }),
    [foregroundFont, backgroundFont],
  );
  const fontLabel = useMemo(
    () => `FG:${foregroundFont.label} BG:${backgroundFont.label}`,
    [foregroundFont, backgroundFont],
  );
  const currentModeStrength = modeStrengths[interactionMode] ?? 1;
  const paperFx = useMemo(
    () => ({
      enabled: paperFxEnabled,
      intensity: paperFxIntensity,
      palette: paperFxPalette,
      effect: paperFxEffect,
      amount: paperFxEffectAmount,
      speed: paperFxEffectSpeed,
    }),
    [
      paperFxEnabled,
      paperFxIntensity,
      paperFxPalette,
      paperFxEffect,
      paperFxEffectAmount,
      paperFxEffectSpeed,
    ],
  );
  const backgroundMeshFx = useMemo(
    () => ({
      style: backgroundMeshStyle,
      amount: backgroundMeshAmount,
      dotShape: backgroundMeshDotShape,
      dotDensity: backgroundMeshDotDensity,
      grainShape: backgroundMeshGrainShape,
    }),
    [
      backgroundMeshStyle,
      backgroundMeshAmount,
      backgroundMeshDotShape,
      backgroundMeshDotDensity,
      backgroundMeshGrainShape,
    ],
  );
  const persistedSettings = useMemo(
    () => ({
      modeStrengths,
      foregroundFontPreset,
      foregroundCustomFontFamily,
      backgroundFontPreset,
      backgroundCustomFontFamily,
      paperFxEnabled,
      paperFxIntensity,
      paperFxPalette,
      paperFxEffect,
      paperFxEffectAmount,
      paperFxEffectSpeed,
      backgroundMeshStyle,
      backgroundMeshAmount,
      backgroundMeshDotShape,
      backgroundMeshDotDensity,
      backgroundMeshGrainShape,
      motionPreset,
      motionSettings,
    }),
    [
      modeStrengths,
      foregroundFontPreset,
      foregroundCustomFontFamily,
      backgroundFontPreset,
      backgroundCustomFontFamily,
      paperFxEnabled,
      paperFxIntensity,
      paperFxPalette,
      paperFxEffect,
      paperFxEffectAmount,
      paperFxEffectSpeed,
      backgroundMeshStyle,
      backgroundMeshAmount,
      backgroundMeshDotShape,
      backgroundMeshDotDensity,
      backgroundMeshGrainShape,
      motionPreset,
      motionSettings,
    ],
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      params.set("w", word);
      params.set("m", interactionMode);
      params.set("c", colorMode);
      params.set("ff", foregroundFontPreset);
      params.set("bf", backgroundFontPreset);
      params.set("pe", paperFxEnabled ? "1" : "0");
      params.set("pi", paperFxIntensity.toFixed(2));
      params.set("pp", paperFxPalette);
      params.set("pfx", paperFxEffect);
      params.set("pfa", paperFxEffectAmount.toFixed(2));
      params.set("pfs", paperFxEffectSpeed.toFixed(2));
      params.set("bm", backgroundMeshStyle);
      params.set("bma", backgroundMeshAmount.toFixed(2));
      params.set("bds", backgroundMeshDotShape);
      params.set("bdd", backgroundMeshDotDensity.toFixed(2));
      params.set("bgs", backgroundMeshGrainShape);
      params.delete("pds");
      params.delete("pdd");
      params.delete("pgs");
      params.delete("f");
      params.delete("cf");
      if (foregroundFontPreset === "custom" && foregroundCustomFontFamily) {
        params.set("ffc", foregroundCustomFontFamily);
      } else {
        params.delete("ffc");
      }
      if (backgroundFontPreset === "custom" && backgroundCustomFontFamily) {
        params.set("bfc", backgroundCustomFontFamily);
      } else {
        params.delete("bfc");
      }

      if (MOTION_PRESET_IDS.includes(motionPreset)) {
        params.set("mp", motionPreset);
      } else {
        params.delete("mp");
      }
      params.set("mf", motionSettings.flow.toFixed(2));
      params.set("md", motionSettings.drag.toFixed(2));
      params.set("mc", motionSettings.camera.toFixed(2));
      params.set("ms", motionSettings.settle.toFixed(2));
      for (const modeId of INTERACTION_MODE_IDS) {
        params.set(
          MODE_STRENGTH_PARAM_KEYS[modeId],
          (modeStrengths[modeId] ?? 1).toFixed(2),
        );
      }

      const query = params.toString();
      const nextUrl = query
        ? `${window.location.pathname}?${query}`
        : window.location.pathname;
      window.history.replaceState({}, "", nextUrl);
    }, 100);

    return () => window.clearTimeout(timeoutId);
  }, [
    word,
    interactionMode,
    colorMode,
    foregroundFontPreset,
    foregroundCustomFontFamily,
    backgroundFontPreset,
    backgroundCustomFontFamily,
    modeStrengths.fluid,
    modeStrengths.nebula,
    modeStrengths.tide,
    modeStrengths.vortex,
    modeStrengths.ripple,
    modeStrengths.magnet,
    paperFxEnabled,
    paperFxIntensity,
    paperFxPalette,
    paperFxEffect,
    paperFxEffectAmount,
    paperFxEffectSpeed,
    backgroundMeshStyle,
    backgroundMeshAmount,
    backgroundMeshDotShape,
    backgroundMeshDotDensity,
    backgroundMeshGrainShape,
    motionPreset,
    motionSettings.flow,
    motionSettings.drag,
    motionSettings.camera,
    motionSettings.settle,
  ]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      try {
        window.localStorage.setItem(
          "typography-mesh-settings",
          JSON.stringify(persistedSettings),
        );
      } catch {
        // Ignore local storage write failures.
      }
    }, 180);
    return () => window.clearTimeout(timeoutId);
  }, [persistedSettings]);

  const applyWord = useCallback(() => {
    const nextWord = sanitizeWord(wordInput);
    if (nextWord.length > 0) {
      setWord(nextWord);
      setWordInput(nextWord);
    }
  }, [wordInput]);

  const applyMotionPreset = useCallback((presetId) => {
    const preset = MOTION_PRESETS[presetId];
    if (!preset) return;
    setMotionPreset(presetId);
    setMotionSettings({ ...preset });
  }, []);

  const updateMotionValue = useCallback((key, value) => {
    setMotionPreset("custom");
    setMotionSettings((previous) => ({
      ...previous,
      [key]: clampMotion(value),
    }));
  }, []);

  const updateCurrentModeStrength = useCallback(
    (value) => {
      const next = clampModeStrength(value);
      setModeStrengths((previous) => ({
        ...previous,
        [interactionMode]: next,
      }));
    },
    [interactionMode],
  );

  return (
    <main className="app">
      <form
        className={`word-control${controlsCollapsed ? " collapsed" : ""}`}
        onSubmit={(event) => {
          event.preventDefault();
          applyWord();
        }}
      >
        <div className="panel-header">
          <strong>Controls</strong>
          <button
            type="button"
            className="panel-toggle-btn"
            onClick={() => setControlsCollapsed((previous) => !previous)}
            aria-expanded={!controlsCollapsed}
          >
            {controlsCollapsed ? "Expand" : "Collapse"}
          </button>
        </div>
        {!controlsCollapsed ? (
          <>
        <details className="control-section" open>
          <summary>Typography</summary>
          <div className="section-body">
            <label htmlFor="hero-word">Dynamic Text</label>
            <div className="row">
              <input
                id="hero-word"
                type="text"
                value={wordInput}
                onChange={(event) => setWordInput(sanitizeWord(event.target.value))}
                placeholder="TYPE WORD"
                maxLength={18}
              />
              <button type="submit">Apply</button>
            </div>
            <div className="color-toggle" role="group" aria-label="Text color mode">
              <button
                type="button"
                className={colorMode === "white" ? "active" : ""}
                onClick={() => setColorMode("white")}
              >
                White Shades
              </button>
              <button
                type="button"
                className={colorMode === "colorful" ? "active" : ""}
                onClick={() => setColorMode("colorful")}
              >
                Colorful
              </button>
            </div>
          </div>
        </details>

        <details className="control-section" open>
          <summary>Fonts</summary>
          <div className="section-body">
            <details className="font-section" open>
              <summary>Foreground Font</summary>
              <div className="font-control">
                <div className="preset-toggle" role="group" aria-label="Foreground font preset">
                  {FONT_PRESET_IDS.map((presetId) => (
                    <button
                      key={`fg-${presetId}`}
                      type="button"
                      className={foregroundFontPreset === presetId ? "active" : ""}
                      onClick={() => setForegroundFontPreset(presetId)}
                    >
                      {FONT_PRESETS[presetId].label}
                    </button>
                  ))}
                  <button
                    type="button"
                    className={foregroundFontPreset === "custom" ? "active" : ""}
                    onClick={() => setForegroundFontPreset("custom")}
                  >
                    Custom
                  </button>
                </div>
                <label className="font-family-field" htmlFor="custom-font-family-foreground">
                  <span>Custom family stack</span>
                  <input
                    id="custom-font-family-foreground"
                    type="text"
                    value={foregroundCustomFontFamily}
                    onChange={(event) => {
                      setForegroundFontPreset("custom");
                      setForegroundCustomFontFamily(
                        sanitizeCustomFontFamily(event.target.value),
                      );
                    }}
                    placeholder='"Space Mono", monospace'
                    maxLength={120}
                  />
                </label>
              </div>
            </details>

            <details className="font-section" open>
              <summary>Background Font</summary>
              <div className="font-control">
                <div className="preset-toggle" role="group" aria-label="Background font preset">
                  {FONT_PRESET_IDS.map((presetId) => (
                    <button
                      key={`bg-${presetId}`}
                      type="button"
                      className={backgroundFontPreset === presetId ? "active" : ""}
                      onClick={() => setBackgroundFontPreset(presetId)}
                    >
                      {FONT_PRESETS[presetId].label}
                    </button>
                  ))}
                  <button
                    type="button"
                    className={backgroundFontPreset === "custom" ? "active" : ""}
                    onClick={() => setBackgroundFontPreset("custom")}
                  >
                    Custom
                  </button>
                </div>
                <label className="font-family-field" htmlFor="custom-font-family-background">
                  <span>Custom family stack</span>
                  <input
                    id="custom-font-family-background"
                    type="text"
                    value={backgroundCustomFontFamily}
                    onChange={(event) => {
                      setBackgroundFontPreset("custom");
                      setBackgroundCustomFontFamily(
                        sanitizeCustomFontFamily(event.target.value),
                      );
                    }}
                    placeholder='"IBM Plex Mono", monospace'
                    maxLength={120}
                  />
                </label>
              </div>
            </details>
          </div>
        </details>

        <details className="control-section" open>
          <summary>Motion</summary>
          <div className="section-body motion-control">
            <p>Motion Preset</p>
            <div className="preset-toggle" role="group" aria-label="Motion preset">
              {MOTION_PRESET_IDS.map((presetId) => (
                <button
                  key={presetId}
                  type="button"
                  className={motionPreset === presetId ? "active" : ""}
                  onClick={() => applyMotionPreset(presetId)}
                >
                  {presetId}
                </button>
              ))}
              <button
                type="button"
                className={motionPreset === "custom" ? "active" : ""}
                onClick={() => setMotionPreset("custom")}
              >
                custom
              </button>
            </div>
            <div className="slider-grid">
              <label>
                <span>Flow</span>
                <input
                  type="range"
                  min="0.50"
                  max="1.60"
                  step="0.01"
                  value={motionSettings.flow}
                  onChange={(event) => updateMotionValue("flow", event.target.value)}
                />
                <b>{motionSettings.flow.toFixed(2)}</b>
              </label>
              <label>
                <span>Drag</span>
                <input
                  type="range"
                  min="0.50"
                  max="1.60"
                  step="0.01"
                  value={motionSettings.drag}
                  onChange={(event) => updateMotionValue("drag", event.target.value)}
                />
                <b>{motionSettings.drag.toFixed(2)}</b>
              </label>
              <label>
                <span>Camera</span>
                <input
                  type="range"
                  min="0.50"
                  max="1.60"
                  step="0.01"
                  value={motionSettings.camera}
                  onChange={(event) => updateMotionValue("camera", event.target.value)}
                />
                <b>{motionSettings.camera.toFixed(2)}</b>
              </label>
              <label>
                <span>Settle</span>
                <input
                  type="range"
                  min="0.50"
                  max="1.60"
                  step="0.01"
                  value={motionSettings.settle}
                  onChange={(event) => updateMotionValue("settle", event.target.value)}
                />
                <b>{motionSettings.settle.toFixed(2)}</b>
              </label>
            </div>
            <label className="paper-intensity">
              <span>Mode Strength ({interactionMode})</span>
              <input
                type="range"
                min="0.40"
                max="1.80"
                step="0.01"
                value={currentModeStrength}
                onChange={(event) => updateCurrentModeStrength(event.target.value)}
              />
              <b>{currentModeStrength.toFixed(2)}</b>
            </label>
          </div>
        </details>

        <details className="control-section" open>
          <summary>Paper Shader</summary>
          <div className="section-body paper-control">
            <div className="color-toggle" role="group" aria-label="Paper shader toggle">
              <button
                type="button"
                className={paperFxEnabled ? "active" : ""}
                onClick={() => setPaperFxEnabled(true)}
              >
                Enabled
              </button>
              <button
                type="button"
                className={!paperFxEnabled ? "active" : ""}
                onClick={() => setPaperFxEnabled(false)}
              >
                Disabled
              </button>
            </div>
            <div className="preset-toggle" role="group" aria-label="Paper shader palette">
              {PAPER_PALETTE_IDS.map((paletteId) => (
                <button
                  key={paletteId}
                  type="button"
                  className={paperFxPalette === paletteId ? "active" : ""}
                  onClick={() => setPaperFxPalette(paletteId)}
                >
                  {paletteId}
                </button>
              ))}
            </div>
            <div className="preset-toggle" role="group" aria-label="Paper shader effect">
              {PAPER_EFFECT_IDS.map((effectId) => (
                <button
                  key={effectId}
                  type="button"
                  className={paperFxEffect === effectId ? "active" : ""}
                  onClick={() => setPaperFxEffect(effectId)}
                >
                  {effectId}
                </button>
              ))}
            </div>
            <label className="paper-intensity">
              <span>Intensity</span>
              <input
                type="range"
                min="0.00"
                max="1.00"
                step="0.01"
                value={paperFxIntensity}
                onChange={(event) =>
                  setPaperFxIntensity(clampPaperIntensity(event.target.value))
                }
              />
              <b>{paperFxIntensity.toFixed(2)}</b>
            </label>
            <label className="paper-intensity">
              <span>Effect</span>
              <input
                type="range"
                min="0.00"
                max="1.00"
                step="0.01"
                value={paperFxEffectAmount}
                onChange={(event) =>
                  setPaperFxEffectAmount(clampPaperEffectAmount(event.target.value))
                }
              />
              <b>{paperFxEffectAmount.toFixed(2)}</b>
            </label>
            <label className="paper-intensity">
              <span>Speed</span>
              <input
                type="range"
                min="0.20"
                max="2.20"
                step="0.01"
                value={paperFxEffectSpeed}
                onChange={(event) =>
                  setPaperFxEffectSpeed(clampPaperEffectSpeed(event.target.value))
                }
              />
              <b>{paperFxEffectSpeed.toFixed(2)}</b>
            </label>
          </div>
        </details>

        <details className="control-section" open>
          <summary>Second Mesh</summary>
          <div className="section-body paper-control">
            <div className="preset-toggle" role="group" aria-label="Second mesh shader style">
              {BACKGROUND_MESH_STYLE_IDS.map((styleId) => (
                <button
                  key={styleId}
                  type="button"
                  className={backgroundMeshStyle === styleId ? "active" : ""}
                  onClick={() => setBackgroundMeshStyle(styleId)}
                >
                  {styleId === "letters"
                    ? "letters"
                    : styleId === "dotgrid"
                      ? "dot-grid"
                      : "grain-gradient"}
                </button>
              ))}
            </div>
            {backgroundMeshStyle === "dotgrid" ? (
              <>
                <div className="preset-toggle" role="group" aria-label="Second mesh dot shape">
                  {PAPER_DOT_SHAPE_IDS.map((shapeId) => (
                    <button
                      key={shapeId}
                      type="button"
                      className={backgroundMeshDotShape === shapeId ? "active" : ""}
                      onClick={() => setBackgroundMeshDotShape(shapeId)}
                    >
                      {shapeId}
                    </button>
                  ))}
                </div>
                <label className="paper-intensity">
                  <span>Dot Density</span>
                  <input
                    type="range"
                    min="0.10"
                    max="1.00"
                    step="0.01"
                    value={backgroundMeshDotDensity}
                    onChange={(event) =>
                      setBackgroundMeshDotDensity(
                        clampPaperDotDensity(event.target.value),
                      )
                    }
                  />
                  <b>{backgroundMeshDotDensity.toFixed(2)}</b>
                </label>
              </>
            ) : null}
            {backgroundMeshStyle === "grain" ? (
              <div className="preset-toggle" role="group" aria-label="Second mesh grain shape">
                {PAPER_GRAIN_SHAPE_IDS.map((shapeId) => (
                  <button
                    key={shapeId}
                    type="button"
                    className={backgroundMeshGrainShape === shapeId ? "active" : ""}
                    onClick={() => setBackgroundMeshGrainShape(shapeId)}
                  >
                    {shapeId}
                  </button>
                ))}
              </div>
            ) : null}
            <label className="paper-intensity">
              <span>Visibility</span>
              <input
                type="range"
                min="0.00"
                max="1.00"
                step="0.01"
                value={backgroundMeshAmount}
                onChange={(event) =>
                  setBackgroundMeshAmount(clampPaperEffectAmount(event.target.value))
                }
              />
              <b>{backgroundMeshAmount.toFixed(2)}</b>
            </label>
          </div>
        </details>
          </>
        ) : null}
      </form>

      <Suspense fallback={<div className="hero-fallback" aria-hidden="true" />}>
        <TypographyMeshHero
          word={word}
          fontSet={fontSet}
          fontLabel={fontLabel}
          interactionMode={interactionMode}
          onInteractionModeChange={setInteractionMode}
          colorMode={colorMode}
          onColorModeChange={setColorMode}
          motionSettings={motionSettings}
          motionPreset={motionPreset}
          modeStrengths={modeStrengths}
          paperFx={paperFx}
          backgroundMeshFx={backgroundMeshFx}
        />
      </Suspense>
    </main>
  );
}
