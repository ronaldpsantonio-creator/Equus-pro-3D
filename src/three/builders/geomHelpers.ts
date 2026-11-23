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

/**
 * Builds one anatomical half (left sd = -1 or right sd = +1) of a continuous
 * lofted living-horse envelope (body, neck, head, or limbs) split cleanly along Z = 0
 * so sagittal cutaways remain exact and UV hair flow stays continuous.
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

      // Narrower dorsal crest (e.g. withers / neck crest) when dorsalTaper > 1
      const dorsalWeight = cosT > 0 ? Math.pow(cosT, 0.85) * (dorsalTaper - 1) : 0;
      const zScale = Math.max(0.08, 1 - dorsalWeight * 0.45);
      const z = sd * st.halfWidth * sinT * zScale;

      // Subtle flank vertical sculpting
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
 * Builds a realistic multi-station sculpted limb segment along arbitrary 3D points
 * with radius & Z-flattening profile so joints (shoulder, carpus, fetlock, pastern)
 * transition anatomically like a living equine leg.
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
  // Add tiny end caps for seamless closed mesh
  const first = waypoints[0];
  const last = waypoints[waypoints.length - 1];
  const tStart = new THREE.Vector3().subVectors(waypoints[1].pos, first.pos).normalize();
  const tEnd = new THREE.Vector3().subVectors(last.pos, waypoints[waypoints.length - 2].pos).normalize();

  const pts: VariableTubeWaypoint[] = [
    { pos: first.pos.clone().addScaledVector(tStart, -0.008), rx: 0.002, ry: 0.002 },
    ...waypoints,
    { pos: last.pos.clone().addScaledVector(tEnd, 0.008), rx: 0.002, ry: 0.002 },
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
      // Optional longitudinal taenia flattening groove on 2 bands for equine colon/cecum
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

/**
 * Builds a curved anatomical muscle or aponeurosis sheet wrapping smoothly
 * over the equine thorax, flank, or pelvis wall (replacing flat spherical blobs).
 */
export function createCurvedMuscleSheetMesh(
  stations: SheetStation[],
  sd: -1 | 1,
  mat: THREE.Material,
  verticalSegs = 10,
  horizontalFibers = true,
): THREE.Mesh {
  const rows = stations.length;
  const cols = verticalSegs + 1;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let r = 0; r < rows; r++) {
    const st = stations[r];
    const uCoord = r / Math.max(rows - 1, 1);
    for (let c = 0; c <= verticalSegs; c++) {
      const vCoord = c / verticalSegs;
      const y = THREE.MathUtils.lerp(st.yTop, st.yBot, vCoord);
      const bow = st.zBow * Math.sin(vCoord * Math.PI);
      const z = (st.zMid + bow) * sd;
      positions.push(st.x, y, z);
      // When horizontalFibers=true, swap UV so vertical canvas striations run cranio-caudally
      uvs.push(horizontalFibers ? vCoord : uCoord, horizontalFibers ? uCoord : vCoord);
    }
  }

  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < verticalSegs; c++) {
      const a = r * cols + c;
      const b = a + 1;
      const d = (r + 1) * cols + c;
      const e = d + 1;
      if (sd === 1) {
        indices.push(a, d, b, b, d, e);
      } else {
        indices.push(a, b, d, b, e, d);
      }
    }
  }

  // Clone material with DoubleSide so sheets are visible both externally and medially
  const sheetMat = mat.clone();
  sheetMat.side = THREE.DoubleSide;

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, sheetMat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Builds a composite anatomical muscle unit (`THREE.Group`) combining the
 * striated red muscular belly in the center with pearly aponeurotic/tendon
 * origin & insertion cuffs at both ends (Biosphera écorché look).
 */
export function createMuscleUnitWithTendonCaps(
  a: THREE.Vector3,
  b: THREE.Vector3,
  radius: number,
  flattenZ: number,
  bellyMat: THREE.Material,
  tendonMat: THREE.Material,
  bellyOffset = 0.48,
  originTendonFrac = 0.14,
  insertionTendonFrac = 0.18,
): THREE.Group {
  const g = new THREE.Group();
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = Math.max(dir.length(), 0.03);

  const bellyStart = a.clone().lerp(b, originTendonFrac * 0.55);
  const bellyEnd = a.clone().lerp(b, 1 - insertionTendonFrac * 0.55);
  g.add(createMuscleBellyMesh(bellyStart, bellyEnd, radius, flattenZ, bellyMat, bellyOffset));

  if (originTendonFrac > 0.02 && len > 0.05) {
    const oEnd = a.clone().lerp(b, originTendonFrac + 0.06);
    g.add(createMuscleBellyMesh(a, oEnd, radius * 0.46, flattenZ * 0.9, tendonMat, 0.72));
  }
  if (insertionTendonFrac > 0.02 && len > 0.05) {
    const iStart = a.clone().lerp(b, 1 - insertionTendonFrac - 0.06);
    g.add(createMuscleBellyMesh(iStart, b, radius * 0.42, flattenZ * 0.9, tendonMat, 0.28));
  }
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
 * Builds a smooth tubular anatomical curve (ribs, vessels, nerves, GI loops, trachea).
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
 * palmar heels, and subtle coronary band ridge.
 */
export function createHoofMesh(
  centerX: number,
  centerZ: number,
  mat: THREE.Material,
  wallSlope = 0.28,
): THREE.Mesh {
  const pts = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.056, 0),
    new THREE.Vector2(0.054, 0.014),
    new THREE.Vector2(0.048, 0.038),
    new THREE.Vector2(0.041, 0.062),
    new THREE.Vector2(0.043, 0.069), // subtle coronary band swelling
    new THREE.Vector2(0.037, 0.074),
    new THREE.Vector2(0, 0.074),
  ];
  const geo = new THREE.LatheGeometry(pts, 22);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    // Dorsal toe (+X) extends farther forward at solar edge, heels (-X) sit higher and slightly tapered
    const toeShift = (0.074 - y) * wallSlope;
    const heelPinch = x < 0 ? 1 - Math.abs(x) * 2.2 : 1.04;
    pos.setXYZ(i, x * 1.14 + toeShift, y, z * 0.92 * Math.max(0.75, heelPinch));
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
  const geo = new THREE.LatheGeometry(pts, 18);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const dorsalShift = (0.046 - y) * 0.36;
    // Slight extensor process peak dorsally + palmar processes widening caudolaterally
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
