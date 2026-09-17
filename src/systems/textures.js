import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Texturas procedurais (canvas). Nada de assets externos: tudo gerado em runtime,
// com ruído de valor + fBm, para dar variação orgânica a terreno, rocha, madeira,
// tecido, metal e cristal.
// ---------------------------------------------------------------------------

function hash(x, y, seed = 0) {
  let h = x * 374761393 + y * 668265263 + seed * 2246822519;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

function smooth(t) { return t * t * (3 - 2 * t); }

export function valueNoise(x, y, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const a = hash(xi, yi, seed), b = hash(xi + 1, yi, seed);
  const c = hash(xi, yi + 1, seed), d = hash(xi + 1, yi + 1, seed);
  const u = smooth(xf), v = smooth(yf);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}

export function fbm(x, y, octaves = 5, seed = 0, lac = 2.0, gain = 0.5) {
  let amp = 1, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise(x * freq, y * freq, seed + i * 17);
    norm += amp;
    amp *= gain; freq *= lac;
  }
  return sum / norm;
}

function makeCanvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

function toTexture(canvas, repeat = 1) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function pixelPaint(size, fn) {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, b] = fn(x, y, size);
      const i = (y * size + x) * 4;
      img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

const mix = (a, b, t) => a + (b - a) * t;

export const Textures = {
  cache: {},
  get(name, repeat = 1) {
    const key = name + '@' + repeat;
    if (this.cache[key]) return this.cache[key];
    const tex = toTexture(this.build(name), repeat);
    this.cache[key] = tex;
    return tex;
  },
  build(name) {
    switch (name) {
      case 'grass':
        return pixelPaint(256, (x, y, s) => {
          const n = fbm(x / 12, y / 12, 5, 3);
          const blade = valueNoise(x * 1.7, y * 1.7, 9);
          const g = mix(70, 150, n) + blade * 30;
          return [mix(28, 70, n) + blade * 12, g, mix(24, 52, n)];
        });
      case 'dirt':
        return pixelPaint(256, (x, y) => {
          const n = fbm(x / 9, y / 9, 5, 11);
          const grit = valueNoise(x * 2.3, y * 2.3, 21);
          return [mix(86, 138, n) + grit * 14, mix(60, 100, n) + grit * 10, mix(40, 66, n)];
        });
      case 'rock':
        return pixelPaint(256, (x, y) => {
          const n = fbm(x / 14, y / 14, 6, 31);
          const crack = Math.abs(fbm(x / 22, y / 22, 3, 57) - 0.5) < 0.03 ? -40 : 0;
          const v = mix(84, 168, n) + crack;
          return [v, v * 0.98, v * 1.02];
        });
      case 'sand':
        return pixelPaint(256, (x, y) => {
          const n = fbm(x / 7, y / 30, 4, 71);
          return [mix(198, 236, n), mix(178, 212, n), mix(126, 160, n)];
        });
      case 'snow':
        return pixelPaint(256, (x, y) => {
          const n = fbm(x / 10, y / 10, 4, 91);
          const v = mix(224, 255, n);
          return [v, v, Math.min(255, v + 6)];
        });
      case 'wood':
        return pixelPaint(256, (x, y) => {
          const rings = Math.sin((x * 0.12) + fbm(x / 30, y / 6, 3, 5) * 6) * 0.5 + 0.5;
          const grain = valueNoise(x * 0.8, y * 3.0, 13);
          return [mix(96, 158, rings) + grain * 16, mix(62, 108, rings) + grain * 10, mix(34, 62, rings)];
        });
      case 'plank':
        return pixelPaint(256, (x, y) => {
          const row = Math.floor(y / 32);
          const seam = (y % 32 < 2) ? -45 : 0;
          const rings = Math.sin(x * 0.1 + row * 2.3 + fbm(x / 25, y / 8, 3, row) * 5) * 0.5 + 0.5;
          return [mix(112, 170, rings) + seam, mix(76, 120, rings) + seam, mix(44, 74, rings) + seam];
        });
      case 'stonebrick':
        return pixelPaint(256, (x, y) => {
          const row = Math.floor(y / 32);
          const off = (row % 2) * 32;
          const bx = (x + off) % 64, by = y % 32;
          const mortar = (bx < 3 || by < 3) ? -55 : 0;
          const n = fbm(x / 10, y / 10, 5, 41);
          const v = mix(108, 170, n) + mortar;
          return [v, v * 0.97, v * 0.92];
        });
      case 'metal':
        return pixelPaint(256, (x, y) => {
          const brush = valueNoise(x * 0.5, y * 6, 3);
          const n = fbm(x / 20, y / 20, 3, 61);
          const v = mix(120, 200, n * 0.4 + brush * 0.6);
          return [v * 0.92, v * 0.95, v];
        });
      case 'cloth':
        return pixelPaint(256, (x, y) => {
          const weave = ((Math.floor(x / 3) + Math.floor(y / 3)) % 2) * 14;
          const n = fbm(x / 18, y / 18, 3, 77);
          return [mix(60, 96, n) + weave, mix(44, 72, n) + weave, mix(80, 128, n) + weave];
        });
      case 'crystal':
        return pixelPaint(256, (x, y) => {
          const f = Math.abs(fbm(x / 18, y / 18, 4, 101) - 0.5) * 2;
          return [mix(60, 150, f), mix(140, 240, f), mix(200, 255, f)];
        });
      case 'runes':
        return pixelPaint(256, (x, y) => {
          const n = fbm(x / 16, y / 16, 4, 131);
          const line = (Math.abs(Math.sin(x * 0.25) * Math.cos(y * 0.25)) > 0.93) ? 180 : 0;
          return [mix(18, 42, n) + line * 0.4, mix(22, 50, n) + line * 0.9, mix(40, 90, n) + line];
        });
      case 'bark':
        return pixelPaint(256, (x, y) => {
          const v = fbm(x / 4, y / 40, 5, 151);
          return [mix(52, 104, v), mix(38, 74, v), mix(28, 52, v)];
        });
      case 'leaf':
        return pixelPaint(128, (x, y) => {
          const v = fbm(x / 8, y / 8, 4, 171);
          return [mix(24, 70, v), mix(72, 152, v), mix(28, 60, v)];
        });
      default:
        return pixelPaint(64, () => [200, 0, 200]);
    }
  }
};

// Céu em gradiente (usado como background + fog color match)
export function skyTexture(top = '#2a4a8f', bottom = '#c8d6f0') {
  const c = makeCanvas(256);
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, top);
  g.addColorStop(0.55, '#8fa9d8');
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.mapping = THREE.EquirectangularReflectionMapping;
  return t;
}
