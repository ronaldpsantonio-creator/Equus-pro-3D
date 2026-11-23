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
  createCoffinBoneMesh,
  createLongBoneMesh,
  createOrganMesh,
  createTubeCurveMesh,
} from './geomHelpers';

export type BuiltPart = {
  id: string;
  mesh: THREE.Object3D;
  side: 'left' | 'right' | 'center';
  center: THREE.Vector3;
};

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

  // --- 1. CRANIUM & MANDIBLE (equ.ske.cra.*) ---
  const skullMap: Array<{
    id: string;
    build: () => THREE.Object3D;
    side?: 'left' | 'right' | 'center';
  }> = [
    {
      id: 'equ.ske.cra.001', // Occipital
      build: () => createOrganMesh(V3(1.03, 1.76, 0), [0.055, 0.05, 0.06], boneMat()),
    },
    {
      id: 'equ.ske.cra.002', // Basisfenoides
      build: () => createOrganMesh(V3(1.11, 1.66, 0), [0.045, 0.03, 0.04], darkBoneMat()),
    },
    {
      id: 'equ.ske.cra.003', // Presfenoides
      build: () => createOrganMesh(V3(1.17, 1.64, 0), [0.04, 0.025, 0.035], darkBoneMat()),
    },
    {
      id: 'equ.ske.cra.004', // Etmoides
      build: () => createOrganMesh(V3(1.24, 1.62, 0), [0.045, 0.04, 0.045], darkBoneMat()),
    },
    {
      id: 'equ.ske.cra.005', // Interparietal
      build: () => createOrganMesh(V3(1.09, 1.78, 0), [0.04, 0.028, 0.045], boneMat()),
    },
    {
      id: 'equ.ske.cra.016', // Vómer
      build: () => createLongBoneMesh(V3(1.22, 1.56, 0), V3(1.44, 1.44, 0), 0.012, 0.016, darkBoneMat()),
    },
  ];

  for (const item of skullMap) {
    push(item.id, item.build(), item.side || 'center');
  }

  for (const sd of [-1, 1] as const) {
    const tag = sd === -1 ? 'i' : 'd';
    const side = sd === -1 ? 'left' : 'right';

    push(
      `equ.ske.cra.006-${tag}`, // Parietal
      createOrganMesh(V3(1.12, 1.75, 0.038 * sd), [0.055, 0.04, 0.032], boneMat()),
      side,
    );
    push(
      `equ.ske.cra.007-${tag}`, // Frontal
      createOrganMesh(V3(1.21, 1.71, 0.045 * sd), [0.075, 0.036, 0.045], boneMat(), [0, 0, -0.38]),
      side,
    );
    push(
      `equ.ske.cra.008-${tag}`, // Temporal
      createOrganMesh(V3(1.11, 1.67, 0.068 * sd), [0.052, 0.042, 0.024], boneMat()),
      side,
    );
    push(
      `equ.ske.cra.009-${tag}`, // Nasal
      createLongBoneMesh(V3(1.27, 1.64, 0.022 * sd), V3(1.50, 1.47, 0.016 * sd), 0.022, 0.026, boneMat(), 0.7),
      side,
    );
    push(
      `equ.ske.cra.010-${tag}`, // Lagrimal
      createOrganMesh(V3(1.23, 1.65, 0.062 * sd), [0.035, 0.025, 0.018], boneMat()),
      side,
    );
    push(
      `equ.ske.cra.011-${tag}`, // Cigomático
      createLongBoneMesh(V3(1.15, 1.63, 0.076 * sd), V3(1.27, 1.56, 0.068 * sd), 0.016, 0.02, boneMat()),
      side,
    );
    push(
      `equ.ske.cra.012-${tag}`, // Maxilar + cresta facial + arcada premolar/molar superior
      (() => {
        const g = new THREE.Group();
        g.add(createLongBoneMesh(V3(1.24, 1.53, 0.056 * sd), V3(1.46, 1.41, 0.042 * sd), 0.046, 0.04, boneMat(), 0.65));
        // Cresta facial equina prominente
        g.add(createLongBoneMesh(V3(1.20, 1.59, 0.072 * sd), V3(1.33, 1.52, 0.062 * sd), 0.009, 0.011, darkBoneMat(), 0.55));
        // Muelas hipsodontas superiores (P2-M3) separadas del grupo incisivo por el diastema
        for (let m = 0; m < 6; m++) {
          const mt = m / 5;
          g.add(
            createOrganMesh(
              V3(THREE.MathUtils.lerp(1.22, 1.35, mt), THREE.MathUtils.lerp(1.50, 1.44, mt), 0.036 * sd),
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
    push(
      `equ.ske.cra.013-${tag}`, // Incisivo (premaxila + incisivos superiores I1-I3)
      (() => {
        const g = new THREE.Group();
        g.add(createOrganMesh(V3(1.51, 1.38, 0.022 * sd), [0.048, 0.026, 0.022], boneMat(), [0, 0, -0.45]));
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
    push(
      `equ.ske.cra.014-${tag}`, // Palatino
      createOrganMesh(V3(1.30, 1.50, 0.025 * sd), [0.045, 0.014, 0.02], darkBoneMat()),
      side,
    );
    push(
      `equ.ske.cra.015-${tag}`, // Pterigoideo
      createOrganMesh(V3(1.18, 1.57, 0.025 * sd), [0.028, 0.016, 0.014], darkBoneMat()),
      side,
    );
    push(
      `equ.ske.cra.017-${tag}`, // Hemimandíbula (rama vertical ancha + cuerpo horizontal + dientes)
      (() => {
        const g = new THREE.Group();
        const ramus = createLongBoneMesh(
          HEAD.jawAngle(sd),
          V3(1.10, 1.65, 0.068 * sd),
          0.036,
          0.046,
          boneMat(),
          0.4,
        );
        const body = createLongBoneMesh(
          HEAD.jawAngle(sd),
          V3(1.48, 1.31, 0.025 * sd),
          0.032,
          0.04,
          boneMat(),
          0.45,
        );
        g.add(ramus, body);
        // Arcada premolar/molar inferior + incisivos inferiores tras el diastema
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
              V3(1.525 - inc * 0.008, 1.33, (0.008 + inc * 0.011) * sd),
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
    const body = createOrganMesh(
      V3(x, y, 0),
      [0.046, 0.038, c === 1 ? 0.065 : 0.042],
      boneMat(),
      [0, 0, -0.45],
      14,
    );
    g.add(body);
    if (c === 2) {
      // Axis prominent crest
      g.add(createOrganMesh(V3(x, y + 0.045, 0), [0.045, 0.022, 0.012], boneMat(), [0, 0, -0.4]));
    }
    push(id, g, 'center', V3(x, y, 0));
  }

  for (let t = 1; t <= 18; t++) {
    const [x, y] = thoracicPos(t);
    const id = `equ.ske.tor.${String(t).padStart(3, '0')}`;
    const g = new THREE.Group();
    g.add(createOrganMesh(V3(x, y, 0), [0.032, 0.034, 0.036], boneMat(), undefined, 12));
    // Tall equine withers spinous processes (longest at T4-T7)
    const witherFactor = Math.exp(-Math.pow((t - 5.5) / 4.2, 2));
    const spineH = 0.065 + 0.17 * witherFactor;
    const sp = createLongBoneMesh(
      V3(x, y + 0.02, 0),
      V3(x - 0.035, y + 0.02 + spineH, 0),
      0.011,
      0.015,
      boneMat(),
      0.55,
    );
    g.add(sp);
    push(id, g, 'center', V3(x, y + spineH * 0.35, 0));
  }

  for (let l = 1; l <= 6; l++) {
    const [x, y] = lumbarPos(l);
    const id = `equ.ske.lum.${String(l).padStart(3, '0')}`;
    const g = new THREE.Group();
    g.add(createOrganMesh(V3(x, y, 0), [0.034, 0.032, 0.038], boneMat(), undefined, 12));
    // Transverse processes characteristic of equine lumbar vertebrae
    g.add(createLongBoneMesh(V3(x, y + 0.005, -0.095), V3(x, y + 0.005, 0.095), 0.01, 0.012, boneMat()));
    g.add(createLongBoneMesh(V3(x, y + 0.02, 0), V3(x + 0.01, y + 0.09, 0), 0.011, 0.015, boneMat(), 0.5));
    push(id, g, 'center', V3(x, y, 0));
  }

  for (let s = 1; s <= 5; s++) {
    const [x, y] = sacralPos(s);
    const id = `equ.ske.sac.${String(s).padStart(3, '0')}`;
    const g = new THREE.Group();
    g.add(createOrganMesh(V3(x, y, 0), [0.03, 0.028, 0.05 - s * 0.005], boneMat(), undefined, 10));
    g.add(createLongBoneMesh(V3(x, y + 0.015, 0), V3(x - 0.02, y + 0.08 - s * 0.008, 0), 0.01, 0.013, boneMat(), 0.5));
    push(id, g, 'center', V3(x, y, 0));
  }

  for (let ca = 1; ca <= 18; ca++) {
    const [x, y] = caudalPos(ca);
    const id = `equ.ske.cau.${String(ca).padStart(3, '0')}`;
    const r = Math.max(0.008, 0.022 - ca * 0.0008);
    push(id, createOrganMesh(V3(x, y, 0), [0.018, r, r], boneMat(), [0, 0, 0.45], 10), 'center');
  }

  // --- 3. RIBCAGE & STERNUM (18 pairs of ribs + costal cartilages + sternum) ---
  for (let r = 1; r <= 18; r++) {
    for (const sd of [-1, 1] as const) {
      const tag = sd === -1 ? 'i' : 'd';
      const side = sd === -1 ? 'left' : 'right';
      const pts = ribArcPoints(r, sd);
      const id = `equ.ske.cos.${String(r).padStart(3, '0')}-${tag}`;
      const g = new THREE.Group();
      // Bony dorsal 3/4 of rib
      g.add(createTubeCurveMesh(pts.slice(0, 4), 0.012, boneMat(), 16, 8));
      // Cartilaginous ventral costal arch
      g.add(createTubeCurveMesh(pts.slice(3), 0.01, cartMat(), 8, 7));
      push(id, g, side, pts[2]);
    }
  }

  // Keeled equine Sternum (equ.ske.ste.001)
  push(
    'equ.ske.ste.001',
    createLongBoneMesh(V3(0.46, 0.87, 0), V3(-0.08, 0.83, 0), 0.032, 0.042, boneMat(), 0.65),
    'center',
  );

  // --- 4. FORELIMBS & HINDLIMBS (equ.ske.mto.* & equ.ske.mpe.*) ---
  for (const sd of [-1, 1] as const) {
    const tag = sd === -1 ? 'i' : 'd';
    const side = sd === -1 ? 'left' : 'right';
    const fl = forelimbLandmarks(sd);

    // Scapula (001) with scapular spine
    const scap = new THREE.Group();
    scap.add(createLongBoneMesh(fl.scapulaTop, fl.shoulder, 0.055, 0.085, boneMat(), 0.25));
    scap.add(createLongBoneMesh(
      fl.scapulaTop.clone().add(V3(0, -0.02, 0.018 * sd)),
      fl.shoulder.clone().add(V3(0, 0.04, 0.015 * sd)),
      0.012,
      0.016,
      darkBoneMat(),
    ));
    push(`equ.ske.mto.001-${tag}`, scap, side);
    push(`equ.ske.mto.002-${tag}`, createLongBoneMesh(fl.shoulder, fl.elbow, 0.036, 0.054, boneMat()), side); // Húmero
    push(`equ.ske.mto.003-${tag}`, createLongBoneMesh(fl.elbow, fl.carpus, 0.027, 0.042, boneMat()), side); // Radio
    push(
      `equ.ske.mto.004-${tag}`, // Ulna + Olecranon
      createLongBoneMesh(fl.elbow.clone().add(V3(-0.03, 0.075, 0)), fl.carpus.clone().add(V3(-0.015, 0.14, 0)), 0.014, 0.028, darkBoneMat()),
      side,
    );

    // Carpus (005..011)
    const carpusIds = [5, 6, 7, 8, 9, 10, 11];
    carpusIds.forEach((n, idx) => {
      const row = idx < 4 ? 0.016 : -0.016;
      const offZ = ((idx % 3) - 1) * 0.018 * sd;
      const offX = idx === 3 ? -0.028 : 0; // accessory carpal bone caudal
      push(
        `equ.ske.mto.${String(n).padStart(3, '0')}-${tag}`,
        createOrganMesh(
          V3(fl.carpus.x + offX, fl.carpus.y + row, fl.carpus.z + offZ),
          [0.018, 0.014, 0.016],
          boneMat(),
          undefined,
          10,
        ),
        side,
      );
    });

    // Metacarpus III "Caña" (012) & Splint bones II/IV (013, 014)
    push(`equ.ske.mto.012-${tag}`, createLongBoneMesh(fl.carpus, fl.fetlock, 0.021, 0.029, boneMat()), side);
    push(
      `equ.ske.mto.013-${tag}`,
      createLongBoneMesh(
        fl.carpus.clone().add(V3(-0.012, -0.01, -0.018 * sd)),
        fl.fetlock.clone().add(V3(-0.01, 0.08, -0.014 * sd)),
        0.007,
        0.009,
        darkBoneMat(),
      ),
      side,
    );
    push(
      `equ.ske.mto.014-${tag}`,
      createLongBoneMesh(
        fl.carpus.clone().add(V3(-0.012, -0.01, 0.018 * sd)),
        fl.fetlock.clone().add(V3(-0.01, 0.08, 0.014 * sd)),
        0.007,
        0.009,
        darkBoneMat(),
      ),
      side,
    );

    // Phalanges P1, P2, P3 (015, 016, 017) & Sesamoids (018, 019, 020)
    push(`equ.ske.mto.015-${tag}`, createLongBoneMesh(fl.fetlock, fl.pasternMid, 0.02, 0.026, boneMat()), side);
    push(`equ.ske.mto.016-${tag}`, createLongBoneMesh(fl.pasternMid, fl.hoofCenter.clone().add(V3(-0.01, 0.02, 0)), 0.02, 0.024, boneMat()), side);
    push(
      `equ.ske.mto.017-${tag}`,
      createCoffinBoneMesh(fl.hoofCenter.clone().add(V3(0.004, 0.008, 0)), darkBoneMat()),
      side,
    );
    push(
      `equ.ske.mto.018-${tag}`,
      createOrganMesh(fl.fetlock.clone().add(V3(-0.024, 0.01, -0.012 * sd)), [0.011, 0.014, 0.01], darkBoneMat(), undefined, 8),
      side,
    );
    push(
      `equ.ske.mto.019-${tag}`,
      createOrganMesh(fl.fetlock.clone().add(V3(-0.024, 0.01, 0.012 * sd)), [0.011, 0.014, 0.01], darkBoneMat(), undefined, 8),
      side,
    );
    push(
      `equ.ske.mto.020-${tag}`,
      createOrganMesh(fl.hoofCenter.clone().add(V3(-0.025, 0.022, 0)), [0.01, 0.009, 0.02], darkBoneMat(), undefined, 8),
      side,
    );

    // HINDLIMB
    const hl = hindlimbLandmarks(sd);
    // Coxal / Pelvis (001): Ilium wing + Ischium/Pubis
    const coxal = new THREE.Group();
    coxal.add(createLongBoneMesh(hl.tuberCoxae, hl.hip, 0.045, 0.075, boneMat(), 0.35));
    coxal.add(createLongBoneMesh(hl.hip, hl.tuberIschii, 0.035, 0.05, boneMat(), 0.5));
    coxal.add(createLongBoneMesh(hl.hip, V3(hl.hip.x + 0.04, hl.hip.y - 0.03, 0.02 * sd), 0.024, 0.032, darkBoneMat()));
    push(`equ.ske.mpe.001-${tag}`, coxal, side);

    push(`equ.ske.mpe.002-${tag}`, createLongBoneMesh(hl.hip, hl.stifle, 0.042, 0.062, boneMat()), side); // Fémur
    push(`equ.ske.mpe.003-${tag}`, createOrganMesh(hl.stifle.clone().add(V3(0.042, 0.015, 0)), [0.024, 0.03, 0.024], darkBoneMat(), undefined, 10), side); // Rótula
    push(`equ.ske.mpe.004-${tag}`, createLongBoneMesh(hl.stifle, hl.hock, 0.03, 0.048, boneMat()), side); // Tibia
    push(
      `equ.ske.mpe.005-${tag}`, // Fíbula
      createLongBoneMesh(hl.stifle.clone().add(V3(-0.02, -0.02, 0.022 * sd)), hl.stifle.clone().add(V3(-0.08, -0.18, 0.015 * sd)), 0.007, 0.01, darkBoneMat()),
      side,
    );
    // Calcaneus (007) & Talus/Tarsals (006, 008..011)
    push(
      `equ.ske.mpe.007-${tag}`,
      createLongBoneMesh(hl.hock, hl.hock.clone().add(V3(-0.065, 0.075, 0)), 0.022, 0.03, boneMat()),
      side,
    );
    [6, 8, 9, 10, 11].forEach((n, idx) => {
      const yOff = idx < 2 ? 0.014 : -0.016;
      const zOff = ((idx % 3) - 1) * 0.016 * sd;
      push(
        `equ.ske.mpe.${String(n).padStart(3, '0')}-${tag}`,
        createOrganMesh(V3(hl.hock.x, hl.hock.y + yOff, hl.hock.z + zOff), [0.02, 0.016, 0.018], boneMat(), undefined, 10),
        side,
      );
    });

    // Metatarsus III (012) & Splints (013, 014)
    push(`equ.ske.mpe.012-${tag}`, createLongBoneMesh(hl.hock, hl.fetlock, 0.022, 0.03, boneMat()), side);
    push(
      `equ.ske.mpe.013-${tag}`,
      createLongBoneMesh(
        hl.hock.clone().add(V3(-0.012, -0.01, -0.018 * sd)),
        hl.fetlock.clone().add(V3(-0.01, 0.08, -0.014 * sd)),
        0.007,
        0.009,
        darkBoneMat(),
      ),
      side,
    );
    push(
      `equ.ske.mpe.014-${tag}`,
      createLongBoneMesh(
        hl.hock.clone().add(V3(-0.012, -0.01, 0.018 * sd)),
        hl.fetlock.clone().add(V3(-0.01, 0.08, 0.014 * sd)),
        0.007,
        0.009,
        darkBoneMat(),
      ),
      side,
    );

    // Hind Phalanges & Sesamoids (015..020)
    push(`equ.ske.mpe.015-${tag}`, createLongBoneMesh(hl.fetlock, hl.pasternMid, 0.02, 0.026, boneMat()), side);
    push(`equ.ske.mpe.016-${tag}`, createLongBoneMesh(hl.pasternMid, hl.hoofCenter.clone().add(V3(-0.01, 0.02, 0)), 0.02, 0.024, boneMat()), side);
    push(
      `equ.ske.mpe.017-${tag}`,
      createCoffinBoneMesh(hl.hoofCenter.clone().add(V3(0.004, 0.008, 0)), darkBoneMat()),
      side,
    );
    push(
      `equ.ske.mpe.018-${tag}`,
      createOrganMesh(hl.fetlock.clone().add(V3(-0.024, 0.01, -0.012 * sd)), [0.011, 0.014, 0.01], darkBoneMat(), undefined, 8),
      side,
    );
    push(
      `equ.ske.mpe.019-${tag}`,
      createOrganMesh(hl.fetlock.clone().add(V3(-0.024, 0.01, 0.012 * sd)), [0.011, 0.014, 0.01], darkBoneMat(), undefined, 8),
      side,
    );
    push(
      `equ.ske.mpe.020-${tag}`,
      createOrganMesh(hl.hoofCenter.clone().add(V3(-0.025, 0.022, 0)), [0.01, 0.009, 0.02], darkBoneMat(), undefined, 8),
      side,
    );
  }

  // --- 5. ARTICULAR & LIGAMENTOUS STRUCTURES (layer = "art", sistema_articular.json) ---
  // Funículo nucal (equ.ske.lax.001) & Lámina nucal (equ.ske.lax.002)
  push(
    'equ.ske.lax.001',
    createTubeCurveMesh(
      [HEAD.poll, V3(0.84, 1.69, 0), V3(0.64, 1.56, 0), V3(0.38, 1.50, 0)],
      0.016,
      ligMat(),
      20,
      8,
    ),
    'center',
  );
  push(
    'equ.ske.lax.002',
    (() => {
      const g = new THREE.Group();
      for (let c = 2; c <= 6; c++) {
        const [cx, cy] = cervicalPos(c);
        g.add(
          createLongBoneMesh(
            V3(cx, cy + 0.02, 0),
            V3(0.45, 1.48, 0),
            0.008,
            0.01,
            ligMat(),
            0.35,
          ),
        );
      }
      return g;
    })(),
    'center',
  );
  push(
    'equ.ske.lax.009', // Ligamento sacroilíaco dorsal
    createTubeCurveMesh([V3(-0.74, 1.38, 0), V3(-0.92, 1.33, 0)], 0.016, ligMat(), 10, 8),
    'center',
  );

  // Joint capsules (left & right / bilateral)
  const flL = forelimbLandmarks(-1);
  const hlL = hindlimbLandmarks(-1);
  const flR = forelimbLandmarks(1);
  const hlR = hindlimbLandmarks(1);

  push('equ.ske.aax.001-i', createOrganMesh(V3(1.09, 1.65, -0.068), [0.022, 0.018, 0.018], cartMat(), undefined, 10), 'left');
  push('equ.ske.aax.001-d', createOrganMesh(V3(1.09, 1.65, 0.068), [0.022, 0.018, 0.018], cartMat(), undefined, 10), 'right');
  push(
    'equ.ske.amt.004', // Articulación antebraquiocarpiana (bilateral)
    (() => {
      const g = new THREE.Group();
      g.add(createOrganMesh(flL.carpus, [0.036, 0.024, 0.034], cartMat(), undefined, 10));
      g.add(createOrganMesh(flR.carpus, [0.036, 0.024, 0.034], cartMat(), undefined, 10));
      return g;
    })(),
    'center',
  );
  push(
    'equ.ske.amp.001', // Articulación coxofemoral (bilateral)
    (() => {
      const g = new THREE.Group();
      g.add(createOrganMesh(hlL.hip, [0.052, 0.048, 0.046], cartMat(), undefined, 12));
      g.add(createOrganMesh(hlR.hip, [0.052, 0.048, 0.046], cartMat(), undefined, 12));
      return g;
    })(),
    'center',
  );
  push(
    'equ.ske.amp.003-i',
    (() => {
      const g = new THREE.Group();
      g.add(createOrganMesh(hlL.stifle, [0.048, 0.044, 0.042], cartMat(), undefined, 12));
      g.add(createOrganMesh(hlR.stifle, [0.048, 0.044, 0.042], cartMat(), undefined, 12));
      return g;
    })(),
    'center',
  );

  return parts;
}
