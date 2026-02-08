import { useEffect, useMemo, useState } from "react";
import TypographyMeshHero from "./components/TypographyMeshHero.jsx";

const MOTION_PRESETS = {
  calm: { flow: 0.78, drag: 0.74, camera: 0.72, settle: 0.9 },
  energetic: { flow: 1.28, drag: 1.22, camera: 1.18, settle: 1.24 },
  cinematic: { flow: 1, drag: 1, camera: 1, settle: 1.06 },
};
const MOTION_PRESET_IDS = ["calm", "energetic", "cinematic"];

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

function parseInitialState() {
  const fallback = {
    interactionMode: "fluid",
    colorMode: "white",
    word: "GEIST",
    motionPreset: "cinematic",
    motionSettings: { ...MOTION_PRESETS.cinematic },
  };

  let saved = null;
  try {
    const raw = window.localStorage.getItem("typography-mesh-settings");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        typeof parsed === "object" &&
        typeof parsed.motionPreset === "string" &&
        parsed.motionSettings
      ) {
        saved = parsed;
      }
    }
  } catch {
    // Ignore malformed local storage.
  }

  const base = saved
    ? {
        ...fallback,
        motionPreset:
          typeof saved.motionPreset === "string"
            ? saved.motionPreset
            : fallback.motionPreset,
        motionSettings: {
          flow: clampMotion(saved.motionSettings.flow),
          drag: clampMotion(saved.motionSettings.drag),
          camera: clampMotion(saved.motionSettings.camera),
          settle: clampMotion(saved.motionSettings.settle),
        },
      }
    : fallback;

  const params = new URLSearchParams(window.location.search);
  const word = sanitizeWord(params.get("w") || base.word) || base.word;
  const interactionMode = ["fluid", "nebula", "tide"].includes(params.get("m"))
    ? params.get("m")
    : base.interactionMode;
  const colorMode = ["white", "colorful"].includes(params.get("c"))
    ? params.get("c")
    : base.colorMode;
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

  return {
    interactionMode,
    colorMode,
    word,
    motionPreset: hasCustomMotion ? "custom" : motionPreset,
    motionSettings,
  };
}

export default function App() {
  const initialState = useMemo(parseInitialState, []);

  const [interactionMode, setInteractionMode] = useState(
    initialState.interactionMode,
  );
  const [colorMode, setColorMode] = useState(initialState.colorMode);
  const [wordInput, setWordInput] = useState(initialState.word);
  const [word, setWord] = useState(initialState.word);
  const [motionPreset, setMotionPreset] = useState(initialState.motionPreset);
  const [motionSettings, setMotionSettings] = useState(
    initialState.motionSettings,
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set("w", word);
    params.set("m", interactionMode);
    params.set("c", colorMode);
    if (MOTION_PRESET_IDS.includes(motionPreset)) {
      params.set("mp", motionPreset);
    } else {
      params.delete("mp");
    }
    params.set("mf", motionSettings.flow.toFixed(2));
    params.set("md", motionSettings.drag.toFixed(2));
    params.set("mc", motionSettings.camera.toFixed(2));
    params.set("ms", motionSettings.settle.toFixed(2));

    const query = params.toString();
    const nextUrl = query
      ? `${window.location.pathname}?${query}`
      : window.location.pathname;
    window.history.replaceState({}, "", nextUrl);
  }, [word, interactionMode, colorMode, motionPreset, motionSettings]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        "typography-mesh-settings",
        JSON.stringify({
          motionPreset,
          motionSettings,
        }),
      );
    } catch {
      // Ignore local storage write failures.
    }
  }, [motionPreset, motionSettings]);

  function applyWord() {
    const nextWord = sanitizeWord(wordInput);
    if (nextWord.length > 0) {
      setWord(nextWord);
      setWordInput(nextWord);
    }
  }

  function applyPreset(presetId) {
    const preset = MOTION_PRESETS[presetId];
    if (!preset) return;
    setMotionPreset(presetId);
    setMotionSettings({ ...preset });
  }

  function updateMotionValue(key, value) {
    setMotionPreset("custom");
    setMotionSettings((previous) => ({
      ...previous,
      [key]: clampMotion(value),
    }));
  }

  return (
    <main className="app">
      <form
        className="word-control"
        onSubmit={(event) => {
          event.preventDefault();
          applyWord();
        }}
      >
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
        <div className="motion-control">
          <p>Motion Preset</p>
          <div className="preset-toggle" role="group" aria-label="Motion preset">
            {MOTION_PRESET_IDS.map((presetId) => (
              <button
                key={presetId}
                type="button"
                className={motionPreset === presetId ? "active" : ""}
                onClick={() => applyPreset(presetId)}
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
        </div>
      </form>
      <TypographyMeshHero
        word={word}
        interactionMode={interactionMode}
        onInteractionModeChange={setInteractionMode}
        colorMode={colorMode}
        onColorModeChange={setColorMode}
        motionSettings={motionSettings}
        motionPreset={motionPreset}
      />
    </main>
  );
}
