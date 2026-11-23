import * as THREE from 'three';

export interface ProceduralTextureSet {
  coatColor: THREE.CanvasTexture;
  muscleColor: THREE.CanvasTexture;
  muscleBump: THREE.CanvasTexture;
  boneColor: THREE.CanvasTexture;
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

export function createProceduralTextures(maxAnisotropy: number): ProceduralTextureSet {
  const aniso = Math.min(maxAnisotropy || 1, 8);

  // 1. Equine bay/chestnut coat texture
  const [coatC, coatCtx] = makeCanvas(256, 256);
  const coatGrad = coatCtx.createLinearGradient(0, 0, 0, 256);
  coatGrad.addColorStop(0, '#7c4428');
  coatGrad.addColorStop(0.5, '#8c5132');
  coatGrad.addColorStop(1, '#683820');
  coatCtx.fillStyle = coatGrad;
  coatCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2400; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const len = 6 + Math.random() * 12;
    coatCtx.strokeStyle = i % 3 === 0 ? 'rgba(40,20,10,0.12)' : 'rgba(205,145,100,0.10)';
    coatCtx.lineWidth = 1;
    coatCtx.beginPath();
    coatCtx.moveTo(x, y);
    coatCtx.lineTo(x + len, y + (Math.random() - 0.5) * 2);
    coatCtx.stroke();
  }
  const coatColor = new THREE.CanvasTexture(coatC);
  coatColor.colorSpace = THREE.SRGBColorSpace;
  coatColor.wrapS = THREE.RepeatWrapping;
  coatColor.wrapT = THREE.RepeatWrapping;
  coatColor.repeat.set(2, 2);
  coatColor.anisotropy = aniso;

  // 2. Striated skeletal muscle fibers (color + bump)
  const [musC, musCtx] = makeCanvas(256, 256);
  musCtx.fillStyle = '#a83c32';
  musCtx.fillRect(0, 0, 256, 256);
  const [musBC, musBCtx] = makeCanvas(256, 256);
  musBCtx.fillStyle = '#808080';
  musBCtx.fillRect(0, 0, 256, 256);

  for (let y = 0; y < 256; y += 2) {
    const band = Math.sin((y / 256) * Math.PI * 28) * 0.5 + 0.5;
    musCtx.fillStyle = band > 0.5 ? 'rgba(215, 115, 102, 0.22)' : 'rgba(105, 24, 20, 0.25)';
    musCtx.fillRect(0, y, 256, 2);
    const v = Math.round(95 + band * 125);
    musBCtx.fillStyle = `rgb(${v},${v},${v})`;
    musBCtx.fillRect(0, y, 256, 2);
  }
  // Subtle aponeurosis sheen lines
  for (let i = 0; i < 420; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    musCtx.fillStyle = 'rgba(245, 225, 218, 0.08)';
    musCtx.fillRect(x, y, 18 + Math.random() * 28, 1);
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

  // 3. Periosteum bone texture
  const [boneC, boneCtx] = makeCanvas(256, 256);
  boneCtx.fillStyle = '#e8dfc9';
  boneCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1600; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    boneCtx.fillStyle = i % 2 === 0 ? 'rgba(180,165,135,0.12)' : 'rgba(255,252,244,0.16)';
    boneCtx.fillRect(x, y, 2 + Math.random() * 6, 1.5);
  }
  const boneColor = new THREE.CanvasTexture(boneC);
  boneColor.colorSpace = THREE.SRGBColorSpace;
  boneColor.wrapS = THREE.RepeatWrapping;
  boneColor.wrapT = THREE.RepeatWrapping;
  boneColor.anisotropy = aniso;

  // 4. Spongy lobular lung parenchyma texture
  const [lungC, lungCtx] = makeCanvas(256, 256);
  lungCtx.fillStyle = '#d98a92';
  lungCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 280; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const r = 4 + Math.random() * 10;
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

  // 5. Soft radial contact shadow beneath hooves
  const [shC, shCtx] = makeCanvas(512, 512);
  const rad = shCtx.createRadialGradient(256, 256, 25, 256, 256, 245);
  rad.addColorStop(0, 'rgba(3, 6, 12, 0.72)');
  rad.addColorStop(0.55, 'rgba(3, 6, 12, 0.34)');
  rad.addColorStop(1, 'rgba(3, 6, 12, 0.0)');
  shCtx.fillStyle = rad;
  shCtx.fillRect(0, 0, 512, 512);
  const floorShadow = new THREE.CanvasTexture(shC);
  floorShadow.colorSpace = THREE.SRGBColorSpace;

  return {
    coatColor,
    muscleColor,
    muscleBump,
    boneColor,
    lungColor,
    floorShadow,
    dispose: () => {
      coatColor.dispose();
      muscleColor.dispose();
      muscleBump.dispose();
      boneColor.dispose();
      lungColor.dispose();
      floorShadow.dispose();
    },
  };
}
