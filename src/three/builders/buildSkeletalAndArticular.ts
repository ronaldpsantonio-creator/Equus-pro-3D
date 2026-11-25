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
import {
  createAnatomicalExtrudedPlate,
  createAnatomicalLongBoneMesh,
  createCoffinBoneMesh,
  createFacetedTarsalOrCarpalBlock,
  createFlatRibMesh,
  createLongBoneMesh,
  createMultiStationLoftTube,
  createOrganMesh,
  createTubeCurveMesh,
} from './geomHelpers';

export type BuiltPart = {
  id: string;
  mesh: THREE.Object3D;
  side: 'left' | 'right' | 'center';
  center: THREE.Vector3;
};

function makeSideMarked(obj: THREE.Object3D, side: 'left' | 'right'): THREE.Object3D {
  obj.traverse((ch) => {
    ch.userData.side = side;
  });
  return obj;
}

export function buildSkeletalAndArticularParts(tex: ProceduralTextureSet): BuiltPart[] {
  const parts: BuiltPart[] = [];
  const boneMat = () => createTissueMaterial('bone', tex);
  const darkBoneMat = () => createTissueMaterial('bone_dark', tex);
  const teethMat = () => createTissueMaterial('teeth', tex);
  const cartMat = () => createTissueMaterial('cartilage', tex);
  const ligMat = () => createTissueMaterial('ligament', tex);

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

  // Helper for consolidated bilateral records in sistema_articular.json
  const buildBilateralArticular = (builder: (sd: -1 | 1) => THREE.Object3D): THREE.Group => {
    const g = new THREE.Group();
    g.add(makeSideMarked(builder(-1), 'left'));
    g.add(makeSideMarked(builder(1), 'right'));
    return g;
  };

  // --- 1. CRANIUM & MANDIBLE (equ.ske.cra.*) ---
  const occipGroup = new THREE.Group();
  occipGroup.add(createOrganMesh(V3(1.03, 1.76, 0), [0.052, 0.048, 0.058], boneMat()));
  // Nuchal crest (protuberancia occipital externa) & paracondylar processes
  occipGroup.add(createOrganMesh(V3(1.005, 1.79, 0), [0.022, 0.02, 0.054], darkBoneMat(), [0, 0, -0.35], 12));
  for (const sd of [-1, 1] as const) {
    occipGroup.add(createLongBoneMesh(V3(1.02, 1.72, 0.038 * sd), V3(1.01, 1.67, 0.042 * sd), 0.008, 0.011, darkBoneMat()));
  }

  const skullMap: Array<{
    id: string;
    build: () => THREE.Object3D;
    side?: 'left' | 'right' | 'center';
  }> = [
    { id: 'equ.ske.cra.001', build: () => occipGroup }, // Occipital
    { id: 'equ.ske.cra.002', build: () => createOrganMesh(V3(1.11, 1.66, 0), [0.045, 0.03, 0.04], darkBoneMat()) },
    { id: 'equ.ske.cra.003', build: () => createOrganMesh(V3(1.17, 1.64, 0), [0.04, 0.025, 0.035], darkBoneMat()) },
    { id: 'equ.ske.cra.004', build: () => createOrganMesh(V3(1.24, 1.62, 0), [0.045, 0.04, 0.045], darkBoneMat()) },
    { id: 'equ.ske.cra.005', build: () => createOrganMesh(V3(1.09, 1.78, 0), [0.04, 0.028, 0.045], boneMat()) },
    { id: 'equ.ske.cra.016', build: () => createLongBoneMesh(V3(1.22, 1.56, 0), V3(1.44, 1.44, 0), 0.012, 0.016, darkBoneMat()) },
  ];

  for (const item of skullMap) {
    push(item.id, item.build(), item.side || 'center');
  }

  for (const sd of [-1, 1] as const) {
    const tag = sd === -1 ? 'i' : 'd';
    const side = sd === -1 ? 'left' : 'right';

    push(
      `equ.ske.cra.006-${tag}`, // Parietal (slightly vaulted cranium)
      createOrganMesh(V3(1.115, 1.755, 0.036 * sd), [0.056, 0.038, 0.032], boneMat(), [0, 0, -0.25]),
      side,
    );

    // Frontal + Supraorbital arch forming true equine upper eye orbit rim
    const frontGrp = new THREE.Group();
    frontGrp.add(createOrganMesh(V3(1.21, 1.71, 0.042 * sd), [0.075, 0.034, 0.044], boneMat(), [0, 0, -0.38]));
    frontGrp.add(
      createTubeCurveMesh(
        [V3(1.155, 1.725, 0.068 * sd), V3(1.195, 1.725, 0.088 * sd), V3(1.225, 1.695, 0.086 * sd)],
        0.011,
        boneMat(),
        10,
        8,
      ),
    );
    push(`equ.ske.cra.007-${tag}`, frontGrp, side);

    // Temporal + zygomatic process of temporal closing the postorbital bar
    const tempGrp = new THREE.Group();
    tempGrp.add(createOrganMesh(V3(1.105, 1.675, 0.064 * sd), [0.052, 0.042, 0.022], boneMat()));
    tempGrp.add(
      createTubeCurveMesh(
        [V3(1.11, 1.67, 0.072 * sd), V3(1.16, 1.66, 0.086 * sd), V3(1.205, 1.66, 0.086 * sd)],
        0.009,
        boneMat(),
        8,
        7,
      ),
    );
    push(`equ.ske.cra.008-${tag}`, tempGrp, side);

    // Nasal with curved bridge & rostral pointed nasal process (nasoincisive notch silhouette)
    const nasalGrp = new THREE.Group();
    nasalGrp.add(
      createMultiStationLoftTube(
        [
          { pos: V3(1.255, 1.652, 0.022 * sd), rx: 0.015, ry: 0.025 },
          { pos: V3(1.36, 1.575, 0.019 * sd), rx: 0.013, ry: 0.023 },
          { pos: V3(1.46, 1.502, 0.014 * sd), rx: 0.011, ry: 0.018 },
          { pos: V3(1.535, 1.448, 0.006 * sd), rx: 0.005, ry: 0.007 },
        ],
        boneMat(),
        12,
      ),
    );
    push(`equ.ske.cra.009-${tag}`, nasalGrp, side);

    push(
      `equ.ske.cra.010-${tag}`, // Lagrimal (cranial orbital margin)
      createOrganMesh(V3(1.23, 1.66, 0.066 * sd), [0.032, 0.026, 0.016], boneMat()),
      side,
    );

    // Cigomático (lower orbital rim bridging into facial crest)
    push(
      `equ.ske.cra.011-${tag}`,
      createTubeCurveMesh(
        [V3(1.155, 1.645, 0.084 * sd), V3(1.205, 1.645, 0.085 * sd), V3(1.265, 1.575, 0.070 * sd)],
        0.013,
        boneMat(),
        12,
        8,
      ),
      side,
    );

    // Maxilar + cresta facial + diastema + arcada premolar/molar superior
    push(
      `equ.ske.cra.012-${tag}`,
      (() => {
        const g = new THREE.Group();
        g.add(
          createMultiStationLoftTube(
            [
              { pos: V3(1.23, 1.545, 0.052 * sd), rx: 0.034, ry: 0.048 },
              { pos: V3(1.33, 1.488, 0.046 * sd), rx: 0.031, ry: 0.042 },
              { pos: V3(1.42, 1.435, 0.036 * sd), rx: 0.024, ry: 0.032 },
              { pos: V3(1.48, 1.402, 0.028 * sd), rx: 0.019, ry: 0.024 },
            ],
            boneMat(),
            14,
          ),
        );
        // Cresta facial equina prominente
        g.add(createLongBoneMesh(V3(1.195, 1.592, 0.073 * sd), V3(1.345, 1.515, 0.062 * sd), 0.009, 0.012, darkBoneMat(), 0.5));
        for (let m = 0; m < 6; m++) {
          const mt = m / 5;
          g.add(
            createOrganMesh(
              V3(THREE.MathUtils.lerp(1.22, 1.35, mt), THREE.MathUtils.lerp(1.50, 1.44, mt), 0.035 * sd),
              [0.011, 0.014, 0.01],
              teethMat(),
              [0, 0, -0.45],
              8,
            ),
          );
        }
        return g;
      })(),
      side,
    );

    // Incisivo (premaxila + incisivos I1-I3)
    push(
      `equ.ske.cra.013-${tag}`,
      (() => {
        const g = new THREE.Group();
        g.add(createOrganMesh(V3(1.51, 1.38, 0.022 * sd), [0.048, 0.025, 0.021], boneMat(), [0, 0, -0.45]));
        for (let inc = 0; inc < 3; inc++) {
          g.add(
            createOrganMesh(
              V3(1.545 - inc * 0.008, 1.355, (0.008 + inc * 0.012) * sd),
              [0.007, 0.012, 0.006],
              teethMat(),
              [0, 0, -0.2],
              8,
            ),
          );
        }
        return g;
      })(),
      side,
    );

    push(`equ.ske.cra.014-${tag}`, createOrganMesh(V3(1.30, 1.50, 0.025 * sd), [0.045, 0.014, 0.02], darkBoneMat()), side);
    push(`equ.ske.cra.015-${tag}`, createOrganMesh(V3(1.18, 1.57, 0.025 * sd), [0.028, 0.016, 0.014], darkBoneMat()), side);

    // Hemimandíbula: extruded wide equine mandibular ramus + coronoid process + body + dentition
    push(
      `equ.ske.cra.017-${tag}`,
      (() => {
        const g = new THREE.Group();
        // Extruded vertical ramus + broad gonial angle + coronoid process
        const mandiblePlate = createAnatomicalExtrudedPlate(
          [
            [-0.08, -0.02], // gonion angle
            [0.06, -0.04],  // ventral mandibular curve
            [0.34, -0.18],  // symphyseal body
            [0.36, -0.14],  // alveolar diastema border
            [0.14, -0.02],  // molar alveolar border
            [0.02, 0.14],   // coronoid process tip
            [-0.03, 0.12],  // condylar process (TMJ)
            [-0.09, 0.04],  // caudal border of ramus
          ],
          0.022,
          0.005,
          boneMat(),
        );
        mandiblePlate.position.set(1.12, 1.53, 0.056 * sd);
        mandiblePlate.rotation.y = -0.14 * sd;
        g.add(mandiblePlate);

        for (let m = 0; m < 6; m++) {
          const mt = m / 5;
          g.add(
            createOrganMesh(
              V3(THREE.MathUtils.lerp(1.20, 1.33, mt), THREE.MathUtils.lerp(1.48, 1.42, mt), 0.034 * sd),
              [0.01, 0.013, 0.009],
              teethMat(),
              [0, 0, -0.45],
              8,
            ),
          );
        }
        for (let inc = 0; inc < 3; inc++) {
          g.add(
            createOrganMesh(
              V3(1.51 - inc * 0.008, 1.335, (0.008 + inc * 0.011) * sd),
              [0.007, 0.011, 0.006],
              teethMat(),
              [0, 0, -0.7],
              8,
            ),
          );
        }
        return g;
      })(),
      side,
    );

    // Hyoid apparatus (equ.ske.oid.001..005)
    for (let h = 1; h <= 5; h++) {
      const hy = 1.60 - h * 0.022;
      const hx = 1.07 + h * 0.014;
      push(
        `equ.ske.oid.00${h}-${tag}`,
        createLongBoneMesh(V3(hx, hy + 0.014, 0.042 * sd), V3(hx + 0.02, hy - 0.01, 0.024 * sd), 0.008, 0.011, darkBoneMat()),
        side,
      );
    }
  }

  // --- 2. VERTEBRAL COLUMN (C1-C7, T1-T18, L1-L6, S1-S5, Caudal) ---
  for (let c = 1; c <= 7; c++) {
    const [x, y] = cervicalPos(c);
    const id = `equ.ske.cer.00${c}`;
    const g = new THREE.Group();

    if (c === 1) {
      // Atlas (C1): broad dorsal/ventral ring + sculpted wide wings (ala atlantis)
      g.add(createOrganMesh(V3(x, y, 0), [0.038, 0.036, 0.042], boneMat(), [0, 0, -0.4], 14));
      const wing = createAnatomicalExtrudedPlate(
        [
          [-0.045, -0.058],
          [0.038, -0.052],
          [0.048, 0],
          [0.038, 0.052],
          [-0.045, 0.058],
          [-0.055, 0],
        ],
        0.016,
        0.005,
        boneMat(),
      );
      wing.rotation.x = Math.PI / 2;
      wing.rotation.y = -0.35;
      wing.position.set(x, y + 0.004, 0);
      g.add(wing);
    } else if (c === 2) {
      // Axis (C2): elongated vertebral body + cranial dens (odontoid process) + dorsal spinous crest
      g.add(createLongBoneMesh(V3(x - 0.038, y - 0.015, 0), V3(x + 0.038, y + 0.018, 0), 0.028, 0.034, boneMat(), 0.85));
      g.add(createLongBoneMesh(V3(x + 0.03, y + 0.014, 0), V3(x + 0.068, y + 0.03, 0), 0.012, 0.016, darkBoneMat(), 0.9)); // Dens
      const crest = createAnatomicalExtrudedPlate(
        [
          [-0.045, 0],
          [0.04, 0.012],
          [0.025, 0.046],
          [-0.04, 0.038],
        ],
        0.014,
        0.004,
        boneMat(),
      );
      crest.position.set(x - 0.005, y + 0.026, 0);
      crest.rotation.z = -0.42;
      g.add(crest);
    } else {
      // C3-C7: body + neural arch + cranial/caudal articular processes + ventral crest
      g.add(createLongBoneMesh(V3(x - 0.036, y - 0.012, 0), V3(x + 0.036, y + 0.012, 0), 0.027, 0.035, boneMat(), 0.85));
      g.add(createOrganMesh(V3(x, y + 0.026, 0), [0.032, 0.016, 0.038], darkBoneMat(), [0, 0, -0.35], 12));
      g.add(createLongBoneMesh(V3(x, y - 0.01, -0.052), V3(x, y - 0.01, 0.052), 0.009, 0.012, darkBoneMat()));
    }
    push(id, g, 'center', V3(x, y, 0));
  }

  for (let t = 1; t <= 18; t++) {
    const [x, y] = thoracicPos(t);
    const id = `equ.ske.tor.${String(t).padStart(3, '0')}`;
    const g = new THREE.Group();
    g.add(createOrganMesh(V3(x, y, 0), [0.028, 0.028, 0.032], boneMat(), undefined, 12));
    // Neural arch + costal transverse facets
    g.add(createOrganMesh(V3(x, y + 0.025, 0), [0.022, 0.018, 0.042], darkBoneMat(), undefined, 10));
    // Tall equine withers spinous processes peaking T4-T7
    const witherFactor = Math.exp(-Math.pow((t - 5.2) / 4.0, 2));
    const spineH = 0.07 + 0.175 * witherFactor;
    const tiltX = t <= 14 ? -0.038 : 0.01; // anticlinal around T15-T16
    const sp = createLongBoneMesh(
      V3(x, y + 0.02, 0),
      V3(x + tiltX, y + 0.02 + spineH, 0),
      0.01,
      0.015,
      boneMat(),
      0.5,
    );
    g.add(sp);
    push(id, g, 'center', V3(x, y + spineH * 0.35, 0));
  }

  for (let l = 1; l <= 6; l++) {
    const [x, y] = lumbarPos(l);
    const id = `equ.ske.lum.${String(l).padStart(3, '0')}`;
    const g = new THREE.Group();
    g.add(createOrganMesh(V3(x, y, 0), [0.03, 0.029, 0.036], boneMat(), undefined, 12));
    g.add(createOrganMesh(V3(x, y + 0.024, 0), [0.022, 0.018, 0.036], darkBoneMat(), undefined, 10));
    // Characteristic flat broad equine lumbar transverse processes
    const transSpan = 0.09 + (l <= 4 ? 0.025 : 0.01);
    const transPlate = createAnatomicalExtrudedPlate(
      [
        [-0.018, -transSpan],
        [0.018, -transSpan * 0.92],
        [0.022, transSpan * 0.92],
        [-0.018, transSpan],
      ],
      0.008,
      0.003,
      boneMat(),
    );
    transPlate.rotation.x = Math.PI / 2;
    transPlate.position.set(x, y + 0.012, 0);
    g.add(transPlate);
    g.add(createLongBoneMesh(V3(x, y + 0.02, 0), V3(x + 0.012, y + 0.095, 0), 0.011, 0.015, boneMat(), 0.45));
    push(id, g, 'center', V3(x, y, 0));
  }

  for (let s = 1; s <= 5; s++) {
    const [x, y] = sacralPos(s);
    const id = `equ.ske.sac.${String(s).padStart(3, '0')}`;
    const g = new THREE.Group();
    const wingW = Math.max(0.028, 0.088 - s * 0.014);
    g.add(createOrganMesh(V3(x, y, 0), [0.028, 0.026, wingW], boneMat(), undefined, 10));
    g.add(createLongBoneMesh(V3(x, y + 0.015, 0), V3(x - 0.022, y + 0.082 - s * 0.008, 0), 0.01, 0.013, boneMat(), 0.48));
    push(id, g, 'center', V3(x, y, 0));
  }

  for (let ca = 1; ca <= 18; ca++) {
    const [x, y] = caudalPos(ca);
    const id = `equ.ske.cau.${String(ca).padStart(3, '0')}`;
    const r = Math.max(0.007, 0.021 - ca * 0.0008);
    push(id, createOrganMesh(V3(x, y, 0), [0.018, r, r], boneMat(), [0, 0, 0.45], 10), 'center');
  }

  // --- 3. RIBCAGE & STERNUM (flattened equine costal blades) ---
  for (let r = 1; r <= 18; r++) {
    for (const sd of [-1, 1] as const) {
      const tag = sd === -1 ? 'i' : 'd';
      const side = sd === -1 ? 'left' : 'right';
      const pts = ribArcPoints(r, sd);
      const id = `equ.ske.cos.${String(r).padStart(3, '0')}-${tag}`;
      const g = new THREE.Group();
      const widthScale = r <= 7 ? 1.12 : r >= 15 ? 0.84 : 1.0;
      g.add(createFlatRibMesh(pts.slice(0, 4), 0.014 * widthScale, 0.0072, boneMat(), 18, 10));
      g.add(createFlatRibMesh(pts.slice(3), 0.0105, 0.0062, cartMat(), 8, 8));
      push(id, g, side, pts[2]);
    }
  }

  // Keeled equine Sternum (equ.ske.ste.001)
  push(
    'equ.ske.ste.001',
    (() => {
      const g = new THREE.Group();
      g.add(createLongBoneMesh(V3(0.47, 0.87, 0), V3(-0.08, 0.83, 0), 0.03, 0.04, boneMat(), 0.6));
      g.add(createOrganMesh(V3(0.48, 0.89, 0), [0.032, 0.034, 0.02], cartMat(), undefined, 10)); // Manubrium / cariniform cartilage
      return g;
    })(),
    'center',
  );

  // --- 4. FORELIMBS & HINDLIMBS (equ.ske.mto.* & equ.ske.mpe.*) ---
  for (const sd of [-1, 1] as const) {
    const tag = sd === -1 ? 'i' : 'd';
    const side = sd === -1 ? 'left' : 'right';
    const fl = forelimbLandmarks(sd);

    // Scapula (equ.ske.mto.001-i/d): sculpted triangular blade + dorsal scapular cartilage + spine + tuber spinae
    const scap = new THREE.Group();
    const scapDir = new THREE.Vector3().subVectors(fl.scapulaTop, fl.shoulder);
    const scapLen = scapDir.length();
    const scapMid = fl.shoulder.clone().addScaledVector(scapDir, 0.5);
    const scapBlade = createAnatomicalExtrudedPlate(
      [
        [-0.032, 0.0],             // glenoid neck
        [-0.088, scapLen * 0.86],  // caudal angle
        [0.0, scapLen * 0.96],     // dorsal border
        [0.072, scapLen * 0.80],   // cranial angle
        [0.038, 0.04],             // supraglenoid tubercle
      ],
      0.016,
      0.005,
      boneMat(),
    );
    scapBlade.position.copy(fl.shoulder);
    scapBlade.quaternion.setFromUnitVectors(V3(0, 1, 0), scapDir.clone().normalize());
    scap.add(scapBlade);

    // Dorsal scapular cartilage
    const scapCart = createAnatomicalExtrudedPlate(
      [
        [-0.09, scapLen * 0.84],
        [-0.01, scapLen * 1.12],
        [0.074, scapLen * 0.80],
        [0.0, scapLen * 0.94],
      ],
      0.012,
      0.004,
      cartMat(),
    );
    scapCart.position.copy(fl.shoulder);
    scapCart.quaternion.setFromUnitVectors(V3(0, 1, 0), scapDir.clone().normalize());
    scap.add(scapCart);

    // Spina scapulae + tuber spinae
    scap.add(
      createLongBoneMesh(
        fl.scapulaTop.clone().add(V3(-0.01, -0.02, 0.018 * sd)),
        fl.shoulder.clone().add(V3(0.0, 0.05, 0.016 * sd)),
        0.012,
        0.017,
        darkBoneMat(),
        0.7,
      ),
    );
    scap.add(createOrganMesh(scapMid.clone().add(V3(0, 0.03, 0.022 * sd)), [0.022, 0.032, 0.014], darkBoneMat(), [0, 0, 0.45], 10));
    push(`equ.ske.mto.001-${tag}`, scap, side);

    // Húmero (002) with greater tubercle, deltoid tuberosity & bicondylar trochlea
    const humGrp = new THREE.Group();
    humGrp.add(
      createAnatomicalLongBoneMesh(
        fl.shoulder,
        fl.elbow,
        {
          rMid: 0.032,
          rProxX: 0.052,
          rProxZ: 0.044,
          rDistX: 0.046,
          rDistZ: 0.042,
          bicondylarDistal: true,
          proximalTubercle: 0.014,
          cranialBow: 0.01,
          midFlattenZ: 0.82,
        },
        boneMat(),
      ),
    );
    humGrp.add(createOrganMesh(fl.shoulder.clone().add(V3(0.028, 0.015, 0.018 * sd)), [0.024, 0.026, 0.02], darkBoneMat(), undefined, 10));
    push(`equ.ske.mto.002-${tag}`, humGrp, side);

    // Radio (003) & Ulna with Olecranon (004)
    push(
      `equ.ske.mto.003-${tag}`,
      createAnatomicalLongBoneMesh(
        fl.elbow,
        fl.carpus,
        {
          rMid: 0.025,
          rProxX: 0.039,
          rProxZ: 0.034,
          rDistX: 0.038,
          rDistZ: 0.036,
          bicondylarDistal: true,
          cranialBow: 0.008,
          midFlattenZ: 0.78,
        },
        boneMat(),
      ),
      side,
    );
    const ulnaGrp = new THREE.Group();
    ulnaGrp.add(
      createLongBoneMesh(
        fl.elbow.clone().add(V3(-0.034, 0.088, 0)),
        fl.carpus.clone().add(V3(-0.014, 0.14, 0)),
        0.012,
        0.026,
        darkBoneMat(),
        0.65,
      ),
    );
    ulnaGrp.add(createOrganMesh(fl.elbow.clone().add(V3(-0.038, 0.092, 0)), [0.022, 0.028, 0.018], boneMat(), [0, 0, 0.3], 10));
    push(`equ.ske.mto.004-${tag}`, ulnaGrp, side);

    // Carpus (005..011) — faceted cuboid blocks in proximal & distal rows + accessory carpal caudal
    const carpalSpecs: Array<{ num: number; dx: number; dy: number; dz: number; size: [number, number, number] }> = [
      { num: 5, dx: 0.008, dy: 0.016, dz: -0.017, size: [0.024, 0.022, 0.018] },  // radial
      { num: 6, dx: 0.012, dy: 0.016, dz: 0.0, size: [0.024, 0.022, 0.018] },     // intermedio
      { num: 7, dx: 0.008, dy: 0.016, dz: 0.017, size: [0.022, 0.022, 0.017] },   // ulnar
      { num: 8, dx: -0.028, dy: 0.018, dz: 0.014, size: [0.028, 0.026, 0.014] },  // accesorio (caudolateral)
      { num: 9, dx: 0.005, dy: -0.013, dz: -0.016, size: [0.02, 0.016, 0.014] },  // C2
      { num: 10, dx: 0.01, dy: -0.013, dz: 0.0, size: [0.028, 0.017, 0.024] },    // C3 (large slab)
      { num: 11, dx: 0.005, dy: -0.013, dz: 0.016, size: [0.022, 0.016, 0.016] }, // C4
    ];
    for (const sp of carpalSpecs) {
      push(
        `equ.ske.mto.${String(sp.num).padStart(3, '0')}-${tag}`,
        createFacetedTarsalOrCarpalBlock(
          V3(fl.carpus.x + sp.dx, fl.carpus.y + sp.dy, fl.carpus.z + sp.dz * sd),
          sp.size,
          sp.num === 8 ? darkBoneMat() : boneMat(),
        ),
        side,
      );
    }

    // Metacarpus III "Caña" (012) & Splint bones II/IV (013, 014)
    push(
      `equ.ske.mto.012-${tag}`,
      createAnatomicalLongBoneMesh(
        fl.carpus,
        fl.fetlock,
        {
          rMid: 0.018,
          rProxX: 0.024,
          rProxZ: 0.026,
          rDistX: 0.023,
          rDistZ: 0.025,
          bicondylarDistal: true,
          midFlattenZ: 0.82,
        },
        boneMat(),
      ),
      side,
    );
    push(
      `equ.ske.mto.013-${tag}`,
      createLongBoneMesh(
        fl.carpus.clone().add(V3(-0.013, -0.01, -0.016 * sd)),
        fl.fetlock.clone().add(V3(-0.01, 0.085, -0.013 * sd)),
        0.006,
        0.009,
        darkBoneMat(),
      ),
      side,
    );
    push(
      `equ.ske.mto.014-${tag}`,
      createLongBoneMesh(
        fl.carpus.clone().add(V3(-0.013, -0.01, 0.016 * sd)),
        fl.fetlock.clone().add(V3(-0.01, 0.085, 0.013 * sd)),
        0.006,
        0.009,
        darkBoneMat(),
      ),
      side,
    );

    // Forelimb Phalanges P1, P2, P3 (015..017) & Sesamoids (018..020)
    push(
      `equ.ske.mto.015-${tag}`,
      createAnatomicalLongBoneMesh(
        fl.fetlock,
        fl.pasternMid,
        { rMid: 0.017, rProxX: 0.024, rProxZ: 0.025, rDistX: 0.021, rDistZ: 0.022, bicondylarDistal: true, midFlattenZ: 0.88 },
        boneMat(),
      ),
      side,
    );
    push(
      `equ.ske.mto.016-${tag}`,
      createAnatomicalLongBoneMesh(
        fl.pasternMid,
        fl.coronet,
        { rMid: 0.018, rProxX: 0.023, rProxZ: 0.024, rDistX: 0.022, rDistZ: 0.024, bicondylarDistal: true, midFlattenZ: 0.9 },
        boneMat(),
      ),
      side,
    );
    push(`equ.ske.mto.017-${tag}`, createCoffinBoneMesh(fl.hoofCenter.clone().add(V3(0.003, 0.006, 0)), darkBoneMat()), side);
    push(
      `equ.ske.mto.018-${tag}`, // Sesamoideo proximal medial
      createFacetedTarsalOrCarpalBlock(fl.fetlock.clone().add(V3(-0.022, 0.012, -0.012 * sd)), [0.016, 0.024, 0.012], darkBoneMat(), [0, 0, -0.3]),
      side,
    );
    push(
      `equ.ske.mto.019-${tag}`, // Sesamoideo proximal lateral
      createFacetedTarsalOrCarpalBlock(fl.fetlock.clone().add(V3(-0.022, 0.012, 0.012 * sd)), [0.016, 0.024, 0.012], darkBoneMat(), [0, 0, -0.3]),
      side,
    );
    push(
      `equ.ske.mto.020-${tag}`, // Sesamoideo distal (navicular)
      createFacetedTarsalOrCarpalBlock(fl.coronet.clone().add(V3(-0.02, -0.012, 0)), [0.012, 0.012, 0.036], darkBoneMat(), [0, 0, 0.45]),
      side,
    );

    // HINDLIMB
    const hl = hindlimbLandmarks(sd);

    // Coxal / Pelvis (equ.ske.mpe.001-i/d): sculpted extruded Ilium wing + Ischium/Pubis with real Obturator Foramen!
    const coxal = new THREE.Group();
    const coxalPlate = createAnatomicalExtrudedPlate(
      [
        [hl.tuberIschii.x, hl.tuberIschii.y + 0.02],
        [hl.tuberIschii.x + 0.05, hl.tuberIschii.y - 0.07], // ischial arch
        [hl.hip.x + 0.06, hl.hip.y - 0.085],                // pubic pecten
        [hl.hip.x + 0.03, hl.hip.y + 0.025],                // acetabular body cranial
        [hl.tuberCoxae.x + 0.06, hl.tuberCoxae.y - 0.02],   // tuber coxae lateral crest
        [hl.tuberSacrale.x - 0.02, hl.tuberSacrale.y + 0.015], // tuber sacrale dorsal
        [hl.hip.x - 0.04, hl.hip.y + 0.065],                // greater ischiatic notch
      ],
      0.022,
      0.006,
      boneMat(),
      [
        [
          [hl.hip.x - 0.11, hl.hip.y - 0.045],
          [hl.hip.x - 0.03, hl.hip.y - 0.055],
          [hl.hip.x - 0.04, hl.hip.y - 0.01],
          [hl.hip.x - 0.12, hl.hip.y - 0.005],
        ], // Real Obturator Foramen perforation!
      ],
    );
    coxalPlate.position.set(0, 0, hl.hip.z * 0.72);
    coxalPlate.rotation.y = 0.24 * sd;
    coxal.add(coxalPlate);
    // Acetabular rim cup
    coxal.add(createOrganMesh(hl.hip, [0.034, 0.034, 0.024], darkBoneMat(), undefined, 12));
    push(`equ.ske.mpe.001-${tag}`, coxal, side);

    // Fémur (002) with greater trochanter, third trochanter & bicondylar trochlea
    const femGrp = new THREE.Group();
    femGrp.add(
      createAnatomicalLongBoneMesh(
        hl.hip,
        hl.stifle,
        {
          rMid: 0.037,
          rProxX: 0.056,
          rProxZ: 0.048,
          rDistX: 0.056,
          rDistZ: 0.052,
          bicondylarDistal: true,
          proximalTubercle: 0.012,
          cranialBow: 0.014,
          midFlattenZ: 0.85,
        },
        boneMat(),
      ),
    );
    femGrp.add(createOrganMesh(hl.hip.clone().add(V3(-0.025, 0.055, 0.022 * sd)), [0.026, 0.036, 0.02], darkBoneMat(), undefined, 10)); // Trocánter mayor
    femGrp.add(createOrganMesh(hl.hip.clone().lerp(hl.stifle, 0.32).add(V3(-0.01, 0, 0.038 * sd)), [0.02, 0.026, 0.014], darkBoneMat(), undefined, 8)); // Tercer trocánter
    push(`equ.ske.mpe.002-${tag}`, femGrp, side);

    // Rótula (003) sculpted triangular wedge
    push(
      `equ.ske.mpe.003-${tag}`,
      createFacetedTarsalOrCarpalBlock(hl.stifle.clone().add(V3(0.044, 0.015, 0)), [0.032, 0.042, 0.032], darkBoneMat(), [0, 0, -0.25]),
      side,
    );
    push(
      `equ.ske.mpe.004-${tag}`,
      createAnatomicalLongBoneMesh(
        hl.stifle,
        hl.hock,
        {
          rMid: 0.026,
          rProxX: 0.048,
          rProxZ: 0.044,
          rDistX: 0.036,
          rDistZ: 0.036,
          bicondylarDistal: true,
          proximalTubercle: 0.012,
          cranialBow: 0.01,
          midFlattenZ: 0.82,
        },
        boneMat(),
      ),
      side,
    ); // Tibia
    push(
      `equ.ske.mpe.005-${tag}`, // Fíbula
      createLongBoneMesh(hl.stifle.clone().add(V3(-0.02, -0.02, 0.022 * sd)), hl.stifle.clone().add(V3(-0.08, -0.18, 0.015 * sd)), 0.007, 0.01, darkBoneMat()),
      side,
    );

    // Calcáneo (007) with tuber calcanei
    const calcGrp = new THREE.Group();
    calcGrp.add(createLongBoneMesh(hl.hock, hl.calcaneusTip, 0.02, 0.029, boneMat(), 0.65));
    calcGrp.add(createOrganMesh(hl.calcaneusTip, [0.022, 0.024, 0.018], darkBoneMat(), undefined, 10));
    push(`equ.ske.mpe.007-${tag}`, calcGrp, side);

    // Talus (006) with prominent oblique trochlear ridges
    const talusGrp = new THREE.Group();
    talusGrp.add(createFacetedTarsalOrCarpalBlock(V3(hl.hock.x + 0.008, hl.hock.y + 0.018, hl.hock.z), [0.038, 0.036, 0.034], boneMat(), [0, 0, 0.35]));
    talusGrp.add(createOrganMesh(V3(hl.hock.x + 0.018, hl.hock.y + 0.028, hl.hock.z - 0.011 * sd), [0.016, 0.02, 0.008], darkBoneMat(), [0.2 * sd, 0, 0.5], 8));
    talusGrp.add(createOrganMesh(V3(hl.hock.x + 0.018, hl.hock.y + 0.028, hl.hock.z + 0.011 * sd), [0.016, 0.02, 0.008], darkBoneMat(), [-0.2 * sd, 0, 0.5], 8));
    push(`equ.ske.mpe.006-${tag}`, talusGrp, side);

    // Distal tarsal row (008 central, 009 T1+T2, 010 T3, 011 T4)
    const tarsalDistal: Array<{ num: number; dx: number; dy: number; dz: number; size: [number, number, number] }> = [
      { num: 8, dx: 0.006, dy: -0.002, dz: -0.004, size: [0.032, 0.014, 0.032] },
      { num: 9, dx: -0.005, dy: -0.016, dz: -0.016, size: [0.022, 0.016, 0.014] },
      { num: 10, dx: 0.008, dy: -0.017, dz: 0.0, size: [0.032, 0.015, 0.026] },
      { num: 11, dx: -0.004, dy: -0.014, dz: 0.016, size: [0.024, 0.024, 0.016] },
    ];
    for (const sp of tarsalDistal) {
      push(
        `equ.ske.mpe.${String(sp.num).padStart(3, '0')}-${tag}`,
        createFacetedTarsalOrCarpalBlock(V3(hl.hock.x + sp.dx, hl.hock.y + sp.dy, hl.hock.z + sp.dz * sd), sp.size, boneMat()),
        side,
      );
    }

    // Metatarsus III (012) & Splints (013, 014)
    push(
      `equ.ske.mpe.012-${tag}`,
      createAnatomicalLongBoneMesh(
        hl.hock,
        hl.fetlock,
        {
          rMid: 0.019,
          rProxX: 0.026,
          rProxZ: 0.026,
          rDistX: 0.024,
          rDistZ: 0.025,
          bicondylarDistal: true,
          midFlattenZ: 0.82,
        },
        boneMat(),
      ),
      side,
    );
    push(
      `equ.ske.mpe.013-${tag}`,
      createLongBoneMesh(
        hl.hock.clone().add(V3(-0.013, -0.01, -0.016 * sd)),
        hl.fetlock.clone().add(V3(-0.01, 0.085, -0.013 * sd)),
        0.006,
        0.009,
        darkBoneMat(),
      ),
      side,
    );
    push(
      `equ.ske.mpe.014-${tag}`,
      createLongBoneMesh(
        hl.hock.clone().add(V3(-0.013, -0.01, 0.016 * sd)),
        hl.fetlock.clone().add(V3(-0.01, 0.085, 0.013 * sd)),
        0.006,
        0.009,
        darkBoneMat(),
      ),
      side,
    );

    // Hind Phalanges & Sesamoids (015..020)
    push(
      `equ.ske.mpe.015-${tag}`,
      createAnatomicalLongBoneMesh(
        hl.fetlock,
        hl.pasternMid,
        { rMid: 0.017, rProxX: 0.024, rProxZ: 0.025, rDistX: 0.021, rDistZ: 0.022, bicondylarDistal: true, midFlattenZ: 0.88 },
        boneMat(),
      ),
      side,
    );
    push(
      `equ.ske.mpe.016-${tag}`,
      createAnatomicalLongBoneMesh(
        hl.pasternMid,
        hl.coronet,
        { rMid: 0.018, rProxX: 0.023, rProxZ: 0.024, rDistX: 0.022, rDistZ: 0.024, bicondylarDistal: true, midFlattenZ: 0.9 },
        boneMat(),
      ),
      side,
    );
    push(`equ.ske.mpe.017-${tag}`, createCoffinBoneMesh(hl.hoofCenter.clone().add(V3(0.003, 0.006, 0)), darkBoneMat()), side);
    push(
      `equ.ske.mpe.018-${tag}`,
      createFacetedTarsalOrCarpalBlock(hl.fetlock.clone().add(V3(-0.022, 0.012, -0.012 * sd)), [0.016, 0.024, 0.012], darkBoneMat(), [0, 0, -0.3]),
      side,
    );
    push(
      `equ.ske.mpe.019-${tag}`,
      createFacetedTarsalOrCarpalBlock(hl.fetlock.clone().add(V3(-0.022, 0.012, 0.012 * sd)), [0.016, 0.024, 0.012], darkBoneMat(), [0, 0, -0.3]),
      side,
    );
    push(
      `equ.ske.mpe.020-${tag}`,
      createFacetedTarsalOrCarpalBlock(hl.coronet.clone().add(V3(-0.02, -0.012, 0)), [0.012, 0.012, 0.036], darkBoneMat(), [0, 0, 0.45]),
      side,
    );
  }

  // --- 5. ARTICULAR & LIGAMENTOUS STRUCTURES (layer = "art", sistema_articular.json) ---
  // Funículo nucal (equ.ske.lax.001) & Lámina nucal (equ.ske.lax.002)
  push(
    'equ.ske.lax.001',
    createTubeCurveMesh([HEAD.poll, V3(0.84, 1.69, 0), V3(0.64, 1.56, 0), V3(0.38, 1.51, 0)], 0.016, ligMat(), 20, 8),
    'center',
  );
  push(
    'equ.ske.lax.002',
    (() => {
      const g = new THREE.Group();
      for (let c = 2; c <= 6; c++) {
        const [cx, cy] = cervicalPos(c);
        g.add(createLongBoneMesh(V3(cx, cy + 0.02, 0), V3(0.45, 1.48, 0), 0.008, 0.01, ligMat(), 0.35));
      }
      return g;
    })(),
    'center',
  );
  // Ligamento supraespinoso (equ.ske.lax.003) along spinous tips from T3 to S3
  const supraPts: THREE.Vector3[] = [];
  for (let t = 3; t <= 18; t += 3) {
    const [tx, ty] = thoracicPos(t);
    const witherFactor = Math.exp(-Math.pow((t - 5.2) / 4.0, 2));
    supraPts.push(V3(tx - 0.025, ty + 0.08 + 0.16 * witherFactor, 0));
  }
  for (let l = 2; l <= 6; l += 2) {
    const [lx, ly] = lumbarPos(l);
    supraPts.push(V3(lx, ly + 0.092, 0));
  }
  push('equ.ske.lax.003', createTubeCurveMesh(supraPts, 0.01, ligMat(), 28, 8), 'center');

  // Ligamento longitudinal dorsal (equ.ske.lax.004) & Discos intervertebrales (equ.ske.aax.004)
  const longPts: THREE.Vector3[] = [];
  const ivdGrp = new THREE.Group();
  for (let c = 2; c <= 7; c++) longPts.push(V3(...cervicalPos(c)).add(V3(0, 0.01, 0)));
  for (let t = 1; t <= 18; t += 2) {
    const [tx, ty] = thoracicPos(t);
    longPts.push(V3(tx, ty + 0.01, 0));
    ivdGrp.add(createOrganMesh(V3(tx - 0.02, ty, 0), [0.008, 0.025, 0.028], cartMat(), undefined, 8));
  }
  for (let l = 1; l <= 5; l++) {
    const [lx, ly] = lumbarPos(l);
    longPts.push(V3(lx, ly + 0.01, 0));
    ivdGrp.add(createOrganMesh(V3(lx - 0.025, ly, 0), [0.009, 0.027, 0.032], cartMat(), undefined, 8));
  }
  push('equ.ske.lax.004', createTubeCurveMesh(longPts, 0.008, ligMat(), 36, 6), 'center');
  push('equ.ske.aax.004', ivdGrp, 'center');

  // Ligamento sacroilíaco dorsal (equ.ske.lax.009) & Sacrotuberal ancho (equ.ske.lax.011)
  push(
    'equ.ske.lax.009',
    buildBilateralArticular((sd) =>
      createTubeCurveMesh([V3(-0.75, 1.39, 0.03 * sd), V3(-0.92, 1.33, 0.025 * sd)], 0.013, ligMat(), 10, 8),
    ),
    'center',
  );
  push(
    'equ.ske.lax.011',
    buildBilateralArticular((sd) =>
      createLongBoneMesh(V3(-0.86, 1.32, 0.04 * sd), V3(-1.02, 1.17, 0.12 * sd), 0.022, 0.034, ligMat(), 0.25),
    ),
    'center',
  );

  // Atlantooccipital & Atlantoaxial joints
  push('equ.ske.aax.002', createOrganMesh(V3(1.01, 1.74, 0), [0.024, 0.026, 0.046], cartMat(), undefined, 10), 'center');
  push('equ.ske.aax.003', createOrganMesh(V3(0.95, 1.69, 0), [0.024, 0.024, 0.034], cartMat(), undefined, 10), 'center');

  // TMJ (equ.ske.aax.001-i/d), Shoulder (amt.001-i/d), Elbow (amt.002-i/d)
  push('equ.ske.aax.001-i', createOrganMesh(V3(1.09, 1.65, -0.068), [0.022, 0.018, 0.018], cartMat(), undefined, 10), 'left');
  push('equ.ske.aax.001-d', createOrganMesh(V3(1.09, 1.65, 0.068), [0.022, 0.018, 0.018], cartMat(), undefined, 10), 'right');

  for (const sd of [-1, 1] as const) {
    const tag = sd === -1 ? 'i' : 'd';
    const side = sd === -1 ? 'left' : 'right';
    const fl = forelimbLandmarks(sd);
    const hl = hindlimbLandmarks(sd);

    push(`equ.ske.amt.001-${tag}`, createOrganMesh(fl.shoulder, [0.044, 0.042, 0.038], cartMat(), undefined, 12), side);
    push(`equ.ske.amt.002-${tag}`, createOrganMesh(fl.elbow, [0.038, 0.034, 0.034], cartMat(), undefined, 12), side);

    // Cruciate caudal & Long plantar & Hind suspensory (separate -i/-d IDs exist)
    push(
      `equ.ske.lmp.009-${tag}`, // Ligamento cruzado caudal
      createTubeCurveMesh([hl.stifle.clone().add(V3(-0.01, 0.015, 0)), hl.stifle.clone().add(V3(0.012, -0.02, 0))], 0.007, ligMat(), 8, 6),
      side,
    );
    push(
      `equ.ske.lmp.014-${tag}`, // Ligamento plantar largo
      createTubeCurveMesh([hl.calcaneusTip, hl.hock.clone().add(V3(-0.024, -0.04, 0))], 0.0085, ligMat(), 10, 7),
      side,
    );
    push(
      `equ.ske.lmp.015-${tag}`, // Ligamento suspensorio del menudillo (pélvico)
      (() => {
        const g = new THREE.Group();
        const midCannon = hl.hock.clone().lerp(hl.fetlock, 0.65).add(V3(-0.014, 0, 0));
        g.add(createTubeCurveMesh([hl.hock.clone().add(V3(-0.014, -0.02, 0)), midCannon], 0.0095, ligMat(), 10, 8));
        g.add(createTubeCurveMesh([midCannon, hl.fetlock.clone().add(V3(-0.02, 0.012, -0.014 * sd)), hl.pasternMid], 0.006, ligMat(), 10, 7));
        g.add(createTubeCurveMesh([midCannon, hl.fetlock.clone().add(V3(-0.02, 0.012, 0.014 * sd)), hl.pasternMid], 0.006, ligMat(), 10, 7));
        return g;
      })(),
      side,
    );
    push(
      `equ.ske.lmp.016-${tag}`, // Ligamento anular plantar
      createTubeCurveMesh(
        [
          hl.fetlock.clone().add(V3(-0.012, 0.005, -0.02 * sd)),
          hl.fetlock.clone().add(V3(-0.032, 0.005, 0)),
          hl.fetlock.clone().add(V3(-0.012, 0.005, 0.02 * sd)),
        ],
        0.0055,
        ligMat(),
        10,
        6,
      ),
      side,
    );
  }

  // Bilateral forelimb carpal, fetlock, pastern & coffin capsules + stay-apparatus ligaments
  push(
    'equ.ske.amt.004', // Articulación antebraquiocarpiana
    buildBilateralArticular((sd) => createOrganMesh(forelimbLandmarks(sd).carpus.clone().add(V3(0, 0.018, 0)), [0.034, 0.014, 0.032], cartMat(), undefined, 10)),
    'center',
  );
  push(
    'equ.ske.amt.005', // Articulación mediocarpiana
    buildBilateralArticular((sd) => createOrganMesh(forelimbLandmarks(sd).carpus, [0.032, 0.012, 0.03], cartMat(), undefined, 10)),
    'center',
  );
  push(
    'equ.ske.amt.008', // Menudillo (metacarpofalángica)
    buildBilateralArticular((sd) => createOrganMesh(forelimbLandmarks(sd).fetlock, [0.032, 0.028, 0.028], cartMat(), undefined, 10)),
    'center',
  );
  push(
    'equ.ske.amt.009', // Interfalángica proximal (cuartilla)
    buildBilateralArticular((sd) => createOrganMesh(forelimbLandmarks(sd).pasternMid, [0.026, 0.016, 0.025], cartMat(), undefined, 10)),
    'center',
  );
  push(
    'equ.ske.amt.010', // Interfalángica distal (tejuelo)
    buildBilateralArticular((sd) => createOrganMesh(forelimbLandmarks(sd).coronet, [0.026, 0.014, 0.028], cartMat(), undefined, 10)),
    'center',
  );

  // Suspensory ligament (equ.ske.lmt.005-i), check ligaments (006-i, 007-i), palmar annular (010-i), distal sesamoidean & impar (011-i, 012-i)
  push(
    'equ.ske.lmt.005-i',
    buildBilateralArticular((sd) => {
      const fl = forelimbLandmarks(sd);
      const g = new THREE.Group();
      const midCannon = fl.carpus.clone().lerp(fl.fetlock, 0.65).add(V3(-0.014, 0, 0));
      g.add(createTubeCurveMesh([fl.carpus.clone().add(V3(-0.015, -0.02, 0)), midCannon], 0.0095, ligMat(), 10, 8));
      // Medial & lateral branches onto proximal sesamoids + extensor branches dorsally onto P1/CDET
      g.add(createTubeCurveMesh([midCannon, fl.fetlock.clone().add(V3(-0.02, 0.012, -0.014 * sd)), fl.pasternMid.clone().add(V3(0.012, 0, -0.006 * sd))], 0.006, ligMat(), 10, 7));
      g.add(createTubeCurveMesh([midCannon, fl.fetlock.clone().add(V3(-0.02, 0.012, 0.014 * sd)), fl.pasternMid.clone().add(V3(0.012, 0, 0.006 * sd))], 0.006, ligMat(), 10, 7));
      return g;
    }),
    'center',
  );
  push(
    'equ.ske.lmt.006-i', // Inferior check ligament (bridging palmar carpus to DDFT)
    buildBilateralArticular((sd) => {
      const fl = forelimbLandmarks(sd);
      return createTubeCurveMesh([fl.carpus.clone().add(V3(-0.016, -0.02, 0)), fl.carpus.clone().lerp(fl.fetlock, 0.45).add(V3(-0.024, 0, 0))], 0.007, ligMat(), 8, 7);
    }),
    'center',
  );
  push(
    'equ.ske.lmt.007-i', // Superior check ligament
    buildBilateralArticular((sd) => {
      const fl = forelimbLandmarks(sd);
      return createTubeCurveMesh([fl.carpus.clone().add(V3(-0.012, 0.14, 0)), fl.carpus.clone().add(V3(-0.022, 0.02, 0))], 0.0075, ligMat(), 8, 7);
    }),
    'center',
  );
  push(
    'equ.ske.lmt.010-i', // Ligamento anular palmar
    buildBilateralArticular((sd) => {
      const fl = forelimbLandmarks(sd);
      return createTubeCurveMesh(
        [fl.fetlock.clone().add(V3(-0.012, 0.005, -0.02 * sd)), fl.fetlock.clone().add(V3(-0.032, 0.005, 0)), fl.fetlock.clone().add(V3(-0.012, 0.005, 0.02 * sd))],
        0.0055,
        ligMat(),
        10,
        6,
      );
    }),
    'center',
  );
  push(
    'equ.ske.lmt.011-i', // Ligamentos sesamoideos distales
    buildBilateralArticular((sd) => {
      const fl = forelimbLandmarks(sd);
      return createTubeCurveMesh([fl.fetlock.clone().add(V3(-0.02, 0.008, 0)), fl.pasternMid.clone().add(V3(-0.018, 0, 0))], 0.007, ligMat(), 8, 7);
    }),
    'center',
  );
  push(
    'equ.ske.lmt.012-i', // Ligamento sesamoideo distal impar
    buildBilateralArticular((sd) => {
      const fl = forelimbLandmarks(sd);
      return createTubeCurveMesh([fl.coronet.clone().add(V3(-0.018, -0.01, 0)), fl.hoofCenter.clone().add(V3(-0.012, 0.015, 0))], 0.007, ligMat(), 8, 7);
    }),
    'center',
  );

  // Hindlimb hip, stifle menisci, patellar locking ligaments & distal joints
  push(
    'equ.ske.amp.001',
    buildBilateralArticular((sd) => createOrganMesh(hindlimbLandmarks(sd).hip, [0.048, 0.046, 0.044], cartMat(), undefined, 12)),
    'center',
  );
  push(
    'equ.ske.amp.002', // Articulación femoropatelar
    buildBilateralArticular((sd) => createOrganMesh(hindlimbLandmarks(sd).stifle.clone().add(V3(0.03, 0.012, 0)), [0.034, 0.036, 0.034], cartMat(), undefined, 10)),
    'center',
  );
  push(
    'equ.ske.amp.003-i', // Femorotibial
    buildBilateralArticular((sd) => createOrganMesh(hindlimbLandmarks(sd).stifle, [0.044, 0.038, 0.04], cartMat(), undefined, 12)),
    'center',
  );
  push(
    'equ.ske.amp.004', // Menisco medial
    buildBilateralArticular((sd) => {
      const m = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.006, 8, 14, Math.PI * 1.4), cartMat());
      m.position.copy(hindlimbLandmarks(sd).stifle).add(V3(0, -0.01, -0.015 * sd));
      m.rotation.x = Math.PI / 2;
      return m;
    }),
    'center',
  );
  push(
    'equ.ske.amp.005', // Menisco lateral
    buildBilateralArticular((sd) => {
      const m = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.006, 8, 14, Math.PI * 1.4), cartMat());
      m.position.copy(hindlimbLandmarks(sd).stifle).add(V3(0, -0.01, 0.015 * sd));
      m.rotation.x = Math.PI / 2;
      return m;
    }),
    'center',
  );

  // 3 Equine Patellar Ligaments (stay-apparatus locking loop!)
  push(
    'equ.ske.lmp.003-i', // Medial patellar ligament
    buildBilateralArticular((sd) => {
      const hl = hindlimbLandmarks(sd);
      return createTubeCurveMesh([hl.stifle.clone().add(V3(0.042, 0.01, -0.012 * sd)), hl.stifle.clone().add(V3(0.026, -0.065, -0.014 * sd))], 0.007, ligMat(), 8, 7);
    }),
    'center',
  );
  push(
    'equ.ske.lmp.004-i', // Intermediate patellar ligament
    buildBilateralArticular((sd) => {
      const hl = hindlimbLandmarks(sd);
      return createTubeCurveMesh([hl.stifle.clone().add(V3(0.046, 0.008, 0)), hl.stifle.clone().add(V3(0.03, -0.07, 0))], 0.008, ligMat(), 8, 7);
    }),
    'center',
  );
  push(
    'equ.ske.lmp.005-i', // Lateral patellar ligament
    buildBilateralArticular((sd) => {
      const hl = hindlimbLandmarks(sd);
      return createTubeCurveMesh([hl.stifle.clone().add(V3(0.042, 0.01, 0.014 * sd)), hl.stifle.clone().add(V3(0.026, -0.068, 0.016 * sd))], 0.007, ligMat(), 8, 7);
    }),
    'center',
  );
  push(
    'equ.ske.lmp.008-i', // Cranial cruciate
    buildBilateralArticular((sd) => {
      const hl = hindlimbLandmarks(sd);
      return createTubeCurveMesh([hl.stifle.clone().add(V3(0.012, 0.015, 0)), hl.stifle.clone().add(V3(-0.01, -0.02, 0))], 0.007, ligMat(), 8, 6);
    }),
    'center',
  );

  // Hind hock & distal limb joint capsules
  push(
    'equ.ske.amp.007', // Tibiotarsiana
    buildBilateralArticular((sd) => createOrganMesh(hindlimbLandmarks(sd).hock.clone().add(V3(0.006, 0.02, 0)), [0.036, 0.018, 0.034], cartMat(), undefined, 10)),
    'center',
  );
  push(
    'equ.ske.amp.011-i', // Menudillo metatarsofalángica
    buildBilateralArticular((sd) => createOrganMesh(hindlimbLandmarks(sd).fetlock, [0.032, 0.028, 0.028], cartMat(), undefined, 10)),
    'center',
  );
  push(
    'equ.ske.amp.012-i', // Interfalángica proximal pélvica
    buildBilateralArticular((sd) => createOrganMesh(hindlimbLandmarks(sd).pasternMid, [0.026, 0.016, 0.025], cartMat(), undefined, 10)),
    'center',
  );
  push(
    'equ.ske.amp.013-i', // Interfalángica distal pélvica
    buildBilateralArticular((sd) => createOrganMesh(hindlimbLandmarks(sd).coronet, [0.026, 0.014, 0.028], cartMat(), undefined, 10)),
    'center',
  );

  return parts;
}
