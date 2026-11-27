import * as THREE from 'three';

export interface ProceduralTextureSet {
  coatColor: THREE.CanvasTexture;
  coatBump: THREE.CanvasTexture;
  coatNormal: THREE.CanvasTexture;
  coatRoughness: THREE.CanvasTexture;
  muscleColor: THREE.CanvasTexture;
  muscleBump: THREE.CanvasTexture;
  muscleNormal: THREE.CanvasTexture;
  boneColor: THREE.CanvasTexture;
  boneBump: THREE.CanvasTexture;
  boneNormal: THREE.CanvasTexture;
  boneRoughness: THREE.CanvasTexture;
  hoofColor: THREE.CanvasTexture;
  hoofBump: THREE.CanvasTexture;
  hoofNormal: THREE.CanvasTexture;
  brainColor: THREE.CanvasTexture;
  brainNormal: THREE.CanvasTexture;
  tendonNormal: THREE.CanvasTexture;
  lungColor: THREE.CanvasTexture;
  eyeColor: THREE.CanvasTexture;
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

  // 1. Living equine warm bay coat texture (1024x1024 fine short-hair coat + dappled warmth + roughness + normal)
  const [coatC, coatCtx] = makeCanvas(1024, 1024);
  const [coatBC, coatBCtx] = makeCanvas(1024, 1024);
  const [coatRC, coatRCtx] = makeCanvas(512, 512);

  coatCtx.fillStyle = '#8b4929';
  coatCtx.fillRect(0, 0, 1024, 1024);

  coatBCtx.fillStyle = '#808080';
  coatBCtx.fillRect(0, 0, 1024, 1024);

  coatRCtx.fillStyle = '#8c8c8c';
  coatRCtx.fillRect(0, 0, 512, 512);

