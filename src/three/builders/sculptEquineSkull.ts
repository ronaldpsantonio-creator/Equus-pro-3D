import * as THREE from 'three';
import { V3 } from '../anatomyCoords';
import { createLongBoneMesh, createOrganMesh, createTubeCurveMesh } from './geomHelpers';

export interface SculptedSkullBuildContext {
  boneMat: () => THREE.Material;
  darkBoneMat: () => THREE.Material;
  sculptedBoneMat: () => THREE.Material;
  teethMat: () => THREE.Material;
  push: (
    id: string,
    mesh: THREE.Object3D,
    side: 'left' | 'right' | 'center',
    center?: THREE.Vector3,
  ) => void;
}

const IVORY_HIGHLIGHT = new THREE.Color(0xf3ead6);
const SUTURE_SHADOW = new THREE.Color(0xb6a78f);
const DEEP_CAVITY = new THREE.Color(0x8e7f6a);

function sampleAoColor(ao: number): [number, number, number] {
  const c = new THREE.Color();
  const clamped = THREE.MathUtils.clamp(ao, 0, 1);
  if (clamped < 0.35) {
    c.lerpColors(DEEP_CAVITY, SUTURE_SHADOW, clamped / 0.35);
  } else {
    c.lerpColors(SUTURE_SHADOW, IVORY_HIGHLIGHT, (clamped - 0.35) / 0.65);
  }
  return [c.r, c.g, c.b];
}

