import * as THREE from 'three';
import { cervicalPos, thoracicPos, V3 } from '../anatomyCoords';
import { createOrganMesh, createTubeCurveMesh } from './geomHelpers';

export interface SculptedCervicalBuildContext {
  darkBoneMat: () => THREE.Material;
  sculptedBoneMat: () => THREE.Material;
  push: (
    id: string,
    mesh: THREE.Object3D,
    side: 'left' | 'right' | 'center',
    center?: THREE.Vector3,
  ) => void;
}

const IVORY_HIGHLIGHT = new THREE.Color(0xf3ead6);
const RIDGE_SHADOW = new THREE.Color(0xb6a78f);
const DEEP_FOSSA = new THREE.Color(0x82735f);

function sampleAoColor(ao: number): [number, number, number] {
  const c = new THREE.Color();
  const clamped = THREE.MathUtils.clamp(ao, 0, 1);
  if (clamped < 0.35) {
    c.lerpColors(DEEP_FOSSA, RIDGE_SHADOW, clamped / 0.35);
  } else {
    c.lerpColors(RIDGE_SHADOW, IVORY_HIGHLIGHT, (clamped - 0.35) / 0.65);
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

function addAoMesh(mesh: THREE.Mesh, ao: number): THREE.Mesh {
  applyAoVertexColors(mesh.geometry, ao);
  return mesh;
}

function buildSculptedBonePlateMesh(
  pts: THREE.Vector3[][],
  norms: THREE.Vector3[][],
  thick: number[][],
  aoGrid: number[][],
  mat: THREE.Material,
  edgeScale = 0.34,
  innerAoBias = 0.82,
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
        const rimAo = baseAo * (0.88 + 0.12 * Math.pow(Math.max(0, edgeEnv), 0.25));
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

function buildSculptedTube(
  stations: Array<{ pos: THREE.Vector3; rx: number; ry: number; ao?: number }>,
  mat: THREE.Material,
  radialSegs = 12,
  shapeMod?: (theta: number, u: number) => { sx: number; sy: number; aoMul?: number },
  capEndConcave = false,
): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(stations.map((s) => s.pos));
  const uSegs = Math.max(8, (stations.length - 1) * 5);
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
    const endTaper = i === 0 ? 0.58 : i === uSegs ? 0.55 : 1.0;

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

  const startCenterIdx = positions.length / 3;
  const pStart = curve.getPointAt(0);
  const tStart = curve.getTangentAt(0).normalize();
  const pStartTip = pStart.clone().addScaledVector(tStart, -stations[0].rx * 0.45);
  positions.push(pStartTip.x, pStartTip.y, pStartTip.z);
  uvs.push(0, 0.5);
  const [sr, sg, sb] = sampleAoColor((stations[0].ao ?? 0.85) * 0.92);
  colors.push(sr, sg, sb);
  for (let j = 0; j < radialSegs; j++) {
    indices.push(startCenterIdx, j + 1, j);
  }

  const endCenterIdx = positions.length / 3;
  const pEnd = curve.getPointAt(1);
  const tEnd = curve.getTangentAt(1).normalize();
  const pEndTip = pEnd.clone().addScaledVector(tEnd, (capEndConcave ? -1 : 1) * stations[stations.length - 1].rx * 0.42);
  positions.push(pEndTip.x, pEndTip.y, pEndTip.z);
  uvs.push(1, 0.5);
  const [er, eg, eb] = sampleAoColor((stations[stations.length - 1].ao ?? 0.85) * (capEndConcave ? 0.55 : 0.92));
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

interface VertebraFrame {
  pos: THREE.Vector3;
  fwd: THREE.Vector3;  // cranial (+local X)
  dors: THREE.Vector3; // dorsal (+local Y)
  lat: THREE.Vector3;  // right (+local Z)
  cranLen: number;
  caudLen: number;
}

function getCervicalFrame(c: number): VertebraFrame {
  const pos = V3(...cervicalPos(c));
  const pPrev = c === 1 ? V3(1.018, 1.702, 0) : V3(...cervicalPos(c - 1));
  const pNext = c === 7 ? V3(...thoracicPos(1)) : V3(...cervicalPos(c + 1));

  let fwd: THREE.Vector3;
  if (c === 1) {
    // Atlas bridges between Axis caudal neck and occipital condyles
    fwd = new THREE.Vector3().subVectors(V3(1.018, 1.705, 0), V3(0.938, 1.678, 0)).normalize();
  } else {
    fwd = new THREE.Vector3().subVectors(pPrev, pNext).normalize();
  }
  const lat = new THREE.Vector3(0, 0, 1);
  const dors = new THREE.Vector3().crossVectors(lat, fwd).normalize();

  const dPrev = pos.distanceTo(pPrev);
  const dNext = pos.distanceTo(pNext);
  return {
    pos,
    fwd,
    dors,
    lat,
    cranLen: c === 1 ? 0.036 : dPrev * 0.48,
    caudLen: c === 1 ? 0.042 : dNext * 0.48,
  };
}

function localPt(f: VertebraFrame, x: number, y: number, z: number): THREE.Vector3 {
  return f.pos
    .clone()
    .addScaledVector(f.fwd, x)
    .addScaledVector(f.dors, y)
    .addScaledVector(f.lat, z);
}

/**
 * C1 — ATLAS (equ.ske.cer.001):
 * Dorsal & ventral arch enclosing an open neural ring, cranial condylar cups cradling
 * occipital condyles, caudal foveae + fovea dentis, dorsal & ventral tubercles,
 * and wide ventrally curved Alae atlantis with atlantal fossae & alar/transverse foramina.
 */
function buildSculptedAtlas(sMat: () => THREE.Material): THREE.Group {
  const f = getCervicalFrame(1);
  const g = new THREE.Group();

  // 1. Open Vertebral Arch Ring (dorsal arch + ventral arch around neural canal)
  // Top half (dorsal arch): from left pedicle -> dorsal tubercle -> right pedicle
  const archSegs = 12;
  const ringR = 10;
  const dPts: THREE.Vector3[][] = [];
  const dThick: number[][] = [];
  const dAo: number[][] = [];
  for (let r = 0; r <= 6; r++) {
    const u = r / 6; // craniocaudal: +0.028 .. -0.032
    const x = THREE.MathUtils.lerp(0.028, -0.032, u);
    const rowP: THREE.Vector3[] = [];
    const rowT: number[] = [];
    const rowAo: number[] = [];
    for (let c = 0; c <= archSegs; c++) {
      const v = c / archSegs;
      const ang = THREE.MathUtils.lerp(-0.18 * Math.PI, 1.18 * Math.PI, v);
      const radZ = 0.024 + 0.004 * Math.sin(u * Math.PI);
      const radY = 0.023;
      const tubDors = Math.exp(-Math.pow((v - 0.5) / 0.14, 2)) * Math.exp(-Math.pow((u - 0.48) / 0.35, 2));
      rowP.push(
        localPt(
          f,
          x,
          Math.sin(ang) * radY + tubDors * 0.008,
          Math.cos(ang) * radZ,
        ),
      );
      rowT.push(0.0048 + tubDors * 0.003);
      rowAo.push(0.92 + tubDors * 0.07 - 0.12 * (1 - Math.sin(u * Math.PI)));
    }
    dPts.push(rowP);
    dThick.push(rowT);
    dAo.push(rowAo);
  }
  const dNorms = computeGridNormals(dPts, (_r, c) => {
    const ang = THREE.MathUtils.lerp(-0.18 * Math.PI, 1.18 * Math.PI, c / archSegs);
    return f.dors.clone().multiplyScalar(Math.sin(ang)).addScaledVector(f.lat, Math.cos(ang)).normalize();
  });
  g.add(buildSculptedBonePlateMesh(dPts, dNorms, dThick, dAo, sMat(), 0.38, 0.72));

  // Ventral arch (arcus ventralis) + caudoventral tubercle (tuberculum ventrale)
  const vPts: THREE.Vector3[][] = [];
  const vThick: number[][] = [];
  const vAo: number[][] = [];
  for (let r = 0; r <= 6; r++) {
    const u = r / 6;
    const x = THREE.MathUtils.lerp(0.026, -0.032, u);
    const rowP: THREE.Vector3[] = [];
    const rowT: number[] = [];
    const rowAo: number[] = [];
    for (let c = 0; c <= archSegs; c++) {
      const v = c / archSegs;
      const ang = THREE.MathUtils.lerp(1.10 * Math.PI, 1.90 * Math.PI, v);
      const tubVent = Math.exp(-Math.pow((v - 0.5) / 0.16, 2)) * Math.exp(-Math.pow((u - 0.78) / 0.28, 2));
      rowP.push(
        localPt(
          f,
          x - tubVent * 0.006,
          Math.sin(ang) * 0.020 - tubVent * 0.011,
          Math.cos(ang) * 0.023,
        ),
      );
      rowT.push(0.0052 + tubVent * 0.0035);
      rowAo.push(0.90 + tubVent * 0.08);
    }
    vPts.push(rowP);
    vThick.push(rowT);
    vAo.push(rowAo);
  }
  const vNorms = computeGridNormals(vPts, (_r, c) => {
    const ang = THREE.MathUtils.lerp(1.10 * Math.PI, 1.90 * Math.PI, c / archSegs);
    return f.dors.clone().multiplyScalar(Math.sin(ang)).addScaledVector(f.lat, Math.cos(ang)).normalize();
  });
  g.add(buildSculptedBonePlateMesh(vPts, vNorms, vThick, vAo, sMat(), 0.38, 0.72));

  // 2. Bilateral Wide Wings (Ala atlantis), Cranial Condylar Cups, Caudal Facets & Wing Foramina
  for (const sd of [-1, 1] as const) {
    // Wing plate curving ventrolaterally from body rim to outer wing margin (|z| up to 0.056)
    const wR = 10; // craniocaudal: +0.032 .. -0.044
    const wC = 8;  // mediolateral: ring junction (0.021) -> outer wing rim (0.056)
    const wPts: THREE.Vector3[][] = [];
    const wThick: number[][] = [];
    const wAo: number[][] = [];

    for (let r = 0; r <= wR; r++) {
      const u = r / wR;
      const xBase = THREE.MathUtils.lerp(0.032, -0.044, u);
      const span = 0.023 + 0.033 * Math.pow(Math.sin(u * Math.PI * 0.92), 0.75);
      const rowP: THREE.Vector3[] = [];
      const rowT: number[] = [];
      const rowAo: number[] = [];
      for (let c = 0; c <= wC; c++) {
        const v = c / wC;
        const z = THREE.MathUtils.lerp(0.021, span, v) * sd;
        // Equine Atlas wing curves strongly ventrally on its outer rim (enclosing atlantal fossa underneath)
        const ventDroop = -Math.pow(v, 1.25) * 0.026 - (1 - u) * 0.004 * v;
        const cranSweep = Math.sin(v * Math.PI) * (u < 0.3 ? 0.005 : -0.006);

        // Two subtle dorsal foraminal dimples: alar foramen (cranial, u~0.24, v~0.55) & transverse foramen (caudal, u~0.72, v~0.48)
        const alarF = Math.exp(-Math.pow((u - 0.26) / 0.11, 2) - Math.pow((v - 0.52) / 0.14, 2));
        const transF = Math.exp(-Math.pow((u - 0.72) / 0.11, 2) - Math.pow((v - 0.45) / 0.14, 2));
        const dimple = alarF + transF;

        rowP.push(localPt(f, xBase + cranSweep, 0.003 + ventDroop - dimple * 0.003, z));
        // Thick rolled outer wing rim, thinner inside fossa
        rowT.push(0.0038 + 0.0028 * Math.pow(v, 1.6) - dimple * 0.0015);
        rowAo.push(0.95 - 0.48 * dimple - 0.16 * Math.sin(v * Math.PI) * 0.5);
      }
      wPts.push(rowP);
      wThick.push(rowT);
      wAo.push(rowAo);
    }
    const wNorms = computeGridNormals(wPts, () =>
      f.dors.clone().multiplyScalar(0.75).addScaledVector(f.lat, 0.65 * sd).normalize(),
    );
    g.add(buildSculptedBonePlateMesh(wPts, wNorms, wThick, wAo, sMat(), 0.36, 0.66));

    // Cranial articular condylar rim cradling occipital condyles
    g.add(
      buildSculptedTube(
        [
          { pos: localPt(f, 0.032, 0.014, 0.017 * sd), rx: 0.006, ry: 0.0055, ao: 0.94 },
          { pos: localPt(f, 0.037, 0.001, 0.023 * sd), rx: 0.007, ry: 0.0065, ao: 0.97 },
          { pos: localPt(f, 0.031, -0.013, 0.016 * sd), rx: 0.006, ry: 0.0055, ao: 0.92 },
        ],
        sMat(),
        8,
      ),
    );

    // Caudal articular facet rim meeting Axis cranial facets
    g.add(
      buildSculptedTube(
        [
          { pos: localPt(f, -0.034, 0.008, 0.020 * sd), rx: 0.0055, ry: 0.0055, ao: 0.90 },
          { pos: localPt(f, -0.038, -0.010, 0.022 * sd), rx: 0.0065, ry: 0.006, ao: 0.93 },
        ],
        sMat(),
        8,
      ),
    );
  }

  void ringR;
  return g;
}

/**
 * C2 — AXIS (equ.ske.cer.002):
 * Long hourglass centrum + prominent ventral crest + cranial odontoid dens projecting into Atlas +
 * flared cranial articular facets + tall sail-like dorsal spinous crest bifurcating caudally onto
 * caudal articular processes + lateral vertebral foramen + swept transverse processes.
 */
function buildSculptedAxis(sMat: () => THREE.Material): THREE.Group {
  const f = getCervicalFrame(2);
  const g = new THREE.Group();

  const xCran = f.cranLen * 0.86;
  const xCaud = -f.caudLen * 1.02;

  // 1. Elongated Hourglass Centrum with prominent Ventral Crest (crista ventralis)
  g.add(
    buildSculptedTube(
      [
        { pos: localPt(f, xCran, -0.005, 0), rx: 0.021, ry: 0.017, ao: 0.90 },
        { pos: localPt(f, xCran * 0.35, -0.008, 0), rx: 0.017, ry: 0.019, ao: 0.88 },
        { pos: localPt(f, -xCaud * -0.15, -0.009, 0), rx: 0.016, ry: 0.020, ao: 0.92 },
        { pos: localPt(f, xCaud, -0.007, 0), rx: 0.022, ry: 0.021, ao: 0.86 },
      ],
      sMat(),
      14,
      (theta, u) => {
        const s = Math.sin(theta);
        // Pinched hourglass waist + sharp ventral crest keel (s < -0.5)
        const waist = 1 - 0.18 * Math.sin(u * Math.PI);
        const ventKeel = s < -0.55 ? (0.45 + 0.35 * u) * Math.pow((-s - 0.55) / 0.45, 1.4) : 0;
        return {
          sx: waist,
          sy: waist + ventKeel,
          aoMul: s < -0.5 ? 1.04 : 0.95,
        };
      },
      true,
    ),
  );

  // 2. Odontoid Dens (scoop-shaped process projecting cranially into Atlas fovea dentis)
  g.add(
    buildSculptedTube(
      [
        { pos: localPt(f, xCran - 0.004, -0.002, 0), rx: 0.012, ry: 0.008, ao: 0.92 },
        { pos: localPt(f, xCran + 0.016, 0.002, 0), rx: 0.011, ry: 0.0065, ao: 0.97 },
        { pos: localPt(f, xCran + 0.032, 0.006, 0), rx: 0.008, ry: 0.0045, ao: 0.98 },
      ],
      sMat(),
      10,
    ),
  );

  // 3. Tall Sail-like Dorsal Spinous Blade bifurcating caudally onto Caudal Articular Processes
  for (const sd of [-1, 1] as const) {
    // Open neural arch lateral wall + lateral vertebral foramen shadow
    const archPts: THREE.Vector3[][] = [];
    const archThick: number[][] = [];
    const archAo: number[][] = [];
    for (let r = 0; r <= 10; r++) {
      const u = r / 10;
      const x = THREE.MathUtils.lerp(xCran * 0.72, xCaud * 0.98, u);
      // Base sits along dorsolateral centrum -> top merges into midline dorsal crest or caudal articular wing
      const pBase = localPt(f, x, 0.002, 0.018 * sd);
      const pTop = localPt(
        f,
        x,
        THREE.MathUtils.lerp(0.028, 0.034, Math.sin(u * Math.PI * 0.85)),
        (u > 0.65 ? THREE.MathUtils.lerp(0.004, 0.028, (u - 0.65) / 0.35) : 0.003) * sd,
      );
      const rowP: THREE.Vector3[] = [];
      const rowT: number[] = [];
      const rowAo: number[] = [];
      for (let c = 0; c <= 6; c++) {
        const v = c / 6;
        const p = pBase.clone().lerp(pTop, v);
        // Arch bows outward over neural canal
        const canalBow = Math.sin(v * Math.PI) * 0.006 * sd;
        p.addScaledVector(f.lat, canalBow);
        // Cranial lateral vertebral foramen dimple (u~0.18, v~0.42)
        const latFor = Math.exp(-Math.pow((u - 0.18) / 0.12, 2) - Math.pow((v - 0.40) / 0.18, 2));
        rowP.push(p);
        rowT.push(0.0038 + 0.0018 * v);
        rowAo.push(0.92 - 0.42 * latFor);
      }
      archPts.push(rowP);
      archThick.push(rowT);
      archAo.push(rowAo);
    }
    const archNorms = computeGridNormals(archPts, () =>
      f.dors.clone().multiplyScalar(0.45).addScaledVector(f.lat, 0.88 * sd).normalize(),
    );
    g.add(buildSculptedBonePlateMesh(archPts, archNorms, archThick, archAo, sMat(), 0.36));

    // Flared Cranial Articular Surface hugging base of Dens
    g.add(
      buildSculptedTube(
        [
          { pos: localPt(f, xCran * 0.92, -0.003, 0.013 * sd), rx: 0.008, ry: 0.009, ao: 0.93 },
          { pos: localPt(f, xCran * 0.88, -0.002, 0.025 * sd), rx: 0.009, ry: 0.010, ao: 0.96 },
        ],
        sMat(),
        10,
      ),
    );

    // Caudal Articular Process wing overlapping C3 cranial facet
    g.add(
      buildSculptedTube(
        [
          { pos: localPt(f, xCaud * 0.72, 0.028, 0.014 * sd), rx: 0.007, ry: 0.0055, ao: 0.94 },
          { pos: localPt(f, xCaud * 1.02, 0.024, 0.026 * sd), rx: 0.009, ry: 0.006, ao: 0.96 },
        ],
        sMat(),
        10,
      ),
    );

    // Sweeping Transverse Process + Transverse Foramen shadow
    g.add(
      buildSculptedTube(
        [
          { pos: localPt(f, 0.002, -0.008, 0.019 * sd), rx: 0.007, ry: 0.005, ao: 0.82 },
          { pos: localPt(f, xCaud * 0.62, -0.011, 0.032 * sd), rx: 0.0065, ry: 0.0048, ao: 0.91 },
          { pos: localPt(f, xCaud * 1.02, -0.014, 0.038 * sd), rx: 0.0042, ry: 0.0035, ao: 0.95 },
        ],
        sMat(),
        8,
      ),
    );
  }

  // Thick rolled midline Dorsal Spinous Crest ridge (sail apex)
  g.add(
    buildSculptedTube(
      [
        { pos: localPt(f, xCran * 0.68, 0.025, 0), rx: 0.0055, ry: 0.0075, ao: 0.95 },
        { pos: localPt(f, 0.0, 0.038, 0), rx: 0.0065, ry: 0.0095, ao: 0.99 },
        { pos: localPt(f, xCaud * 0.62, 0.036, 0), rx: 0.0075, ry: 0.0085, ao: 0.97 },
      ],
      sMat(),
      10,
    ),
  );

  return g;
}

/**
 * C3–C7 (equ.ske.cer.003..007):
 * Hourglass centrum with convex cranial head, concave caudal fossa & ventral crest;
 * open neural arch with dorsal spinous process (low ridge C3–C5, taller C6, tall triangular C7);
 * broad butterfly cranial & caudal articular processes interlocking with neighbors;
 * bicuspid transverse processes (C3–C5), broad ventral lamina plate (C6), or single wide lateral wing (C7).
 */
function buildSculptedTypicalCervical(c: number, sMat: () => THREE.Material): THREE.Group {
  const f = getCervicalFrame(c);
  const g = new THREE.Group();

  const xCran = f.cranLen * 0.95;
  const xCaud = -f.caudLen * 0.96;
  const isC6 = c === 6;
  const isC7 = c === 7;
  const bodyR = isC7 ? 0.022 : isC6 ? 0.021 : 0.019;

  // 1. Hourglass Centrum with Ventral Crest & Cranial Head
  g.add(
    buildSculptedTube(
      [
        { pos: localPt(f, xCran, -0.002, 0), rx: bodyR * 1.02, ry: bodyR * 0.96, ao: 0.92 },
        { pos: localPt(f, xCran * 0.35, -0.004, 0), rx: bodyR * 0.84, ry: bodyR * 0.92, ao: 0.88 },
        { pos: localPt(f, xCaud * 0.35, -0.004, 0), rx: bodyR * 0.84, ry: bodyR * 0.94, ao: 0.90 },
        { pos: localPt(f, xCaud, -0.003, 0), rx: bodyR * 1.08, ry: bodyR * 1.04, ao: 0.85 },
      ],
      sMat(),
      14,
      (theta, u) => {
        const s = Math.sin(theta);
        const waist = 1 - 0.16 * Math.sin(u * Math.PI);
        // C3-C5 sharp ventral crest + caudal tubercle; C6-C7 flatter
        const crestAmp = isC7 ? 0.06 : isC6 ? 0.16 : 0.36 + 0.28 * Math.pow(u, 1.5);
        const ventKeel = s < -0.55 ? crestAmp * Math.pow((-s - 0.55) / 0.45, 1.35) : 0;
        return {
          sx: waist,
          sy: waist + ventKeel,
          aoMul: s < -0.5 ? 1.03 : 0.94,
        };
      },
      true,
    ),
  );

  // 2. Open Neural Arch + Butterfly Cranial/Caudal Articular Wings (Zygapophyses)
  for (const sd of [-1, 1] as const) {
    const uSegs = 10;
    const vSegs = 7;
    const wPts: THREE.Vector3[][] = [];
    const wThick: number[][] = [];
    const wAo: number[][] = [];

    const zygSpan = isC7 ? 0.036 : isC6 ? 0.038 : 0.041;
    for (let r = 0; r <= uSegs; r++) {
      const u = r / uSegs; // 0 = cranial articular wing -> 1 = caudal articular wing
      const x = THREE.MathUtils.lerp(xCran * 1.06, xCaud * 1.05, u);
      const midPinch = 1 - 0.32 * Math.sin(u * Math.PI);
      const wingZ = zygSpan * midPinch * sd;

      const pMed = localPt(f, x, 0.022, 0.003 * sd);
      const pLat = localPt(f, x, THREE.MathUtils.lerp(0.024, 0.026, u), wingZ);

      const rowP: THREE.Vector3[] = [];
      const rowT: number[] = [];
      const rowAo: number[] = [];
      for (let cCol = 0; cCol <= vSegs; cCol++) {
        const v = cCol / vSegs;
        const p = pMed.clone().lerp(pLat, v);
        // Subtle saddle dip between cranial and caudal zygapophyses
        const saddle = Math.sin(u * Math.PI) * Math.sin(v * Math.PI * 0.8);
        p.addScaledVector(f.dors, -saddle * 0.0035);
        rowP.push(p);
        rowT.push(0.0042 + (v > 0.65 ? 0.002 : 0));
        rowAo.push(0.95 - 0.14 * saddle);
      }
      wPts.push(rowP);
      wThick.push(rowT);
      wAo.push(rowAo);
    }
    const wNorms = computeGridNormals(wPts, () =>
      f.dors.clone().multiplyScalar(0.85).addScaledVector(f.lat, 0.45 * sd).normalize(),
    );
    g.add(buildSculptedBonePlateMesh(wPts, wNorms, wThick, wAo, sMat(), 0.36, 0.72));

    // Pedicle pillars bridging centrum to neural arch roof (framing the open vertebral foramen!)
    g.add(
      buildSculptedTube(
        [
          { pos: localPt(f, xCran * 0.35, 0.004, 0.016 * sd), rx: 0.008, ry: 0.005, ao: 0.86 },
          { pos: localPt(f, 0, 0.015, 0.020 * sd), rx: 0.009, ry: 0.0055, ao: 0.88 },
          { pos: localPt(f, xCaud * 0.35, 0.021, 0.018 * sd), rx: 0.008, ry: 0.005, ao: 0.88 },
        ],
        sMat(),
        8,
      ),
    );

    // 3. Transverse Processes (Bicuspid C3–C5, Ventral Lamina C6, Wide single wing C7)
    if (isC6) {
      // C6: Signature broad Ventral Lamina (lamina ventralis) + dorsal transverse tubercle
      const lamR = 10;
      const lamC = 6;
      const lamPts: THREE.Vector3[][] = [];
      const lamThick: number[][] = [];
      const lamAo: number[][] = [];
      for (let r = 0; r <= lamR; r++) {
        const u = r / lamR;
        const x = THREE.MathUtils.lerp(xCran * 0.92, xCaud * 0.98, u);
        const pTop = localPt(f, x, -0.006, 0.024 * sd);
        const pBot = localPt(
          f,
          x - (1 - u) * 0.004,
          -0.036 - Math.sin(u * Math.PI) * 0.004,
          (0.038 + 0.006 * Math.sin(u * Math.PI)) * sd,
        );
        const rowP: THREE.Vector3[] = [];
        const rowT: number[] = [];
        const rowAo: number[] = [];
        for (let cc = 0; cc <= lamC; cc++) {
          const v = cc / lamC;
          const p = pTop.clone().lerp(pBot, v);
          p.addScaledVector(f.lat, Math.sin(v * Math.PI) * 0.005 * sd);
          rowP.push(p);
          rowT.push(0.0042 + 0.002 * Math.pow(v, 1.4));
          rowAo.push(0.92 - 0.16 * (1 - v) * Math.sin(u * Math.PI));
        }
        lamPts.push(rowP);
        lamThick.push(rowT);
        lamAo.push(rowAo);
      }
      const lamNorms = computeGridNormals(lamPts, () =>
        f.lat.clone().multiplyScalar(0.85 * sd).addScaledVector(f.dors, -0.45).normalize(),
      );
      g.add(buildSculptedBonePlateMesh(lamPts, lamNorms, lamThick, lamAo, sMat(), 0.36));
      // Dorsal caudal transverse knob on C6
      g.add(
        buildSculptedTube(
          [
            { pos: localPt(f, 0.0, -0.004, 0.024 * sd), rx: 0.007, ry: 0.006, ao: 0.88 },
            { pos: localPt(f, xCaud * 0.52, -0.008, 0.048 * sd), rx: 0.0075, ry: 0.006, ao: 0.96 },
          ],
          sMat(),
          8,
        ),
      );
    } else if (isC7) {
      // C7: Broad undivided lateral wing (processus transversus without foramen transversarium)
      g.add(
        buildSculptedTube(
          [
            { pos: localPt(f, 0.004, -0.003, 0.022 * sd), rx: 0.011, ry: 0.008, ao: 0.88 },
            { pos: localPt(f, 0.000, -0.006, 0.042 * sd), rx: 0.012, ry: 0.007, ao: 0.94 },
            { pos: localPt(f, -0.005, -0.008, 0.056 * sd), rx: 0.008, ry: 0.0055, ao: 0.97 },
          ],
          sMat(),
          10,
        ),
      );
    } else {
      // C3–C5: Distinct Bicuspid Transverse Process (cranial ventral + caudal dorsal tubercles + intertubercular crest)
      g.add(
        buildSculptedTube(
          [
            { pos: localPt(f, xCran * 0.68, -0.016, 0.036 * sd), rx: 0.0055, ry: 0.0048, ao: 0.96 },
            { pos: localPt(f, 0.004, -0.012, 0.038 * sd), rx: 0.008, ry: 0.0055, ao: 0.92 },
            { pos: localPt(f, xCaud * 0.62, -0.008, 0.047 * sd), rx: 0.0065, ry: 0.0055, ao: 0.96 },
          ],
          sMat(),
          10,
        ),
      );
      // Root bridge & transverse foramen recess
      g.add(
        addVertexColorMesh(
          createTubeCurveMesh(
            [
              localPt(f, 0.008, -0.010, 0.018 * sd),
              localPt(f, 0.002, -0.011, 0.036 * sd),
            ],
            0.006,
            sMat(),
            6,
            8,
          ),
          0.74,
        ),
      );
    }
  }

  // 4. Dorsal Spinous Process (low ridge on C3–C5, taller knob on C6, prominent triangular blade on C7)
  if (isC7) {
    const spR = 8;
    const spC = 6;
    const spPts: THREE.Vector3[][] = [];
    const spThick: number[][] = [];
    const spAo: number[][] = [];
    for (let r = 0; r <= spR; r++) {
      const u = r / spR;
      const h = THREE.MathUtils.lerp(0.022, 0.072, u);
      const pCran = localPt(f, THREE.MathUtils.lerp(0.016, 0.004, u), h, 0);
      const pCaud = localPt(f, THREE.MathUtils.lerp(-0.016, -0.010, u), h * 0.96, 0);
      const rowP: THREE.Vector3[] = [];
      const rowT: number[] = [];
      const rowAo: number[] = [];
      for (let cc = 0; cc <= spC; cc++) {
        const v = cc / spC;
        rowP.push(pCran.clone().lerp(pCaud, v));
        rowT.push(0.0048 - 0.0012 * u + (u > 0.85 ? 0.0015 : 0));
        rowAo.push(0.90 + 0.08 * u);
      }
      spPts.push(rowP);
      spThick.push(rowT);
      spAo.push(rowAo);
    }
    const spNorms = computeGridNormals(spPts, () => f.lat.clone());
    g.add(buildSculptedBonePlateMesh(spPts, spNorms, spThick, spAo, sMat(), 0.42));
  } else {
    const spinePeak = isC6 ? 0.038 : 0.025 + (c - 3) * 0.003;
    g.add(
      buildSculptedTube(
        [
          { pos: localPt(f, xCran * 0.45, 0.023, 0), rx: 0.0045, ry: 0.0055, ao: 0.92 },
          { pos: localPt(f, 0.0, spinePeak, 0), rx: 0.0055, ry: 0.0075, ao: 0.97 },
          { pos: localPt(f, xCaud * 0.48, 0.025, 0), rx: 0.005, ry: 0.0055, ao: 0.91 },
        ],
        sMat(),
        8,
      ),
    );
  }

  return g;
}

function addVertexColorMesh(mesh: THREE.Mesh, ao: number): THREE.Mesh {
  return addAoMesh(mesh, ao);
}

export function buildSculptedCervicalVertebraeParts(ctx: SculptedCervicalBuildContext): void {
  const { sculptedBoneMat, push } = ctx;
  const sMat = () => sculptedBoneMat();

  for (let c = 1; c <= 7; c++) {
    const id = `equ.ske.cer.00${c}`;
    const [x, y] = cervicalPos(c);
    let grp: THREE.Group;
    if (c === 1) {
      grp = buildSculptedAtlas(sMat);
    } else if (c === 2) {
      grp = buildSculptedAxis(sMat);
    } else {
      grp = buildSculptedTypicalCervical(c, sMat);
    }
    push(id, grp, 'center', V3(x, y, 0));
  }

  // Silence unused import helper check if createOrganMesh isn't used directly here
  void createOrganMesh;
}
