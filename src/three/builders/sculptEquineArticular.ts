import * as THREE from 'three';
import {
  caudalPos,
  cervicalPos,
  forelimbLandmarks,
  HEAD,
  hindlimbLandmarks,
  lumbarPos,
  ribArcPoints,
  sacralPos,
  thoracicPos,
  V3,
} from '../anatomyCoords';
import {
  createCurvedLigamentSheetMesh,
  createMultiStationLoftTube,
  createOrganMesh,
  createTubeCurveMesh,
  VariableTubeWaypoint,
} from './geomHelpers';

export interface SculptedArticularBuildContext {
  cartMat: () => THREE.Material;
  capsuleMat: () => THREE.Material;
  ligMat: () => THREE.Material;
  ligElasticMat: () => THREE.Material;
  ligSculptedMat: () => THREE.Material;
  buildBilateralArticular: (builder: (sd: -1 | 1) => THREE.Object3D) => THREE.Group;
  push: (
    id: string,
    mesh: THREE.Object3D,
    side: 'left' | 'right' | 'center',
    center?: THREE.Vector3,
  ) => void;
}

const LIG_BRIGHT = new THREE.Color(0xf6f3ec);
const LIG_SHADE = new THREE.Color(0xbdb9ad);
const LIG_ENTHESIS = new THREE.Color(0xd7dde3);

function makeSideMarked(obj: THREE.Object3D, side: 'left' | 'right'): THREE.Object3D {
  obj.traverse((ch) => {
    ch.userData.side = side;
  });
  return obj;
}

/**
 * Builds a closed, anatomical flattened collagen ligament band along 3D points
 * with flared fibrocartilage enthesis ends, subtle longitudinal fascicle ridges,
 * and vertex-color AO shading (safe for `ligament_sculpted` material).
 */
function buildSculptedLigamentBand(
  rawPoints: THREE.Vector3[],
  faceOutDir: THREE.Vector3,
  halfWidth: number,
  halfThick: number,
  mat: THREE.Material,
  uSegs = 14,
  radialSegs = 12,
  enthesisFlare = 1.28,
): THREE.Mesh {
  const pts =
    rawPoints.length === 2
      ? [rawPoints[0], rawPoints[0].clone().lerp(rawPoints[1], 0.5), rawPoints[1]]
      : rawPoints;
  const curve = new THREE.CatmullRomCurve3(pts);

  const positions: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const refOut = faceOutDir.clone();
  if (refOut.lengthSq() < 1e-8) refOut.set(0, 1, 0);
  refOut.normalize();

  const cTmp = new THREE.Color();

  for (let i = 0; i <= uSegs; i++) {
    const u = i / uSegs;
    const center = curve.getPointAt(u);
    const tan = curve.getTangentAt(u).normalize();

    const outN = refOut.clone().addScaledVector(tan, -refOut.dot(tan));
    if (outN.lengthSq() < 1e-6) {
      const fb = Math.abs(tan.y) < 0.85 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
      outN.crossVectors(fb, tan);
    }
    outN.normalize();
    const widthDir = new THREE.Vector3().crossVectors(tan, outN).normalize();

    // Flared fibrocartilage attachment zones at start & end; subtle waist along mid-substance
    const enthesisEnv =
      Math.exp(-Math.pow(u / 0.16, 2)) + Math.exp(-Math.pow((1 - u) / 0.16, 2));
    const widthScale = (1 - 0.08 * Math.sin(u * Math.PI)) * (1 + (enthesisFlare - 1) * enthesisEnv);
    const thickScale =
      (i === 0 || i === uSegs ? 0.72 : 1.0) * (1 + 0.15 * enthesisEnv);

    for (let j = 0; j <= radialSegs; j++) {
      const v = j / radialSegs;
      const theta = v * Math.PI * 2;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);

      // Subtle longitudinal collagen fascicle ridges along broad outer/inner faces
      const fascicleRib = 1 + 0.075 * Math.cos(theta * 6);
      const localW = cosT * halfWidth * widthScale;
      const localT = sinT * halfThick * thickScale * fascicleRib;

      const p = center
        .clone()
        .addScaledVector(widthDir, localW)
        .addScaledVector(outN, localT);
      positions.push(p.x, p.y, p.z);
      uvs.push(u, v);

      const ridgeAo = 0.92 + 0.08 * Math.cos(theta * 6);
      const faceAo = sinT >= 0 ? 1.0 : 0.84;
      const ao = THREE.MathUtils.clamp(ridgeAo * faceAo, 0.55, 1.0);
      cTmp.lerpColors(LIG_SHADE, LIG_BRIGHT, ao);
      if (enthesisEnv > 0.05) {
        cTmp.lerp(LIG_ENTHESIS, Math.min(0.45, enthesisEnv * 0.42));
      }
      colors.push(cTmp.r, cTmp.g, cTmp.b);
    }
  }

  const stride = radialSegs + 1;
  for (let i = 0; i < uSegs; i++) {
    for (let j = 0; j < radialSegs; j++) {
      const a = i * stride + j;
      const b = a + 1;
      const d = (i + 1) * stride + j;
      const e = d + 1;
      indices.push(a, d, b, b, d, e);
    }
  }

  // Closed caps
  const p0 = curve.getPointAt(0);
  const t0 = curve.getTangentAt(0).normalize();
  const sCenterIdx = positions.length / 3;
  const sCap = p0.clone().addScaledVector(t0, -halfThick * 0.45);
  positions.push(sCap.x, sCap.y, sCap.z);
  uvs.push(0, 0.5);
  colors.push(LIG_ENTHESIS.r, LIG_ENTHESIS.g, LIG_ENTHESIS.b);
  for (let j = 0; j < radialSegs; j++) {
    indices.push(sCenterIdx, j, j + 1);
  }

  const p1 = curve.getPointAt(1);
  const t1 = curve.getTangentAt(1).normalize();
  const eCenterIdx = positions.length / 3;
  const eCap = p1.clone().addScaledVector(t1, halfThick * 0.45);
  positions.push(eCap.x, eCap.y, eCap.z);
  uvs.push(1, 0.5);
  colors.push(LIG_ENTHESIS.r, LIG_ENTHESIS.g, LIG_ENTHESIS.b);
  const lastRing = uSegs * stride;
  for (let j = 0; j < radialSegs; j++) {
    indices.push(eCenterIdx, lastRing + j + 1, lastRing + j);
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
 * Translucent synovial joint capsule sleeve hugging condyles without casting dark shadows.
 */
function buildSynovialCuff(
  waypoints: VariableTubeWaypoint[],
  mat: THREE.Material,
  radialSegs = 14,
): THREE.Mesh {
  const mesh = createMultiStationLoftTube(waypoints, mat, radialSegs);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  return mesh;
}

function buildMeniscusWedge(center: THREE.Vector3, sideSign: number, mat: THREE.Material): THREE.Mesh {
  const wps: VariableTubeWaypoint[] = [];
  const steps = 10;
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const a = THREE.MathUtils.lerp(-Math.PI * 0.72, Math.PI * 0.72, u);
    const hornTaper = 0.45 + 0.55 * Math.sin(u * Math.PI);
    wps.push({
      pos: center.clone().add(V3(Math.sin(a) * 0.020, -0.008, Math.cos(a) * 0.016 * sideSign)),
      rx: 0.0065 * hornTaper,
      ry: 0.0052 * hornTaper,
    });
  }
  return createMultiStationLoftTube(wps, mat, 10);
}

