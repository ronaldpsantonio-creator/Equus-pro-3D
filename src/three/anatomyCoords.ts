import * as THREE from 'three';

/**
 * Equine coordinate convention (meters, grounded with hooves at Y = 0):
 *  +X = Cranial (toward head / muzzle)
 *  -X = Caudal (toward hindquarters / tail)
 *  +Y = Dorsal (upward)
 *  -Y = Ventral (downward, ground = 0)
 *  +Z = Right side of horse (lado derecho)
 *  -Z = Left side of horse (lado izquierdo)
 */

export const V3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

// Vertebral landmarks
export function cervicalPos(idx1to7: number): [number, number, number] {
  const t = (idx1to7 - 1) / 6; // 0 = C1 (atlas), 1 = C7
  // Classic equine S-curve neck from poll (0.98, 1.72) down to thoracic inlet (0.56, 1.24)
  const x = THREE.MathUtils.lerp(0.98, 0.56, t);
  const y = 1.72 - 0.48 * t - 0.07 * Math.sin(t * Math.PI);
  return [x, y, 0];
}

export function thoracicPos(idx1to18: number): [number, number, number] {
  const t = (idx1to18 - 1) / 17; // 0 = T1, 1 = T18
  const x = THREE.MathUtils.lerp(0.52, -0.34, t);
  // Slight gentle dip behind withers, rising smoothly toward lumbar loin
  const y = 1.28 + 0.068 * Math.sin(t * Math.PI * 0.85) + 0.02 * t;
  return [x, y, 0];
}

export function lumbarPos(idx1to6: number): [number, number, number] {
  const t = (idx1to6 - 1) / 5;
  const x = THREE.MathUtils.lerp(-0.39, -0.70, t);
  const y = 1.35 + 0.022 * Math.sin(t * Math.PI);
  return [x, y, 0];
}

export function sacralPos(idx1to5: number): [number, number, number] {
  const t = (idx1to5 - 1) / 4;
  const x = THREE.MathUtils.lerp(-0.75, -0.96, t);
  const y = 1.35 - 0.075 * t;
  return [x, y, 0];
}

export function caudalPos(idx: number): [number, number, number] {
  const t = Math.min((idx - 1) / 17, 1);
  const x = -1.01 - 0.36 * t;
  const y = 1.27 - 0.30 * t * t - 0.08 * t;
  return [x, y, 0];
}

export function ribArcPoints(idx1to18: number, sd: -1 | 1): THREE.Vector3[] {
  const [vx, vy] = thoracicPos(idx1to18);
  const t = (idx1to18 - 1) / 17;
  // Barrel widest around T9-T12 (~0.275m half-width) and deepest around T8-T11 (~0.56m)
  const width = (0.135 + 0.14 * Math.sin(Math.pow(t, 0.8) * Math.PI)) * sd;
  const depth = 0.36 + 0.22 * Math.sin(Math.pow(t, 0.78) * Math.PI);
  const sweep = -0.02 - 0.14 * t; // ribs sweep caudoventrally

  return [
    V3(vx, vy - 0.02, 0.03 * sd),
    V3(vx + sweep * 0.25, vy - 0.12 * depth, width * 0.72),
    V3(vx + sweep * 0.55, vy - 0.45 * depth, width),
    V3(vx + sweep * 0.85, vy - 0.82 * depth, width * 0.65),
    V3(vx + sweep, vy - depth, 0.055 * sd),
  ];
}

/**
 * Forelimb landmarks (left sd = -1, right sd = +1)
 * Calibrated to living-horse goniometric posture:
 * - Shoulder (~105°), Elbow (~140°), Carpus (~180°), Fetlock (~145°), Podophalangeal axis (~51°)
 */
export function forelimbLandmarks(sd: -1 | 1) {
  const z = 0.16 * sd;
  return {
    scapulaTop: V3(0.30, 1.44, z * 0.90),
    shoulder: V3(0.535, 1.075, z * 1.04),
    elbow: V3(0.375, 0.845, z * 1.01),
    carpus: V3(0.425, 0.465, z * 0.93),
    fetlock: V3(0.435, 0.185, z * 0.91),
    pasternMid: V3(0.47, 0.105, z * 0.91),
    coronet: V3(0.495, 0.068, z * 0.91),
    hoofCenter: V3(0.508, 0.032, z * 0.91),
  };
}

/**
 * Hindlimb landmarks (left sd = -1, right sd = +1)
 * Calibrated to living-horse goniometric posture:
 * - Hip (~108°), Stifle (~140°), Hock (~150°), Fetlock (~148°), Hind podophalangeal axis (~54°)
 */
export function hindlimbLandmarks(sd: -1 | 1) {
  const z = 0.175 * sd;
  return {
    tuberSacrale: V3(-0.77, 1.40, 0.035 * sd),
    tuberCoxae: V3(-0.71, 1.37, z * 1.08),
    hip: V3(-0.825, 1.15, z * 0.95),
    tuberIschii: V3(-1.05, 1.16, z * 0.76),
    stifle: V3(-0.67, 0.855, z * 1.04),
    hock: V3(-0.89, 0.51, z * 0.94),
    calcaneusTip: V3(-0.95, 0.585, z * 0.94),
    fetlock: V3(-0.845, 0.185, z * 0.91),
    pasternMid: V3(-0.812, 0.105, z * 0.91),
    coronet: V3(-0.79, 0.068, z * 0.91),
    hoofCenter: V3(-0.776, 0.032, z * 0.91),
  };
}

// Head landmarks
export const HEAD = {
  poll: V3(1.02, 1.77, 0),
  cranium: V3(1.13, 1.72, 0),
  orbitCenter: (sd: -1 | 1) => V3(1.19, 1.69, 0.082 * sd),
  cheek: (sd: -1 | 1) => V3(1.14, 1.56, 0.075 * sd),
  nasalBridge: V3(1.34, 1.56, 0),
  muzzle: V3(1.54, 1.39, 0),
  jawAngle: (sd: -1 | 1) => V3(1.06, 1.52, 0.068 * sd),
  chin: V3(1.48, 1.31, 0),
};
