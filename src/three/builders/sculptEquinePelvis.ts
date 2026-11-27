import * as THREE from 'three';
import { caudalPos, hindlimbLandmarks, lumbarPos, sacralPos, V3 } from '../anatomyCoords';
import { createOrganMesh } from './geomHelpers';

export interface SculptedPelvisBuildContext {
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
    const endTaper = i === 0 ? 0.62 : i === uSegs ? 0.60 : 1.0;

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
 * Builds sculpted equine Lumbar Vertebrae (L1..L6), Sacral Vertebrae (S1..S5),
 * Caudal/Coccygeal Vertebrae (Cd1..Cd21), and bilateral Os Coxae (equ.ske.mpe.001-i/d).
 */
export function buildSculptedPelvisParts(ctx: SculptedPelvisBuildContext): void {
  const { sculptedBoneMat, push } = ctx;
  const sMat = () => sculptedBoneMat();

  // ===========================================================================
  // 1. LUMBAR VERTEBRAE (equ.ske.lum.001 .. 006)
  // Broad horizontal wing-like transverse processes (with L5-L6 cranial curve & intertransverse joints),
  // cupped mammillary/articular processes, ventral keel fading caudally, & cranially tilted spinous blades
  // ===========================================================================
  for (let l = 1; l <= 6; l++) {
    const [x, y] = lumbarPos(l);
    const [nx, ny] = lumbarPos(Math.max(1, l - 1));
    const [px, py] = lumbarPos(Math.min(6, l + 1));
    const fwd = V3(nx - px, ny - py, 0);
    if (fwd.lengthSq() < 1e-6) fwd.set(1, 0, 0);
    fwd.normalize();

    const g = new THREE.Group();
    const halfBody = 0.025;
    const bodyR = 0.0225 + (l >= 5 ? 0.002 : 0);

    // 1A. Hourglass heart-shaped centrum + ventral crest (crista ventralis)
    g.add(
      buildSculptedTube(
        [
          { pos: V3(x - fwd.x * halfBody, y - fwd.y * halfBody, 0), rx: bodyR * 1.12, ry: bodyR * 1.16, ao: 0.86 },
          { pos: V3(x, y, 0), rx: bodyR * 0.82, ry: bodyR * 0.86, ao: 0.91 },
          { pos: V3(x + fwd.x * halfBody, y + fwd.y * halfBody, 0), rx: bodyR * 1.10, ry: bodyR * 1.14, ao: 0.90 },
        ],
        sMat(),
        14,
        (theta, u) => {
          const ventral = Math.cos(theta); // -1 ventral
          const keelStrength = l <= 4 ? 0.22 - (l - 1) * 0.03 : 0.06;
          const ventralKeel = ventral < -0.55 ? 1 + keelStrength * Math.sin(u * Math.PI) : 1.0;
          const dorsalFlat = ventral > 0.45 ? 0.82 : 1.0;
          return {
            sx: ventralKeel * dorsalFlat,
            sy: 1.15 - 0.10 * Math.abs(ventral),
            aoMul: ventral < -0.55 ? 1.05 : ventral > 0.35 ? 0.82 : 0.97,
          };
        },
        true,
      ),
    );

    // 1B. Neural arch enclosing spinal canal
    g.add(buildVertebralCanalArch(V3(x, y + 0.015, 0), 0.018, 0.014, 0.0048, 0.038, sMat()));

    // 1C. Broad, horizontally flattened Transverse Processes (Processus costarii)
    // Span profile matches equine reference: L1 shorter, L3-L4 widest (~0.124m), L5-L6 curving cranially
    const spanByL = [0.088, 0.106, 0.122, 0.124, 0.114, 0.102][l - 1];
    const sweepCranial = l === 1 ? -0.004 : l === 2 ? 0.0 : l === 3 ? 0.005 : l === 4 ? 0.010 : l === 5 ? 0.018 : 0.025;
    const widthChord = l <= 4 ? 0.021 : 0.022;

    for (const sd of [-1, 1] as const) {
      const rSegs = 8;
      const cSegs = 5;
      const tPts: THREE.Vector3[][] = [];
      const tThick: number[][] = [];
      const tAo: number[][] = [];
      for (let r = 0; r <= rSegs; r++) {
        const u = r / rSegs; // 0 = root pedicle, 1 = lateral tip
        const z = (0.016 + (spanByL - 0.016) * u) * sd;
        const cranShift = Math.pow(u, 1.35) * sweepCranial;
        const archDroop = -Math.pow(u, 1.6) * 0.004 + (l >= 5 ? u * 0.006 : 0);
        const taper = 1 - 0.32 * Math.pow(u, 2.2);
        const rowP: THREE.Vector3[] = [];
        const rowT: number[] = [];
        const rowAo: number[] = [];
        for (let c = 0; c <= cSegs; c++) {
          const v = c / cSegs; // 0 = caudal edge, 1 = cranial edge
          const localX = (v - 0.5) * 2 * widthChord * taper;
          rowP.push(V3(x + localX + cranShift, y + 0.008 + archDroop, z));
          rowT.push(0.0042 - u * 0.0014);
          rowAo.push(u < 0.25 ? 0.78 + u * 0.6 : 0.94 - 0.08 * Math.abs(v - 0.5));
        }
        tPts.push(rowP);
        tThick.push(rowT);
        tAo.push(rowAo);
      }
      const tNorms = computeGridNormals(tPts, () => V3(0, 1, 0));
      g.add(buildSculptedBonePlateMesh(tPts, tNorms, tThick, tAo, sMat(), 0.30, 0.85));

      // Cranial Mammillary / Articular Processes (upward cupped zygapophyses) + Caudal interlocking tongue
      g.add(
        addAoMesh(
          createOrganMesh(
            V3(x + 0.022, y + 0.032, 0.019 * sd),
            [0.013, 0.011, 0.008],
            sMat(),
            [0.2 * sd, 0.15 * sd, -0.2],
            10,
          ),
          0.95,
        ),
      );
      g.add(
        addAoMesh(
          createOrganMesh(
            V3(x - 0.022, y + 0.028, 0.014 * sd),
            [0.011, 0.008, 0.006],
            sMat(),
            [0, 0, 0.1],
            8,
          ),
          0.86,
        ),
      );
    }

    // 1D. Cranially Inclined Sculpted Spinous Process (Processus spinosus)
    const spineH = l === 1 ? 0.068 : l <= 4 ? 0.072 : l === 5 ? 0.068 : 0.063;
    const spRows = 7;
    const spCols = 5;
    const sPts: THREE.Vector3[][] = [];
    const sThick: number[][] = [];
    const sAo: number[][] = [];
    for (let r = 0; r <= spRows; r++) {
      const u = r / spRows; // 0 = neural arch base, 1 = dorsal summit
      const tipBell = Math.exp(-Math.pow((1 - u) / 0.16, 2));
      const tiltX = u * 0.010;
      const baseW = 0.018 * (1 - 0.10 * Math.sin(u * Math.PI * 0.7));
      const rowP: THREE.Vector3[] = [];
      const rowT: number[] = [];
      const rowAo: number[] = [];
      for (let c = 0; c <= spCols; c++) {
        const v = c / spCols;
        rowP.push(V3(x + tiltX + (v - 0.5) * 2 * baseW, y + 0.028 + u * spineH, 0));
        rowT.push(0.0046 + tipBell * 0.0028);
        rowAo.push(0.84 + 0.14 * u);
      }
      sPts.push(rowP);
      sThick.push(rowT);
      sAo.push(rowAo);
    }
    const sNorms = computeGridNormals(sPts, () => V3(0, 0, 1));
    g.add(buildSculptedBonePlateMesh(sPts, sNorms, sThick, sAo, sMat(), 0.42, 0.96));

    push(`equ.ske.lum.${String(l).padStart(3, '0')}`, g, 'center', V3(x, y + 0.025, 0));
  }

  // ===========================================================================
  // 2. SACRUM (equ.ske.sac.001 .. 005)
  // Individually selectable S1..S5 segments forming the equine triangular Os Sacrum:
  // Broad auricular wings on S1 hugging S1-ilium joint, dorsal/ventral sacral foramina,
  // tapering lateral sacral crest, & separate-tipped caudodorsally inclined spinous processes
  // ===========================================================================
  for (let s = 1; s <= 5; s++) {
    const [x, y] = sacralPos(s);
    const [nx, ny] = sacralPos(Math.max(1, s - 1));
    const [px, py] = sacralPos(Math.min(5, s + 1));
    const fwd = V3(nx - px, ny - py, 0);
    if (fwd.lengthSq() < 1e-6) fwd.set(0.95, 0.31, 0);
    fwd.normalize();

    const g = new THREE.Group();
    const wingW = [0.092, 0.058, 0.039, 0.030, 0.024][s - 1];
    const bodyRx = 0.017 - (s - 1) * 0.0018;
    const bodyZ = [0.032, 0.026, 0.022, 0.019, 0.016][s - 1];

    // 2A. Dorsoventrally compressed Sacral Segment Body (Promontory on S1)
    g.add(
      buildSculptedTube(
        [
          { pos: V3(x - fwd.x * 0.027, y - fwd.y * 0.027, 0), rx: bodyRx, ry: bodyZ * 0.94, ao: 0.85 },
          { pos: V3(x, y, 0), rx: bodyRx * 0.95, ry: bodyZ, ao: 0.90 },
          { pos: V3(x + fwd.x * 0.027, y + fwd.y * 0.027, 0), rx: bodyRx * (s === 1 ? 1.15 : 1.0), ry: bodyZ * 1.06, ao: 0.91 },
        ],
        sMat(),
        14,
        (theta) => {
          const vent = Math.cos(theta);
          return {
            sx: vent > 0.3 ? 0.72 : 1.0,
            sy: 1.0,
            aoMul: vent < -0.2 ? 0.88 : 0.98,
          };
        },
        s === 5,
      ),
    );

    // 2B. Dorsal Sacral Roof / Vertebral Canal Arch
    g.add(
      buildVertebralCanalArch(
        V3(x, y + 0.012, 0),
        Math.max(0.011, 0.018 - s * 0.0014),
        Math.max(0.009, 0.013 - s * 0.0008),
        0.0046,
        0.052,
        sMat(),
      ),
    );

    // 2C. Bilateral Pars Lateralis / Sacral Wings (Alae ossis sacri on S1 + Lateral Sacral Crest on S2-S5)
    for (const sd of [-1, 1] as const) {
      if (s === 1) {
        // Massive upturned triangular Alae ossis sacri curving outward & dorsally to meet Ilium Tuber Sacrale & Auricular Surface
        const wRows = 9;
        const wCols = 6;
        const aPts: THREE.Vector3[][] = [];
        const aThick: number[][] = [];
        const aAo: number[][] = [];

        for (let r = 0; r <= wRows; r++) {
          const u = r / wRows; // 0 = sacral body junction, 1 = lateral auricular tip
          const z = (0.024 + (wingW - 0.024) * u) * sd;
          const upSweep = Math.pow(u, 1.35) * 0.030;
          const caudSweep = -Math.pow(u, 1.2) * 0.018;
          const chordX = THREE.MathUtils.lerp(0.026, 0.032, Math.sin(u * Math.PI * 0.7));
          const rowP: THREE.Vector3[] = [];
          const rowT: number[] = [];
          const rowAo: number[] = [];
          for (let c = 0; c <= wCols; c++) {
            const v = c / wCols; // 0 = caudal border, 1 = cranial facet facing L6
            const localX = (v - 0.5) * 2 * chordX;
            rowP.push(V3(x + localX + caudSweep, y + 0.005 + upSweep, z));
            rowT.push(0.0075 + Math.sin(u * Math.PI) * 0.004);
            // Darken cranial & caudal intersegmental recesses / sacral foramina
            const foramen = v < 0.2 && u > 0.25 && u < 0.65 ? 0.22 : 0;
            rowAo.push(0.92 - foramen - (u > 0.7 ? 0.06 : 0));
          }
          aPts.push(rowP);
          aThick.push(rowT);
          aAo.push(rowAo);
        }
        const aNorms = computeGridNormals(aPts, () => V3(0.25, 0.90, -0.35 * sd).normalize());
        g.add(buildSculptedBonePlateMesh(aPts, aNorms, aThick, aAo, sMat(), 0.35, 0.88));

        // Wide cranial articular process clasping L6
        g.add(
          addAoMesh(
            createOrganMesh(V3(x + 0.026, y + 0.026, 0.022 * sd), [0.014, 0.011, 0.011], sMat(), [0.2 * sd, 0, -0.2], 10),
            0.94,
          ),
        );
      } else {
        // S2..S5 tapering Lateral Sacral Crest + Ventral/Dorsal Sacral Foramina notches
        const nextW = s < 5 ? [0.092, 0.058, 0.039, 0.030, 0.024][s] : 0.020;
        const rSegs = 6;
        const cSegs = 6;
        const pPts: THREE.Vector3[][] = [];
        const pThick: number[][] = [];
        const pAo: number[][] = [];

        for (let r = 0; r <= rSegs; r++) {
          const u = r / rSegs; // 0 = body lateral edge, 1 = undulating lateral crest edge
          const rowP: THREE.Vector3[] = [];
          const rowT: number[] = [];
          const rowAo: number[] = [];
          for (let c = 0; c <= cSegs; c++) {
            const v = c / cSegs; // 0 = caudal, 1 = cranial
            const edgeSpan = THREE.MathUtils.lerp(nextW, wingW, v);
            const z = (bodyZ * 0.72 + (edgeSpan - bodyZ * 0.72) * u) * sd;
            const localX = (v - 0.5) * 0.054;
            // Scallop/pinch around cranial & caudal dorsal sacral foramina
            const notch = (v < 0.22 || v > 0.78) && u > 0.15 && u < 0.60 ? 0.003 : 0;
            rowP.push(V3(x + localX, y + 0.005 + u * 0.004 - notch, z));
            rowT.push(0.0052 - u * 0.0015);
            rowAo.push(0.88 - notch * 80);
          }
          pPts.push(rowP);
          pThick.push(rowT);
          pAo.push(rowAo);
        }
        const pNorms = computeGridNormals(pPts, () => V3(0, 1, 0));
        g.add(buildSculptedBonePlateMesh(pPts, pNorms, pThick, pAo, sMat(), 0.36, 0.82));
      }
    }

    // 2D. Separate-Summit Caudodorsally Swept Sacral Spinous Process (S1 tallest -> S5 lowest)
    const spHeight = [0.066, 0.064, 0.056, 0.049, 0.041][s - 1];
    const spTiltX = -0.022 + (s - 1) * 0.001;
    const spRows = 7;
    const spCols = 5;
    const spPts: THREE.Vector3[][] = [];
    const spThick: number[][] = [];
    const spAo: number[][] = [];
    for (let r = 0; r <= spRows; r++) {
      const u = r / spRows;
      const tipBell = Math.exp(-Math.pow((1 - u) / 0.18, 2));
      const chord = 0.017 * (1 - 0.22 * u);
      const rowP: THREE.Vector3[] = [];
      const rowT: number[] = [];
      const rowAo: number[] = [];
      for (let c = 0; c <= spCols; c++) {
        const v = c / spCols;
        rowP.push(V3(x + spTiltX * u + (v - 0.5) * 2 * chord, y + 0.020 + u * spHeight, 0));
        rowT.push(0.0048 + tipBell * 0.0032);
        rowAo.push(0.82 + 0.16 * u);
      }
      spPts.push(rowP);
      spThick.push(rowT);
      spAo.push(rowAo);
    }
    const spNorms = computeGridNormals(spPts, () => V3(0, 0, 1));
    g.add(buildSculptedBonePlateMesh(spPts, spNorms, spThick, spAo, sMat(), 0.42, 0.96));

    push(`equ.ske.sac.${String(s).padStart(3, '0')}`, g, 'center', V3(x, y, 0));
  }

  // ===========================================================================
  // 3. BILATERAL OS COXAE (equ.ske.mpe.001-i & equ.ske.mpe.001-d)
  // Wing of Ilium (concave gluteal fossa, sharp iliac crest, Tuber sacrale, four-cornered Tuber coxae)
  // + Trihedral Ilial Shaft (gluteal line, arcuate line, greater ischiatic notch) + Ischiatic Spine +
  // Horseshoed Lunate Acetabulum + Open Obturator Foramen + Concave Ischial Table & Hooked Tuber Ischii
  // ===========================================================================
  for (const sd of [-1, 1] as const) {
    const tag = sd === -1 ? 'i' : 'd';
    const side = sd === -1 ? 'left' : 'right';
    const hl = hindlimbLandmarks(sd);

    const lm = {
      tuberSacrale: hl.tuberSacrale,
      tuberCoxae: hl.tuberCoxae,
      acetabulum: hl.acetabulum,
      tuberIschii: hl.tuberIschii,
      pubicPecten: V3(-0.79, 1.072, 0.005 * sd),
      ischialArch: V3(-0.962, 1.088, 0.011 * sd),
      ischiaticSpine: V3(-0.868, 1.186, 0.112 * sd),
    };

    const coxGrp = new THREE.Group();

    // 3A. Wing of the Ilium (Ala ossis ilii): 16x10 sculpted bone plate with AO gluteal fossa
    const neckPt = lm.tuberSacrale
      .clone()
      .lerp(lm.tuberCoxae, 0.48)
      .lerp(lm.acetabulum, 0.42)
      .add(V3(-0.010, 0.005, 0));

    const uSegs = 16; // 0 = tuber sacrale, 1 = tuber coxae
    const vSegs = 10; // 0 = iliac crest, 1 = greater ischiatic notch / neck
    const wPts: THREE.Vector3[][] = [];
    const wThick: number[][] = [];
    const wAo: number[][] = [];

    for (let r = 0; r <= uSegs; r++) {
      const u = r / uSegs;
      const rowP: THREE.Vector3[] = [];
      const rowT: number[] = [];
      const rowAo: number[] = [];

      // Arched iliac crest rim from Tuber sacrale out to Tuber coxae
      const crest = lm.tuberSacrale.clone().lerp(lm.tuberCoxae, u);
      crest.x += Math.sin(u * Math.PI) * 0.026;
      crest.y += Math.sin(u * Math.PI) * 0.014;

      const caudMed = lm.tuberSacrale.clone().add(V3(-0.050, -0.044, 0.012 * sd));
      const caudLat = lm.tuberCoxae.clone().add(V3(-0.038, -0.045, -0.004 * sd));
      const caudBase = caudMed.clone().lerp(caudLat, u);
      const neckPull = Math.exp(-Math.pow((u - 0.5) / 0.34, 2));
      const caudEdge = caudBase.clone().lerp(neckPt, neckPull * 0.84);

      for (let c = 0; c <= vSegs; c++) {
        const v = c / vSegs;
        const p = crest.clone().lerp(caudEdge, v);

        // Concave gluteal fossa across mid-wing + raised gluteal line ridge
        const glutealBowl = Math.sin(u * Math.PI) * Math.sin(v * Math.PI);
        const glutealLine = Math.exp(-Math.pow((v - 0.56) / 0.14, 2)) * Math.sin(u * Math.PI) * 0.004;
        p.y -= glutealBowl * 0.011 - glutealLine;
        p.z -= glutealBowl * 0.006 * sd;

        rowP.push(p);

        const cornerFlare = Math.max(Math.pow(1 - u, 2.2), Math.pow(u, 2.2));
        rowT.push(0.0055 + 0.0065 * cornerFlare + 0.0035 * neckPull * v);
        rowAo.push(0.95 - glutealBowl * 0.24 + glutealLine * 14);
      }
      wPts.push(rowP);
      wThick.push(rowT);
      wAo.push(rowAo);
    }

    const wNorms = computeGridNormals(wPts, () => V3(0.15, 0.94, 0.28 * sd).normalize());
    coxGrp.add(buildSculptedBonePlateMesh(wPts, wNorms, wThick, wAo, sMat(), 0.28, 0.78));

    // Prominent Tuber Sacrale (hooked dorsal medial angle beside S1)
    coxGrp.add(
      addAoMesh(
        createOrganMesh(
          lm.tuberSacrale.clone().add(V3(-0.012, -0.004, 0.003 * sd)),
          [0.028, 0.017, 0.014],
          sMat(),
          [0, 0, 0.36],
          12,
        ),
        0.97,
      ),
    );
    // Quad-lobed Tuber Coxae ("point of hip": dorsal & ventral cranial/caudal tubercles)
    coxGrp.add(
      addAoMesh(
        createOrganMesh(
          lm.tuberCoxae.clone().add(V3(0.004, 0.003, -0.001 * sd)),
          [0.024, 0.021, 0.013],
          sMat(),
          [0.25 * sd, 0.22 * sd, -0.25],
          12,
        ),
        0.98,
      ),
    );
    coxGrp.add(
      addAoMesh(
        createOrganMesh(
          lm.tuberCoxae.clone().add(V3(-0.015, -0.016, 0.002 * sd)),
          [0.022, 0.020, 0.012],
          sMat(),
          [0.2 * sd, 0.15 * sd, 0.2],
          10,
        ),
        0.92,
      ),
    );

    // 3B. Trihedral Iliac Shaft (Corpus ossis ilii) connecting neck -> acetabulum
    coxGrp.add(
      buildSculptedTube(
        [
          { pos: neckPt.clone().add(V3(0.010, 0.020, -0.004 * sd)), rx: 0.019, ry: 0.025, ao: 0.90 },
          { pos: neckPt.clone().lerp(lm.acetabulum, 0.45), rx: 0.016, ry: 0.020, ao: 0.93 },
          { pos: neckPt.clone().lerp(lm.acetabulum, 0.82).add(V3(0.006, 0.006, 0)), rx: 0.019, ry: 0.023, ao: 0.92 },
          { pos: lm.acetabulum.clone().add(V3(0.010, 0.014, -0.005 * sd)), rx: 0.020, ry: 0.024, ao: 0.89 },
        ],
        sMat(),
        14,
        (theta) => {
          // Prismatic 3-angled shaft cross section (gluteal line, arcuate line, lateral crest)
          const tri = 1 + 0.16 * Math.cos(theta * 3);
          return { sx: tri, sy: 0.95, aoMul: 0.88 + 0.12 * Math.max(0, Math.cos(theta * 3)) };
        },
      ),
    );

    // Sharp dorsal Ischiatic Spine (Spina ischiadica) sweeping across greater & lesser ischiatic notches
    coxGrp.add(
      buildSculptedTube(
        [
          { pos: lm.acetabulum.clone().add(V3(0.018, 0.025, -0.018 * sd)), rx: 0.009, ry: 0.012, ao: 0.94 },
          { pos: lm.ischiaticSpine, rx: 0.011, ry: 0.017, ao: 0.97 },
          { pos: lm.ischiaticSpine.clone().lerp(lm.tuberIschii, 0.45).add(V3(0, 0.008, 0)), rx: 0.009, ry: 0.012, ao: 0.92 },
        ],
        sMat(),
        10,
        (theta) => {
          const sharp = Math.abs(Math.sin(theta)) > 0.5 ? 1.15 : 0.72;
          return { sx: sharp, sy: 1.0, aoMul: 0.95 };
        },
      ),
    );

    // 3C. Concave Acetabulum Cup with Horseshoed Lunate Articular Surface & Acetabular Notch
    {
      const outAxis = V3(0.14, -0.28, 0.95 * sd).normalize();
      const refV = V3(0, -1, 0);
      const e2 = new THREE.Vector3().crossVectors(outAxis, refV).normalize();
      const e1 = new THREE.Vector3().crossVectors(e2, outAxis).normalize();

      const innerR = 0.0255;
      const outerR = 0.036;
      const notchHalf = 0.38;
      const phiStart = notchHalf;
      const phiEnd = Math.PI * 2 - notchHalf;
      const phiSegs = 22;
      const thetaSegs = 6;

      const profile: Array<{ r: number; d: number; ao: number }> = [];
      for (let i = 0; i <= thetaSegs; i++) {
        const u = i / thetaSegs;
        const a = u * (Math.PI * 0.52);
        profile.push({
          r: Math.sin(a) * innerR,
          d: (1 - Math.cos(a)) * innerR - 0.012,
          ao: THREE.MathUtils.lerp(0.32, 0.92, u), // deep dark acetabular fossa inside!
        });
      }
      for (let i = thetaSegs; i >= 0; i--) {
        const u = i / thetaSegs;
        const a = u * (Math.PI * 0.52);
        profile.push({
          r: Math.sin(a) * outerR,
          d: (1 - Math.cos(a)) * outerR - 0.020,
          ao: THREE.MathUtils.lerp(0.84, 0.96, u),
        });
      }

      const pCols = profile.length;
      const aPos: number[] = [];
      const aUvs: number[] = [];
      const aCol: number[] = [];
      const aIdx: number[] = [];

      for (let j = 0; j <= phiSegs; j++) {
        const u = j / phiSegs;
        const phi = phiStart + u * (phiEnd - phiStart);
        const radDir = e1.clone().multiplyScalar(Math.cos(phi)).addScaledVector(e2, Math.sin(phi));
        for (let k = 0; k < pCols; k++) {
          const pr = profile[k];
          const pt = lm.acetabulum
            .clone()
            .addScaledVector(radDir, pr.r)
            .addScaledVector(outAxis, pr.d);
          aPos.push(pt.x, pt.y, pt.z);
          aUvs.push(u, k / (pCols - 1));
          const [cr, cg, cb] = sampleAoColor(pr.ao);
          aCol.push(cr, cg, cb);
        }
      }
      for (let j = 0; j < phiSegs; j++) {
        for (let k = 0; k < pCols - 1; k++) {
          const a = j * pCols + k;
          const b = a + 1;
          const d = (j + 1) * pCols + k;
          const e = d + 1;
          aIdx.push(a, d, b, b, d, e);
        }
      }
      const aGeo = new THREE.BufferGeometry();
      aGeo.setAttribute('position', new THREE.Float32BufferAttribute(aPos, 3));
      aGeo.setAttribute('uv', new THREE.Float32BufferAttribute(aUvs, 2));
      aGeo.setAttribute('color', new THREE.Float32BufferAttribute(aCol, 3));
      aGeo.setIndex(aIdx);
      aGeo.computeVertexNormals();
      safeTangents(aGeo);
      const acetMesh = new THREE.Mesh(aGeo, sMat());
      acetMesh.castShadow = true;
      acetMesh.receiveShadow = true;
      coxGrp.add(acetMesh);
    }

    // 3D. Pubic & Ischial Pelvic Floor Framing Open Obturator Foramen + Hooked Tuber Ischii
    {
      const acetCranV = lm.acetabulum.clone().add(V3(0.014, -0.018, -0.014 * sd));
      const acetCaudV = lm.acetabulum.clone().add(V3(-0.018, -0.016, -0.012 * sd));
      const symphMid = lm.pubicPecten.clone().lerp(lm.ischialArch, 0.52).add(V3(0, -0.004, 0));

      // Cranial Pubic Ramus + Iliopubic Eminence + Pubic Pecten ridge
      coxGrp.add(
        buildSculptedTube(
          [
            { pos: acetCranV, rx: 0.0145, ry: 0.0125, ao: 0.88 },
            { pos: acetCranV.clone().lerp(lm.pubicPecten, 0.45).add(V3(0.004, 0.002, 0)), rx: 0.014, ry: 0.010, ao: 0.94 },
            { pos: lm.pubicPecten, rx: 0.0155, ry: 0.011, ao: 0.90 },
          ],
          sMat(),
          12,
        ),
      );

      // Symphyseal Ramus along pelvic midline
      coxGrp.add(
        buildSculptedTube(
          [
            { pos: lm.pubicPecten, rx: 0.013, ry: 0.010, ao: 0.87 },
            { pos: symphMid, rx: 0.013, ry: 0.010, ao: 0.89 },
            { pos: lm.ischialArch, rx: 0.014, ry: 0.011, ao: 0.86 },
          ],
          sMat(),
          10,
        ),
      );

      // Lateral Ischial Body sweeping out to Tuber Ischii
      const ischLatMid = acetCaudV.clone().lerp(lm.tuberIschii, 0.52).add(V3(0, 0.004, -0.004 * sd));
      coxGrp.add(
        buildSculptedTube(
          [
            { pos: acetCaudV, rx: 0.015, ry: 0.013, ao: 0.88 },
            { pos: ischLatMid, rx: 0.014, ry: 0.014, ao: 0.92 },
            { pos: lm.tuberIschii, rx: 0.0185, ry: 0.0165, ao: 0.96 },
          ],
          sMat(),
          12,
        ),
      );

      // Concave Broad Ischial Table (Tabula ossis ischii) with concave caudal Ischial Arch
      const tRows = 8;
      const tCols = 8;
      const tPts: THREE.Vector3[][] = [];
      const tThick: number[][] = [];
      const tAo: number[][] = [];
      const medObtCaud = symphMid.clone().lerp(lm.ischialArch, 0.58);
      const latObtCaud = ischLatMid.clone().lerp(lm.tuberIschii, 0.42);
      for (let r = 0; r <= tRows; r++) {
        const u = r / tRows;
        const cranE = medObtCaud.clone().lerp(latObtCaud, u);
        const caudE = lm.ischialArch.clone().lerp(lm.tuberIschii, u);
        caudE.x += Math.sin(u * Math.PI) * 0.014; // sharp V-shaped equine ischial arch!
        const rP: THREE.Vector3[] = [];
        const rT: number[] = [];
        const rAo: number[] = [];
        for (let c = 0; c <= tCols; c++) {
          const v = c / tCols;
          const p = cranE.clone().lerp(caudE, v);
          const bowl = Math.sin(u * Math.PI) * Math.sin(v * Math.PI);
          p.y -= bowl * 0.005;
          rP.push(p);
          rT.push(0.006 + 0.003 * u * v);
          rAo.push(0.92 - bowl * 0.22);
        }
        tPts.push(rP);
        tThick.push(rT);
        tAo.push(rAo);
      }
      const tNorms = computeGridNormals(tPts, () => V3(0, 1, 0));
      coxGrp.add(buildSculptedBonePlateMesh(tPts, tNorms, tThick, tAo, sMat(), 0.34, 0.80));

      // Heavy Trilobed Hooked Tuber Ischii (pin bone curving laterally & caudodorsally)
      coxGrp.add(
        addAoMesh(
          createOrganMesh(
            lm.tuberIschii.clone().add(V3(-0.005, 0.004, 0.003 * sd)),
            [0.023, 0.021, 0.017],
            sMat(),
            [0, -0.3 * sd, 0.28],
            12,
          ),
          0.97,
        ),
      );
    }

    push(`equ.ske.mpe.001-${tag}`, coxGrp, side);
  }

  // ===========================================================================
  // 4. CAUDAL / COCCYGEAL VERTEBRAE (equ.ske.cau.001 .. 021)
  // Proximal Cd1-Cd3 with real dorsal neural arch & flared transverse wings;
  // Cd4-Cd6 transitional ridges; Cd7-Cd21 hourglass coccygeal bodies
  // ===========================================================================
  const getCau = (idx: number): [number, number] => {
    const [bx, by] = caudalPos(Math.min(idx, 18));
    const ext = Math.max(idx - 18, 0);
    return [bx - 0.02 * ext, by - 0.035 * ext];
  };

  for (let ca = 1; ca <= 21; ca++) {
    const [x, y] = getCau(ca);
    const [px, py] = getCau(Math.max(1, ca - 1));
    const [nx, ny] = getCau(Math.min(21, ca + 1));
    const dir = V3(nx - px, ny - py, 0);
    if (dir.lengthSq() < 1e-6) dir.set(-1, -0.2, 0);
    dir.normalize();

    const id = `equ.ske.cau.${String(ca).padStart(3, '0')}`;
    const rMid = Math.max(0.0045, 0.0125 - ca * 0.00044);
    const rEnds = Math.max(0.0062, 0.0175 - ca * 0.00060);
    const halfLen = Math.max(0.0125, 0.019 - ca * 0.0003);

    const cGrp = new THREE.Group();
    const pCaud = V3(x - dir.x * halfLen, y - dir.y * halfLen, 0);
    const pMid = V3(x, y, 0);
    const pCran = V3(x + dir.x * halfLen, y + dir.y * halfLen, 0);

    // Hourglass coccygeal centrum
    cGrp.add(
      buildSculptedTube(
        [
          { pos: pCaud, rx: rEnds, ry: rEnds * 0.94, ao: 0.87 },
          { pos: pMid, rx: rMid, ry: rMid * 0.92, ao: 0.93 },
          { pos: pCran, rx: rEnds, ry: rEnds * 0.94, ao: 0.89 },
        ],
        sMat(),
        10,
        undefined,
        false,
      ),
    );

    // Proximal Cd1..Cd6 feature flared transverse processes & dorsal neural arch / hemal-mammillary ridges
    if (ca <= 6) {
      const wingSpan = ca === 1 ? 0.030 : ca === 2 ? 0.025 : ca === 3 ? 0.021 : ca === 4 ? 0.017 : ca === 5 ? 0.014 : 0.011;
      for (const sd of [-1, 1] as const) {
        cGrp.add(
          buildSculptedTube(
            [
              { pos: V3(x - dir.x * 0.003, y + 0.002, (rMid * 0.65) * sd), rx: 0.0055, ry: 0.0085, ao: 0.88 },
              { pos: V3(x - dir.x * 0.006, y + 0.001, wingSpan * sd), rx: 0.0038, ry: 0.0065, ao: 0.95 },
            ],
            sMat(),
            8,
          ),
        );
      }

      if (ca <= 4) {
        // Real neural arch on Cd1..Cd3, open dorsal groove ridges on Cd4
        cGrp.add(
          buildVertebralCanalArch(
            V3(x, y + rMid * 0.72, 0),
            0.009 - ca * 0.001,
            0.0085 - ca * 0.001,
            0.0032,
            0.022,
            sMat(),
          ),
        );
        // Short caudodorsally inclined spinous ridge
        cGrp.add(
          addAoMesh(
            createOrganMesh(
              V3(x - dir.x * 0.005, y + rMid + 0.011 - ca * 0.0015, 0),
              [0.009, 0.008 - ca * 0.001, 0.0038],
              sMat(),
              [0, 0, -0.35],
              8,
            ),
            0.94,
          ),
        );
      }
    }

    push(id, cGrp, 'center', pMid);
  }
}
