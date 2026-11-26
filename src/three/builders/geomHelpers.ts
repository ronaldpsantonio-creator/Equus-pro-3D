import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);

export interface AnatomicalStation {
  x: number;
  yCenter: number;
  halfHeight: number;
  halfWidth: number;
  /** Optional vertical shift of widest lateral flank relative to yCenter (-0.3..0.3) */
  flankBias?: number;
  /** Dorsal sharpness factor (1 = rounded, >1 = narrower withers/crest) */
  dorsalTaper?: number;
}

export interface OrientedCoatStation {
  center: THREE.Vector3;
  /** Dorsal half-height along local dorsal normal */
  halfHeightDorsal: number;
  /** Ventral half-height along -local dorsal normal */
  halfHeightVentral: number;
  /** Half-width along Z */
  halfWidth: number;
  /** Optional vertical shift of widest flank */
  flankBias?: number;
  /** Dorsal crest taper (>1 sharpens withers & neck crest) */
  dorsalTaper?: number;
  /** Ventral sharpness (sterno-pectoral keel / mandibular taper) */
  ventralTaper?: number;
  /** Extra lateral masseter/jowl shelf in lower cheek */
  jawBulge?: number;
  /** Orbital socket concavity factor (0..1) */
  orbitPocket?: number;
  /** Nostril alar ridge & lip flare (0..1) */
  nostrilFlare?: number;
}

export interface SculptedLimbStation {
  pos: THREE.Vector3;
  rCranial: number;
  rCaudal: number;
  rLat: number;
  rMed: number;
  /** Subtle caudal flexor tendon chord silhouette (0..1) */
  tendonRidge?: number;
  /** Optional crisp cranial carpal/hock facet flattening (0..1) */
  jointFacet?: number;
}

export interface VariableTubeWaypoint {
  pos: THREE.Vector3;
  rx: number;
  ry: number;
}

export interface SheetStation {
  x: number;
  yTop: number;
  yBot: number;
  zMid: number;
  zBow: number; // outward lateral bow relative to chord
}

export interface AnatomicalLongBoneSpec {
  rMid: number;
  rProxX: number;
  rProxZ: number;
  rDistX: number;
  rDistZ: number;
  /** Adds realistic medial & lateral distal condyles + trochlear groove */
  bicondylarDistal?: boolean;
  /** Adds subtle proximal tuberosity asymmetry */
  proximalTubercle?: number;
  /** Subtle mid-shaft cranial bow in meters */
  cranialBow?: number;
  /** Diaphyseal Z flattening */
  midFlattenZ?: number;
  /** Radial segments */
  radialSegs?: number;
}

export type VertexColorFn = (
  x: number,
  y: number,
  z: number,
  tLong: number,
  uAngle: number,
  out: THREE.Color,
) => void;

/**
 * Resamples oriented coat stations via Catmull-Rom spline for smooth,
 * step-free living equine body-neck-head silhouettes.
 */
function resampleOrientedStations(
  stations: OrientedCoatStation[],
  subdivsPerSpan: number,
): OrientedCoatStation[] {
  if (stations.length < 3 || subdivsPerSpan <= 1) return stations;
  const centers = stations.map((s) => s.center);
  const curve = new THREE.CatmullRomCurve3(centers, false, 'centripetal', 0.45);
  const totalOut = (stations.length - 1) * subdivsPerSpan + 1;
  const out: OrientedCoatStation[] = [];

  const lerpField = (a: number, b: number, f: number) => a + (b - a) * f;

  for (let i = 0; i < totalOut; i++) {
    const u = i / (totalOut - 1);
    const fIdx = u * (stations.length - 1);
    const i0 = Math.min(Math.floor(fIdx), stations.length - 2);
    const localF = fIdx - i0;
    const smoothF = localF * localF * (3 - 2 * localF);
    const s0 = stations[i0];
    const s1 = stations[i0 + 1];

    out.push({
      center: curve.getPointAt(u),
      halfHeightDorsal: lerpField(s0.halfHeightDorsal, s1.halfHeightDorsal, smoothF),
      halfHeightVentral: lerpField(s0.halfHeightVentral, s1.halfHeightVentral, smoothF),
      halfWidth: lerpField(s0.halfWidth, s1.halfWidth, smoothF),
      flankBias: lerpField(s0.flankBias ?? 0, s1.flankBias ?? 0, smoothF),
      dorsalTaper: lerpField(s0.dorsalTaper ?? 1, s1.dorsalTaper ?? 1, smoothF),
      ventralTaper: lerpField(s0.ventralTaper ?? 1, s1.ventralTaper ?? 1, smoothF),
      jawBulge: lerpField(s0.jawBulge ?? 0, s1.jawBulge ?? 0, smoothF),
      orbitPocket: lerpField(s0.orbitPocket ?? 0, s1.orbitPocket ?? 0, smoothF),
      nostrilFlare: lerpField(s0.nostrilFlare ?? 0, s1.nostrilFlare ?? 0, smoothF),
    });
  }
  return out;
}

/**
 * Builds one sagittal half (left sd = -1 or right sd = +1) of a continuous,
 * anatomically oriented living equine body (buttocks -> croup -> back -> withers
 * -> neck crest -> throatlatch -> poll -> forehead -> nasal bridge -> muzzle).
 */
