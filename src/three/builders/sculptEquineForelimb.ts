import * as THREE from 'three';
import { forelimbLandmarks, V3 } from '../anatomyCoords';
import { createOrganMesh } from './geomHelpers';

export interface SculptedForelimbBuildContext {
  boneMat: () => THREE.Material;
  darkBoneMat: () => THREE.Material;
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

function buildSculptedBonePlateMesh(
  pts: THREE.Vector3[][],
  norms: THREE.Vector3[][],
  thick: number[][],
  aoGrid: number[][],
  mat: THREE.Material,
  edgeScale = 0.32,
  innerAoBias = 0.80,
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

/**
 * Builds a high-detail closed sculpted long-bone or organic tubular mesh along a spline
 * with full radial (theta) + axial (u) cross-section shaping, bicondylar/fossa sculpting,
 * and vertex-color cavity AO shading.
 * Local frame around each curve point:
 *  - `cranDir` (+cos theta): cranial/dorsal face of bone
 *  - `latDir` (+sin theta): lateral (+sd) / medial (-sd) face of bone
 */
function buildSculptedShaft(
  points: THREE.Vector3[],
  sd: -1 | 1,
  mat: THREE.Material,
  uSegs: number,
  radialSegs: number,
  profileAt: (u: number, theta: number) => {
    rCran: number;
    rLat: number;
    offsetCran?: number;
    offsetLat?: number;
    ao?: number;
  },
  capBias?: { proxDip?: number; distDip?: number },
): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(points);
  const positions: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const worldZ = new THREE.Vector3(0, 0, sd);

  for (let i = 0; i <= uSegs; i++) {
    const u = i / uSegs;
    const center = curve.getPointAt(u);
    const tan = curve.getTangentAt(u).normalize(); // proximal -> distal
    // latDir points laterally (+Z*sd); cranDir points cranially/dorsally perpendicular to shaft
    const cranDir = new THREE.Vector3().crossVectors(worldZ, tan);
    if (cranDir.lengthSq() < 1e-6) {
      cranDir.set(1, 0, 0);
    }
    cranDir.normalize();
    const latDir = new THREE.Vector3().crossVectors(tan, cranDir).normalize();

    const endTaper = i === 0 ? 0.72 : i === uSegs ? 0.72 : 1.0;

    for (let j = 0; j <= radialSegs; j++) {
      const v = j / radialSegs;
      const theta = v * Math.PI * 2;
      const prof = profileAt(u, theta);
      const cVal = Math.cos(theta);
      const sVal = Math.sin(theta);

      const p = center
        .clone()
        .addScaledVector(cranDir, (cVal * prof.rCran * endTaper) + (prof.offsetCran ?? 0))
        .addScaledVector(latDir, (sVal * prof.rLat * endTaper) + (prof.offsetLat ?? 0));

      positions.push(p.x, p.y, p.z);
      uvs.push(u, v);

      const [cr, cg, cb] = sampleAoColor(prof.ao ?? 0.92);
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
      // Note winding check: tan points prox->distal, cran x lat = +tan, so (a,d,b) faces outward!
      indices.push(a, d, b, b, d, c);
    }
  }

  const pStart = curve.getPointAt(0);
  const tStart = curve.getTangentAt(0).normalize();
  const startTip = pStart.clone().addScaledVector(tStart, capBias?.proxDip ?? -0.004);
  const startCenterIdx = positions.length / 3;
  positions.push(startTip.x, startTip.y, startTip.z);
  uvs.push(0, 0.5);
  const [sr, sg, sb] = sampleAoColor(0.84);
  colors.push(sr, sg, sb);
  for (let j = 0; j < radialSegs; j++) {
    indices.push(startCenterIdx, j, j + 1);
  }

  const pEnd = curve.getPointAt(1);
  const tEnd = curve.getTangentAt(1).normalize();
  const endTip = pEnd.clone().addScaledVector(tEnd, capBias?.distDip ?? 0.004);
  const endCenterIdx = positions.length / 3;
  positions.push(endTip.x, endTip.y, endTip.z);
  uvs.push(1, 0.5);
  const [er, eg, eb] = sampleAoColor(0.84);
  colors.push(er, eg, eb);
  const lastRing = uSegs * stride;
  for (let j = 0; j < radialSegs; j++) {
    indices.push(endCenterIdx, lastRing + j + 1, lastRing + j);
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

/**
 * Builds a beveled faceted carpal stone with subtle dorsal tendon grooves and cavity AO.
 */
function buildSculptedCarpalStone(
  center: THREE.Vector3,
  size: [number, number, number],
  mat: THREE.Material,
  rot: [number, number, number] = [0, 0, 0],
  bevelPower = 0.62,
  palmarTaper = 0.85,
  aoBase = 0.92,
): THREE.Mesh {
  const geo = new THREE.SphereGeometry(0.5, 14, 12);
  const pos = geo.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  const [sx, sy, sz] = size;

  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i) * 2;
    const ny = pos.getY(i) * 2;
    const nz = pos.getZ(i) * 2;
    const bx = Math.sign(nx) * Math.pow(Math.abs(nx), bevelPower);
    const by = Math.sign(ny) * Math.pow(Math.abs(ny), bevelPower);
    const bz = Math.sign(nz) * Math.pow(Math.abs(nz), bevelPower);

    // Subtle palmar narrowing (equine carpals wedge slightly caudally)
    const palFactor = bx < 0 ? THREE.MathUtils.lerp(1.0, palmarTaper, -bx) : 1.0;
    // Slight dorsal concave facet depression in center of dorsal face
    const dorsalFacet = bx > 0.4 ? Math.exp(-(by * by + bz * bz) * 1.8) * 0.04 : 0;

    pos.setXYZ(
      i,
      bx * sx * 0.5 - dorsalFacet * sx * 0.5,
      by * sy * 0.5 * palFactor,
      bz * sz * 0.5 * palFactor,
    );

    const rimDark = 0.86 + 0.14 * (1 - Math.abs(by));
    const [cr, cg, cb] = sampleAoColor(aoBase * rimDark - (bx < -0.3 ? 0.08 : 0));
    colors[i * 3] = cr;
    colors[i * 3 + 1] = cg;
    colors[i * 3 + 2] = cb;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  geo.computeTangents();

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(center);
  mesh.rotation.set(...rot);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function buildSculptedForelimbParts(ctx: SculptedForelimbBuildContext): void {
  const { sculptedBoneMat, cartMat, push } = ctx;
  const sMat = () => sculptedBoneMat();

  for (const sd of [-1, 1] as const) {
    const tag = sd === -1 ? 'i' : 'd';
    const side = sd === -1 ? 'left' : 'right';
    const fl = forelimbLandmarks(sd);

    // =========================================================================
    // 1. ESCÁPULA (equ.ske.mto.001-i/d)
    // Broad curved fan blade + asymmetric supraspinous/infraspinous fossae +
    // sharp Spina scapulae & Tuber spinae + Supraglenoid tubercle + Glenoid cup + Scapular cartilage
    // =========================================================================
    {
      const scapGrp = new THREE.Group();
      const scapDir = new THREE.Vector3().subVectors(fl.scapulaTop, fl.shoulder);
      const scapLen = scapDir.length();
      const axU = scapDir.clone().normalize(); // shoulder -> dorsal border
      const axLat = new THREE.Vector3(0, 0, sd); // lateral outward
      // Cranial edge perpendicular to scapular axis in sagittal plane
      const axCran = new THREE.Vector3().crossVectors(axLat, axU).normalize();
      if (axCran.x < 0) axCran.negate();

      const rSegs = 14; // neck (0) -> dorsal border (1)
      const cSegs = 12; // caudal border (0) -> cranial border (1)
      const pts: THREE.Vector3[][] = [];
      const thick: number[][] = [];
      const ao: number[][] = [];

      for (let r = 0; r <= rSegs; r++) {
        const u = r / rSegs;
        const along = THREE.MathUtils.lerp(0.012, scapLen * 0.96, u);
        // Neck narrows cleanly at u ~ 0.14 then fans broadly to dorsal border
        const neckPinch = u < 0.18 ? 0.34 + 0.12 * (1 - u / 0.18) : THREE.MathUtils.lerp(0.36, 1.0, Math.pow((u - 0.18) / 0.82, 0.78));
        const caudExtent = -0.092 * neckPinch;
        const cranExtent = 0.068 * neckPinch;
        const dorsalArch = Math.sin(u * Math.PI) * 0.008;

        const rowP: THREE.Vector3[] = [];
        const rowT: number[] = [];
        const rowAo: number[] = [];
        for (let c = 0; c <= cSegs; c++) {
          const v = c / cSegs; // 0 = caudal border, 1 = cranial border
          // Dorsal border arches nicely at top (u > 0.82)
          const topArch = u > 0.78 ? Math.sin(v * Math.PI) * 0.018 * ((u - 0.78) / 0.22) : 0;
          const chord = THREE.MathUtils.lerp(caudExtent, cranExtent, v);
          // Subtle medial/ribcage curve: slightly convex laterally
          const ribBow = Math.sin(v * Math.PI) * Math.sin(u * Math.PI) * 0.006;

          // Scapular spine sits at ~64% from caudal border (v ~ 0.64 -> asymmetric supraspinous/infraspinous fossae!)
          const spineDist = Math.abs(v - 0.64);
          const spineMask = Math.exp(-Math.pow(spineDist / 0.085, 2)) * (u > 0.12 ? Math.sin(Math.min(1, (u - 0.12) / 0.86) * Math.PI * 0.92) : 0);
          // Tuber spinae broadening mid-spine around u ~ 0.56
          const tuberBell = Math.exp(-Math.pow((u - 0.55) / 0.16, 2)) * spineMask;

          // Concave supraspinous & infraspinous fossae flanking the spine
          const infraFossa = Math.exp(-Math.pow((v - 0.32) / 0.18, 2)) * Math.sin(u * Math.PI);
          const supraFossa = Math.exp(-Math.pow((v - 0.82) / 0.12, 2)) * Math.sin(u * Math.PI);

          const latShift = ribBow + spineMask * 0.014 + tuberBell * 0.006 - (infraFossa * 0.004 + supraFossa * 0.003);

          const p = fl.shoulder
            .clone()
            .addScaledVector(axU, along + topArch)
            .addScaledVector(axCran, chord + dorsalArch)
            .addScaledVector(axLat, latShift);

          rowP.push(p);
          rowT.push(
            0.0042 +
              (u < 0.18 ? 0.0045 : 0) +
              spineMask * 0.0055 +
              tuberBell * 0.003 +
              (v < 0.1 || v > 0.9 ? 0.002 : 0),
          );
          rowAo.push(
            0.94 +
              spineMask * 0.06 -
              infraFossa * 0.24 -
              supraFossa * 0.22 -
              (u < 0.16 ? 0.10 : 0),
          );
        }
        pts.push(rowP);
        thick.push(rowT);
        ao.push(rowAo);
      }
      const norms = computeGridNormals(pts, () => axLat.clone());
      scapGrp.add(buildSculptedBonePlateMesh(pts, norms, thick, ao, sMat(), 0.36, 0.76));

      // Sharp Scapular Spine ridge + caudally-hooked Tuber spinae
      scapGrp.add(
        buildSculptedShaft(
          [
            fl.shoulder.clone().addScaledVector(axU, scapLen * 0.92).addScaledVector(axCran, -0.002).addScaledVector(axLat, 0.009),
            fl.shoulder.clone().addScaledVector(axU, scapLen * 0.62).addScaledVector(axCran, 0.006).addScaledVector(axLat, 0.019),
            fl.shoulder.clone().addScaledVector(axU, scapLen * 0.45).addScaledVector(axCran, 0.005).addScaledVector(axLat, 0.017),
            fl.shoulder.clone().addScaledVector(axU, scapLen * 0.18).addScaledVector(axCran, 0.002).addScaledVector(axLat, 0.010),
          ],
          sd,
          sMat(),
          12,
          10,
          (u, theta) => {
            const c = Math.cos(theta);
            const s = Math.sin(theta);
            const tuber = Math.exp(-Math.pow((u - 0.36) / 0.22, 2));
            return {
              rCran: 0.0055 + tuber * 0.0045,
              rLat: 0.0075 + tuber * 0.004,
              offsetCran: c < -0.2 ? -tuber * 0.003 : 0,
              ao: 0.95 + (s > 0.2 ? 0.04 : -0.06),
            };
          },
        ),
      );

      // Supraglenoid Tubercle + Glenoid Cavity Collar around shoulder joint
      scapGrp.add(
        addAoMesh(
          createOrganMesh(
            fl.shoulder.clone().addScaledVector(axU, 0.022).addScaledVector(axCran, 0.028),
            [0.017, 0.019, 0.014],
            sMat(),
            [0, 0, -0.35],
            10,
          ),
          0.92,
        ),
      );
      scapGrp.add(
        addAoMesh(
          createOrganMesh(
            fl.shoulder.clone().addScaledVector(axU, 0.006),
            [0.028, 0.012, 0.024],
            sMat(),
            [0, 0, -0.45],
            12,
          ),
          0.86,
        ),
      );

      // Dorsal Scapular Cartilage (crescentic translucent hyaline rim)
      const cPts: THREE.Vector3[][] = [];
      const cThick: number[][] = [];
      const cAo: number[][] = [];
      for (let r = 0; r <= 5; r++) {
        const u = r / 5;
        const along = THREE.MathUtils.lerp(scapLen * 0.88, scapLen * 1.045, u);
        const span = THREE.MathUtils.lerp(0.080, 0.044, Math.pow(u, 1.3));
        const rowP: THREE.Vector3[] = [];
        const rowT: number[] = [];
        const rowAo: number[] = [];
        for (let cc = 0; cc <= 8; cc++) {
          const v = cc / 8;
          const ch = THREE.MathUtils.lerp(-span * 1.08, span * 0.82, v);
          const arch = Math.sin(v * Math.PI) * 0.022;
          rowP.push(
            fl.shoulder
              .clone()
              .addScaledVector(axU, along + arch)
              .addScaledVector(axCran, ch)
              .addScaledVector(axLat, -0.002 * u),
          );
          rowT.push(0.0045 * (1 - 0.55 * u));
          rowAo.push(0.92);
        }
        cPts.push(rowP);
        cThick.push(rowT);
        cAo.push(rowAo);
      }
      const cNorms = computeGridNormals(cPts, () => axLat.clone());
      scapGrp.add(buildSculptedBonePlateMesh(cPts, cNorms, cThick, cAo, cartMat(), 0.25, 0.95));

      push(`equ.ske.mto.001-${tag}`, scapGrp, side);
    }

    // =========================================================================
    // 2. HÚMERO (equ.ske.mto.002-i/d)
    // Hemispherical head + Greater/Lesser tubercles + Bicipital groove + Deltoid tuberosity +
    // Twisted musculospiral brachial groove + Distal trochlea + Deep Olecranon fossa
    // =========================================================================
    {
      const humGrp = new THREE.Group();
      const humMid = fl.shoulder.clone().lerp(fl.elbow, 0.5);
      humGrp.add(
        buildSculptedShaft(
          [
            fl.shoulder.clone().add(V3(-0.006, 0.004, -0.002 * sd)),
            fl.shoulder.clone().lerp(fl.elbow, 0.28).add(V3(0.010, 0.004, 0.004 * sd)),
            humMid.clone().add(V3(0.006, 0, 0)),
            fl.shoulder.clone().lerp(fl.elbow, 0.78).add(V3(-0.004, 0, 0)),
            fl.elbow.clone().add(V3(0.002, 0.002, 0)),
          ],
          sd,
          sMat(),
          22,
          16,
          (u, theta) => {
            const c = Math.cos(theta); // +1 cranial, -1 caudal
            const s = Math.sin(theta); // +1 lateral, -1 medial

            // Base hourglass shaft profile
            const proxFlare = Math.exp(-Math.pow(u / 0.16, 2));
            const distFlare = Math.exp(-Math.pow((1 - u) / 0.14, 2));
            const waist = 1 - 0.26 * Math.sin(u * Math.PI);

            let rCran = 0.030 * waist + 0.018 * proxFlare + 0.012 * distFlare;
            let rLat = 0.025 * waist + 0.015 * proxFlare + 0.016 * distFlare;
            let offCran = 0;
            let offLat = 0;
            let ao = 0.93;

            // Proximal: Greater tubercle (craniolateral) & Lesser tubercle (craniomedial) framing Bicipital groove (c > 0.7, |s| < 0.35)
            if (u < 0.24) {
              const pEnv = 1 - u / 0.24;
              const bicGroove = c > 0.55 ? Math.exp(-Math.pow(s / 0.32, 2)) * pEnv : 0;
              const latTub = c > 0.1 && s > 0.25 ? Math.exp(-Math.pow((s - 0.65) / 0.4, 2)) * pEnv : 0;
              rCran += latTub * 0.012 - bicGroove * 0.007;
              rLat += latTub * 0.011;
              ao -= bicGroove * 0.25;
            }

            // Prominent Deltoid Tuberosity flaring laterally at u ~ 0.34
            const deltBell = Math.exp(-Math.pow((u - 0.34) / 0.12, 2)) * (s > 0.2 ? Math.pow((s - 0.2) / 0.8, 1.2) : 0);
            rLat += deltBell * 0.014;
            offLat += deltBell * 0.005 * sd;
            ao += deltBell * 0.06;

            // Twisted Musculospiral Brachial Groove (spiraling from caudolateral u=0.32 to craniolateral u=0.68)
            const spiralAngle = THREE.MathUtils.lerp(-Math.PI * 0.75, -Math.PI * 0.15, THREE.MathUtils.clamp((u - 0.25) / 0.5, 0, 1));
            const angDiff = Math.atan2(Math.sin(theta - spiralAngle), Math.cos(theta - spiralAngle));
            const grooveBell = u > 0.25 && u < 0.75 ? Math.exp(-Math.pow(angDiff / 0.52, 2)) * Math.sin(((u - 0.25) / 0.5) * Math.PI) : 0;
            rCran -= grooveBell * 0.004;
            rLat -= grooveBell * 0.0045;
            ao -= grooveBell * 0.24;

            // Distal: Bicondylar trochlea (medial & lateral condyles) + deep caudal Olecranon fossa (c < -0.5, u > 0.80)
            if (u > 0.76) {
              const dEnv = (u - 0.76) / 0.24;
              const condyles = Math.sin(Math.abs(s) * Math.PI) * 0.006 * dEnv;
              rLat += condyles;
              if (c < -0.45 && Math.abs(s) < 0.52) {
                const olecFossa = Math.exp(-Math.pow(s / 0.32, 2)) * Math.pow((-c - 0.45) / 0.55, 1.1) * Math.sin(dEnv * Math.PI * 0.9);
                rCran -= olecFossa * 0.015;
                ao -= olecFossa * 0.48;
              }
            }

            return { rCran, rLat, offsetCran: offCran, offsetLat: offLat, ao };
          },
        ),
      );
      // Smooth articular humeral head seated caudomedially in glenoid
      humGrp.add(
        addAoMesh(
          createOrganMesh(fl.shoulder.clone().add(V3(-0.010, -0.004, -0.004 * sd)), [0.028, 0.025, 0.024], sMat(), undefined, 12),
          0.90,
        ),
      );
      push(`equ.ske.mto.002-${tag}`, humGrp, side);
    }

    // =========================================================================
    // 3. RADIO (equ.ske.mto.003-i/d)
    // Cranially bowed, craniocaudally compressed shaft + radial tuberosity +
    // distal trochlea with dorsal extensor tendon grooves & styloid processes
    // =========================================================================
    {
      const radGrp = new THREE.Group();
      const radMid = fl.elbow.clone().lerp(fl.carpus, 0.5).add(V3(0.010, 0, 0));
      radGrp.add(
        buildSculptedShaft(
          [
            fl.elbow.clone().add(V3(0.004, -0.004, 0)),
            fl.elbow.clone().lerp(fl.carpus, 0.28).add(V3(0.011, 0, 0)),
            radMid,
            fl.elbow.clone().lerp(fl.carpus, 0.76).add(V3(0.008, 0, 0)),
            fl.carpus.clone().add(V3(0.005, 0.026, 0)),
          ],
          sd,
          sMat(),
          22,
          16,
          (u, theta) => {
            const c = Math.cos(theta);
            const s = Math.sin(theta);
            const proxFlare = Math.exp(-Math.pow(u / 0.12, 2));
            const distFlare = Math.exp(-Math.pow((1 - u) / 0.12, 2));
            const waist = 1 - 0.14 * Math.sin(u * Math.PI);

            let rCran = 0.019 * waist + 0.011 * proxFlare + 0.010 * distFlare;
            let rLat = 0.025 * waist + 0.013 * proxFlare + 0.014 * distFlare;
            let ao = 0.94;

            // Subtle palmar concavity (facies caudalis) facing ulna / flexor tendons
            if (c < -0.25) {
              rCran -= 0.0035 * Math.pow((-c - 0.25) / 0.75, 1.2) * Math.sin(u * Math.PI);
              ao -= 0.10;
            }
            // Proximal radial tuberosity (mediodorsal)
            if (u < 0.16 && c > 0.2 && s < -0.2) {
              rCran += 0.005 * (1 - u / 0.16);
              ao += 0.04;
            }
            // Distal dorsal extensor tendon grooves (two longitudinal channels separated by vertical crest)
            if (u > 0.80 && c > 0.45) {
              const dEnv = (u - 0.80) / 0.20;
              const grooves = Math.cos(s * Math.PI * 3.0);
              rCran += grooves * 0.0028 * dEnv;
              ao -= Math.max(0, -grooves) * 0.22 * dEnv;
            }
            return { rCran, rLat, ao };
          },
        ),
      );
      push(`equ.ske.mto.003-${tag}`, radGrp, side);
    }

    // =========================================================================
    // 4. ULNA (equ.ske.mto.004-i/d)
    // Tall caudodorsal Olecranon + Tuber olecrani + Anconeal beak +
    // Deep Trochlear notch + Tapering shaft & Interosseous space
    // =========================================================================
    {
      const ulnaGrp = new THREE.Group();
      const olecTip = fl.elbow.clone().add(V3(-0.042, 0.092, -0.002 * sd));
      const anconeal = fl.elbow.clone().add(V3(-0.006, 0.022, 0));
      const uShaftTop = fl.elbow.clone().add(V3(-0.020, -0.008, 0.004 * sd));
      const uShaftMid = fl.elbow.clone().lerp(fl.carpus, 0.34).add(V3(-0.016, 0, 0.010 * sd));
      const uShaftEnd = fl.carpus.clone().add(V3(-0.012, 0.135, 0.006 * sd));

      // Tall laterally-compressed Olecranon blade + shaft
      ulnaGrp.add(
        buildSculptedShaft(
          [olecTip, fl.elbow.clone().add(V3(-0.032, 0.046, 0)), uShaftTop, uShaftMid, uShaftEnd],
          sd,
          sMat(),
          20,
          14,
          (u, theta) => {
            const c = Math.cos(theta);
            const s = Math.sin(theta);
            // Wide blade craniocaudally in olecranon (u < 0.35), tapering smoothly to slender shaft distally
            const isOlec = u < 0.38 ? Math.sin(Math.min(1, u / 0.38) * Math.PI * 0.85) : 0;
            const tuberTop = Math.exp(-Math.pow(u / 0.12, 2));
            let rCran = THREE.MathUtils.lerp(0.022, 0.0065, Math.pow(u, 0.75)) + isOlec * 0.007 + tuberTop * 0.006;
            const rLat = THREE.MathUtils.lerp(0.014, 0.0055, Math.pow(u, 0.8)) + tuberTop * 0.004;
            let ao = 0.93;

            // Deep concave Trochlear Notch on cranial face around u = 0.24..0.38
            const notch = Math.exp(-Math.pow((u - 0.29) / 0.08, 2));
            if (c > 0.3) {
              rCran -= notch * 0.010 * Math.pow((c - 0.3) / 0.7, 1.2);
              ao -= notch * 0.28;
            }
            // Lateral concavity along olecranon shaft
            if (s > 0.3 && u < 0.45) {
              ao -= 0.10;
            }
            return { rCran: Math.max(0.004, rCran), rLat, ao };
          },
        ),
      );

      // Sharp beak-like Anconeal Process hooking cranially into humeral olecranon fossa
      ulnaGrp.add(
        addAoMesh(
          createOrganMesh(anconeal.clone().add(V3(-0.008, 0.018, 0)), [0.016, 0.011, 0.010], sMat(), [0, 0, -0.55], 10),
          0.95,
        ),
      );
      push(`equ.ske.mto.004-${tag}`, ulnaGrp, side);
    }

    // =========================================================================
    // 5. CARPUS (equ.ske.mto.005..011-i/d) — 7 Individually Sculpted Carpal Stones
    // =========================================================================
    const carpalSpecs: Array<{
      num: number;
      dx: number;
      dy: number;
      dz: number;
      size: [number, number, number];
      rot?: [number, number, number];
      ao?: number;
    }> = [
      // Proximal row
      { num: 5, dx: 0.006, dy: 0.014, dz: -0.016, size: [0.025, 0.021, 0.017], ao: 0.94 }, // Carporradial
      { num: 6, dx: 0.009, dy: 0.014, dz: 0.0, size: [0.025, 0.021, 0.017], ao: 0.95 },    // Carpointermedio
      { num: 7, dx: 0.006, dy: 0.014, dz: 0.016, size: [0.023, 0.021, 0.016], ao: 0.94 },  // Carpoulnar
      { num: 8, dx: -0.020, dy: 0.015, dz: 0.013, size: [0.028, 0.021, 0.012], rot: [0, -0.25 * sd, 0.12], ao: 0.91 }, // Carpoaccesorio (prominent caudolateral discoid projection)
      // Distal row
      { num: 9, dx: 0.005, dy: -0.009, dz: -0.016, size: [0.021, 0.015, 0.013], ao: 0.92 }, // Carpiano II
      { num: 10, dx: 0.009, dy: -0.009, dz: 0.0, size: [0.028, 0.016, 0.024], ao: 0.96 },   // Carpiano III (wide central slab)
      { num: 11, dx: 0.005, dy: -0.009, dz: 0.016, size: [0.023, 0.015, 0.015], ao: 0.93 }, // Carpiano IV
    ];
    for (const sp of carpalSpecs) {
      push(
        `equ.ske.mto.${String(sp.num).padStart(3, '0')}-${tag}`,
        buildSculptedCarpalStone(
          V3(fl.carpus.x + sp.dx, fl.carpus.y + sp.dy, fl.carpus.z + sp.dz * sd),
          sp.size,
          sMat(),
          sp.rot ?? [0, 0, 0],
          0.60,
          0.84,
          sp.ao ?? 0.93,
        ),
        side,
      );
    }

    // =========================================================================
    // 6. METACARPUS: MC III "Caña" (012) & SPLINT BONES MC II/IV (013, 014)
    // =========================================================================
    {
      // 6A. Metacarpiano III (equ.ske.mto.012-i/d)
      const mc3Grp = new THREE.Group();
      const mc3Top = fl.carpus.clone().add(V3(0.003, -0.018, 0));
      const mc3Bot = fl.fetlock.clone().add(V3(0, 0.004, 0));
      mc3Grp.add(
        buildSculptedShaft(
          [mc3Top, mc3Top.clone().lerp(mc3Bot, 0.5), mc3Bot],
          sd,
          sMat(),
          20,
          18,
          (u, theta) => {
            const c = Math.cos(theta);
            const s = Math.sin(theta);
            const proxFlare = Math.exp(-Math.pow(u / 0.11, 2));
            const distFlare = Math.exp(-Math.pow((1 - u) / 0.11, 2));
            const waist = 1 - 0.09 * Math.sin(u * Math.PI);

            let rCran = 0.0165 * waist + 0.0075 * proxFlare + 0.0065 * distFlare;
            let rLat = 0.0185 * waist + 0.0095 * proxFlare + 0.0095 * distFlare;
            let ao = 0.95;

            // Dorsal metacarpal tuberosity just below C3
            if (u < 0.15 && c > 0.45 && s < 0.25) {
              rCran += 0.0045 * Math.sin((u / 0.15) * Math.PI);
              ao += 0.04;
            }
            // D-section flat/channeled palmar wall + longitudinal splint grooves
            if (c < -0.2) {
              rCran -= 0.003 * Math.pow((-c - 0.2) / 0.8, 1.1) * Math.sin(u * Math.PI * 0.9);
              ao -= 0.14;
            }
            // Distal Fetlock Trochlea: prominent central Sagittal Ridge between symmetrical condyles!
            if (u > 0.86) {
              const dEnv = (u - 0.86) / 0.14;
              const sagRidge = Math.exp(-Math.pow(s / 0.16, 2)) * 0.0052 * dEnv;
              const condyleGroove = Math.exp(-Math.pow((Math.abs(s) - 0.34) / 0.16, 2)) * 0.0022 * dEnv;
              rCran += sagRidge - condyleGroove;
              ao -= condyleGroove * 45;
            }
            return { rCran, rLat, ao };
          },
        ),
      );
      push(`equ.ske.mto.012-${tag}`, mc3Grp, side);

      // 6B. Splint Bones: Metacarpiano II (013 medial) & Metacarpiano IV (014 lateral)
      // Expanded proximal head under C2/C4 -> tapering shaft -> small rounded distal button!
      for (const isLat of [false, true] as const) {
        const spId = isLat ? `equ.ske.mto.014-${tag}` : `equ.ske.mto.013-${tag}`;
        const zOff = (isLat ? 0.0155 : -0.0155) * sd;
        const pHead = fl.carpus.clone().add(V3(-0.008, -0.018, zOff));
        const pMid = fl.carpus.clone().lerp(fl.fetlock, 0.40).add(V3(-0.014, 0, zOff * 0.85));
        const pButton = fl.carpus.clone().lerp(fl.fetlock, 0.72).add(V3(-0.013, 0, zOff * 0.78));

        const spGrp = new THREE.Group();
        spGrp.add(
          buildSculptedShaft(
            [pHead, pMid, pButton],
            sd,
            sMat(),
            14,
            10,
            (u, _theta) => {
              const proxHead = Math.exp(-Math.pow(u / 0.14, 2));
              const distBtn = Math.exp(-Math.pow((1 - u) / 0.08, 2));
              const rBase = THREE.MathUtils.lerp(0.006, 0.0032, Math.pow(u, 0.7)) + proxHead * 0.0045 + distBtn * 0.0022;
              return { rCran: rBase * 1.15, rLat: rBase * 0.85, ao: 0.90 + distBtn * 0.08 };
            },
          ),
        );
        push(spId, spGrp, side);
      }
    }

    // =========================================================================
    // 7. DIGIT: PROXIMAL SESAMOIDS (018, 019), P1 (015), P2 (016), NAVICULAR (020), COFFIN P3 (017)
    // =========================================================================
    {
      // 7A. Proximal Sesamoids (018 medial, 019 lateral) cradling palmar fetlock sagittal ridge
      for (const isLat of [false, true] as const) {
        const sesId = isLat ? `equ.ske.mto.019-${tag}` : `equ.ske.mto.018-${tag}`;
        const sesZ = (isLat ? 0.010 : -0.010) * sd;
        push(
          sesId,
          buildSculptedCarpalStone(
            fl.fetlock.clone().add(V3(-0.017, 0.011, sesZ)),
            [0.014, 0.022, 0.011],
            sMat(),
            [0.08 * (isLat ? 1 : -1) * sd, 0, -0.32],
            0.58,
            0.78,
            0.91,
          ),
          side,
        );
      }

      // 7B. Falange Proximal — P1 "Cuartilla" (015) with hourglass waist + palmar V-trigone
      push(
        `equ.ske.mto.015-${tag}`,
        buildSculptedShaft(
          [fl.fetlock.clone().add(V3(0, -0.004, 0)), fl.fetlock.clone().lerp(fl.pasternMid, 0.5), fl.pasternMid.clone().add(V3(0, 0.004, 0))],
          sd,
          sMat(),
          14,
          16,
          (u, theta) => {
            const c = Math.cos(theta);
            const s = Math.sin(theta);
            const proxFlare = Math.exp(-Math.pow(u / 0.22, 2));
            const distFlare = Math.exp(-Math.pow((1 - u) / 0.20, 2));
            const waist = 1 - 0.16 * Math.sin(u * Math.PI);
            let rCran = 0.0155 * waist + 0.0075 * proxFlare + 0.0045 * distFlare;
            let rLat = 0.0185 * waist + 0.0085 * proxFlare + 0.0055 * distFlare;
            let ao = 0.94;
            // Palmar V-trigone ridges
            if (c < -0.3 && u < 0.72) {
              const vSpacing = THREE.MathUtils.lerp(0.55, 0.05, u / 0.72);
              const vRidge = Math.exp(-Math.pow((Math.abs(s) - vSpacing) / 0.18, 2));
              rCran += vRidge * 0.0025;
              ao -= (1 - vRidge) * 0.14;
            }
            return { rCran, rLat, ao };
          },
        ),
        side,
      );

      // 7C. Falange Media — P2 "Corona" (016) with proximopalmar flexor scutum
      push(
        `equ.ske.mto.016-${tag}`,
        buildSculptedShaft(
          [fl.pasternMid.clone().add(V3(0, -0.002, 0)), fl.coronet.clone().add(V3(0, 0.002, 0))],
          sd,
          sMat(),
          10,
          14,
          (u, theta) => {
            const c = Math.cos(theta);
            const proxFlare = Math.exp(-Math.pow(u / 0.28, 2));
            const distFlare = Math.exp(-Math.pow((1 - u) / 0.26, 2));
            let rCran = 0.0165 + 0.0045 * proxFlare + 0.0045 * distFlare;
            const rLat = 0.0205 + 0.0045 * proxFlare + 0.0055 * distFlare;
            // Proximopalmar flexor tuberosity
            if (u < 0.45 && c < -0.4) rCran += 0.0035 * (1 - u / 0.45);
            return { rCran, rLat, ao: 0.92 };
          },
        ),
        side,
      );

      // 7D. Sesamoideo Distal — Navicular Bone (020): transverse shuttle tucked palmarly at coffin joint
      {
        const navCenter = fl.coronet.clone().add(V3(-0.017, -0.011, 0));
        push(
          `equ.ske.mto.020-${tag}`,
          buildSculptedShaft(
            [
              navCenter.clone().add(V3(-0.003, 0.002, -0.017 * sd)),
              navCenter,
              navCenter.clone().add(V3(-0.003, 0.002, 0.017 * sd)),
            ],
            sd,
            sMat(),
            10,
            10,
            (u, theta) => {
              const taper = 0.45 + 0.55 * Math.sin(u * Math.PI);
              const ridge = Math.abs(Math.cos(theta)) > 0.6 ? 1.15 : 0.92;
              return { rCran: 0.0065 * taper * ridge, rLat: 0.0058 * taper, ao: 0.88 };
            },
          ),
          side,
        );
      }

      // 7E. Falange Distal — P3 "Tejuelo" / Coffin Bone (017):
      // Conical porous dorsal wall + prominent Extensor Process + Palmar Processes (wings) + Solar arch
      {
        const p3Center = fl.hoofCenter.clone().add(V3(0.003, 0.005, 0));
        const rSegs = 10; // dorsal-coronal rim (0) -> solar ground border (1)
        const cSegs = 16; // caudal medial wing (0) -> toe apex (0.5) -> caudal lateral wing (1)
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
            // Horseshoe arc from caudal medial wing (-0.78*PI) around toe (0) to caudal lateral wing (+0.78*PI)
            const ang = THREE.MathUtils.lerp(-0.78 * Math.PI, 0.78 * Math.PI, v);
            const toeDist = Math.abs(v - 0.5) * 2; // 0 at toe, 1 at palmar wing tips

            // Radius flares from coronal articular ring (u=0) outward to wide solar rim (u=1)
            const radX = THREE.MathUtils.lerp(0.019, 0.036, Math.pow(u, 0.85));
            const radZ = THREE.MathUtils.lerp(0.022, 0.034, Math.pow(u, 0.85));

            // Dorsal extensor process rises prominently at toe apex (v ~ 0.5, u ~ 0)
            const extProc = Math.exp(-Math.pow(toeDist / 0.25, 2)) * (1 - u) * 0.014;
            // Palmar wings sweep caudally with a slight dorsal hook
            const wingNotch = Math.exp(-Math.pow((toeDist - 0.78) / 0.16, 2)) * (u > 0.3 && u < 0.7 ? 0.004 : 0);

            const lx = Math.cos(ang) * radX + (1 - toeDist) * 0.010 * u - wingNotch;
            const lz = Math.sin(ang) * radZ * sd;
            const ly = THREE.MathUtils.lerp(0.027 + extProc, -0.006, u) - toeDist * 0.008 * (1 - u);

            // Subtle parietal vascular sulcus along wings
            const sulcus = Math.exp(-Math.pow((toeDist - 0.65) / 0.12, 2)) * Math.exp(-Math.pow((u - 0.55) / 0.22, 2));

            rowP.push(V3(p3Center.x + lx, p3Center.y + ly, p3Center.z + lz));
            rowT.push(0.0048 + (1 - u) * 0.0028);
            rowAo.push(0.88 - 0.28 * sulcus - 0.10 * u);
          }
          pts.push(rowP);
          thick.push(rowT);
          ao.push(rowAo);
        }
        const norms = computeGridNormals(pts, (_r, c) => {
          const ang = THREE.MathUtils.lerp(-0.78 * Math.PI, 0.78 * Math.PI, c / cSegs);
          return V3(Math.cos(ang), 0.55, Math.sin(ang) * sd).normalize();
        });
        const p3Mesh = buildSculptedBonePlateMesh(pts, norms, thick, ao, sMat(), 0.35, 0.72);
        // Sculpted solar/articular cap inside P3
        const p3Grp = new THREE.Group();
        p3Grp.add(p3Mesh);
        p3Grp.add(
          addAoMesh(
            createOrganMesh(p3Center.clone().add(V3(0.002, 0.016, 0)), [0.021, 0.013, 0.021], sMat(), [0, 0, -0.25], 12),
            0.84,
          ),
        );
        push(`equ.ske.mto.017-${tag}`, p3Grp, side);
      }
    }
  }
}
