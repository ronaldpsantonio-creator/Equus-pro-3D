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

  for (let r = 0; r < rows; r++) {
    const wp = waypoints[r];
    if (r === 0) {
      tangent.subVectors(waypoints[1].pos, wp.pos).normalize();
    } else if (r === rows - 1) {
      tangent.subVectors(wp.pos, waypoints[r - 1].pos).normalize();
    } else {
      tangent.subVectors(waypoints[r + 1].pos, waypoints[r - 1].pos).normalize();
    }

    // Build stable anatomical frame (fwdVec ~ cranial/caudal, sideVec ~ mediolateral)
    fwdVec.crossVectors(sideVec, tangent);
    if (fwdVec.lengthSq() < 0.001) {
      fwdVec.set(1, 0, 0);
    } else {
      fwdVec.normalize();
    }
    const localSide = new THREE.Vector3().crossVectors(tangent, fwdVec).normalize();

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
  const geo = new THREE.LatheGeometry(pts, 20);
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
 * Builds the wedge-shaped equine distal phalanx (P3 / Tejuelo) inside the hoof capsule.
 */
export function createCoffinBoneMesh(
  center: THREE.Vector3,
  mat: THREE.Material,
): THREE.Mesh {
  const pts = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.038, 0),
    new THREE.Vector2(0.034, 0.015),
    new THREE.Vector2(0.022, 0.036),
    new THREE.Vector2(0.014, 0.044),
    new THREE.Vector2(0, 0.044),
  ];
  const geo = new THREE.LatheGeometry(pts, 16);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const dorsalShift = (0.044 - y) * 0.34;
    // Slight palmar concavity for semilunar surface & palmar processes
    const xMod = x < 0 ? x * 1.1 : x * 1.05;
    pos.setXYZ(i, xMod + dorsalShift, y, z * 0.92);
  }
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(center);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