  // Soft organic bay dapples, shoulder/croup sheen & subcutaneous warmth
  for (let i = 0; i < 240; i++) {
    const dx = rand() * 1024;
    const dy = rand() * 1024;
    const dr = 18 + rand() * 52;
    const g = coatCtx.createRadialGradient(dx, dy, 3, dx, dy, dr);
    g.addColorStop(0, i % 2 === 0 ? 'rgba(196, 118, 66, 0.105)' : 'rgba(54, 23, 11, 0.09)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    coatCtx.fillStyle = g;
    coatCtx.beginPath();
    coatCtx.arc(dx, dy, dr, 0, Math.PI * 2);
    coatCtx.fill();

    const rg = coatRCtx.createRadialGradient(dx * 0.5, dy * 0.5, 2, dx * 0.5, dy * 0.5, dr * 0.5);
    rg.addColorStop(0, i % 2 === 0 ? 'rgba(104, 104, 104, 0.16)' : 'rgba(164, 164, 164, 0.15)');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    coatRCtx.fillStyle = rg;
    coatRCtx.beginPath();
    coatRCtx.arc(dx * 0.5, dy * 0.5, dr * 0.5, 0, Math.PI * 2);
    coatRCtx.fill();
  }

  // Ultra-fine directional equine short coat hairs with subtle guard-hair shimmer
  for (let i = 0; i < 52000; i++) {
    const x = rand() * 1024;
    const y = rand() * 1024;
    const len = 4.2 + rand() * 11.2;
    const dy = (rand() - 0.35) * 1.85;
    const tone = rand();
    const strokeCol =
      tone < 0.28
        ? 'rgba(42, 18, 9, 0.16)'
        : tone < 0.72
          ? 'rgba(206, 130, 78, 0.12)'
          : 'rgba(238, 178, 124, 0.09)';
    const w = 0.62 + rand() * 0.52;

    coatCtx.strokeStyle = strokeCol;
    coatCtx.lineWidth = w;
    coatCtx.beginPath();
    coatCtx.moveTo(x, y);
    coatCtx.lineTo(x + len, y + dy);
    coatCtx.stroke();

    const bv = tone < 0.48 ? 96 : 162;
    coatBCtx.strokeStyle = `rgba(${bv},${bv},${bv},0.45)`;
    coatBCtx.lineWidth = w;
    coatBCtx.beginPath();
    coatBCtx.moveTo(x, y);
    coatBCtx.lineTo(x + len, y + dy);
    coatBCtx.stroke();
  }

  for (let i = 0; i < 7200; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    const rv = rand() > 0.5 ? 116 : 160;
    coatRCtx.fillStyle = `rgba(${rv},${rv},${rv},0.28)`;
    coatRCtx.fillRect(x, y, 3 + rand() * 5, 1);
  }

  const coatColor = new THREE.CanvasTexture(coatC);
  coatColor.colorSpace = THREE.SRGBColorSpace;
  coatColor.wrapS = THREE.RepeatWrapping;
  coatColor.wrapT = THREE.RepeatWrapping;
  coatColor.repeat.set(3.6, 3.6);
  coatColor.anisotropy = aniso;

  const coatBump = new THREE.CanvasTexture(coatBC);
  coatBump.wrapS = THREE.RepeatWrapping;
  coatBump.wrapT = THREE.RepeatWrapping;
  coatBump.repeat.set(3.6, 3.6);
  coatBump.anisotropy = aniso;

  const coatNormal = bumpCanvasToNormalTexture(coatBC, 1.32, [3.6, 3.6], false, aniso);

  const coatRoughness = new THREE.CanvasTexture(coatRC);
  coatRoughness.colorSpace = THREE.NoColorSpace;
  coatRoughness.wrapS = THREE.RepeatWrapping;
  coatRoughness.wrapT = THREE.RepeatWrapping;
  coatRoughness.repeat.set(3.6, 3.6);
  coatRoughness.anisotropy = aniso;

  // 2. Longitudinal striated skeletal muscle fascicles (512x512 organic epimysium marbling + fascicle relief)
  const [musC, musCtx] = makeCanvas(512, 512);
  musCtx.fillStyle = '#ebe4e0';
  musCtx.fillRect(0, 0, 512, 512);
  const [musBC, musBCtx] = makeCanvas(512, 512);
  musBCtx.fillStyle = '#808080';
  musBCtx.fillRect(0, 0, 512, 512);

  // Subtle organic blood-rich mottling so muscle avoids flat uniform stripes
  for (let i = 0; i < 95; i++) {
    const mx = rand() * 512;
    const my = rand() * 512;
    const mr = 24 + rand() * 56;
    const mg = musCtx.createRadialGradient(mx, my, 4, mx, my, mr);
    mg.addColorStop(0, i % 2 === 0 ? 'rgba(174, 128, 122, 0.14)' : 'rgba(255, 245, 242, 0.14)');
    mg.addColorStop(1, 'rgba(0,0,0,0)');
    musCtx.fillStyle = mg;
    musCtx.beginPath();
    musCtx.arc(mx, my, mr, 0, Math.PI * 2);
    musCtx.fill();
  }

  // Subtle anatomical fascicle bundles running vertically (UV.y = fiber direction)
  for (let x = 0; x < 512; x += 2) {
    const primary = Math.sin((x / 512) * Math.PI * 56);
    const bundle = Math.sin((x / 512) * Math.PI * 14 + 0.6);
    const fine = Math.sin((x / 512) * Math.PI * 132);
    const band = primary * 0.30 + bundle * 0.30 + fine * 0.14 + 0.5;
    const clamped = Math.max(0, Math.min(1, band));

    if (clamped > 0.58) {
      musCtx.fillStyle = `rgba(255, 250, 248, ${(clamped - 0.54) * 0.58})`;
    } else {
      musCtx.fillStyle = `rgba(142, 114, 110, ${(0.60 - clamped) * 0.54})`;
    }
    musCtx.fillRect(x, 0, 2, 512);

    const v = Math.round(52 + clamped * 184);
    musBCtx.fillStyle = `rgb(${v},${v},${v})`;
    musBCtx.fillRect(x, 0, 2, 512);
  }
  // Delicate organic myofibril curvature & pearly perimysium connective septa lines
  for (let i = 0; i < 3200; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    const len = 30 + rand() * 96;
    const drift = (rand() - 0.5) * 3.8;
    const isSeptum = i % 5 === 0;

    musCtx.strokeStyle = isSeptum
      ? 'rgba(255, 252, 249, 0.42)'
      : 'rgba(132, 102, 98, 0.28)';
    musCtx.lineWidth = isSeptum ? 1.15 : 0.85;
    musCtx.beginPath();
    musCtx.moveTo(x, y);
    musCtx.quadraticCurveTo(x + drift, y + len * 0.5, x, y + len);
    musCtx.stroke();

    musBCtx.strokeStyle = isSeptum ? 'rgba(232,232,232,0.26)' : 'rgba(84,84,84,0.20)';
    musBCtx.lineWidth = isSeptum ? 1.2 : 0.9;
    musBCtx.beginPath();
    musBCtx.moveTo(x, y);
    musBCtx.quadraticCurveTo(x + drift, y + len * 0.5, x, y + len);
    musBCtx.stroke();
  }

  const muscleColor = new THREE.CanvasTexture(musC);
  muscleColor.colorSpace = THREE.SRGBColorSpace;
  muscleColor.wrapS = THREE.RepeatWrapping;
  muscleColor.wrapT = THREE.RepeatWrapping;
  muscleColor.repeat.set(2.6, 2.0);
  muscleColor.anisotropy = aniso;

  const muscleBump = new THREE.CanvasTexture(musBC);
  muscleBump.wrapS = THREE.RepeatWrapping;
  muscleBump.wrapT = THREE.RepeatWrapping;
  muscleBump.repeat.set(2.6, 2.0);
  muscleBump.anisotropy = aniso;

  const muscleNormal = bumpCanvasToNormalTexture(musBC, 2.65, [2.6, 2.0], false, aniso);

  // 3. Organic cortical periosteum bone texture (512x512 museum osteology ivory patina + Haversian lamellae + nutrient pores)
  const [boneC, boneCtx] = makeCanvas(512, 512);
  const [boneBC, boneBCtx] = makeCanvas(512, 512);
  const [boneRC, boneRCtx] = makeCanvas(512, 512);

  boneCtx.fillStyle = '#efe7d4';
  boneCtx.fillRect(0, 0, 512, 512);
  boneBCtx.fillStyle = '#848484';
  boneBCtx.fillRect(0, 0, 512, 512);
  boneRCtx.fillStyle = '#929292';
  boneRCtx.fillRect(0, 0, 512, 512);

  // Broad organic mineral mottling & ossification variation
  for (let i = 0; i < 160; i++) {
    const cx = rand() * 512;
    const cy = rand() * 512;
    const cr = 16 + rand() * 54;
    const cg = boneCtx.createRadialGradient(cx, cy, 2, cx, cy, cr);
    const warmAmber = i % 3 === 0;
    cg.addColorStop(
      0,
      warmAmber ? 'rgba(182, 158, 122, 0.13)' : 'rgba(255, 252, 244, 0.14)',
    );
    cg.addColorStop(1, 'rgba(0,0,0,0)');
    boneCtx.fillStyle = cg;
    boneCtx.beginPath();
    boneCtx.arc(cx, cy, cr, 0, Math.PI * 2);
    boneCtx.fill();

    // Subtle roughness variation: ivory patches more burnished, mineral areas slightly rougher
    const rg = boneRCtx.createRadialGradient(cx, cy, 2, cx, cy, cr);
    rg.addColorStop(0, warmAmber ? 'rgba(182,182,182,0.18)' : 'rgba(104,104,104,0.18)');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    boneRCtx.fillStyle = rg;
    boneRCtx.beginPath();
    boneRCtx.arc(cx, cy, cr, 0, Math.PI * 2);
    boneRCtx.fill();
  }

  // Fine organic Haversian cortical striations & collagen lamellae curves
  for (let i = 0; i < 4200; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    const len = 8 + rand() * 34;
    const angle = (rand() - 0.5) * 0.35;
    const ex = x + Math.cos(angle) * len;
    const ey = y + Math.sin(angle) * len;
    const mx = (x + ex) * 0.5 + (rand() - 0.5) * 3.0;
    const my = (y + ey) * 0.5 + (rand() - 0.5) * 2.5;
    const isLight = i % 2 === 0;

    boneCtx.strokeStyle = isLight
      ? 'rgba(255, 252, 244, 0.15)'
      : 'rgba(164, 142, 108, 0.13)';
    boneCtx.lineWidth = 0.65 + rand() * 0.65;
    boneCtx.beginPath();
    boneCtx.moveTo(x, y);
    boneCtx.quadraticCurveTo(mx, my, ex, ey);
    boneCtx.stroke();

    const bv = isLight ? 148 : 108;
    boneBCtx.strokeStyle = `rgba(${bv},${bv},${bv},0.32)`;
    boneBCtx.lineWidth = 0.75 + rand() * 0.6;
    boneBCtx.beginPath();
    boneBCtx.moveTo(x, y);
    boneBCtx.quadraticCurveTo(mx, my, ex, ey);
    boneBCtx.stroke();
  }

  // Subtle vascular grooves & trabecular micro-foramina pits
  for (let i = 0; i < 520; i++) {
    const px = rand() * 512;
    const py = rand() * 512;
    const pr = 0.7 + rand() * 1.4;
    boneCtx.fillStyle = 'rgba(128, 108, 82, 0.16)';
    boneCtx.beginPath();
    boneCtx.arc(px, py, pr, 0, Math.PI * 2);
    boneCtx.fill();

    boneBCtx.fillStyle = 'rgba(64, 64, 64, 0.45)';
    boneBCtx.beginPath();
    boneBCtx.arc(px, py, pr * 1.1, 0, Math.PI * 2);
    boneBCtx.fill();

    boneRCtx.fillStyle = 'rgba(205, 205, 205, 0.35)';
    boneRCtx.beginPath();
    boneRCtx.arc(px, py, pr * 1.4, 0, Math.PI * 2);
    boneRCtx.fill();
  }

  const boneColor = new THREE.CanvasTexture(boneC);
  boneColor.colorSpace = THREE.SRGBColorSpace;
  boneColor.wrapS = THREE.RepeatWrapping;
  boneColor.wrapT = THREE.RepeatWrapping;
  boneColor.repeat.set(2.0, 2.0);
  boneColor.anisotropy = aniso;

  const boneBump = new THREE.CanvasTexture(boneBC);
  boneBump.wrapS = THREE.RepeatWrapping;
  boneBump.wrapT = THREE.RepeatWrapping;
  boneBump.repeat.set(2.0, 2.0);
  boneBump.anisotropy = aniso;

  const boneNormal = bumpCanvasToNormalTexture(boneBC, 1.55, [2.0, 2.0], false, aniso);

  const boneRoughness = new THREE.CanvasTexture(boneRC);
  boneRoughness.colorSpace = THREE.NoColorSpace;
  boneRoughness.wrapS = THREE.RepeatWrapping;
  boneRoughness.wrapT = THREE.RepeatWrapping;
  boneRoughness.repeat.set(2.0, 2.0);
  boneRoughness.anisotropy = aniso;

  // 4. Equine keratin hoof wall texture (512x512 natural horn tubules + waxy coronary periople + growth rings)
  const [hoofC, hoofCtx] = makeCanvas(512, 512);
  const [hoofBC, hoofBCtx] = makeCanvas(512, 512);
  const hoofGrad = hoofCtx.createLinearGradient(0, 0, 0, 512);
  hoofGrad.addColorStop(0, '#857768'); // pale waxy periople at top
  hoofGrad.addColorStop(0.11, '#5d5145');
  hoofGrad.addColorStop(0.35, '#463c33');
  hoofGrad.addColorStop(0.75, '#312a24');
  hoofGrad.addColorStop(1, '#231e19');
  hoofCtx.fillStyle = hoofGrad;
  hoofCtx.fillRect(0, 0, 512, 512);
  hoofBCtx.fillStyle = '#808080';
  hoofBCtx.fillRect(0, 0, 512, 512);

  // Subtle horn pigment mottling
  for (let i = 0; i < 60; i++) {
    const hx = rand() * 512;
    const hy = rand() * 512;
    const hr = 18 + rand() * 44;
    const hg = hoofCtx.createRadialGradient(hx, hy, 2, hx, hy, hr);
    hg.addColorStop(0, i % 2 === 0 ? 'rgba(134, 114, 92, 0.12)' : 'rgba(16, 13, 10, 0.14)');
    hg.addColorStop(1, 'rgba(0,0,0,0)');
    hoofCtx.fillStyle = hg;
    hoofCtx.beginPath();
    hoofCtx.arc(hx, hy, hr, 0, Math.PI * 2);
    hoofCtx.fill();
  }

  for (let x = 0; x < 512; x += 1.5) {
    const shade = rand();
    hoofCtx.fillStyle =
      shade > 0.62
        ? 'rgba(118, 104, 88, 0.18)'
        : shade > 0.25
          ? 'rgba(62, 53, 44, 0.14)'
          : 'rgba(16, 13, 10, 0.24)';
    hoofCtx.fillRect(x, 0, 1.4, 512);
    const bv = Math.round(98 + shade * 58);
    hoofBCtx.fillStyle = `rgb(${bv},${bv},${bv})`;
    hoofBCtx.fillRect(x, 0, 1.4, 512);
  }
  for (let r = 0; r < 24; r++) {
    const y = 24 + r * 20 + (rand() - 0.5) * 6;
    hoofCtx.fillStyle = 'rgba(20, 16, 13, 0.18)';
    hoofCtx.fillRect(0, y, 512, 2.5);
    hoofBCtx.fillStyle = 'rgb(92,92,92)';
    hoofBCtx.fillRect(0, y, 512, 2.5);
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

  const hoofNormal = bumpCanvasToNormalTexture(hoofBC, 1.75, [1, 1], true, aniso);

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

  // 5b. Equine cerebral gyri & sulci cortical pattern (256x256 color + normal)
  const [brC, brCtx] = makeCanvas(256, 256);
  const [brBC, brBCtx] = makeCanvas(256, 256);
  brCtx.fillStyle = '#e7c6a9';
  brCtx.fillRect(0, 0, 256, 256);
  brBCtx.fillStyle = '#a8a8a8';
  brBCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 95; i++) {
    let px = rand() * 256;
    let py = rand() * 256;
    let ang = rand() * Math.PI * 2;
    brCtx.strokeStyle = i % 3 === 0 ? 'rgba(138, 86, 72, 0.34)' : 'rgba(168, 114, 96, 0.25)';
    brCtx.lineWidth = 2.1;
    brBCtx.strokeStyle = 'rgb(62,62,62)';
    brBCtx.lineWidth = 3.2;
    brCtx.beginPath();
    brBCtx.beginPath();
    brCtx.moveTo(px, py);
    brBCtx.moveTo(px, py);
    for (let s = 0; s < 5; s++) {
      ang += (rand() - 0.5) * 1.4;
      px += Math.cos(ang) * 14;
      py += Math.sin(ang) * 14;
      brCtx.lineTo(px, py);
      brBCtx.lineTo(px, py);
    }
    brCtx.stroke();
    brBCtx.stroke();
  }
  const brainColor = new THREE.CanvasTexture(brC);
  brainColor.colorSpace = THREE.SRGBColorSpace;
  brainColor.wrapS = THREE.RepeatWrapping;
  brainColor.wrapT = THREE.RepeatWrapping;
  brainColor.anisotropy = aniso;

  const brainNormal = bumpCanvasToNormalTexture(brBC, 1.35, [2, 2], false, aniso);

  // 5c. Parallel collagen crimp & micro-fascicle normal map for tendons, ligaments & fascia (256x256)
  const [tenBC, tenBCtx] = makeCanvas(256, 256);
  tenBCtx.fillStyle = '#808080';
  tenBCtx.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 2) {
    const wave = Math.sin((x / 256) * Math.PI * 56) * 28 + Math.sin((x / 256) * Math.PI * 18) * 16;
    const v = Math.round(128 + wave);
    tenBCtx.fillStyle = `rgb(${v},${v},${v})`;
    tenBCtx.fillRect(x, 0, 2, 256);
  }
  for (let i = 0; i < 650; i++) {
    const sx = rand() * 256;
    const sy = rand() * 256;
    const bv = i % 2 === 0 ? 156 : 102;
    tenBCtx.strokeStyle = `rgba(${bv},${bv},${bv},0.28)`;
    tenBCtx.lineWidth = 0.85;
    tenBCtx.beginPath();
    tenBCtx.moveTo(sx, sy);
    tenBCtx.quadraticCurveTo(sx + (rand() - 0.5) * 2.4, sy + 24, sx, sy + 48);
    tenBCtx.stroke();
  }
  const tendonNormal = bumpCanvasToNormalTexture(tenBC, 1.25, [2.5, 4.0], false, aniso);

