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
import { createTissueMaterial } from '../materials';
import { ProceduralTextureSet } from '../textures';
import { BuiltPart } from './buildSkeletalAndArticular';
import {
  createAnatomicalExtrudedPlate,
  createMultiStationLoftTube,
  createOrganMesh,
  createTubeCurveMesh,
} from './geomHelpers';

export function buildVisceraAndNeuroParts(tex: ProceduralTextureSet): BuiltPart[] {
  const parts: BuiltPart[] = [];

  const push = (
    id: string,
    mesh: THREE.Object3D,
    side: 'left' | 'right' | 'center',
    center?: THREE.Vector3,
  ) => {
    const c =
      center ||
      (() => {
        const box = new THREE.Box3().setFromObject(mesh);
        return box.getCenter(new THREE.Vector3());
      })();
    parts.push({ id, mesh, side, center: c });
  };

  // =========================================================================
  // 1. APARATO RESPIRATORIO (res)
  // =========================================================================
  const lungMat = () => createTissueMaterial('lung', tex);
  const tracMat = () => createTissueMaterial('trachea', tex);

  push(
    'equ.res.lar.002',
    createOrganMesh(V3(0.95, 1.57, 0), [0.045, 0.04, 0.038], tracMat(), [0, 0, -0.45], 14),
    'center',
  );

  const cervTracPts = [V3(0.92, 1.54, 0), V3(0.76, 1.38, 0), V3(0.56, 1.18, 0)];
  const cervTrac = new THREE.Group();
  cervTrac.add(createTubeCurveMesh(cervTracPts, 0.024, tracMat(), 16, 12));
  const cervCurve = new THREE.CatmullRomCurve3(cervTracPts);
  for (let i = 1; i < 12; i++) {
    const p = cervCurve.getPoint(i / 12);
    const tan = cervCurve.getTangent(i / 12);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.0035, 6, 14), tracMat());
    ring.position.copy(p);
    ring.quaternion.setFromUnitVectors(V3(0, 0, 1), tan);
    cervTrac.add(ring);
  }
  push('equ.res.tra.001', cervTrac, 'center');

  const thorTracPts = [V3(0.56, 1.18, 0), V3(0.36, 1.12, 0), V3(0.20, 1.11, 0)];
  push('equ.res.tra.002', createTubeCurveMesh(thorTracPts, 0.023, tracMat(), 12, 12), 'center');

  // Bronquios y Pulmones izquierdo (-Z) y derecho (+Z) con escotadura cardíaca y vértice apical
  for (const sd of [-1, 1] as const) {
    const tag = sd === -1 ? 'i' : 'd';
    const side = sd === -1 ? 'left' : 'right';

    push(
      `equ.res.tra.007-${tag}`,
      createTubeCurveMesh([V3(0.20, 1.11, 0), V3(0.14, 1.09, 0.072 * sd)], 0.015, tracMat(), 8, 8),
      side,
    );

    const lungGrp = new THREE.Group();
    const cardiacNotchInset = sd === -1 ? 0.016 : 0.008;
    // Cranial (apical) lobe tucked cranial to heart base and medial to cranial ribs R1-R5
    lungGrp.add(
      createMultiStationLoftTube(
        [
          { pos: V3(0.50, 1.07, (0.044 + cardiacNotchInset * 0.25) * sd), rx: 0.026, ry: 0.040 },
          { pos: V3(0.41, 1.08, (0.056 + cardiacNotchInset * 0.5) * sd), rx: 0.038, ry: 0.064 },
          { pos: V3(0.32, 1.11, (0.068 + cardiacNotchInset * 0.6) * sd), rx: 0.044, ry: 0.082 },
        ],
        lungMat(),
        16,
      ),
    );
    // Main caudal (diaphragmatic) lobe with rib-arch surface modulation matching thoracic cage
    const caudalLung = createMultiStationLoftTube(
      [
        { pos: V3(0.36, 1.13, (0.068 + cardiacNotchInset) * sd), rx: 0.044, ry: 0.086 },
        { pos: V3(0.24, 1.13, 0.102 * sd), rx: 0.066, ry: 0.132 },
        { pos: V3(0.10, 1.13, 0.118 * sd), rx: 0.074, ry: 0.148 },
        { pos: V3(-0.04, 1.14, 0.112 * sd), rx: 0.068, ry: 0.135 },
        { pos: V3(-0.15, 1.16, 0.092 * sd), rx: 0.044, ry: 0.088 },
      ],
      lungMat(),
      20,
      24,
      0.032,
    );
    lungGrp.add(caudalLung);
    push(`equ.res.pul.001-${tag}`, lungGrp, side);

    push(
      `equ.res.cav.001-${tag}`,
      createTubeCurveMesh([V3(1.50, 1.41, 0.022 * sd), V3(1.24, 1.57, 0.028 * sd)], 0.022, createTissueMaterial('cavity', tex), 10, 8),
      side,
    );
  }

  // =========================================================================
  // 2. APARATO CARDIOVASCULAR Y LINFÁTICO (car)
  // =========================================================================
  const heartMat = () => createTissueMaterial('heart', tex);
  const artMat = () => createTissueMaterial('artery', tex);
  const veinMat = () => createTissueMaterial('vein', tex);
  const lymphMat = () => createTissueMaterial('lymph', tex);

  // Corazón equino (equ.car.cor.001 — conical equine heart between ribs 3–6, tilted left & caudoventrally)
  const heartGrp = new THREE.Group();
  heartGrp.add(
    createMultiStationLoftTube(
      [
        { pos: V3(0.37, 1.10, -0.018), rx: 0.072, ry: 0.082 }, // Base & coronary groove
        { pos: V3(0.35, 1.03, -0.024), rx: 0.082, ry: 0.086 }, // Left/right ventricles
        { pos: V3(0.33, 0.94, -0.028), rx: 0.058, ry: 0.062 },
        { pos: V3(0.31, 0.87, -0.03), rx: 0.028, ry: 0.03 },   // Cardiac apex near sternum
      ],
      heartMat(),
      18,
    ),
  );
  // Left & right auricles hugging the dorsal coronary base + pulmonary trunk root
  heartGrp.add(createOrganMesh(V3(0.39, 1.11, -0.058), [0.036, 0.028, 0.024], heartMat(), [0.2, 0.2, 0], 12));
  heartGrp.add(createOrganMesh(V3(0.36, 1.11, 0.032), [0.038, 0.03, 0.026], heartMat(), [-0.2, 0, 0], 12));
  heartGrp.add(createTubeCurveMesh([V3(0.36, 1.08, -0.03), V3(0.32, 1.15, -0.015), V3(0.24, 1.14, 0)], 0.016, veinMat(), 10, 8));
  push('equ.car.cor.001', heartGrp, 'center', V3(0.34, 0.99, -0.025));

  // Aorta ascendente, torácica y abdominal
  push(
    'equ.car.tpa.005',
    createTubeCurveMesh([V3(0.35, 1.08, -0.015), V3(0.36, 1.18, 0), V3(0.26, 1.24, 0)], 0.017, artMat(), 14, 10),
    'center',
  );
  push(
    'equ.car.tpa.008',
    createTubeCurveMesh([V3(0.26, 1.24, 0), V3(0.05, 1.26, -0.01), V3(-0.26, 1.27, -0.01)], 0.015, artMat(), 16, 10),
    'center',
  );
  push(
    'equ.car.tpa.009',
    createTubeCurveMesh([V3(-0.26, 1.27, -0.01), V3(-0.55, 1.28, -0.01), V3(-0.78, 1.26, 0)], 0.013, artMat(), 16, 10),
    'center',
  );

  // Vena cava craneal y caudal
  push(
    'equ.car.vtr.001',
    createTubeCurveMesh([V3(0.55, 1.16, 0.025), V3(0.38, 1.07, 0.015)], 0.014, veinMat(), 10, 8),
    'center',
  );
  push(
    'equ.car.vtr.002',
    createTubeCurveMesh([V3(-0.72, 1.24, 0.025), V3(-0.25, 1.18, 0.028), V3(0.18, 1.08, 0.022), V3(0.33, 1.05, 0.015)], 0.015, veinMat(), 18, 10),
    'center',
  );

  // Arterias y Venas intercostales dorsales (equ.car.tpa.013 & equ.car.vtr.004) + Ganglios intercostales (equ.car.lin.011)
  const intercostalArtGrp = new THREE.Group();
  const intercostalVeinGrp = new THREE.Group();
  const intercostalLymphGrp = new THREE.Group();
  for (const sd of [-1, 1] as const) {
    for (let r = 4; r <= 17; r += 2) {
      const arc = ribArcPoints(r, sd);
      if (arc.length >= 4) {
        const artPts = arc.slice(0, 5).map((p, idx) => p.clone().add(V3(-0.009, 0, -0.004 * sd * (idx === 0 ? 0 : 1))));
        const veinPts = arc.slice(0, 5).map((p, idx) => p.clone().add(V3(-0.014, 0, -0.006 * sd * (idx === 0 ? 0 : 1))));
        intercostalArtGrp.add(createTubeCurveMesh(artPts, 0.0032, artMat(), 10, 5));
        intercostalVeinGrp.add(createTubeCurveMesh(veinPts, 0.0032, veinMat(), 10, 5));
        // Lymphatic vessel & dorsal intercostal node
        const lymPts = arc.slice(0, 4).map((p) => p.clone().add(V3(-0.004, 0.003, -0.002 * sd)));
        intercostalLymphGrp.add(createTubeCurveMesh(lymPts, 0.0025, lymphMat(), 8, 5));
        intercostalLymphGrp.add(createOrganMesh(arc[1].clone().add(V3(-0.005, 0, -0.005 * sd)), [0.007, 0.006, 0.006], lymphMat(), undefined, 6));
      }
    }
  }
  push('equ.car.tpa.013', intercostalArtGrp, 'center', V3(0.05, 1.15, 0));
  push('equ.car.vtr.004', intercostalVeinGrp, 'center', V3(0.05, 1.15, 0));
  push('equ.car.lin.011', intercostalLymphGrp, 'center', V3(0.05, 1.24, 0));

  // Cisterna del quilo (equ.car.lco.002), Conducto torácico (equ.car.lco.001) & Ganglios mesentéricos craneales (equ.car.lin.028)
  push(
    'equ.car.lco.002',
    createOrganMesh(V3(-0.46, 1.27, 0.006), [0.042, 0.015, 0.014], lymphMat(), undefined, 10),
    'center',
  );
  push(
    'equ.car.lco.001',
    createTubeCurveMesh(
      [V3(-0.44, 1.27, 0.006), V3(-0.12, 1.27, 0.008), V3(0.22, 1.24, 0.01), V3(0.46, 1.18, -0.018)],
      0.005,
      lymphMat(),
      18,
      6,
    ),
    'center',
  );
  const mesLymphGrp = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const mx = -0.32 - i * 0.065;
    const my = 1.15 - Math.sin(i * 0.5) * 0.05;
    const mz = (i % 2 === 0 ? -1 : 1) * 0.045;
    mesLymphGrp.add(createOrganMesh(V3(mx, my, mz), [0.012, 0.01, 0.009], lymphMat(), undefined, 7));
    mesLymphGrp.add(createTubeCurveMesh([V3(-0.46, 1.26, 0.006), V3(mx, my, mz), V3(mx - 0.03, my - 0.12, mz * 1.4)], 0.0028, lymphMat(), 8, 5));
  }
  push('equ.car.lin.028', mesLymphGrp, 'center', V3(-0.45, 1.10, 0));

  for (const sd of [-1, 1] as const) {
    const tag = sd === -1 ? 'i' : 'd';
    const side = sd === -1 ? 'left' : 'right';
    const fl = forelimbLandmarks(sd);
    const hl = hindlimbLandmarks(sd);

    // Carótida común & Yugular externa
    push(
      `equ.car.acc.002-${tag}`,
      createTubeCurveMesh([V3(0.45, 1.16, 0.015 * sd), V3(0.75, 1.40, 0.032 * sd), V3(1.02, 1.63, 0.036 * sd)], 0.0075, artMat(), 16, 7),
      side,
    );
    push(
      `equ.car.vcc.001-${tag}`,
      createTubeCurveMesh([V3(1.02, 1.60, 0.048 * sd), V3(0.74, 1.37, 0.048 * sd), V3(0.53, 1.15, 0.028 * sd)], 0.009, veinMat(), 16, 7),
      side,
    );
    // Arteria y Vena facial (vascular notch over mandible & rostral masseter border — visible in Stages 2, 3, 4)
    push(
      `equ.car.acc.011-${tag}`,
      createTubeCurveMesh(
        [
          V3(1.02, 1.61, 0.034 * sd),
          V3(1.14, 1.495, 0.044 * sd),
          V3(1.23, 1.535, 0.060 * sd),
          V3(1.33, 1.56, 0.048 * sd),
          V3(1.44, 1.53, 0.032 * sd),
        ],
        0.0040,
        artMat(),
        14,
        6,
      ),
      side,
    );
    push(
      `equ.car.vcc.004-${tag}`,
      createTubeCurveMesh(
        [
          V3(1.02, 1.59, 0.044 * sd),
          V3(1.145, 1.488, 0.048 * sd),
          V3(1.24, 1.54, 0.062 * sd),
          V3(1.31, 1.60, 0.052 * sd),
          V3(1.42, 1.55, 0.036 * sd),
        ],
        0.0044,
        veinMat(),
        14,
        6,
      ),
      side,
    );

    // Forelimb arteries & veins (subclavian -> brachial -> median -> palmar metacarpal -> digital)
    push(
      `equ.car.amt.001-${tag}`,
      createTubeCurveMesh(
        [
          V3(0.42, 1.14, 0.03 * sd),
          fl.shoulder.clone().add(V3(-0.04, 0, -0.03 * sd)),
          fl.elbow.clone().add(V3(0, 0, -0.02 * sd)),
          fl.carpus.clone().add(V3(-0.006, 0, -0.015 * sd)),
        ],
        0.0065,
        artMat(),
        16,
        7,
      ),
      side,
    );
    push(
      `equ.car.amt.020-${tag}`,
      createTubeCurveMesh(
        [
          fl.carpus.clone().add(V3(-0.008, 0, -0.012 * sd)),
          fl.fetlock.clone().add(V3(-0.012, 0, -0.012 * sd)),
          fl.pasternMid.clone().add(V3(-0.01, 0, -0.012 * sd)),
          fl.coronet.clone().add(V3(-0.006, -0.01, -0.012 * sd)),
        ],
        0.004,
        artMat(),
        14,
        6,
      ),
      side,
    );
    push(
      `equ.car.vmt.004-${tag}`,
      createTubeCurveMesh(
        [
          fl.carpus.clone().add(V3(-0.004, 0, -0.018 * sd)),
          fl.elbow.clone().add(V3(0.008, 0, -0.024 * sd)),
          fl.shoulder.clone().add(V3(-0.02, -0.01, -0.032 * sd)),
          V3(0.50, 1.14, 0.028 * sd),
        ],
        0.0065,
        veinMat(),
        16,
        7,
      ),
      side,
    );
    push(
      `equ.car.vmt.011-${tag}`,
      createTubeCurveMesh(
        [
          fl.coronet.clone().add(V3(-0.008, -0.01, -0.015 * sd)),
          fl.pasternMid.clone().add(V3(-0.012, 0, -0.015 * sd)),
          fl.fetlock.clone().add(V3(-0.014, 0, -0.016 * sd)),
          fl.carpus.clone().add(V3(-0.004, 0, -0.018 * sd)),
        ],
        0.004,
        veinMat(),
        14,
        6,
      ),
      side,
    );

    // Hindlimb arteries & veins (external iliac -> femoral -> popliteal/tibial -> dorsal metatarsal -> digital)
    push(
      `equ.car.amp.001-${tag}`,
      createTubeCurveMesh(
        [
          V3(-0.76, 1.25, 0.02 * sd),
          hl.hip.clone().add(V3(0.03, -0.02, -0.025 * sd)),
          hl.stifle.clone().add(V3(-0.04, -0.02, -0.018 * sd)),
          hl.hock.clone().add(V3(0.01, 0, -0.014 * sd)),
        ],
        0.0075,
        artMat(),
        18,
        7,
      ),
      side,
    );
    push(
      `equ.car.amp.018-${tag}`,
      createTubeCurveMesh(
        [
          hl.hock.clone().add(V3(0.012, 0, 0.01 * sd)),
          hl.fetlock.clone().add(V3(-0.012, 0, 0.012 * sd)),
          hl.pasternMid.clone().add(V3(-0.01, 0, 0.012 * sd)),
          hl.coronet.clone().add(V3(-0.006, -0.01, 0.012 * sd)),
        ],
        0.0042,
        artMat(),
        14,
        6,
      ),
      side,
    );
    push(
      `equ.car.vmp.001-${tag}`,
      createTubeCurveMesh(
        [
          hl.stifle.clone().add(V3(-0.03, -0.02, -0.024 * sd)),
          hl.hip.clone().add(V3(0.04, -0.02, -0.03 * sd)),
          V3(-0.72, 1.23, 0.025 * sd),
        ],
        0.0075,
        veinMat(),
        14,
        7,
      ),
      side,
    );
    push(
      `equ.car.vmp.006-${tag}`,
      createTubeCurveMesh(
        [
          hl.hock.clone().add(V3(-0.012, 0, -0.016 * sd)),
          hl.stifle.clone().add(V3(-0.03, -0.05, -0.028 * sd)),
          hl.hip.clone().add(V3(0.02, -0.04, -0.03 * sd)),
        ],
        0.0052,
        veinMat(),
        14,
        6,
      ),
      side,
    );
    push(
      `equ.car.vmp.010-${tag}`,
      createTubeCurveMesh(
        [
          hl.coronet.clone().add(V3(-0.008, -0.01, -0.014 * sd)),
          hl.pasternMid.clone().add(V3(-0.012, 0, -0.014 * sd)),
          hl.fetlock.clone().add(V3(-0.014, 0, -0.015 * sd)),
          hl.hock.clone().add(V3(-0.012, 0, -0.016 * sd)),
        ],
        0.004,
        veinMat(),
        14,
        6,
      ),
      side,
    );

    // Emerald-green Lymphatic Trunks & Lymphocenters (visible in Biosphera Stages 2, 3, 4)
    push(
      `equ.car.lco.006-${tag}`,
      createTubeCurveMesh(
        [V3(1.01, 1.59, 0.052 * sd), V3(0.75, 1.38, 0.052 * sd), V3(0.50, 1.17, 0.032 * sd)],
        0.0042,
        lymphMat(),
        14,
        6,
      ),
      side,
    );
    // Ganglio parotídeo (001) & mandibular (002)
    push(
      `equ.car.lin.001-${tag}`,
      createOrganMesh(V3(1.045, 1.620, 0.062 * sd), [0.013, 0.020, 0.008], lymphMat(), [0, 0, -0.25], 10),
      side,
    );
    push(
      `equ.car.lin.002-${tag}`,
      createOrganMesh(V3(1.13, 1.522, 0.034 * sd), [0.020, 0.012, 0.010], lymphMat(), [0, 0, 0.2], 10),
      side,
    );
    // Ganglio cervical superficial / prescapular (005 — prominent emerald cluster cranial to shoulder!)
    const cervSupGrp = new THREE.Group();
    cervSupGrp.add(createOrganMesh(V3(0.495, 1.245, 0.138 * sd), [0.016, 0.040, 0.012], lymphMat(), [0, 0, -0.35], 12));
    cervSupGrp.add(createTubeCurveMesh([V3(0.495, 1.245, 0.138 * sd), V3(0.50, 1.18, 0.04 * sd)], 0.0038, lymphMat(), 8, 5));
    push(`equ.car.lin.005-${tag}`, cervSupGrp, side);

    // Ganglio axilar (009) + forelimb lymphatic vessels down to cannon/fetlock
    const axilGrp = new THREE.Group();
    axilGrp.add(createOrganMesh(fl.shoulder.clone().add(V3(-0.05, -0.04, -0.035 * sd)), [0.016, 0.016, 0.012], lymphMat(), undefined, 10));
    axilGrp.add(
      createTubeCurveMesh(
        [
          fl.fetlock.clone().add(V3(-0.008, 0, 0.012 * sd)),
          fl.carpus.clone().add(V3(-0.008, 0, 0.014 * sd)),
          fl.elbow.clone().add(V3(-0.01, 0, -0.018 * sd)),
          fl.shoulder.clone().add(V3(-0.05, -0.04, -0.035 * sd)),
          V3(0.48, 1.17, 0.028 * sd),
        ],
        0.0032,
        lymphMat(),
        18,
        6,
      ),
    );
    push(`equ.car.lin.009-${tag}`, axilGrp, side);

    // Ganglio subilíaco / prefemoral (036 — visible green cluster cranial to thigh/tensor fasciae latae!)
    const subilGrp = new THREE.Group();
    subilGrp.add(createOrganMesh(V3(-0.625, 1.13, 0.184 * sd), [0.015, 0.036, 0.012], lymphMat(), [0, 0, 0.25], 10));
    subilGrp.add(createTubeCurveMesh([V3(-0.625, 1.13, 0.184 * sd), V3(-0.68, 1.20, 0.11 * sd), V3(-0.46, 1.27, 0.012 * sd)], 0.0035, lymphMat(), 12, 6));
    push(`equ.car.lin.036-${tag}`, subilGrp, side);

    // Ganglio poplíteo (039) + hindlimb draining lymphatic vessels
    const popGrp = new THREE.Group();
    popGrp.add(createOrganMesh(hl.stifle.clone().add(V3(-0.09, -0.04, 0.006 * sd)), [0.016, 0.018, 0.014], lymphMat(), undefined, 10));
    popGrp.add(
      createTubeCurveMesh(
        [
          hl.fetlock.clone().add(V3(-0.008, 0, 0.014 * sd)),
          hl.hock.clone().add(V3(-0.01, 0, 0.015 * sd)),
          hl.stifle.clone().add(V3(-0.09, -0.04, 0.006 * sd)),
          hl.hip.clone().add(V3(-0.02, -0.03, -0.02 * sd)),
          V3(-0.72, 1.24, 0.02 * sd),
        ],
        0.0032,
        lymphMat(),
        18,
        6,
      ),
    );
    push(`equ.car.lin.039-${tag}`, popGrp, side);
  }

  // Bazo (equ.car.lor.001 — curved scythe-shaped spleen against left costal arch)
  push(
    'equ.car.lor.001',
    createMultiStationLoftTube(
      [
        { pos: V3(-0.42, 1.21, -0.160), rx: 0.016, ry: 0.064 },
        { pos: V3(-0.34, 1.11, -0.180), rx: 0.015, ry: 0.052 },
        { pos: V3(-0.24, 0.99, -0.170), rx: 0.012, ry: 0.036 },
        { pos: V3(-0.18, 0.92, -0.148), rx: 0.008, ry: 0.020 },
      ],
      createTissueMaterial('liver', tex),
      14,
    ),
    'left',
  );

  // =========================================================================
  // 3. APARATO DIGESTIVO (dig)
  // =========================================================================
  const livMat = () => createTissueMaterial('liver', tex);
  const stoMat = () => createTissueMaterial('stomach', tex);
  const intMat = () => createTissueMaterial('intestine', tex);
  const cecMat = () => createTissueMaterial('cecum', tex);
  const colMat = () => createTissueMaterial('colon', tex);
  const salMat = () => createTissueMaterial('salivary', tex);

  // Lengua (equ.dig.boc.007) & Faringe (equ.dig.fae.001) — prominent oral/pharyngeal continuity in Stage 5
  push(
    'equ.dig.boc.007',
    createMultiStationLoftTube(
      [
        { pos: V3(1.13, 1.555, 0), rx: 0.024, ry: 0.017 },
        { pos: V3(1.28, 1.505, 0), rx: 0.021, ry: 0.015 },
        { pos: V3(1.43, 1.445, 0), rx: 0.015, ry: 0.009 },
        { pos: V3(1.49, 1.425, 0), rx: 0.009, ry: 0.005 },
      ],
      stoMat(),
      14,
    ),
    'center',
  );
  push(
    'equ.dig.fae.001',
    createMultiStationLoftTube(
      [
        { pos: V3(1.13, 1.605, 0), rx: 0.032, ry: 0.028 },
        { pos: V3(1.04, 1.60, 0), rx: 0.036, ry: 0.030 },
        { pos: V3(0.96, 1.585, 0), rx: 0.028, ry: 0.024 },
      ],
      stoMat(),
      12,
    ),
    'center',
  );

  // Glándula parótida (equ.dig.boc.009-i/d) & Glándula mandibular (equ.dig.boc.010-i/d)
  for (const sd of [-1, 1] as const) {
    const tag = sd === -1 ? 'i' : 'd';
    const side = sd === -1 ? 'left' : 'right';
    const parotid = createAnatomicalExtrudedPlate(
      [
        [-0.024, -0.068], // ventral angle near linguofacial vein
        [0.018, -0.048],  // rostral border hugging mandibular ramus
        [0.026, 0.056],   // dorsal notch embracing ear base
        [-0.016, 0.062],  // caudal border along atlas wing
        [-0.03, 0.0],
      ],
      0.014,
      0.004,
      salMat(),
    );
    parotid.position.set(1.03, 1.622, 0.056 * sd);
    parotid.rotation.set(0, 0, -0.22);
    push(`equ.dig.boc.009-${tag}`, parotid, side);

    push(
      `equ.dig.boc.010-${tag}`,
      createMultiStationLoftTube(
        [
          { pos: V3(1.04, 1.560, 0.036 * sd), rx: 0.012, ry: 0.014 },
          { pos: V3(1.10, 1.522, 0.034 * sd), rx: 0.014, ry: 0.015 },
          { pos: V3(1.155, 1.502, 0.030 * sd), rx: 0.010, ry: 0.011 },
        ],
        salMat(),
        10,
      ),
      side,
    );
  }

  push(
    'equ.dig.eso.001',
    createTubeCurveMesh([V3(0.95, 1.58, -0.015), V3(0.75, 1.40, -0.028), V3(0.55, 1.20, -0.022)], 0.013, stoMat(), 16, 8),
    'left',
  );
  push(
    'equ.dig.eso.002',
    createTubeCurveMesh([V3(0.55, 1.20, -0.022), V3(0.20, 1.18, -0.015), V3(-0.14, 1.13, -0.05)], 0.013, stoMat(), 16, 8),
    'left',
  );

  // Hígado (equ.dig.hig.001 — right, quadrate & left lobes hugging diaphragm)
  const liverGrp = new THREE.Group();
  liverGrp.add(createOrganMesh(V3(-0.16, 1.07, 0.088), [0.095, 0.145, 0.068], livMat(), [0.15, 0, -0.32], 16));
  liverGrp.add(createOrganMesh(V3(-0.13, 0.96, 0.02), [0.075, 0.095, 0.065], livMat(), [0, 0, -0.25], 14));
  liverGrp.add(createOrganMesh(V3(-0.14, 1.01, -0.055), [0.08, 0.125, 0.055], livMat(), [-0.15, 0, -0.25], 14));
  push('equ.dig.hig.001', liverGrp, 'center', V3(-0.14, 1.02, 0.02));

  // Estómago (equ.dig.est.001 — true J-shaped equine stomach with saccus caecus & pylorus)
  push(
    'equ.dig.est.001',
    createMultiStationLoftTube(
      [
        { pos: V3(-0.24, 1.16, -0.115), rx: 0.055, ry: 0.055 }, // Saccus caecus blind dorsal dome
        { pos: V3(-0.23, 1.08, -0.105), rx: 0.078, ry: 0.068 }, // Body
        { pos: V3(-0.18, 1.01, -0.055), rx: 0.056, ry: 0.052 }, // Pyloric curvature
        { pos: V3(-0.17, 1.05, 0.025), rx: 0.028, ry: 0.028 },  // Pylorus toward duodenum right
      ],
      stoMat(),
      16,
    ),
    'left',
  );

  // Ciego (equ.dig.cie.001 — comma-shaped vat on RIGHT flank +Z with haustral sacculations!)
  push(
    'equ.dig.cie.001',
    createMultiStationLoftTube(
      [
        { pos: V3(-0.66, 1.22, 0.122), rx: 0.068, ry: 0.072 }, // Base of cecum (right paralumbar fossa)
        { pos: V3(-0.55, 1.13, 0.138), rx: 0.066, ry: 0.070 },
        { pos: V3(-0.41, 1.01, 0.135), rx: 0.062, ry: 0.064 }, // Cecal body
        { pos: V3(-0.26, 0.92, 0.105), rx: 0.048, ry: 0.050 },
        { pos: V3(-0.14, 0.88, 0.042), rx: 0.030, ry: 0.030 }, // Apex at sternal xiphoid
      ],
      cecMat(),
      16,
      16,
      0.085,
    ),
    'right',
  );

  // Colon mayor ascendente (equ.dig.col.001 — double horseshoe with pelvic flexure & haustra!)
  push(
    'equ.dig.col.001',
    createMultiStationLoftTube(
      [
        { pos: V3(-0.44, 0.95, 0.082), rx: 0.052, ry: 0.052 },  // Right ventral colon
        { pos: V3(-0.18, 0.91, 0.080), rx: 0.052, ry: 0.052 },
        { pos: V3(-0.08, 0.92, 0.0), rx: 0.048, ry: 0.048 },    // Sternal flexure
        { pos: V3(-0.18, 0.92, -0.088), rx: 0.052, ry: 0.050 }, // Left ventral colon
        { pos: V3(-0.48, 0.95, -0.115), rx: 0.050, ry: 0.048 },
        { pos: V3(-0.65, 1.02, -0.090), rx: 0.028, ry: 0.028 }, // Narrow Pelvic Flexure!
        { pos: V3(-0.52, 1.06, -0.098), rx: 0.040, ry: 0.040 }, // Left dorsal colon
        { pos: V3(-0.22, 1.04, -0.072), rx: 0.046, ry: 0.046 },
        { pos: V3(-0.16, 1.02, 0.052), rx: 0.056, ry: 0.056 },  // Diaphragmatic flexure
        { pos: V3(-0.48, 1.07, 0.062), rx: 0.068, ry: 0.065 },  // Large Right Dorsal Colon ampulla!
      ],
      colMat(),
      14,
      26,
      0.065,
    ),
    'center',
  );

  // Yeyuno / Intestino delgado (equ.dig.int.002 — coiled loops in dorsal-left flank -Z)
  push(
    'equ.dig.int.002',
    createTubeCurveMesh(
      [
        V3(-0.34, 1.15, -0.09),
        V3(-0.44, 1.09, -0.13),
        V3(-0.54, 1.16, -0.08),
        V3(-0.62, 1.08, -0.12),
        V3(-0.68, 1.15, -0.06),
        V3(-0.58, 1.18, 0.02),
      ],
      0.022,
      intMat(),
      30,
      9,
    ),
    'left',
  );

  push(
    'equ.dig.rec.001',
    createTubeCurveMesh([V3(-0.72, 1.22, 0), V3(-0.96, 1.21, 0)], 0.018, colMat(), 10, 10),
    'center',
  );

  // =========================================================================
  // 4. SISTEMA NERVIOSO (ner)
  // =========================================================================
  const brainMat = () => createTissueMaterial('brain', tex);
  const nerveMat = () => createTissueMaterial('nerve', tex);

  push('equ.ner.enc.001', createOrganMesh(V3(1.13, 1.72, 0), [0.062, 0.044, 0.048], brainMat(), [0, 0, -0.3], 18), 'center');
  push('equ.ner.met.008', createOrganMesh(V3(1.06, 1.72, 0), [0.028, 0.026, 0.032], brainMat(), undefined, 14), 'center');

  const spinePts: THREE.Vector3[] = [V3(1.04, 1.72, 0)];
  for (let c = 1; c <= 7; c++) spinePts.push(V3(...cervicalPos(c)));
  for (let t = 1; t <= 18; t += 2) spinePts.push(V3(...thoracicPos(t)));
  for (let l = 1; l <= 6; l += 2) spinePts.push(V3(...lumbarPos(l)));
  spinePts.push(V3(...sacralPos(2)), V3(...caudalPos(1)));
  push('equ.ner.med.001', createTubeCurveMesh(spinePts, 0.011, nerveMat(), 42, 8), 'center');

  for (const sd of [-1, 1] as const) {
    const tag = sd === -1 ? 'i' : 'd';
    const side = sd === -1 ? 'left' : 'right';
    const fl = forelimbLandmarks(sd);
    const hl = hindlimbLandmarks(sd);

    // Plexo braquial & Nervio mediano/palmar medial hasta el menudillo
    push(
      `equ.ner.bra.001-${tag}`,
      createTubeCurveMesh([V3(0.56, 1.24, 0.02 * sd), fl.shoulder.clone().add(V3(-0.04, 0.04, -0.02 * sd)), fl.elbow, fl.carpus], 0.0055, nerveMat(), 20, 6),
      side,
    );
    push(
      `equ.ner.bra.006-${tag}`,
      createTubeCurveMesh(
        [
          fl.shoulder.clone().add(V3(-0.02, -0.04, -0.015 * sd)),
          fl.elbow.clone().add(V3(-0.006, 0, -0.016 * sd)),
          fl.carpus.clone().add(V3(-0.01, 0, -0.012 * sd)),
        ],
        0.0042,
        nerveMat(),
        14,
        6,
      ),
      side,
    );
    push(
      `equ.ner.bra.022-${tag}`,
      createTubeCurveMesh(
        [
          fl.carpus.clone().add(V3(-0.01, 0, -0.01 * sd)),
          fl.fetlock.clone().add(V3(-0.014, 0, -0.01 * sd)),
          fl.pasternMid.clone().add(V3(-0.012, 0, -0.01 * sd)),
          fl.coronet.clone().add(V3(-0.008, -0.008, -0.01 * sd)),
        ],
        0.0036,
        nerveMat(),
        14,
        6,
      ),
      side,
    );

    // Nervio ciático, tibial & plantar medial hasta el menudillo
    push(
      `equ.ner.lum.010-${tag}`,
      createTubeCurveMesh([V3(-0.76, 1.30, 0.02 * sd), hl.hip.clone().add(V3(-0.04, 0.02, -0.02 * sd)), hl.stifle.clone().add(V3(-0.08, -0.04, 0)), hl.hock], 0.0065, nerveMat(), 22, 6),
      side,
    );
    push(
      `equ.ner.lum.011-${tag}`,
      createTubeCurveMesh(
        [
          hl.stifle.clone().add(V3(-0.06, -0.03, -0.01 * sd)),
          hl.hock.clone().add(V3(-0.014, 0, -0.012 * sd)),
        ],
        0.0045,
        nerveMat(),
        12,
        6,
      ),
      side,
    );
    push(
      `equ.ner.lum.017-${tag}`,
      createTubeCurveMesh(
        [
          hl.hock.clone().add(V3(-0.014, 0, -0.01 * sd)),
          hl.fetlock.clone().add(V3(-0.015, 0, -0.01 * sd)),
          hl.pasternMid.clone().add(V3(-0.012, 0, -0.01 * sd)),
          hl.coronet.clone().add(V3(-0.008, -0.008, -0.01 * sd)),
        ],
        0.0036,
        nerveMat(),
        14,
        6,
      ),
      side,
    );

    // Nervio trigémino (V), facial (VII) y vago (X)
    const trigGrp = new THREE.Group();
    trigGrp.add(createTubeCurveMesh([V3(1.10, 1.69, 0.030 * sd), V3(1.22, 1.64, 0.048 * sd), V3(1.38, 1.56, 0.042 * sd), V3(1.47, 1.46, 0.028 * sd)], 0.0036, nerveMat(), 14, 6));
    trigGrp.add(createTubeCurveMesh([V3(1.10, 1.67, 0.030 * sd), V3(1.18, 1.54, 0.046 * sd), V3(1.38, 1.46, 0.032 * sd)], 0.0034, nerveMat(), 12, 6));
    push(`equ.ner.cra.007-${tag}`, trigGrp, side);

    push(
      `equ.ner.cra.048-${tag}`,
      createTubeCurveMesh([V3(1.06, 1.68, 0.038 * sd), V3(1.12, 1.59, 0.058 * sd), V3(1.25, 1.56, 0.064 * sd), V3(1.41, 1.52, 0.042 * sd)], 0.0036, nerveMat(), 14, 6),
      side,
    );
    push(
      `equ.ner.cra.077-${tag}`,
      createTubeCurveMesh([V3(1.06, 1.69, 0.025 * sd), V3(0.75, 1.40, 0.025 * sd), V3(0.36, 1.16, 0.02 * sd), V3(-0.15, 1.12, 0.015 * sd)], 0.0045, nerveMat(), 20, 6),
      side,
    );
  }

  // =========================================================================
  // 5. APARATO URINARIO (uri)
  // =========================================================================
  const kidMat = () => createTissueMaterial('kidney', tex);
  const bladMat = () => createTissueMaterial('bladder', tex);

  // Riñón izquierdo (equ.uri.rin.001-i — true bean-shaped equine left kidney at L1-L4!)
  push(
    'equ.uri.rin.001-i',
    createMultiStationLoftTube(
      [
        { pos: V3(-0.46, 1.25, -0.075), rx: 0.032, ry: 0.028 },
        { pos: V3(-0.51, 1.255, -0.095), rx: 0.046, ry: 0.036 },
        { pos: V3(-0.57, 1.25, -0.078), rx: 0.032, ry: 0.028 },
      ],
      kidMat(),
      14,
    ),
    'left',
  );

  // Riñón derecho (equ.uri.rin.001-d — true heart / playing-card-shaped equine right kidney at T16-L1!)
  const rightKidneyPlate = createAnatomicalExtrudedPlate(
    [
      [-0.055, -0.01], // caudal apex
      [-0.04, 0.048],  // lateral convex border
      [0.042, 0.054],  // cranial lobe
      [0.06, 0.005],   // cranial notch
      [0.042, -0.046], // medial hilus indentation
      [-0.02, -0.038],
    ],
    0.045,
    0.014,
    kidMat(),
  );
  rightKidneyPlate.rotation.x = Math.PI / 2;
  rightKidneyPlate.position.set(-0.40, 1.26, 0.085);
  push('equ.uri.rin.001-d', rightKidneyPlate, 'right');

  push('equ.uri.ure.001-i', createTubeCurveMesh([V3(-0.54, 1.23, -0.06), V3(-0.84, 1.17, -0.03), V3(-0.92, 1.13, -0.015)], 0.0045, bladMat(), 12, 6), 'left');
  push('equ.uri.ure.001-d', createTubeCurveMesh([V3(-0.42, 1.24, 0.065), V3(-0.84, 1.17, 0.03), V3(-0.92, 1.13, 0.015)], 0.0045, bladMat(), 12, 6), 'right');
  push('equ.uri.vej.001', createOrganMesh(V3(-0.90, 1.12, 0), [0.07, 0.055, 0.052], bladMat(), undefined, 16), 'center');

  // =========================================================================
  // 6. APARATO REPRODUCTOR (rep — con filtro automático m / f)
  // =========================================================================
  const repMat = () => createTissueMaterial('repro', tex);
  push('equ.rep.tes.001-i', createOrganMesh(V3(-0.78, 0.985, -0.028), [0.036, 0.024, 0.022], repMat(), undefined, 14), 'left');
  push('equ.rep.tes.001-d', createOrganMesh(V3(-0.78, 0.985, 0.028), [0.036, 0.024, 0.022], repMat(), undefined, 14), 'right');
  push('equ.rep.pen.001', createTubeCurveMesh([V3(-0.94, 1.07, 0), V3(-0.78, 0.99, 0), V3(-0.56, 0.94, 0)], 0.016, repMat(), 14, 10), 'center');

  push('equ.rep.ova.001-i', createOrganMesh(V3(-0.70, 1.17, -0.09), [0.032, 0.024, 0.022], repMat(), undefined, 12), 'left');
  push('equ.rep.ova.001-d', createOrganMesh(V3(-0.70, 1.17, 0.09), [0.032, 0.024, 0.022], repMat(), undefined, 12), 'right');
  const uteGrp = new THREE.Group();
  uteGrp.add(createOrganMesh(V3(-0.84, 1.16, 0), [0.08, 0.038, 0.038], repMat(), undefined, 14));
  uteGrp.add(createTubeCurveMesh([V3(-0.78, 1.17, 0), V3(-0.70, 1.17, -0.08)], 0.018, repMat(), 8, 8));
  uteGrp.add(createTubeCurveMesh([V3(-0.78, 1.17, 0), V3(-0.70, 1.17, 0.08)], 0.018, repMat(), 8, 8));
  push('equ.rep.ute.001', uteGrp, 'center', V3(-0.80, 1.16, 0));

  // =========================================================================
  // 7. SISTEMA ENDOCRINO (end) & SENSORIAL (sen)
  // =========================================================================
  const endMat = () => createTissueMaterial('endocrine', tex);
  const eyeMat = () => createTissueMaterial('eye', tex);

  push('equ.end.hip.001', createOrganMesh(V3(1.13, 1.67, 0), [0.014, 0.012, 0.012], endMat(), undefined, 10), 'center');
  push('equ.end.tir.001', createOrganMesh(V3(0.89, 1.52, 0), [0.022, 0.018, 0.03], endMat(), undefined, 12), 'center');
  push('equ.end.sup.001-i', createOrganMesh(V3(-0.44, 1.27, -0.055), [0.022, 0.012, 0.012], endMat(), undefined, 10), 'left');
  push('equ.end.sup.001-d', createOrganMesh(V3(-0.33, 1.28, 0.06), [0.022, 0.012, 0.012], endMat(), undefined, 10), 'right');

  push(
    'equ.sen.ocu.001-i',
    createOrganMesh(
      V3(1.195, 1.695, -0.058),
      [0.016, 0.018, 0.015],
      eyeMat(),
      [0, Math.PI / 2 - 0.26, 0.06],
      20,
    ),
    'left',
  );
  push(
    'equ.sen.ocu.001-d',
    createOrganMesh(
      V3(1.195, 1.695, 0.058),
      [0.016, 0.018, 0.015],
      eyeMat(),
      [0, -Math.PI / 2 + 0.26, 0.06],
      20,
    ),
    'right',
  );

  return parts;
}