export function createOrientedHalfBodyCoatMesh(
  rawStations: OrientedCoatStation[],
  sd: -1 | 1,
  mat: THREE.Material,
  radialSegs = 28,
  subdivsPerSpan = 2,
  colorFn?: VertexColorFn,
): THREE.Mesh {
  const stations = resampleOrientedStations(rawStations, subdivsPerSpan);
  const cols = radialSegs + 1;
  const rows = stations.length;
  const positions: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const tangent = new THREE.Vector3();
  const dorsal = new THREE.Vector3();
  const tmpColor = new THREE.Color();

  for (let r = 0; r < rows; r++) {
    const st = stations[r];
    if (r === 0) {
      tangent.subVectors(stations[1].center, st.center);
    } else if (r === rows - 1) {
      tangent.subVectors(st.center, stations[r - 1].center);
    } else {
      tangent.subVectors(stations[r + 1].center, stations[r - 1].center);
    }
    tangent.z = 0;
    if (tangent.lengthSq() < 1e-8) tangent.set(1, 0, 0);
    tangent.normalize();

    // Rotate tangent +90 deg in XY so dorsal points roughly +Y from caudal -> cranial
    dorsal.set(-tangent.y, tangent.x, 0);
    if (dorsal.y < -0.45 && Math.abs(tangent.x) < 0.3) {
      // Keep dorsal oriented outward/upward even along vertical muzzle slope
      dorsal.negate();
    }

    const vCoord = r / Math.max(rows - 1, 1);
    const flankBias = st.flankBias ?? 0;
    const dorsalTaper = st.dorsalTaper ?? 1;
    const ventralTaper = st.ventralTaper ?? 1;
    const jawBulge = st.jawBulge ?? 0;
    const orbitPocket = st.orbitPocket ?? 0;
    const nostrilFlare = st.nostrilFlare ?? 0;

    for (let c = 0; c <= radialSegs; c++) {
      const uCoord = c / radialSegs;
      const theta = uCoord * Math.PI; // 0 = dorsal midline, PI/2 = lateral flank, PI = ventral midline
      const sinT = Math.sin(theta);
      const cosT = Math.cos(theta);

      // Independent dorsal & ventral cross-sectional height
      const localH = cosT >= 0 ? st.halfHeightDorsal : st.halfHeightVentral;
      const dorsalWeight = cosT > 0 ? Math.pow(cosT, 0.85) * (dorsalTaper - 1) : 0;
      const ventralWeight = cosT < 0 ? Math.pow(-cosT, 0.9) * (ventralTaper - 1) : 0;
      let zScale = Math.max(0.06, 1 - dorsalWeight * 0.46 - ventralWeight * 0.35);

      // Masseter / cheek jowl bulge around theta = 0.62*PI
      if (jawBulge > 0) {
        const jowlBell = Math.exp(-Math.pow((uCoord - 0.62) / 0.16, 2));
        zScale += jawBulge * jowlBell;
      }

      // Eye orbital pocket concavity around theta = 0.30*PI + brow ridge at 0.16*PI
      if (orbitPocket > 0) {
        const orbitBell = Math.exp(-Math.pow((uCoord - 0.30) / 0.085, 2));
        const browBell = Math.exp(-Math.pow((uCoord - 0.15) / 0.075, 2));
        zScale *= 1 - orbitPocket * 0.25 * orbitBell;
        zScale += orbitPocket * 0.08 * browBell;
      }

      // Flared nostril ala & lip contour near muzzle
      let dShift = 0;
      if (nostrilFlare > 0) {
        const nostrilBell = Math.exp(-Math.pow((uCoord - 0.36) / 0.14, 2));
        const lipNotch = Math.exp(-Math.pow((uCoord - 0.72) / 0.06, 2));
        zScale += nostrilFlare * (0.22 * nostrilBell - 0.12 * lipNotch);
        dShift -= nostrilFlare * 0.004 * lipNotch;
      }

      const z = sd * st.halfWidth * sinT * zScale;
      const dDist =
        localH * cosT +
        flankBias * ((st.halfHeightDorsal + st.halfHeightVentral) * 0.5) * sinT * sinT +
        dShift;

      const px = st.center.x + dorsal.x * dDist;
      const py = st.center.y + dorsal.y * dDist;

      positions.push(px, py, z);
      uvs.push(vCoord * 4.4, uCoord * 1.15);

      if (colorFn) {
        colorFn(px, py, z, vCoord, uCoord, tmpColor);
        colors.push(tmpColor.r, tmpColor.g, tmpColor.b);
      }
    }
  }

  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < radialSegs; c++) {
      const a = r * cols + c;
      const b = a + 1;
      const d = (r + 1) * cols + c;
      const e = d + 1;
      if (sd === 1) {
        indices.push(a, b, d, b, e, d);
      } else {
        indices.push(a, d, b, b, d, e);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  if (colorFn) {
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  }
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Builds one anatomical half (left sd = -1 or right sd = +1) of a continuous
 * lofted living-horse envelope split cleanly along Z = 0.
 */
export function createHalfLoftedContourMesh(
  stations: AnatomicalStation[],
  sd: -1 | 1,
  mat: THREE.Material,
  radialSegs = 22,
): THREE.Mesh {
  const cols = radialSegs + 1;
  const rows = stations.length;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let r = 0; r < rows; r++) {
    const st = stations[r];
    const vCoord = r / Math.max(rows - 1, 1);
    const flankBias = st.flankBias ?? 0;
    const dorsalTaper = st.dorsalTaper ?? 1;

    for (let c = 0; c <= radialSegs; c++) {
      const uCoord = c / radialSegs;
      const theta = uCoord * Math.PI; // 0 = dorsal midline, PI/2 = lateral, PI = ventral midline
      const sinT = Math.sin(theta);
      const cosT = Math.cos(theta);

      const dorsalWeight = cosT > 0 ? Math.pow(cosT, 0.85) * (dorsalTaper - 1) : 0;
      const zScale = Math.max(0.08, 1 - dorsalWeight * 0.45);
      const z = sd * st.halfWidth * sinT * zScale;

      const y = st.yCenter + st.halfHeight * cosT + flankBias * st.halfHeight * sinT * sinT;

      positions.push(st.x, y, z);
      uvs.push(vCoord * 2.2, uCoord);
    }
  }

  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < radialSegs; c++) {
      const a = r * cols + c;
      const b = a + 1;
      const d = (r + 1) * cols + c;
      const e = d + 1;
      if (sd === 1) {
        indices.push(a, b, d, b, e, d);
      } else {
        indices.push(a, d, b, b, d, e);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Builds an anatomically sculpted equine limb with Catmull-Rom smoothed joints,
 * asymmetric cranial/caudal/lateral/medial radii, caudal flexor tendon silhouette,
 * and optional per-vertex coat-to-dark-point color blending.
 */
export function createSculptedEquineLimbMesh(
  rawStations: SculptedLimbStation[],
  sd: -1 | 1,
  mat: THREE.Material,
  radialSegs = 22,
  subdivsPerSpan = 2,
  colorFn?: VertexColorFn,
): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(
    rawStations.map((s) => s.pos),
    false,
    'centripetal',
    0.4,
  );
  const stations: SculptedLimbStation[] = [];
  const totalOut = (rawStations.length - 1) * subdivsPerSpan + 1;
  const lerp = (a: number, b: number, f: number) => a + (b - a) * f;

  for (let i = 0; i < totalOut; i++) {
    const u = i / (totalOut - 1);
    const fIdx = u * (rawStations.length - 1);
    const i0 = Math.min(Math.floor(fIdx), rawStations.length - 2);
    const f = fIdx - i0;
    const sf = f * f * (3 - 2 * f);
    const s0 = rawStations[i0];
    const s1 = rawStations[i0 + 1];
    stations.push({
      pos: curve.getPointAt(u),
      rCranial: lerp(s0.rCranial, s1.rCranial, sf),
      rCaudal: lerp(s0.rCaudal, s1.rCaudal, sf),
      rLat: lerp(s0.rLat, s1.rLat, sf),
      rMed: lerp(s0.rMed, s1.rMed, sf),
      tendonRidge: lerp(s0.tendonRidge ?? 0, s1.tendonRidge ?? 0, sf),
      jointFacet: lerp(s0.jointFacet ?? 0, s1.jointFacet ?? 0, sf),
    });
  }

  const rows = stations.length;
  const cols = radialSegs + 1;
  const positions: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const tangent = new THREE.Vector3();
  const sideVec = new THREE.Vector3(0, 0, 1);
  const fwdVec = new THREE.Vector3();
  const localSide = new THREE.Vector3();
  const tmpColor = new THREE.Color();

  for (let r = 0; r < rows; r++) {
    const st = stations[r];
    if (r === 0) {
      tangent.subVectors(stations[1].pos, st.pos).normalize();
    } else if (r === rows - 1) {
      tangent.subVectors(st.pos, stations[r - 1].pos).normalize();
    } else {
      tangent.subVectors(stations[r + 1].pos, stations[r - 1].pos).normalize();
    }

    fwdVec.crossVectors(sideVec, tangent);
    if (fwdVec.lengthSq() < 0.001) fwdVec.set(1, 0, 0);
    else fwdVec.normalize();
    localSide.crossVectors(tangent, fwdVec).normalize();

    const vCoord = r / Math.max(rows - 1, 1);
    const tendonRidge = st.tendonRidge ?? 0;
    const jointFacet = st.jointFacet ?? 0;

    for (let c = 0; c <= radialSegs; c++) {
      const uCoord = c / radialSegs;
      const phi = uCoord * Math.PI * 2;
      const cosP = Math.cos(phi);
      const sinP = Math.sin(phi);

      const rx = cosP >= 0 ? st.rCranial : st.rCaudal;
      // sinP * sd > 0 is lateral side, < 0 is medial side
      const rz = sinP * sd >= 0 ? st.rLat : st.rMed;

      let cx = cosP * rx;
      let cz = sinP * rz;

      // Sculpt caudal flexor tendon groove on cannon & gaskin (concave lateral/medial pinch just cranial to caudal ridge)
      if (tendonRidge > 0 && cosP < -0.15) {
        const caudality = -cosP; // 0..1
        const grooveMask = Math.exp(-Math.pow((Math.abs(sinP) - 0.72) / 0.28, 2));
        cz *= 1 - tendonRidge * 0.24 * grooveMask * caudality;
      }

      // Slightly flatten cranial face of carpus / hock joint for bony definition
      if (jointFacet > 0 && cosP > 0.55) {
        cx *= 1 - jointFacet * 0.09 * (cosP - 0.55);
      }

      const px = st.pos.x + fwdVec.x * cx + localSide.x * cz;
      const py = st.pos.y + fwdVec.y * cx + localSide.y * cz;
      const pz = st.pos.z + fwdVec.z * cx + localSide.z * cz;

      positions.push(px, py, pz);
      uvs.push(uCoord, vCoord * 2.4);

      if (colorFn) {
        colorFn(px, py, pz, vCoord, uCoord, tmpColor);
        colors.push(tmpColor.r, tmpColor.g, tmpColor.b);
      }
    }
  }

  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < radialSegs; c++) {
      const a = r * cols + c;
      const b = a + 1;
      const d = (r + 1) * cols + c;
      const e = d + 1;
      // Outward CCW winding: (a, b, d) -> dP/dc x dP/dr points radially outward
      indices.push(a, b, d, b, e, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  if (colorFn) {
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  }
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Builds a sculpted hollow equine external ear (pinna) with concave cranial opening,
 * gracefully curving medial/rostral tip, and dark ear-margin shading.
 */
export function createEquineEarPinnaMesh(
  basePos: THREE.Vector3,
  tipPos: THREE.Vector3,
  sd: -1 | 1,
  mat: THREE.Material,
): THREE.Mesh {
  const heightSegs = 14;
  const arcSegs = 12;
  const cols = arcSegs + 1;
  const positions: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const axis = new THREE.Vector3().subVectors(tipPos, basePos);
  const len = axis.length();
  const up = axis.clone().normalize();
  // Cranial opening faces roughly +X and slightly lateral (+Z * sd)
  const openDir = new THREE.Vector3(0.88, 0.06, 0.42 * sd).normalize();
  const sideDir = new THREE.Vector3().crossVectors(up, openDir).normalize();
  const tmpColor = new THREE.Color();

  for (let r = 0; r <= heightSegs; r++) {
    const t = r / heightSegs;
    // Tip curves gracefully inward toward midline and slightly forward
    const inwardCurve = Math.sin(t * Math.PI * 0.65) * -0.011 * sd - t * t * 0.012 * sd;
    const fwdCurve = Math.sin(t * Math.PI) * 0.008;

    const spineCenter = basePos
      .clone()
      .addScaledVector(up, t * len)
      .add(new THREE.Vector3(fwdCurve, 0, inwardCurve));

    // Lanceolate equine ear width profile (widest around t = 0.35, tapering cleanly to pointed tip)
    const widthProfile = Math.sin(Math.pow(t, 0.7) * Math.PI * 0.96);
    const halfWidth = 0.025 * Math.max(0.06, widthProfile);
    const cupDepth = 0.017 * Math.max(0.1, widthProfile);

    for (let c = 0; c <= arcSegs; c++) {
      const u = c / arcSegs;
      const ang = u * Math.PI * 2;
      const lat = Math.sin(ang) * halfWidth;
      const isInner = Math.cos(ang) > 0;
      const rimFlare = Math.pow(Math.sin(ang), 2) * cupDepth * 0.75;
      const depthOffset = isInner
        ? -cupDepth * 0.35 + rimFlare + 0.0025
        : -cupDepth * 0.35 + rimFlare - 0.0085 * (0.45 + 0.55 * Math.abs(Math.cos(ang)));

      const p = spineCenter
        .clone()
        .addScaledVector(sideDir, lat)
        .addScaledVector(openDir, depthOffset);

      positions.push(p.x, p.y, p.z);
      uvs.push(u, t);

      const darkFactor = Math.min(1, t * 0.62 + (Math.abs(Math.sin(ang)) > 0.8 ? 0.35 : 0));
      if (isInner && t < 0.72) {
        tmpColor.setRGB(0.62, 0.44, 0.33);
      } else {
        tmpColor.setRGB(
          THREE.MathUtils.lerp(0.95, 0.28, darkFactor),
          THREE.MathUtils.lerp(0.90, 0.22, darkFactor),
          THREE.MathUtils.lerp(0.86, 0.19, darkFactor),
        );
      }
      colors.push(tmpColor.r, tmpColor.g, tmpColor.b);
    }
  }

  for (let r = 0; r < heightSegs; r++) {
    for (let c = 0; c < arcSegs; c++) {
      const a = r * cols + c;
      const b = a + 1;
      const d = (r + 1) * cols + c;
      const e = d + 1;
      indices.push(a, b, d, b, e, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Builds sculpted upper and lower eyelid folds around the eye orbit on the coat.
 */
export function createEquineEyelidMesh(
  orbitCenter: THREE.Vector3,
  sd: -1 | 1,
  mat: THREE.Material,
): THREE.Group {
  const g = new THREE.Group();
  const makeLid = (isUpper: boolean) => {
    const pts: VariableTubeWaypoint[] = [];
    const steps = 8;
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const ang = THREE.MathUtils.lerp(-0.95, 0.95, u);
      const arch = Math.cos(ang * 1.45) * (isUpper ? 0.019 : -0.016);
      const fwd = Math.sin(ang) * 0.023;
      const zOut = Math.cos(ang * 0.85) * 0.015 * sd;
      const thick = 0.0055 * (0.45 + 0.55 * Math.cos(ang));
      pts.push({
        pos: new THREE.Vector3(
          orbitCenter.x + fwd,
          orbitCenter.y + arch,
          orbitCenter.z + zOut,
        ),
        rx: thick,
        ry: thick * 0.85,
      });
    }
    return createMultiStationLoftTube(pts, mat, 10);
  };
  g.add(makeLid(true));
  g.add(makeLid(false));
  return g;
}

/**
 * Builds a gracefully tapered, organic hair lock along a 3D curve (forelock, mane, tail strands).
 */
export function createTaperedHairStrandMesh(
  points: THREE.Vector3[],
  baseRadius: number,
  tipRadius: number,
  mat: THREE.Material,
  tubularSegs = 14,
  radialSegs = 8,
  flattenZ = 0.65,
): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(points);
  const wps: VariableTubeWaypoint[] = [];
  for (let i = 0; i <= tubularSegs; i++) {
    const t = i / tubularSegs;
    const r = THREE.MathUtils.lerp(baseRadius, tipRadius, Math.pow(t, 0.72));
    wps.push({
      pos: curve.getPoint(t),
      rx: r,
      ry: r * flattenZ,
    });
  }
  return createMultiStationLoftTube(wps, mat, radialSegs);
}

/**
 * Builds a realistic multi-station sculpted limb segment along arbitrary 3D points
 * with radius & Z-flattening profile.
 */
export function createSculptedLimbPath(
  waypoints: Array<{ pos: THREE.Vector3; radiusX: number; radiusZ: number }>,
  mat: THREE.Material,
  radialSegs = 16,
): THREE.Mesh {
  const rows = waypoints.length;
  const cols = radialSegs + 1;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const tangent = new THREE.Vector3();
  const sideVec = new THREE.Vector3(0, 0, 1);
  const fwdVec = new THREE.Vector3();
  const localSide = new THREE.Vector3();

  for (let r = 0; r < rows; r++) {
    const wp = waypoints[r];
    if (r === 0) {
      tangent.subVectors(waypoints[1].pos, wp.pos).normalize();
    } else if (r === rows - 1) {
      tangent.subVectors(wp.pos, waypoints[r - 1].pos).normalize();
    } else {
      tangent.subVectors(waypoints[r + 1].pos, waypoints[r - 1].pos).normalize();
    }

    fwdVec.crossVectors(sideVec, tangent);
    if (fwdVec.lengthSq() < 0.001) {
      fwdVec.set(1, 0, 0);
    } else {
      fwdVec.normalize();
    }
    localSide.crossVectors(tangent, fwdVec).normalize();

    const vCoord = r / Math.max(rows - 1, 1);
    for (let c = 0; c <= radialSegs; c++) {
      const uCoord = c / radialSegs;
      const phi = uCoord * Math.PI * 2;
      const cx = Math.cos(phi) * wp.radiusX;
      const cz = Math.sin(phi) * wp.radiusZ;

      const px = wp.pos.x + fwdVec.x * cx + localSide.x * cz;
      const py = wp.pos.y + fwdVec.y * cx + localSide.y * cz;
      const pz = wp.pos.z + fwdVec.z * cx + localSide.z * cz;

      positions.push(px, py, pz);
      uvs.push(uCoord, vCoord * 2);
    }
  }

  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < radialSegs; c++) {
      const a = r * cols + c;
      const b = a + 1;
      const d = (r + 1) * cols + c;
      const e = d + 1;
      indices.push(a, b, d, b, e, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Builds a closed curved tube with independent per-station semi-axes (rx, ry)
 * and optional haustral sacculation modulation (for equine cecum, colon, J-stomach, kidneys).
 */
export function createMultiStationLoftTube(
  waypoints: VariableTubeWaypoint[],
  mat: THREE.Material,
  radialSegs = 16,
  haustraFreq = 0,
  haustraAmp = 0,
): THREE.Mesh {
  const first = waypoints[0];
  const last = waypoints[waypoints.length - 1];
  const tStart = new THREE.Vector3().subVectors(waypoints[1].pos, first.pos).normalize();
  const tEnd = new THREE.Vector3().subVectors(last.pos, waypoints[waypoints.length - 2].pos).normalize();

  const pts: VariableTubeWaypoint[] = [
    { pos: first.pos.clone().addScaledVector(tStart, -0.006), rx: 0.0015, ry: 0.0015 },
    ...waypoints,
    { pos: last.pos.clone().addScaledVector(tEnd, 0.006), rx: 0.0015, ry: 0.0015 },
  ];

  const rows = pts.length;
  const cols = radialSegs + 1;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const tangent = new THREE.Vector3();
  const upRef = new THREE.Vector3(0, 1, 0);
  const sideRef = new THREE.Vector3(0, 0, 1);
  const binormal = new THREE.Vector3();
  const normal = new THREE.Vector3();

  for (let r = 0; r < rows; r++) {
    const wp = pts[r];
    if (r === 0) tangent.subVectors(pts[1].pos, wp.pos).normalize();
    else if (r === rows - 1) tangent.subVectors(wp.pos, pts[r - 1].pos).normalize();
    else tangent.subVectors(pts[r + 1].pos, pts[r - 1].pos).normalize();

    const ref = Math.abs(tangent.dot(upRef)) > 0.92 ? sideRef : upRef;
    binormal.crossVectors(tangent, ref).normalize();
    normal.crossVectors(binormal, tangent).normalize();

    const vCoord = r / Math.max(rows - 1, 1);
    const haustraWave =
      haustraFreq > 0 ? 1 + haustraAmp * Math.sin(vCoord * Math.PI * haustraFreq) : 1;

    for (let c = 0; c <= radialSegs; c++) {
      const uCoord = c / radialSegs;
      const phi = uCoord * Math.PI * 2;
      const taeniaFactor = haustraFreq > 0 ? 1 - 0.08 * Math.pow(Math.cos(phi * 2), 4) : 1;
      const rx = wp.rx * haustraWave * taeniaFactor;
      const ry = wp.ry * haustraWave * taeniaFactor;

      const cPhi = Math.cos(phi) * rx;
      const sPhi = Math.sin(phi) * ry;
      positions.push(
        wp.pos.x + binormal.x * cPhi + normal.x * sPhi,
        wp.pos.y + binormal.y * cPhi + normal.y * sPhi,
        wp.pos.z + binormal.z * cPhi + normal.z * sPhi,
      );
      uvs.push(uCoord, vCoord * 3);
    }
  }

  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < radialSegs; c++) {
      const a = r * cols + c;
      const b = a + 1;
      const d = (r + 1) * cols + c;
      const e = d + 1;
      indices.push(a, d, b, b, d, e);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Builds cranio-caudally flattened oval rib blades (`costillas aplanadas`)
 * instead of circular hoses.
 */
export function createFlatRibMesh(
  points: THREE.Vector3[],
  widthX: number,
  thickZ: number,
  mat: THREE.Material,
  tubularSegs = 18,
  radialSegs = 10,
): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(points);
  const wps: VariableTubeWaypoint[] = [];
  for (let i = 0; i <= tubularSegs; i++) {
    const t = i / tubularSegs;
    // Slight natural widening along mid-rib body
    const midFlare = 0.85 + 0.25 * Math.sin(t * Math.PI);
    wps.push({
      pos: curve.getPoint(t),
      rx: thickZ * midFlare,
      ry: widthX * midFlare,
    });
  }
  return createMultiStationLoftTube(wps, mat, radialSegs);
}

/**
 * Builds a high-detail equine long bone between `a` (proximal) and `b` (distal)
 * with asymmetric proximal/distal epiphyses, bicondylar distal groove, and diaphyseal bow.
 */
export function createAnatomicalLongBoneMesh(
  a: THREE.Vector3,
  b: THREE.Vector3,
  spec: AnatomicalLongBoneSpec,
  mat: THREE.Material,
): THREE.Mesh {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = Math.max(dir.length(), 0.02);
  const rows = 16;
  const radialSegs = spec.radialSegs ?? 18;
  const cols = radialSegs + 1;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const bow = spec.cranialBow ?? 0;
  const midFlatZ = spec.midFlattenZ ?? 0.85;
  const proxTub = spec.proximalTubercle ?? 0;

  for (let r = 0; r <= rows; r++) {
    const t = r / rows; // 0 = proximal (a), 1 = distal (b)
    const yLocal = -len * 0.5 + t * len;
    const proxWeight = Math.pow(Math.max(0, 1 - t * 3.1), 1.8);
    const distWeight = Math.pow(Math.max(0, (t - 0.68) / 0.32), 1.8);
    const endPinch = r === 0 || r === rows ? 0.08 : 1;

    const rx =
      (spec.rMid * (1 - proxWeight - distWeight) +
        spec.rProxX * proxWeight +
        spec.rDistX * distWeight) *
      endPinch;
    const rz =
      (spec.rMid * midFlatZ * (1 - proxWeight - distWeight) +
        spec.rProxZ * proxWeight +
        spec.rDistZ * distWeight) *
      endPinch;

    const bowShiftX = bow * Math.sin(t * Math.PI);

    for (let c = 0; c <= radialSegs; c++) {
      const u = c / radialSegs;
      const phi = u * Math.PI * 2;
      const cosP = Math.cos(phi);
      const sinP = Math.sin(phi);

      let px = cosP * rx + bowShiftX;
      let pz = sinP * rz;

      // Bicondylar distal articular groove (sagittal trochlear valley at sinP ~ 0)
      if (spec.bicondylarDistal && t > 0.78 && r < rows) {
        const condyleFactor = Math.sin(((t - 0.78) / 0.22) * Math.PI * 0.85);
        const condyleLobing = 1 + 0.22 * condyleFactor * (Math.pow(Math.abs(sinP), 1.4) - 0.35);
        px *= condyleLobing;
        pz *= 1 + 0.12 * condyleFactor;
      }

      // Proximal tubercle flare
      if (proxTub > 0 && t < 0.24 && r > 0 && cosP > 0.2) {
        px += proxTub * (1 - t / 0.24) * cosP;
      }

      positions.push(px, yLocal, pz);
      uvs.push(u, t * 2);
    }
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < radialSegs; c++) {
      const i0 = r * cols + c;
      const i1 = i0 + 1;
      const i2 = (r + 1) * cols + c;
      const i3 = i2 + 1;
      indices.push(i0, i2, i1, i1, i2, i3);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  // Local +Y aligns with b -> a (proximal at -Y -> distal at +Y => vector a -> b)
  mesh.quaternion.setFromUnitVectors(UP, dir.normalize());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Builds an anatomical extruded plate with beveled edges and optional perforations
 * (used for Scapula blade, Coxal with obturator foramen, Atlas wings, Axis crest, Facial plates).
 */
export function createAnatomicalExtrudedPlate(
  contourPts: Array<[number, number]>,
  depth: number,
  bevelSize: number,
  mat: THREE.Material,
  holesPts?: Array<Array<[number, number]>>,
): THREE.Mesh {
  const shape = new THREE.Shape();
  contourPts.forEach(([x, y], idx) => {
    if (idx === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  });
  shape.closePath();

  if (holesPts) {
    for (const holeCoords of holesPts) {
      const hole = new THREE.Path();
      holeCoords.forEach(([x, y], idx) => {
        if (idx === 0) hole.moveTo(x, y);
        else hole.lineTo(x, y);
      });
      hole.closePath();
      shape.holes.push(hole);
    }
  }

  const geo = new THREE.ExtrudeGeometry(shape, {
    steps: 1,
    depth,
    bevelEnabled: bevelSize > 0,
    bevelThickness: bevelSize,
    bevelSize,
    bevelSegments: 2,
  });
  geo.translate(0, 0, -depth * 0.5);
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export interface MusclePathWaypoint {
  pos: THREE.Vector3;
  /** Lateral/thickness semi-axis (m) */
  rx: number;
  /** Width/depth semi-axis (m) */
  ry: number;
}

export interface BiospheraMuscleOptions {
  originTendonFrac?: number;
  insertionTendonFrac?: number;
  isDeep?: boolean;
  radialSegs?: number;
  subdivsPerSpan?: number;
  /** Darken medial/edge border subtly to carve intermuscular grooves */
  grooveAO?: number;
}

/**
 * Builds a Biosphera-style curved, sculpted écorché muscle belly along a 3D anatomical path
 * with fiber-aligned UVs, gradual silvery myotendinous origin/insertion transitions,
 * and subtle intermuscular crease shading.
 */
export function createBiospheraMuscleMesh(
  rawWaypoints: MusclePathWaypoint[],
  mat: THREE.Material,
  opts: BiospheraMuscleOptions = {},
): THREE.Mesh {
  const originTendonFrac = opts.originTendonFrac ?? 0.14;
  const insertionTendonFrac = opts.insertionTendonFrac ?? 0.18;
  const matColorR = (mat as THREE.MeshStandardMaterial).color?.r ?? 0.6;
  const isDeep = opts.isDeep ?? matColorR < 0.45;
  const radialSegs = opts.radialSegs ?? 16;
  const subdivsPerSpan = opts.subdivsPerSpan ?? 3;
  const grooveAO = opts.grooveAO ?? 0.22;

  const curve = new THREE.CatmullRomCurve3(
    rawWaypoints.map((w) => w.pos),
    false,
    'centripetal',
    0.45,
  );

  const wps: MusclePathWaypoint[] = [];
  const innerCount = Math.max(rawWaypoints.length - 1, 1) * subdivsPerSpan + 1;
  const lerp = (a: number, b: number, f: number) => a + (b - a) * f;

  // Tapered tip end-caps for watertight organic termination
  const p0 = curve.getPointAt(0);
  const t0 = curve.getTangentAt(0);
  wps.push({ pos: p0.clone().addScaledVector(t0, -0.004), rx: 0.0015, ry: 0.0015 });

  for (let i = 0; i < innerCount; i++) {
    const u = i / (innerCount - 1);
    const fIdx = u * (rawWaypoints.length - 1);
    const i0 = Math.min(Math.floor(fIdx), rawWaypoints.length - 2);
    const f = fIdx - i0;
    const sf = f * f * (3 - 2 * f);
    const w0 = rawWaypoints[i0];
    const w1 = rawWaypoints[i0 + 1];

    // Smooth end taper right near origin & insertion
    const endEnvelope =
      Math.min(1, Math.pow(u / 0.09, 0.65)) * Math.min(1, Math.pow((1 - u) / 0.09, 0.65));
    const scaleEnv = i === 0 || i === innerCount - 1 ? 0.22 : 0.22 + 0.78 * endEnvelope;

    wps.push({
      pos: curve.getPointAt(u),
      rx: lerp(w0.rx, w1.rx, sf) * scaleEnv,
      ry: lerp(w0.ry, w1.ry, sf) * scaleEnv,
    });
  }

  const pEnd = curve.getPointAt(1);
  const tEnd = curve.getTangentAt(1);
  wps.push({ pos: pEnd.clone().addScaledVector(tEnd, 0.004), rx: 0.0015, ry: 0.0015 });

  const rows = wps.length;
  const cols = radialSegs + 1;
  const positions: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const tangent = new THREE.Vector3();
  const upRef = new THREE.Vector3(0, 1, 0);
  const sideRef = new THREE.Vector3(0, 0, 1);
  const binormal = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const tmpColor = new THREE.Color();

  // Base Biosphera écorché linear RGBs (multiplied against neutral-bright muscleColor texture)
  const bellyR = isDeep ? 0.52 : 0.78;
  const bellyG = isDeep ? 0.08 : 0.14;
  const bellyB = isDeep ? 0.07 : 0.11;

  for (let r = 0; r < rows; r++) {
    const wp = wps[r];
    if (r === 0) tangent.subVectors(wps[1].pos, wp.pos).normalize();
    else if (r === rows - 1) tangent.subVectors(wp.pos, wps[r - 1].pos).normalize();
    else tangent.subVectors(wps[r + 1].pos, wps[r - 1].pos).normalize();

    const ref = Math.abs(tangent.dot(sideRef)) > 0.9 ? upRef : sideRef;
    binormal.crossVectors(tangent, ref).normalize();
    normal.crossVectors(binormal, tangent).normalize();

    const vCoord = r / Math.max(rows - 1, 1);
    const origTendon =
      originTendonFrac > 0.01 ? 1 - THREE.MathUtils.smoothstep(vCoord, 0.02, originTendonFrac + 0.08) : 0;
    const insTendon =
      insertionTendonFrac > 0.01
        ? THREE.MathUtils.smoothstep(vCoord, 1 - insertionTendonFrac - 0.08, 0.98)
        : 0;
    const tendonBlend = Math.max(origTendon, insTendon);

    for (let c = 0; c <= radialSegs; c++) {
      const uCoord = c / radialSegs;
      const phi = uCoord * Math.PI * 2;
      const cosP = Math.cos(phi);
      const sinP = Math.sin(phi);

      // Gentle fascicle flute relief around the muscle belly
      const fascicleMod = 1 + 0.035 * Math.sin(phi * 5);
      const cx = cosP * wp.rx * fascicleMod;
      const cy = sinP * wp.ry * fascicleMod;

      positions.push(
        wp.pos.x + binormal.x * cx + normal.x * cy,
        wp.pos.y + binormal.y * cx + normal.y * cy,
        wp.pos.z + binormal.z * cx + normal.z * cy,
      );
      uvs.push(uCoord * 1.4, vCoord * 2.2);

      // Edge AO around minor/major flanks + pearly white-silver myotendinous gradient
      const flankDark = Math.pow(Math.abs(sinP), 1.8) * grooveAO * (1 - tendonBlend);
      const mr = THREE.MathUtils.lerp(bellyR * (1 - flankDark), 0.96, tendonBlend);
      const mg = THREE.MathUtils.lerp(bellyG * (1 - flankDark), 0.93, tendonBlend);
      const mb = THREE.MathUtils.lerp(bellyB * (1 - flankDark), 0.89, tendonBlend);
      tmpColor.setRGB(mr, mg, mb);
      colors.push(tmpColor.r, tmpColor.g, tmpColor.b);
    }
  }

  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < radialSegs; c++) {
      const a = r * cols + c;
      const b = a + 1;
      const d = (r + 1) * cols + c;
      const e = d + 1;
      indices.push(a, d, b, b, d, e);
    }
  }

  const sheetMat = mat.clone();
  if ('vertexColors' in sheetMat) {
    (sheetMat as THREE.MeshStandardMaterial).vertexColors = true;
    (sheetMat as THREE.MeshStandardMaterial).color.setHex(0xffffff);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, sheetMat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export interface SculptedSheetOptions {
  verticalSegs?: number;
  longSubdivs?: number;
  horizontalFibers?: boolean;
  aponeuroticEdgeFade?: boolean;
  /** 0..0.5 fraction of dorsal edge fading to glistening silver aponeurosis */
  dorsalAponeurosis?: number;
  /** 0..0.5 fraction of ventral edge fading to glistening silver aponeurosis */
  ventralAponeurosis?: number;
  /** Optional number of serrated costal digitations along ventral edge */
  costalDigitations?: number;
  /** Real volumetric slab thickness in meters (0 = double-sided sheet, >0 = closed solid slab) */
  thickness?: number;
  isDeep?: boolean;
}

/**
 * Builds a Catmull-Rom smoothed, volumetric Biosphera anatomical sheet muscle or aponeurosis
 * with optional costal digitations and realistic myo-aponeurotic transitions.
 */
export function createSculptedMuscleSheetMesh(
  rawStations: SheetStation[],
  sd: -1 | 1,
  mat: THREE.Material,
  opts: SculptedSheetOptions = {},
): THREE.Mesh {
  const verticalSegs = opts.verticalSegs ?? 14;
  const longSubdivs = opts.longSubdivs ?? 3;
  const horizontalFibers = opts.horizontalFibers ?? true;
  const aponeuroticEdgeFade = opts.aponeuroticEdgeFade ?? true;
  const dorsalApo = opts.dorsalAponeurosis ?? 0.2;
  const ventralApo = opts.ventralAponeurosis ?? 0.22;
  const digitations = opts.costalDigitations ?? 0;
  const thickness = opts.thickness ?? 0.012;
  const matColorR = (mat as THREE.MeshStandardMaterial).color?.r ?? 0.6;
  const isDeep = opts.isDeep ?? matColorR < 0.45;

  // Smooth stations longitudinally via Catmull-Rom interpolation
  const stations: SheetStation[] = [];
  if (rawStations.length >= 2 && longSubdivs > 1) {
    const total = (rawStations.length - 1) * longSubdivs + 1;
    const cTop = new THREE.CatmullRomCurve3(
      rawStations.map((s) => new THREE.Vector3(s.x, s.yTop, s.zMid)),
      false,
      'centripetal',
      0.45,
    );
    const cBot = new THREE.CatmullRomCurve3(
      rawStations.map((s) => new THREE.Vector3(s.x, s.yBot, s.zMid)),
      false,
      'centripetal',
      0.45,
    );
    for (let i = 0; i < total; i++) {
      const u = i / (total - 1);
      const fIdx = u * (rawStations.length - 1);
      const i0 = Math.min(Math.floor(fIdx), rawStations.length - 2);
      const f = fIdx - i0;
      const sf = f * f * (3 - 2 * f);
      const pTop = cTop.getPointAt(u);
      const pBot = cBot.getPointAt(u);
      stations.push({
        x: (pTop.x + pBot.x) * 0.5,
        yTop: pTop.y,
        yBot: pBot.y,
        zMid: (pTop.z + pBot.z) * 0.5,
        zBow: rawStations[i0].zBow + (rawStations[i0 + 1].zBow - rawStations[i0].zBow) * sf,
      });
    }
  } else {
    stations.push(...rawStations);
  }

  const rows = stations.length;
  const cols = verticalSegs + 1;
  const positions: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const tmpColor = new THREE.Color();

  const bellyR = isDeep ? 0.52 : 0.78;
  const bellyG = isDeep ? 0.08 : 0.14;
  const bellyB = isDeep ? 0.07 : 0.11;

  const layersCount = thickness > 0.001 ? 2 : 1; // outer face (layer 0), inner face (layer 1)
  const layerVertCount = rows * cols;

  for (let layer = 0; layer < layersCount; layer++) {
    const isInner = layer === 1;
    for (let r = 0; r < rows; r++) {
      const st = stations[r];
      const uCoord = r / Math.max(rows - 1, 1);
      const digWave =
        digitations > 0
          ? 0.034 * Math.max(0, Math.sin(uCoord * Math.PI * digitations * 2))
          : 0;

      for (let c = 0; c <= verticalSegs; c++) {
        const vCoord = c / verticalSegs;
        const yBotMod = st.yBot - digWave * Math.pow(vCoord, 2.2);
        const y = THREE.MathUtils.lerp(st.yTop, yBotMod, vCoord);
        const bow = st.zBow * Math.sin(vCoord * Math.PI);

        // Taper thickness smoothly to 0 along perimeter edges for clean anatomical bevel
        const edgeEnv = Math.sin(vCoord * Math.PI) * Math.sin(uCoord * Math.PI);
        const thickOffset = isInner ? -thickness * Math.pow(Math.max(0, edgeEnv), 0.45) : 0;
        const z = (st.zMid + bow + thickOffset) * sd;

        positions.push(st.x, y, z);
        uvs.push(horizontalFibers ? vCoord * 1.5 : uCoord * 1.5, horizontalFibers ? uCoord * 2.0 : vCoord * 2.0);

        if (aponeuroticEdgeFade) {
          const dFade = dorsalApo > 0 ? 1 - THREE.MathUtils.smoothstep(vCoord, 0.0, dorsalApo) : 0;
          const vFade = ventralApo > 0 ? THREE.MathUtils.smoothstep(vCoord, 1.0 - ventralApo, 1.0) : 0;
          const apo = Math.max(dFade, vFade);
          const edgeShadow = (1 - Math.sin(uCoord * Math.PI) * 0.25) * 0.16;
          tmpColor.setRGB(
            THREE.MathUtils.lerp(bellyR * (1 - edgeShadow), 0.96, apo),
            THREE.MathUtils.lerp(bellyG * (1 - edgeShadow), 0.94, apo),
            THREE.MathUtils.lerp(bellyB * (1 - edgeShadow), 0.91, apo),
          );
          colors.push(tmpColor.r, tmpColor.g, tmpColor.b);
        }
      }
    }
  }

  // Outward normal direction depends on sd and whether stations advance +X or -X
  const forwardX = stations[stations.length - 1].x >= stations[0].x ? 1 : -1;
  const flipSide = sd * forwardX;

  // Outer surface triangles (outward CCW normal points toward +Z*sd)
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < verticalSegs; c++) {
      const a = r * cols + c;
      const b = a + 1;
      const d = (r + 1) * cols + c;
      const e = d + 1;
      if (flipSide >= 0) indices.push(a, b, d, b, e, d);
      else indices.push(a, d, b, b, d, e);
    }
  }

  // Inner surface triangles (opposite winding) if volumetric slab
  if (layersCount === 2) {
    const off = layerVertCount;
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < verticalSegs; c++) {
        const a = off + r * cols + c;
        const b = a + 1;
        const d = off + (r + 1) * cols + c;
        const e = d + 1;
        if (flipSide >= 0) indices.push(a, d, b, b, d, e);
        else indices.push(a, b, d, b, e, d);
      }
    }
  }

  const sheetMat = mat.clone();
  sheetMat.side = layersCount === 2 ? THREE.FrontSide : THREE.DoubleSide;
  if (aponeuroticEdgeFade && 'vertexColors' in sheetMat) {
    (sheetMat as THREE.MeshStandardMaterial).vertexColors = true;
    (sheetMat as THREE.MeshStandardMaterial).color.setHex(0xffffff);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  if (aponeuroticEdgeFade) {
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  }
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, sheetMat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Builds a curved anatomical muscle or aponeurosis sheet wrapping smoothly
 * over the equine thorax, flank, or pelvis wall.
 */
export function createCurvedMuscleSheetMesh(
  stations: SheetStation[],
  sd: -1 | 1,
  mat: THREE.Material,
  verticalSegs = 12,
  horizontalFibers = true,
  aponeuroticEdgeFade = false,
): THREE.Mesh {
  return createSculptedMuscleSheetMesh(stations, sd, mat, {
    verticalSegs,
    longSubdivs: 2,
    horizontalFibers,
    aponeuroticEdgeFade,
    dorsalAponeurosis: aponeuroticEdgeFade ? 0.18 : 0,
    ventralAponeurosis: aponeuroticEdgeFade ? 0.22 : 0,
    thickness: 0.01,
  });
}

/**
 * Builds a composite anatomical muscle unit (`THREE.Group`) combining a
 * sculpted Biosphera striated red muscular belly with pearly aponeurotic/tendon
 * origin & insertion transitions.
 */
export function createMuscleUnitWithTendonCaps(
  a: THREE.Vector3,
  b: THREE.Vector3,
  radius: number,
  flattenZ: number,
  bellyMat: THREE.Material,
  _tendonMat: THREE.Material,
  bellyOffset = 0.48,
  originTendonFrac = 0.14,
  insertionTendonFrac = 0.18,
): THREE.Group {
  const g = new THREE.Group();
  const mid = a.clone().lerp(b, bellyOffset);
  const p2 = a.clone().lerp(b, bellyOffset * 0.5);
  const p4 = a.clone().lerp(b, bellyOffset + (1 - bellyOffset) * 0.5);

  g.add(
    createBiospheraMuscleMesh(
      [
        { pos: a, rx: radius * 0.36, ry: radius * 0.36 * flattenZ },
        { pos: p2, rx: radius * 0.86, ry: radius * 0.86 * flattenZ },
        { pos: mid, rx: radius, ry: radius * flattenZ },
        { pos: p4, rx: radius * 0.82, ry: radius * 0.82 * flattenZ },
        { pos: b, rx: radius * 0.32, ry: radius * 0.32 * flattenZ },
      ],
      bellyMat,
      {
        originTendonFrac,
        insertionTendonFrac,
        radialSegs: 14,
        subdivsPerSpan: 2,
      },
    ),
  );
  return g;
}

/**
 * Builds a beveled faceted block for equine carpal and tarsal bones.
 */
export function createFacetedTarsalOrCarpalBlock(
  center: THREE.Vector3,
  size: [number, number, number],
  mat: THREE.Material,
  rot?: [number, number, number],
): THREE.Mesh {
  const [sx, sy, sz] = size;
  const r = Math.min(sx, sy) * 0.28;
  const hx = sx * 0.5;
  const hy = sy * 0.5;
  const s = new THREE.Shape();
  s.moveTo(-hx + r, -hy);
  s.lineTo(hx - r, -hy);
  s.quadraticCurveTo(hx, -hy, hx, -hy + r);
  s.lineTo(hx, hy - r);
  s.quadraticCurveTo(hx, hy, hx - r, hy);
  s.lineTo(-hx + r, hy);
  s.quadraticCurveTo(-hx, hy, -hx, hy - r);
  s.lineTo(-hx, -hy + r);
  s.quadraticCurveTo(-hx, -hy, -hx + r, -hy);

  const depth = Math.max(sz * 0.7, 0.006);
  const bevel = Math.min(sz * 0.15, 0.004);
  const geo = new THREE.ExtrudeGeometry(s, {
    steps: 1,
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
  });
  geo.translate(0, 0, -depth * 0.5);
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(center);
  if (rot) mesh.rotation.set(rot[0], rot[1], rot[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Builds a realistic long bone shaft with flared proximal & distal epiphyses
 * between world points `a` and `b`.
 */
export function createLongBoneMesh(
  a: THREE.Vector3,
  b: THREE.Vector3,
  rMid: number,
  rEnds: number,
  mat: THREE.Material,
  flattenZ = 0.86,
): THREE.Mesh {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = Math.max(dir.length(), 0.02);

  const pts: THREE.Vector2[] = [];
  const steps = 14;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (i === 0 || i === steps) {
      pts.push(new THREE.Vector2(0, t * len));
      continue;
    }
    const endFlare = Math.pow(Math.abs(t - 0.5) * 2, 2.4);
    const r = THREE.MathUtils.lerp(rMid, rEnds, endFlare);
    pts.push(new THREE.Vector2(r, t * len));
  }

  const geo = new THREE.LatheGeometry(pts, 16);
  geo.translate(0, -len * 0.5, 0);
  geo.scale(1, 1, flattenZ);
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(UP, dir.normalize());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Builds a spindle-shaped anatomical muscle belly between `a` and `b`
 * with tapered aponeurotic ends and realistic lateral flattening.
 */
export function createMuscleBellyMesh(
  a: THREE.Vector3,
  b: THREE.Vector3,
  radius: number,
  flattenZ: number,
  mat: THREE.Material,
  bellyOffset = 0.48,
): THREE.Mesh {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = Math.max(dir.length(), 0.03);

  const pts: THREE.Vector2[] = [];
  const steps = 14;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (i === 0 || i === steps) {
      pts.push(new THREE.Vector2(0, t * len));
    } else {
      const u = t < bellyOffset ? t / bellyOffset : (1 - t) / (1 - bellyOffset);
      const r = radius * Math.pow(Math.sin(u * Math.PI * 0.5), 0.72);
      pts.push(new THREE.Vector2(Math.max(r, 0.004), t * len));
    }
  }

  const geo = new THREE.LatheGeometry(pts, 14);
  geo.translate(0, -len * 0.5, 0);
  geo.scale(1, 1, flattenZ);
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(UP, dir.normalize());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Builds a smooth tubular anatomical curve (vessels, nerves, GI loops, trachea).
 */
export function createTubeCurveMesh(
  points: THREE.Vector3[],
  radius: number,
  mat: THREE.Material,
  tubularSegments = 24,
  radialSegments = 10,
  closed = false,
): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(points, closed);
  const geo = new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, closed);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Builds an ellipsoid / sculpted organic structure (organs, cranial vault, joint capsules).
 */
export function createOrganMesh(
  center: THREE.Vector3,
  radii: [number, number, number],
  mat: THREE.Material,
  rot?: [number, number, number],
  segments = 18,
): THREE.Mesh {
  const geo = new THREE.SphereGeometry(1, segments, Math.max(12, Math.floor(segments * 0.75)));
  geo.scale(radii[0], radii[1], radii[2]);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(center);
  if (rot) mesh.rotation.set(rot[0], rot[1], rot[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Builds an anatomically angled equine keratin hoof resting flush at Y = 0
 * with dorsal toe slope (~50° fore / ~54° hind), flared solar border,
 * sculpted heel bulbs, concave solar arch, and coronary periople ridge.
 */
export function createHoofMesh(
  centerX: number,
  centerZ: number,
  mat: THREE.Material,
  wallSlope = 0.28,
): THREE.Mesh {
  const pts = [
    new THREE.Vector2(0, 0.009), // slightly recessed concave sole / frog center
    new THREE.Vector2(0.036, 0.005),
    new THREE.Vector2(0.058, 0.0), // ground-bearing hoof wall rim at Y = 0
    new THREE.Vector2(0.056, 0.015),
    new THREE.Vector2(0.049, 0.039),
    new THREE.Vector2(0.042, 0.062),
    new THREE.Vector2(0.0445, 0.068), // sculpted coronary periople band
    new THREE.Vector2(0.038, 0.074),
    new THREE.Vector2(0, 0.074),
  ];
  const geo = new THREE.LatheGeometry(pts, 26);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const toeShift = (0.074 - y) * wallSlope;
    const heelPinch = x < 0 ? 1 - Math.abs(x) * 2.0 : 1.05;
    // Slight heel bulb dip caudally so heels angle lower than dorsal coronary line
    const heelDrop = x < -0.018 && y > 0.055 ? -0.008 * Math.min(1, (-x - 0.018) * 28) : 0;
    pos.setXYZ(i, x * 1.15 + toeShift, Math.max(0, y + heelDrop), z * 0.94 * Math.max(0.76, heelPinch));
  }
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(centerX, 0, centerZ);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Builds the wedge-shaped equine distal phalanx (P3 / Tejuelo) inside the hoof capsule,
 * sculpted with extensor process crest and caudal palmar/plantar processes.
 */
export function createCoffinBoneMesh(
  center: THREE.Vector3,
  mat: THREE.Material,
): THREE.Mesh {
  const pts = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.039, 0),
    new THREE.Vector2(0.035, 0.014),
    new THREE.Vector2(0.024, 0.034),
    new THREE.Vector2(0.015, 0.046),
    new THREE.Vector2(0, 0.046),
  ];
  const geo = new THREE.LatheGeometry(pts, 20);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const dorsalShift = (0.046 - y) * 0.36;
    const extensorBump = x > 0.005 && y > 0.032 ? 0.004 : 0;
    const palmarWings = x < -0.008 ? 1.14 : 1.0;
    const xMod = x < 0 ? x * 1.12 : x * 1.06;
    pos.setXYZ(i, xMod + dorsalShift, y + extensorBump, z * 0.92 * palmarWings);
  }
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(center);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export interface EquineVertebraSpec {
  pos: THREE.Vector3;
  /** Orientation tangent vector from caudal -> cranial (+X roughly) */
  forwardDir: THREE.Vector3;
  bodyLength: number;
  bodyRadius: number;
  spineHeight: number;
  spineTiltX: number;
  spineThick?: number;
  transverseSpan: number;
  transverseWidth?: number;
  isCervical?: boolean;
  isLumbar?: boolean;
}

/**
 * Builds a Biosphera-grade anatomical equine vertebra (`THREE.Group`) featuring:
 * - Hourglass vertebral centrum with flared cranial/caudal articular epiphyses
 * - Dorsal neural arch lamina & pedicles enclosing a real vertebral canal
 * - Bilateral transverse process blades (wide alar wings for cervical/lumbar)
 * - Sculpted beveled dorsal spinous process blade
 */
export function createEquineVertebraMesh(
  spec: EquineVertebraSpec,
  boneMat: THREE.Material,
  darkBoneMat: THREE.Material,
): THREE.Group {
  const g = new THREE.Group();
  const fwd = spec.forwardDir.clone().normalize();

  // 1. Hourglass vertebral centrum oriented along forwardDir
  const halfLen = spec.bodyLength * 0.5;
  const rMid = spec.bodyRadius * 0.78;
  const rEnd = spec.bodyRadius * 1.12;
  const centrumPts: THREE.Vector2[] = [];
  const steps = 10;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (i === 0 || i === steps) {
      centrumPts.push(new THREE.Vector2(0, (t - 0.5) * spec.bodyLength));
    } else {
      const flare = Math.pow(Math.abs(t - 0.5) * 2, 1.85);
      centrumPts.push(new THREE.Vector2(THREE.MathUtils.lerp(rMid, rEnd, flare), (t - 0.5) * spec.bodyLength));
    }
  }
  const cGeo = new THREE.LatheGeometry(centrumPts, 14);
  cGeo.scale(1, 1, 0.94);
  cGeo.computeVertexNormals();
  const centrum = new THREE.Mesh(cGeo, boneMat);
  centrum.position.copy(spec.pos);
  centrum.quaternion.setFromUnitVectors(UP, fwd);
  centrum.castShadow = true;
  centrum.receiveShadow = true;
  g.add(centrum);

  // 2. Dorsal neural arch lamina (encloses vertebral foramen above centrum)
  const archR = spec.bodyRadius * 0.86;
  const archGeo = new THREE.TorusGeometry(archR, spec.bodyRadius * 0.3, 8, 12, Math.PI * 1.18);
  const arch = new THREE.Mesh(archGeo, darkBoneMat);
  arch.position.copy(spec.pos).add(new THREE.Vector3(0, spec.bodyRadius * 0.75, 0));
  arch.rotation.y = Math.PI / 2;
  arch.rotation.z = -Math.PI * 0.09;
  arch.castShadow = true;
  arch.receiveShadow = true;
  g.add(arch);

  // 3. Bilateral transverse processes (broad flat wings on lumbar, robust costal processes on thoracic/cervical)
  const tW = spec.transverseWidth ?? (spec.isLumbar ? 0.022 : spec.isCervical ? 0.028 : 0.015);
  const tThick = spec.isLumbar ? 0.008 : 0.011;
  const transPlate = createAnatomicalExtrudedPlate(
    [
      [-tW * 0.9, -spec.transverseSpan],
      [tW * 0.85, -spec.transverseSpan * 0.88],
      [tW * 1.0, spec.transverseSpan * 0.88],
      [-tW * 0.9, spec.transverseSpan],
    ],
    tThick,
    0.003,
    darkBoneMat,
  );
  transPlate.rotation.x = Math.PI / 2;
  transPlate.position.copy(spec.pos).add(new THREE.Vector3(0, spec.isLumbar ? 0.01 : -0.004, 0));
  g.add(transPlate);

  // 4. Sculpted dorsal spinous process blade
  if (spec.spineHeight > 0.015) {
    const sChord = spec.isCervical ? 0.032 : spec.isLumbar ? 0.034 : 0.026;
    const sThick = spec.spineThick ?? 0.011;
    const spBlade = createAnatomicalExtrudedPlate(
      [
        [-sChord * 0.55, 0],
        [sChord * 0.55, 0],
        [spec.spineTiltX + sChord * 0.35, spec.spineHeight],
        [spec.spineTiltX - sChord * 0.45, spec.spineHeight * 0.97],
      ],
      sThick,
      0.0035,
      boneMat,
    );
    spBlade.position.copy(spec.pos).add(new THREE.Vector3(0, spec.bodyRadius * 1.15, 0));
    g.add(spBlade);
  }

  // Keep reference to halfLen unused warning clean
  void halfLen;
  return g;
}
