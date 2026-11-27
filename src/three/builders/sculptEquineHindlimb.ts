import * as THREE from 'three';
import { hindlimbLandmarks, V3 } from '../anatomyCoords';
import { createOrganMesh } from './geomHelpers';

export interface SculptedHindlimbBuildContext {
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
    const tan = curve.getTangentAt(u).normalize();
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
        .addScaledVector(cranDir, cVal * prof.rCran * endTaper + (prof.offsetCran ?? 0))
        .addScaledVector(latDir, sVal * prof.rLat * endTaper + (prof.offsetLat ?? 0));

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

function buildSculptedTarsalStone(
  center: THREE.Vector3,
  size: [number, number, number],
  mat: THREE.Material,
  rot: [number, number, number] = [0, 0, 0],
  bevelPower = 0.62,
  plantarTaper = 0.84,
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

    const planFactor = bx < 0 ? THREE.MathUtils.lerp(1.0, plantarTaper, -bx) : 1.0;
    const dorsalFacet = bx > 0.4 ? Math.exp(-(by * by + bz * bz) * 1.8) * 0.04 : 0;

    pos.setXYZ(
      i,
      bx * sx * 0.5 - dorsalFacet * sx * 0.5,
      by * sy * 0.5 * planFactor,
      bz * sz * 0.5 * planFactor,
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

export function buildSculptedHindlimbParts(ctx: SculptedHindlimbBuildContext): void {
  const { sculptedBoneMat, push } = ctx;
  const sMat = () => sculptedBoneMat();

  for (const sd of [-1, 1] as const) {
    const tag = sd === -1 ? 'i' : 'd';
    const side = sd === -1 ? 'left' : 'right';
    const hl = hindlimbLandmarks(sd);

    // =========================================================================
    // 1. FÉMUR (equ.ske.mpe.002-i/d)
    // Femoral head & neck seated inside acetabulum + tall divided Greater Trochanter +
    // Trochanteric fossa + hooked Third Trochanter + Lesser Trochanter +
    // deep caudolateral Supracondylar Fossa + asymmetric Medial/Lateral Trochlear ridges + Condyles
    // =========================================================================
    {
      const femGrp = new THREE.Group();
      const femMid = hl.hip.clone().lerp(hl.stifle, 0.5).add(V3(0.012, 0, 0));

      femGrp.add(
        buildSculptedShaft(
          [
            hl.hip.clone().add(V3(-0.004, 0.008, 0.002 * sd)),
            hl.hip.clone().lerp(hl.stifle, 0.30).add(V3(0.008, 0, 0.006 * sd)),
            femMid,
            hl.hip.clone().lerp(hl.stifle, 0.78).add(V3(0.006, 0, 0)),
            hl.stifle.clone().add(V3(0.004, 0.008, 0)),
          ],
          sd,
          sMat(),
          24,
          18,
          (u, theta) => {
            const c = Math.cos(theta); // +1 cranial, -1 caudal
            const s = Math.sin(theta); // +1 lateral, -1 medial

            const proxFlare = Math.exp(-Math.pow(u / 0.16, 2));
            const distFlare = Math.exp(-Math.pow((1 - u) / 0.16, 2));
            const waist = 1 - 0.24 * Math.sin(u * Math.PI);

            let rCran = 0.031 * waist + 0.014 * proxFlare + 0.022 * distFlare;
            let rLat = 0.028 * waist + 0.014 * proxFlare + 0.020 * distFlare;
            let offLat = 0;
            let ao = 0.94;

            // Proximal: Divided Greater Trochanter (lateral/caudal) & deep Trochanteric Fossa (caudomedial)
            if (u < 0.22) {
              const pEnv = 1 - u / 0.22;
              if (s > 0.2) {
                rLat += 0.012 * pEnv * Math.pow((s - 0.2) / 0.8, 1.1);
                rCran += 0.008 * pEnv;
              }
              if (c < -0.35 && s < 0.15) {
                const fossa = Math.exp(-Math.pow((s + 0.25) / 0.35, 2)) * Math.pow((-c - 0.35) / 0.65, 1.1) * pEnv;
                rCran -= fossa * 0.012;
                ao -= fossa * 0.42;
              }
            }

            // Prominent Hooked Third Trochanter (trochanter tertius) flaring laterally at u ~ 0.30
            const thirdTroc = Math.exp(-Math.pow((u - 0.30) / 0.085, 2)) * (s > 0.25 ? Math.pow((s - 0.25) / 0.75, 1.15) : 0);
            rLat += thirdTroc * 0.017;
            offLat += thirdTroc * 0.005 * sd;
            ao += thirdTroc * 0.05;

            // Lesser Trochanter ridge on medial border around u ~ 0.28
            const lesserTroc = Math.exp(-Math.pow((u - 0.27) / 0.09, 2)) * (s < -0.45 ? Math.pow((-s - 0.45) / 0.55, 1.2) : 0);
            rLat += lesserTroc * 0.008;

            // Deep caudolateral Supracondylar Fossa (hallmark equine femur pit!) at u ~ 0.74
            if (u > 0.62 && u < 0.86 && c < -0.30 && s > 0.0) {
              const supPit =
                Math.exp(-Math.pow((u - 0.74) / 0.08, 2)) *
                Math.exp(-Math.pow((s - 0.45) / 0.38, 2)) *
                Math.pow((-c - 0.30) / 0.70, 1.1);
              rCran -= supPit * 0.015;
              ao -= supPit * 0.50;
            }

            // Distal: Asymmetric Equine Trochlea (thick medial ridge vs narrower lateral ridge) cranially +
            // Bicondylar Intercondylar Fossa caudally
            if (u > 0.78) {
              const dEnv = (u - 0.78) / 0.22;
              if (c > 0.25) {
                const medRidge = Math.exp(-Math.pow((s + 0.55) / 0.26, 2)) * 0.014 * dEnv;
                const latRidge = Math.exp(-Math.pow((s - 0.52) / 0.22, 2)) * 0.008 * dEnv;
                const groove = Math.exp(-Math.pow(s / 0.22, 2)) * 0.009 * dEnv;
                rCran += medRidge + latRidge - groove;
                ao -= groove * 32;
              } else if (c < -0.35) {
                const condyles = Math.sin(Math.abs(s) * Math.PI) * 0.008 * dEnv;
                const intercond = Math.exp(-Math.pow(s / 0.24, 2)) * 0.015 * dEnv;
                rCran += condyles - intercond;
                ao -= intercond * 34;
              }
            }

            return { rCran, rLat, offsetLat: offLat, ao };
          },
        ),
      );

      // Femoral Neck & Spherical Head seated inside Acetabulum
      femGrp.add(
        buildSculptedShaft(
          [hl.hip.clone().add(V3(-0.002, -0.006, 0)), hl.acetabulum],
          sd,
          sMat(),
          8,
          12,
          (u) => {
            const r = THREE.MathUtils.lerp(0.016, 0.0225, u);
            return { rCran: r, rLat: r, ao: 0.90 };
          },
        ),
      );
      femGrp.add(addAoMesh(createOrganMesh(hl.acetabulum, [0.0225, 0.0225, 0.0225], sMat(), undefined, 14), 0.90));

      // Tall Caudal Summit of Greater Trochanter + Cranial Crest
      femGrp.add(
        addAoMesh(
          createOrganMesh(hl.hip.clone().add(V3(-0.024, 0.044, 0.012 * sd)), [0.023, 0.032, 0.017], sMat(), [0, 0, 0.28], 12),
          0.96,
        ),
      );

      push(`equ.ske.mpe.002-${tag}`, femGrp, side);
    }

    // =========================================================================
    // 2. RÓTULA (equ.ske.mpe.003-i/d) — Shield-shaped triangular wedge in femoral trochlea
    // =========================================================================
    {
      const patCenter = hl.stifle.clone().add(V3(0.028, 0.014, -0.003 * sd));
      const patMesh = buildSculptedTarsalStone(
        patCenter,
        [0.024, 0.036, 0.023],
        sMat(),
        [0, 0, -0.25],
        0.58,
        0.74,
        0.95,
      );
      push(`equ.ske.mpe.003-${tag}`, patMesh, side);
    }

    // =========================================================================
    // 3. TIBIA (equ.ske.mpe.004-i/d)
    // Broad proximal condyles & intercondylar eminence + sharp Cranial Tibial Crest +
    // Extensor groove + Triangular-to-cylindrical tapering shaft + Oblique distal Cochlea & Malleoli
    // =========================================================================
    {
      const tibGrp = new THREE.Group();
      const tibMid = hl.stifle.clone().lerp(hl.hock, 0.5).add(V3(0.006, 0, 0));

      tibGrp.add(
        buildSculptedShaft(
          [
            hl.stifle.clone().add(V3(-0.004, 0.002, 0)),
            hl.stifle.clone().lerp(hl.hock, 0.25).add(V3(0.007, 0, 0)),
            tibMid,
            hl.stifle.clone().lerp(hl.hock, 0.78).add(V3(0.0, 0, 0)),
            hl.hock.clone().add(V3(-0.004, 0.025, 0)),
          ],
          sd,
          sMat(),
          24,
          16,
          (u, theta) => {
            const c = Math.cos(theta); // +1 cranial, -1 caudal
            const s = Math.sin(theta); // +1 lateral, -1 medial

            const proxFlare = Math.exp(-Math.pow(u / 0.14, 2));
            const distFlare = Math.exp(-Math.pow((1 - u) / 0.12, 2));
            const waist = THREE.MathUtils.lerp(1.0, 0.62, Math.pow(u, 0.85));

            let rCran = 0.028 * waist + 0.018 * proxFlare + 0.010 * distFlare;
            let rLat = 0.028 * waist + 0.016 * proxFlare + 0.014 * distFlare;
            let ao = 0.94;

            // Sharp Cranial Tibial Crest (crista tibiae) sweeping down proximal 42%
            if (u < 0.45 && c > 0.35) {
              const crestU = Math.sin((u / 0.45) * Math.PI * 0.85);
              const crestC = Math.exp(-Math.pow((s + 0.08) / 0.25, 2)) * Math.pow((c - 0.35) / 0.65, 1.2);
              rCran += crestU * crestC * 0.015;
              ao += crestU * crestC * 0.05;
            }
            // Deep lateral Extensor Groove & Popliteal Notch proximally
            if (u < 0.22 && s > 0.3 && c > 0.1) {
              const extG = (1 - u / 0.22) * Math.exp(-Math.pow((s - 0.65) / 0.25, 2));
              rLat -= extG * 0.006;
              ao -= extG * 0.32;
            }
            // Subtle caudal popliteal hollow
            if (c < -0.3 && u < 0.55) {
              ao -= 0.14 * (1 - u / 0.55);
            }
            // Distal oblique screw cochlea + medial & lateral malleoli
            if (u > 0.84) {
              const dEnv = (u - 0.84) / 0.16;
              const mall = Math.exp(-Math.pow((Math.abs(s) - 0.78) / 0.22, 2)) * 0.005 * dEnv;
              rLat += mall;
            }
            return { rCran, rLat, ao };
          },
        ),
      );
      push(`equ.ske.mpe.004-${tag}`, tibGrp, side);
    }

    // =========================================================================
    // 4. FÍBULA (equ.ske.mpe.005-i/d) — Flattened lateral head + slender needle shaft
    // =========================================================================
    {
      const fibHead = hl.stifle.clone().add(V3(-0.014, -0.020, 0.028 * sd));
      const fibMid = hl.stifle.clone().lerp(hl.hock, 0.25).add(V3(-0.016, 0, 0.024 * sd));
      const fibTip = hl.stifle.clone().lerp(hl.hock, 0.46).add(V3(-0.014, 0, 0.018 * sd));
      push(
        `equ.ske.mpe.005-${tag}`,
        buildSculptedShaft(
          [fibHead, fibMid, fibTip],
          sd,
          sMat(),
          12,
          10,
          (u) => {
            const headBell = Math.exp(-Math.pow(u / 0.18, 2));
            const r = THREE.MathUtils.lerp(0.0055, 0.0024, Math.pow(u, 0.7)) + headBell * 0.0055;
            return { rCran: r * 1.25, rLat: r * 0.65, ao: 0.90 + headBell * 0.06 };
          },
        ),
        side,
      );
    }

    // =========================================================================
    // 5. TARSUS / HOCK (equ.ske.mpe.006..011-i/d)
    // =========================================================================
    // 5A. Calcáneo (007): Tall tuber calcanei + grooved summit + body + medial sustentaculum tali
    {
      const calcGrp = new THREE.Group();
      const calcBase = hl.hock.clone().add(V3(-0.020, 0.004, 0.007 * sd));
      const calcTip = hl.calcaneusTip.clone().add(V3(0.004, 0.006, 0));
      const calcMid = calcBase.clone().lerp(calcTip, 0.5);
      calcGrp.add(
        buildSculptedShaft(
          [calcTip, calcMid, calcBase],
          sd,
          sMat(),
          14,
          12,
          (u, theta) => {
            const c = Math.cos(theta);
            const tuberTop = Math.exp(-Math.pow(u / 0.20, 2));
            const baseFlare = Math.exp(-Math.pow((1 - u) / 0.22, 2));
            const rCran = 0.015 + tuberTop * 0.0055 + baseFlare * 0.005;
            const rLat = 0.0115 + tuberTop * 0.0045 + baseFlare * 0.004;
            return {
              rCran,
              rLat,
              ao: 0.94 - (c < -0.3 ? 0.10 : 0),
            };
          },
        ),
      );
      // Medial Sustentaculum tali shelf projecting medially under calcaneal body
      calcGrp.add(
        buildSculptedTarsalStone(
          hl.hock.clone().add(V3(-0.020, 0.020, -0.005 * sd)),
          [0.019, 0.021, 0.017],
          sMat(),
          [0, 0, 0.2],
          0.58,
          0.8,
          0.88,
        ),
      );
      push(`equ.ske.mpe.007-${tag}`, calcGrp, side);
    }

    // 5B. Talus / Astrágalo (006): Two bold parallel oblique trochlear ridges + deep groove
    {
      const talusGrp = new THREE.Group();
      const tBase = V3(hl.hock.x - 0.004, hl.hock.y + 0.015, hl.hock.z);
      talusGrp.add(buildSculptedTarsalStone(tBase, [0.032, 0.030, 0.031], sMat(), [0, 0, 0.35], 0.62, 0.85, 0.92));

      // Paired oblique trochlear ridges (medial & lateral, tilted ~20° dorsolaterally)
      for (const isLat of [false, true] as const) {
        const rz = (isLat ? 0.0105 : -0.0105) * sd;
        const pTop = tBase.clone().add(V3(-0.004, 0.019, rz - 0.002 * sd));
        const pMid = tBase.clone().add(V3(0.011, 0.009, rz + 0.001 * sd));
        const pBot = tBase.clone().add(V3(0.009, -0.009, rz + 0.004 * sd));
        talusGrp.add(
          buildSculptedShaft(
            [pTop, pMid, pBot],
            sd,
            sMat(),
            10,
            10,
            (u) => {
              const env = 0.65 + 0.35 * Math.sin(u * Math.PI);
              return { rCran: 0.0076 * env, rLat: 0.0062 * env, ao: 0.97 };
            },
          ),
        );
      }
      push(`equ.ske.mpe.006-${tag}`, talusGrp, side);
    }

    // 5C. Distal Tarsal Row (008 Central, 009 T1+T2, 010 T3, 011 Cuboid/T4)
    const tarsalDistal: Array<{
      num: number;
      dx: number;
      dy: number;
      dz: number;
      size: [number, number, number];
      ao?: number;
    }> = [
      { num: 8, dx: -0.003, dy: -0.002, dz: -0.003, size: [0.029, 0.013, 0.030], ao: 0.94 },  // Central tarsal
      { num: 9, dx: -0.011, dy: -0.015, dz: -0.015, size: [0.021, 0.015, 0.013], ao: 0.90 },  // T1 + T2 (medial)
      { num: 10, dx: -0.001, dy: -0.016, dz: 0.0, size: [0.028, 0.014, 0.025], ao: 0.96 },    // T3 (broad central slab)
      { num: 11, dx: -0.009, dy: -0.011, dz: 0.015, size: [0.024, 0.025, 0.015], ao: 0.93 },  // T4 / Cuboid (tall lateral)
    ];
    for (const sp of tarsalDistal) {
      push(
        `equ.ske.mpe.${String(sp.num).padStart(3, '0')}-${tag}`,
        buildSculptedTarsalStone(
          V3(hl.hock.x + sp.dx, hl.hock.y + sp.dy, hl.hock.z + sp.dz * sd),
          sp.size,
          sMat(),
          [0, 0, 0],
          0.60,
          0.84,
          sp.ao ?? 0.93,
        ),
        side,
      );
    }

    // =========================================================================
    // 6. METATARSUS: MT III "Caña" (012) & SPLINT BONES MT II/IV (013, 014)
    // =========================================================================
    {
      const mt3Top = hl.hock.clone().add(V3(-0.002, -0.016, 0));
      const mt3Bot = hl.fetlock.clone().add(V3(0, 0.004, 0));
      push(
        `equ.ske.mpe.012-${tag}`,
        buildSculptedShaft(
          [mt3Top, mt3Top.clone().lerp(mt3Bot, 0.5), mt3Bot],
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

            // Hind cannon is slightly deeper craniocaudally (rounder) than fore cannon
            let rCran = 0.0185 * waist + 0.0075 * proxFlare + 0.0065 * distFlare;
            let rLat = 0.0180 * waist + 0.0090 * proxFlare + 0.0095 * distFlare;
            let ao = 0.95;

            if (c < -0.2) {
              rCran -= 0.0028 * Math.pow((-c - 0.2) / 0.8, 1.1) * Math.sin(u * Math.PI * 0.9);
              ao -= 0.14;
            }
            if (u > 0.86) {
              const dEnv = (u - 0.86) / 0.14;
              const sagRidge = Math.exp(-Math.pow(s / 0.16, 2)) * 0.0055 * dEnv;
              const condyleGroove = Math.exp(-Math.pow((Math.abs(s) - 0.34) / 0.16, 2)) * 0.0022 * dEnv;
              rCran += sagRidge - condyleGroove;
              ao -= condyleGroove * 45;
            }
            return { rCran, rLat, ao };
          },
        ),
        side,
      );

      // Splint Bones: Mt II (013 medial) & Mt IV (014 lateral — characteristically heavier proximal head!)
      for (const isLat of [false, true] as const) {
        const spId = isLat ? `equ.ske.mpe.014-${tag}` : `equ.ske.mpe.013-${tag}`;
        const zOff = (isLat ? 0.0155 : -0.0155) * sd;
        const pHead = hl.hock.clone().add(V3(-0.009, -0.018, zOff));
        const pMid = hl.hock.clone().lerp(hl.fetlock, 0.42).add(V3(-0.014, 0, zOff * 0.85));
        const pButton = hl.hock.clone().lerp(hl.fetlock, 0.74).add(V3(-0.013, 0, zOff * 0.78));

        push(
          spId,
          buildSculptedShaft(
            [pHead, pMid, pButton],
            sd,
            sMat(),
            14,
            10,
            (u) => {
              const proxHead = Math.exp(-Math.pow(u / 0.15, 2));
              const distBtn = Math.exp(-Math.pow((1 - u) / 0.08, 2));
              const headBonus = isLat ? 0.0065 : 0.0042;
              const rBase = THREE.MathUtils.lerp(0.006, 0.0032, Math.pow(u, 0.7)) + proxHead * headBonus + distBtn * 0.0022;
              return { rCran: rBase * 1.15, rLat: rBase * 0.85, ao: 0.90 + distBtn * 0.08 };
            },
          ),
          side,
        );
      }
    }

    // =========================================================================
    // 7. HIND DIGIT: SESAMOIDS (018, 019), P1 (015), P2 (016), NAVICULAR (020), COFFIN P3 (017)
    // =========================================================================
    {
      for (const isLat of [false, true] as const) {
        const sesId = isLat ? `equ.ske.mpe.019-${tag}` : `equ.ske.mpe.018-${tag}`;
        const sesZ = (isLat ? 0.010 : -0.010) * sd;
        push(
          sesId,
          buildSculptedTarsalStone(
            hl.fetlock.clone().add(V3(-0.017, 0.011, sesZ)),
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

      push(
        `equ.ske.mpe.015-${tag}`,
        buildSculptedShaft(
          [hl.fetlock.clone().add(V3(0, -0.004, 0)), hl.fetlock.clone().lerp(hl.pasternMid, 0.5), hl.pasternMid.clone().add(V3(0, 0.004, 0))],
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
            const rLat = 0.0180 * waist + 0.0085 * proxFlare + 0.0055 * distFlare;
            let ao = 0.94;
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

      push(
        `equ.ske.mpe.016-${tag}`,
        buildSculptedShaft(
          [hl.pasternMid.clone().add(V3(0, -0.002, 0)), hl.coronet.clone().add(V3(0, 0.002, 0))],
          sd,
          sMat(),
          10,
          14,
          (u, theta) => {
            const c = Math.cos(theta);
            const proxFlare = Math.exp(-Math.pow(u / 0.28, 2));
            const distFlare = Math.exp(-Math.pow((1 - u) / 0.26, 2));
            let rCran = 0.0165 + 0.0045 * proxFlare + 0.0045 * distFlare;
            const rLat = 0.0195 + 0.0045 * proxFlare + 0.0050 * distFlare;
            if (u < 0.45 && c < -0.4) rCran += 0.0035 * (1 - u / 0.45);
            return { rCran, rLat, ao: 0.92 };
          },
        ),
        side,
      );

      {
        const navCenter = hl.coronet.clone().add(V3(-0.017, -0.011, 0));
        push(
          `equ.ske.mpe.020-${tag}`,
          buildSculptedShaft(
            [
              navCenter.clone().add(V3(-0.003, 0.002, -0.016 * sd)),
              navCenter,
              navCenter.clone().add(V3(-0.003, 0.002, 0.016 * sd)),
            ],
            sd,
            sMat(),
            10,
            10,
            (u, theta) => {
              const taper = 0.45 + 0.55 * Math.sin(u * Math.PI);
              const ridge = Math.abs(Math.cos(theta)) > 0.6 ? 1.15 : 0.92;
              return { rCran: 0.0062 * taper * ridge, rLat: 0.0055 * taper, ao: 0.88 };
            },
          ),
          side,
        );
      }

      // P3 Coffin Bone (017): slightly narrower, steeper hindfoot contour with extensor & plantar wings
      {
        const p3Center = hl.hoofCenter.clone().add(V3(0.003, 0.005, 0));
        const rSegs = 10;
        const cSegs = 16;
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
            const ang = THREE.MathUtils.lerp(-0.78 * Math.PI, 0.78 * Math.PI, v);
            const toeDist = Math.abs(v - 0.5) * 2;

            const radX = THREE.MathUtils.lerp(0.018, 0.034, Math.pow(u, 0.85));
            const radZ = THREE.MathUtils.lerp(0.020, 0.030, Math.pow(u, 0.85));

            const extProc = Math.exp(-Math.pow(toeDist / 0.25, 2)) * (1 - u) * 0.014;
            const wingNotch = Math.exp(-Math.pow((toeDist - 0.78) / 0.16, 2)) * (u > 0.3 && u < 0.7 ? 0.004 : 0);

            const lx = Math.cos(ang) * radX + (1 - toeDist) * 0.009 * u - wingNotch;
            const lz = Math.sin(ang) * radZ * sd;
            const ly = THREE.MathUtils.lerp(0.027 + extProc, -0.006, u) - toeDist * 0.008 * (1 - u);

            const sulcus = Math.exp(-Math.pow((toeDist - 0.65) / 0.12, 2)) * Math.exp(-Math.pow((u - 0.55) / 0.22, 2));

            rowP.push(V3(p3Center.x + lx, p3Center.y + ly, p3Center.z + lz));
            rowT.push(0.0046 + (1 - u) * 0.0026);
            rowAo.push(0.88 - 0.28 * sulcus - 0.10 * u);
          }
          pts.push(rowP);
          thick.push(rowT);
          ao.push(rowAo);
        }
        const norms = computeGridNormals(pts, (_r, c) => {
          const ang = THREE.MathUtils.lerp(-0.78 * Math.PI, 0.78 * Math.PI, c / cSegs);
          return V3(Math.cos(ang), 0.58, Math.sin(ang) * sd).normalize();
        });
        const p3Grp = new THREE.Group();
        p3Grp.add(buildSculptedBonePlateMesh(pts, norms, thick, ao, sMat(), 0.35, 0.72));
        p3Grp.add(
          addAoMesh(
            createOrganMesh(p3Center.clone().add(V3(0.002, 0.016, 0)), [0.020, 0.013, 0.019], sMat(), [0, 0, -0.28], 12),
            0.84,
          ),
        );
        push(`equ.ske.mpe.017-${tag}`, p3Grp, side);
      }
    }
  }
}
