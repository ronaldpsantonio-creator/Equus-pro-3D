import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);

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
  const steps = 12;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // Cap ends cleanly to radius 0
    if (i === 0 || i === steps) {
      pts.push(new THREE.Vector2(0, t * len));
      continue;
    }
    const endFlare = Math.pow(Math.abs(t - 0.5) * 2, 2.6);
    const r = THREE.MathUtils.lerp(rMid, rEnds, endFlare);
    pts.push(new THREE.Vector2(r, t * len));
  }

  const geo = new THREE.LatheGeometry(pts, 12);
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
      // Skewed sine profile for realistic muscle belly fullness
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
 * Builds an angled equine keratin hoof resting flush at Y = 0.
 */
export function createHoofMesh(centerX: number, centerZ: number, mat: THREE.Material): THREE.Mesh {
  const pts = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.056, 0),
    new THREE.Vector2(0.051, 0.025),
    new THREE.Vector2(0.043, 0.062),
    new THREE.Vector2(0.036, 0.072),
    new THREE.Vector2(0, 0.072),
  ];
  const geo = new THREE.LatheGeometry(pts, 16);
  // Slight dorsal toe extension (+X) typical of equine hoof wall angle (~50 deg)
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const toeShift = (0.072 - y) * 0.25;
    pos.setXYZ(i, x * 1.12 + toeShift, y, z * 0.94);
  }
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(centerX, 0, centerZ);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
