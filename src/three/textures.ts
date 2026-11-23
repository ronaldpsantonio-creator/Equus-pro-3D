import * as THREE from 'three';

export interface ProceduralTextureSet {
  coatColor: THREE.CanvasTexture;
  coatBump: THREE.CanvasTexture;
  coatNormal: THREE.CanvasTexture;
  muscleColor: THREE.CanvasTexture;
  muscleBump: THREE.CanvasTexture;
  muscleNormal: THREE.CanvasTexture;
  boneColor: THREE.CanvasTexture;
  boneBump: THREE.CanvasTexture;
  boneNormal: THREE.CanvasTexture;
  hoofColor: THREE.CanvasTexture;
  hoofBump: THREE.CanvasTexture;
  hoofNormal: THREE.CanvasTexture;
  lungColor: THREE.CanvasTexture;
  floorShadow: THREE.CanvasTexture;
  dispose: () => void;
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  return [c, ctx];
}

// Convert a grayscale bump canvas into a tangent-space RGB normal map (NoColorSpace)
function bumpCanvasToNormalTexture(
  bumpCanvas: HTMLCanvasElement,
  strength: number,
  repeat: [number, number],
  clampT: boolean,
  aniso: number,
): THREE.CanvasTexture {
  const w = bumpCanvas.width;
  const h = bumpCanvas.height;
  const srcCtx = bumpCanvas.getContext('2d')!;
  const src = srcCtx.getImageData(0, 0, w, h).data;

  const [normCanvas, normCtx] = makeCanvas(w, h);
  const outImg = normCtx.createImageData(w, h);
  const dst = outImg.data;

  const sample = (x: number, y: number): number => {
    const wx = ((x % w) + w) % w;
    const wy = clampT ? Math.max(0, Math.min(h - 1, y)) : ((y % h) + h) % h;
    return src[(wy * w + wx) * 4] / 255;
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // 3x3 Sobel kernel for clean gradient without aliasing
      const tl = sample(x - 1, y - 1);
      const t = sample(x, y - 1);
      const tr = sample(x + 1, y - 1);
      const l = sample(x - 1, y);
      const r = sample(x + 1, y);
      const bl = sample(x - 1, y + 1);
      const b = sample(x, y + 1);
      const br = sample(x + 1, y + 1);

      const dx = (tr + 2 * r + br - (tl + 2 * l + bl)) * strength;
      const dy = (bl + 2 * b + br - (tl + 2 * t + tr)) * strength;
      const nx = -dx;
      const ny = -dy;
      const nz = 1.0;
      const invLen = 1.0 / Math.hypot(nx, ny, nz);

      const idx = (y * w + x) * 4;
      dst[idx] = Math.round((nx * invLen * 0.5 + 0.5) * 255);
      dst[idx + 1] = Math.round((ny * invLen * 0.5 + 0.5) * 255);
      dst[idx + 2] = Math.round((nz * invLen * 0.5 + 0.5) * 255);
      dst[idx + 3] = 255;
    }
  }

  normCtx.putImageData(outImg, 0, 0);
  const tex = new THREE.CanvasTexture(normCanvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = clampT ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.anisotropy = aniso;
  return tex;
}

