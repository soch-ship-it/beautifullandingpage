/**
 * FaultyTerminal — vanilla JS port of the React/ogl component.
 * Renders a full-viewport glitchy CRT terminal as a fixed page backdrop.
 */
import { Renderer, Program, Mesh, Color, Triangle } from 'https://cdn.jsdelivr.net/npm/ogl@1.0.11/+esm';

const vertexShader = `
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragmentShader = `
precision mediump float;

varying vec2 vUv;

uniform float iTime;
uniform vec3  iResolution;
uniform float uScale;

uniform vec2  uGridMul;
uniform float uDigitSize;
uniform float uScanlineIntensity;
uniform float uGlitchAmount;
uniform float uFlickerAmount;
uniform float uNoiseAmp;
uniform float uChromaticAberration;
uniform float uDither;
uniform float uCurvature;
uniform vec3  uTint;
uniform vec2  uMouse;
uniform float uMouseStrength;
uniform float uUseMouse;
uniform float uPageLoadProgress;
uniform float uUsePageLoadAnimation;
uniform float uBrightness;
uniform float uLightMode;

float time;

float hash21(vec2 p){
  p = fract(p * 234.56);
  p += dot(p, p + 34.56);
  return fract(p.x * p.y);
}

float noise(vec2 p)
{
  return sin(p.x * 10.0) * sin(p.y * (3.0 + sin(time * 0.090909))) + 0.2;
}

mat2 rotate(float angle)
{
  float c = cos(angle);
  float s = sin(angle);
  return mat2(c, -s, s, c);
}

float fbm(vec2 p)
{
  p *= 1.1;
  float f = 0.0;
  float amp = 0.5 * uNoiseAmp;

  mat2 modify0 = rotate(time * 0.02);
  f += amp * noise(p);
  p = modify0 * p * 2.0;
  amp *= 0.454545;

  mat2 modify1 = rotate(time * 0.02);
  f += amp * noise(p);
  p = modify1 * p * 2.0;
  amp *= 0.454545;

  mat2 modify2 = rotate(time * 0.08);
  f += amp * noise(p);

  return f;
}

float pattern(vec2 p, out vec2 q, out vec2 r) {
  vec2 offset1 = vec2(1.0);
  vec2 offset0 = vec2(0.0);
  mat2 rot01 = rotate(0.1 * time);
  mat2 rot1 = rotate(0.1);

  q = vec2(fbm(p + offset1), fbm(rot01 * p + offset1));
  r = vec2(fbm(rot1 * q + offset0), fbm(q + offset0));
  return fbm(p + r);
}

float digit(vec2 p){
    vec2 grid = uGridMul * 15.0;
    vec2 s = floor(p * grid) / grid;
    p = p * grid;
    vec2 q, r;
    float intensity = pattern(s * 0.1, q, r) * 1.3 - 0.03;

    if(uUseMouse > 0.5){
        vec2 mouseWorld = uMouse * uScale;
        float distToMouse = distance(s, mouseWorld);
        float mouseInfluence = exp(-distToMouse * 8.0) * uMouseStrength * 10.0;
        intensity += mouseInfluence;

        float ripple = sin(distToMouse * 20.0 - iTime * 5.0) * 0.1 * mouseInfluence;
        intensity += ripple;
    }

    if(uUsePageLoadAnimation > 0.5){
        float cellRandom = fract(sin(dot(s, vec2(12.9898, 78.233))) * 43758.5453);
        float cellDelay = cellRandom * 0.8;
        float cellProgress = clamp((uPageLoadProgress - cellDelay) / 0.2, 0.0, 1.0);

        float fadeAlpha = smoothstep(0.0, 1.0, cellProgress);
        intensity *= fadeAlpha;
    }

    p = fract(p);
    p *= uDigitSize;

    float px5 = p.x * 5.0;
    float py5 = (1.0 - p.y) * 5.0;
    float x = fract(px5);
    float y = fract(py5);

    float i = floor(py5) - 2.0;
    float j = floor(px5) - 2.0;
    float n = i * i + j * j;
    float f = n * 0.0625;

    float isOn = step(0.1, intensity - f);
    float brightness = isOn * (0.2 + y * 0.8) * (0.75 + x * 0.25);

    return step(0.0, p.x) * step(p.x, 1.0) * step(0.0, p.y) * step(p.y, 1.0) * brightness;
}

float onOff(float a, float b, float c)
{
  return step(c, sin(iTime + a * cos(iTime * b))) * uFlickerAmount;
}

float displace(vec2 look)
{
    float y = look.y - mod(iTime * 0.25, 1.0);
    float window = 1.0 / (1.0 + 50.0 * y * y);
    return sin(look.y * 20.0 + iTime) * 0.0125 * onOff(4.0, 2.0, 0.8) * (1.0 + cos(iTime * 60.0)) * window;
}

vec3 getColor(vec2 p){

    float bar = step(mod(p.y + time * 20.0, 1.0), 0.2) * 0.4 + 1.0;
    bar *= uScanlineIntensity;

    float displacement = displace(p);
    p.x += displacement;

    if (uGlitchAmount != 1.0) {
      float extra = displacement * (uGlitchAmount - 1.0);
      p.x += extra;
    }

    float middle = digit(p);

    const float off = 0.002;
    float sum = digit(p + vec2(-off, -off)) + digit(p + vec2(0.0, -off)) + digit(p + vec2(off, -off)) +
                digit(p + vec2(-off, 0.0)) + digit(p + vec2(0.0, 0.0)) + digit(p + vec2(off, 0.0)) +
                digit(p + vec2(-off, off)) + digit(p + vec2(0.0, off)) + digit(p + vec2(off, off));

    vec3 baseColor = vec3(0.9) * middle + sum * 0.1 * vec3(1.0) * bar;
    return baseColor;
}

