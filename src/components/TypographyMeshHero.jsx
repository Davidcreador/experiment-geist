import { memo, useEffect, useRef } from "react";
import * as THREE from "three";
import pixelLineFontUrl from "../assets/fonts/GeistPixel-Line.woff2?url";
import pixelSquareFontUrl from "../assets/fonts/GeistPixel-Square.woff2?url";

const FOREGROUND_GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".split("");
const BACKGROUND_GLYPHS = "##++**==%%@@&&//\\\\||??!!~~^^::".split("");
const INTERACTION_MODES = [
  { id: "fluid", label: "Fluid Drift" },
  { id: "nebula", label: "Nebula Curl" },
  { id: "tide", label: "Tidal Shear" },
  { id: "vortex", label: "Vortex Lens" },
  { id: "ripple", label: "Ripple Pulse" },
  { id: "magnet", label: "Magnetic Lattice" },
];
const INTERACTION_MODE_IDS = INTERACTION_MODES.map((mode) => mode.id);
const COLOR_MODE_IDS = ["white", "colorful"];

const FILM_GRAIN_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uNoise: { value: 0.018 },
    uVignette: { value: 0.34 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uNoise;
    uniform float uVignette;

    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    void main() {
      vec4 base = texture2D(tDiffuse, vUv);
      float grain = (hash(vUv * vec2(1920.0, 1080.0) + uTime * 41.7) - 0.5) * uNoise;
      vec3 color = base.rgb + grain;

      vec2 center = vUv - 0.5;
      float vignette = smoothstep(1.2, 0.24, length(center));
      color *= mix(1.0, vignette, uVignette);

      gl_FragColor = vec4(color, base.a);
    }
  `,
};

const PAPER_MESH_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uIntensity: { value: 0.34 },
    uPalette: { value: 0 },
    uEffect: { value: 0 },
    uEffectAmount: { value: 0.58 },
    uSpeed: { value: 1 },
    uDotShape: { value: 0 },
    uDotDensity: { value: 0.58 },
    uGrainShape: { value: 0 },
    uPointer: { value: new THREE.Vector2(0.5, 0.5) },
    uEnergy: { value: 0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uIntensity;
    uniform float uPalette;
    uniform float uEffect;
    uniform float uEffectAmount;
    uniform float uSpeed;
    uniform float uDotShape;
    uniform float uDotDensity;
    uniform float uGrainShape;
    uniform vec2 uPointer;
    uniform float uEnergy;

    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
    }

    float fbm(vec2 p) {
      float v = 0.0;
      float a = 0.5;
      for (int i = 0; i < 4; i++) {
        v += a * noise(p);
        p = p * 2.02 + vec2(17.13, 9.41);
        a *= 0.52;
      }
      return v;
    }

    vec3 pickPalette(float t, float palette) {
      if (palette < 0.5) {
        vec3 a = vec3(0.17, 0.67, 0.98);
        vec3 b = vec3(0.99, 0.47, 0.89);
        vec3 c = vec3(0.99, 0.88, 0.41);
        return mix(mix(a, b, smoothstep(0.08, 0.66, t)), c, smoothstep(0.52, 0.95, t));
      }
      if (palette < 1.5) {
        vec3 a = vec3(0.22, 0.87, 0.82);
        vec3 b = vec3(0.30, 0.49, 0.98);
        vec3 c = vec3(0.78, 0.61, 0.99);
        return mix(mix(a, b, smoothstep(0.12, 0.7, t)), c, smoothstep(0.56, 0.96, t));
      }
      float v = mix(0.4, 0.98, t);
      return vec3(v);
    }

    mat2 rot(float a) {
      float c = cos(a);
      float s = sin(a);
      return mat2(c, -s, s, c);
    }

    float dotShapeMask(vec2 p, float shape) {
      vec2 q = p;
      if (shape < 0.5) {
        float d = length(q);
        return 1.0 - smoothstep(0.36, 0.41, d);
      }
      if (shape < 1.5) {
        q = abs(q);
        float d = q.x + q.y;
        return 1.0 - smoothstep(0.43, 0.48, d);
      }
      if (shape < 2.5) {
        q = abs(q);
        float d = max(q.x, q.y);
        return 1.0 - smoothstep(0.36, 0.41, d);
      }
      q.y += 0.12;
      float d = max(abs(q.x) * 1.15 + q.y * 0.9, -q.y);
      return 1.0 - smoothstep(0.34, 0.4, d);
    }

    vec2 grainWarp(vec2 uv, float shape, float t, float amt) {
      vec2 p = uv;
      if (shape < 0.5) {
        vec2 c = abs(p);
        p += sign(uv) * pow(c, vec2(1.9)) * (0.35 + amt * 0.55);
      } else if (shape < 1.5) {
        p += vec2(
          sin(p.y * (3.5 + amt * 2.0) + t * 0.72),
          cos(p.x * (3.2 + amt * 2.2) - t * 0.63)
        ) * (0.24 + 0.34 * amt);
      } else if (shape < 2.5) {
        vec2 grid = floor((p + 1.0) * (3.0 + amt * 4.0));
        float j = hash(grid + vec2(1.9, -2.4));
        p = fract((p + 1.0) * (3.0 + amt * 4.0)) - 0.5;
        if (j > 0.5) {
          p.x *= -1.0;
        }
        p = p * rot(t * 0.15 + j * 3.1415);
      } else if (shape < 3.5) {
        vec2 d = p - vec2(0.0, 0.0);
        float l = length(d) + 0.0001;
        p += normalize(d) * (0.3 + 0.55 * amt) * exp(-l * 2.6) * sin(t * 0.7 + l * 9.0);
      } else if (shape < 4.5) {
        float r = length(p);
        p += vec2(
          sin(r * (10.0 + amt * 14.0) - t * 0.62),
          cos(r * (8.4 + amt * 12.0) + t * 0.55)
        ) * (0.12 + 0.3 * amt);
      } else if (shape < 5.5) {
        vec2 d = p;
        float l = length(d) + 0.0001;
        p += normalize(d) * (0.25 + 0.58 * amt) * exp(-l * 1.9);
      } else {
        float r = length(p);
        p = normalize(p + vec2(0.0001, -0.0001)) * pow(r, 1.35 + amt * 0.9);
      }
      return p;
    }

    void main() {
      vec4 base = texture2D(tDiffuse, vUv);
      vec2 uv = vUv * 2.0 - 1.0;
      vec2 pointer = uPointer * 2.0 - 1.0;
      vec2 toPointer = uv - pointer;
      float pointerDist = length(toPointer);
      float pointerFocus = smoothstep(1.1, 0.0, pointerDist);
      float time = uTime * (0.66 + 0.74 * uSpeed);

      vec2 flow = uv * 1.7 + vec2(time * 0.075, -time * 0.062);
      flow += normalize(toPointer + vec2(0.001, -0.001)) * pointerFocus * (0.18 + uEnergy * 0.12);

      vec2 effectUv = flow;
      if (uEffect < 0.5) {
        vec2 warp = vec2(
          fbm(flow * 1.7 + vec2(2.1, -1.6)) - 0.5,
          fbm(flow * 1.5 + vec2(-3.4, 4.2)) - 0.5
        );
        effectUv += warp * (0.65 * uEffectAmount);
      } else if (uEffect < 1.5) {
        float angle = (0.22 + uEffectAmount * 0.86) * exp(-pointerDist * 1.7) * sin(time * 0.32);
        float c = cos(angle);
        float s = sin(angle);
        vec2 centered = uv - pointer;
        effectUv = vec2(centered.x * c - centered.y * s, centered.x * s + centered.y * c) + pointer;
      } else if (uEffect < 2.5) {
        effectUv += vec2(
          sin(uv.y * (7.0 + uEffectAmount * 9.0) + time * 0.74),
          cos(uv.x * (7.6 + uEffectAmount * 8.0) - time * 0.69)
        ) * (0.14 + 0.44 * uEffectAmount);
      } else {
        float ray = atan(uv.y - pointer.y, uv.x - pointer.x);
        float beam = sin(ray * (6.0 + 24.0 * uEffectAmount) - time * 0.7);
        float burst = exp(-pointerDist * (1.3 + uEffectAmount * 2.2));
        effectUv += normalize(toPointer + vec2(0.001, -0.001)) * beam * burst * (0.36 + uEffectAmount * 0.64);
      }

      float nA = fbm(effectUv + vec2(fbm(effectUv * 1.21), fbm(effectUv * 1.37)));
      float nB = fbm(effectUv * 1.9 - vec2(3.1, -1.7));
      float ridge = abs(sin((nA + nB * 0.7 + uv.x * 0.35 - uv.y * 0.28 + time * 0.09) * 6.2831));

      float tA = clamp(nA * 0.72 + ridge * 0.48, 0.0, 1.0);
      float tB = fract(tA + 0.19 + 0.11 * sin(time * 0.17 + uv.x * 2.3));
      vec3 tintA = pickPalette(tA, uPalette);
      vec3 tintB = pickPalette(tB, uPalette);
      vec3 tint = mix(tintA, tintB, 0.5 + 0.5 * sin(time * 0.13 + uv.y * 1.9));

      float grain = (hash(vUv * vec2(1600.0, 900.0) + time * 63.7) - 0.5) * 0.085;
      float pulse = 0.88 + 0.14 * sin(time * 0.41);
      float intensity =
        clamp(uIntensity, 0.0, 1.0) *
        (0.8 + 0.35 * uEffectAmount) *
        (0.74 + 0.26 * pointerFocus) *
        (0.84 + 0.3 * uEnergy) *
        pulse;

      vec3 overlay = tint * 0.4 + vec3(grain);
      vec3 color = mix(base.rgb, clamp(base.rgb + overlay, 0.0, 1.0), intensity);
      gl_FragColor = vec4(color, base.a);
    }
  `,
};

function getInteractionModeIndex(mode) {
  const index = INTERACTION_MODE_IDS.indexOf(mode);
  return index === -1 ? 0 : index;
}

