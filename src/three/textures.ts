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

  // Soft organic bay dapples & subcutaneous warmth
  for (let i = 0; i < 190; i++) {
    const dx = rand() * 1024;
    const dy = rand() * 1024;
    const dr = 20 + rand() * 46;
    const g = coatCtx.createRadialGradient(dx, dy, 3, dx, dy, dr);
    g.addColorStop(0, i % 2 === 0 ? 'rgba(186, 110, 62, 0.095)' : 'rgba(62, 27, 13, 0.085)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    coatCtx.fillStyle = g;
    coatCtx.beginPath();
    coatCtx.arc(dx, dy, dr, 0, Math.PI * 2);
    coatCtx.fill();

    // Subtle sheen variation across coat dapples
    const rg = coatRCtx.createRadialGradient(dx * 0.5, dy * 0.5, 2, dx * 0.5, dy * 0.5, dr * 0.5);
    rg.addColorStop(0, i % 2 === 0 ? 'rgba(110, 110, 110, 0.14)' : 'rgba(162, 162, 162, 0.14)');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    coatRCtx.fillStyle = rg;
    coatRCtx.beginPath();
    coatRCtx.arc(dx * 0.5, dy * 0.5, dr * 0.5, 0, Math.PI * 2);
    coatRCtx.fill();
  }

  // Ultra-fine directional equine short coat hairs
  for (let i = 0; i < 46000; i++) {
    const x = rand() * 1024;
    const y = rand() * 1024;
    const len = 4.5 + rand() * 10.5;
    const dy = (rand() - 0.35) * 1.9;
    const tone = rand();
    const strokeCol =
      tone < 0.3
        ? 'rgba(44, 19, 9, 0.15)'
        : tone < 0.72
          ? 'rgba(202, 126, 76, 0.115)'
          : 'rgba(232, 170, 118, 0.08)';
    const w = 0.65 + rand() * 0.5;

    coatCtx.strokeStyle = strokeCol;
    coatCtx.lineWidth = w;
    coatCtx.beginPath();
    coatCtx.moveTo(x, y);
    coatCtx.lineTo(x + len, y + dy);
    coatCtx.stroke();

    const bv = tone < 0.48 ? 100 : 158;
    coatBCtx.strokeStyle = `rgba(${bv},${bv},${bv},0.42)`;
    coatBCtx.lineWidth = w;
    coatBCtx.beginPath();
    coatBCtx.moveTo(x, y);
    coatBCtx.lineTo(x + len, y + dy);
    coatBCtx.stroke();
  }

  for (let i = 0; i < 6500; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    const rv = rand() > 0.5 ? 122 : 158;
    coatRCtx.fillStyle = `rgba(${rv},${rv},${rv},0.28)`;
    coatRCtx.fillRect(x, y, 3 + rand() * 5, 1);
  }

  const coatColor = new THREE.CanvasTexture(coatC);
  coatColor.colorSpace = THREE.SRGBColorSpace;
  coatColor.wrapS = THREE.RepeatWrapping;
  coatColor.wrapT = THREE.RepeatWrapping;
  coatColor.repeat.set(3.4, 3.4);
  coatColor.anisotropy = aniso;

  const coatBump = new THREE.CanvasTexture(coatBC);
  coatBump.wrapS = THREE.RepeatWrapping;
  coatBump.wrapT = THREE.RepeatWrapping;
  coatBump.repeat.set(3.4, 3.4);
  coatBump.anisotropy = aniso;

  const coatNormal = bumpCanvasToNormalTexture(coatBC, 1.24, [3.4, 3.4], false, aniso);

  const coatRoughness = new THREE.CanvasTexture(coatRC);
  coatRoughness.colorSpace = THREE.NoColorSpace;
  coatRoughness.wrapS = THREE.RepeatWrapping;
  coatRoughness.wrapT = THREE.RepeatWrapping;
  coatRoughness.repeat.set(3.4, 3.4);
  coatRoughness.anisotropy = aniso;

  // 2. Longitudinal striated skeletal muscle fascicles (512x512 neutral-bright striation + bump + crisp normal along UV.y)
  const [musC, musCtx] = makeCanvas(512, 512);
  musCtx.fillStyle = '#ece7e4';
  musCtx.fillRect(0, 0, 512, 512);
  const [musBC, musBCtx] = makeCanvas(512, 512);
  musBCtx.fillStyle = '#808080';
  musBCtx.fillRect(0, 0, 512, 512);

  // Subtle anatomical fascicle bundles running vertically (UV.y = fiber direction)
  for (let x = 0; x < 512; x += 2) {
    const primary = Math.sin((x / 512) * Math.PI * 56);
    const bundle = Math.sin((x / 512) * Math.PI * 16 + 0.6);
    const fine = Math.sin((x / 512) * Math.PI * 128);
    const band = primary * 0.32 + bundle * 0.28 + fine * 0.14 + 0.5;
    const clamped = Math.max(0, Math.min(1, band));

    if (clamped > 0.6) {
      musCtx.fillStyle = `rgba(255, 252, 250, ${(clamped - 0.55) * 0.62})`;
    } else {
      musCtx.fillStyle = `rgba(148, 124, 118, ${(0.62 - clamped) * 0.56})`;
    }
    musCtx.fillRect(x, 0, 2, 512);

    const v = Math.round(58 + clamped * 176);
    musBCtx.fillStyle = `rgb(${v},${v},${v})`;
    musBCtx.fillRect(x, 0, 2, 512);
  }
  // Delicate organic myofibril curvature & pearly perimysium connective septa lines
  for (let i = 0; i < 2400; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    const len = 34 + rand() * 88;
    const drift = (rand() - 0.5) * 3.0;
    const isSeptum = i % 5 === 0;

    musCtx.strokeStyle = isSeptum
      ? 'rgba(255, 255, 255, 0.44)'
      : 'rgba(136, 110, 106, 0.28)';
    musCtx.lineWidth = isSeptum ? 1.05 : 0.85;
    musCtx.beginPath();
    musCtx.moveTo(x, y);
    musCtx.quadraticCurveTo(x + drift, y + len * 0.5, x, y + len);
    musCtx.stroke();

    musBCtx.strokeStyle = isSeptum ? 'rgba(224,224,224,0.22)' : 'rgba(92,92,92,0.18)';
    musBCtx.lineWidth = isSeptum ? 1.1 : 0.9;
    musBCtx.beginPath();
    musBCtx.moveTo(x, y);
    musBCtx.quadraticCurveTo(x + drift, y + len * 0.5, x, y + len);
    musBCtx.stroke();
  }

  const muscleColor = new THREE.CanvasTexture(musC);
  muscleColor.colorSpace = THREE.SRGBColorSpace;
  muscleColor.wrapS = THREE.RepeatWrapping;
  muscleColor.wrapT = THREE.RepeatWrapping;
  muscleColor.repeat.set(2.4, 1.8);
  muscleColor.anisotropy = aniso;

  const muscleBump = new THREE.CanvasTexture(musBC);
  muscleBump.wrapS = THREE.RepeatWrapping;
  muscleBump.wrapT = THREE.RepeatWrapping;
  muscleBump.repeat.set(2.4, 1.8);
  muscleBump.anisotropy = aniso;

  const muscleNormal = bumpCanvasToNormalTexture(musBC, 2.25, [2.4, 1.8], false, aniso);

  // 3. Cortical periosteum bone texture (512x512 osteological mineral warmth + Haversian micro-grain + normal)
  const [boneC, boneCtx] = makeCanvas(512, 512);
  const [boneBC, boneBCtx] = makeCanvas(512, 512);
  boneCtx.fillStyle = '#ede3ce';
  boneCtx.fillRect(0, 0, 512, 512);
  boneBCtx.fillStyle = '#808080';
  boneBCtx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 6400; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    const w = 1.5 + rand() * 11;
    const h = 0.8 + rand() * 1.8;
    boneCtx.fillStyle =
      i % 3 === 0 ? 'rgba(156, 136, 102, 0.16)' : 'rgba(255, 251, 240, 0.20)';
    boneCtx.fillRect(x, y, w, h);

    const bv = i % 3 === 0 ? 102 : 152;
    boneBCtx.fillStyle = `rgb(${bv},${bv},${bv})`;
    boneBCtx.fillRect(x, y, w * 0.75, h);
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

  const boneNormal = bumpCanvasToNormalTexture(boneBC, 1.18, [1.5, 1.5], false, aniso);

  const [boneRC, boneRCtx] = makeCanvas(256, 256);
  boneRCtx.fillStyle = '#9a9a9a';
  boneRCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1600; i++) {
    const x = rand() * 256;
    const y = rand() * 256;
    const shade = i % 2 === 0 ? 128 : 178;
    boneRCtx.fillStyle = `rgb(${shade},${shade},${shade})`;
    boneRCtx.fillRect(x, y, 2 + rand() * 6, 1 + rand() * 2);
  }
  const boneRoughness = new THREE.CanvasTexture(boneRC);
  boneRoughness.colorSpace = THREE.NoColorSpace;
  boneRoughness.wrapS = THREE.RepeatWrapping;
  boneRoughness.wrapT = THREE.RepeatWrapping;
  boneRoughness.anisotropy = aniso;

  // 4. Equine keratin hoof wall texture (512x512 vertical horn tubules + pale coronary periople + growth rings)
  const [hoofC, hoofCtx] = makeCanvas(512, 512);
  const [hoofBC, hoofBCtx] = makeCanvas(512, 512);
  const hoofGrad = hoofCtx.createLinearGradient(0, 0, 0, 512);
  hoofGrad.addColorStop(0, '#786b5e');
  hoofGrad.addColorStop(0.10, '#5a4e43');
  hoofGrad.addColorStop(0.35, '#433a32');
  hoofGrad.addColorStop(0.75, '#2f2924');
  hoofGrad.addColorStop(1, '#201c18');
  hoofCtx.fillStyle = hoofGrad;
  hoofCtx.fillRect(0, 0, 512, 512);
  hoofBCtx.fillStyle = '#808080';
  hoofBCtx.fillRect(0, 0, 512, 512);

  for (let x = 0; x < 512; x += 2) {
    const shade = rand();
    hoofCtx.fillStyle = shade > 0.5 ? 'rgba(98,88,78,0.18)' : 'rgba(18,15,12,0.22)';
    hoofCtx.fillRect(x, 0, 1.6, 512);
    const bv = Math.round(104 + shade * 48);
    hoofBCtx.fillStyle = `rgb(${bv},${bv},${bv})`;
    hoofBCtx.fillRect(x, 0, 1.6, 512);
  }
  for (let r = 0; r < 22; r++) {
    const y = 26 + r * 22 + (rand() - 0.5) * 6;
    hoofCtx.fillStyle = 'rgba(20, 16, 13, 0.20)';
    hoofCtx.fillRect(0, y, 512, 3);
    hoofBCtx.fillStyle = 'rgb(96,96,96)';
    hoofBCtx.fillRect(0, y, 512, 3);
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

  const hoofNormal = bumpCanvasToNormalTexture(hoofBC, 1.4, [1, 1], true, aniso);

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

  // 5c. Parallel collagen crimp normal map for tendons & fascia
  const [tenBC, tenBCtx] = makeCanvas(128, 128);
  for (let x = 0; x < 128; x += 2) {
    const v = Math.round(128 + Math.sin((x / 128) * Math.PI * 32) * 38);
    tenBCtx.fillStyle = `rgb(${v},${v},${v})`;
    tenBCtx.fillRect(x, 0, 2, 128);
  }
  const tendonNormal = bumpCanvasToNormalTexture(tenBC, 1.0, [2, 4], false, aniso);

  // 5d. Living equine eye texture (equirectangular UV: u spans 360°, v spans 180°, so rx_uv = 0.5 * ry_uv)
  const [eyeC, eyeCtx] = makeCanvas(256, 256);
  eyeCtx.fillStyle = '#ddd7cf';
  eyeCtx.fillRect(0, 0, 256, 256);

  eyeCtx.save();
  eyeCtx.translate(128, 128);
  eyeCtx.scale(0.5, 1.0); // Compensate 2:1 SphereGeometry longitude/latitude stretch
  const irisG = eyeCtx.createRadialGradient(0, 0, 12, 0, 0, 74);
  irisG.addColorStop(0, '#522e18');
  irisG.addColorStop(0.55, '#6e3f1f');
  irisG.addColorStop(0.84, '#2a160c');
  irisG.addColorStop(0.95, '#17100b');
  irisG.addColorStop(1, '#d6cfc4');
  eyeCtx.fillStyle = irisG;
  eyeCtx.beginPath();
  eyeCtx.arc(0, 0, 74, 0, Math.PI * 2);
  eyeCtx.fill();

  for (let a = 0; a < 90; a++) {
    const ang = (a / 90) * Math.PI * 2;
    eyeCtx.strokeStyle = a % 2 === 0 ? 'rgba(164, 102, 52, 0.24)' : 'rgba(32, 16, 8, 0.25)';
    eyeCtx.lineWidth = 1.6;
    eyeCtx.beginPath();
    eyeCtx.moveTo(Math.cos(ang) * 22, Math.sin(ang) * 22);
    eyeCtx.lineTo(Math.cos(ang) * 66, Math.sin(ang) * 66);
    eyeCtx.stroke();
  }

  // Characteristic horizontal equine oval pupil
  eyeCtx.fillStyle = '#090707';
  eyeCtx.beginPath();
  eyeCtx.ellipse(0, 0, 32, 14, 0, 0, Math.PI * 2);
  eyeCtx.fill();
  // Dorsal corpora nigra
  for (let k = -2; k <= 2; k++) {
    eyeCtx.beginPath();
    eyeCtx.arc(k * 6, -13, 2.8, 0, Math.PI * 2);
    eyeCtx.fill();
  }
  eyeCtx.fillStyle = 'rgba(255, 250, 242, 0.28)';
  eyeCtx.beginPath();
  eyeCtx.ellipse(-13, -12, 7, 4.5, -0.3, 0, Math.PI * 2);
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