// Deterministic pseudo-random generator for reproducible anatomical textures
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createProceduralTextures(maxAnisotropy: number): ProceduralTextureSet {
  const aniso = Math.min(maxAnisotropy || 1, 8);
  const rand = mulberry32(14092026);

  // 1. Living equine bay/chestnut coat texture (512x512 color + micro-hair bump + normal)
  const [coatC, coatCtx] = makeCanvas(512, 512);
  const [coatBC, coatBCtx] = makeCanvas(512, 512);
  const coatGrad = coatCtx.createLinearGradient(0, 0, 0, 512);
  coatGrad.addColorStop(0, '#6e381d');
  coatGrad.addColorStop(0.35, '#8a4a2a');
  coatGrad.addColorStop(0.7, '#995532');
  coatGrad.addColorStop(1, '#5d3019');
  coatCtx.fillStyle = coatGrad;
  coatCtx.fillRect(0, 0, 512, 512);

  coatBCtx.fillStyle = '#808080';
  coatBCtx.fillRect(0, 0, 512, 512);

  // Subtle dappled muscle/vascular warmth beneath coat
  for (let i = 0; i < 65; i++) {
    const dx = rand() * 512;
    const dy = rand() * 512;
    const dr = 14 + rand() * 26;
    const g = coatCtx.createRadialGradient(dx, dy, 2, dx, dy, dr);
    g.addColorStop(0, i % 2 === 0 ? 'rgba(176, 108, 66, 0.08)' : 'rgba(62, 28, 14, 0.08)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    coatCtx.fillStyle = g;
    coatCtx.beginPath();
    coatCtx.arc(dx, dy, dr, 0, Math.PI * 2);
    coatCtx.fill();
  }

  // Fine directional equine hair coat strokes
  for (let i = 0; i < 11000; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    const len = 5 + rand() * 11;
    const dy = (rand() - 0.3) * 2.2;
    const tone = rand();
    coatCtx.strokeStyle =
      tone < 0.35
        ? 'rgba(42, 19, 9, 0.14)'
        : tone < 0.72
          ? 'rgba(196, 126, 78, 0.11)'
          : 'rgba(225, 168, 120, 0.07)';
    coatCtx.lineWidth = 0.8 + rand() * 0.6;
    coatCtx.beginPath();
    coatCtx.moveTo(x, y);
    coatCtx.lineTo(x + len, y + dy);
    coatCtx.stroke();

    const bv = tone < 0.5 ? 102 : 158;
    coatBCtx.strokeStyle = `rgba(${bv},${bv},${bv},0.42)`;
    coatBCtx.lineWidth = 0.9;
    coatBCtx.beginPath();
    coatBCtx.moveTo(x, y);
    coatBCtx.lineTo(x + len, y + dy);
    coatBCtx.stroke();
  }

  const coatColor = new THREE.CanvasTexture(coatC);
  coatColor.colorSpace = THREE.SRGBColorSpace;
  coatColor.wrapS = THREE.RepeatWrapping;
  coatColor.wrapT = THREE.RepeatWrapping;
  coatColor.repeat.set(3, 3);
  coatColor.anisotropy = aniso;

  const coatBump = new THREE.CanvasTexture(coatBC);
  coatBump.wrapS = THREE.RepeatWrapping;
  coatBump.wrapT = THREE.RepeatWrapping;
  coatBump.repeat.set(3, 3);
  coatBump.anisotropy = aniso;

  const coatNormal = bumpCanvasToNormalTexture(coatBC, 1.35, [3, 3], false, aniso);

  // 2. Longitudinal striated skeletal muscle fascicles (512x512 color + bump + crisp normal along UV.y)
  const [musC, musCtx] = makeCanvas(512, 512);
  musCtx.fillStyle = '#a83c33';
  musCtx.fillRect(0, 0, 512, 512);
  const [musBC, musBCtx] = makeCanvas(512, 512);
  musBCtx.fillStyle = '#808080';
  musBCtx.fillRect(0, 0, 512, 512);

  for (let x = 0; x < 512; x += 2) {
    const band =
      Math.sin((x / 512) * Math.PI * 58) * 0.34 +
      Math.sin((x / 512) * Math.PI * 18) * 0.25 +
      0.5;
    musCtx.fillStyle =
      band > 0.52 ? 'rgba(230, 126, 110, 0.26)' : 'rgba(84, 18, 14, 0.32)';
    musCtx.fillRect(x, 0, 2, 512);
    const v = Math.round(68 + Math.max(0, Math.min(1, band)) * 164);
    musBCtx.fillStyle = `rgb(${v},${v},${v})`;
    musBCtx.fillRect(x, 0, 2, 512);
  }
  // Subtle pearly perimysium connective septa lines
  for (let i = 0; i < 1400; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    musCtx.fillStyle = 'rgba(250, 232, 226, 0.14)';
    musCtx.fillRect(x, y, 1, 28 + rand() * 52);
    musBCtx.fillStyle = 'rgba(210, 210, 210, 0.18)';
    musBCtx.fillRect(x, y, 1, 24 + rand() * 44);
  }

  const muscleColor = new THREE.CanvasTexture(musC);
  muscleColor.colorSpace = THREE.SRGBColorSpace;
  muscleColor.wrapS = THREE.RepeatWrapping;
  muscleColor.wrapT = THREE.RepeatWrapping;
  muscleColor.repeat.set(2, 2);
  muscleColor.anisotropy = aniso;

  const muscleBump = new THREE.CanvasTexture(musBC);
  muscleBump.wrapS = THREE.RepeatWrapping;
  muscleBump.wrapT = THREE.RepeatWrapping;
  muscleBump.repeat.set(2, 2);
  muscleBump.anisotropy = aniso;

  const muscleNormal = bumpCanvasToNormalTexture(musBC, 1.85, [2, 2], false, aniso);

  // 3. Cortical periosteum bone texture (512x512 color + micro-pore bump + normal)
  const [boneC, boneCtx] = makeCanvas(512, 512);
  const [boneBC, boneBCtx] = makeCanvas(512, 512);
  boneCtx.fillStyle = '#ece3ce';
  boneCtx.fillRect(0, 0, 512, 512);
  boneBCtx.fillStyle = '#808080';
  boneBCtx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 4000; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    const w = 2 + rand() * 10;
    const h = 1 + rand() * 2;
    boneCtx.fillStyle =
      i % 3 === 0 ? 'rgba(164, 146, 114, 0.15)' : 'rgba(255, 252, 242, 0.18)';
    boneCtx.fillRect(x, y, w, h);

    const bv = i % 3 === 0 ? 104 : 148;
    boneBCtx.fillStyle = `rgb(${bv},${bv},${bv})`;
    boneBCtx.fillRect(x, y, w * 0.7, h);
  }
  const boneColor = new THREE.CanvasTexture(boneC);
  boneColor.colorSpace = THREE.SRGBColorSpace;
  boneColor.wrapS = THREE.RepeatWrapping;
  boneColor.wrapT = THREE.RepeatWrapping;
  boneColor.anisotropy = aniso;

  const boneBump = new THREE.CanvasTexture(boneBC);
  boneBump.wrapS = THREE.RepeatWrapping;
  boneBump.wrapT = THREE.RepeatWrapping;
  boneBump.anisotropy = aniso;

  const boneNormal = bumpCanvasToNormalTexture(boneBC, 1.15, [1, 1], false, aniso);

  // 4. Equine keratin hoof wall texture (vertical horn tubules + horizontal growth rings)
  const [hoofC, hoofCtx] = makeCanvas(256, 256);
  const [hoofBC, hoofBCtx] = makeCanvas(256, 256);
  const hoofGrad = hoofCtx.createLinearGradient(0, 0, 0, 256);
  hoofGrad.addColorStop(0, '#50473e');
  hoofGrad.addColorStop(0.55, '#37302b');
  hoofGrad.addColorStop(1, '#27221d');
  hoofCtx.fillStyle = hoofGrad;
  hoofCtx.fillRect(0, 0, 256, 256);
  hoofBCtx.fillStyle = '#808080';
  hoofBCtx.fillRect(0, 0, 256, 256);

  for (let x = 0; x < 256; x += 2) {
    const shade = rand();
    hoofCtx.fillStyle = shade > 0.5 ? 'rgba(85,76,68,0.18)' : 'rgba(18,15,12,0.20)';
    hoofCtx.fillRect(x, 0, 1.5, 256);
    const bv = Math.round(108 + shade * 42);
    hoofBCtx.fillStyle = `rgb(${bv},${bv},${bv})`;
    hoofBCtx.fillRect(x, 0, 1.5, 256);
  }
  for (let r = 0; r < 14; r++) {
    const y = 18 + r * 17 + (rand() - 0.5) * 4;
    hoofCtx.fillStyle = 'rgba(20, 16, 13, 0.22)';
    hoofCtx.fillRect(0, y, 256, 2);
    hoofBCtx.fillStyle = 'rgb(96,96,96)';
    hoofBCtx.fillRect(0, y, 256, 2);
  }
  const hoofColor = new THREE.CanvasTexture(hoofC);
  hoofColor.colorSpace = THREE.SRGBColorSpace;
  hoofColor.wrapS = THREE.RepeatWrapping;
  hoofColor.wrapT = THREE.ClampToEdgeWrapping;
  hoofColor.anisotropy = aniso;

  const hoofBump = new THREE.CanvasTexture(hoofBC);
  hoofBump.wrapS = THREE.RepeatWrapping;
  hoofBump.wrapT = THREE.ClampToEdgeWrapping;
  hoofBump.anisotropy = aniso;

  const hoofNormal = bumpCanvasToNormalTexture(hoofBC, 1.45, [1, 1], true, aniso);

  // 5. Spongy lobular lung parenchyma texture
  const [lungC, lungCtx] = makeCanvas(256, 256);
  lungCtx.fillStyle = '#d98a92';
  lungCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 320; i++) {
    const x = rand() * 256;
    const y = rand() * 256;
    const r = 4 + rand() * 10;
    lungCtx.strokeStyle = 'rgba(162, 85, 96, 0.24)';
    lungCtx.lineWidth = 1;
    lungCtx.beginPath();
    lungCtx.arc(x, y, r, 0, Math.PI * 2);
    lungCtx.stroke();
  }
  const lungColor = new THREE.CanvasTexture(lungC);
  lungColor.colorSpace = THREE.SRGBColorSpace;
  lungColor.wrapS = THREE.RepeatWrapping;
  lungColor.wrapT = THREE.RepeatWrapping;
  lungColor.anisotropy = aniso;

  // 6. Soft radial contact shadow beneath hooves
  const [shC, shCtx] = makeCanvas(512, 512);
  const rad = shCtx.createRadialGradient(256, 256, 28, 256, 256, 245);
  rad.addColorStop(0, 'rgba(3, 6, 12, 0.78)');
  rad.addColorStop(0.55, 'rgba(3, 6, 12, 0.36)');
  rad.addColorStop(1, 'rgba(3, 6, 12, 0.0)');
  shCtx.fillStyle = rad;
  shCtx.fillRect(0, 0, 512, 512);
  const floorShadow = new THREE.CanvasTexture(shC);
  floorShadow.colorSpace = THREE.SRGBColorSpace;

  return {
    coatColor,
    coatBump,
    coatNormal,
    muscleColor,
    muscleBump,
    muscleNormal,
    boneColor,
    boneBump,
    boneNormal,
    hoofColor,
    hoofBump,
    hoofNormal,
    lungColor,
    floorShadow,
    dispose: () => {
      coatColor.dispose();
      coatBump.dispose();
      coatNormal.dispose();
      muscleColor.dispose();
      muscleBump.dispose();
      muscleNormal.dispose();
      boneColor.dispose();
      boneBump.dispose();
      boneNormal.dispose();
      hoofColor.dispose();
      hoofBump.dispose();
      hoofNormal.dispose();
      lungColor.dispose();
      floorShadow.dispose();
    },
  };
}