function getColorModeIndex(mode) {
  const index = COLOR_MODE_IDS.indexOf(mode);
  return index === -1 ? 0 : index;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function smoothstep(edge0, edge1, x) {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function easeOutBack(x) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const t = clamp01(x);
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function expSmoothing(rate, deltaSeconds) {
  return 1 - Math.exp(-rate * deltaSeconds);
}

function hash01(seed) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function normalizeWord(value) {
  const next = (value || "GEIST")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return next.length > 0 ? next : "GEIST";
}

function normalizePaperFx(paperFx) {
  const source = paperFx && typeof paperFx === "object" ? paperFx : {};
  const rawIntensity =
    source.intensity === undefined || source.intensity === null
      ? 0.34
      : Number(source.intensity);
  const rawAmount =
    source.amount === undefined || source.amount === null ? 0.58 : Number(source.amount);
  const rawSpeed =
    source.speed === undefined || source.speed === null ? 1 : Number(source.speed);
  const rawDotDensity =
    source.dotDensity === undefined || source.dotDensity === null
      ? 0.58
      : Number(source.dotDensity);
  return {
    enabled: source.enabled !== false,
    intensity: Math.max(0, Math.min(1, Number.isFinite(rawIntensity) ? rawIntensity : 0.34)),
    amount: Math.max(0, Math.min(1, Number.isFinite(rawAmount) ? rawAmount : 0.58)),
    speed: Math.max(0.2, Math.min(2.2, Number.isFinite(rawSpeed) ? rawSpeed : 1)),
    effect:
      source.effect === "swirl" ||
      source.effect === "waves" ||
      source.effect === "rays" ||
      source.effect === "dotgrid" ||
      source.effect === "grain"
        ? source.effect
        : "warp",
    dotShape:
      source.dotShape === "diamond" ||
      source.dotShape === "square" ||
      source.dotShape === "triangle"
        ? source.dotShape
        : "circle",
    dotDensity: Math.max(
      0.1,
      Math.min(1, Number.isFinite(rawDotDensity) ? rawDotDensity : 0.58),
    ),
    grainShape:
      source.grainShape === "wave" ||
      source.grainShape === "dots" ||
      source.grainShape === "truchet" ||
      source.grainShape === "ripple" ||
      source.grainShape === "blob" ||
      source.grainShape === "sphere"
        ? source.grainShape
        : "corners",
    palette:
      source.palette === "aurora" || source.palette === "mono"
        ? source.palette
        : "prism",
  };
}

function normalizeBackgroundMeshFx(backgroundMeshFx) {
  const source =
    backgroundMeshFx && typeof backgroundMeshFx === "object" ? backgroundMeshFx : {};
  const rawAmount =
    source.amount === undefined || source.amount === null ? 0.58 : Number(source.amount);
  const rawDotDensity =
    source.dotDensity === undefined || source.dotDensity === null
      ? 0.58
      : Number(source.dotDensity);
  return {
    style:
      source.style === "dotgrid" || source.style === "grain"
        ? source.style
        : "letters",
    amount: Math.max(0, Math.min(1, Number.isFinite(rawAmount) ? rawAmount : 0.58)),
    dotShape:
      source.dotShape === "diamond" ||
      source.dotShape === "square" ||
      source.dotShape === "triangle"
        ? source.dotShape
        : "circle",
    dotDensity: Math.max(
      0.1,
      Math.min(1, Number.isFinite(rawDotDensity) ? rawDotDensity : 0.58),
    ),
    grainShape:
      source.grainShape === "wave" ||
      source.grainShape === "dots" ||
      source.grainShape === "truchet" ||
      source.grainShape === "ripple" ||
      source.grainShape === "blob" ||
      source.grainShape === "sphere"
        ? source.grainShape
        : "corners",
  };
}

function normalizeModeStrengths(modeStrengths) {
  const source = modeStrengths && typeof modeStrengths === "object" ? modeStrengths : {};
  const normalized = {};
  for (const modeId of INTERACTION_MODE_IDS) {
    const raw = Number(source[modeId]);
    normalized[modeId] = Number.isFinite(raw) ? Math.max(0.4, Math.min(1.8, raw)) : 1;
  }
  return normalized;
}

function getPaperPaletteIndex(palette) {
  if (palette === "aurora") return 1;
  if (palette === "mono") return 2;
  return 0;
}

function getPaperEffectIndex(effect) {
  if (effect === "swirl") return 1;
  if (effect === "waves") return 2;
  if (effect === "rays") return 3;
  if (effect === "dotgrid") return 4;
  if (effect === "grain") return 5;
  return 0;
}

function getPaperDotShapeIndex(shape) {
  if (shape === "diamond") return 1;
  if (shape === "square") return 2;
  if (shape === "triangle") return 3;
  return 0;
}

function getPaperGrainShapeIndex(shape) {
  if (shape === "wave") return 1;
  if (shape === "dots") return 2;
  if (shape === "truchet") return 3;
  if (shape === "ripple") return 4;
  if (shape === "blob") return 5;
  if (shape === "sphere") return 6;
  return 0;
}

function normalizeFontSet(fontSet) {
  const fallback = {
    line: '"Geist Pixel Line", ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
    solid: '"Geist Pixel Square", ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
    background:
      '"Geist Pixel Line", ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
  };
  if (!fontSet || typeof fontSet !== "object") return fallback;
  const line =
    typeof fontSet.line === "string" && fontSet.line.trim().length > 0
      ? fontSet.line.trim()
      : fallback.line;
  const solid =
    typeof fontSet.solid === "string" && fontSet.solid.trim().length > 0
      ? fontSet.solid.trim()
      : fallback.solid;
  const background =
    typeof fontSet.background === "string" && fontSet.background.trim().length > 0
      ? fontSet.background.trim()
      : fallback.background;
  return { line, solid, background };
}

async function loadCanvasFont(name, url) {
  const font = new FontFace(name, `url(${url})`);
  await font.load();
  document.fonts.add(font);
}

async function loadPostprocessingModules() {
  const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }, { ShaderPass }] =
    await Promise.all([
      import("three/examples/jsm/postprocessing/EffectComposer.js"),
      import("three/examples/jsm/postprocessing/RenderPass.js"),
      import("three/examples/jsm/postprocessing/UnrealBloomPass.js"),
      import("three/examples/jsm/postprocessing/ShaderPass.js"),
    ]);

  return { EffectComposer, RenderPass, UnrealBloomPass, ShaderPass };
}