  // 5d. Living equine eye texture (512x512 equirectangular UV: rich chestnut iris fibers, sclera vessels, horizontal oval pupil + dorsal corpora nigra)
  const [eyeC, eyeCtx] = makeCanvas(512, 512);
  eyeCtx.fillStyle = '#d9d2c8';
  eyeCtx.fillRect(0, 0, 512, 512);

  // Subtle scleral vascular capillaries near limbus
  for (let i = 0; i < 75; i++) {
    const ang = rand() * Math.PI * 2;
    const r0 = 152 + rand() * 24;
    const r1 = r0 + 26 + rand() * 34;
    eyeCtx.strokeStyle = 'rgba(154, 64, 58, 0.16)';
    eyeCtx.lineWidth = 1.1;
    eyeCtx.beginPath();
    eyeCtx.moveTo(256 + Math.cos(ang) * r0 * 0.5, 256 + Math.sin(ang) * r0);
    eyeCtx.lineTo(256 + Math.cos(ang + 0.08) * r1 * 0.5, 256 + Math.sin(ang + 0.08) * r1);
    eyeCtx.stroke();
  }

  eyeCtx.save();
  eyeCtx.translate(256, 256);
  eyeCtx.scale(0.5, 1.0); // Compensate 2:1 SphereGeometry longitude/latitude stretch
  const irisG = eyeCtx.createRadialGradient(0, 0, 22, 0, 0, 148);
  irisG.addColorStop(0, '#5a3319');
  irisG.addColorStop(0.50, '#784421');
  irisG.addColorStop(0.80, '#2e180c');
  irisG.addColorStop(0.93, '#17100b');
  irisG.addColorStop(1, '#d2cbc0');
  eyeCtx.fillStyle = irisG;
  eyeCtx.beginPath();
  eyeCtx.arc(0, 0, 148, 0, Math.PI * 2);
  eyeCtx.fill();