export function buildSculptedArticularParts(ctx: SculptedArticularBuildContext): void {
  const { cartMat, capsuleMat, ligMat, ligElasticMat, ligSculptedMat, buildBilateralArticular, push } = ctx;

  // =========================================================================
  // 1. CRANIAL, TMJ, HYOID & LARYNGEAL JOINTS
  // =========================================================================
  // TMJ (equ.ske.aax.001-i/d): Bilaminar articular disc + translucent capsule + lateral TMJ ligament
  for (const sd of [-1, 1] as const) {
    const tag = sd === -1 ? 'i' : 'd';
    const side = sd === -1 ? 'left' : 'right';
    const tmjGrp = new THREE.Group();
    // Bilaminar fibrocartilage articular disc seated between temporal mandibular fossa & condylar barrel (1.080, 1.651, 0.049*sd)
    tmjGrp.add(
      createOrganMesh(V3(1.080, 1.657, 0.050 * sd), [0.014, 0.0042, 0.013], cartMat(), [0, 0, -0.15], 12),
    );
    // Translucent synovial capsule cuff enclosing upper & lower joint compartments
    const cuff = createOrganMesh(
      V3(1.080, 1.653, 0.050 * sd),
      [0.019, 0.014, 0.017],
      capsuleMat(),
      [0, 0, -0.15],
      14,
    );
    cuff.castShadow = false;
    tmjGrp.add(cuff);
    // Lateral temporomandibular ligament (oblique caudoventral reinforcing band from zygomatic crest to condylar neck)
    tmjGrp.add(
      buildSculptedLigamentBand(
        [V3(1.086, 1.666, 0.060 * sd), V3(1.074, 1.640, 0.056 * sd)],
        V3(0, 0, sd),
        0.0045,
        0.0020,
        ligSculptedMat(),
      ),
    );
    push(`equ.ske.aax.001-${tag}`, tmjGrp, side);

    // Temporohyoid articulation (equ.ske.hyo.007-i/d): tympanohyoid synchondrosis capsule + petrous-stylohyoid fibrous cuff
    const thGrp = new THREE.Group();
    thGrp.add(
      buildSynovialCuff(
        [
          { pos: V3(1.040, 1.633, 0.039 * sd), rx: 0.0072, ry: 0.0078 },
          { pos: V3(1.046, 1.622, 0.037 * sd), rx: 0.0076, ry: 0.0082 },
          { pos: V3(1.052, 1.613, 0.036 * sd), rx: 0.0068, ry: 0.0074 },
        ],
        capsuleMat(),
        10,
      ),
    );
    thGrp.add(
      buildSculptedLigamentBand(
        [V3(1.041, 1.632, 0.042 * sd), V3(1.052, 1.614, 0.039 * sd)],
        V3(0, 0, sd),
        0.0032,
        0.0015,
        ligSculptedMat(),
        8,
        8,
      ),
    );
    push(`equ.ske.hyo.007-${tag}`, thGrp, side);

    // Stylohyoid–epihyoid synchondrosis (equ.ske.hyo.008-i/d)
    const seGrp = new THREE.Group();
    seGrp.add(
      createOrganMesh(V3(1.070, 1.590, 0.032 * sd), [0.0065, 0.0075, 0.0055], cartMat(), [0, 0, -0.45], 10),
    );
    seGrp.add(
      buildSculptedLigamentBand(
        [V3(1.064, 1.596, 0.0335 * sd), V3(1.077, 1.584, 0.0315 * sd)],
        V3(0, 0, sd),
        0.0034,
        0.0015,
        ligSculptedMat(),
        8,
        8,
      ),
    );
    push(`equ.ske.hyo.008-${tag}`, seGrp, side);

    // Laryngeal articulations: Cricoarytenoid (lar.008-i/d), Cricothyroid (lar.009-i/d), Thyrohyoid (lar.021-i/d)
    const caGrp = new THREE.Group();
    caGrp.add(
      buildSynovialCuff(
        [
          { pos: V3(0.953, 1.590, 0.013 * sd), rx: 0.0065, ry: 0.0055 },
          { pos: V3(0.962, 1.586, 0.015 * sd), rx: 0.0070, ry: 0.0058 },
        ],
        capsuleMat(),
        10,
      ),
    );
    caGrp.add(
      buildSculptedLigamentBand(
        [V3(0.950, 1.593, 0.014 * sd), V3(0.964, 1.586, 0.016 * sd)],
        V3(0, 1, 0.5 * sd),
        0.0028,
        0.0012,
        ligSculptedMat(),
        6,
        8,
      ),
    );
    push(`equ.res.lar.008-${tag}`, caGrp, side);

    const ctGrp = new THREE.Group();
    ctGrp.add(
      buildSynovialCuff(
        [
          { pos: V3(0.944, 1.558, 0.022 * sd), rx: 0.0075, ry: 0.0065 },
          { pos: V3(0.955, 1.563, 0.024 * sd), rx: 0.0080, ry: 0.0068 },
        ],
        capsuleMat(),
        10,
      ),
    );
    ctGrp.add(
      buildSculptedLigamentBand(
        [V3(0.942, 1.556, 0.025 * sd), V3(0.958, 1.564, 0.026 * sd)],
        V3(0, 0, sd),
        0.0032,
        0.0013,
        ligSculptedMat(),
        6,
        8,
      ),
    );
    push(`equ.res.lar.009-${tag}`, ctGrp, side);

    const thLarGrp = new THREE.Group();
    thLarGrp.add(
      buildSynovialCuff(
        [
          { pos: V3(0.980, 1.564, 0.023 * sd), rx: 0.0065, ry: 0.0060 },
          { pos: V3(0.992, 1.558, 0.022 * sd), rx: 0.0060, ry: 0.0058 },
        ],
        capsuleMat(),
        10,
      ),
    );
    thLarGrp.add(
      buildSculptedLigamentBand(
        [V3(0.980, 1.564, 0.023 * sd), V3(1.018, 1.542, 0.021 * sd)],
        V3(0, 0, sd),
        0.0034,
        0.0014,
        ligSculptedMat(),
        8,
        8,
      ),
    );
    push(`equ.res.lar.021-${tag}`, thLarGrp, side);
  }

  // =========================================================================
  // 2. CRANIO-CERVICAL & AXIAL VERTEBRAL JOINTS + LIGAMENTS
  // =========================================================================
  // Atlantooccipital joint (equ.ske.aax.002): paired condylar synovial cuffs + dorsal membrane + lateral ligaments
  {
    const aoGrp = new THREE.Group();
    for (const sd of [-1, 1] as const) {
      aoGrp.add(
        makeSideMarked(
          buildSynovialCuff(
            [
              { pos: V3(1.022, 1.702, 0.020 * sd), rx: 0.017, ry: 0.016 },
              { pos: V3(1.006, 1.707, 0.021 * sd), rx: 0.019, ry: 0.018 },
              { pos: V3(0.990, 1.712, 0.022 * sd), rx: 0.017, ry: 0.016 },
            ],
            capsuleMat(),
            14,
          ),
          sd === -1 ? 'left' : 'right',
        ),
      );
      // Lateral atlantooccipital ligament (paracondylar / jugular border -> atlas wing cranial edge)
      aoGrp.add(
        makeSideMarked(
          buildSculptedLigamentBand(
            [V3(1.024, 1.706, 0.034 * sd), V3(0.986, 1.710, 0.040 * sd)],
            V3(0, 0.4, sd),
            0.0065,
            0.0026,
            ligSculptedMat(),
          ),
          sd === -1 ? 'left' : 'right',
        ),
      );
    }
    // Dorsal atlantooccipital membrane bridging supraoccipital border & atlas dorsal arch
    aoGrp.add(
      buildSculptedLigamentBand(
        [V3(1.020, 1.728, 0), V3(0.986, 1.734, 0)],
        V3(0, 1, 0),
        0.018,
        0.0030,
        ligSculptedMat(),
        10,
        12,
        1.15,
      ),
    );
    push('equ.ske.aax.002', aoGrp, 'center');
  }

  // Atlantoaxial joint (equ.ske.aax.003): translucent synovial cuff + dorsal atlantoaxial ligament
  {
    const aaGrp = new THREE.Group();
    aaGrp.add(
      buildSynovialCuff(
        [
          { pos: V3(0.962, 1.696, 0), rx: 0.020, ry: 0.028 },
          { pos: V3(0.946, 1.678, 0), rx: 0.022, ry: 0.031 },
          { pos: V3(0.930, 1.660, 0), rx: 0.020, ry: 0.027 },
        ],
        capsuleMat(),
        16,
      ),
    );
    // Dorsal atlantoaxial ligament (C1 dorsal tubercle -> C2 cranial spinous crest)
    for (const sd of [-1, 1] as const) {
      aaGrp.add(
        makeSideMarked(
          buildSculptedLigamentBand(
            [V3(0.972, 1.736, 0.006 * sd), V3(0.928, 1.682, 0.009 * sd)],
            V3(0.3, 1, 0.2 * sd),
            0.0070,
            0.0028,
            ligSculptedMat(),
          ),
          sd === -1 ? 'left' : 'right',
        ),
      );
    }
    push('equ.ske.aax.003', aaGrp, 'center');
  }

  // Ligamento transverso del atlas (equ.ske.lax.008) — arches over dens axis inside C1 ventral ring
  push(
    'equ.ske.lax.008',
    buildSculptedLigamentBand(
      [
        V3(0.958, 1.686, -0.018),
        V3(0.962, 1.698, 0),
        V3(0.958, 1.686, 0.018),
      ],
      V3(0, 1, 0),
      0.0070,
      0.0028,
      ligSculptedMat(),
      12,
      10,
      1.22,
    ),
    'center',
  );

  // Ligamento longitudinal del diente (odontoideo longitudinal, equ.ske.lax.012)
  push(
    'equ.ske.lax.012',
    buildSculptedLigamentBand(
      [
        V3(0.942, 1.672, 0),
        V3(0.966, 1.690, 0),
        V3(0.996, 1.702, 0),
        V3(1.014, 1.704, 0),
      ],
      V3(0, 1, 0),
      0.011,
      0.0028,
      ligSculptedMat(),
      12,
      10,
      1.35,
    ),
    'center',
  );

  // Funículo nucal (equ.ske.lax.001) — paired golden-yellow elastic dorsal cords + withers fibrocartilage cap
  {
    const funiculoGrp = new THREE.Group();
    for (const sd of [-1, 1] as const) {
      funiculoGrp.add(
        makeSideMarked(
          createTubeCurveMesh(
            [
              HEAD.poll.clone().add(V3(-0.008, -0.014, 0.007 * sd)),
              V3(0.86, 1.712, 0.008 * sd),
              V3(0.68, 1.590, 0.008 * sd),
              V3(0.50, 1.495, 0.009 * sd),
              V3(0.32, 1.505, 0.010 * sd),
            ],
            0.0115,
            ligElasticMat(),
            26,
            10,
          ),
          sd === -1 ? 'left' : 'right',
        ),
      );
    }
    push('equ.ske.lax.001', funiculoGrp, 'center');
  }

  // Lámina nucal (equ.ske.lax.002) — broad bilateral yellow-ochre elastic sheets from funicular cord to C2–C6
  push(
    'equ.ske.lax.002',
    buildBilateralArticular((sd) => {
      const g = new THREE.Group();
      const topRail: THREE.Vector3[] = [
        V3(0.86, 1.702, 0.008 * sd),
        V3(0.73, 1.615, 0.008 * sd),
        V3(0.58, 1.535, 0.008 * sd),
        V3(0.42, 1.490, 0.009 * sd),
      ];
      const [c2x, c2y] = cervicalPos(2);
      const [c3x, c3y] = cervicalPos(3);
      const [c5x, c5y] = cervicalPos(5);
      const [c6x, c6y] = cervicalPos(6);
      const botRail: THREE.Vector3[] = [
        V3(c2x, c2y + 0.025, 0.009 * sd),
        V3(c3x, c3y + 0.025, 0.009 * sd),
        V3(c5x, c5y + 0.025, 0.009 * sd),
        V3(c6x, c6y + 0.03, 0.009 * sd),
      ];
      g.add(createCurvedLigamentSheetMesh(topRail, botRail, sd, ligElasticMat(), 0.004, 0.0025, 16, 8));
      for (const c of [3, 4, 5, 6]) {
        const [cx, cy] = cervicalPos(c);
        g.add(
          createTubeCurveMesh(
            [V3(cx, cy + 0.025, 0.010 * sd), V3(0.39, 1.490, 0.010 * sd)],
            0.0048,
            ligElasticMat(),
            8,
            6,
          ),
        );
      }
      return g;
    }),
    'center',
  );

  // Ligamento supraespinoso (equ.ske.lax.003) — sculpted fibrous dorsal strap T3 -> S3
  {
    const supraPts: THREE.Vector3[] = [];
    for (let t = 3; t <= 18; t += 2) {
      const [tx, ty] = thoracicPos(t);
      const witherFactor = Math.exp(-Math.pow((t - 5.2) / 4.0, 2));
      supraPts.push(V3(tx - 0.025, ty + 0.068 + 0.135 * witherFactor, 0));
    }
    for (let l = 1; l <= 6; l++) {
      const [lx, ly] = lumbarPos(l);
      supraPts.push(V3(lx, ly + 0.082, 0));
    }
    for (let s = 1; s <= 3; s += 2) {
      const [sx, sy] = sacralPos(s);
      supraPts.push(V3(sx, sy + 0.056, 0));
    }
    push(
      'equ.ske.lax.003',
      buildSculptedLigamentBand(supraPts, V3(0, 1, 0), 0.011, 0.0055, ligSculptedMat(), 36, 10, 1.1),
      'center',
    );
  }

  // Ligamento longitudinal dorsal (equ.ske.lax.004) & Ventral (equ.ske.lax.005) & Discos intervertebrales (equ.ske.aax.004)
  {
    const dorPts: THREE.Vector3[] = [];
    const venPts: THREE.Vector3[] = [];
    const ivdGrp = new THREE.Group();

    for (let c = 2; c <= 7; c++) {
      const [cx, cy] = cervicalPos(c);
      dorPts.push(V3(cx, cy + 0.008, 0));
      venPts.push(V3(cx, cy - 0.017, 0));
      if (c < 7) {
        const [nx, ny] = cervicalPos(c + 1);
        ivdGrp.add(
          createOrganMesh(
            V3((cx + nx) * 0.5, (cy + ny) * 0.5 - 0.004, 0),
            [0.0065, 0.019, 0.021],
            cartMat(),
            [0, 0, -0.58],
            10,
          ),
        );
      }
    }
    for (let t = 1; t <= 18; t++) {
      const [tx, ty] = thoracicPos(t);
      dorPts.push(V3(tx, ty + 0.009, 0));
      if (t >= 5) venPts.push(V3(tx, ty - 0.017, 0));
      if (t < 18) {
        const [nx, ny] = thoracicPos(t + 1);
        ivdGrp.add(
          createOrganMesh(
            V3((tx + nx) * 0.5, (ty + ny) * 0.5, 0),
            [0.0062, 0.019, 0.022],
            cartMat(),
            [0, 0, 0.12],
            10,
          ),
        );
      }
    }
    for (let l = 1; l <= 6; l++) {
      const [lx, ly] = lumbarPos(l);
      dorPts.push(V3(lx, ly + 0.009, 0));
      venPts.push(V3(lx, ly - 0.018, 0));
      if (l < 6) {
        const [nx, ny] = lumbarPos(l + 1);
        ivdGrp.add(
          createOrganMesh(
            V3((lx + nx) * 0.5, (ly + ny) * 0.5, 0),
            [0.0072, 0.021, 0.025],
            cartMat(),
            undefined,
            10,
          ),
        );
      }
    }
    const [s1x, s1y] = sacralPos(1);
    dorPts.push(V3(s1x, s1y + 0.008, 0));
    venPts.push(V3(s1x, s1y - 0.018, 0));

    push(
      'equ.ske.lax.004',
      buildSculptedLigamentBand(dorPts, V3(0, 1, 0), 0.0075, 0.0028, ligSculptedMat(), 42, 8, 1.05),
      'center',
    );
    push(
      'equ.ske.lax.005',
      buildSculptedLigamentBand(venPts, V3(0, -1, 0), 0.0095, 0.0032, ligSculptedMat(), 38, 8, 1.05),
      'center',
    );
    push('equ.ske.aax.004', ivdGrp, 'center');
  }

  // Ligamentos amarillos / Ligamenta flava (equ.ske.lax.006) — paired interarcuate yellow elastic sheets
  {
    const flavaGrp = new THREE.Group();
    const addArchPair = (p1: THREE.Vector3, p2: THREE.Vector3) => {
      for (const sd of [-1, 1] as const) {
        flavaGrp.add(
          makeSideMarked(
            buildSculptedLigamentBand(
              [p1.clone().add(V3(0, 0.019, 0.011 * sd)), p2.clone().add(V3(0, 0.019, 0.011 * sd))],
              V3(0, 1, 0.35 * sd),
              0.0065,
              0.0022,
              ligElasticMat(),
              6,
              8,
              1.1,
            ),
            sd === -1 ? 'left' : 'right',
          ),
        );
      }
    };
    for (let c = 2; c < 7; c++) addArchPair(V3(...cervicalPos(c)), V3(...cervicalPos(c + 1)));
    for (let t = 1; t < 18; t++) addArchPair(V3(...thoracicPos(t)), V3(...thoracicPos(t + 1)));
    for (let l = 1; l < 6; l++) addArchPair(V3(...lumbarPos(l)), V3(...lumbarPos(l + 1)));
    push('equ.ske.lax.006', flavaGrp, 'center');
  }

  // Ligamentos interespinosos (equ.ske.lax.007) — fibrous collagen sheets bridging neural spines
  {
    const interspGrp = new THREE.Group();
    const addInterspinous = (p0: THREE.Vector3, h0: number, tilt0: number, p1: THREE.Vector3, h1: number, tilt1: number) => {
      for (const sd of [-1, 1] as const) {
        const s0Bot = p0.clone().add(V3(tilt0 * 0.25, 0.032 + h0 * 0.22, 0.002 * sd));
        const s0Top = p0.clone().add(V3(tilt0 * 0.85, 0.032 + h0 * 0.84, 0.002 * sd));
        const s1Bot = p1.clone().add(V3(tilt1 * 0.25, 0.032 + h1 * 0.22, 0.002 * sd));
        const s1Top = p1.clone().add(V3(tilt1 * 0.85, 0.032 + h1 * 0.84, 0.002 * sd));
        interspGrp.add(
          makeSideMarked(
            createCurvedLigamentSheetMesh(
              [s0Top, s1Top],
              [s0Bot, s1Bot],
              sd,
              ligMat(),
              0.0022,
              0.0018,
              6,
              4,
            ),
            sd === -1 ? 'left' : 'right',
          ),
        );
      }
    };
    for (let t = 1; t < 18; t++) {
      const h0 = 0.045 + 0.14 * Math.exp(-Math.pow((t - 5.2) / 4.0, 2));
      const h1 = 0.045 + 0.14 * Math.exp(-Math.pow((t + 1 - 5.2) / 4.0, 2));
      const tilt0 = -0.025 * Math.max(0, 1 - t / 14);
      const tilt1 = -0.025 * Math.max(0, 1 - (t + 1) / 14);
      addInterspinous(V3(...thoracicPos(t)), h0, tilt0, V3(...thoracicPos(t + 1)), h1, tilt1);
    }
    for (let l = 1; l < 6; l++) {
      addInterspinous(V3(...lumbarPos(l)), 0.055, 0.012, V3(...lumbarPos(l + 1)), 0.055, 0.012);
    }
    push('equ.ske.lax.007', interspGrp, 'center');
  }

  // Articulaciones de los procesos articulares / cigapofisiarias (equ.ske.aax.005)
  {
    const facetGrp = new THREE.Group();
    const addFacetCapsule = (p: THREE.Vector3, zOff: number, yOff: number, sd: -1 | 1) => {
      facetGrp.add(
        makeSideMarked(
          buildSynovialCuff(
            [
              { pos: p.clone().add(V3(0.012, yOff, zOff * sd)), rx: 0.009, ry: 0.008 },
              { pos: p.clone().add(V3(-0.012, yOff, zOff * sd)), rx: 0.009, ry: 0.008 },
            ],
            capsuleMat(),
            10,
          ),
          sd === -1 ? 'left' : 'right',
        ),
      );
    };
    for (const sd of [-1, 1] as const) {
      for (let c = 2; c < 7; c++) {
        const mid = V3(...cervicalPos(c)).lerp(V3(...cervicalPos(c + 1)), 0.5);
        addFacetCapsule(mid, 0.024, 0.016, sd);
      }
      for (let t = 1; t < 18; t++) {
        const mid = V3(...thoracicPos(t)).lerp(V3(...thoracicPos(t + 1)), 0.5);
        addFacetCapsule(mid, 0.016, 0.020, sd);
      }
      for (let l = 1; l < 6; l++) {
        const mid = V3(...lumbarPos(l)).lerp(V3(...lumbarPos(l + 1)), 0.5);
        addFacetCapsule(mid, 0.020, 0.022, sd);
      }
    }
    push('equ.ske.aax.005', facetGrp, 'center');
  }

  // =========================================================================
  // 3. THORACIC COSTOVERTEBRAL, COSTOCHONDRAL, STERNOCOSTAL & STERNAL JOINTS
  // =========================================================================
  {
    const cvGrp = new THREE.Group(); // equ.ske.aax.006: Costovertebral synovial cuffs + radiate + costotransverse ligs
    const ccGrp = new THREE.Group(); // equ.ske.aax.007: Costochondral fibrous collars
    const scGrp = new THREE.Group(); // equ.ske.aax.008: Sternocostal capsules & radiate ligaments
    const sternalNotches: Array<{ x: number; y: number; z: number }> = [
      { x: 0.468, y: 0.905, z: 0.015 },
      { x: 0.415, y: 0.875, z: 0.016 },
      { x: 0.360, y: 0.852, z: 0.018 },
      { x: 0.305, y: 0.838, z: 0.020 },
      { x: 0.250, y: 0.830, z: 0.022 },
      { x: 0.195, y: 0.828, z: 0.024 },
      { x: 0.138, y: 0.830, z: 0.025 },
      { x: 0.088, y: 0.833, z: 0.026 },
    ];

    for (const sd of [-1, 1] as const) {
      const side = sd === -1 ? 'left' : 'right';
      for (let r = 1; r <= 18; r++) {
        const [vx, vy] = thoracicPos(r);
        const ribHead = V3(vx + 0.011, vy - 0.010, 0.020 * sd);
        const ribTub = V3(vx - 0.002, vy - 0.003, 0.034 * sd);

        // Costovertebral joint capsule + radiate rib head lig + costotransverse lig
        cvGrp.add(
          makeSideMarked(
            buildSynovialCuff(
              [
                { pos: V3(vx + 0.012, vy - 0.012, 0.014 * sd), rx: 0.0095, ry: 0.0095 },
                { pos: ribHead, rx: 0.0105, ry: 0.0105 },
                { pos: ribTub, rx: 0.0105, ry: 0.0100 },
              ],
              capsuleMat(),
              10,
            ),
            side,
          ),
        );
        cvGrp.add(
          makeSideMarked(
            buildSculptedLigamentBand(
              [V3(vx + 0.012, vy - 0.016, 0.011 * sd), ribHead.clone().add(V3(0, -0.003, 0.004 * sd))],
              V3(0, -1, sd),
              0.0038,
              0.0014,
              ligSculptedMat(),
              6,
              8,
            ),
            side,
          ),
        );
        cvGrp.add(
          makeSideMarked(
            buildSculptedLigamentBand(
              [V3(vx - 0.003, vy + 0.008, 0.026 * sd), ribTub.clone().add(V3(0, 0.003, 0.004 * sd))],
              V3(0, 1, 0.5 * sd),
              0.0040,
              0.0015,
              ligSculptedMat(),
              6,
              8,
            ),
            side,
          ),
        );

        // Costochondral fibrous collar
        const arc = ribArcPoints(r, sd);
        const isSternal = r <= 8;
        const pCC = isSternal
          ? arc[3].clone().lerp(arc[4], 0.22)
          : arc[2].clone().lerp(arc[3], 0.82 - (r - 9) * 0.035);
        ccGrp.add(
          makeSideMarked(
            buildSynovialCuff(
              [
                { pos: pCC.clone().add(V3(0.002, 0.008, 0.003 * sd)), rx: 0.0075, ry: 0.012 },
                { pos: pCC.clone().add(V3(-0.002, -0.008, -0.003 * sd)), rx: 0.0070, ry: 0.011 },
              ],
              capsuleMat(),
              10,
            ),
            side,
          ),
        );

        // Sternocostal capsule & radiate sternocostal ligament (R1–R8)
        if (isSternal) {
          const np = sternalNotches[r - 1];
          const notchPt = V3(np.x, np.y, np.z * sd);
          scGrp.add(
            makeSideMarked(
              buildSynovialCuff(
                [
                  { pos: notchPt.clone().add(V3(0, -0.002, 0.008 * sd)), rx: 0.009, ry: 0.010 },
                  { pos: notchPt, rx: 0.0105, ry: 0.011 },
                  { pos: notchPt.clone().add(V3(0, 0.001, -0.006 * sd)), rx: 0.009, ry: 0.0095 },
                ],
                capsuleMat(),
                10,
              ),
              side,
            ),
          );
          scGrp.add(
            makeSideMarked(
              buildSculptedLigamentBand(
                [notchPt.clone().add(V3(0, -0.003, 0.008 * sd)), V3(np.x, np.y - 0.006, 0.005 * sd)],
                V3(0, -1, 0.4 * sd),
                0.0042,
                0.0016,
                ligSculptedMat(),
                6,
                8,
              ),
              side,
            ),
          );
        }
      }
    }
    push('equ.ske.aax.006', cvGrp, 'center');
    push('equ.ske.aax.007', ccGrp, 'center');
    push('equ.ske.aax.008', scGrp, 'center');
  }

  // Sincondrosis esternales (equ.ske.aax.009) — hyaline synchondrosis plates + internal sternal ligament
  {
    const steSynGrp = new THREE.Group();
    const steJoints: THREE.Vector3[] = [
      V3(0.440, 0.888, 0),
      V3(0.388, 0.862, 0),
      V3(0.332, 0.843, 0),
      V3(0.275, 0.832, 0),
      V3(0.220, 0.827, 0),
      V3(0.165, 0.827, 0),
      V3(0.110, 0.830, 0),
    ];
    for (const jp of steJoints) {
      steSynGrp.add(createOrganMesh(jp, [0.0055, 0.022, 0.017], cartMat(), [0, 0, -0.25], 10));
    }
    // Internal sternal ligament (ligamentum sterni) running along dorsal/thoracic aspect of sternum
    steSynGrp.add(
      buildSculptedLigamentBand(
        [V3(0.460, 0.916, 0), V3(0.300, 0.858, 0), V3(0.120, 0.846, 0)],
        V3(0, 1, 0),
        0.009,
        0.0024,
        ligSculptedMat(),
        14,
        10,
        1.15,
      ),
    );
    push('equ.ske.aax.009', steSynGrp, 'center');
  }

  // =========================================================================
  // 4. SACROILIAC & PELVIC SYMPHYSIS COMPLEX
  // =========================================================================
  push(
    'equ.ske.aax.010', // Articulación sacroilíaca
    buildBilateralArticular((sd) => {
      const g = new THREE.Group();
      g.add(createOrganMesh(V3(-0.772, 1.352, 0.056 * sd), [0.028, 0.016, 0.014], cartMat(), [0.28 * sd, 0, -0.25], 10));
      g.add(
        buildSynovialCuff(
          [
            { pos: V3(-0.764, 1.356, 0.048 * sd), rx: 0.024, ry: 0.018 },
            { pos: V3(-0.782, 1.346, 0.064 * sd), rx: 0.024, ry: 0.018 },
          ],
          capsuleMat(),
          12,
        ),
      );
      return g;
    }),
    'center',
  );
  push(
    'equ.ske.lax.009', // Ligamento sacroilíaco dorsal (funicular + membranous sheet)
    buildBilateralArticular((sd) => {
      const hl = hindlimbLandmarks(sd);
      const g = new THREE.Group();
      const [s1x, s1y] = sacralPos(1);
      const [s3x, s3y] = sacralPos(3);
      const [s5x, s5y] = sacralPos(5);
      g.add(
        buildSculptedLigamentBand(
          [
            hl.tuberSacrale.clone().add(V3(0.01, 0.004, -0.004 * sd)),
            V3(s1x - 0.012, s1y + 0.058, 0.016 * sd),
            V3(s3x - 0.015, s3y + 0.048, 0.014 * sd),
            V3(s5x - 0.015, s5y + 0.038, 0.012 * sd),
          ],
          V3(0, 1, 0.3 * sd),
          0.0085,
          0.0045,
          ligSculptedMat(),
          16,
          10,
        ),
      );
      g.add(
        createCurvedLigamentSheetMesh(
          [
            hl.tuberSacrale.clone().add(V3(-0.015, -0.006, 0)),
            V3(s3x - 0.01, s3y + 0.032, 0.018 * sd),
            V3(s5x - 0.01, s5y + 0.026, 0.015 * sd),
          ],
          [
            hl.tuberSacrale.clone().add(V3(-0.035, -0.03, 0.012 * sd)),
            V3(s3x - 0.01, s3y + 0.006, 0.034 * sd),
            V3(s5x - 0.01, s5y + 0.004, 0.026 * sd),
          ],
          sd,
          ligMat(),
          0.005,
          0.0025,
          8,
          5,
        ),
      );
      return g;
    }),
    'center',
  );
  push(
    'equ.ske.lax.010', // Ligamento sacroilíaco ventral
    buildBilateralArticular((sd) => {
      const [s1x, s1y] = sacralPos(1);
      const [s2x, s2y] = sacralPos(2);
      const g = new THREE.Group();
      g.add(
        buildSculptedLigamentBand(
          [V3(s1x + 0.006, s1y - 0.014, 0.052 * sd), V3(s1x + 0.01, s1y - 0.022, 0.088 * sd)],
          V3(0, -1, 0),
          0.0075,
          0.0032,
          ligSculptedMat(),
          8,
          8,
        ),
      );
      g.add(
        buildSculptedLigamentBand(
          [V3(s2x, s2y - 0.012, 0.044 * sd), V3(s2x - 0.006, s2y - 0.024, 0.078 * sd)],
          V3(0, -1, 0),
          0.0070,
          0.0030,
          ligSculptedMat(),
          8,
          8,
        ),
      );
      return g;
    }),
    'center',
  );
  push(
    'equ.ske.lax.011', // Ligamento sacrotuberal ancho
    buildBilateralArticular((sd) => {
      const hl = hindlimbLandmarks(sd);
      const [s2x, s2y] = sacralPos(2);
      const [s4x, s4y] = sacralPos(4);
      const [c1x, c1y] = caudalPos(1);
      const [c2x, c2y] = caudalPos(2);
      return createCurvedLigamentSheetMesh(
        [
          V3(s2x - 0.005, s2y + 0.002, 0.046 * sd),
          V3(s4x, s4y + 0.002, 0.032 * sd),
          V3(c1x, c1y + 0.002, 0.02 * sd),
          V3(c2x - 0.01, c2y, 0.016 * sd),
        ],
        [
          hl.acetabulum.clone().add(V3(-0.005, 0.038, -0.014 * sd)),
          V3(-0.868, 1.186, 0.112 * sd),
          V3(-0.935, 1.16, 0.108 * sd),
          hl.tuberIschii.clone().add(V3(0.012, 0.008, -0.002 * sd)),
        ],
        sd,
        ligMat(),
        0.016,
        0.0032,
        14,
        8,
      );
    }),
    'center',
  );
  push(
    'equ.ske.aax.011', // Sínfisis pelviana
    createMultiStationLoftTube(
      [
        { pos: V3(-0.79, 1.072, 0), rx: 0.008, ry: 0.009 },
        { pos: V3(-0.876, 1.076, 0), rx: 0.008, ry: 0.009 },
        { pos: V3(-0.962, 1.088, 0), rx: 0.009, ry: 0.01 },
      ],
      cartMat(),
      10,
    ),
    'center',
  );

  // =========================================================================
  // 5. FORELIMB JOINTS & LIGAMENTS (amt.001..010, lmt.001..012)
  // =========================================================================
  for (const sd of [-1, 1] as const) {
    const tag = sd === -1 ? 'i' : 'd';
    const side = sd === -1 ? 'left' : 'right';
    const fl = forelimbLandmarks(sd);

    // 5A. Articulación del hombro (equ.ske.amt.001-i/d): capsule + V-shaped glenohumeral ligaments
    {
      const shGrp = new THREE.Group();
      shGrp.add(
        buildSynovialCuff(
          [
            { pos: fl.shoulder.clone().add(V3(0.014, 0.026, -0.004 * sd)), rx: 0.036, ry: 0.034 },
            { pos: fl.shoulder, rx: 0.042, ry: 0.038 },
            { pos: fl.shoulder.clone().add(V3(-0.016, -0.028, 0.002 * sd)), rx: 0.035, ry: 0.033 },
          ],
          capsuleMat(),
          16,
        ),
      );
      // Lateral & medial glenohumeral ligaments (supraglenoid tubercle -> humeral tubercles)
      shGrp.add(
        buildSculptedLigamentBand(
          [
            fl.shoulder.clone().add(V3(0.014, 0.028, 0.006 * sd)),
            fl.shoulder.clone().add(V3(0.028, -0.016, 0.024 * sd)),
          ],
          V3(1, 0, sd),
          0.0065,
          0.0026,
          ligSculptedMat(),
        ),
      );
      shGrp.add(
        buildSculptedLigamentBand(
          [
            fl.shoulder.clone().add(V3(0.014, 0.028, -0.008 * sd)),
            fl.shoulder.clone().add(V3(0.024, -0.016, -0.024 * sd)),
          ],
          V3(1, 0, -sd),
          0.0065,
          0.0026,
          ligSculptedMat(),
        ),
      );
      push(`equ.ske.amt.001-${tag}`, shGrp, side);
    }

    // 5B. Articulación del codo (equ.ske.amt.002-i/d)
    push(
      `equ.ske.amt.002-${tag}`,
      buildSynovialCuff(
        [
          { pos: fl.elbow.clone().add(V3(0.008, 0.024, 0)), rx: 0.032, ry: 0.031 },
          { pos: fl.elbow, rx: 0.037, ry: 0.034 },
          { pos: fl.elbow.clone().add(V3(-0.004, -0.024, 0)), rx: 0.030, ry: 0.029 },
        ],
        capsuleMat(),
        16,
      ),
      side,
    );
  }

  // Ligamentos colaterales del codo (equ.ske.lmt.001 medial, lmt.002 lateral)
  push(
    'equ.ske.lmt.001',
    buildBilateralArticular((sd) => {
      const fl = forelimbLandmarks(sd);
      const g = new THREE.Group();
      // Long & short parts from medial humeral epicondyle onto medial radial tuberosity & neck
      g.add(
        buildSculptedLigamentBand(
          [
            fl.elbow.clone().add(V3(0.004, 0.020, -0.031 * sd)),
            fl.elbow.clone().add(V3(0.008, -0.004, -0.033 * sd)),
            fl.elbow.clone().add(V3(0.008, -0.042, -0.026 * sd)),
          ],
          V3(0, 0, -sd),
          0.0065,
          0.0026,
          ligSculptedMat(),
        ),
      );
      return g;
    }),
    'center',
  );
  push(
    'equ.ske.lmt.002',
    buildBilateralArticular((sd) => {
      const fl = forelimbLandmarks(sd);
      return buildSculptedLigamentBand(
        [
          fl.elbow.clone().add(V3(0.002, 0.020, 0.031 * sd)),
          fl.elbow.clone().add(V3(0.004, -0.002, 0.033 * sd)),
          fl.elbow.clone().add(V3(0.000, -0.032, 0.028 * sd)),
        ],
        V3(0, 0, sd),
        0.0072,
        0.0030,
        ligSculptedMat(),
      );
    }),
    'center',
  );

  // Sindesmosis radiocubital (equ.ske.amt.003-i) — interosseous radioulnar ligament + transverse arcs
  push(
    'equ.ske.amt.003-i',
    buildBilateralArticular((sd) => {
      const fl = forelimbLandmarks(sd);
      const g = new THREE.Group();
      // Proximal & distal interosseous membrane bridging palmar radius to cranial ulna shaft
      const uTop = fl.elbow.clone().add(V3(-0.012, -0.012, 0.004 * sd));
      const uMid = fl.elbow.clone().lerp(fl.carpus, 0.36).add(V3(-0.009, 0, 0.009 * sd));
      const uBot = fl.carpus.clone().add(V3(-0.006, 0.138, 0.005 * sd));
      g.add(
        buildSculptedLigamentBand(
          [uTop, uMid, uBot],
          V3(0, 0, sd),
          0.0085,
          0.0028,
          ligSculptedMat(),
          18,
          10,
        ),
      );
      // Transverse proximal radioulnar band around radial head
      g.add(
        buildSculptedLigamentBand(
          [
            fl.elbow.clone().add(V3(-0.008, -0.012, -0.022 * sd)),
            fl.elbow.clone().add(V3(-0.016, -0.012, 0)),
            fl.elbow.clone().add(V3(-0.008, -0.012, 0.022 * sd)),
          ],
          V3(-1, 0, 0),
          0.0045,
          0.0020,
          ligSculptedMat(),
        ),
      );
      return g;
    }),
    'center',
  );

  // Carpal joint complex: Antebrachiocarpal (amt.004), Middle Carpal (amt.005), Intercarpal (amt.006), Carpometacarpal (amt.007)
  push(
    'equ.ske.amt.004',
    buildBilateralArticular((sd) => {
      const c = forelimbLandmarks(sd).carpus;
      return buildSynovialCuff(
        [
          { pos: c.clone().add(V3(0.005, 0.030, 0)), rx: 0.030, ry: 0.030 },
          { pos: c.clone().add(V3(0.004, 0.019, 0)), rx: 0.033, ry: 0.032 },
          { pos: c.clone().add(V3(0.005, 0.008, 0)), rx: 0.030, ry: 0.030 },
        ],
        capsuleMat(),
        14,
      );
    }),
    'center',
  );
  push(
    'equ.ske.amt.005',
    buildBilateralArticular((sd) => {
      const c = forelimbLandmarks(sd).carpus;
      return buildSynovialCuff(
        [
          { pos: c.clone().add(V3(0.005, 0.010, 0)), rx: 0.029, ry: 0.028 },
          { pos: c.clone().add(V3(0.005, 0.001, 0)), rx: 0.032, ry: 0.030 },
          { pos: c.clone().add(V3(0.005, -0.008, 0)), rx: 0.029, ry: 0.028 },
        ],
        capsuleMat(),
        14,
      );
    }),
    'center',
  );
  push(
    'equ.ske.amt.006', // Articulaciones intercarpianas (transverse dorsal & palmar intercarpal ligaments)
    buildBilateralArticular((sd) => {
      const c = forelimbLandmarks(sd).carpus;
      const g = new THREE.Group();
      // Proximal row dorsal transverse intercarpal ligament (Cr - Ci - Cu)
      g.add(
        buildSculptedLigamentBand(
          [
            c.clone().add(V3(0.020, 0.014, -0.018 * sd)),
            c.clone().add(V3(0.023, 0.014, 0)),
            c.clone().add(V3(0.020, 0.014, 0.018 * sd)),
          ],
          V3(1, 0, 0),
          0.0050,
          0.0020,
          ligSculptedMat(),
        ),
      );
      // Distal row dorsal transverse intercarpal ligament (C2 - C3 - C4)
      g.add(
        buildSculptedLigamentBand(
          [
            c.clone().add(V3(0.018, -0.009, -0.017 * sd)),
            c.clone().add(V3(0.023, -0.009, 0)),
            c.clone().add(V3(0.018, -0.009, 0.017 * sd)),
          ],
          V3(1, 0, 0),
          0.0046,
          0.0018,
          ligSculptedMat(),
        ),
      );
      // Accessory carpal dorsal & palmar stabilizing ligaments (Cu <-> Ca)
      g.add(
        buildSculptedLigamentBand(
          [
            c.clone().add(V3(0.002, 0.014, 0.020 * sd)),
            c.clone().add(V3(-0.020, 0.015, 0.018 * sd)),
          ],
          V3(0, 0, sd),
          0.0045,
          0.0020,
          ligSculptedMat(),
        ),
      );
      return g;
    }),
    'center',
  );
  push(
    'equ.ske.amt.007', // Articulación carpometacarpiana (capsule + dorsal carpometacarpal & accessorometacarpal bands)
    buildBilateralArticular((sd) => {
      const c = forelimbLandmarks(sd).carpus;
      const g = new THREE.Group();
      g.add(
        buildSynovialCuff(
          [
            { pos: c.clone().add(V3(0.005, -0.010, 0)), rx: 0.027, ry: 0.026 },
            { pos: c.clone().add(V3(0.004, -0.017, 0)), rx: 0.028, ry: 0.027 },
            { pos: c.clone().add(V3(0.003, -0.024, 0)), rx: 0.026, ry: 0.025 },
          ],
          capsuleMat(),
          14,
        ),
      );
      // Dorsal carpometacarpal bands (C3 -> McIII tuberosity)
      for (const zOff of [-0.009, 0.009]) {
        g.add(
          buildSculptedLigamentBand(
            [c.clone().add(V3(0.020, -0.008, zOff * sd)), c.clone().add(V3(0.017, -0.032, zOff * sd))],
            V3(1, 0, 0),
            0.0042,
            0.0018,
            ligSculptedMat(),
            8,
            8,
          ),
        );
      }
      // Accessorometacarpal ligament (accessory carpal -> proximal McIV)
      g.add(
        buildSculptedLigamentBand(
          [c.clone().add(V3(-0.022, 0.010, 0.015 * sd)), c.clone().add(V3(-0.011, -0.024, 0.017 * sd))],
          V3(-0.5, 0, sd),
          0.0048,
          0.0020,
          ligSculptedMat(),
          8,
          8,
        ),
      );
      return g;
    }),
    'center',
  );

  // Carpal Collateral Ligaments (equ.ske.lmt.003-i medial, lmt.004-i lateral)
  push(
    'equ.ske.lmt.003-i',
    buildBilateralArticular((sd) => {
      const c = forelimbLandmarks(sd).carpus;
      return buildSculptedLigamentBand(
        [
          c.clone().add(V3(0.004, 0.034, -0.027 * sd)),
          c.clone().add(V3(0.006, 0.005, -0.029 * sd)),
          c.clone().add(V3(0.002, -0.030, -0.025 * sd)),
        ],
        V3(0, 0, -sd),
        0.0068,
        0.0025,
        ligSculptedMat(),
      );
    }),
    'center',
  );
  push(
    'equ.ske.lmt.004-i',
    buildBilateralArticular((sd) => {
      const c = forelimbLandmarks(sd).carpus;
      return buildSculptedLigamentBand(
        [
          c.clone().add(V3(0.004, 0.034, 0.027 * sd)),
          c.clone().add(V3(0.005, 0.005, 0.029 * sd)),
          c.clone().add(V3(0.000, -0.030, 0.025 * sd)),
        ],
        V3(0, 0, sd),
        0.0068,
        0.0025,
        ligSculptedMat(),
      );
    }),
    'center',
  );

  // Forelimb Stay Apparatus: Suspensory (lmt.005-i), Inferior Check (lmt.006-i), Superior Check (lmt.007-i)
  push(
    'equ.ske.lmt.005-i',
    buildBilateralArticular((sd) => {
      const fl = forelimbLandmarks(sd);
      const g = new THREE.Group();
      const midCannon = fl.carpus.clone().lerp(fl.fetlock, 0.65).add(V3(-0.015, 0, 0));
      // Broad flattened body hugging palmar McIII groove
      g.add(
        buildSculptedLigamentBand(
          [
            fl.carpus.clone().add(V3(-0.014, -0.018, 0)),
            fl.carpus.clone().lerp(fl.fetlock, 0.35).add(V3(-0.015, 0, 0)),
            midCannon,
          ],
          V3(-1, 0, 0),
          0.0115,
          0.0042,
          ligSculptedMat(),
          14,
          12,
        ),
      );
      // Paired sesamoid branches + oblique dorsal extensor branches sweeping cranially onto P1
      for (const brSign of [-1, 1] as const) {
        const zBr = brSign * sd;
        g.add(
          buildSculptedLigamentBand(
            [
              midCannon,
              fl.fetlock.clone().add(V3(-0.017, 0.014, 0.012 * zBr)),
              fl.fetlock.clone().add(V3(0.002, -0.018, 0.016 * zBr)),
              fl.pasternMid.clone().add(V3(0.013, 0.008, 0.006 * zBr)),
            ],
            V3(0.4, 0, zBr),
            0.0052,
            0.0022,
            ligSculptedMat(),
            14,
            10,
          ),
        );
      }
      return g;
    }),
    'center',
  );
  push(
    'equ.ske.lmt.006-i', // Inferior check ligament (accessory ligament of DDFT)
    buildBilateralArticular((sd) => {
      const fl = forelimbLandmarks(sd);
      return buildSculptedLigamentBand(
        [
          fl.carpus.clone().add(V3(-0.018, -0.016, 0)),
          fl.carpus.clone().lerp(fl.fetlock, 0.45).add(V3(-0.025, 0, 0)),
        ],
        V3(-1, 0, 0),
        0.0082,
        0.0032,
        ligSculptedMat(),
      );
    }),
    'center',
  );
  push(
    'equ.ske.lmt.007-i', // Superior check ligament (accessory ligament of SDFT)
    buildBilateralArticular((sd) => {
      const fl = forelimbLandmarks(sd);
      return buildSculptedLigamentBand(
        [
          fl.carpus.clone().add(V3(-0.013, 0.145, -0.006 * sd)),
          fl.carpus.clone().add(V3(-0.023, 0.022, 0)),
        ],
        V3(-1, 0, 0),
        0.0085,
        0.0034,
        ligSculptedMat(),
      );
    }),
    'center',
  );

  // Forelimb Fetlock (amt.008), Pastern (amt.009), Coffin (amt.010) + Collateral (lmt.008-i, 009-i),
  // Palmar Annular (lmt.010-i), Distal Sesamoideans (lmt.011-i), Distal Impar (lmt.012-i)
  push(
    'equ.ske.amt.008',
    buildBilateralArticular((sd) => {
      const f = forelimbLandmarks(sd).fetlock;
      return buildSynovialCuff(
        [
          { pos: f.clone().add(V3(-0.003, 0.022, 0)), rx: 0.028, ry: 0.026 },
          { pos: f, rx: 0.033, ry: 0.029 },
          { pos: f.clone().add(V3(0.004, -0.020, 0)), rx: 0.026, ry: 0.025 },
        ],
        capsuleMat(),
        14,
      );
    }),
    'center',
  );
  push(
    'equ.ske.amt.009', // Interfalángica proximal + medial/lateral collateral bands integrated
    buildBilateralArticular((sd) => {
      const p = forelimbLandmarks(sd).pasternMid;
      const g = new THREE.Group();
      g.add(
        buildSynovialCuff(
          [
            { pos: p.clone().add(V3(-0.004, 0.013, 0)), rx: 0.024, ry: 0.023 },
            { pos: p, rx: 0.026, ry: 0.025 },
            { pos: p.clone().add(V3(0.004, -0.013, 0)), rx: 0.023, ry: 0.022 },
          ],
          capsuleMat(),
          14,
        ),
      );
      for (const sSign of [-1, 1] as const) {
        g.add(
          buildSculptedLigamentBand(
            [p.clone().add(V3(-0.005, 0.013, 0.022 * sSign * sd)), p.clone().add(V3(0.004, -0.013, 0.022 * sSign * sd))],
            V3(0, 0, sSign * sd),
            0.0042,
            0.0018,
            ligSculptedMat(),
            8,
            8,
          ),
        );
      }
      return g;
    }),
    'center',
  );
  push(
    'equ.ske.amt.010', // Interfalángica distal + collateral ligaments
    buildBilateralArticular((sd) => {
      const cr = forelimbLandmarks(sd).coronet;
      const g = new THREE.Group();
      g.add(
        buildSynovialCuff(
          [
            { pos: cr.clone().add(V3(-0.004, 0.011, 0)), rx: 0.023, ry: 0.025 },
            { pos: cr, rx: 0.025, ry: 0.027 },
            { pos: cr.clone().add(V3(0.004, -0.010, 0)), rx: 0.022, ry: 0.024 },
          ],
          capsuleMat(),
          14,
        ),
      );
      for (const sSign of [-1, 1] as const) {
        g.add(
          buildSculptedLigamentBand(
            [cr.clone().add(V3(-0.003, 0.011, 0.021 * sSign * sd)), cr.clone().add(V3(0.006, -0.012, 0.023 * sSign * sd))],
            V3(0, 0, sSign * sd),
            0.0044,
            0.0018,
            ligSculptedMat(),
            8,
            8,
          ),
        );
      }
      return g;
    }),
    'center',
  );

  // Fetlock Collaterals (equ.ske.lmt.008-i medial, lmt.009-i lateral) — dual superficial & deep sesamoid bands
  push(
    'equ.ske.lmt.008-i',
    buildBilateralArticular((sd) => {
      const f = forelimbLandmarks(sd).fetlock;
      const g = new THREE.Group();
      // Superficial vertical band (McIII epicondyle -> P1 proximal border)
      g.add(
        buildSculptedLigamentBand(
          [f.clone().add(V3(0.0, 0.022, -0.024 * sd)), f.clone().add(V3(0.004, -0.022, -0.023 * sd))],
          V3(0, 0, -sd),
          0.0052,
          0.0020,
          ligSculptedMat(),
        ),
      );
      // Deep oblique band (McIII fossa -> abaxial medial sesamoid & P1)
      g.add(
        buildSculptedLigamentBand(
          [f.clone().add(V3(-0.002, 0.018, -0.022 * sd)), f.clone().add(V3(-0.014, 0.004, -0.018 * sd))],
          V3(-0.3, 0, -sd),
          0.0042,
          0.0018,
          ligSculptedMat(),
        ),
      );
      return g;
    }),
    'center',
  );
  push(
    'equ.ske.lmt.009-i',
    buildBilateralArticular((sd) => {
      const f = forelimbLandmarks(sd).fetlock;
      const g = new THREE.Group();
      g.add(
        buildSculptedLigamentBand(
          [f.clone().add(V3(0.0, 0.022, 0.024 * sd)), f.clone().add(V3(0.004, -0.022, 0.023 * sd))],
          V3(0, 0, sd),
          0.0052,
          0.0020,
          ligSculptedMat(),
        ),
      );
      g.add(
        buildSculptedLigamentBand(
          [f.clone().add(V3(-0.002, 0.018, 0.022 * sd)), f.clone().add(V3(-0.014, 0.004, 0.018 * sd))],
          V3(-0.3, 0, sd),
          0.0042,
          0.0018,
          ligSculptedMat(),
        ),
      );
      return g;
    }),
    'center',
  );

  push(
    'equ.ske.lmt.010-i', // Ligamento anular palmar (broad sculpted wrap across palmar sesamoids)
    buildBilateralArticular((sd) => {
      const fl = forelimbLandmarks(sd);
      return buildSculptedLigamentBand(
        [
          fl.fetlock.clone().add(V3(-0.013, 0.007, -0.019 * sd)),
          fl.fetlock.clone().add(V3(-0.029, 0.007, 0)),
          fl.fetlock.clone().add(V3(-0.013, 0.007, 0.019 * sd)),
        ],
        V3(-1, 0, 0),
        0.0105,
        0.0022,
        ligSculptedMat(),
        12,
        10,
      );
    }),
    'center',
  );

  // Distal sesamoidean apparatus (equ.ske.lmt.011-i): Straight + Paired Oblique (V) + Cruciate (X) + Short!
  push(
    'equ.ske.lmt.011-i',
    buildBilateralArticular((sd) => {
      const fl = forelimbLandmarks(sd);
      const g = new THREE.Group();
      const sesBase = fl.fetlock.clone().add(V3(-0.016, 0.002, 0));
      const p1MidPalmar = fl.fetlock.clone().lerp(fl.pasternMid, 0.52).add(V3(-0.014, 0, 0));
      const p2ProxScutum = fl.pasternMid.clone().add(V3(-0.014, -0.004, 0));

      // 1. Straight sesamoidean ligament (flat central strap -> P2 scutum)
      g.add(
        buildSculptedLigamentBand(
          [sesBase.clone().add(V3(-0.002, 0, 0)), p1MidPalmar.clone().add(V3(-0.003, 0, 0)), p2ProxScutum],
          V3(-1, 0, 0),
          0.0068,
          0.0024,
          ligSculptedMat(),
          12,
          10,
        ),
      );
      // 2. Oblique sesamoidean ligaments (converging V onto P1 palmar V-trigone)
      for (const sSign of [-1, 1] as const) {
        g.add(
          buildSculptedLigamentBand(
            [sesBase.clone().add(V3(0.001, 0.002, 0.011 * sSign * sd)), p1MidPalmar.clone().add(V3(0.002, -0.002, 0.003 * sSign * sd))],
            V3(-1, 0, 0.3 * sSign * sd),
            0.0046,
            0.0020,
            ligSculptedMat(),
            8,
            8,
          ),
        );
      }
      // 3. Cruciate sesamoidean ligaments (deep crossing X under sesamoid base -> opposite P1 tubercle)
      for (const sSign of [-1, 1] as const) {
        g.add(
          buildSculptedLigamentBand(
            [
              sesBase.clone().add(V3(0.004, 0.002, 0.009 * sSign * sd)),
              fl.fetlock.clone().add(V3(-0.008, -0.018, -0.009 * sSign * sd)),
            ],
            V3(-1, 0, 0),
            0.0030,
            0.0014,
            ligSculptedMat(),
            6,
            8,
          ),
        );
      }
      // 4. Short sesamoidean ligaments
      for (const sSign of [-1, 1] as const) {
        g.add(
          buildSculptedLigamentBand(
            [sesBase.clone().add(V3(0.005, 0.002, 0.012 * sSign * sd)), fl.fetlock.clone().add(V3(-0.006, -0.014, 0.014 * sSign * sd))],
            V3(-0.6, 0, sSign * sd),
            0.0032,
            0.0015,
            ligSculptedMat(),
            6,
            8,
          ),
        );
      }
      return g;
    }),
    'center',
  );

  // Distal sesamoidean impar ligament + collateral navicular suspensory bands (equ.ske.lmt.012-i)
  push(
    'equ.ske.lmt.012-i',
    buildBilateralArticular((sd) => {
      const fl = forelimbLandmarks(sd);
      const g = new THREE.Group();
      const navCenter = fl.coronet.clone().add(V3(-0.017, -0.011, 0));
      g.add(
        buildSculptedLigamentBand(
          [navCenter, fl.hoofCenter.clone().add(V3(-0.009, 0.012, 0))],
          V3(-1, -0.4, 0),
          0.011,
          0.0022,
          ligSculptedMat(),
          8,
          10,
        ),
      );
      for (const sSign of [-1, 1] as const) {
        g.add(
          buildSculptedLigamentBand(
            [
              navCenter.clone().add(V3(0, 0.002, 0.015 * sSign * sd)),
              fl.pasternMid.clone().add(V3(-0.004, -0.008, 0.019 * sSign * sd)),
            ],
            V3(0, 0, sSign * sd),
            0.0036,
            0.0016,
            ligSculptedMat(),
            8,
            8,
          ),
        );
      }
      return g;
    }),
    'center',
  );

  // =========================================================================
  // 6. HINDLIMB JOINTS & LIGAMENTS (amp.001..013, lmp.001..016)
  // =========================================================================
  // Hip (amp.001), Femoral head lig (lmp.001-i), Accessory lig of femur (lmp.002-i)
  push(
    'equ.ske.amp.001',
    buildBilateralArticular((sd) => {
      const hl = hindlimbLandmarks(sd);
      const g = new THREE.Group();
      g.add(
        buildSynovialCuff(
          [
            { pos: hl.acetabulum.clone().add(V3(0.001, 0.002, -0.008 * sd)), rx: 0.029, ry: 0.029 },
            { pos: hl.acetabulum.clone().add(V3(-0.001, 0, 0.010 * sd)), rx: 0.030, ry: 0.030 },
            { pos: hl.acetabulum.clone().lerp(hl.hip, 0.82), rx: 0.022, ry: 0.023 },
          ],
          capsuleMat(),
          14,
        ),
      );
      // Fibrocartilaginous acetabular labrum ring
      const labrum = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.0035, 8, 16), cartMat());
      labrum.position.copy(hl.acetabulum.clone().add(V3(0, 0, 0.004 * sd)));
      labrum.rotation.y = Math.PI * 0.5;
      g.add(labrum);
      return g;
    }),
    'center',
  );
  push(
    'equ.ske.lmp.001-i',
    buildBilateralArticular((sd) => {
      const hl = hindlimbLandmarks(sd);
      return buildSculptedLigamentBand(
        [hl.acetabulum.clone().add(V3(0, -0.005, -0.012 * sd)), hl.acetabulum.clone().add(V3(0, 0.001, 0.006 * sd))],
        V3(0, 1, 0),
        0.0055,
        0.0032,
        ligSculptedMat(),
        8,
        8,
      );
    }),
    'center',
  );
  push(
    'equ.ske.lmp.002-i',
    buildBilateralArticular((sd) => {
      const hl = hindlimbLandmarks(sd);
      return buildSculptedLigamentBand(
        [
          V3(-0.79, 1.072, 0.016 * sd),
          V3(-0.805, 1.096, 0.072 * sd),
          hl.acetabulum.clone().add(V3(0.005, -0.022, -0.008 * sd)),
          hl.acetabulum.clone().add(V3(0, -0.002, 0.004 * sd)),
        ],
        V3(0, -1, 0.3 * sd),
        0.0058,
        0.0026,
        ligSculptedMat(),
        14,
        8,
      );
    }),
    'center',
  );

  // Stifle: Femoropatellar (amp.002), Femorotibial (amp.003-i), Menisci (amp.004, amp.005),
  // 3 Patellar ligs (lmp.003-i..005-i), Femoropatellar ligs (lmp.006-i, 007-i),
  // Cranial/Caudal Cruciates (lmp.008-i, 009-i/d), Collaterals (lmp.010-i/d, 011-i/d)
  push(
    'equ.ske.amp.002',
    buildBilateralArticular((sd) => {
      const st = hindlimbLandmarks(sd).stifle;
      return buildSynovialCuff(
        [
          { pos: st.clone().add(V3(0.025, 0.032, -0.004 * sd)), rx: 0.023, ry: 0.024 },
          { pos: st.clone().add(V3(0.023, 0.010, -0.004 * sd)), rx: 0.030, ry: 0.028 },
          { pos: st.clone().add(V3(0.019, -0.012, -0.004 * sd)), rx: 0.023, ry: 0.023 },
        ],
        capsuleMat(),
        14,
      );
    }),
    'center',
  );
  push(
    'equ.ske.amp.003-i',
    buildBilateralArticular((sd) => {
      const st = hindlimbLandmarks(sd).stifle;
      return buildSynovialCuff(
        [
          { pos: st.clone().add(V3(-0.002, 0.026, 0)), rx: 0.037, ry: 0.034 },
          { pos: st, rx: 0.042, ry: 0.037 },
          { pos: st.clone().add(V3(0.002, -0.024, 0)), rx: 0.035, ry: 0.033 },
        ],
        capsuleMat(),
        16,
      );
    }),
    'center',
  );
  push(
    'equ.ske.amp.004',
    buildBilateralArticular((sd) =>
      buildMeniscusWedge(hindlimbLandmarks(sd).stifle.clone().add(V3(0, -0.004, -0.015 * sd)), -sd, cartMat()),
    ),
    'center',
  );
  push(
    'equ.ske.amp.005',
    buildBilateralArticular((sd) =>
      buildMeniscusWedge(hindlimbLandmarks(sd).stifle.clone().add(V3(0, -0.004, 0.015 * sd)), sd, cartMat()),
    ),
    'center',
  );

  // 3 Equine Patellar Ligaments (locking stay-apparatus loop!)
  push(
    'equ.ske.lmp.003-i', // Medial patellar ligament + fibrocartilaginous parapatellar hook
    buildBilateralArticular((sd) => {
      const st = hindlimbLandmarks(sd).stifle;
      const g = new THREE.Group();
      g.add(
        createOrganMesh(
          st.clone().add(V3(0.022, 0.018, -0.017 * sd)),
          [0.011, 0.014, 0.006],
          cartMat(),
          [0, 0, -0.2],
          10,
        ),
      );
      g.add(
        buildSculptedLigamentBand(
          [
            st.clone().add(V3(0.022, 0.014, -0.017 * sd)),
            st.clone().add(V3(0.024, -0.022, -0.016 * sd)),
            st.clone().add(V3(0.017, -0.058, -0.012 * sd)),
          ],
          V3(1, 0, -0.5 * sd),
          0.0065,
          0.0026,
          ligSculptedMat(),
        ),
      );
      return g;
    }),
    'center',
  );
  push(
    'equ.ske.lmp.004-i', // Intermediate patellar ligament
    buildBilateralArticular((sd) => {
      const st = hindlimbLandmarks(sd).stifle;
      return buildSculptedLigamentBand(
        [
          st.clone().add(V3(0.029, 0.008, -0.003 * sd)),
          st.clone().add(V3(0.026, -0.024, -0.003 * sd)),
          st.clone().add(V3(0.019, -0.060, -0.003 * sd)),
        ],
        V3(1, 0, 0),
        0.0078,
        0.0032,
        ligSculptedMat(),
      );
    }),
    'center',
  );
  push(
    'equ.ske.lmp.005-i', // Lateral patellar ligament
    buildBilateralArticular((sd) => {
      const st = hindlimbLandmarks(sd).stifle;
      return buildSculptedLigamentBand(
        [
          st.clone().add(V3(0.025, 0.010, 0.010 * sd)),
          st.clone().add(V3(0.023, -0.024, 0.011 * sd)),
          st.clone().add(V3(0.017, -0.058, 0.009 * sd)),
        ],
        V3(1, 0, 0.4 * sd),
        0.0070,
        0.0028,
        ligSculptedMat(),
      );
    }),
    'center',
  );
  push(
    'equ.ske.lmp.006-i', // Ligamento femoropatelar medial
    buildBilateralArticular((sd) => {
      const st = hindlimbLandmarks(sd).stifle;
      return buildSculptedLigamentBand(
        [
          st.clone().add(V3(0.022, 0.018, -0.018 * sd)),
          st.clone().add(V3(0.008, 0.022, -0.028 * sd)),
          st.clone().add(V3(-0.008, 0.018, -0.032 * sd)),
        ],
        V3(0, 0.4, -sd),
        0.0075,
        0.0022,
        ligSculptedMat(),
      );
    }),
    'center',
  );
  push(
    'equ.ske.lmp.007-i', // Ligamento femoropatelar lateral
    buildBilateralArticular((sd) => {
      const st = hindlimbLandmarks(sd).stifle;
      return buildSculptedLigamentBand(
        [
          st.clone().add(V3(0.022, 0.018, 0.014 * sd)),
          st.clone().add(V3(0.008, 0.022, 0.026 * sd)),
          st.clone().add(V3(-0.008, 0.018, 0.031 * sd)),
        ],
        V3(0, 0.4, sd),
        0.0075,
        0.0022,
        ligSculptedMat(),
      );
    }),
    'center',
  );
  push(
    'equ.ske.lmp.008-i', // Cranial cruciate ligament
    buildBilateralArticular((sd) => {
      const st = hindlimbLandmarks(sd).stifle;
      return buildSculptedLigamentBand(
        [st.clone().add(V3(0.012, 0.015, 0.004 * sd)), st.clone().add(V3(-0.010, -0.020, -0.003 * sd))],
        V3(0, 0, sd),
        0.0068,
        0.0032,
        ligSculptedMat(),
        10,
        10,
      );
    }),
    'center',
  );

  // Separate -i/-d Hindlimb Ligaments & Proximal Tibiofibular / Hock / Distal joints
  for (const sd of [-1, 1] as const) {
    const tag = sd === -1 ? 'i' : 'd';
    const side = sd === -1 ? 'left' : 'right';
    const hl = hindlimbLandmarks(sd);

    push(
      `equ.ske.lmp.009-${tag}`, // Caudal cruciate ligament
      buildSculptedLigamentBand(
        [hl.stifle.clone().add(V3(-0.010, 0.015, -0.004 * sd)), hl.stifle.clone().add(V3(0.012, -0.020, 0.003 * sd))],
        V3(0, 0, -sd),
        0.0068,
        0.0032,
        ligSculptedMat(),
        10,
        10,
      ),
      side,
    );

    // Medial & lateral collateral ligaments of stifle (lmp.010-i/d, lmp.011-i/d)
    push(
      `equ.ske.lmp.010-${tag}`,
      buildSculptedLigamentBand(
        [
          hl.stifle.clone().add(V3(-0.002, 0.022, -0.036 * sd)),
          hl.stifle.clone().add(V3(-0.002, -0.004, -0.038 * sd)),
          hl.stifle.clone().add(V3(-0.004, -0.036, -0.031 * sd)),
        ],
        V3(0, 0, -sd),
        0.0075,
        0.0026,
        ligSculptedMat(),
      ),
      side,
    );
    push(
      `equ.ske.lmp.011-${tag}`,
      buildSculptedLigamentBand(
        [
          hl.stifle.clone().add(V3(-0.005, 0.022, 0.035 * sd)),
          hl.stifle.clone().add(V3(-0.009, -0.002, 0.036 * sd)),
          hl.stifle.clone().add(V3(-0.014, -0.030, 0.030 * sd)),
        ],
        V3(0, 0, sd),
        0.0080,
        0.0028,
        ligSculptedMat(),
      ),
      side,
    );

    // Tarsal medial & lateral collateral ligaments (lmp.012-i/d, lmp.013-i/d) — long superficial + short deep bands
    {
      const hk = hl.hock;
      const mGrp = new THREE.Group();
      mGrp.add(
        buildSculptedLigamentBand(
          [
            hk.clone().add(V3(-0.002, 0.034, -0.027 * sd)),
            hk.clone().add(V3(-0.004, 0.004, -0.028 * sd)),
            hk.clone().add(V3(-0.005, -0.030, -0.023 * sd)),
          ],
          V3(0, 0, -sd),
          0.0068,
          0.0024,
          ligSculptedMat(),
        ),
      );
      mGrp.add(
        buildSculptedLigamentBand(
          [hk.clone().add(V3(-0.003, 0.030, -0.025 * sd)), hk.clone().add(V3(-0.012, 0.008, -0.024 * sd))],
          V3(0, 0, -sd),
          0.0045,
          0.0018,
          ligSculptedMat(),
        ),
      );
      push(`equ.ske.lmp.012-${tag}`, mGrp, side);

      const lGrp = new THREE.Group();
      lGrp.add(
        buildSculptedLigamentBand(
          [
            hk.clone().add(V3(-0.004, 0.034, 0.027 * sd)),
            hk.clone().add(V3(-0.007, 0.002, 0.028 * sd)),
            hk.clone().add(V3(-0.006, -0.030, 0.023 * sd)),
          ],
          V3(0, 0, sd),
          0.0068,
          0.0024,
          ligSculptedMat(),
        ),
      );
      lGrp.add(
        buildSculptedLigamentBand(
          [hk.clone().add(V3(-0.005, 0.030, 0.025 * sd)), hk.clone().add(V3(-0.018, 0.012, 0.023 * sd))],
          V3(0, 0, sd),
          0.0046,
          0.0018,
          ligSculptedMat(),
        ),
      );
      push(`equ.ske.lmp.013-${tag}`, lGrp, side);
    }

    push(
      `equ.ske.lmp.014-${tag}`, // Ligamento plantar largo (tuber calcanei -> cuboid T4 -> MtIV/MtIII)
      buildSculptedLigamentBand(
        [
          hl.calcaneusTip.clone().add(V3(-0.006, 0.004, 0.004 * sd)),
          hl.hock.clone().add(V3(-0.028, 0.018, 0.010 * sd)),
          hl.hock.clone().add(V3(-0.022, -0.022, 0.013 * sd)),
          hl.hock.clone().add(V3(-0.018, -0.056, 0.012 * sd)),
        ],
        V3(-1, 0, 0.3 * sd),
        0.0095,
        0.0036,
        ligSculptedMat(),
        14,
        10,
      ),
      side,
    );

    push(
      `equ.ske.lmp.015-${tag}`, // Ligamento suspensorio del menudillo (pélvico)
      (() => {
        const g = new THREE.Group();
        const midCannon = hl.hock.clone().lerp(hl.fetlock, 0.65).add(V3(-0.015, 0, 0));
        g.add(
          buildSculptedLigamentBand(
            [
              hl.hock.clone().add(V3(-0.014, -0.022, 0)),
              hl.hock.clone().lerp(hl.fetlock, 0.35).add(V3(-0.015, 0, 0)),
              midCannon,
            ],
            V3(-1, 0, 0),
            0.0105,
            0.0040,
            ligSculptedMat(),
            14,
            12,
          ),
        );
        for (const brSign of [-1, 1] as const) {
          const zBr = brSign * sd;
          g.add(
            buildSculptedLigamentBand(
              [
                midCannon,
                hl.fetlock.clone().add(V3(-0.017, 0.014, 0.012 * zBr)),
                hl.fetlock.clone().add(V3(0.002, -0.018, 0.016 * zBr)),
                hl.pasternMid.clone().add(V3(0.013, 0.008, 0.006 * zBr)),
              ],
              V3(0.4, 0, zBr),
              0.0050,
              0.0021,
              ligSculptedMat(),
              14,
              10,
            ),
          );
        }
        return g;
      })(),
      side,
    );

    push(
      `equ.ske.lmp.016-${tag}`, // Ligamento anular plantar
      buildSculptedLigamentBand(
        [
          hl.fetlock.clone().add(V3(-0.013, 0.007, -0.019 * sd)),
          hl.fetlock.clone().add(V3(-0.029, 0.007, 0)),
          hl.fetlock.clone().add(V3(-0.013, 0.007, 0.019 * sd)),
        ],
        V3(-1, 0, 0),
        0.0105,
        0.0022,
        ligSculptedMat(),
        12,
        10,
      ),
      side,
    );
  }

  // Proximal tibiofibular joint (equ.ske.amp.006)
  push(
    'equ.ske.amp.006',
    buildBilateralArticular((sd) => {
      const st = hindlimbLandmarks(sd).stifle;
      const g = new THREE.Group();
      g.add(
        buildSynovialCuff(
          [
            { pos: st.clone().add(V3(-0.010, -0.016, 0.022 * sd)), rx: 0.011, ry: 0.011 },
            { pos: st.clone().add(V3(-0.014, -0.021, 0.028 * sd)), rx: 0.011, ry: 0.011 },
          ],
          capsuleMat(),
          10,
        ),
      );
      g.add(
        buildSculptedLigamentBand(
          [st.clone().add(V3(-0.005, -0.018, 0.030 * sd)), st.clone().add(V3(-0.018, -0.020, 0.028 * sd))],
          V3(0, 0, sd),
          0.0042,
          0.0016,
          ligSculptedMat(),
          6,
          8,
        ),
      );
      return g;
    }),
    'center',
  );

  // Hock joints: Tibiotarsal (amp.007), Proximal intertarsal (amp.008-i), Distal intertarsal (amp.009), Tarsometatarsal (amp.010-i)
  push(
    'equ.ske.amp.007',
    buildBilateralArticular((sd) => {
      const hk = hindlimbLandmarks(sd).hock;
      return buildSynovialCuff(
        [
          { pos: hk.clone().add(V3(0.006, 0.032, 0)), rx: 0.032, ry: 0.031 },
          { pos: hk.clone().add(V3(0.004, 0.018, 0)), rx: 0.036, ry: 0.034 },
          { pos: hk.clone().add(V3(0.002, 0.005, 0)), rx: 0.032, ry: 0.031 },
        ],
        capsuleMat(),
        14,
      );
    }),
    'center',
  );
  push(
    'equ.ske.amp.008-i', // Intertarsiana proximal (talocalcaneocentral capsule + dorsal oblique talocentral band)
    buildBilateralArticular((sd) => {
      const hk = hindlimbLandmarks(sd).hock;
      const g = new THREE.Group();
      g.add(
        buildSynovialCuff(
          [
            { pos: hk.clone().add(V3(-0.003, 0.008, 0)), rx: 0.030, ry: 0.030 },
            { pos: hk.clone().add(V3(-0.004, 0.001, 0)), rx: 0.031, ry: 0.031 },
            { pos: hk.clone().add(V3(-0.004, -0.006, 0)), rx: 0.030, ry: 0.030 },
          ],
          capsuleMat(),
          14,
        ),
      );
      g.add(
        buildSculptedLigamentBand(
          [hk.clone().add(V3(0.014, 0.012, -0.006 * sd)), hk.clone().add(V3(0.016, -0.005, -0.010 * sd))],
          V3(1, 0, -0.3 * sd),
          0.0048,
          0.0018,
          ligSculptedMat(),
          6,
          8,
        ),
      );
      return g;
    }),
    'center',
  );
  push(
    'equ.ske.amp.009', // Intertarsiana distal (centrodistal joint cuff + dorsal bands)
    buildBilateralArticular((sd) => {
      const hk = hindlimbLandmarks(sd).hock;
      const g = new THREE.Group();
      g.add(
        buildSynovialCuff(
          [
            { pos: hk.clone().add(V3(-0.003, -0.004, 0)), rx: 0.029, ry: 0.029 },
            { pos: hk.clone().add(V3(-0.003, -0.010, 0)), rx: 0.030, ry: 0.030 },
            { pos: hk.clone().add(V3(-0.003, -0.015, 0)), rx: 0.028, ry: 0.028 },
          ],
          capsuleMat(),
          14,
        ),
      );
      g.add(
        buildSculptedLigamentBand(
          [hk.clone().add(V3(0.014, -0.002, 0.002 * sd)), hk.clone().add(V3(0.016, -0.017, 0.004 * sd))],
          V3(1, 0, 0),
          0.0052,
          0.0018,
          ligSculptedMat(),
          6,
          8,
        ),
      );
      return g;
    }),
    'center',
  );
  push(
    'equ.ske.amp.010-i', // Tarsometatarsiana (capsule + oblique dorsal tarsometatarsal cunean band!)
    buildBilateralArticular((sd) => {
      const hk = hindlimbLandmarks(sd).hock;
      const g = new THREE.Group();
      g.add(
        buildSynovialCuff(
          [
            { pos: hk.clone().add(V3(-0.003, -0.014, 0)), rx: 0.027, ry: 0.027 },
            { pos: hk.clone().add(V3(-0.003, -0.020, 0)), rx: 0.028, ry: 0.028 },
            { pos: hk.clone().add(V3(-0.003, -0.026, 0)), rx: 0.026, ry: 0.026 },
          ],
          capsuleMat(),
          14,
        ),
      );
      // Oblique dorsal tarsometatarsal ligament (cunean/distal tarsal -> MtIII)
      g.add(
        buildSculptedLigamentBand(
          [hk.clone().add(V3(0.012, -0.012, -0.012 * sd)), hk.clone().add(V3(0.015, -0.032, 0.004 * sd))],
          V3(1, 0, -0.2 * sd),
          0.0048,
          0.0018,
          ligSculptedMat(),
          8,
          8,
        ),
      );
      return g;
    }),
    'center',
  );

  // Hind Fetlock (amp.011-i), Pastern (amp.012-i), Coffin (amp.013-i) with integrated collateral straps
  push(
    'equ.ske.amp.011-i',
    buildBilateralArticular((sd) => {
      const f = hindlimbLandmarks(sd).fetlock;
      const g = new THREE.Group();
      g.add(
        buildSynovialCuff(
          [
            { pos: f.clone().add(V3(-0.003, 0.022, 0)), rx: 0.028, ry: 0.026 },
            { pos: f, rx: 0.033, ry: 0.029 },
            { pos: f.clone().add(V3(0.004, -0.020, 0)), rx: 0.026, ry: 0.025 },
          ],
          capsuleMat(),
          14,
        ),
      );
      for (const sSign of [-1, 1] as const) {
        g.add(
          buildSculptedLigamentBand(
            [f.clone().add(V3(0, 0.020, 0.023 * sSign * sd)), f.clone().add(V3(0.004, -0.020, 0.022 * sSign * sd))],
            V3(0, 0, sSign * sd),
            0.0048,
            0.0018,
            ligSculptedMat(),
            8,
            8,
          ),
        );
      }
      return g;
    }),
    'center',
  );
  push(
    'equ.ske.amp.012-i',
    buildBilateralArticular((sd) => {
      const p = hindlimbLandmarks(sd).pasternMid;
      const g = new THREE.Group();
      g.add(
        buildSynovialCuff(
          [
            { pos: p.clone().add(V3(-0.004, 0.013, 0)), rx: 0.024, ry: 0.023 },
            { pos: p, rx: 0.026, ry: 0.025 },
            { pos: p.clone().add(V3(0.004, -0.013, 0)), rx: 0.023, ry: 0.022 },
          ],
          capsuleMat(),
          14,
        ),
      );
      for (const sSign of [-1, 1] as const) {
        g.add(
          buildSculptedLigamentBand(
            [p.clone().add(V3(-0.005, 0.012, 0.021 * sSign * sd)), p.clone().add(V3(0.004, -0.012, 0.021 * sSign * sd))],
            V3(0, 0, sSign * sd),
            0.0040,
            0.0017,
            ligSculptedMat(),
            8,
            8,
          ),
        );
      }
      return g;
    }),
    'center',
  );
  push(
    'equ.ske.amp.013-i',
    buildBilateralArticular((sd) => {
      const cr = hindlimbLandmarks(sd).coronet;
      const g = new THREE.Group();
      g.add(
        buildSynovialCuff(
          [
            { pos: cr.clone().add(V3(-0.004, 0.011, 0)), rx: 0.023, ry: 0.025 },
            { pos: cr, rx: 0.025, ry: 0.027 },
            { pos: cr.clone().add(V3(0.004, -0.010, 0)), rx: 0.022, ry: 0.024 },
          ],
          capsuleMat(),
          14,
        ),
      );
      for (const sSign of [-1, 1] as const) {
        g.add(
          buildSculptedLigamentBand(
            [cr.clone().add(V3(-0.003, 0.010, 0.020 * sSign * sd)), cr.clone().add(V3(0.005, -0.011, 0.022 * sSign * sd))],
            V3(0, 0, sSign * sd),
            0.0042,
            0.0017,
            ligSculptedMat(),
            8,
            8,
          ),
        );
      }
      return g;
    }),
    'center',
  );
}