function makeGlyphAtlas(glyphs, fontFamily, fontSize) {
  const cell = 120;
  const canvas = document.createElement("canvas");
  canvas.width = cell * glyphs.length;
  canvas.height = cell;
  const context = canvas.getContext("2d");

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#fff";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = `${fontSize}px ${fontFamily}`;

  for (let i = 0; i < glyphs.length; i += 1) {
    context.fillText(glyphs[i], i * cell + cell * 0.5, cell * 0.52);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

function areMotionSettingsEqual(a, b) {
  return (
    (a?.flow ?? 1) === (b?.flow ?? 1) &&
    (a?.drag ?? 1) === (b?.drag ?? 1) &&
    (a?.camera ?? 1) === (b?.camera ?? 1) &&
    (a?.settle ?? 1) === (b?.settle ?? 1)
  );
}

function areFontSetEqual(a, b) {
  return (
    (a?.line ?? "") === (b?.line ?? "") &&
    (a?.solid ?? "") === (b?.solid ?? "") &&
    (a?.background ?? "") === (b?.background ?? "")
  );
}

function arePaperFxEqual(a, b) {
  return (
    (a?.enabled ?? true) === (b?.enabled ?? true) &&
    (a?.palette ?? "prism") === (b?.palette ?? "prism") &&
    (a?.effect ?? "warp") === (b?.effect ?? "warp") &&
    (a?.dotShape ?? "circle") === (b?.dotShape ?? "circle") &&
    (a?.grainShape ?? "corners") === (b?.grainShape ?? "corners") &&
    Math.abs((a?.intensity ?? 0) - (b?.intensity ?? 0)) < 0.0001 &&
    Math.abs((a?.amount ?? 0.58) - (b?.amount ?? 0.58)) < 0.0001 &&
    Math.abs((a?.dotDensity ?? 0.58) - (b?.dotDensity ?? 0.58)) < 0.0001 &&
    Math.abs((a?.speed ?? 1) - (b?.speed ?? 1)) < 0.0001
  );
}

function areBackgroundMeshFxEqual(a, b) {
  return (
    (a?.style ?? "letters") === (b?.style ?? "letters") &&
    (a?.dotShape ?? "circle") === (b?.dotShape ?? "circle") &&
    (a?.grainShape ?? "corners") === (b?.grainShape ?? "corners") &&
    Math.abs((a?.amount ?? 0.58) - (b?.amount ?? 0.58)) < 0.0001 &&
    Math.abs((a?.dotDensity ?? 0.58) - (b?.dotDensity ?? 0.58)) < 0.0001
  );
}

function areModeStrengthsEqual(a, b) {
  return INTERACTION_MODE_IDS.every(
    (modeId) => Math.abs((a?.[modeId] ?? 1) - (b?.[modeId] ?? 1)) < 0.0001,
  );
}

function areHeroPropsEqual(prev, next) {
  return (
    prev.word === next.word &&
    prev.fontLabel === next.fontLabel &&
    prev.interactionMode === next.interactionMode &&
    prev.onInteractionModeChange === next.onInteractionModeChange &&
    prev.colorMode === next.colorMode &&
    prev.onColorModeChange === next.onColorModeChange &&
    prev.motionPreset === next.motionPreset &&
    areMotionSettingsEqual(prev.motionSettings, next.motionSettings) &&
    areModeStrengthsEqual(prev.modeStrengths, next.modeStrengths) &&
    areFontSetEqual(prev.fontSet, next.fontSet) &&
    arePaperFxEqual(prev.paperFx, next.paperFx) &&
    areBackgroundMeshFxEqual(prev.backgroundMeshFx, next.backgroundMeshFx)
  );
}

function TypographyMeshHero({
  word = "GEIST",
  fontSet = null,
  fontLabel = "Geist Pixel",
  interactionMode = "fluid",
  onInteractionModeChange,
  colorMode = "white",
  onColorModeChange,
  motionSettings = { flow: 1, drag: 1, camera: 1, settle: 1 },
  motionPreset = "cinematic",
  modeStrengths = {
    fluid: 1,
    nebula: 1,
    tide: 1,
    vortex: 1,
    ripple: 1,
    magnet: 1,
  },
  paperFx = {
    enabled: true,
    intensity: 0.34,
    palette: "prism",
    effect: "warp",
    amount: 0.58,
    speed: 1,
    dotShape: "circle",
    dotDensity: 0.58,
    grainShape: "corners",
  },
  backgroundMeshFx = {
    style: "letters",
    amount: 0.58,
    dotShape: "circle",
    dotDensity: 0.58,
    grainShape: "corners",
  },
}) {
  const canvasRef = useRef(null);
  const perfRef = useRef(null);
  const retargetWordRef = useRef(null);
  const applyFontSetRef = useRef(null);
  const applyBackgroundMeshFxRef = useRef(null);

  const interactionModeRef = useRef(getInteractionModeIndex(interactionMode));
  const colorModeRef = useRef(getColorModeIndex(colorMode));
  const motionRef = useRef(motionSettings);
  const modeStrengthsRef = useRef(normalizeModeStrengths(modeStrengths));
  const wordRef = useRef(normalizeWord(word));
  const fontSetRef = useRef(normalizeFontSet(fontSet));
  const paperFxRef = useRef(normalizePaperFx(paperFx));
  const backgroundMeshFxRef = useRef(normalizeBackgroundMeshFx(backgroundMeshFx));

  useEffect(() => {
    interactionModeRef.current = getInteractionModeIndex(interactionMode);
  }, [interactionMode]);

  useEffect(() => {
    colorModeRef.current = getColorModeIndex(colorMode);
  }, [colorMode]);

  useEffect(() => {
    motionRef.current = {
      flow: Math.max(0.5, Math.min(1.6, Number(motionSettings.flow) || 1)),
      drag: Math.max(0.5, Math.min(1.6, Number(motionSettings.drag) || 1)),
      camera: Math.max(0.5, Math.min(1.6, Number(motionSettings.camera) || 1)),
      settle: Math.max(0.5, Math.min(1.6, Number(motionSettings.settle) || 1)),
    };
  }, [motionSettings]);

  useEffect(() => {
    modeStrengthsRef.current = normalizeModeStrengths(modeStrengths);
  }, [modeStrengths]);

  useEffect(() => {
    const nextWord = normalizeWord(word);
    wordRef.current = nextWord;
    if (retargetWordRef.current) {
      retargetWordRef.current(nextWord);
    }
  }, [word]);

  useEffect(() => {
    const nextSet = normalizeFontSet(fontSet);
    fontSetRef.current = nextSet;
    if (applyFontSetRef.current) {
      applyFontSetRef.current(nextSet);
    }
  }, [fontSet]);

  useEffect(() => {
    paperFxRef.current = normalizePaperFx(paperFx);
  }, [paperFx]);

  useEffect(() => {
    const nextFx = normalizeBackgroundMeshFx(backgroundMeshFx);
    backgroundMeshFxRef.current = nextFx;
    if (applyBackgroundMeshFxRef.current) {
      applyBackgroundMeshFxRef.current(nextFx);
    }
  }, [backgroundMeshFx]);

  useEffect(() => {
    if (!canvasRef.current) return undefined;

    const fgGlyphs = FOREGROUND_GLYPHS;
    let activeFontSet = fontSetRef.current;
    let activeBackgroundMeshStyle = backgroundMeshFxRef.current.style;

    const timeline = {
      meshEnd: 2.6,
      convergeEnd: 7.2,
      holdEnd: 9.1,
      solidEnd: 12,
    };

    let viewportWidth = window.innerWidth;
    let viewportHeight = window.innerHeight;
    let cameraBaseZ = 0;
    let foregroundStep = 18;
    let solidFontSize = 200;

    let currentWord = wordRef.current;
    let retargetMorph = 1;
    let retargetExcite = 0;

    let qualityScale = Math.max(
      0.72,
      1 - Math.max(0, (window.devicePixelRatio || 1) - 1) * 0.12,
    );
    let qualityEvalAt = 2;
    let fpsEma = 60;
    let hudUpdateAt = 0;

    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setClearColor(0x000000, 1);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 1, 8000);
    scene.add(camera);

    let composer = null;
    let bloomPass = null;
    let filmPass = null;
    let paperPass = null;

    const clock = new THREE.Clock();

    const foregroundData = {
      count: 0,
      homeX: new Float32Array(0),
      homeY: new Float32Array(0),
      posX: new Float32Array(0),
      posY: new Float32Array(0),
      velX: new Float32Array(0),
      velY: new Float32Array(0),
      seed: new Float32Array(0),
      targetX: new Float32Array(0),
      targetY: new Float32Array(0),
      baseGlyph: new Float32Array(0),
      targetGlyph: new Float32Array(0),
      targetSlot: new Uint32Array(0),
    };

    let foregroundTargets = [];
    let targetCount = 0;

    let foregroundMesh = null;
    let foregroundMaterial = null;
    let foregroundAtlas = null;
    let foregroundSolidAtlas = null;
    let foregroundAtlasKey = "";
    let foregroundSolidAtlasKey = "";
    let foregroundOffsetAttribute = null;
    let foregroundDepthAttribute = null;
    let foregroundGlyphAttribute = null;

    let backgroundAtlas = null;
    let backgroundAtlasKey = "";
    let backgroundFallbackTexture = null;
    let backgroundLayers = [];

    let animationFrame = 0;
    let resizeFrame = 0;
    let disposed = false;

    let pointerTargetX = 0;
    let pointerTargetY = 0;
    let pointerX = 0;
    let pointerY = 0;
    let pointerStrengthTarget = 0;
    let pointerStrength = 0;
    let pointerVelocityTargetX = 0;
    let pointerVelocityTargetY = 0;
    let pointerVelocityX = 0;
    let pointerVelocityY = 0;
    let pointerEnergy = 0;
    let ambientDriftX = 0;
    let ambientDriftY = 0;

    function getRenderPixelRatio() {
      const styleScale = activeBackgroundMeshStyle === "letters" ? 1 : 0.88;
      return (
        Math.min(window.devicePixelRatio || 1, 2) *
        (0.72 + 0.28 * qualityScale) *
        styleScale
      );
    }

    function disposeForeground(disposeAtlases = false) {
      if (foregroundMesh) {
        scene.remove(foregroundMesh);
        foregroundMesh.geometry.dispose();
      }
      if (foregroundMaterial) {
        foregroundMaterial.dispose();
      }
      if (disposeAtlases && foregroundAtlas) {
        foregroundAtlas.dispose();
        foregroundAtlasKey = "";
      }
      if (disposeAtlases && foregroundSolidAtlas) {
        foregroundSolidAtlas.dispose();
        foregroundSolidAtlasKey = "";
      }

      foregroundMesh = null;
      foregroundMaterial = null;
      if (disposeAtlases) {
        foregroundAtlas = null;
        foregroundSolidAtlas = null;
      }
      foregroundOffsetAttribute = null;
      foregroundDepthAttribute = null;
      foregroundGlyphAttribute = null;
    }

    function disposeBackgroundLayers(disposeAtlas = false) {
      for (const layer of backgroundLayers) {
        scene.remove(layer.mesh);
        layer.mesh.geometry.dispose();
        layer.material.dispose();
      }
      backgroundLayers = [];
      if (disposeAtlas && backgroundAtlas) {
        backgroundAtlas.dispose();
        backgroundAtlasKey = "";
        backgroundAtlas = null;
      }
      if (disposeAtlas && backgroundFallbackTexture) {
        backgroundFallbackTexture.dispose();
        backgroundFallbackTexture = null;
      }
    }

    function getBackgroundSamplerTexture(style) {
      if (style === "letters") {
        const nextBackgroundAtlasKey = `${BACKGROUND_GLYPHS.join("")}|${activeFontSet.background}|104`;
        if (!backgroundAtlas || backgroundAtlasKey !== nextBackgroundAtlasKey) {
          if (backgroundAtlas) {
            backgroundAtlas.dispose();
          }
          backgroundAtlas = makeGlyphAtlas(
            BACKGROUND_GLYPHS,
            activeFontSet.background,
            104,
          );
          backgroundAtlasKey = nextBackgroundAtlasKey;
        }
        return backgroundAtlas;
      }

      if (backgroundAtlas) {
        backgroundAtlas.dispose();
        backgroundAtlas = null;
        backgroundAtlasKey = "";
      }

      if (!backgroundFallbackTexture) {
        const pixel = new Uint8Array([255, 255, 255, 255]);
        backgroundFallbackTexture = new THREE.DataTexture(pixel, 1, 1);
        backgroundFallbackTexture.needsUpdate = true;
      }
      return backgroundFallbackTexture;
    }

    function fitCamera() {
      camera.aspect = viewportWidth / viewportHeight;
      camera.fov = 38;
      const halfFov = THREE.MathUtils.degToRad(camera.fov * 0.5);
      cameraBaseZ = (viewportHeight * 0.5) / Math.tan(halfFov);
      camera.position.set(0, 0, cameraBaseZ);
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
    }

    function buildForegroundTargets(text) {
      const mask = document.createElement("canvas");
      mask.width = Math.max(1, Math.floor(viewportWidth));
      mask.height = Math.max(1, Math.floor(viewportHeight));
      const context = mask.getContext("2d", { willReadFrequently: true });

      const targetWord = normalizeWord(text);
      let fontSize = Math.min(viewportWidth * 0.34, viewportHeight * 0.58);
      context.font = `${fontSize}px ${activeFontSet.solid}`;
      const maxWidth = viewportWidth * 0.9;
      const measured = context.measureText(targetWord).width;
      if (measured > maxWidth) {
        fontSize = (fontSize * maxWidth) / measured;
      }
      solidFontSize = fontSize;

      context.clearRect(0, 0, mask.width, mask.height);
      context.fillStyle = "#fff";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.font = `${solidFontSize}px ${activeFontSet.solid}`;
      context.fillText(targetWord, mask.width * 0.5, mask.height * 0.5);

      const chars = targetWord.split("");
      const glyphByChar = new Map(fgGlyphs.map((char, idx) => [char, idx]));
      const widths = chars.map((char) => context.measureText(char).width);
      const totalWidth = widths.reduce((sum, width) => sum + width, 0);
      const startX = mask.width * 0.5 - totalWidth * 0.5;
      const ranges = [];
      let cursor = startX;
      for (let i = 0; i < chars.length; i += 1) {
        const width = widths[i];
        ranges.push({ start: cursor, end: cursor + width, char: chars[i] });
        cursor += width;
      }

      const sampleStep = Math.max(2, Math.floor(foregroundStep * 0.38));
      const data = context.getImageData(0, 0, mask.width, mask.height).data;
      const targets = [];

      for (let y = 0; y < mask.height; y += sampleStep) {
        for (let x = 0; x < mask.width; x += sampleStep) {
          const alpha = data[(y * mask.width + x) * 4 + 3];
          if (alpha > 28) {
            let rangeIdx = ranges.findIndex((range) => x >= range.start && x <= range.end);
            if (rangeIdx === -1) {
              rangeIdx = x < startX ? 0 : ranges.length - 1;
            }
            const targetChar = ranges[Math.max(0, rangeIdx)]?.char ?? chars[0] ?? "G";
            targets.push({
              x: x - mask.width * 0.5,
              y: mask.height * 0.5 - y,
              glyph: glyphByChar.get(targetChar) ?? 0,
            });
          }
        }
      }

      return targets;
    }

    function assignForegroundTargets(preserveSlots) {
      const nextCount = foregroundTargets.length;

      for (let i = 0; i < foregroundData.count; i += 1) {
        if (nextCount === 0) {
          foregroundData.targetX[i] = foregroundData.homeX[i];
          foregroundData.targetY[i] = foregroundData.homeY[i];
          foregroundData.targetGlyph[i] = foregroundData.baseGlyph[i];
          foregroundData.targetSlot[i] = 0;
          continue;
        }

        let slot;
        if (preserveSlots && targetCount > 0) {
          const oldSlot = foregroundData.targetSlot[i] ?? 0;
          const ratio = targetCount <= 1 ? 0 : oldSlot / (targetCount - 1);
          const jitter = (hash01(i * 31.7 + targetCount * 0.17) - 0.5) * 1.8;
          slot = Math.round(ratio * (nextCount - 1) + jitter);
          slot = Math.max(0, Math.min(nextCount - 1, slot));
        } else {
          slot = (i * 17) % nextCount;
        }

        const target = foregroundTargets[slot];
        foregroundData.targetX[i] = target.x;
        foregroundData.targetY[i] = target.y;
        foregroundData.targetGlyph[i] = target.glyph;
        foregroundData.targetSlot[i] = slot;
      }

      targetCount = nextCount;
    }

    function buildBackgroundMeshes() {
      disposeBackgroundLayers();
      const minEdge = Math.min(viewportWidth, viewportHeight);
      const isLettersStyle = activeBackgroundMeshStyle === "letters";
      const backgroundSamplerTexture = getBackgroundSamplerTexture(activeBackgroundMeshStyle);
      const baseStep = isLettersStyle
        ? Math.max(8, Math.min(14, Math.round(minEdge / 86)))
        : Math.max(14, Math.min(22, Math.round(minEdge / 64)));
      const layerConfigs = isLettersStyle
        ? [
            {
              depth: -560,
              density: 0.72,
              parallax: 0.045,
              alphaMul: 0.34,
              chaosBias: 0.08,
              driftScale: 0.6,
              rotScale: 0.65,
              sizeScale: 1.18,
            },
            {
              depth: -430,
              density: 0.9,
              parallax: 0.08,
              alphaMul: 0.5,
              chaosBias: 0.15,
              driftScale: 0.85,
              rotScale: 0.9,
              sizeScale: 1.0,
            },
            {
              depth: -310,
              density: 1.05,
              parallax: 0.12,
              alphaMul: 0.72,
              chaosBias: 0.24,
              driftScale: 1.12,
              rotScale: 1.18,
              sizeScale: 0.88,
            },
          ]
        : [
            {
              depth: -480,
              density: 0.62,
              parallax: 0.055,
              alphaMul: 0.5,
              chaosBias: 0.12,
              driftScale: 0.72,
              rotScale: 0.72,
              sizeScale: 1.42,
            },
            {
              depth: -340,
              density: 0.78,
              parallax: 0.095,
              alphaMul: 0.74,
              chaosBias: 0.2,
              driftScale: 0.98,
              rotScale: 0.94,
              sizeScale: 1.18,
            },
          ];

      for (const config of layerConfigs) {
        const step = Math.max(
          7,
          Math.min(18, baseStep / (qualityScale * config.density)),
        );
        const columns = Math.ceil((viewportWidth * 1.55) / step) + 12;
        const rows = Math.ceil((viewportHeight * 1.55) / step) + 12;
        const count = columns * rows;

        const quad = new THREE.PlaneGeometry(1, 1);
        const geometry = new THREE.InstancedBufferGeometry();
        geometry.index = quad.index;
        geometry.attributes.position = quad.attributes.position;
        geometry.attributes.uv = quad.attributes.uv;
        geometry.instanceCount = count;

        const base = new Float32Array(count * 2);
        const glyph = new Float32Array(count);
        const tone = new Float32Array(count);
        const size = new Float32Array(count);
        const seed = new Float32Array(count);

        let index = 0;
        for (let row = 0; row < rows; row += 1) {
          for (let col = 0; col < columns; col += 1) {
            base[index * 2] = -viewportWidth * 0.78 + col * step;
            base[index * 2 + 1] = viewportHeight * 0.78 - row * step;
            glyph[index] = Math.floor(randomBetween(0, BACKGROUND_GLYPHS.length));
            tone[index] = randomBetween(0.66, 1);
            size[index] =
              randomBetween(step * 0.64, step * 1.18) * config.sizeScale;
            seed[index] = randomBetween(0, Math.PI * 2);
            index += 1;
          }
        }

        geometry.setAttribute("aBase", new THREE.InstancedBufferAttribute(base, 2));
        geometry.setAttribute("aGlyph", new THREE.InstancedBufferAttribute(glyph, 1));
        geometry.setAttribute("aTone", new THREE.InstancedBufferAttribute(tone, 1));
        geometry.setAttribute("aSize", new THREE.InstancedBufferAttribute(size, 1));
        geometry.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seed, 1));

        const material = new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          uniforms: {
            uAtlas: { value: backgroundSamplerTexture },
            uGlyphCount: { value: BACKGROUND_GLYPHS.length },
            uTime: { value: 0 },
            uAlpha: { value: 1 },
            uSettle: { value: 0 },
            uChaos: { value: 0 },
            uLayerDepth: { value: config.depth },
            uPointer: { value: new THREE.Vector2(0, 0) },
            uPointerVelocity: { value: new THREE.Vector2(0, 0) },
            uPointerStrength: { value: 0 },
            uPointerRadius: { value: 1 },
            uPointerWarp: { value: 0 },
            uDrift: { value: new THREE.Vector2(0, 0) },
            uMode: { value: interactionModeRef.current },
            uViewport: { value: new THREE.Vector2(viewportWidth, viewportHeight) },
            uStyle: { value: 0 },
            uFxAmount: { value: 0.58 },
            uDotShape: { value: 0 },
            uDotDensity: { value: 0.58 },
            uGrainShape: { value: 0 },
          },
          vertexShader: `
            attribute vec2 aBase;
            attribute float aGlyph;
            attribute float aTone;
            attribute float aSize;
            attribute float aSeed;

            uniform float uTime;
            uniform float uSettle;
            uniform float uChaos;
            uniform float uLayerDepth;
            uniform vec2 uPointer;
            uniform vec2 uPointerVelocity;
            uniform float uPointerStrength;
            uniform float uPointerRadius;
            uniform float uPointerWarp;
            uniform vec2 uDrift;
            uniform float uMode;

            varying vec2 vUv;
            varying float vGlyph;
            varying float vTone;
            varying float vPulse;
            varying vec2 vWorld;
            varying float vSeed;

            void main() {
              float stream = sin(uTime * (0.24 + uChaos * 0.25) + aSeed * 6.2831) * (4.0 + uChaos * 6.0);
              vec2 wobble = vec2(
                sin(uTime * (0.28 + uChaos * 0.4) + aSeed * 3.3) * (5.0 + 8.0 * uChaos),
                cos(uTime * (0.31 + uChaos * 0.5) + aSeed * 4.1) * (4.0 + 7.0 * uChaos)
              ) * (1.0 - uSettle * 0.45);

              vec2 p = aBase + wobble + vec2(stream, 0.0) + uDrift * (10.0 + 8.0 * uChaos);
              vec2 ambient = vec2(
                sin((p.y + aSeed * 80.0) * 0.014 + uTime * 0.37) + cos((p.x + p.y) * 0.008 - uTime * 0.29),
                cos((p.x - aSeed * 95.0) * 0.013 - uTime * 0.34) + sin((p.x - p.y) * 0.007 + uTime * 0.31)
              );
              p += normalize(ambient + vec2(0.001, -0.001)) * (2.0 + 4.5 * uChaos) * (1.0 - uSettle * 0.42);

              vec2 delta = p - uPointer;
              float dist = length(delta) + 0.0001;
              float radial = clamp(1.0 - dist / uPointerRadius, 0.0, 1.0);
              float falloff = radial * radial * (3.0 - 2.0 * radial);
              float influence = falloff * uPointerStrength;
              vec2 dir = delta / dist;
              float organic = 0.5 + 0.5 * sin(uTime * 0.41 + aSeed * 9.0);
              vec2 flow;
              float pressureScale;
              float dragScale;
              float fieldScale;

              if (uMode < 0.5) {
                flow = vec2(
                  sin((p.y + aSeed * 120.0) * 0.018 + uTime * 0.82),
                  cos((p.x - aSeed * 140.0) * 0.017 - uTime * 0.76)
                );
                pressureScale = 0.14;
                dragScale = 0.055 + 0.04 * organic;
                fieldScale = 0.05 + 0.03 * organic;
              } else if (uMode < 1.5) {
                vec2 orbit = normalize(vec2(-delta.y, delta.x) + vec2(0.0002, -0.0001));
                vec2 cloud = vec2(
                  sin((p.y - p.x) * 0.012 + uTime * 0.61 + aSeed * 11.0),
                  cos((p.y + p.x) * 0.01 - uTime * 0.58 + aSeed * 8.0)
                );
                flow = orbit * (0.45 + 0.35 * organic) + cloud * 0.65;
                pressureScale = 0.09;
                dragScale = 0.048 + 0.03 * organic;
                fieldScale = 0.07 + 0.05 * organic;
              } else if (uMode < 2.5) {
                flow = vec2(
                  sin(p.y * 0.01 + uTime * 0.83 + aSeed * 4.2) + cos((p.x + p.y) * 0.007 + uTime * 0.26),
                  sin(p.x * 0.009 - uTime * 0.79 + aSeed * 3.1) + cos((p.x - p.y) * 0.006 - uTime * 0.22)
                );
                pressureScale = 0.19;
                dragScale = 0.05 + 0.02 * organic;
                fieldScale = 0.04 + 0.02 * organic;
              } else if (uMode < 3.5) {
                vec2 orbit = normalize(vec2(-delta.y, delta.x) + vec2(0.0003, 0.0002));
                float spiral = sin(dist * 0.028 - uTime * 1.18 + aSeed * 6.0);
                vec2 curl = vec2(
                  cos((p.x + p.y) * 0.01 + uTime * 0.67),
                  sin((p.y - p.x) * 0.011 - uTime * 0.61)
                );
                flow = orbit * (0.75 + 0.3 * organic) + curl * 0.5 + dir * spiral * 0.35;
                pressureScale = 0.24;
                dragScale = 0.038 + 0.022 * organic;
                fieldScale = 0.1 + 0.05 * organic;
              } else if (uMode < 4.5) {
                float wave = sin(dist * 0.04 - uTime * 1.55 + aSeed * 7.3);
                vec2 radial = dir * wave;
                vec2 cross = vec2(-dir.y, dir.x) * (0.3 + 0.25 * organic);
                flow = radial + cross;
                pressureScale = 0.12;
                dragScale = 0.07 + 0.03 * organic;
                fieldScale = 0.085 + 0.03 * organic;
              } else {
                vec2 pull = -dir;
                vec2 jitter = vec2(
                  sin((p.y + aSeed * 130.0) * 0.02 + uTime * 0.92),
                  cos((p.x - aSeed * 95.0) * 0.019 - uTime * 0.86)
                );
                flow = pull * (0.85 + 0.25 * organic) + jitter * 0.45;
                pressureScale = -0.11;
                dragScale = 0.09 + 0.035 * organic;
                fieldScale = 0.07 + 0.025 * organic;
              }

              flow = normalize(flow + vec2(0.0001, 0.0002));
              float pressure = (0.52 - radial) * uPointerWarp * influence * pressureScale;
              vec2 drag = uPointerVelocity * influence * dragScale;
              p += flow * uPointerWarp * influence * fieldScale;
              p += drag + dir * pressure;

              vUv = uv;
              vGlyph = aGlyph;
              vTone = aTone;
              vPulse = 0.45 + 0.55 * sin(uTime * (0.38 + uChaos * 0.3) + aSeed * 10.0);
              vWorld = p;
              vSeed = aSeed;

              vec3 world = vec3(position.xy * aSize + p, uLayerDepth);
              gl_Position = projectionMatrix * modelViewMatrix * vec4(world, 1.0);
            }
          `,
          fragmentShader: `
            uniform sampler2D uAtlas;
            uniform float uGlyphCount;
            uniform float uAlpha;
            uniform vec2 uViewport;
            uniform float uTime;
            uniform float uStyle;
            uniform float uFxAmount;
            uniform float uDotShape;
            uniform float uDotDensity;
            uniform float uGrainShape;

            varying vec2 vUv;
            varying float vGlyph;
            varying float vTone;
            varying float vPulse;
            varying vec2 vWorld;
            varying float vSeed;

            float hash(vec2 p) {
              return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
            }

            float noise(vec2 p) {
              vec2 i = floor(p);
              vec2 f = fract(p);
              float a = hash(i);
              float b = hash(i + vec2(1.0, 0.0));
              float c = hash(i + vec2(0.0, 1.0));
              float d = hash(i + vec2(1.0, 1.0));
              vec2 u = f * f * (3.0 - 2.0 * f);
              return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
            }

            float fbm(vec2 p) {
              float value = 0.0;
              float amp = 0.5;
              for (int i = 0; i < 4; i++) {
                value += amp * noise(p);
                p = p * 2.03 + vec2(17.13, 9.41);
                amp *= 0.52;
              }
              return value;
            }

            mat2 rot(float a) {
              float c = cos(a);
              float s = sin(a);
              return mat2(c, -s, s, c);
            }

            float dotShapeMask(vec2 p, float shape) {
              vec2 q = p;
              if (shape < 0.5) {
                float d = length(q);
                return 1.0 - smoothstep(0.36, 0.42, d);
              }
              if (shape < 1.5) {
                q = abs(q);
                float d = q.x + q.y;
                return 1.0 - smoothstep(0.43, 0.5, d);
              }
              if (shape < 2.5) {
                q = abs(q);
                float d = max(q.x, q.y);
                return 1.0 - smoothstep(0.36, 0.42, d);
              }
              q.y += 0.12;
              float d = max(abs(q.x) * 1.15 + q.y * 0.9, -q.y);
              return 1.0 - smoothstep(0.34, 0.42, d);
            }

            vec2 grainWarp(vec2 uv, float shape, float t, float amt) {
              vec2 p = uv;
              if (shape < 0.5) {
                vec2 c = abs(p);
                p += sign(uv) * pow(c, vec2(1.9)) * (0.26 + amt * 0.45);
              } else if (shape < 1.5) {
                p += vec2(
                  sin(p.y * (3.5 + amt * 2.0) + t * 0.72),
                  cos(p.x * (3.2 + amt * 2.2) - t * 0.63)
                ) * (0.2 + 0.26 * amt);
              } else if (shape < 2.5) {
                vec2 grid = floor((p + 1.0) * (3.0 + amt * 4.0));
                float j = hash(grid + vec2(1.9, -2.4));
                p = fract((p + 1.0) * (3.0 + amt * 4.0)) - 0.5;
                if (j > 0.5) {
                  p.x *= -1.0;
                }
                p = p * rot(t * 0.15 + j * 3.1415);
              } else if (shape < 3.5) {
                vec2 d = p;
                float l = length(d) + 0.0001;
                p += normalize(d) * (0.24 + 0.38 * amt) * exp(-l * 2.6) * sin(t * 0.7 + l * 9.0);
              } else if (shape < 4.5) {
                float r = length(p);
                p += vec2(
                  sin(r * (10.0 + amt * 14.0) - t * 0.62),
                  cos(r * (8.4 + amt * 12.0) + t * 0.55)
                ) * (0.1 + 0.2 * amt);
              } else if (shape < 5.5) {
                vec2 d = p;
                float l = length(d) + 0.0001;
                p += normalize(d) * (0.18 + 0.38 * amt) * exp(-l * 1.9);
              } else {
                float r = length(p);
                p = normalize(p + vec2(0.0001, -0.0001)) * pow(r, 1.2 + amt * 0.65);
              }
              return p;
            }

            float dotGridField(vec2 world) {
              float cellSize = mix(22.0, 8.0, uDotDensity);
              vec2 grid = world / max(2.0, cellSize);
              vec2 cell = floor(grid);
              vec2 local = fract(grid) - 0.5;
              float jitter = hash(cell + vec2(vSeed * 19.3, -vSeed * 11.7));
              local += vec2(
                sin(uTime * 0.32 + jitter * 6.2831),
                cos(uTime * 0.27 + jitter * 5.17)
              ) * (0.05 + 0.11 * uFxAmount);
              float dotMask = dotShapeMask(local * 2.0, uDotShape);
              float pulse = 0.82 + 0.18 * sin(uTime * 0.54 + jitter * 6.2831 + vSeed * 7.0);
              return dotMask * pulse;
            }

            float grainField(vec2 world) {
              vec2 scale = max(uViewport, vec2(1.0));
              vec2 uv = world / scale;
              uv *= 2.7;
              vec2 warped = grainWarp(uv, uGrainShape, uTime * 0.4, uFxAmount);
              float nA = noise(warped * (4.4 + uFxAmount * 2.2) + vec2(uTime * 0.05, -uTime * 0.03));
              float nB = noise(warped * (8.1 + uFxAmount * 3.1) - vec2(uTime * 0.08, uTime * 0.06));
              float ridge = abs(sin((nA * 1.25 + nB * 0.92 + uv.x * 0.64 - uv.y * 0.48) * 6.2831));
              return clamp(0.18 + nA * 0.52 + nB * 0.23 + ridge * 0.36, 0.0, 1.0);
            }

            void main() {
              if (uStyle < 0.5) {
                float idx = floor(vGlyph + 0.5);
                vec2 uv = vec2((vUv.x + idx) / uGlyphCount, vUv.y);
                vec4 texel = texture2D(uAtlas, uv);
                float alpha =
                  texel.a * (0.12 + 0.2 * vPulse) * uAlpha * (0.3 + 0.7 * uFxAmount);
                if (alpha < 0.004) discard;
                float luminance = clamp(0.74 + 0.2 * vTone + vPulse * 0.1, 0.0, 1.0);
                gl_FragColor = vec4(vec3(luminance), min(alpha, 1.0));
                return;
              }

              if (uStyle < 1.5) {
                float dotField = dotGridField(vWorld);
                float dotCellMask = dotShapeMask((vUv - 0.5) * 2.0, uDotShape);
                float alpha = dotCellMask * dotField * uAlpha * (0.08 + 0.92 * uFxAmount);
                if (alpha < 0.004) discard;
                float luminance = clamp(0.8 + dotField * 0.22, 0.0, 1.0);
                gl_FragColor = vec4(vec3(luminance), min(alpha, 1.0));
                return;
              }

              float grain = grainField(vWorld);
              float edge =
                smoothstep(0.0, 0.16, vUv.x) *
                (1.0 - smoothstep(0.84, 1.0, vUv.x)) *
                smoothstep(0.0, 0.16, vUv.y) *
                (1.0 - smoothstep(0.84, 1.0, vUv.y));
              float alpha = grain * edge * uAlpha * (0.06 + 0.9 * uFxAmount);
              if (alpha < 0.004) discard;
              float luminance = clamp(0.68 + grain * 0.32, 0.0, 1.0);
              gl_FragColor = vec4(vec3(luminance), min(alpha, 1.0));
            }
          `,
        });

        const mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);
        backgroundLayers.push({
          mesh,
          material,
          parallax: config.parallax,
          alphaMul: config.alphaMul,
          chaosBias: config.chaosBias,
          driftScale: config.driftScale,
          rotScale: config.rotScale,
        });
      }
    }

    function buildForegroundMesh() {
      disposeForeground();

      const nextForegroundAtlasKey = `${fgGlyphs.join("")}|${activeFontSet.line}|95`;
      if (!foregroundAtlas || foregroundAtlasKey !== nextForegroundAtlasKey) {
        if (foregroundAtlas) {
          foregroundAtlas.dispose();
        }
        foregroundAtlas = makeGlyphAtlas(fgGlyphs, activeFontSet.line, 95);
        foregroundAtlasKey = nextForegroundAtlasKey;
      }

      const nextForegroundSolidAtlasKey = `${fgGlyphs.join("")}|${activeFontSet.solid}|95`;
      if (!foregroundSolidAtlas || foregroundSolidAtlasKey !== nextForegroundSolidAtlasKey) {
        if (foregroundSolidAtlas) {
          foregroundSolidAtlas.dispose();
        }
        foregroundSolidAtlas = makeGlyphAtlas(fgGlyphs, activeFontSet.solid, 95);
        foregroundSolidAtlasKey = nextForegroundSolidAtlasKey;
      }

      const baseStep = Math.max(
        14,
        Math.min(23, Math.round(Math.min(viewportWidth, viewportHeight) / 43)),
      );
      foregroundStep = Math.max(14, Math.min(34, baseStep / qualityScale));
      const foregroundSize = Math.max(10, Math.floor(foregroundStep * 0.88));

      const columns = Math.ceil(viewportWidth / foregroundStep);
      const rows = Math.ceil(viewportHeight / foregroundStep);
      const count = columns * rows;

      foregroundData.count = count;
      foregroundData.homeX = new Float32Array(count);
      foregroundData.homeY = new Float32Array(count);
      foregroundData.posX = new Float32Array(count);
      foregroundData.posY = new Float32Array(count);
      foregroundData.velX = new Float32Array(count);
      foregroundData.velY = new Float32Array(count);
      foregroundData.seed = new Float32Array(count);
      foregroundData.targetX = new Float32Array(count);
      foregroundData.targetY = new Float32Array(count);
      foregroundData.baseGlyph = new Float32Array(count);
      foregroundData.targetGlyph = new Float32Array(count);
      foregroundData.targetSlot = new Uint32Array(count);

      const quad = new THREE.PlaneGeometry(1, 1);
      const geometry = new THREE.InstancedBufferGeometry();
      geometry.index = quad.index;
      geometry.attributes.position = quad.attributes.position;
      geometry.attributes.uv = quad.attributes.uv;
      geometry.instanceCount = count;

      const offsets = new Float32Array(count * 2);
      const glyph = new Float32Array(count);
      const tone = new Float32Array(count);
      const size = new Float32Array(count);
      const depth = new Float32Array(count);
      const tintWhite = new Float32Array(count * 3);
      const tintColor = new Float32Array(count * 3);
      const colorScratch = new THREE.Color();

      let index = 0;
      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < columns; col += 1) {
          const x = -viewportWidth * 0.5 + col * foregroundStep + foregroundStep * 0.5;
          const y = viewportHeight * 0.5 - row * foregroundStep - foregroundStep * 0.5;

          foregroundData.homeX[index] = x;
          foregroundData.homeY[index] = y;
          foregroundData.posX[index] =
            x + randomBetween(-foregroundStep * 0.25, foregroundStep * 0.25);
          foregroundData.posY[index] =
            y + randomBetween(-foregroundStep * 0.25, foregroundStep * 0.25);
          foregroundData.velX[index] = randomBetween(-0.45, 0.45);
          foregroundData.velY[index] = randomBetween(-0.45, 0.45);
          foregroundData.seed[index] = randomBetween(0, Math.PI * 2);

          offsets[index * 2] = foregroundData.posX[index];
          offsets[index * 2 + 1] = foregroundData.posY[index];

          glyph[index] = Math.floor(randomBetween(0, fgGlyphs.length));
          foregroundData.baseGlyph[index] = glyph[index];

          tone[index] = randomBetween(0.72, 1);
          size[index] = foregroundSize;
          depth[index] = randomBetween(-180, 180);

          const whiteBase = randomBetween(0.8, 1);
          const warmth = randomBetween(-1, 1);
          tintWhite[index * 3] = clamp01(whiteBase * (1 + warmth * 0.06));
          tintWhite[index * 3 + 1] = clamp01(whiteBase * (1 + warmth * 0.015));
          tintWhite[index * 3 + 2] = clamp01(whiteBase * (1 - warmth * 0.05));

          colorScratch.setHSL(
            (index * 0.017 + foregroundData.seed[index] * 0.11) % 1,
            randomBetween(0.56, 0.9),
            randomBetween(0.58, 0.84),
          );
          tintColor[index * 3] = colorScratch.r;
          tintColor[index * 3 + 1] = colorScratch.g;
          tintColor[index * 3 + 2] = colorScratch.b;

          index += 1;
        }
      }

      foregroundTargets = buildForegroundTargets(currentWord);
      targetCount = 0;
      assignForegroundTargets(false);

      foregroundOffsetAttribute = new THREE.InstancedBufferAttribute(offsets, 2);
      foregroundOffsetAttribute.setUsage(THREE.DynamicDrawUsage);
      foregroundDepthAttribute = new THREE.InstancedBufferAttribute(depth, 1);
      foregroundDepthAttribute.setUsage(THREE.DynamicDrawUsage);
      foregroundGlyphAttribute = new THREE.InstancedBufferAttribute(glyph, 1);
      foregroundGlyphAttribute.setUsage(THREE.DynamicDrawUsage);

      geometry.setAttribute("aOffset", foregroundOffsetAttribute);
      geometry.setAttribute("aGlyph", foregroundGlyphAttribute);
      geometry.setAttribute("aTone", new THREE.InstancedBufferAttribute(tone, 1));
      geometry.setAttribute("aSize", new THREE.InstancedBufferAttribute(size, 1));
      geometry.setAttribute("aDepth", foregroundDepthAttribute);
      geometry.setAttribute(
        "aTintWhite",
        new THREE.InstancedBufferAttribute(tintWhite, 3),
      );
      geometry.setAttribute(
        "aTintColor",
        new THREE.InstancedBufferAttribute(tintColor, 3),
      );

      foregroundMaterial = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: {
          uAtlasLine: { value: foregroundAtlas },
          uAtlasSolid: { value: foregroundSolidAtlas },
          uGlyphCount: { value: fgGlyphs.length },
          uAlpha: { value: 1 },
          uSettle: { value: 0 },
          uTime: { value: 0 },
          uDepthAmp: { value: 0 },
          uSolidify: { value: 0 },
          uColorMode: { value: colorModeRef.current },
        },
        vertexShader: `
          attribute vec2 aOffset;
          attribute float aGlyph;
          attribute float aTone;
          attribute float aSize;
          attribute float aDepth;
          attribute vec3 aTintWhite;
          attribute vec3 aTintColor;

          uniform float uSettle;
          uniform float uTime;
          uniform float uDepthAmp;
          uniform float uSolidify;

          varying vec2 vUv;
          varying float vGlyph;
          varying float vTone;
          varying vec3 vTintWhite;
          varying vec3 vTintColor;

          void main() {
            vUv = uv;
            vGlyph = aGlyph;
            vTone = aTone;
            vTintWhite = aTintWhite;
            vTintColor = aTintColor;

            float zNoise = sin(uTime * 1.3 + aDepth * 0.03 + aGlyph * 2.1) * uDepthAmp;
            float z = aDepth * (1.0 - uSettle) + zNoise;
            float size = aSize * (1.0 + uSolidify * 0.06);
            vec3 p = vec3(position.xy * size + aOffset, z);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          }
        `,
        fragmentShader: `
          uniform sampler2D uAtlasLine;
          uniform sampler2D uAtlasSolid;
          uniform float uGlyphCount;
          uniform float uAlpha;
          uniform float uSolidify;
          uniform float uColorMode;

          varying vec2 vUv;
          varying float vGlyph;
          varying float vTone;
          varying vec3 vTintWhite;
          varying vec3 vTintColor;

          void main() {
            float idx = floor(vGlyph + 0.5);
            vec2 uv = vec2((vUv.x + idx) / uGlyphCount, vUv.y);
            float lineInk = texture2D(uAtlasLine, uv).a;
            float solidInk = texture2D(uAtlasSolid, uv).a;
            float ink = mix(lineInk, solidInk, uSolidify);
            float alpha = ink * uAlpha;
            if (alpha < 0.01) discard;

            vec3 whiteShade = mix(vTintWhite, vec3(1.0), uSolidify * 0.48);
            vec3 vividShade = mix(vTintColor, vec3(1.0), uSolidify * 0.18);
            vec3 toneLift = vec3(0.88 + vTone * 0.18);
            vec3 color = clamp(
              mix(whiteShade, vividShade, clamp(uColorMode, 0.0, 1.0)) * toneLift,
              0.0,
              1.0
            );

            gl_FragColor = vec4(color, alpha);
          }
        `,
      });

      foregroundMesh = new THREE.Mesh(geometry, foregroundMaterial);
      foregroundMesh.position.set(0, 0, 10);
      scene.add(foregroundMesh);
    }

    function rebuildScene() {
      fitCamera();
      buildBackgroundMeshes();
      buildForegroundMesh();
    }

    function applyRenderScale() {
      const pixelRatio = getRenderPixelRatio();
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(viewportWidth, viewportHeight, false);

      if (composer && bloomPass) {
        composer.setPixelRatio(pixelRatio);
        composer.setSize(viewportWidth, viewportHeight);
        bloomPass.setSize(viewportWidth, viewportHeight);
      }
    }

    function onResize() {
      viewportWidth = Math.max(320, window.innerWidth);
      viewportHeight = Math.max(240, window.innerHeight);
      applyRenderScale();
      rebuildScene();
    }

    function retargetWord(nextWord) {
      const normalized = normalizeWord(nextWord);
      if (!normalized || normalized === currentWord || foregroundData.count === 0) {
        return;
      }

      currentWord = normalized;
      foregroundTargets = buildForegroundTargets(currentWord);
      assignForegroundTargets(true);
      retargetMorph = 0;
      retargetExcite = 1;
    }

    function applyFontSet(nextSet) {
      const normalized = normalizeFontSet(nextSet);
      if (
        normalized.line === activeFontSet.line &&
        normalized.solid === activeFontSet.solid &&
        normalized.background === activeFontSet.background
      ) {
        return;
      }

      activeFontSet = normalized;
      rebuildScene();
      retargetMorph = 0;
      retargetExcite = 1;
    }

    function applyBackgroundMeshFx(nextFx) {
      const normalized = normalizeBackgroundMeshFx(nextFx);
      if (normalized.style === activeBackgroundMeshStyle) return;
      activeBackgroundMeshStyle = normalized.style;
      onResize();
    }

    function onPointerMove(event) {
      const nextX = (event.clientX / viewportWidth - 0.5) * 2;
      const nextY = (event.clientY / viewportHeight - 0.5) * 2;
      pointerVelocityTargetX = nextX - pointerTargetX;
      pointerVelocityTargetY = nextY - pointerTargetY;
      pointerTargetX = nextX;
      pointerTargetY = nextY;
      pointerStrengthTarget = 1;
    }

    function resetPointerState(immediate = false) {
      pointerTargetX = 0;
      pointerTargetY = 0;
      pointerStrengthTarget = 0;
      pointerVelocityTargetX = 0;
      pointerVelocityTargetY = 0;
      if (immediate) {
        pointerX = 0;
        pointerY = 0;
        pointerStrength = 0;
        pointerVelocityX = 0;
        pointerVelocityY = 0;
        pointerEnergy = 0;
      }
    }

    function onPointerLeave() {
      resetPointerState(true);
    }

    function onPointerCancel() {
      resetPointerState(true);
    }

    function onWindowBlur() {
      resetPointerState(true);
    }

    function onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        resetPointerState(true);
      }
    }

    function onKeyDown(event) {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      const hotkeyIndex = Number.parseInt(event.key, 10) - 1;
      if (
        onInteractionModeChange &&
        Number.isInteger(hotkeyIndex) &&
        hotkeyIndex >= 0 &&
        hotkeyIndex < INTERACTION_MODES.length
      ) {
        onInteractionModeChange(INTERACTION_MODES[hotkeyIndex].id);
        return;
      }
      if (event.key.toLowerCase() === "m" && onInteractionModeChange) {
        const next = (interactionModeRef.current + 1) % INTERACTION_MODES.length;
        onInteractionModeChange(INTERACTION_MODES[next].id);
        return;
      }
      if (event.key.toLowerCase() === "c" && onColorModeChange) {
        const next = (colorModeRef.current + 1) % COLOR_MODE_IDS.length;
        onColorModeChange(COLOR_MODE_IDS[next]);
      }
    }

    function animate() {
      if (disposed) return;

      const delta = Math.min(0.05, clock.getDelta());
      const t = clock.elapsedTime;
      const motion = motionRef.current;

      const fps = 1 / Math.max(0.0001, delta);
      fpsEma += (fps - fpsEma) * 0.08;

      if (t > qualityEvalAt) {
        let targetQuality =
          1 - Math.max(0, (window.devicePixelRatio || 1) - 1) * 0.14;

        if (fpsEma < 58) targetQuality -= 0.04;
        if (fpsEma < 50) targetQuality -= 0.07;
        if (fpsEma < 42) targetQuality -= 0.09;
        if (fpsEma < 34) targetQuality -= 0.12;
        if (fpsEma > 63) targetQuality += 0.05;

        targetQuality = Math.max(0.62, Math.min(1.05, targetQuality));

        if (Math.abs(targetQuality - qualityScale) > 0.08) {
          qualityScale += Math.sign(targetQuality - qualityScale) * 0.08;
          qualityScale = Math.max(0.62, Math.min(1.05, qualityScale));
          qualityEvalAt = t + 3.2;
          applyRenderScale();
          animationFrame = window.requestAnimationFrame(animate);
          return;
        }

        qualityEvalAt = t + 3.2;
      }

      const timelineSpeed = 0.72 + motion.settle * 0.58;
      const motionTime = t * timelineSpeed;

      const baseConverge = smoothstep(timeline.meshEnd, timeline.convergeEnd, motionTime);
      const lockPhase = smoothstep(timeline.holdEnd, timeline.solidEnd, motionTime);
      const flow =
        0.5 +
        0.5 *
          Math.sin(
            motionTime * (0.22 * motion.flow) +
              Math.sin(motionTime * (0.07 * motion.flow + 0.03)),
          );
      const breath =
        0.5 +
        0.5 *
          Math.sin(
            motionTime * (0.54 * motion.flow * 0.86) +
              Math.sin(motionTime * (0.13 * motion.flow + 0.07)),
          );

      const rhythmWarp = Math.sin(motionTime * 0.9) * 0.04 * (1 - baseConverge);
      const converge = clamp01(baseConverge + rhythmWarp);

      const settle = smoothstep(timeline.meshEnd + 0.4, timeline.solidEnd, motionTime);
      const settleBack = easeOutBack(settle);
      const solidifyMix = smoothstep(
        timeline.solidEnd - 1.3,
        timeline.solidEnd + 0.4,
        motionTime,
      );
      const floatingMix = 1 - solidifyMix;

      const foregroundAlpha = 0.56 + 0.34 * converge + 0.1 * solidifyMix;
      const backgroundAlpha = 0.84 - lockPhase * 0.16 + breath * 0.05;

      retargetMorph = Math.min(
        1,
        retargetMorph + delta * (0.72 + 0.9 * motion.settle),
      );
      retargetExcite += (0 - retargetExcite) * expSmoothing(2.8, delta);
      const retargetBlend = smoothstep(0.02, 0.96, retargetMorph);

      const pointerFollow = expSmoothing(7.2 * motion.drag, delta);
      const velocityFollow = expSmoothing(12.5 * motion.drag, delta);
      const strengthFollow = expSmoothing(4.4 * motion.drag, delta);
      const trailFade = Math.exp(-6.4 * delta * (0.8 + motion.drag * 0.2));

      pointerX += (pointerTargetX - pointerX) * pointerFollow;
      pointerY += (pointerTargetY - pointerY) * pointerFollow;
      pointerVelocityX += (pointerVelocityTargetX - pointerVelocityX) * velocityFollow;
      pointerVelocityY += (pointerVelocityTargetY - pointerVelocityY) * velocityFollow;
      pointerVelocityTargetX *= trailFade;
      pointerVelocityTargetY *= trailFade;
      pointerStrength += (pointerStrengthTarget - pointerStrength) * strengthFollow;

      const pointerSpeed = Math.min(
        1.5,
        Math.hypot(pointerVelocityX, pointerVelocityY) * 15,
      );
      pointerEnergy +=
        (pointerSpeed - pointerEnergy) * expSmoothing(3.6 * motion.drag, delta);

      const driftFollow = expSmoothing(0.85 * motion.flow, delta);
      const driftTargetX =
        Math.sin(t * 0.19 * motion.flow + Math.sin(t * 0.07 + 0.8)) * 0.8 +
        Math.cos(t * 0.11 * motion.flow + 1.5) * 0.34;
      const driftTargetY =
        Math.cos(t * 0.17 * motion.flow + Math.sin(t * 0.05 + 0.3)) * 0.72 +
        Math.sin(t * 0.13 * motion.flow + 2.1) * 0.3;
      ambientDriftX += (driftTargetX - ambientDriftX) * driftFollow;
      ambientDriftY += (driftTargetY - ambientDriftY) * driftFollow;

      const pointerMix =
        pointerStrength *
        (0.2 + 0.5 * floatingMix) *
        (0.82 + 0.2 * pointerEnergy) *
        (0.86 + 0.14 * motion.drag);

      const pointerOffsetX = pointerX * viewportWidth * 0.028 * pointerMix;
      const pointerOffsetY = -pointerY * viewportHeight * 0.028 * pointerMix;
      const pointerWorldX = pointerX * viewportWidth * 0.5;
      const pointerWorldY = -pointerY * viewportHeight * 0.5;
      const pointerWorldVelX = pointerVelocityX * viewportWidth * 0.52;
      const pointerWorldVelY = -pointerVelocityY * viewportHeight * 0.52;

      const modeIndex = interactionModeRef.current;
      const modeId = INTERACTION_MODES[modeIndex]?.id ?? "fluid";
      const modeStrength = modeStrengthsRef.current[modeId] ?? 1;
      const modeConfig =
        modeIndex === 1
          ? {
              pointerWarpRadiusFactor: 0.46,
              pointerWarpBase: 0.58,
              pointerWarpFloat: 0.3,
              pointerFlowBase: 0.74,
              pointerFlowFloat: 0.32,
              backgroundPointerRadiusFactor: 0.56,
              backgroundPointerWarpFactor: 0.34,
              backgroundPointerStrengthBase: 0.23,
              backgroundPointerStrengthFloat: 0.26,
              backgroundSpeedBoost: 0.4,
            }
          : modeIndex === 2
            ? {
                pointerWarpRadiusFactor: 0.4,
                pointerWarpBase: 0.92,
                pointerWarpFloat: 0.38,
                pointerFlowBase: 0.36,
                pointerFlowFloat: 0.2,
                backgroundPointerRadiusFactor: 0.5,
                backgroundPointerWarpFactor: 0.39,
                backgroundPointerStrengthBase: 0.24,
                backgroundPointerStrengthFloat: 0.24,
                backgroundSpeedBoost: 0.3,
              }
            : modeIndex === 3
              ? {
                  pointerWarpRadiusFactor: 0.54,
                  pointerWarpBase: 1.06,
                  pointerWarpFloat: 0.42,
                  pointerFlowBase: 0.84,
                  pointerFlowFloat: 0.34,
                  backgroundPointerRadiusFactor: 0.62,
                  backgroundPointerWarpFactor: 0.44,
                  backgroundPointerStrengthBase: 0.25,
                  backgroundPointerStrengthFloat: 0.3,
                  backgroundSpeedBoost: 0.44,
                }
              : modeIndex === 4
                ? {
                    pointerWarpRadiusFactor: 0.6,
                    pointerWarpBase: 0.7,
                    pointerWarpFloat: 0.26,
                    pointerFlowBase: 0.78,
                    pointerFlowFloat: 0.28,
                    backgroundPointerRadiusFactor: 0.66,
                    backgroundPointerWarpFactor: 0.31,
                    backgroundPointerStrengthBase: 0.21,
                    backgroundPointerStrengthFloat: 0.22,
                    backgroundSpeedBoost: 0.36,
                  }
                : modeIndex === 5
                  ? {
                      pointerWarpRadiusFactor: 0.38,
                      pointerWarpBase: 1.08,
                      pointerWarpFloat: 0.36,
                      pointerFlowBase: 0.26,
                      pointerFlowFloat: 0.16,
                      backgroundPointerRadiusFactor: 0.43,
                      backgroundPointerWarpFactor: 0.46,
                      backgroundPointerStrengthBase: 0.24,
                      backgroundPointerStrengthFloat: 0.26,
                      backgroundSpeedBoost: 0.35,
                    }
                  : {
                      pointerWarpRadiusFactor: 0.34,
                      pointerWarpBase: 0.66,
                      pointerWarpFloat: 0.32,
                      pointerFlowBase: 0.6,
                      pointerFlowFloat: 0.26,
                      backgroundPointerRadiusFactor: 0.42,
                      backgroundPointerWarpFactor: 0.36,
                      backgroundPointerStrengthBase: 0.18,
                      backgroundPointerStrengthFloat: 0.22,
                      backgroundSpeedBoost: 0.28,
                    };

      const pointerWarpRadius =
        Math.min(viewportWidth, viewportHeight) * modeConfig.pointerWarpRadiusFactor;
      const pointerWarpStrength =
        foregroundStep *
        (modeConfig.pointerWarpBase + modeConfig.pointerWarpFloat * floatingMix) *
        motion.flow *
        modeStrength;
      const pointerFlowStrength =
        foregroundStep *
        (modeConfig.pointerFlowBase + modeConfig.pointerFlowFloat * floatingMix) *
        motion.flow *
        (0.84 + 0.24 * motion.drag) *
        modeStrength;
      const backgroundMeshFx = backgroundMeshFxRef.current;
      const backgroundMeshStyle =
        backgroundMeshFx.style === "dotgrid"
          ? 1
          : backgroundMeshFx.style === "grain"
            ? 2
            : 0;
      const backgroundDotShape = getPaperDotShapeIndex(backgroundMeshFx.dotShape);
      const backgroundGrainShape = getPaperGrainShapeIndex(backgroundMeshFx.grainShape);

      for (const layer of backgroundLayers) {
        layer.material.uniforms.uTime.value = t;
        layer.material.uniforms.uAlpha.value = backgroundAlpha * layer.alphaMul;
        layer.material.uniforms.uSettle.value = settleBack;
        layer.material.uniforms.uChaos.value =
          0.16 + flow * (0.42 + layer.chaosBias * 0.5) + layer.chaosBias;
        layer.material.uniforms.uPointer.value.set(pointerWorldX, pointerWorldY);
        layer.material.uniforms.uPointerVelocity.value.set(
          pointerWorldVelX * layer.driftScale,
          pointerWorldVelY * layer.driftScale,
        );
        layer.material.uniforms.uPointerStrength.value =
          pointerStrength *
          (modeConfig.backgroundPointerStrengthBase +
            modeConfig.backgroundPointerStrengthFloat * floatingMix) *
          layer.alphaMul *
          (0.82 + modeConfig.backgroundSpeedBoost * pointerSpeed) *
          modeStrength;
        layer.material.uniforms.uPointerRadius.value =
          Math.min(viewportWidth, viewportHeight) *
          modeConfig.backgroundPointerRadiusFactor;
        layer.material.uniforms.uPointerWarp.value =
          foregroundStep *
          modeConfig.backgroundPointerWarpFactor *
          motion.flow *
          modeStrength;
        layer.material.uniforms.uDrift.value.set(
          ambientDriftX * floatingMix * layer.driftScale,
          ambientDriftY * floatingMix * layer.driftScale,
        );
        layer.material.uniforms.uMode.value = modeIndex;
        layer.material.uniforms.uViewport.value.set(viewportWidth, viewportHeight);
        layer.material.uniforms.uStyle.value = backgroundMeshStyle;
        layer.material.uniforms.uFxAmount.value = backgroundMeshFx.amount;
        layer.material.uniforms.uDotShape.value = backgroundDotShape;
        layer.material.uniforms.uDotDensity.value = backgroundMeshFx.dotDensity;
        layer.material.uniforms.uGrainShape.value = backgroundGrainShape;

        layer.mesh.position.x = -pointerOffsetX * layer.parallax;
        layer.mesh.position.y = -pointerOffsetY * layer.parallax;
        layer.mesh.rotation.x =
          -Math.sin(t * (0.14 + layer.parallax)) *
          0.018 *
          (0.3 + 0.55 * (1 - lockPhase)) *
          floatingMix *
          layer.rotScale *
          motion.camera;
        layer.mesh.rotation.y =
          -Math.cos(t * (0.12 + layer.parallax)) *
          0.022 *
          (0.3 + 0.55 * (1 - lockPhase)) *
          floatingMix *
          layer.rotScale *
          motion.camera;
      }

      if (foregroundMaterial) {
        foregroundMaterial.uniforms.uAlpha.value = foregroundAlpha;
        foregroundMaterial.uniforms.uSettle.value = settleBack;
        foregroundMaterial.uniforms.uTime.value = t;
        foregroundMaterial.uniforms.uDepthAmp.value =
          ((1 - settleBack) * 18 + 8 + breath * 6) * floatingMix * motion.camera;
        foregroundMaterial.uniforms.uSolidify.value = solidifyMix;
        foregroundMaterial.uniforms.uColorMode.value = colorModeRef.current;
      }

      if (foregroundMesh && foregroundAlpha > 0.001) {
        const offsets = foregroundOffsetAttribute.array;
        const glyphs = foregroundGlyphAttribute.array;

        for (let i = 0; i < foregroundData.count; i += 1) {
          const seed = foregroundData.seed[i];
          const delay = (Math.sin(seed * 4.13) * 0.5 + 0.5) * 0.34;
          const delayedConverge = smoothstep(
            delay,
            1,
            converge + lockPhase * 0.08,
          );
          const combinedConverge = clamp01(
            delayedConverge * (0.58 + 0.42 * retargetBlend),
          );

          const preJitter =
            (1 - combinedConverge) *
            (0.24 + 0.16 * flow + retargetExcite * 0.34);
          const nx =
            Math.sin(t * 0.92 + seed) * foregroundStep * 0.14 * preJitter;
          const ny =
            Math.cos(t * 0.86 + seed * 1.11) *
            foregroundStep *
            0.14 *
            preJitter;

          const baseX = foregroundData.homeX[i] + nx;
          const baseY = foregroundData.homeY[i] + ny;
          let targetX =
            baseX + (foregroundData.targetX[i] - baseX) * combinedConverge;
          let targetY =
            baseY + (foregroundData.targetY[i] - baseY) * combinedConverge;

          const lockFloat =
            (0.32 + 0.68 * lockPhase) *
            floatingMix *
            (0.84 + retargetExcite * 0.45);
          const floatAmp =
            foregroundStep *
            (0.03 + 0.045 * (Math.sin(seed * 2.1) * 0.5 + 0.5)) *
            motion.flow;

          const ambientA =
            Math.sin((baseY + seed * 120) * 0.012 + t * 0.52) +
            Math.cos((baseX - baseY) * 0.007 - t * 0.44);
          const ambientB =
            Math.cos((baseX - seed * 105) * 0.011 - t * 0.49) +
            Math.sin((baseX + baseY) * 0.006 + t * 0.39);
          const ambientLen = Math.hypot(ambientA, ambientB) + 0.0001;
          targetX += (ambientA / ambientLen) * floatAmp * lockFloat;
          targetY += (ambientB / ambientLen) * floatAmp * lockFloat;
          targetX += ambientDriftX * foregroundStep * 0.24 * lockFloat;
          targetY += ambientDriftY * foregroundStep * 0.24 * lockFloat;

          if (pointerStrength > 0.001) {
            const dx = targetX - pointerWorldX;
            const dy = targetY - pointerWorldY;
            const dist = Math.hypot(dx, dy) + 0.0001;
            const radial = clamp01(1 - dist / pointerWarpRadius);
            const falloff = radial * radial * (3 - 2 * radial);
            const influence = falloff * pointerStrength;
            const nxDir = dx / dist;
            const nyDir = dy / dist;
            const organicPulse = Math.sin(t * 0.6 + seed * 8.7) * 0.5 + 0.5;

            let flowA = 0;
            let flowB = 0;
            let pressureScale = 0.16;
            let dragScale = (0.1 + 0.08 * organicPulse) * motion.drag;
            let flowScale = (0.44 + 0.28 * organicPulse) * motion.flow;

            if (modeIndex === 1) {
              const orbitA = -dy / dist;
              const orbitB = dx / dist;
              const cloudA =
                Math.sin((targetY - targetX) * 0.012 + t * 0.61 + seed * 7.1) +
                Math.cos((targetX + targetY) * 0.008 - t * 0.52 + seed * 4.9) *
                  0.65;
              const cloudB =
                Math.cos((targetY + targetX) * 0.011 - t * 0.57 + seed * 6.2) +
                Math.sin((targetX - targetY) * 0.009 + t * 0.49 + seed * 5.3) *
                  0.65;
              flowA = orbitA * (0.6 + 0.35 * organicPulse) + cloudA * 0.7;
              flowB = orbitB * (0.6 + 0.35 * organicPulse) + cloudB * 0.7;
              pressureScale = 0.1;
              dragScale = (0.14 + 0.09 * organicPulse) * motion.drag;
              flowScale = (0.58 + 0.34 * organicPulse) * motion.flow;
            } else if (modeIndex === 2) {
              const tideA =
                Math.sin(targetY * 0.011 + t * 0.92 + seed * 3.8) +
                Math.cos((targetX + targetY) * 0.006 + t * 0.34);
              const tideB =
                Math.sin(targetX * 0.01 - t * 0.77 + seed * 3.1) +
                Math.cos((targetX - targetY) * 0.005 - t * 0.28);
              flowA = tideA;
              flowB = tideB;
              pressureScale = 0.2;
              dragScale = (0.08 + 0.05 * organicPulse) * motion.drag;
              flowScale = (0.32 + 0.2 * organicPulse) * motion.flow;
            } else if (modeIndex === 3) {
              const orbitA = -dy / dist;
              const orbitB = dx / dist;
              const spiral = Math.sin(dist * 0.03 - t * 1.2 + seed * 7.4);
              const curlA =
                Math.cos((targetX + targetY) * 0.012 + t * 0.72 + seed * 4.1) * 0.62;
              const curlB =
                Math.sin((targetY - targetX) * 0.013 - t * 0.67 + seed * 3.6) * 0.62;
              flowA =
                orbitA * (0.9 + 0.3 * organicPulse) +
                (dx / dist) * spiral * 0.35 +
                curlA;
              flowB =
                orbitB * (0.9 + 0.3 * organicPulse) +
                (dy / dist) * spiral * 0.35 +
                curlB;
              pressureScale = 0.26;
              dragScale = (0.09 + 0.05 * organicPulse) * motion.drag;
              flowScale = (0.74 + 0.34 * organicPulse) * motion.flow;
            } else if (modeIndex === 4) {
              const wave = Math.sin(dist * 0.044 - t * 1.52 + seed * 5.2);
              const radialA = (dx / dist) * wave;
              const radialB = (dy / dist) * wave;
              const crossA = (-dy / dist) * (0.34 + 0.2 * organicPulse);
              const crossB = (dx / dist) * (0.34 + 0.2 * organicPulse);
              flowA = radialA + crossA;
              flowB = radialB + crossB;
              pressureScale = 0.12;
              dragScale = (0.11 + 0.05 * organicPulse) * motion.drag;
              flowScale = (0.62 + 0.24 * organicPulse) * motion.flow;
            } else if (modeIndex === 5) {
              const pullA = -dx / dist;
              const pullB = -dy / dist;
              const latticeA =
                Math.sin(targetY * 0.021 + t * 0.86 + seed * 6.6) * 0.52;
              const latticeB =
                Math.cos(targetX * 0.022 - t * 0.82 + seed * 5.7) * 0.52;
              flowA = pullA * (0.92 + 0.26 * organicPulse) + latticeA;
              flowB = pullB * (0.92 + 0.26 * organicPulse) + latticeB;
              pressureScale = -0.16;
              dragScale = (0.14 + 0.05 * organicPulse) * motion.drag;
              flowScale = (0.28 + 0.14 * organicPulse) * motion.flow;
            } else {
              flowA =
                Math.sin(targetY * 0.016 + t * 0.58 + seed * 6.7) +
                Math.cos((targetX + targetY) * 0.01 - t * 0.43 + seed * 2.9) *
                  0.5;
              flowB =
                Math.cos(targetX * 0.015 - t * 0.52 + seed * 5.3) +
                Math.sin((targetX - targetY) * 0.009 + t * 0.39 + seed * 3.7) *
                  0.5;
            }

            const flowLen = Math.hypot(flowA, flowB) + 0.0001;
            const flowX = flowA / flowLen;
            const flowY = flowB / flowLen;
            const pressure =
              (0.52 - radial) * pointerWarpStrength * influence * pressureScale;
            const drag = dragScale * influence;

            targetX += flowX * pointerFlowStrength * influence * flowScale;
            targetY += flowY * pointerFlowStrength * influence * flowScale;
            targetX += pointerWorldVelX * drag + nxDir * pressure;
            targetY += pointerWorldVelY * drag + nyDir * pressure;
          }

          const physicsStep = Math.min(1.8, delta * 60);
          const stiffness =
            (0.048 + 0.018 * combinedConverge) * physicsStep * motion.settle;
          const damping = Math.pow(
            Math.max(0.78, Math.min(0.9, 0.845 - (motion.drag - 1) * 0.04)),
            physicsStep,
          );

          foregroundData.velX[i] += (targetX - foregroundData.posX[i]) * stiffness;
          foregroundData.velY[i] += (targetY - foregroundData.posY[i]) * stiffness;
          foregroundData.velX[i] *= damping;
          foregroundData.velY[i] *= damping;
          foregroundData.posX[i] += foregroundData.velX[i] * physicsStep;
          foregroundData.posY[i] += foregroundData.velY[i] * physicsStep;

          const glyphProgress = smoothstep(
            0.18,
            0.92,
            Math.min(combinedConverge, retargetBlend),
          );
          const switchGate = 0.5 + (Math.sin(seed * 23.1) * 0.5 + 0.5) * 0.2;
          glyphs[i] =
            glyphProgress > switchGate
              ? foregroundData.targetGlyph[i]
              : foregroundData.baseGlyph[i];

          offsets[i * 2] = foregroundData.posX[i];
          offsets[i * 2 + 1] = foregroundData.posY[i];
        }

        foregroundOffsetAttribute.needsUpdate = true;
        foregroundGlyphAttribute.needsUpdate = true;
      }

      const drift = (0.3 + 0.55 * (1 - lockPhase)) * floatingMix * motion.camera;
      camera.position.x = Math.sin(t * 0.24) * 10 * drift + pointerX * 2 * pointerMix;
      camera.position.y = Math.cos(t * 0.21 + 1.2) * 7 * drift - pointerY * 1.8 * pointerMix;
      camera.position.z = cameraBaseZ + Math.sin(t * 0.18) * 18 * drift;

      if (foregroundMesh) {
        foregroundMesh.position.x = pointerOffsetX * 0.08;
        foregroundMesh.position.y = pointerOffsetY * 0.08;
        foregroundMesh.rotation.x = Math.sin(t * 0.18) * 0.03 * drift;
        foregroundMesh.rotation.y = Math.cos(t * 0.15) * 0.05 * drift;
      }

      camera.lookAt(0, 0, 0);

      if (bloomPass && filmPass) {
        bloomPass.strength = 0.14 + 0.16 * motion.camera + 0.06 * floatingMix;
        bloomPass.radius = 0.34 + 0.12 * (1 - floatingMix);
        bloomPass.threshold = 0.92;

        filmPass.material.uniforms.uTime.value = t;
        filmPass.material.uniforms.uNoise.value = 0.012 + 0.012 * (1 - solidifyMix);
        filmPass.material.uniforms.uVignette.value = 0.22 + 0.16 * motion.camera;
      }

      if (paperPass) {
        const paper = paperFxRef.current;
        paperPass.material.uniforms.uTime.value = t;
        paperPass.material.uniforms.uIntensity.value = paper.enabled
          ? paper.intensity
          : 0;
        paperPass.material.uniforms.uPalette.value = getPaperPaletteIndex(paper.palette);
        paperPass.material.uniforms.uEffect.value = getPaperEffectIndex(paper.effect);
        paperPass.material.uniforms.uEffectAmount.value = paper.amount;
        paperPass.material.uniforms.uSpeed.value = paper.speed;
        paperPass.material.uniforms.uPointer.value.set(
          (pointerX + 1) * 0.5,
          (1 - pointerY) * 0.5,
        );
        paperPass.material.uniforms.uEnergy.value = Math.min(1, pointerEnergy);
      }

      if (perfRef.current && t > hudUpdateAt) {
        perfRef.current.textContent = `${Math.round(fpsEma)} FPS · Q${qualityScale.toFixed(2)} · ${currentWord}`;
        hudUpdateAt = t + 0.35;
      }

      if (composer) {
        composer.render();
      } else {
        renderer.render(scene, camera);
      }
      animationFrame = window.requestAnimationFrame(animate);
    }

    async function boot() {
      try {
        await Promise.all([
          loadCanvasFont("Geist Pixel Line", pixelLineFontUrl),
          loadCanvasFont("Geist Pixel Square", pixelSquareFontUrl),
        ]);
      } catch {
        // Ignore font load failures; fallback fonts still allow rendering.
      }
      if (disposed) return;

      try {
        const {
          EffectComposer,
          RenderPass,
          UnrealBloomPass,
          ShaderPass,
        } = await loadPostprocessingModules();
        if (disposed) return;

        const nextComposer = new EffectComposer(renderer);
        const renderPass = new RenderPass(scene, camera);
        const nextBloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.24, 0.45, 0.92);
        const nextPaperPass = new ShaderPass(PAPER_MESH_SHADER);
        const nextFilmPass = new ShaderPass(FILM_GRAIN_SHADER);
        nextComposer.addPass(renderPass);
        nextComposer.addPass(nextBloomPass);
        nextComposer.addPass(nextPaperPass);
        nextComposer.addPass(nextFilmPass);

        if (disposed) {
          nextComposer.dispose();
          return;
        }

        composer = nextComposer;
        bloomPass = nextBloomPass;
        paperPass = nextPaperPass;
        filmPass = nextFilmPass;
      } catch {
        // Fallback to direct renderer if postprocessing chunk fails.
      }
      if (disposed) return;

      onResize();
      applyFontSetRef.current = applyFontSet;
      applyBackgroundMeshFxRef.current = applyBackgroundMeshFx;
      retargetWordRef.current = retargetWord;
      clock.start();
      animate();
    }

    function onResizeEvent() {
      if (resizeFrame !== 0) return;
      resizeFrame = window.requestAnimationFrame(() => {
        resizeFrame = 0;
        onResize();
      });
    }

    window.addEventListener("resize", onResizeEvent);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("pointercancel", onPointerCancel, { passive: true });
    window.addEventListener("blur", onWindowBlur);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("keydown", onKeyDown);
    boot();

    return () => {
      disposed = true;
      applyFontSetRef.current = null;
      applyBackgroundMeshFxRef.current = null;
      retargetWordRef.current = null;

      window.cancelAnimationFrame(animationFrame);
      if (resizeFrame !== 0) {
        window.cancelAnimationFrame(resizeFrame);
      }
      window.removeEventListener("resize", onResizeEvent);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("pointercancel", onPointerCancel);
      window.removeEventListener("blur", onWindowBlur);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("keydown", onKeyDown);

      disposeForeground(true);
      disposeBackgroundLayers(true);

      if (composer) {
        composer.dispose();
      }
      clock.stop();
      renderer.dispose();
    };
  }, []);

  return (
    <section className="mesh-hero">
      <canvas ref={canvasRef} aria-label="Animated typography mesh" />
      <div className="atmosphere" />
      <div className="scanlines" />
      <div className="vignette" />
      <div className="mode-switch" role="group" aria-label="Interaction mode">
        {INTERACTION_MODES.map((mode, index) => (
          <button
            key={mode.id}
            type="button"
            className={interactionMode === mode.id ? "active" : ""}
            onClick={() => onInteractionModeChange?.(mode.id)}
          >
            <span>{index + 1}</span> {mode.label}
          </button>
        ))}
      </div>
      <div className="hud">
        <p>Letter Mesh Background + Typographic Foreground</p>
        <p className="meta">
          {interactionMode.toUpperCase()} MODE · {colorMode.toUpperCase()} COLOR · {motionPreset.toUpperCase()} PRESET · {fontLabel.toUpperCase()} · React / Three.js · Press 1-6/M/C · <span className="perf" ref={perfRef}>60 FPS</span>
        </p>
      </div>
    </section>
  );
}

TypographyMeshHero.displayName = "TypographyMeshHero";

export default memo(TypographyMeshHero, areHeroPropsEqual);