function applyAoVertexColors(geo: THREE.BufferGeometry, ao: number): THREE.BufferGeometry {
  const posAttr = geo.getAttribute('position');
  const colors = new Float32Array(posAttr.count * 3);
  const [r, g, b] = sampleAoColor(ao);
  for (let i = 0; i < posAttr.count; i++) {
    colors[i * 3] = r;
    colors[i * 3 + 1] = g;
    colors[i * 3 + 2] = b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

/**
 * Watertight double-walled sculpted bone shell from a (rows x cols) center point grid,
 * outward unit normal grid, half-thickness grid, and per-vertex ambient occlusion grid.
 */
function buildSculptedBonePlateMesh(
  pts: THREE.Vector3[][],
  norms: THREE.Vector3[][],
  thick: number[][],
  aoGrid: number[][],
  mat: THREE.Material,
  edgeScale = 0.30,
  innerAoBias = 0.78,
): THREE.Mesh {
  const rows = pts.length;
  const cols = pts[0].length;
  const positions: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  for (let layer = 0; layer < 2; layer++) {
    const sign = layer === 0 ? 1 : -1;
    for (let r = 0; r < rows; r++) {
      const u = r / (rows - 1);
      for (let c = 0; c < cols; c++) {
        const v = c / (cols - 1);
        const edgeEnv = Math.sin(u * Math.PI) * Math.sin(v * Math.PI);
        const halfT = thick[r][c] * (edgeScale + (1 - edgeScale) * Math.pow(Math.max(0, edgeEnv), 0.32));
        const p = pts[r][c].clone().addScaledVector(norms[r][c], sign * halfT);
        positions.push(p.x, p.y, p.z);
        uvs.push(u, v);

        const baseAo = aoGrid[r]?.[c] ?? 0.9;
        // Subtle bevel shadow right along bone suture rims + darker inner face
        const rimAo = baseAo * (0.86 + 0.14 * Math.pow(Math.max(0, edgeEnv), 0.25));
        const finalAo = layer === 0 ? rimAo : rimAo * innerAoBias;
        const [cr, cg, cb] = sampleAoColor(finalAo);
        colors.push(cr, cg, cb);
      }
    }
  }

  const getP = (idx: number) =>
    new THREE.Vector3(positions[idx * 3], positions[idx * 3 + 1], positions[idx * 3 + 2]);

  const pushOrientedTri = (i0: number, i1: number, i2: number, desiredDir: THREE.Vector3) => {
    const a = getP(i0);
    const b = getP(i1);
    const c = getP(i2);
    const triN = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
    if (triN.dot(desiredDir) >= 0) {
      indices.push(i0, i1, i2);
    } else {
      indices.push(i0, i2, i1);
    }
  };

  const layerStride = rows * cols;
  for (let layer = 0; layer < 2; layer++) {
    const offset = layer * layerStride;
    const sign = layer === 0 ? 1 : -1;
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const a = offset + r * cols + c;
        const b = a + 1;
        const d = offset + (r + 1) * cols + c;
        const e = d + 1;
        const nRef = norms[r][c].clone().multiplyScalar(sign);
        pushOrientedTri(a, b, d, nRef);
        pushOrientedTri(b, e, d, nRef);
      }
    }
  }

  const centerPt = pts[Math.floor(rows / 2)][Math.floor(cols / 2)];
  const stitchEdge = (edgeList: Array<[number, number]>) => {
    for (let k = 0; k < edgeList.length - 1; k++) {
      const [r0, c0] = edgeList[k];
      const [r1, c1] = edgeList[k + 1];
      const o0 = r0 * cols + c0;
      const o1 = r1 * cols + c1;
      const i0 = layerStride + o0;
      const i1 = layerStride + o1;
      const mid = pts[r0][c0].clone().add(pts[r1][c1]).multiplyScalar(0.5);
      const outDir = mid.sub(centerPt);
      if (outDir.lengthSq() < 1e-8) outDir.set(0, 1, 0);
      pushOrientedTri(o0, o1, i0, outDir);
      pushOrientedTri(o1, i1, i0, outDir);
    }
  };

  const topEdge: Array<[number, number]> = [];
  const botEdge: Array<[number, number]> = [];
  for (let c = 0; c < cols; c++) topEdge.push([0, c]);
  for (let c = 0; c < cols; c++) botEdge.push([rows - 1, c]);
  const leftEdge: Array<[number, number]> = [];
  const rightEdge: Array<[number, number]> = [];
  for (let r = 0; r < rows; r++) leftEdge.push([r, 0]);
  for (let r = 0; r < rows; r++) rightEdge.push([r, cols - 1]);

  stitchEdge(topEdge);
  stitchEdge(botEdge);
  stitchEdge(leftEdge);
  stitchEdge(rightEdge);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.computeTangents();

  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function computeGridNormals(
  pts: THREE.Vector3[][],
  preferredDir: (r: number, c: number, p: THREE.Vector3) => THREE.Vector3,
): THREE.Vector3[][] {
  const rows = pts.length;
  const cols = pts[0].length;
  const norms: THREE.Vector3[][] = [];
  for (let r = 0; r < rows; r++) {
    const rowN: THREE.Vector3[] = [];
    for (let c = 0; c < cols; c++) {
      const r0 = Math.max(0, r - 1);
      const r1 = Math.min(rows - 1, r + 1);
      const c0 = Math.max(0, c - 1);
      const c1 = Math.min(cols - 1, c + 1);
      const dU = new THREE.Vector3().subVectors(pts[r1][c], pts[r0][c]);
      const dV = new THREE.Vector3().subVectors(pts[r][c1], pts[r][c0]);
      const n = new THREE.Vector3().crossVectors(dU, dV);
      const pref = preferredDir(r, c, pts[r][c]);
      if (n.lengthSq() < 1e-10) {
        n.copy(pref);
      } else {
        n.normalize();
        if (n.dot(pref) < 0) n.negate();
      }
      rowN.push(n.normalize());
    }
    norms.push(rowN);
  }
  return norms;
}

/**
 * Closed lofted tube with per-ring cross-section modulation (e.g. fluted crest or oval)
 * and vertex-color ambient occlusion for `bone_sculpted`.
 */
function buildSculptedTube(
  stations: Array<{ pos: THREE.Vector3; rx: number; ry: number; ao?: number }>,
  mat: THREE.Material,
  radialSegs = 12,
  shapeMod?: (theta: number, u: number) => { sx: number; sy: number; aoMul?: number },
): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(stations.map((s) => s.pos));
  const uSegs = Math.max(8, (stations.length - 1) * 6);
  const positions: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const getStationVal = (u: number) => {
    const scaled = u * (stations.length - 1);
    const i0 = Math.min(stations.length - 2, Math.floor(scaled));
    const f = scaled - i0;
    const s0 = stations[i0];
    const s1 = stations[i0 + 1];
    return {
      rx: THREE.MathUtils.lerp(s0.rx, s1.rx, f),
      ry: THREE.MathUtils.lerp(s0.ry, s1.ry, f),
      ao: THREE.MathUtils.lerp(s0.ao ?? 0.9, s1.ao ?? 0.9, f),
    };
  };

  let prevBinorm = new THREE.Vector3(0, 0, 1);
  for (let i = 0; i <= uSegs; i++) {
    const u = i / uSegs;
    const center = curve.getPointAt(u);
    const tan = curve.getTangentAt(u).normalize();
    let norm = new THREE.Vector3().crossVectors(tan, prevBinorm);
    if (norm.lengthSq() < 1e-6) {
      const up = Math.abs(tan.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
      norm = new THREE.Vector3().crossVectors(tan, up);
    }
    norm.normalize();
    const binorm = new THREE.Vector3().crossVectors(norm, tan).normalize();
    prevBinorm = binorm;

    const { rx, ry, ao } = getStationVal(u);
    const endTaper = u === 0 || u === 1 ? 0.25 : 1.0;

    for (let j = 0; j <= radialSegs; j++) {
      const v = j / radialSegs;
      const theta = v * Math.PI * 2;
      const mod = shapeMod ? shapeMod(theta, u) : { sx: 1, sy: 1, aoMul: 1 };
      const localN = Math.cos(theta) * rx * mod.sx * endTaper;
      const localB = Math.sin(theta) * ry * mod.sy * endTaper;
      const p = center.clone().addScaledVector(norm, localN).addScaledVector(binorm, localB);
      positions.push(p.x, p.y, p.z);
      uvs.push(u, v);

      const [cr, cg, cb] = sampleAoColor(ao * (mod.aoMul ?? 1));
      colors.push(cr, cg, cb);
    }
  }

  const stride = radialSegs + 1;
  for (let i = 0; i < uSegs; i++) {
    for (let j = 0; j < radialSegs; j++) {
      const a = i * stride + j;
      const b = (i + 1) * stride + j;
      const c = (i + 1) * stride + (j + 1);
      const d = i * stride + (j + 1);
      indices.push(a, b, d, b, c, d);
    }
  }

  // Cap start and end
  const startCenterIdx = positions.length / 3;
  const pStart = curve.getPointAt(0);
  positions.push(pStart.x, pStart.y, pStart.z);
  uvs.push(0, 0.5);
  const [sr, sg, sb] = sampleAoColor((stations[0].ao ?? 0.85) * 0.9);
  colors.push(sr, sg, sb);
  for (let j = 0; j < radialSegs; j++) {
    indices.push(startCenterIdx, j + 1, j);
  }

  const endCenterIdx = positions.length / 3;
  const pEnd = curve.getPointAt(1);
  positions.push(pEnd.x, pEnd.y, pEnd.z);
  uvs.push(1, 0.5);
  const [er, eg, eb] = sampleAoColor((stations[stations.length - 1].ao ?? 0.85) * 0.9);
  colors.push(er, eg, eb);
  const lastRing = uSegs * stride;
  for (let j = 0; j < radialSegs; j++) {
    indices.push(endCenterIdx, lastRing + j, lastRing + j + 1);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.computeTangents();

  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function addVertexColorMesh(mesh: THREE.Mesh, ao: number): THREE.Mesh {
  applyAoVertexColors(mesh.geometry, ao);
  return mesh;
}

/**
 * Sculpted hypsodont equine cheek tooth (P2–M3): square-rectangular fluted prism
 * with longitudinal buccal ridges (parastyle/mesostyle/metastyle) and a recessed
 * dark enamel infundibulum fold on the occlusal table.
 */
function createHypsodontCheekTooth(
  pos: THREE.Vector3,
  lenX: number,
  heightY: number,
  widthZ: number,
  pitchZ: number,
  isUpper: boolean,
  sd: -1 | 1,
  teethMat: THREE.Material,
  darkCrownMat: THREE.Material,
): THREE.Group {
  const g = new THREE.Group();
  const rSegs = 20;
  const hSegs = 5;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let h = 0; h <= hSegs; h++) {
    const v = h / hSegs; // 0 = alveolar base, 1 = occlusal crown
    const yOff = (isUpper ? -v : v) * heightY;
    const taper = 1 - 0.06 * v;
    for (let j = 0; j <= rSegs; j++) {
      const u = j / rSegs;
      const theta = u * Math.PI * 2;
      const cT = Math.cos(theta);
      const sT = Math.sin(theta);
      // Rounded-square prism via superellipse + distinct vertical buccal ribs
      const superX = Math.sign(cT) * Math.pow(Math.abs(cT), 0.56);
      const superZ = Math.sign(sT) * Math.pow(Math.abs(sT), 0.56);
      const isBuccal = superZ * sd > 0.25;
      const styleRib = isBuccal
        ? (0.14 * Math.cos(superX * Math.PI * 2.2) + 0.08 * Math.cos(superX * Math.PI * 4.4)) * sd
        : 0.05 * Math.cos(superX * Math.PI * 2.0) * -sd;
      const lx = superX * lenX * 0.5 * taper;
      const lz = (superZ * widthZ * 0.5 + styleRib * widthZ * 0.5) * taper;
      positions.push(lx, yOff, lz);
      uvs.push(u, v);
    }
  }

  const stride = rSegs + 1;
  for (let h = 0; h < hSegs; h++) {
    for (let j = 0; j < rSegs; j++) {
      const a = h * stride + j;
      const b = a + 1;
      const d = (h + 1) * stride + j;
      const e = d + 1;
      if (isUpper) {
        indices.push(a, d, b, b, d, e);
      } else {
        indices.push(a, b, d, b, e, d);
      }
    }
  }

  // Occlusal cap & base cap
  const occlCenterIdx = positions.length / 3;
  const occlY = (isUpper ? -1 : 1) * heightY * 0.96; // subtle occlusal cup
  positions.push(0, occlY, 0);
  uvs.push(0.5, 1);
  const topRing = hSegs * stride;
  for (let j = 0; j < rSegs; j++) {
    if (isUpper) {
      indices.push(occlCenterIdx, topRing + j, topRing + j + 1);
    } else {
      indices.push(occlCenterIdx, topRing + j + 1, topRing + j);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const crown = new THREE.Mesh(geo, teethMat);
  crown.castShadow = true;
  crown.receiveShadow = true;
  g.add(crown);

  // Dark enamel infundibulum fold on the occlusal table (classic crescent marks)
  for (const xSub of [-0.24, 0.24]) {
    const fold = new THREE.Mesh(
      new THREE.BoxGeometry(lenX * 0.34, 0.0018, widthZ * 0.42),
      darkCrownMat,
    );
    fold.position.set(lenX * xSub, (isUpper ? -1 : 1) * (heightY - 0.0005), 0);
    g.add(fold);
  }

  g.position.copy(pos);
  g.rotation.z = pitchZ;
  g.rotation.x = 0.08 * sd;
  return g;
}

/**
 * Curved spade-shaped equine incisor (I1–I3) with occlusal enamel mark.
 */
function createEquineIncisorTooth(
  pos: THREE.Vector3,
  width: number,
  length: number,
  thickness: number,
  rotY: number,
  rotZ: number,
  isUpper: boolean,
  teethMat: THREE.Material,
  darkCrownMat: THREE.Material,
): THREE.Group {
  const g = new THREE.Group();
  const c = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(length * 0.42, (isUpper ? -1 : 1) * length * 0.38, 0),
    new THREE.Vector3(length * 0.62, (isUpper ? -1 : 1) * length * 0.88, 0),
  ]);
  const mesh = createTubeCurveMesh(
    [c.getPoint(0), c.getPoint(0.5), c.getPoint(1)],
    thickness * 0.52,
    teethMat,
    8,
    8,
  );
  mesh.scale.set(1, 1, width / Math.max(0.002, thickness));
  g.add(mesh);

  const cup = new THREE.Mesh(
    new THREE.CylinderGeometry(thickness * 0.38, thickness * 0.38, 0.0016, 8),
    darkCrownMat,
  );
  cup.position.set(length * 0.61, (isUpper ? -1 : 1) * length * 0.88, 0);
  cup.rotation.z = rotZ * 0.35;
  g.add(cup);

  g.position.copy(pos);
  g.rotation.set(0, rotY, rotZ);
  return g;
}

// --- Shared Equine Skull Suture & Landmark Curves ---

function orbitCenter(sd: -1 | 1): THREE.Vector3 {
  // Eyeball center is V3(1.195, 1.695, ±0.058), radii [0.016, 0.018, 0.015].
  // Rim sits around ±0.062 with inner radius ~0.023 so eyeball rests cleanly inside socket.
  return V3(1.195, 1.695, 0.062 * sd);
}

/**
 * Closed circular/slightly-oval bony orbit rim parametrized by angle `phi` in [0, 2*PI):
 * - phi = 0: rostromedial brow (frontal/lacrimal junction)
 * - phi = 0.25*PI: dorsal apex (frontal)
 * - phi = 0.52*PI: postorbital frontal/temporal suture
 * - phi = 0.88*PI: caudoventral temporal/zygomatic suture
 * - phi = 1.25*PI: ventral rim (zygomatic)
 * - phi = 1.60*PI: rostroventral lacrimal/zygomatic suture
 */
function orbitRimPoint(phi: number, sd: -1 | 1, radialOffset = 0): THREE.Vector3 {
  const c = orbitCenter(sd);
  const rx = 0.0305 + radialOffset;
  const ry = 0.0275 + radialOffset;
  // phi = 0 is rostral (+x), 0.5*PI is dorsal (+y), PI is caudal (-x), 1.5*PI is ventral (-y)
  const cosP = Math.cos(phi);
  const sinP = Math.sin(phi);
  const x = c.x + cosP * rx - sinP * 0.004;
  const y = c.y + sinP * ry + cosP * 0.004;
  // Rim sits laterally around the eye socket while hugging skull curvature cleanly
  const z = c.z + (0.005 * Math.sin(phi + 0.2) - 0.003 * Math.pow(cosP, 2)) * sd;
  return V3(x, y, z);
}

function nasomaxillarySuturePt(t: number, sd: -1 | 1): THREE.Vector3 {
  // Shared curve between Nasal (009) lateral margin and Maxilar (012) dorsal margin
  const p0 = V3(1.262, 1.644, 0.036 * sd);
  const p1 = V3(1.345, 1.578, 0.028 * sd);
  const p2 = V3(1.425, 1.500, 0.020 * sd);
  if (t < 0.5) return p0.clone().lerp(p1, t * 2);
  return p1.clone().lerp(p2, (t - 0.5) * 2);
}

function midlineBridgeY(x: number): number {
  // Smooth dorsal skull roof profile from nuchal crest (1.006) -> nasal tip (1.530)
  if (x <= 1.125) {
    const t = THREE.MathUtils.clamp((x - 1.006) / (1.125 - 1.006), 0, 1);
    return THREE.MathUtils.lerp(1.784, 1.762, Math.pow(t, 1.15));
  }
  if (x <= 1.262) {
    const t = THREE.MathUtils.clamp((x - 1.125) / (1.262 - 1.125), 0, 1);
    return THREE.MathUtils.lerp(1.762, 1.658, t) + Math.sin(t * Math.PI) * 0.008;
  }
  const t = THREE.MathUtils.clamp((x - 1.262) / (1.530 - 1.262), 0, 1);
  return THREE.MathUtils.lerp(1.658, 1.434, t) + Math.sin(t * Math.PI) * 0.006;
}

export function buildSculptedEquineSkullParts(ctx: SculptedSkullBuildContext): void {
  const { darkBoneMat, sculptedBoneMat, teethMat, push } = ctx;
  const sMat = () => sculptedBoneMat();
  const darkCrownMat = () => {
    const m = darkBoneMat() as THREE.MeshStandardMaterial;
    m.color.setHex(0x6c5e4b);
    m.roughness = 0.7;
    return m;
  };

  // =========================================================================
  // 1. MIDLINE & BASILAR CRANIAL BONES (center)
  // =========================================================================

  // --- equ.ske.cra.001: OCCIPITAL (Squama, Nuchal crest, Foramen magnum, Condyles, Paracondylar) ---
  {
    const occipGrp = new THREE.Group();
    const rSegs = 12; // dorsoventral: 0 = nuchal crest, 1 = supraoccipital / foramen magnum rim
    const cSegs = 14; // mediolateral: left (-z) -> right (+z)
    const pts: THREE.Vector3[][] = [];
    const thick: number[][] = [];
    const ao: number[][] = [];

    for (let r = 0; r <= rSegs; r++) {
      const u = r / rSegs;
      const rowP: THREE.Vector3[] = [];
      const rowT: number[] = [];
      const rowAo: number[] = [];
      for (let c = 0; c <= cSegs; c++) {
        const v = c / cSegs;
        const zNorm = (v - 0.5) * 2; // -1 .. +1
        const halfW = THREE.MathUtils.lerp(0.036, 0.044, Math.sin(u * Math.PI * 0.78));
        const z = zNorm * halfW;
        const crestSweepX = Math.pow(Math.abs(zNorm), 1.4) * 0.016;
        // Nuchal crest flares slightly caudally at midline (protuberantia occipitalis externa)
        const x =
          THREE.MathUtils.lerp(1.006, 1.036, Math.pow(u, 0.85)) +
          crestSweepX +
          (1 - u) * 0.004 * Math.abs(zNorm);
        const y =
          THREE.MathUtils.lerp(1.784, 1.694, u) -
          Math.pow(Math.abs(zNorm), 1.6) * (0.022 * (1 - u * 0.4));
        // Subtle nuchal depression flanking the midline external occipital crest
        const nuchalHollow = Math.sin(u * Math.PI) * Math.exp(-Math.pow((Math.abs(zNorm) - 0.45) / 0.25, 2));
        rowP.push(V3(x + nuchalHollow * 0.005, y, z));
        rowT.push(0.0055 + (1 - u) * 0.004);
        rowAo.push(0.95 - 0.24 * nuchalHollow - 0.14 * u * (1 - Math.abs(zNorm)));
      }
      pts.push(rowP);
      thick.push(rowT);
      ao.push(rowAo);
    }
    const norms = computeGridNormals(pts, (_r, _c, p) =>
      V3(-0.88, p.y > 1.75 ? 0.35 : -0.15, p.z * 5.0).normalize(),
    );
    occipGrp.add(buildSculptedBonePlateMesh(pts, norms, thick, ao, sMat(), 0.35));

    // Prominent overhanging Nuchal Crest (crista nuchae)
    occipGrp.add(
      buildSculptedTube(
        [
          { pos: V3(1.028, 1.744, -0.040), rx: 0.006, ry: 0.008, ao: 0.92 },
          { pos: V3(1.011, 1.772, -0.022), rx: 0.007, ry: 0.009, ao: 0.96 },
          { pos: V3(1.004, 1.784, 0), rx: 0.009, ry: 0.011, ao: 1.0 },
          { pos: V3(1.011, 1.772, 0.022), rx: 0.007, ry: 0.009, ao: 0.96 },
          { pos: V3(1.028, 1.744, 0.040), rx: 0.006, ry: 0.008, ao: 0.92 },
        ],
        sMat(),
        10,
      ),
    );

    // Foramen magnum bony ring + bilateral Occipital Condyles + Paracondylar Processes
    occipGrp.add(
      addVertexColorMesh(
        createTubeCurveMesh(
          [
            V3(1.028, 1.716, 0),
            V3(1.024, 1.704, 0.014),
            V3(1.026, 1.690, 0),
            V3(1.024, 1.704, -0.014),
            V3(1.028, 1.716, 0),
          ],
          0.0045,
          sMat(),
          12,
          7,
        ),
        0.74,
      ),
    );
    for (const sd of [-1, 1] as const) {
      // Smooth articular occipital condyle
      occipGrp.add(
        addVertexColorMesh(
          createOrganMesh(V3(1.018, 1.702, 0.020 * sd), [0.014, 0.013, 0.010], sMat(), [0.2 * sd, 0.25 * sd, -0.25], 12),
          0.92,
        ),
      );
      // Long tapering paracondylar (jugular) process pointing ventrally
      occipGrp.add(
        buildSculptedTube(
          [
            { pos: V3(1.025, 1.712, 0.036 * sd), rx: 0.009, ry: 0.007, ao: 0.88 },
            { pos: V3(1.022, 1.682, 0.039 * sd), rx: 0.0075, ry: 0.0055, ao: 0.93 },
            { pos: V3(1.014, 1.652, 0.038 * sd), rx: 0.0045, ry: 0.0035, ao: 0.96 },
          ],
          sMat(),
          10,
        ),
      );
    }
    push('equ.ske.cra.001', occipGrp, 'center');
  }

  // --- equ.ske.cra.018: BASIOCCIPITAL (Basilar part + Muscular tubercles) ---
  {
    const basiGrp = new THREE.Group();
    basiGrp.add(
      buildSculptedTube(
        [
          { pos: V3(1.032, 1.694, 0), rx: 0.018, ry: 0.009, ao: 0.86 },
          { pos: V3(1.058, 1.684, 0), rx: 0.016, ry: 0.010, ao: 0.92 },
          { pos: V3(1.086, 1.674, 0), rx: 0.014, ry: 0.009, ao: 0.88 },
        ],
        sMat(),
        12,
      ),
    );
    for (const sd of [-1, 1] as const) {
      basiGrp.add(
        addVertexColorMesh(
          createOrganMesh(V3(1.068, 1.674, 0.010 * sd), [0.012, 0.006, 0.006], sMat(), [0, 0, -0.25], 10),
          0.92,
        ),
      );
    }
    push('equ.ske.cra.018', basiGrp, 'center');
  }

  // --- equ.ske.cra.002: BASISFENOIDES (Body + Temporal wings) ---
  {
    const bsfGrp = new THREE.Group();
    bsfGrp.add(
      buildSculptedTube(
        [
          { pos: V3(1.086, 1.674, 0), rx: 0.016, ry: 0.010, ao: 0.84 },
          { pos: V3(1.118, 1.664, 0), rx: 0.018, ry: 0.012, ao: 0.88 },
          { pos: V3(1.148, 1.652, 0), rx: 0.015, ry: 0.011, ao: 0.84 },
        ],
        sMat(),
        12,
      ),
    );
    for (const sd of [-1, 1] as const) {
      bsfGrp.add(
        buildSculptedTube(
          [
            { pos: V3(1.116, 1.664, 0.012 * sd), rx: 0.011, ry: 0.007, ao: 0.80 },
            { pos: V3(1.132, 1.668, 0.028 * sd), rx: 0.012, ry: 0.007, ao: 0.84 },
            { pos: V3(1.145, 1.674, 0.040 * sd), rx: 0.009, ry: 0.006, ao: 0.76 },
          ],
          sMat(),
          10,
        ),
      );
    }
    push('equ.ske.cra.002', bsfGrp, 'center');
  }

  // --- equ.ske.cra.003: PRESFENOIDES (Rostral sphenoid body + Orbital wings) ---
  {
    const psfGrp = new THREE.Group();
    psfGrp.add(
      buildSculptedTube(
        [
          { pos: V3(1.146, 1.652, 0), rx: 0.016, ry: 0.012, ao: 0.82 },
          { pos: V3(1.172, 1.642, 0), rx: 0.015, ry: 0.012, ao: 0.84 },
          { pos: V3(1.198, 1.632, 0), rx: 0.013, ry: 0.010, ao: 0.78 },
        ],
        sMat(),
        12,
      ),
    );
    for (const sd of [-1, 1] as const) {
      psfGrp.add(
        buildSculptedTube(
          [
            { pos: V3(1.168, 1.644, 0.010 * sd), rx: 0.010, ry: 0.007, ao: 0.76 },
            { pos: V3(1.182, 1.656, 0.026 * sd), rx: 0.011, ry: 0.007, ao: 0.74 },
          ],
          sMat(),
          10,
        ),
      );
    }
    push('equ.ske.cra.003', psfGrp, 'center');
  }

  // --- equ.ske.cra.004: ETMOIDES (Cribriform plate & Ethmoidal labyrinth) ---
  {
    const ethGrp = new THREE.Group();
    ethGrp.add(
      buildSculptedTube(
        [
          { pos: V3(1.188, 1.640, 0), rx: 0.024, ry: 0.019, ao: 0.70 },
          { pos: V3(1.224, 1.622, 0), rx: 0.022, ry: 0.018, ao: 0.76 },
          { pos: V3(1.252, 1.606, 0), rx: 0.016, ry: 0.014, ao: 0.72 },
        ],
        sMat(),
        12,
      ),
    );
    push('equ.ske.cra.004', ethGrp, 'center');
  }

  // --- equ.ske.cra.005: INTERPARIETAL (Keystone roof + Sharp External Sagittal Crest) ---
  {
    const rSegs = 10;
    const cSegs = 8;
    const pts: THREE.Vector3[][] = [];
    const thick: number[][] = [];
    const ao: number[][] = [];
    for (let r = 0; r <= rSegs; r++) {
      const u = r / rSegs; // 0 = caudal nuchal junction, 1 = rostral bifurcation
      const x = THREE.MathUtils.lerp(1.012, 1.132, u);
      const yMid = midlineBridgeY(x);
      // Narrow caudally, triangular flare rostrally
      const halfW = THREE.MathUtils.lerp(0.008, 0.026, Math.sin(u * Math.PI * 0.85));
      const rowP: THREE.Vector3[] = [];
      const rowT: number[] = [];
      const rowAo: number[] = [];
      for (let c = 0; c <= cSegs; c++) {
        const v = c / cSegs;
        const zNorm = (v - 0.5) * 2;
        const absZ = Math.abs(zNorm);
        // Distinct raised sagittal keel along z=0
        const crestH = (1 - Math.pow(absZ, 0.65)) * THREE.MathUtils.lerp(0.0085, 0.0025, u);
        const dropY = Math.pow(absZ, 1.4) * 0.008;
        rowP.push(V3(x, yMid + crestH - dropY, zNorm * halfW));
        rowT.push(0.0045 + (1 - absZ) * 0.003);
        rowAo.push(0.98 - 0.16 * absZ);
      }
      pts.push(rowP);
      thick.push(rowT);
      ao.push(rowAo);
    }
    const norms = computeGridNormals(pts, (_r, _c, p) => V3(0.15, 0.98, p.z * 6).normalize());
    push('equ.ske.cra.005', buildSculptedBonePlateMesh(pts, norms, thick, ao, sMat(), 0.32), 'center');
  }

  // --- equ.ske.cra.016: VÓMER (Midline sagittal choanal septum blade) ---
  {
    const rSegs = 12;
    const cSegs = 5;
    const pts: THREE.Vector3[][] = [];
    const thick: number[][] = [];
    const ao: number[][] = [];
    for (let r = 0; r <= rSegs; r++) {
      const u = r / rSegs;
      const x = THREE.MathUtils.lerp(1.172, 1.448, u);
      const yTop = THREE.MathUtils.lerp(1.630, 1.462, u);
      const yBot = THREE.MathUtils.lerp(1.588, 1.434, u);
      const rowP: THREE.Vector3[] = [];
      const rowT: number[] = [];
      const rowAo: number[] = [];
      for (let c = 0; c <= cSegs; c++) {
        const v = c / cSegs;
        rowP.push(V3(x, THREE.MathUtils.lerp(yTop, yBot, v), 0));
        rowT.push(0.0024 + (1 - v) * 0.0014);
        rowAo.push(0.70 + 0.14 * v);
      }
      pts.push(rowP);
      thick.push(rowT);
      ao.push(rowAo);
    }
    const norms = computeGridNormals(pts, () => V3(0, 0, 1));
    push('equ.ske.cra.016', buildSculptedBonePlateMesh(pts, norms, thick, ao, sMat(), 0.4), 'center');
  }

  // =========================================================================
  // 2. PAIRED CRANIAL & FACIAL BONES (-i left, -d right)
  // =========================================================================

  for (const sd of [-1, 1] as const) {
    const tag = sd === -1 ? 'i' : 'd';
    const side = sd === -1 ? 'left' : 'right';

    // --- equ.ske.cra.006-i/d: PARIETAL (Rounded braincase roof + Temporal line + Temporal fossa) ---
    {
      const rSegs = 12; // caudorostral: 1.032 -> 1.166
      const cSegs = 10; // dorsomedial crest -> ventrolateral squamous suture
      const pts: THREE.Vector3[][] = [];
      const thick: number[][] = [];
      const ao: number[][] = [];

      for (let r = 0; r <= rSegs; r++) {
        const u = r / rSegs;
        const x = THREE.MathUtils.lerp(1.028, 1.164, u);
        const yMed = midlineBridgeY(x);
        // Medial edge hugs Interparietal early, then meets midline/frontal rostrally
        const zMed = (u < 0.72 ? THREE.MathUtils.lerp(0.007, 0.022, Math.sin((u / 0.72) * Math.PI * 0.75)) : THREE.MathUtils.lerp(0.018, 0.004, (u - 0.72) / 0.28)) * sd;
        const tempLineZ = THREE.MathUtils.lerp(0.012, 0.038, Math.pow(u, 0.9)) * sd;
        const pMed = V3(x, yMed - 0.003, zMed);
        const pMid = V3(x, yMed - 0.024 - 0.008 * Math.sin(u * Math.PI), tempLineZ + 0.014 * Math.sin(u * Math.PI) * sd);
        const pLat = V3(x, THREE.MathUtils.lerp(1.708, 1.694, u), THREE.MathUtils.lerp(0.042, 0.046, Math.sin(u * Math.PI)) * sd);

        const rowP: THREE.Vector3[] = [];
        const rowT: number[] = [];
        const rowAo: number[] = [];
        for (let c = 0; c <= cSegs; c++) {
          const v = c / cSegs;
          const base = v < 0.45
            ? pMed.clone().lerp(pMid, v / 0.45)
            : pMid.clone().lerp(pLat, (v - 0.45) / 0.55);
          // Concave temporal fossa scoop in the caudolateral parietal wall
          const fossaBell = Math.sin(u * Math.PI) * Math.exp(-Math.pow((v - 0.65) / 0.28, 2));
          base.z -= fossaBell * 0.007 * sd;
          // Raised crisp temporal line ridge around v ~ 0.34
          const tempRidge = Math.exp(-Math.pow((v - 0.34) / 0.11, 2)) * (0.25 + 0.75 * u);
          base.y += tempRidge * 0.003;
          base.z += tempRidge * 0.0025 * sd;
          rowP.push(base);
          rowT.push(0.0042 + 0.0018 * tempRidge);
          rowAo.push(0.92 - 0.22 * fossaBell + 0.06 * tempRidge);
        }
        pts.push(rowP);
        thick.push(rowT);
        ao.push(rowAo);
      }
      const norms = computeGridNormals(pts, (_r, c) =>
        V3(0.05, 1.0 - c / 12, (0.35 + (c / 10) * 0.65) * sd).normalize(),
      );
      push(`equ.ske.cra.006-${tag}`, buildSculptedBonePlateMesh(pts, norms, thick, ao, sMat()), side);
    }

    // --- equ.ske.cra.007-i/d: FRONTAL (Broad forehead shield + Supraorbital arch + Deep medial orbit cup) ---
    {
      const frontGrp = new THREE.Group();

      // 7A. Broad forehead & supraorbital roof plate
      const rSegs = 12; // caudorostral: 1.124 -> 1.272
      const cSegs = 10; // medial suture -> supraorbital rim / temporal wing
      const pts: THREE.Vector3[][] = [];
      const thick: number[][] = [];
      const ao: number[][] = [];

      for (let r = 0; r <= rSegs; r++) {
        const u = r / rSegs;
        const x = THREE.MathUtils.lerp(1.124, 1.272, u);
        const yMed = midlineBridgeY(x);
        const pMed = V3(x, yMed, 0.0012 * sd);
        // Lateral border: sweeps out across supraorbital rim (u ~ 0.35..0.72), narrows back to lacrimal/nasal
        let pLat: THREE.Vector3;
        if (u < 0.35) {
          const t = u / 0.35;
          pLat = V3(x, THREE.MathUtils.lerp(1.702, 1.703, t), THREE.MathUtils.lerp(0.044, 0.061, t) * sd);
        } else if (u < 0.72) {
          const t = (u - 0.35) / 0.37;
          const phi = THREE.MathUtils.lerp(0.84 * Math.PI, 0.12 * Math.PI, t);
          pLat = orbitRimPoint(phi, sd, 0.001);
        } else {
          const t = (u - 0.72) / 0.28;
          pLat = orbitRimPoint(0.12 * Math.PI, sd).lerp(V3(1.268, 1.646, 0.036 * sd), t);
        }

        const rowP: THREE.Vector3[] = [];
        const rowT: number[] = [];
        const rowAo: number[] = [];
        for (let c = 0; c <= cSegs; c++) {
          const v = c / cSegs;
          const p = pMed.clone().lerp(pLat, v);
          // Broad equine forehead dome + subtle depression above nasal base & supraorbital foramen dimple
          p.y += Math.sin(v * Math.PI * 0.8) * Math.sin(u * Math.PI) * 0.004;
          const foramDist = Math.hypot(u - 0.48, v - 0.68);
          const foramDimple = Math.exp(-Math.pow(foramDist / 0.13, 2));
          p.y -= foramDimple * 0.0025;
          rowP.push(p);
          rowT.push(0.0048 + (v > 0.7 ? 0.002 : 0));
          rowAo.push(0.95 - 0.20 * foramDimple);
        }
        pts.push(rowP);
        thick.push(rowT);
        ao.push(rowAo);
      }
      const norms = computeGridNormals(pts, (_r, c) =>
        V3(0.25, 0.92, (0.2 + (c / 10) * 0.6) * sd).normalize(),
      );
      frontGrp.add(buildSculptedBonePlateMesh(pts, norms, thick, ao, sMat()));

      // 7B. Zygomatic process of frontal + sculpted supraorbital rim arch (dorsal/caudodorsal orbit)
      const rimPts: Array<{ pos: THREE.Vector3; rx: number; ry: number; ao?: number }> = [];
      for (let k = 0; k <= 6; k++) {
        const phi = THREE.MathUtils.lerp(0.12 * Math.PI, 0.86 * Math.PI, k / 6);
        rimPts.push({
          pos: orbitRimPoint(phi, sd),
          rx: 0.0055 + 0.0018 * Math.sin((k / 6) * Math.PI),
          ry: 0.0068 + 0.0015 * Math.sin((k / 6) * Math.PI),
          ao: 0.96,
        });
      }
      frontGrp.add(buildSculptedTube(rimPts, sMat(), 10));

      // 7C. Medial orbital wall cup (concave bowl curving cleanly medial to eyeball to z = 0.022*sd)
      const cupR = 7;
      const cupC = 6;
      const cupPts: THREE.Vector3[][] = [];
      const cupThick: number[][] = [];
      const cupAo: number[][] = [];
      const deepFloor = V3(1.186, 1.688, 0.022 * sd);
      for (let r = 0; r <= cupR; r++) {
        const phi = THREE.MathUtils.lerp(0.10 * Math.PI, 0.86 * Math.PI, r / cupR);
        const rim = orbitRimPoint(phi, sd, 0.001);
        const rowP: THREE.Vector3[] = [];
        const rowT: number[] = [];
        const rowAo: number[] = [];
        for (let c = 0; c <= cupC; c++) {
          const v = c / cupC;
          const p = V3(
            THREE.MathUtils.lerp(rim.x, deepFloor.x, Math.pow(v, 1.35)),
            THREE.MathUtils.lerp(rim.y, deepFloor.y, Math.pow(v, 1.35)),
            THREE.MathUtils.lerp(rim.z, deepFloor.z, Math.pow(v, 0.45)),
          );
          rowP.push(p);
          rowT.push(0.0030);
          rowAo.push(THREE.MathUtils.lerp(0.88, 0.22, Math.pow(v, 0.8)));
        }
        cupPts.push(rowP);
        cupThick.push(rowT);
        cupAo.push(rowAo);
      }
      const cupNorms = computeGridNormals(cupPts, () => V3(-0.2, -0.25, sd).normalize());
      frontGrp.add(buildSculptedBonePlateMesh(cupPts, cupNorms, cupThick, cupAo, sMat(), 0.35, 0.75));

      push(`equ.ske.cra.007-${tag}`, frontGrp, side);
    }

    // --- equ.ske.cra.008-i/d: TEMPORAL (Squamous plate + Zygomatic arch + TMJ fossa + Ear meatus + Bulla) ---
    {
      const tempGrp = new THREE.Group();

      // 8A. Squamous temporal wall forming ventrolateral braincase
      const rSegs = 9;
      const cSegs = 6;
      const pts: THREE.Vector3[][] = [];
      const thick: number[][] = [];
      const ao: number[][] = [];
      for (let r = 0; r <= rSegs; r++) {
        const u = r / rSegs;
        const x = THREE.MathUtils.lerp(1.036, 1.158, u);
        const pTop = V3(x, THREE.MathUtils.lerp(1.710, 1.694, u), THREE.MathUtils.lerp(0.042, 0.044, Math.sin(u * Math.PI)) * sd);
        const pBot = V3(x, THREE.MathUtils.lerp(1.664, 1.656, u), THREE.MathUtils.lerp(0.038, 0.036, u) * sd);
        const rowP: THREE.Vector3[] = [];
        const rowT: number[] = [];
        const rowAo: number[] = [];
        for (let c = 0; c <= cSegs; c++) {
          const v = c / cSegs;
          const p = pTop.clone().lerp(pBot, v);
          p.z += Math.sin(u * Math.PI) * Math.sin(v * Math.PI) * 0.004 * sd;
          rowP.push(p);
          rowT.push(0.0042);
          rowAo.push(0.84 - 0.18 * Math.sin(u * Math.PI) * (1 - v));
        }
        pts.push(rowP);
        thick.push(rowT);
        ao.push(rowAo);
      }
      const norms = computeGridNormals(pts, () => V3(0, 0.1, sd).normalize());
      tempGrp.add(buildSculptedBonePlateMesh(pts, norms, thick, ao, sMat()));

      // 8B. Sweeping Zygomatic Process closing caudal postorbital bar + arching over hollow temporal fossa
      tempGrp.add(
        buildSculptedTube(
          [
            { pos: orbitRimPoint(0.84 * Math.PI, sd), rx: 0.0055, ry: 0.007, ao: 0.94 },
            { pos: orbitRimPoint(1.05 * Math.PI, sd), rx: 0.006, ry: 0.0075, ao: 0.95 },
            { pos: orbitRimPoint(1.24 * Math.PI, sd), rx: 0.006, ry: 0.007, ao: 0.94 },
            { pos: V3(1.132, 1.674, 0.064 * sd), rx: 0.0065, ry: 0.0085, ao: 0.96 },
            { pos: V3(1.084, 1.678, 0.056 * sd), rx: 0.0075, ry: 0.009, ao: 0.94 },
            { pos: V3(1.052, 1.686, 0.048 * sd), rx: 0.0065, ry: 0.0075, ao: 0.88 },
          ],
          sMat(),
          10,
        ),
      );

      // 8C. Articular tubercle / Mandibular fossa (TMJ socket) + Retroarticular process
      tempGrp.add(
        addVertexColorMesh(
          createOrganMesh(V3(1.082, 1.666, 0.053 * sd), [0.014, 0.007, 0.011], sMat(), [0, 0, -0.1], 10),
          0.86,
        ),
      );
      tempGrp.add(
        buildSculptedTube(
          [
            { pos: V3(1.070, 1.672, 0.052 * sd), rx: 0.005, ry: 0.006, ao: 0.88 },
            { pos: V3(1.066, 1.656, 0.050 * sd), rx: 0.0045, ry: 0.0045, ao: 0.82 },
          ],
          sMat(),
          8,
        ),
      );

      // 8D. External acoustic meatus (ear canal ring) + Tympanic bulla
      tempGrp.add(
        addVertexColorMesh(
          createTubeCurveMesh(
            [
              V3(1.052, 1.684, 0.044 * sd),
              V3(1.056, 1.680, 0.056 * sd),
            ],
            0.0052,
            sMat(),
            6,
            10,
          ),
          0.72,
        ),
      );
      tempGrp.add(
        addVertexColorMesh(
          createOrganMesh(V3(1.064, 1.670, 0.036 * sd), [0.013, 0.010, 0.009], sMat(), [0, 0, 0], 10),
          0.78,
        ),
      );

      push(`equ.ske.cra.008-${tag}`, tempGrp, side);
    }

    // --- equ.ske.cra.009-i/d: NASAL (Vaulted nasal roof + Pointed rostral nasal spine) ---
    {
      const rSegs = 16; // 1.258 -> 1.530
      const cSegs = 7;  // midline -> lateral suture / notch rim
      const pts: THREE.Vector3[][] = [];
      const thick: number[][] = [];
      const ao: number[][] = [];

      for (let r = 0; r <= rSegs; r++) {
        const u = r / rSegs;
        const x = THREE.MathUtils.lerp(1.258, 1.530, u);
        const yMid = midlineBridgeY(x);
        const pMed = V3(x, yMid, 0.0012 * sd);

        let pLat: THREE.Vector3;
        if (u < 0.62) {
          // Meets nasomaxillary suture
          pLat = nasomaxillarySuturePt(u / 0.62, sd);
        } else {
          // Free tapering rostral nasal process forming crisp overhanging nasal spine!
          const t = (u - 0.62) / 0.38;
          const pNotchApex = nasomaxillarySuturePt(1, sd);
          const pTip = V3(1.530, 1.434, 0.002 * sd);
          pLat = pNotchApex.clone().lerp(pTip, Math.pow(t, 0.85));
          // Slightly arched ventral margin of nasal spine
          pLat.y += Math.sin(t * Math.PI) * 0.006;
        }

        const rowP: THREE.Vector3[] = [];
        const rowT: number[] = [];
        const rowAo: number[] = [];
        for (let c = 0; c <= cSegs; c++) {
          const v = c / cSegs;
          const p = pMed.clone().lerp(pLat, v);
          // Smooth arched nasal dorsum cross-section
          p.y += Math.sin(v * Math.PI) * (0.0055 * (1 - 0.65 * u));
          rowP.push(p);
          rowT.push(THREE.MathUtils.lerp(0.0040, 0.0018, u));
          rowAo.push(0.96 - 0.10 * v * (1 - u * 0.4));
        }
        pts.push(rowP);
        thick.push(rowT);
        ao.push(rowAo);
      }
      const norms = computeGridNormals(pts, () => V3(0.45, 0.85, 0.35 * sd).normalize());
      push(`equ.ske.cra.009-${tag}`, buildSculptedBonePlateMesh(pts, norms, thick, ao, sMat()), side);
    }

    // --- equ.ske.cra.010-i/d: LAGRIMAL (Rostral orbital rim + Lacrimal tubercle + Deep orbital wall) ---
    {
      const lacGrp = new THREE.Group();
      const rSegs = 8;
      const cSegs = 8;
      const pts: THREE.Vector3[][] = [];
      const thick: number[][] = [];
      const ao: number[][] = [];
      const deepFloor = V3(1.202, 1.688, 0.025 * sd);

      for (let r = 0; r <= rSegs; r++) {
        const u = r / rSegs;
        const phi = THREE.MathUtils.lerp(1.78 * Math.PI, 2.13 * Math.PI, u);
        const pRim = orbitRimPoint(phi, sd, 0.001);
        // Facial plate extends rostrally from rim to lacrimal-nasal-maxillary suture
        const pFace = pRim
          .clone()
          .add(new THREE.Vector3(0.032, -0.018, -0.018 * sd))
          .lerp(V3(1.258, 1.644, 0.038 * sd), 0.35);
        const rowP: THREE.Vector3[] = [];
        const rowT: number[] = [];
        const rowAo: number[] = [];
        for (let c = 0; c <= cSegs; c++) {
          const v = c / cSegs; // 0 = rostral facial plate, 0.45 = orbital rim, 1 = deep medial orbital wall
          let p: THREE.Vector3;
          if (v < 0.45) {
            p = pFace.clone().lerp(pRim, v / 0.45);
          } else {
            const cv = (v - 0.45) / 0.55;
            p = V3(
              THREE.MathUtils.lerp(pRim.x, deepFloor.x, Math.pow(cv, 1.35)),
              THREE.MathUtils.lerp(pRim.y, deepFloor.y, Math.pow(cv, 1.35)),
              THREE.MathUtils.lerp(pRim.z, deepFloor.z, Math.pow(cv, 0.45)),
            );
          }
          rowP.push(p);
          rowT.push(v > 0.35 && v < 0.55 ? 0.0050 : 0.0030);
          rowAo.push(v < 0.5 ? 0.92 : THREE.MathUtils.lerp(0.88, 0.22, (v - 0.5) / 0.5));
        }
        pts.push(rowP);
        thick.push(rowT);
        ao.push(rowAo);
      }
      const norms = computeGridNormals(pts, (_r, c) =>
        c < 4 ? V3(0.35, 0.45, sd).normalize() : V3(-0.35, 0.1, sd).normalize(),
      );
      lacGrp.add(buildSculptedBonePlateMesh(pts, norms, thick, ao, sMat()));

      // Distinct lacrimal tubercle on rostral orbital rim
      lacGrp.add(
        addVertexColorMesh(
          createOrganMesh(orbitRimPoint(1.96 * Math.PI, sd, 0.002), [0.005, 0.005, 0.005], sMat(), undefined, 8),
          0.98,
        ),
      );
      push(`equ.ske.cra.010-${tag}`, lacGrp, side);
    }

    // --- equ.ske.cra.011-i/d: CIGOMÁTICO (Ventral orbital rim + Zygomatic bridge + Caudal facial crest) ---
    {
      const zygGrp = new THREE.Group();
      const rSegs = 10; // caudal temporal suture -> rostral malar/maxillary junction
      const cSegs = 6;  // orbital rim -> ventral cheek border / facial crest
      const pts: THREE.Vector3[][] = [];
      const thick: number[][] = [];
      const ao: number[][] = [];

      for (let r = 0; r <= rSegs; r++) {
        const u = r / rSegs;
        const phi = THREE.MathUtils.lerp(1.22 * Math.PI, 1.80 * Math.PI, u);
        const pRim = orbitRimPoint(phi, sd, 0.001);
        // Ventral border sweeps forward into the caudal root of the facial crest
        const pVent = V3(
          THREE.MathUtils.lerp(1.162, 1.252, u),
          THREE.MathUtils.lerp(1.656, 1.608, u),
          THREE.MathUtils.lerp(0.062, 0.056, u) * sd,
        );
        const rowP: THREE.Vector3[] = [];
        const rowT: number[] = [];
        const rowAo: number[] = [];
        for (let c = 0; c <= cSegs; c++) {
          const v = c / cSegs;
          const p = pRim.clone().lerp(pVent, v);
          // Raised facial crest ridge along ventral zygomatic border
          const crestRidge = Math.pow(v, 1.4) * Math.sin(u * Math.PI * 0.9);
          p.z += crestRidge * 0.004 * sd;
          rowP.push(p);
          rowT.push(0.0042 + 0.0018 * (1 - v));
          rowAo.push(0.95 - 0.12 * (1 - crestRidge));
        }
        pts.push(rowP);
        thick.push(rowT);
        ao.push(rowAo);
      }
      const norms = computeGridNormals(pts, () => V3(0.15, -0.25, sd).normalize());
      zygGrp.add(buildSculptedBonePlateMesh(pts, norms, thick, ao, sMat()));
      push(`equ.ske.cra.011-${tag}`, zygGrp, side);
    }

    // --- equ.ske.cra.012-i/d: MAXILAR (Facial wall + Prominent Facial Crest + Infraorbital dimple + Palate + P2-M3) ---
    {
      const maxGrp = new THREE.Group();

      // 12A. Sculpted lateral maxillary wall from nasomaxillary suture to alveolar rim & diastema
      const rSegs = 16; // caudorostral: 1.218 -> 1.456
      const cSegs = 10; // dorsal suture -> ventral alveolar margin
      const pts: THREE.Vector3[][] = [];
      const thick: number[][] = [];
      const ao: number[][] = [];

      for (let r = 0; r <= rSegs; r++) {
        const u = r / rSegs;
        const x = THREE.MathUtils.lerp(1.218, 1.456, u);
        // Dorsal edge: meets lacrimal/zygomatic early, then follows shared nasomaxillary suture, then incisive suture
        let pDor: THREE.Vector3;
        if (u < 0.22) {
          pDor = V3(x, THREE.MathUtils.lerp(1.656, 1.644, u / 0.22), THREE.MathUtils.lerp(0.048, 0.036, u / 0.22) * sd);
        } else if (u < 0.86) {
          pDor = nasomaxillarySuturePt((u - 0.22) / 0.64, sd);
        } else {
          const t = (u - 0.86) / 0.14;
          pDor = nasomaxillarySuturePt(1, sd).lerp(V3(1.456, 1.452, 0.022 * sd), t);
        }

        // Ventral alveolar margin (wider along cheek teeth u=0..0.58, tapering neatly into diastema u=0.58..1)
        const pAlv = V3(
          x,
          THREE.MathUtils.lerp(1.522, 1.416, u) - (u > 0.58 ? Math.sin(((u - 0.58) / 0.42) * Math.PI) * 0.012 : 0),
          THREE.MathUtils.lerp(0.040, 0.020, Math.pow(u, 1.1)) * sd,
        );

        const rowP: THREE.Vector3[] = [];
        const rowT: number[] = [];
        const rowAo: number[] = [];
        for (let c = 0; c <= cSegs; c++) {
          const v = c / cSegs;
          const p = pDor.clone().lerp(pAlv, v);
          // Bulging equine cheek wall over molar roots + subtle infraorbital concavity rostrally
          const cheekSwell = Math.sin(v * Math.PI * 0.9) * Math.sin(Math.min(1, u / 0.72) * Math.PI);
          p.z += cheekSwell * 0.014 * sd;

          // Prominent facial crest shelf peaking around u=0.15..0.54, v=0.45..0.58
          const crestU = u >= 0.08 && u <= 0.55 ? Math.sin(((u - 0.08) / 0.47) * Math.PI * 0.85) : 0;
          const crestV = Math.exp(-Math.pow((v - 0.52) / 0.14, 2));
          const crestAmp = crestU * crestV;
          p.z += crestAmp * 0.015 * sd;
          p.y -= crestAmp * 0.004;

          // Infraorbital hollow / foramen dimple just dorsal-rostral to the facial crest step
          const ioDist = Math.hypot(u - 0.62, v - 0.46);
          const ioHollow = Math.exp(-Math.pow(ioDist / 0.11, 2));
          p.z -= ioHollow * 0.005 * sd;

          // Scalloped alveolar root eminences above P2–M3
          const alvScallop = u < 0.58 && v > 0.8 ? Math.sin(u * Math.PI * 11) * (v - 0.8) * 5 * 0.0022 : 0;
          p.z += alvScallop * sd;

          rowP.push(p);
          rowT.push(0.005 + crestAmp * 0.003);
          rowAo.push(0.94 + crestAmp * 0.06 - ioHollow * 0.25 - (v > 0.88 ? 0.15 : 0));
        }
        pts.push(rowP);
        thick.push(rowT);
        ao.push(rowAo);
      }
      const norms = computeGridNormals(pts, () => V3(0.2, 0.25, sd).normalize());
      maxGrp.add(buildSculptedBonePlateMesh(pts, norms, thick, ao, sMat()));

      // 12B. Crisp projecting Facial Crest ridge ending abruptly above M1/P4
      maxGrp.add(
        buildSculptedTube(
          [
            { pos: V3(1.248, 1.610, 0.058 * sd), rx: 0.005, ry: 0.007, ao: 0.96 },
            { pos: V3(1.292, 1.568, 0.060 * sd), rx: 0.0065, ry: 0.0085, ao: 1.0 },
            { pos: V3(1.334, 1.526, 0.055 * sd), rx: 0.006, ry: 0.008, ao: 0.98 },
            { pos: V3(1.348, 1.512, 0.046 * sd), rx: 0.0045, ry: 0.0055, ao: 0.88 },
          ],
          sMat(),
          10,
        ),
      );

      // 12C. Horizontal vaulted Hard Palate plate (palatine process of maxilla)
      const palR = 10;
      const palC = 5;
      const palPts: THREE.Vector3[][] = [];
      const palThick: number[][] = [];
      const palAo: number[][] = [];
      for (let r = 0; r <= palR; r++) {
        const u = r / palR;
        const x = THREE.MathUtils.lerp(1.258, 1.454, u);
        const pLat = V3(x, THREE.MathUtils.lerp(1.516, 1.418, u), THREE.MathUtils.lerp(0.034, 0.018, u) * sd);
        const pMed = V3(x, THREE.MathUtils.lerp(1.528, 1.428, u), 0.0015 * sd);
        const rowP: THREE.Vector3[] = [];
        const rowT: number[] = [];
        const rowAo: number[] = [];
        for (let c = 0; c <= palC; c++) {
          const v = c / palC;
          const p = pLat.clone().lerp(pMed, v);
          p.y += Math.sin(v * Math.PI * 0.7) * 0.006; // arched palate vault
          rowP.push(p);
          rowT.push(0.0034);
          rowAo.push(THREE.MathUtils.lerp(0.68, 0.82, v));
        }
        palPts.push(rowP);
        palThick.push(rowT);
        palAo.push(rowAo);
      }
      const palNorms = computeGridNormals(palPts, () => V3(-0.35, -0.9, 0).normalize());
      maxGrp.add(buildSculptedBonePlateMesh(palPts, palNorms, palThick, palAo, sMat(), 0.35));

      // 12D. 6 Upper Hypsodont Cheek Teeth (M3 -> P2)
      const upperToothCount = 6;
      for (let m = 0; m < upperToothCount; m++) {
        const mt = m / (upperToothCount - 1); // 0 = caudal M3, 1 = rostral P2
        const pos = V3(
          THREE.MathUtils.lerp(1.226, 1.350, mt),
          THREE.MathUtils.lerp(1.522, 1.458, mt),
          THREE.MathUtils.lerp(0.036, 0.029, mt) * sd,
        );
        const lenX = THREE.MathUtils.lerp(0.019, 0.022, Math.sin(mt * Math.PI * 0.7));
        maxGrp.add(
          createHypsodontCheekTooth(
            pos,
            lenX,
            0.022,
            0.016,
            -0.46,
            true,
            sd,
            teethMat(),
            darkCrownMat(),
          ),
        );
      }

      push(`equ.ske.cra.012-${tag}`, maxGrp, side);
    }

    // --- equ.ske.cra.013-i/d: INCISIVO (Premaxilla arch + Ascending nasal process + Canine + I1-I3) ---
    {
      const incGrp = new THREE.Group();

      // 13A. Rounded premaxillary body + alveolar arch meeting cleanly at midline
      incGrp.add(
        buildSculptedTube(
          [
            { pos: V3(1.452, 1.418, 0.019 * sd), rx: 0.011, ry: 0.013, ao: 0.90 },
            { pos: V3(1.494, 1.392, 0.018 * sd), rx: 0.012, ry: 0.013, ao: 0.94 },
            { pos: V3(1.528, 1.372, 0.012 * sd), rx: 0.011, ry: 0.012, ao: 0.96 },
            { pos: V3(1.536, 1.366, 0.002 * sd), rx: 0.008, ry: 0.009, ao: 0.92 },
          ],
          sMat(),
          12,
        ),
      );

      // 13B. Slender ascending Nasal Process bordering the open Nasoincisive Notch
      incGrp.add(
        buildSculptedTube(
          [
            { pos: V3(1.518, 1.386, 0.016 * sd), rx: 0.0055, ry: 0.007, ao: 0.94 },
            { pos: V3(1.472, 1.434, 0.019 * sd), rx: 0.005, ry: 0.0065, ao: 0.95 },
            { pos: V3(1.425, 1.496, 0.020 * sd), rx: 0.004, ry: 0.0055, ao: 0.90 },
          ],
          sMat(),
          10,
        ),
      );

      // 13C. Upper Canine (C1) in diastema + 3 curved upper incisors (I1, I2, I3)
      incGrp.add(
        addVertexColorMesh(
          createOrganMesh(V3(1.468, 1.404, 0.021 * sd), [0.0035, 0.0065, 0.0032], teethMat(), [0.2 * sd, 0, -0.5], 8),
          0.95,
        ),
      );
      for (let inc = 0; inc < 3; inc++) {
        const arcT = inc / 2; // 0 = central I1, 1 = corner I3
        const incPos = V3(
          THREE.MathUtils.lerp(1.536, 1.516, arcT),
          THREE.MathUtils.lerp(1.362, 1.374, arcT),
          THREE.MathUtils.lerp(0.005, 0.019, arcT) * sd,
        );
        incGrp.add(
          createEquineIncisorTooth(
            incPos,
            0.0072,
            0.015,
            0.0052,
            (0.15 + arcT * 0.45) * -sd,
            -0.38,
            true,
            teethMat(),
            darkCrownMat(),
          ),
        );
      }

      push(`equ.ske.cra.013-${tag}`, incGrp, side);
    }

    // --- equ.ske.cra.014-i/d: PALATINO (Caudal hard palate border + Choanal arch wall) ---
    {
      const rSegs = 8;
      const cSegs = 6;
      const pts: THREE.Vector3[][] = [];
      const thick: number[][] = [];
      const ao: number[][] = [];
      for (let r = 0; r <= rSegs; r++) {
        const u = r / rSegs;
        const x = THREE.MathUtils.lerp(1.190, 1.268, u);
        // Curves from lateral choanal wall down to horizontal palatine margin
        const pLat = V3(x, THREE.MathUtils.lerp(1.592, 1.522, u), THREE.MathUtils.lerp(0.026, 0.032, u) * sd);
        const pMed = V3(x, THREE.MathUtils.lerp(1.610, 1.532, u), THREE.MathUtils.lerp(0.018, 0.003, Math.pow(u, 1.5)) * sd);
        const rowP: THREE.Vector3[] = [];
        const rowT: number[] = [];
        const rowAo: number[] = [];
        for (let c = 0; c <= cSegs; c++) {
          const v = c / cSegs;
          rowP.push(pLat.clone().lerp(pMed, v));
          rowT.push(0.0032);
          rowAo.push(THREE.MathUtils.lerp(0.68, 0.56, 1 - u * 0.5));
        }
        pts.push(rowP);
        thick.push(rowT);
        ao.push(rowAo);
      }
      const norms = computeGridNormals(pts, () => V3(-0.3, -0.7, -0.5 * sd).normalize());
      push(`equ.ske.cra.014-${tag}`, buildSculptedBonePlateMesh(pts, norms, thick, ao, sMat(), 0.35), side);
    }

    // --- equ.ske.cra.015-i/d: PTERIGOIDES (Choanal crest + Curved Pterygoid Hamulus) ---
    {
      const pterGrp = new THREE.Group();
      pterGrp.add(
        buildSculptedTube(
          [
            { pos: V3(1.150, 1.640, 0.018 * sd), rx: 0.007, ry: 0.005, ao: 0.72 },
            { pos: V3(1.174, 1.612, 0.021 * sd), rx: 0.006, ry: 0.005, ao: 0.78 },
            { pos: V3(1.182, 1.588, 0.021 * sd), rx: 0.0035, ry: 0.003, ao: 0.88 },
            { pos: V3(1.170, 1.580, 0.020 * sd), rx: 0.0022, ry: 0.0022, ao: 0.92 }, // pterygoid hamulus hook
          ],
          sMat(),
          8,
        ),
      );
      push(`equ.ske.cra.015-${tag}`, pterGrp, side);
    }

    // --- equ.ske.cra.019-i/d: CONCHA NASAL VENTRAL (Scroll turbinate inside nasal cavity) ---
    {
      const rSegs = 12;
      const cSegs = 6;
      const pts: THREE.Vector3[][] = [];
      const thick: number[][] = [];
      const ao: number[][] = [];
      for (let r = 0; r <= rSegs; r++) {
        const u = r / rSegs;
        const x = THREE.MathUtils.lerp(1.280, 1.482, u);
        const yCenter = THREE.MathUtils.lerp(1.565, 1.438, u);
        const zCenter = THREE.MathUtils.lerp(0.018, 0.011, u) * sd;
        const rad = THREE.MathUtils.lerp(0.011, 0.005, u);
        const rowP: THREE.Vector3[] = [];
        const rowT: number[] = [];
        const rowAo: number[] = [];
        for (let c = 0; c <= cSegs; c++) {
          const v = c / cSegs;
          // Scroll curl inside nasal cavity
          const ang = THREE.MathUtils.lerp(-0.4, Math.PI * 1.45, v);
          const curlR = rad * (1 - 0.35 * v);
          rowP.push(
            V3(
              x,
              yCenter + Math.sin(ang) * curlR,
              zCenter + Math.cos(ang) * curlR * 0.65 * sd,
            ),
          );
          rowT.push(0.0018);
          rowAo.push(0.65 + 0.16 * Math.sin(v * Math.PI));
        }
        pts.push(rowP);
        thick.push(rowT);
        ao.push(rowAo);
      }
      const norms = computeGridNormals(pts, () => V3(0, 0.4, sd).normalize());
      push(`equ.ske.cra.019-${tag}`, buildSculptedBonePlateMesh(pts, norms, thick, ao, sMat(), 0.4), side);
    }

    // --- equ.ske.cra.017-i/d: HEMIMANDÍBULA (Ramus + Masseteric fossa + Vascular notch + Coronoid + TMJ Condyle + Body + Symphysis + Teeth) ---
    {
      const mandGrp = new THREE.Group();

      // 17A. Sculpted broad equine mandibular ramus + horizontal body + V-symphysis
      // Parametrized cleanly by u (0 = caudal border/gonial angle -> 1 = rostral symphysis) and v (0 = dorsal/alveolar -> 1 = ventral border)
      const rSegs = 18;
      const cSegs = 9;
      const pts: THREE.Vector3[][] = [];
      const thick: number[][] = [];
      const ao: number[][] = [];

      for (let r = 0; r <= rSegs; r++) {
        const u = r / rSegs;
        // Dorsal / alveolar / mandibular-notch border
        let pTop: THREE.Vector3;
        // Ventral / caudal gonial-angle / vascular-notch / symphyseal border
        let pBot: THREE.Vector3;

        if (u < 0.25) {
          // Vertical ramus segment (u: 0 = caudodorsal condylar neck -> 0.25 = molar junction behind M3)
          const t = u / 0.25;
          pTop = V3(
            THREE.MathUtils.lerp(1.084, 1.196, t),
            THREE.MathUtils.lerp(1.644, 1.498, t),
            THREE.MathUtils.lerp(0.049, 0.040, t) * sd,
          );
          // Mandibular notch concave dip around t ~ 0.35
          pTop.y -= Math.sin(t * Math.PI) * 0.014;
          pBot = V3(
            THREE.MathUtils.lerp(1.058, 1.178, t),
            THREE.MathUtils.lerp(1.542, 1.454, t),
            THREE.MathUtils.lerp(0.048, 0.043, t) * sd,
          );
          // Broad rounded equine gonial angle bulging caudoventrally around t ~ 0.28
          const gonial = Math.exp(-Math.pow((t - 0.30) / 0.28, 2));
          pBot.x -= gonial * 0.016;
          pBot.y -= gonial * 0.022;
        } else if (u < 0.65) {
          // Molar horizontal body (M3 -> P2)
          const t = (u - 0.25) / 0.40;
          pTop = V3(
            THREE.MathUtils.lerp(1.196, 1.352, t),
            THREE.MathUtils.lerp(1.498, 1.416, t),
            THREE.MathUtils.lerp(0.040, 0.030, t) * sd,
          );
          pBot = V3(
            THREE.MathUtils.lerp(1.178, 1.334, t),
            THREE.MathUtils.lerp(1.454, 1.384, t),
            THREE.MathUtils.lerp(0.043, 0.029, t) * sd,
          );
          // Subtle facial vascular notch indentation near t ~ 0.14
          const vascNotch = Math.exp(-Math.pow((t - 0.14) / 0.10, 2));
          pBot.y += vascNotch * 0.0065;
        } else {
          // Diastema -> Mandibular symphysis (converges cleanly to z >= 0.001*sd)
          const t = (u - 0.65) / 0.35;
          pTop = V3(
            THREE.MathUtils.lerp(1.352, 1.500, t),
            THREE.MathUtils.lerp(1.416, 1.352, t),
            THREE.MathUtils.lerp(0.030, 0.004, Math.pow(t, 0.85)) * sd,
          );
          // Slight diastema dip before incisor arch
          pTop.y -= Math.sin(t * Math.PI * 0.85) * 0.006;
          pBot = V3(
            THREE.MathUtils.lerp(1.334, 1.488, t),
            THREE.MathUtils.lerp(1.384, 1.334, t),
            THREE.MathUtils.lerp(0.029, 0.003, Math.pow(t, 0.9)) * sd,
          );
        }

        const rowP: THREE.Vector3[] = [];
        const rowT: number[] = [];
        const rowAo: number[] = [];
        for (let c = 0; c <= cSegs; c++) {
          const v = c / cSegs;
          const p = pTop.clone().lerp(pBot, v);
          // Gentle lateral cheek curvature & concave masseteric fossa on vertical ramus
          const massFossa = u < 0.30 ? Math.sin((u / 0.30) * Math.PI) * Math.sin(v * Math.PI) : 0;
          p.z -= massFossa * 0.005 * sd;
          // Slight mental foramen dimple in lateral diastema
          const mentDist = Math.hypot(u - 0.78, v - 0.45);
          const mentHollow = Math.exp(-Math.pow(mentDist / 0.08, 2));
          p.z -= mentHollow * 0.0025 * sd;

          rowP.push(p);
          const angleThick = u < 0.25 && v > 0.7 ? 0.002 : 0;
          rowT.push(0.0052 + angleThick - massFossa * 0.0018);
          rowAo.push(0.95 - 0.22 * massFossa - 0.18 * mentHollow);
        }
        pts.push(rowP);
        thick.push(rowT);
        ao.push(rowAo);
      }
      const norms = computeGridNormals(pts, () => V3(-0.15, -0.1, sd).normalize());
      mandGrp.add(buildSculptedBonePlateMesh(pts, norms, thick, ao, sMat(), 0.38));

      // 17B. Tall, slender, caudally-hooked Coronoid Process rising into temporal fossa (medial to zygomatic arch!)
      mandGrp.add(
        buildSculptedTube(
          [
            { pos: V3(1.132, 1.564, 0.044 * sd), rx: 0.011, ry: 0.0045, ao: 0.90 },
            { pos: V3(1.124, 1.632, 0.045 * sd), rx: 0.009, ry: 0.0038, ao: 0.94 },
            { pos: V3(1.114, 1.682, 0.044 * sd), rx: 0.007, ry: 0.0032, ao: 0.97 },
            { pos: V3(1.102, 1.712, 0.042 * sd), rx: 0.0045, ry: 0.0025, ao: 0.98 },
          ],
          sMat(),
          10,
        ),
      );

      // 17C. Transverse Condylar Process barrel (TMJ articulation sitting cleanly in temporal fossa)
      mandGrp.add(
        buildSculptedTube(
          [
            { pos: V3(1.080, 1.650, 0.040 * sd), rx: 0.0065, ry: 0.0075, ao: 0.92 },
            { pos: V3(1.080, 1.652, 0.050 * sd), rx: 0.0075, ry: 0.0085, ao: 0.97 },
            { pos: V3(1.080, 1.650, 0.058 * sd), rx: 0.0060, ry: 0.0070, ao: 0.93 },
          ],
          sMat(),
          10,
        ),
      );

      // 17D. Mandibular Symphysis thickening (cleanly meets midline without crossover)
      mandGrp.add(
        buildSculptedTube(
          [
            { pos: V3(1.440, 1.366, 0.013 * sd), rx: 0.006, ry: 0.007, ao: 0.90 },
            { pos: V3(1.472, 1.348, 0.008 * sd), rx: 0.0065, ry: 0.0075, ao: 0.94 },
            { pos: V3(1.500, 1.338, 0.005 * sd), rx: 0.0045, ry: 0.005, ao: 0.96 },
          ],
          sMat(),
          10,
        ),
      );

      // 17E. 6 Lower Hypsodont Cheek Teeth (M3 -> P2) in sculpted occlusion below upper row
      for (let m = 0; m < 6; m++) {
        const mt = m / 5;
        const pos = V3(
          THREE.MathUtils.lerp(1.206, 1.334, mt),
          THREE.MathUtils.lerp(1.484, 1.416, mt),
          THREE.MathUtils.lerp(0.036, 0.028, mt) * sd,
        );
        const lenX = THREE.MathUtils.lerp(0.018, 0.021, Math.sin(mt * Math.PI * 0.7));
        mandGrp.add(
          createHypsodontCheekTooth(
            pos,
            lenX,
            0.019,
            0.012,
            -0.46,
            false,
            sd,
            teethMat(),
            darkCrownMat(),
          ),
        );
      }

      // 17F. Lower Canine (C1) + 3 Lower Incisors (I1–I3)
      mandGrp.add(
        addVertexColorMesh(
          createOrganMesh(V3(1.448, 1.374, 0.016 * sd), [0.0035, 0.0065, 0.0030], teethMat(), [0.2 * sd, 0, -0.55], 8),
          0.95,
        ),
      );
      for (let inc = 0; inc < 3; inc++) {
        const arcT = inc / 2;
        const incPos = V3(
          THREE.MathUtils.lerp(1.506, 1.488, arcT),
          THREE.MathUtils.lerp(1.342, 1.350, arcT),
          THREE.MathUtils.lerp(0.0062, 0.0175, arcT) * sd,
        );
        mandGrp.add(
          createEquineIncisorTooth(
            incPos,
            0.0064,
            0.014,
            0.0046,
            (0.18 + arcT * 0.45) * -sd,
            -0.78,
            false,
            teethMat(),
            darkCrownMat(),
          ),
        );
      }

      push(`equ.ske.cra.017-${tag}`, mandGrp, side);
    }
  }
}