  for (let a = 0; a < 160; a++) {
    const ang = (a / 160) * Math.PI * 2;
    eyeCtx.strokeStyle = a % 2 === 0 ? 'rgba(176, 112, 58, 0.25)' : 'rgba(28, 14, 7, 0.26)';
    eyeCtx.lineWidth = 1.8;
    eyeCtx.beginPath();
    eyeCtx.moveTo(Math.cos(ang) * 44, Math.sin(ang) * 44);
    eyeCtx.lineTo(Math.cos(ang) * 134, Math.sin(ang) * 134);
    eyeCtx.stroke();
  }

  // Characteristic horizontal equine oval pupil
  eyeCtx.fillStyle = '#070505';
  eyeCtx.beginPath();
  eyeCtx.ellipse(0, 0, 64, 28, 0, 0, Math.PI * 2);
  eyeCtx.fill();
  // Dorsal corpora nigra (granula iridica)
  for (let k = -3; k <= 3; k++) {
    eyeCtx.beginPath();
    eyeCtx.arc(k * 9.5, -26 + Math.abs(k) * 1.4, 5.2 - Math.abs(k) * 0.4, 0, Math.PI * 2);
    eyeCtx.fill();
  }
  // Subtle natural moisture shimmer (real clearcoat carries specular highlights dynamically)
  eyeCtx.fillStyle = 'rgba(255, 250, 242, 0.14)';
  eyeCtx.beginPath();
  eyeCtx.ellipse(-26, -24, 12, 8, -0.3, 0, Math.PI * 2);
  eyeCtx.fill();
  eyeCtx.restore();

