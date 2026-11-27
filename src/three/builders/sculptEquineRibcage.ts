import * as THREE from 'three';
import { ribArcPoints, thoracicPos, V3 } from '../anatomyCoords';
import { createOrganMesh } from './geomHelpers';

export interface SculptedRibcageBuildContext {
  sculptedBoneMat: () => THREE.Material;
  cartMat: () => THREE.Material;
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

function safeTangents(geo: THREE.BufferGeometry): void {
  if (geo.getAttribute('uv') && geo.getIndex()) {
    geo.computeTangents();
  }
}

function buildSculptedBonePlateMesh(
  pts: THREE.Vector3[][],
  norms: THREE.Vector3[][],
  thick: number[][],
  aoGrid: number[][],
  mat: THREE.Material,
  edgeScale = 0.32,
  innerAoBias = 0.84,
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
  safeTangents(geo);

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
  uSegsOverride?: number,
  shapeMod?: (theta: number, u: number) => { sx: number; sy: number; aoMul?: number },
  capEndConcave = false,
): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(stations.map((s) => s.pos));
  const uSegs = uSegsOverride ?? Math.max(8, (stations.length - 1) * 5);
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
      ao: THREE.MathUtils.lerp(s0.ao ?? 0.92, s1.ao ?? 0.92, f),
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
    const endTaper = i === 0 ? 0.65 : i === uSegs ? 0.65 : 1.0;

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
      indices.push(a, d, b, b, d, c);
    }
  }

  const pStart = curve.getPointAt(0);
  const tStart = curve.getTangentAt(0).normalize();
  const startTip = pStart.clone().addScaledVector(tStart, -0.0025);
  const startIdx = positions.length / 3;
  positions.push(startTip.x, startTip.y, startTip.z);
  uvs.push(0, 0.5);
  const [sr, sg, sb] = sampleAoColor(0.84);
  colors.push(sr, sg, sb);
  for (let j = 0; j < radialSegs; j++) {
    indices.push(startIdx, j, j + 1);
  }

  const pEnd = curve.getPointAt(1);
  const tEnd = curve.getTangentAt(1).normalize();
  const endTip = pEnd.clone().addScaledVector(tEnd, capEndConcave ? -0.004 : 0.0025);
  const endIdx = positions.length / 3;
  positions.push(endTip.x, endTip.y, endTip.z);
  uvs.push(1, 0.5);
  const [er, eg, eb] = sampleAoColor(capEndConcave ? 0.50 : 0.84);
  colors.push(er, eg, eb);
  const lastRing = uSegs * stride;
  for (let j = 0; j < radialSegs; j++) {
    indices.push(endIdx, lastRing + j + 1, lastRing + j);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  safeTangents(geo);

  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function buildVertebralCanalArch(
  center: THREE.Vector3,
  radiusW: number,
  radiusH: number,
  tubeThick: number,
  lengthX: number,
  mat: THREE.Material,
): THREE.Mesh {
  const arcSegs = 12;
  const lenSegs = 4;
  const pts: THREE.Vector3[][] = [];
  const norms: THREE.Vector3[][] = [];
  const thick: number[][] = [];
  const ao: number[][] = [];

  for (let r = 0; r <= lenSegs; r++) {
    const u = r / lenSegs;
    const x = center.x + (u - 0.5) * lengthX;
    const rowP: THREE.Vector3[] = [];
    const rowN: THREE.Vector3[] = [];
    const rowT: number[] = [];
    const rowAo: number[] = [];
    for (let c = 0; c <= arcSegs; c++) {
      const v = c / arcSegs;
      const phi = THREE.MathUtils.lerp(-Math.PI * 0.62, Math.PI * 0.62, v);
      const y = center.y + Math.cos(phi) * radiusH;
      const z = center.z + Math.sin(phi) * radiusW;
      rowP.push(V3(x, y, z));
      rowN.push(V3(0, Math.cos(phi), Math.sin(phi)).normalize());
      rowT.push(tubeThick * (0.85 + 0.15 * Math.sin(u * Math.PI)));
      rowAo.push(0.86 - 0.24 * (1 - Math.sin(u * Math.PI)));
    }
    pts.push(rowP);
    norms.push(rowN);
    thick.push(rowT);
    ao.push(rowAo);
  }
  return buildSculptedBonePlateMesh(pts, norms, thick, ao, mat, 0.45, 0.52);
}

/**
 * Builds sculpted equine Thoracic Vertebrae (T1..T18), Keeled Sternum with Manubrium & Xiphoid Cartilage,
 * and 18 pairs of Sculpted Ribs with Costovertebral Heads/Tubercles, Costal Grooves, Sternal Cartilages (R1-R8),
 * and Sweeping Asternal Costal Arch (R9-R18).
 */
export function buildSculptedRibcageParts(ctx: SculptedRibcageBuildContext): void {
  const { sculptedBoneMat, cartMat, push } = ctx;
  const sMat = () => sculptedBoneMat();
  const cMat = () => cartMat();

  // ===========================================================================
  // 1. THORACIC VERTEBRAE (equ.ske.tor.001 .. 018)
  // Short prismoid ventral-keeled centrum + lateral costal foveae + spinal canal arch +
  // transverse costal process + high sculpted withers spinous blades (T3-T7 summit, T15 anticlinal)
  // ===========================================================================
  // Exact equine withers profile calibrated inside dorsal coat envelope (T5 peaks ~1.54m)
  const torSpineHeights = [
    0.072, 0.122, 0.162, 0.186, 0.194, 0.185, 0.166, 0.144, 0.122,
    0.102, 0.087, 0.076, 0.069, 0.065, 0.063, 0.063, 0.064, 0.065,
  ];
  const torSpineTilts = [
    -0.018, -0.028, -0.038, -0.045, -0.048, -0.046, -0.043, -0.039, -0.034,
    -0.028, -0.022, -0.016, -0.010, -0.004, 0.000, 0.004, 0.007, 0.009,
  ];

  for (let t = 1; t <= 18; t++) {
    const [x, y] = thoracicPos(t);
    const [nx, ny] = thoracicPos(Math.max(1, t - 1));
    const [px, py] = thoracicPos(Math.min(18, t + 1));
    const fwd = V3(nx - px, ny - py, 0);
    if (fwd.lengthSq() < 1e-6) fwd.set(1, 0, 0);
    fwd.normalize();

    const g = new THREE.Group();
    const halfBody = 0.022;
    const bodyR = 0.0215;

    // 1A. Prismoid Thoracic Centrum with distinct ventral keel & cranial/caudal costal foveae
    g.add(
      buildSculptedTube(
        [
          { pos: V3(x - fwd.x * halfBody, y - fwd.y * halfBody, 0), rx: bodyR * 1.12, ry: bodyR * 1.06, ao: 0.85 },
          { pos: V3(x, y, 0), rx: bodyR * 0.82, ry: bodyR * 0.78, ao: 0.90 },
          { pos: V3(x + fwd.x * halfBody, y + fwd.y * halfBody, 0), rx: bodyR * 1.10, ry: bodyR * 1.04, ao: 0.90 },
        ],
        sMat(),
        14,
        undefined,
        (theta, u) => {
          const vent = Math.cos(theta); // -1 ventral
          const keelAmt = t <= 4 || t >= 14 ? 0.24 : 0.14;
          const keel = vent < -0.55 ? 1 + keelAmt * Math.sin(u * Math.PI) : 1.0;
          const dorsFlat = vent > 0.45 ? 0.80 : 1.0;
          return {
            sx: keel * dorsFlat,
            sy: 1.05,
            aoMul: vent < -0.55 ? 1.05 : vent > 0.35 ? 0.82 : 0.96,
          };
        },
        true,
      ),
    );

    // 1B. Neural Arch enclosing Vertebral Canal
    g.add(buildVertebralCanalArch(V3(x, y + 0.014, 0), 0.0145, 0.0125, 0.0044, 0.035, sMat()));

    // 1C. Short Stout Transverse Processes (Processus transversi) with costal fovea + Cranial Mammillary Boss (T13-T18)
    for (const sd of [-1, 1] as const) {
      g.add(
        addAoMesh(
          createOrganMesh(
            V3(x - 0.002, y + 0.012, 0.030 * sd),
            [0.0125, 0.009, 0.014],
            sMat(),
            [0, 0, -0.1 * sd],
            10,
          ),
          0.92,
        ),
      );
      if (t >= 13) {
        const mamScale = (t - 12) / 6;
        g.add(
          addAoMesh(
            createOrganMesh(
              V3(x + 0.016, y + 0.025, 0.018 * sd),
              [0.009, 0.0075 + 0.002 * mamScale, 0.0065],
              sMat(),
              [0.15 * sd, 0, -0.15],
              8,
            ),
            0.94,
          ),
        );
      }
    }

    // 1D. High Sculpted Thoracic Spinous Blade (withers crest on T2-T8, anticlinal T15)
    const spineH = torSpineHeights[t - 1];
    const tiltX = torSpineTilts[t - 1];
    const baseChord = t <= 3 ? 0.016 : t <= 12 ? 0.0145 : 0.0165;
    const spRows = 9;
    const spCols = 5;
    const sPts: THREE.Vector3[][] = [];
    const sThick: number[][] = [];
    const sAo: number[][] = [];

    for (let r = 0; r <= spRows; r++) {
      const u = r / spRows; // 0 = neural arch root, 1 = clubbed cartilaginous summit
      // Withers blades slightly waisted mid-shaft and bulbous/clubbed at dorsal summit (T2-T8)
      const tipBell = t >= 2 && t <= 9 ? Math.exp(-Math.pow((1 - u) / 0.14, 2)) : Math.exp(-Math.pow((1 - u) / 0.20, 2));
      const waist = 1 - 0.16 * Math.sin(u * Math.PI * 0.85) + tipBell * 0.18;
      const chord = baseChord * waist;
      const rowP: THREE.Vector3[] = [];
      const rowT: number[] = [];
      const rowAo: number[] = [];
      for (let c = 0; c <= spCols; c++) {
        const v = c / spCols; // 0 = caudal border, 1 = sharp concave cranial border
        const cranialConcavity = u > 0.25 && u < 0.85 && v > 0.65 ? -0.0018 : 0;
        rowP.push(V3(x + tiltX * u + (v - 0.5) * 2 * chord + cranialConcavity, y + 0.023 + u * spineH, 0));
        rowT.push(0.0038 + tipBell * 0.0032 + (v < 0.35 ? 0.0012 : 0));
        rowAo.push(0.82 + 0.16 * u + tipBell * 0.04);
      }
      sPts.push(rowP);
      sThick.push(rowT);
      sAo.push(rowAo);
    }
    const sNorms = computeGridNormals(sPts, () => V3(0, 0, 1));
    g.add(buildSculptedBonePlateMesh(sPts, sNorms, sThick, sAo, sMat(), 0.40, 0.96));

    push(`equ.ske.tor.${String(t).padStart(3, '0')}`, g, 'center', V3(x, y + spineH * 0.35, 0));
  }

  // ===========================================================================
  // 2. STERNUM (equ.ske.ste.001)
  // Laterally compressed canoe-keeled Sternebrae + Manubrium / Cariniform Cartilage prow +
  // Bilateral sternocostal notches (R1-R8) + Broad paddle-shaped Xiphoid Cartilage
  // ===========================================================================
  const sternalNotchPositions: Array<{ x: number; y: number; z: number }> = [
    { x: 0.468, y: 0.905, z: 0.015 }, // R1 on manubrium prow
    { x: 0.415, y: 0.875, z: 0.016 }, // R2
    { x: 0.360, y: 0.852, z: 0.018 }, // R3
    { x: 0.305, y: 0.838, z: 0.020 }, // R4
    { x: 0.250, y: 0.830, z: 0.022 }, // R5
    { x: 0.195, y: 0.828, z: 0.024 }, // R6
    { x: 0.138, y: 0.830, z: 0.025 }, // R7
    { x: 0.088, y: 0.833, z: 0.026 }, // R8 sterno-xiphoid junction
  ];

  {
    const steGrp = new THREE.Group();

    // 2A. Osseous Corpus Sterni (curved boat-keel crista sterni narrowing ventrally, broadening caudally)
    const corpusCurve: Array<{ pos: THREE.Vector3; rx: number; ry: number; ao?: number }> = [
      { pos: V3(0.478, 0.910, 0), rx: 0.022, ry: 0.013, ao: 0.94 }, // Manubrium cranial tip
      { pos: V3(0.415, 0.868, 0), rx: 0.025, ry: 0.014, ao: 0.91 },
      { pos: V3(0.320, 0.838, 0), rx: 0.026, ry: 0.016, ao: 0.92 },
      { pos: V3(0.215, 0.826, 0), rx: 0.023, ry: 0.020, ao: 0.91 },
      { pos: V3(0.115, 0.828, 0), rx: 0.018, ry: 0.024, ao: 0.90 },
      { pos: V3(0.055, 0.832, 0), rx: 0.014, ry: 0.025, ao: 0.88 }, // Xiphoid bony junction
    ];
    steGrp.add(
      buildSculptedTube(
        corpusCurve,
        sMat(),
        16,
        24,
        (theta, u) => {
          const dorsVent = Math.cos(theta); // +1/-1 vertical vs horizontal depends on normal, keep smooth keel
          // Intersternebral slight waists along 6 sternebrae
          const segRipple = 1 - 0.055 * Math.pow(Math.sin(u * Math.PI * 6), 2);
          // Laterally pinched sharp ventral keel in cranial 65%, flatter wider table caudally
          const keelPinch = u < 0.65 && dorsVent < -0.25 ? 0.72 : 1.0;
          return {
            sx: segRipple * 1.05,
            sy: segRipple * keelPinch,
            aoMul: 0.90 + 0.08 * segRipple,
          };
        },
      ),
    );

    // Sculpted bilateral sternocostal notch sockets (incisurae costales) for R1-R8
    for (const sd of [-1, 1] as const) {
      for (let i = 0; i < sternalNotchPositions.length; i++) {
        const np = sternalNotchPositions[i];
        steGrp.add(
          addAoMesh(
            createOrganMesh(
              V3(np.x, np.y, np.z * sd * 0.92),
              [0.010, 0.009, 0.008],
              sMat(),
              undefined,
              8,
            ),
            0.84,
          ),
        );
      }
    }

    // 2B. Cariniform / Manubrium Cartilage Prow (curved upturned cranial crest at X = 0.48..0.525, Y = 0.89..0.935)
    steGrp.add(
      buildSculptedTube(
        [
          { pos: V3(0.472, 0.906, 0), rx: 0.020, ry: 0.011 },
          { pos: V3(0.502, 0.922, 0), rx: 0.019, ry: 0.009 },
          { pos: V3(0.515, 0.942, 0), rx: 0.011, ry: 0.007 },
        ],
        cMat(),
        12,
        10,
      ),
    );

    // 2C. Broad Heart/Paddle-Shaped Xiphoid Cartilage (Cartilago xiphoidea, X = 0.06..-0.085, Z = ±0.044)
    {
      const xRows = 8;
      const xCols = 10;
      const xPts: THREE.Vector3[][] = [];
      const xThick: number[][] = [];
      const xAo: number[][] = [];
      for (let r = 0; r <= xRows; r++) {
        const u = r / xRows; // 0 = narrow sternoxiphoid neck (+0.06), 1 = rounded caudal border (-0.085)
        const x = THREE.MathUtils.lerp(0.062, -0.084, u);
        const halfW = 0.022 + Math.sin(Math.pow(u, 0.65) * Math.PI * 0.92) * 0.024;
        const archY = 0.832 + Math.sin(u * Math.PI) * 0.004;
        const rowP: THREE.Vector3[] = [];
        const rowT: number[] = [];
        const rowAo: number[] = [];
        for (let c = 0; c <= xCols; c++) {
          const v = c / xCols;
          const z = (v - 0.5) * 2 * halfW;
          const bowlY = -Math.sin(v * Math.PI) * 0.004;
          rowP.push(V3(x, archY + bowlY, z));
          rowT.push(0.0045 * (1 - 0.45 * Math.pow(u, 1.5)));
          rowAo.push(0.92);
        }
        xPts.push(rowP);
        xThick.push(rowT);
        xAo.push(rowAo);
      }
      const xNorms = computeGridNormals(xPts, () => V3(0, 1, 0));
      steGrp.add(buildSculptedBonePlateMesh(xPts, xNorms, xThick, xAo, cMat(), 0.30, 0.90));
    }

    push('equ.ske.ste.001', steGrp, 'center', V3(0.24, 0.85, 0));
  }

  // ===========================================================================
  // 3. BILATERAL RIBS R1..R18 (equ.ske.cos.001-i/d .. 018-i/d)
  // Head & Neck + Tubercle articulating with thoracic vertebra + Flattened curved blade with Costal Groove +
  // Sculpted Costal Cartilages: R1-R8 insert directly into Sternum notches; R9-R18 form sweeping Costal Arch!
  // ===========================================================================
  for (const sd of [-1, 1] as const) {
    const tag = sd === -1 ? 'i' : 'd';
    const side = sd === -1 ? 'left' : 'right';

    // Store ventral cartilage points for R8-R18 so each asternal cartilage curves cleanly onto the preceding cartilage
    const prevCartilageTargets: THREE.Vector3[] = [];

    for (let r = 1; r <= 18; r++) {
      const arc = ribArcPoints(r, sd); // [0]=vert origin, [1]=upper curve, [2]=barrel widest, [3]=ventral osseous, [4]=sternum/arch end
      const [vx, vy] = thoracicPos(r);
      const isSternal = r <= 8;

      const ribGrp = new THREE.Group();

      // 3A. Costovertebral Head (caput costae) -> Neck -> Raised Tubercle (tuberculum costae)
      const ribHead = V3(vx + 0.011, vy - 0.010, 0.020 * sd);
      const ribTubercle = V3(vx - 0.002, vy - 0.003, 0.034 * sd);
      ribGrp.add(
        addAoMesh(
          createOrganMesh(ribHead, [0.0075, 0.0075, 0.0075], sMat(), undefined, 8),
          0.90,
        ),
      );
      ribGrp.add(
        addAoMesh(
          createOrganMesh(ribTubercle, [0.0085, 0.0075, 0.007], sMat(), undefined, 8),
          0.95,
        ),
      );

      // 3B. Osseous Rib Shaft (Corpus costae): flat wide curved blade with Costal Groove AO
      // R1 is stout & broad near ventral sternal end; R5-R9 widest flattened blades; R14-R18 slender & rounded
      const widthScale =
        r === 1 ? 1.15 : r <= 4 ? 1.02 : r <= 9 ? 1.24 : r <= 13 ? 1.05 : Math.max(0.70, 1.05 - (r - 13) * 0.07);
      const bladeHalfW = 0.0125 * widthScale;
      const bladeHalfT = 0.0058 * (r === 1 ? 1.18 : r >= 14 ? 0.85 : 1.0);

      // Ventral osseous junction (costochondral junction)
      const pCostochondral = isSternal
        ? arc[3].clone().lerp(arc[4], 0.22)
        : arc[2].clone().lerp(arc[3], 0.82 - (r - 9) * 0.035); // Asternal osseous tips step dorsally & caudally along flank!

      const osseousCurvePts = [
        ribHead,
        ribTubercle,
        arc[1],
        arc[2],
        pCostochondral,
      ];

      ribGrp.add(
        buildSculptedTube(
          osseousCurvePts.map((pos, idx) => ({
            pos,
            rx: bladeHalfT * (idx <= 1 ? 0.9 : idx === 4 ? 0.88 : 1.0),
            ry: bladeHalfW * (idx === 0 ? 0.65 : idx === 1 ? 0.78 : idx === 4 ? 0.85 : 1.0),
            ao: idx === 0 ? 0.88 : 0.94,
          })),
          sMat(),
          12,
          20,
          (theta, u) => {
            const c = Math.cos(theta); // inward/outward thickness axis
            const s = Math.sin(theta); // cranial/caudal blade width axis
            const midSwelling = 1 + 0.16 * Math.sin(u * Math.PI);
            // Costal groove concavity along medial/caudal aspect
            const costalGroove = c < -0.25 && s < -0.15 && u > 0.15 && u < 0.85 ? 0.72 : 1.0;
            const grooveAo = costalGroove < 1.0 ? 0.78 : s > 0.4 ? 1.03 : 0.96;
            return {
              sx: costalGroove,
              sy: midSwelling,
              aoMul: grooveAo,
            };
          },
        ),
      );

      // 3C. Costal Cartilage (Cartilago costalis)
      if (isSternal) {
        // Sternal Ribs R1..R8 curve medially & slightly cranially directly into Sternum costal notches!
        const np = sternalNotchPositions[r - 1];
        const notchPt = V3(np.x, np.y, np.z * sd);
        const cartMid = pCostochondral
          .clone()
          .lerp(notchPt, 0.52)
          .add(V3(-0.008, -0.016, 0.006 * sd));

        ribGrp.add(
          buildSculptedTube(
            [
              { pos: pCostochondral, rx: bladeHalfT * 0.84, ry: bladeHalfW * 0.76 },
              { pos: cartMid, rx: bladeHalfT * 0.76, ry: bladeHalfW * 0.66 },
              { pos: notchPt, rx: bladeHalfT * 0.68, ry: bladeHalfW * 0.58 },
            ],
            cMat(),
            10,
            10,
          ),
        );
        if (r === 8) {
          prevCartilageTargets.push(cartMid.clone().lerp(notchPt, 0.55));
        }
      } else {
        // Asternal Ribs R9..R18 sweep cranioventromedially onto preceding cartilage -> Costal Arch!
        const anchorTarget =
          prevCartilageTargets[prevCartilageTargets.length - 1] ??
          V3(0.088, 0.833, 0.026 * sd);
        const joinPt = anchorTarget.clone().add(V3(-0.022, 0.006, 0.005 * sd));
        const midCart = pCostochondral
          .clone()
          .lerp(joinPt, 0.5)
          .add(V3(0.004, -0.012, 0.008 * sd));

        ribGrp.add(
          buildSculptedTube(
            [
              { pos: pCostochondral, rx: bladeHalfT * 0.78, ry: bladeHalfW * 0.72 },
              { pos: midCart, rx: bladeHalfT * 0.66, ry: bladeHalfW * 0.56 },
              { pos: joinPt, rx: bladeHalfT * 0.45, ry: bladeHalfW * 0.38 },
            ],
            cMat(),
            8,
            10,
          ),
        );
        prevCartilageTargets.push(pCostochondral.clone().lerp(midCart, 0.62));
      }

      push(`equ.ske.cos.${String(r).padStart(3, '0')}-${tag}`, ribGrp, side, arc[2]);
    }
  }
}