vec2 barrel(vec2 uv){
  vec2 c = uv * 2.0 - 1.0;
  float r2 = dot(c, c);
  c *= 1.0 + uCurvature * r2;
  return c * 0.5 + 0.5;
}

void main() {
    time = iTime * 0.333333;
    vec2 uv = vUv;

    if(uCurvature != 0.0){
      uv = barrel(uv);
    }

    vec2 p = uv * uScale;
    vec3 col = getColor(p);

    if(uChromaticAberration != 0.0){
      vec2 ca = vec2(uChromaticAberration) / iResolution.xy;
      col.r = getColor(p + ca).r;
      col.b = getColor(p - ca).b;
    }

    col *= uTint;
    col *= uBrightness;

    if(uDither > 0.0){
      float rnd = hash21(gl_FragCoord.xy);
      col += (rnd - 0.5) * (uDither * 0.003922);
    }

    if (uLightMode > 0.5) {
      float energy = max(max(col.r, col.g), col.b);
      float coverage = clamp(smoothstep(0.0, 0.72, energy) * 0.9, 0.0, 0.9);
      vec3 ink = clamp(col * 0.42, 0.0, 0.76);
      col = mix(vec3(1.0), ink, coverage);
    }

    gl_FragColor = vec4(col, 1.0);
}
`;

function hexToRgb(hex) {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const num = parseInt(h.slice(0, 6), 16);
  return [((num >> 16) & 255) / 255, ((num >> 8) & 255) / 255, (num & 255) / 255];
}

/* ---- config (was React props) ---- */
const CFG = {
  scale: 1.6,
  gridMul: [2, 1],
  digitSize: 3,
  timeScale: 2.5,
  scanlineIntensity: 0.2,
  glitchAmount: 1,
  flickerAmount: 1,
  noiseAmp: 0.9,
  chromaticAberration: 0,
  dither: 0,
  curvature: 0.07,
  tint: '#F97316',
  mouseStrength: 0.5,
  brightness: 1,
};

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isSmallScreen = Math.min(window.innerWidth, window.innerHeight) < 640;
const dpr = Math.min(window.devicePixelRatio || 1, isSmallScreen ? 1.25 : 2);

const canvas = document.getElementById('crt-bg');
if (canvas) {
  const renderer = new Renderer({ dpr, canvas, alpha: false, antialias: false });
  const gl = renderer.gl;
  gl.clearColor(0, 0, 0, 1);

  const geometry = new Triangle(gl);
  const tintVec = hexToRgb(CFG.tint);
  const mouse = { x: 0.5, y: 0.5 };
  const smooth = { x: 0.5, y: 0.5 };

  const program = new Program(gl, {
    vertex: vertexShader,
    fragment: fragmentShader,
    uniforms: {
      iTime: { value: 0 },
      iResolution: { value: new Color(1, 1, 1) },
      uScale: { value: CFG.scale },
      uGridMul: { value: new Float32Array(CFG.gridMul) },
      uDigitSize: { value: CFG.digitSize },
      uScanlineIntensity: { value: CFG.scanlineIntensity },
      uGlitchAmount: { value: CFG.glitchAmount },
      uFlickerAmount: { value: reducedMotion ? 0 : CFG.flickerAmount },
      uNoiseAmp: { value: CFG.noiseAmp },
      uChromaticAberration: { value: CFG.chromaticAberration },
      uDither: { value: CFG.dither },
      uCurvature: { value: CFG.curvature },
      uTint: { value: new Color(tintVec[0], tintVec[1], tintVec[2]) },
      uMouse: { value: new Float32Array([smooth.x, smooth.y]) },
      uMouseStrength: { value: CFG.mouseStrength },
      uUseMouse: { value: 1 },
      uPageLoadProgress: { value: reducedMotion ? 1 : 0 },
      uUsePageLoadAnimation: { value: reducedMotion ? 0 : 1 },
      uBrightness: { value: CFG.brightness },
      uLightMode: { value: 0 },
    },
  });

  const mesh = new Mesh(gl, { geometry, program });

  function resize() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    program.uniforms.iResolution.value = new Color(gl.canvas.width, gl.canvas.height, gl.canvas.width / gl.canvas.height);
  }
  window.addEventListener('resize', resize);
  resize();

  window.addEventListener('mousemove', e => {
    mouse.x = e.clientX / window.innerWidth;
    mouse.y = 1 - e.clientY / window.innerHeight;
  });

  let paused = false;
  document.addEventListener('visibilitychange', () => { paused = document.hidden; });

  const timeOffset = Math.random() * 100;
  let loadStart = 0;

  function update(t) {
    requestAnimationFrame(update);
    if (paused) return;

    if (!reducedMotion) {
      if (loadStart === 0) loadStart = t;
      const elapsed = (t * 0.001 + timeOffset) * CFG.timeScale;
      program.uniforms.iTime.value = elapsed;

      const progress = Math.min((t - loadStart) / 2000, 1);
      program.uniforms.uPageLoadProgress.value = progress;

      const damping = 0.08;
      smooth.x += (mouse.x - smooth.x) * damping;
      smooth.y += (mouse.y - smooth.y) * damping;
      const u = program.uniforms.uMouse.value;
      u[0] = smooth.x;
      u[1] = smooth.y;
    }

    renderer.render({ scene: mesh });
  }
  requestAnimationFrame(update);
}