  const eyeColor = new THREE.CanvasTexture(eyeC);
  eyeColor.colorSpace = THREE.SRGBColorSpace;
  eyeColor.wrapS = THREE.ClampToEdgeWrapping;
  eyeColor.wrapT = THREE.ClampToEdgeWrapping;
  eyeColor.anisotropy = aniso;

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
    coatRoughness,
    muscleColor,
    muscleBump,
    muscleNormal,
    boneColor,
    boneBump,
    boneNormal,
    boneRoughness,
    hoofColor,
    hoofBump,
    hoofNormal,
    brainColor,
    brainNormal,
    tendonNormal,
    lungColor,
    eyeColor,
    floorShadow,
    dispose: () => {
      coatColor.dispose();
      coatBump.dispose();
      coatNormal.dispose();
      coatRoughness.dispose();
      muscleColor.dispose();
      muscleBump.dispose();
      muscleNormal.dispose();
      boneColor.dispose();
      boneBump.dispose();
      boneNormal.dispose();
      boneRoughness.dispose();
      hoofColor.dispose();
      hoofBump.dispose();
      hoofNormal.dispose();
      brainColor.dispose();
      brainNormal.dispose();
      tendonNormal.dispose();
      lungColor.dispose();
      eyeColor.dispose();
      floorShadow.dispose();
    },
  };
}
