import * as THREE from 'three';
import {
  caudalPos,
  forelimbLandmarks,
  HEAD,
  hindlimbLandmarks,
  ribArcPoints,
  V3,
} from '../anatomyCoords';
import { createTissueMaterial } from '../materials';
import { ProceduralTextureSet } from '../textures';
import { BuiltPart } from './buildSkeletalAndArticular';
import {
  AnatomicalStation,
  createCurvedMuscleSheetMesh,
  createHalfLoftedContourMesh,
  createHoofMesh,
  createMuscleBellyMesh,
  createMuscleUnitWithTendonCaps,
  createOrganMesh,
  createSculptedLimbPath,
  createTubeCurveMesh,
} from './geomHelpers';

function makeSideMarked(obj: THREE.Object3D, side: 'left' | 'right'): THREE.Object3D {
  obj.traverse((ch) => {
    ch.userData.side = side;
  });
  return obj;
}

function buildHalfEquineCoat(
  sd: -1 | 1,
  skinMat: THREE.Material,
  darkPointMat: THREE.Material,
  maneMat: THREE.Material,
): THREE.Group {
  const g = new THREE.Group();
  const side = sd === -1 ? 'left' : 'right';
  g.userData.side = side;

  const mark = <T extends THREE.Object3D>(obj: T): T => makeSideMarked(obj, side) as T;

  // 1. Continuous lofted torso (buttocks -> croup -> flank -> barrel -> withers -> chest)
  const torsoStations: AnatomicalStation[] = [
    { x: -1.11, yCenter: 1.24, halfHeight: 0.015, halfWidth: 0.012 },
    { x: -1.03, yCenter: 1.22, halfHeight: 0.16, halfWidth: 0.145, dorsalTaper: 1.2 },
    { x: -0.84, yCenter: 1.19, halfHeight: 0.245, halfWidth: 0.215, dorsalTaper: 1.25 },
    { x: -0.62, yCenter: 1.14, halfHeight: 0.258, halfWidth: 0.22, flankBias: 0.07 },
    { x: -0.35, yCenter: 1.10, halfHeight: 0.298, halfWidth: 0.26, flankBias: 0.05 },
    { x: -0.04, yCenter: 1.07, halfHeight: 0.338, halfWidth: 0.288, flankBias: 0.03 },
    { x: 0.26, yCenter: 1.16, halfHeight: 0.332, halfWidth: 0.245, dorsalTaper: 1.65 },
    { x: 0.48, yCenter: 1.12, halfHeight: 0.262, halfWidth: 0.195, dorsalTaper: 1.3 },
    { x: 0.61, yCenter: 1.09, halfHeight: 0.155, halfWidth: 0.118 },
    { x: 0.66, yCenter: 1.10, halfHeight: 0.018, halfWidth: 0.014 },
  ];
  g.add(mark(createHalfLoftedContourMesh(torsoStations, sd, skinMat, 24)));

  // 2. Arched equine neck loft (withers/thoracic inlet -> poll/throat)
  const neckStations: AnatomicalStation[] = [
    { x: 0.40, yCenter: 1.27, halfHeight: 0.21, halfWidth: 0.135, dorsalTaper: 1.5 },
    { x: 0.56, yCenter: 1.33, halfHeight: 0.215, halfWidth: 0.13, dorsalTaper: 1.65 },
    { x: 0.72, yCenter: 1.45, halfHeight: 0.19, halfWidth: 0.114, dorsalTaper: 1.75 },
    { x: 0.88, yCenter: 1.58, halfHeight: 0.16, halfWidth: 0.098, dorsalTaper: 1.65 },
    { x: 1.02, yCenter: 1.68, halfHeight: 0.13, halfWidth: 0.088, dorsalTaper: 1.35 },
    { x: 1.08, yCenter: 1.70, halfHeight: 0.03, halfWidth: 0.025 },
  ];
  g.add(mark(createHalfLoftedContourMesh(neckStations, sd, skinMat, 20)));

  // 3. Sculpted equine head
  const headStations: AnatomicalStation[] = [
    { x: 0.99, yCenter: 1.70, halfHeight: 0.03, halfWidth: 0.025 },
    { x: 1.07, yCenter: 1.65, halfHeight: 0.142, halfWidth: 0.092 },
    { x: 1.16, yCenter: 1.64, halfHeight: 0.134, halfWidth: 0.098, flankBias: -0.06 },
    { x: 1.28, yCenter: 1.56, halfHeight: 0.10, halfWidth: 0.074 },
    { x: 1.42, yCenter: 1.46, halfHeight: 0.072, halfWidth: 0.056 },
    { x: 1.53, yCenter: 1.38, halfHeight: 0.058, halfWidth: 0.052 },
    { x: 1.59, yCenter: 1.36, halfHeight: 0.015, halfWidth: 0.015 },
  ];
  g.add(mark(createHalfLoftedContourMesh(headStations, sd, skinMat, 20)));

  // Soft dark muzzle tip, nostril flare & lip contour
  g.add(mark(createOrganMesh(V3(1.555, 1.375, 0.024 * sd), [0.034, 0.036, 0.028], darkPointMat, [0, 0, -0.45], 14)));
  g.add(mark(createOrganMesh(V3(1.535, 1.405, 0.034 * sd), [0.022, 0.016, 0.016], maneMat, [0.15 * sd, 0.2 * sd, -0.3], 12)));

  // Sculpted Equine Ear (external pinna + dark ear tip)
  g.add(mark(createMuscleBellyMesh(V3(1.04, 1.78, 0.048 * sd), V3(1.05, 1.94, 0.064 * sd), 0.025, 0.62, skinMat, 0.34)));
  g.add(mark(createMuscleBellyMesh(V3(1.045, 1.88, 0.058 * sd), V3(1.055, 1.955, 0.065 * sd), 0.014, 0.6, darkPointMat, 0.3)));

  // 4. Continuous Forelimb Coat + Dark Points
  const fl = forelimbLandmarks(sd);
  g.add(
    mark(
      createSculptedLimbPath(
        [
          { pos: fl.scapulaTop.clone().add(V3(0.02, -0.05, 0)), radiusX: 0.112, radiusZ: 0.078 },
          { pos: fl.shoulder.clone().add(V3(-0.02, 0.02, 0)), radiusX: 0.11, radiusZ: 0.082 },
          { pos: fl.elbow.clone().add(V3(0.01, 0.04, 0)), radiusX: 0.098, radiusZ: 0.074 },
          { pos: fl.elbow.clone().lerp(fl.carpus, 0.45), radiusX: 0.07, radiusZ: 0.054 },
          { pos: fl.carpus.clone().add(V3(0, 0.04, 0)), radiusX: 0.045, radiusZ: 0.039 },
        ],
        skinMat,
        18,
      ),
    ),
  );
  g.add(
    mark(
      createSculptedLimbPath(
        [
          { pos: fl.carpus.clone().add(V3(0, 0.045, 0)), radiusX: 0.046, radiusZ: 0.04 },
          { pos: fl.carpus, radiusX: 0.043, radiusZ: 0.038 },
          { pos: fl.carpus.clone().lerp(fl.fetlock, 0.5), radiusX: 0.035, radiusZ: 0.029 },
          { pos: fl.fetlock, radiusX: 0.039, radiusZ: 0.033 },
          { pos: fl.pasternMid, radiusX: 0.031, radiusZ: 0.027 },
          { pos: fl.hoofCenter.clone().add(V3(-0.004, 0.036, 0)), radiusX: 0.037, radiusZ: 0.033 },
        ],
        darkPointMat,
        16,
      ),
    ),
  );

  // 5. Continuous Hindlimb Coat + Dark Points
  const hl = hindlimbLandmarks(sd);
  g.add(
    mark(
      createSculptedLimbPath(
        [
          { pos: hl.tuberCoxae.clone().add(V3(-0.04, -0.06, -0.02 * sd)), radiusX: 0.145, radiusZ: 0.108 },
          { pos: hl.hip.clone().add(V3(-0.02, 0.02, 0.01 * sd)), radiusX: 0.155, radiusZ: 0.115 },
          { pos: hl.stifle.clone().add(V3(-0.04, 0.03, 0)), radiusX: 0.118, radiusZ: 0.09 },
          { pos: hl.stifle.clone().lerp(hl.hock, 0.52), radiusX: 0.078, radiusZ: 0.058 },
          { pos: hl.hock.clone().add(V3(-0.015, 0.06, 0)), radiusX: 0.05, radiusZ: 0.04 },
        ],
        skinMat,
        18,
      ),
    ),
  );
  g.add(
    mark(
      createSculptedLimbPath(
        [
          { pos: hl.hock.clone().add(V3(-0.015, 0.065, 0)), radiusX: 0.051, radiusZ: 0.04 },
          { pos: hl.hock.clone().add(V3(-0.018, 0, 0)), radiusX: 0.047, radiusZ: 0.038 },
          { pos: hl.hock.clone().lerp(hl.fetlock, 0.5), radiusX: 0.035, radiusZ: 0.029 },
          { pos: hl.fetlock, radiusX: 0.039, radiusZ: 0.033 },
          { pos: hl.pasternMid, radiusX: 0.031, radiusZ: 0.027 },
          { pos: hl.hoofCenter.clone().add(V3(-0.004, 0.036, 0)), radiusX: 0.037, radiusZ: 0.033 },
        ],
        darkPointMat,
        16,
      ),
    ),
  );

  return g;
}

export function buildMuscularAndTegumentaryParts(tex: ProceduralTextureSet): BuiltPart[] {
  const parts: BuiltPart[] = [];
  const msuMat = () => createTissueMaterial('muscle_sup', tex);
  const mprMat = () => createTissueMaterial('muscle_deep', tex);
  const fasMat = () => createTissueMaterial('fascia', tex);
  const tenMat = () => createTissueMaterial('tendon', tex);
  const skinMat = () => createTissueMaterial('skin', tex);
  const darkPointMat = () => createTissueMaterial('skin_points', tex);
  const maneMat = () => createTissueMaterial('mane', tex);
  const hoofMat = () => createTissueMaterial('hoof', tex);

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

  // Helper for bilateral consolidated muscular IDs (cab.*, abd.008)
  const buildBilateralMuscular = (builder: (sd: -1 | 1) => THREE.Object3D): THREE.Group => {
    const g = new THREE.Group();
    g.add(makeSideMarked(builder(-1), 'left'));
    g.add(makeSideMarked(builder(1), 'right'));
    return g;
  };

  // --- 1. INTEGUMENTARY SYSTEM (pel) ---
  const coatGroup = new THREE.Group();
  coatGroup.add(buildHalfEquineCoat(-1, skinMat(), darkPointMat(), maneMat()));
  coatGroup.add(buildHalfEquineCoat(1, skinMat(), darkPointMat(), maneMat()));
  push('equ.teg.pie.001', coatGroup, 'center', V3(0.05, 1.1, 0));

  // Crin (equ.teg.pel.011)
  const maneGroup = new THREE.Group();
  for (let i = 0; i < 16; i++) {
    const t = i / 15;
    const x = THREE.MathUtils.lerp(1.04, 0.39, t);
    const y = THREE.MathUtils.lerp(1.81, 1.48, t) + 0.025 * Math.sin(t * Math.PI);
    const len = 0.16 + 0.07 * Math.sin(t * Math.PI);
    const lock = createMuscleBellyMesh(V3(x, y, -0.012), V3(x - 0.05, y - len, -0.085 - 0.015 * Math.sin(t * Math.PI * 2)), 0.026, 0.42, maneMat(), 0.32);
    lock.userData.side = 'left';
    maneGroup.add(lock);
  }
  maneGroup.add(createMuscleBellyMesh(V3(1.10, 1.79, 0), V3(1.24, 1.65, -0.018), 0.024, 0.45, maneMat(), 0.3));
  push('equ.teg.pel.011', maneGroup, 'left', V3(0.75, 1.64, -0.04));

  // Cola (equ.teg.pel.012)
  const tailGroup = new THREE.Group();
  const strandOffsets = [
    [0, 0, 0.032],
    [-0.015, -0.024, 0.024],
    [0.015, 0.024, 0.024],
    [-0.01, 0.034, 0.02],
    [0.01, -0.034, 0.02],
  ];
  for (const [ox, oz, rad] of strandOffsets) {
    tailGroup.add(
      createTubeCurveMesh(
        [V3(-1.02, 1.28, oz * 0.4), V3(-1.19 + ox, 1.20, oz * 0.8), V3(-1.31 + ox, 0.88, oz), V3(-1.35 + ox * 1.4, 0.44, oz * 0.9)],
        rad,
        maneMat(),
        20,
        9,
      ),
    );
  }
  push('equ.teg.pel.012', tailGroup, 'center', V3(-1.24, 0.94, 0));

  // 4 Keratin Hooves grounded flush at Y = 0
  for (const sd of [-1, 1] as const) {
    const tag = sd === -1 ? 'i' : 'd';
    const side = sd === -1 ? 'left' : 'right';
    const fl = forelimbLandmarks(sd);
    const hl = hindlimbLandmarks(sd);
    push(`equ.teg.cmt.001-${tag}`, createHoofMesh(fl.hoofCenter.x, fl.hoofCenter.z, hoofMat(), 0.28), side);
    push(`equ.teg.cmp.001-${tag}`, createHoofMesh(hl.hoofCenter.x, hl.hoofCenter.z, hoofMat(), 0.22), side);
  }

  // --- 2. HEAD & FACIAL ÉCORCHÉ MUSCULATURE (consolidated bilateral + paired) ---
  // Masetero (equ.mus.cab.018 — curved cheek fan + glistening dorsal aponeurosis)
  push(
    'equ.mus.cab.018',
    buildBilateralMuscular((sd) => {
      const g = new THREE.Group();
      g.add(
        createCurvedMuscleSheetMesh(
          [
            { x: 1.06, yTop: 1.62, yBot: 1.50, zMid: 0.068, zBow: 0.012 },
            { x: 1.13, yTop: 1.62, yBot: 1.47, zMid: 0.072, zBow: 0.016 },
            { x: 1.21, yTop: 1.58, yBot: 1.48, zMid: 0.065, zBow: 0.014 },
            { x: 1.27, yTop: 1.54, yBot: 1.49, zMid: 0.056, zBow: 0.008 },
          ],
          sd,
          msuMat(),
          8,
          false,
        ),
      );
      g.add(createTubeCurveMesh([V3(1.13, 1.615, 0.074 * sd), V3(1.26, 1.54, 0.063 * sd)], 0.006, tenMat(), 8, 6));
      return g;
    }),
    'center',
    V3(1.15, 1.55, 0),
  );

  // Músculo temporal (equ.mus.cab.019 — deep muscle filling temporal fossa above eye/TMJ)
  push(
    'equ.mus.cab.019',
    buildBilateralMuscular((sd) =>
      createOrganMesh(V3(1.11, 1.72, 0.052 * sd), [0.055, 0.036, 0.02], mprMat(), [0, 0, -0.35], 12),
    ),
    'center',
    V3(1.11, 1.72, 0),
  );

  // Orbicular del ojo (equ.mus.cab.002)
  push(
    'equ.mus.cab.002',
    buildBilateralMuscular((sd) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.0065, 8, 16), msuMat());
      ring.position.copy(HEAD.orbitCenter(sd)).add(V3(0, 0, 0.006 * sd));
      ring.rotation.y = (Math.PI / 2) * sd;
      return ring;
    }),
    'center',
    V3(1.19, 1.69, 0),
  );

  // Elevador nasolabial (equ.mus.cab.011 — long fan from frontal bridge down to upper lip/nostril)
  push(
    'equ.mus.cab.011',
    buildBilateralMuscular((sd) =>
      createCurvedMuscleSheetMesh(
        [
          { x: 1.25, yTop: 1.65, yBot: 1.59, zMid: 0.025, zBow: 0.02 },
          { x: 1.38, yTop: 1.55, yBot: 1.48, zMid: 0.032, zBow: 0.018 },
          { x: 1.50, yTop: 1.44, yBot: 1.38, zMid: 0.032, zBow: 0.012 },
        ],
        sd,
        msuMat(),
        6,
      ),
    ),
    'center',
    V3(1.38, 1.51, 0),
  );

  // Elevador del labio superior (equ.mus.cab.012)
  push(
    'equ.mus.cab.012',
    buildBilateralMuscular((sd) =>
      createMuscleUnitWithTendonCaps(V3(1.27, 1.59, 0.052 * sd), V3(1.52, 1.42, 0.014 * sd), 0.011, 0.65, msuMat(), tenMat(), 0.35, 0.1, 0.45),
    ),
    'center',
    V3(1.40, 1.50, 0),
  );

  // Músculo cigomático (equ.mus.cab.015 — thin ribbon facial crest -> lip commissure)
  push(
    'equ.mus.cab.015',
    buildBilateralMuscular((sd) =>
      createMuscleUnitWithTendonCaps(V3(1.25, 1.57, 0.064 * sd), V3(1.48, 1.38, 0.044 * sd), 0.009, 0.5, msuMat(), tenMat(), 0.5, 0.18, 0.18),
    ),
    'center',
    V3(1.36, 1.48, 0),
  );

  // Buccinador (equ.mus.cab.014 — cheek wall closing space cranial to masseter)
  push(
    'equ.mus.cab.014',
    buildBilateralMuscular((sd) =>
      createCurvedMuscleSheetMesh(
        [
          { x: 1.24, yTop: 1.52, yBot: 1.44, zMid: 0.046, zBow: 0.012 },
          { x: 1.36, yTop: 1.46, yBot: 1.38, zMid: 0.042, zBow: 0.012 },
          { x: 1.47, yTop: 1.40, yBot: 1.35, zMid: 0.036, zBow: 0.008 },
        ],
        sd,
        mprMat(),
        6,
      ),
    ),
    'center',
    V3(1.36, 1.43, 0),
  );

  // Orbicular de la boca (equ.mus.cab.013) & Depresor del labio inferior (equ.mus.cab.016)
  push(
    'equ.mus.cab.013',
    buildBilateralMuscular((sd) =>
      createOrganMesh(V3(1.525, 1.37, 0.025 * sd), [0.026, 0.024, 0.02], msuMat(), [0, 0, -0.45], 10),
    ),
    'center',
    V3(1.525, 1.37, 0),
  );
  push(
    'equ.mus.cab.016',
    buildBilateralMuscular((sd) =>
      createMuscleBellyMesh(V3(1.30, 1.41, 0.042 * sd), V3(1.49, 1.32, 0.024 * sd), 0.009, 0.55, msuMat()),
    ),
    'center',
    V3(1.40, 1.36, 0),
  );

  // --- 3. PAIRED BODY, NECK, THORAX, ABDOMEN & LIMB MUSCULATURE ---
  for (const sd of [-1, 1] as const) {
    const tag = sd === -1 ? 'i' : 'd';
    const side = sd === -1 ? 'left' : 'right';
    const fl = forelimbLandmarks(sd);
    const hl = hindlimbLandmarks(sd);

    // Facial malar & nasal transversus
    push(`equ.mus.cab.028-${tag}`, createMuscleBellyMesh(V3(1.22, 1.63, 0.068 * sd), V3(1.29, 1.54, 0.058 * sd), 0.014, 0.4, msuMat()), side);
    push(`equ.mus.cab.049-${tag}`, createOrganMesh(V3(1.51, 1.42, 0.016 * sd), [0.02, 0.012, 0.015], msuMat(), [0, 0, -0.4], 10), side);

    // NECK ÉCORCHÉ (braquiocefálico, esternocefálico, omotransverso, esplenio, romboides, serrato ventral cervical, omohioideo, esternohioideo)
    push(
      `equ.mus.cue.002-${tag}`, // Braquiocefálico
      createMuscleUnitWithTendonCaps(V3(0.99, 1.66, 0.056 * sd), fl.shoulder.clone().add(V3(0.03, 0.02, 0.01 * sd)), 0.058, 0.48, msuMat(), tenMat(), 0.45, 0.1, 0.14),
      side,
    );
    push(
      `equ.mus.cue.003-${tag}`, // Esternocefálico
      createMuscleUnitWithTendonCaps(HEAD.jawAngle(sd), V3(0.49, 0.94, 0.04 * sd), 0.035, 0.55, msuMat(), tenMat(), 0.5, 0.18, 0.14),
      side,
    );
    push(
      `equ.mus.ext.006-${tag}`, // Omotransverso (fills neck-shoulder bridge between C1-C4 and brachiocephalicus/supraspinatus)
      createMuscleUnitWithTendonCaps(V3(0.95, 1.69, 0.054 * sd), fl.shoulder.clone().add(V3(0.01, 0.09, 0.024 * sd)), 0.042, 0.45, msuMat(), tenMat(), 0.48, 0.12, 0.16),
      side,
    );
    push(
      `equ.mus.cue.007-${tag}`, // Esplenio
      createMuscleBellyMesh(V3(0.97, 1.74, 0.044 * sd), V3(0.44, 1.44, 0.058 * sd), 0.068, 0.4, msuMat(), 0.45),
      side,
    );
    push(
      `equ.mus.ext.007-${tag}`, // Serrato ventral cervical (wide neck fan from C3-C7 onto cranial scapula)
      createCurvedMuscleSheetMesh(
        [
          { x: 0.40, yTop: 1.43, yBot: 1.24, zMid: 0.11, zBow: 0.028 },
          { x: 0.56, yTop: 1.49, yBot: 1.29, zMid: 0.085, zBow: 0.028 },
          { x: 0.72, yTop: 1.56, yBot: 1.38, zMid: 0.062, zBow: 0.024 },
          { x: 0.85, yTop: 1.63, yBot: 1.48, zMid: 0.046, zBow: 0.015 },
        ],
        sd,
        mprMat(),
        8,
      ),
      side,
    );
    push(
      `equ.mus.ext.003-${tag}`, // Romboides cervical (dorsal neck crest strip)
      createMuscleBellyMesh(V3(0.94, 1.75, 0.022 * sd), V3(0.36, 1.46, 0.055 * sd), 0.036, 0.45, mprMat()),
      side,
    );
    push(
      `equ.mus.cue.008-${tag}`, // Semiespinoso de la cabeza (deep dorsal neck bulk)
      createMuscleBellyMesh(V3(1.00, 1.75, 0.03 * sd), V3(0.42, 1.42, 0.042 * sd), 0.048, 0.55, mprMat()),
      side,
    );
    push(
      `equ.mus.cue.011-${tag}`, // Longuísimo del cuello
      createMuscleBellyMesh(V3(0.86, 1.62, 0.038 * sd), V3(0.50, 1.26, 0.048 * sd), 0.038, 0.65, mprMat()),
      side,
    );
    push(
      `equ.mus.cue.004-${tag}`, // Omohioideo & Esternohioideo (005) flooring jugular groove
      createMuscleBellyMesh(V3(0.95, 1.59, 0.028 * sd), V3(0.54, 1.16, 0.048 * sd), 0.024, 0.45, mprMat()),
      side,
    );
    push(
      `equ.mus.cue.005-${tag}`,
      createMuscleBellyMesh(V3(0.93, 1.56, 0.016 * sd), V3(0.49, 0.96, 0.018 * sd), 0.019, 0.65, mprMat()),
      side,
    );

    // WITHERS, BACK & THORAX ÉCORCHÉ
    push(
      `equ.mus.ext.001-${tag}`, // Trapecio cervical
      createMuscleBellyMesh(V3(0.84, 1.66, 0.04 * sd), V3(0.36, 1.38, 0.115 * sd), 0.068, 0.3, msuMat(), 0.55),
      side,
    );
    push(
      `equ.mus.ext.002-${tag}`, // Trapecio torácico
      createMuscleBellyMesh(V3(0.32, 1.46, 0.04 * sd), V3(0.18, 1.26, 0.14 * sd), 0.062, 0.3, msuMat(), 0.45),
      side,
    );
    push(
      `equ.mus.ext.004-${tag}`, // Romboides torácico
      createMuscleBellyMesh(V3(0.40, 1.47, 0.03 * sd), V3(0.24, 1.35, 0.125 * sd), 0.042, 0.38, mprMat()),
      side,
    );

    // Longuísimo lumbar (dor.003) & torácico (dor.004) + Iliocostal lumbar (dor.001) & torácico (dor.002)
    push(
      `equ.mus.dor.003-${tag}`,
      createCurvedMuscleSheetMesh(
        [
          { x: -0.76, yTop: 1.39, yBot: 1.27, zMid: 0.035, zBow: 0.055 },
          { x: -0.56, yTop: 1.40, yBot: 1.27, zMid: 0.04, zBow: 0.065 },
          { x: -0.35, yTop: 1.39, yBot: 1.27, zMid: 0.04, zBow: 0.065 },
        ],
        sd,
        msuMat(),
        8,
      ),
      side,
    );
    push(
      `equ.mus.dor.004-${tag}`,
      createCurvedMuscleSheetMesh(
        [
          { x: -0.35, yTop: 1.39, yBot: 1.27, zMid: 0.04, zBow: 0.065 },
          { x: -0.05, yTop: 1.38, yBot: 1.25, zMid: 0.045, zBow: 0.07 },
          { x: 0.25, yTop: 1.38, yBot: 1.24, zMid: 0.045, zBow: 0.06 },
          { x: 0.46, yTop: 1.34, yBot: 1.23, zMid: 0.04, zBow: 0.04 },
        ],
        sd,
        msuMat(),
        8,
      ),
      side,
    );
    push(
      `equ.mus.dor.001-${tag}`,
      createMuscleBellyMesh(V3(-0.70, 1.33, 0.095 * sd), V3(-0.34, 1.28, 0.125 * sd), 0.034, 0.6, msuMat()),
      side,
    );
    push(
      `equ.mus.dor.002-${tag}`,
      createMuscleBellyMesh(V3(-0.34, 1.28, 0.125 * sd), V3(0.38, 1.22, 0.105 * sd), 0.032, 0.55, msuMat()),
      side,
    );

    // Serrato dorsal craneal (tor.001) & caudal (tor.002)
    push(
      `equ.mus.tor.001-${tag}`,
      createCurvedMuscleSheetMesh(
        [
          { x: -0.02, yTop: 1.32, yBot: 1.19, zMid: 0.14, zBow: 0.065 },
          { x: 0.16, yTop: 1.33, yBot: 1.19, zMid: 0.13, zBow: 0.06 },
          { x: 0.30, yTop: 1.33, yBot: 1.21, zMid: 0.11, zBow: 0.04 },
        ],
        sd,
        msuMat(),
        6,
      ),
      side,
    );
    push(
      `equ.mus.tor.002-${tag}`,
      createCurvedMuscleSheetMesh(
        [
          { x: -0.36, yTop: 1.31, yBot: 1.16, zMid: 0.14, zBow: 0.06 },
          { x: -0.18, yTop: 1.32, yBot: 1.16, zMid: 0.15, zBow: 0.07 },
          { x: -0.02, yTop: 1.32, yBot: 1.18, zMid: 0.14, zBow: 0.065 },
        ],
        sd,
        msuMat(),
        6,
      ),
      side,
    );

    // Serrato ventral torácico (equ.mus.ext.008-i/d) — iconic Biosphera serrated fan on cranial ribcage!
    const serrThor = new THREE.Group();
    for (let dig = 0; dig < 7; dig++) {
      const rIdx = 2 + dig;
      const arc = ribArcPoints(rIdx, sd);
      const originRib = arc[2].clone().lerp(arc[3], 0.35 + dig * 0.05);
      const insScap = fl.scapulaTop.clone().lerp(fl.shoulder, 0.25).add(V3(-0.02 + dig * 0.008, -0.02, -0.015 * sd));
      serrThor.add(createMuscleUnitWithTendonCaps(originRib, insScap, 0.028, 0.38, mprMat(), tenMat(), 0.42, 0.2, 0.1));
    }
    push(`equ.mus.ext.008-${tag}`, serrThor, side);

    // 17 Intercostales externos (equ.mus.tor.012..028-i/d) filling EVERY rib space in mpr!
    for (let sp = 1; sp <= 17; sp++) {
      const arcA = ribArcPoints(sp, sd);
      const arcB = ribArcPoints(sp + 1, sd);
      const icStations = [0, 1, 2, 3, 4].map((idx) => {
        const pA = arcA[idx];
        const pB = arcB[idx];
        const midX = (pA.x + pB.x) * 0.5;
        const midZ = Math.abs(pA.z + pB.z) * 0.5;
        return {
          x: midX,
          yTop: Math.max(pA.y, pB.y),
          yBot: Math.min(pA.y, pB.y) - 0.005,
          zMid: midZ,
          zBow: 0.008,
        };
      });
      // Build spanning sheet directly between consecutive rib curves
      const positions: number[] = [];
      const uvs: number[] = [];
      const indices: number[] = [];
      for (let k = 0; k < 5; k++) {
        const p1 = arcA[k];
        const p2 = arcB[k];
        positions.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
        uvs.push(k / 4, 0, k / 4, 1);
      }
      for (let k = 0; k < 4; k++) {
        const a = k * 2;
        const b = a + 1;
        const c = a + 2;
        const d = a + 3;
        if (sd === 1) indices.push(a, c, b, b, c, d);
        else indices.push(a, b, c, b, d, c);
      }
      void icStations;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geo.setIndex(indices);
      geo.computeVertexNormals();
      const icMat = mprMat().clone();
      icMat.side = THREE.DoubleSide;
      const icMesh = new THREE.Mesh(geo, icMat);
      icMesh.castShadow = true;
      icMesh.receiveShadow = true;
      const icIdNum = 11 + sp; // 012..028
      push(`equ.mus.tor.${String(icIdNum).padStart(3, '0')}-${tag}`, icMesh, side);
    }

    // Dorsal ancho / Latissimus dorsi (equ.mus.ext.005-i/d)
    push(
      `equ.mus.ext.005-${tag}`,
      createCurvedMuscleSheetMesh(
        [
          { x: -0.34, yTop: 1.37, yBot: 1.24, zMid: 0.15, zBow: 0.05 },
          { x: -0.14, yTop: 1.35, yBot: 1.15, zMid: 0.19, zBow: 0.065 },
          { x: 0.08, yTop: 1.33, yBot: 1.07, zMid: 0.21, zBow: 0.06 },
          { x: 0.28, yTop: 1.26, yBot: 0.99, zMid: 0.18, zBow: 0.035 },
          { x: 0.42, yTop: 1.12, yBot: 0.98, zMid: 0.155, zBow: 0.015 },
        ],
        sd,
        msuMat(),
        10,
      ),
      side,
    );

    // Fascia toracolumbar (equ.mus.tor.011-i/d) — verified exact ID!
    push(
      `equ.mus.tor.011-${tag}`,
      createCurvedMuscleSheetMesh(
        [
          { x: -0.78, yTop: 1.40, yBot: 1.26, zMid: 0.05, zBow: 0.068 },
          { x: -0.55, yTop: 1.44, yBot: 1.25, zMid: 0.06, zBow: 0.082 },
          { x: -0.32, yTop: 1.42, yBot: 1.25, zMid: 0.06, zBow: 0.086 },
          { x: -0.12, yTop: 1.39, yBot: 1.24, zMid: 0.05, zBow: 0.07 },
        ],
        sd,
        fasMat(),
        8,
      ),
      side,
    );

    // Pectoral descendente (009), transverso (010), profundo ascendente (011)
    push(
      `equ.mus.ext.009-${tag}`,
      createMuscleBellyMesh(V3(0.49, 0.93, 0.02 * sd), fl.shoulder.clone().add(V3(0.02, -0.12, 0)), 0.082, 0.72, msuMat(), 0.45),
      side,
    );
    push(
      `equ.mus.ext.010-${tag}`,
      createMuscleBellyMesh(V3(0.34, 0.85, 0.02 * sd), fl.elbow.clone().add(V3(0, 0.02, -0.02 * sd)), 0.048, 0.55, msuMat()),
      side,
    );
    push(
      `equ.mus.ext.011-${tag}`, // Pectoral profundo ascendente (sternum -> cranial humerus)
      createMuscleBellyMesh(V3(-0.04, 0.80, 0.075 * sd), fl.shoulder.clone().add(V3(0.01, 0.02, -0.02 * sd)), 0.072, 0.48, mprMat(), 0.52),
      side,
    );

    // ABDOMINAL WALL ÉCORCHÉ (oblicuo externo, interno, recto abdomen, túnica flava)
    push(
      `equ.mus.abd.001-${tag}`, // Oblicuo externo del abdomen
      createCurvedMuscleSheetMesh(
        [
          { x: -0.68, yTop: 1.24, yBot: 0.96, zMid: 0.15, zBow: 0.05 },
          { x: -0.48, yTop: 1.23, yBot: 0.87, zMid: 0.16, zBow: 0.08 },
          { x: -0.25, yTop: 1.21, yBot: 0.82, zMid: 0.17, zBow: 0.095 },
          { x: -0.02, yTop: 1.18, yBot: 0.81, zMid: 0.17, zBow: 0.09 },
          { x: 0.16, yTop: 1.13, yBot: 0.84, zMid: 0.15, zBow: 0.055 },
        ],
        sd,
        msuMat(),
        10,
      ),
      side,
    );
    push(
      `equ.mus.abd.002-${tag}`, // Oblicuo interno del abdomen (bridging tuber coxae paralumbar fossa!)
      createCurvedMuscleSheetMesh(
        [
          { x: -0.71, yTop: 1.32, yBot: 1.00, zMid: 0.15, zBow: 0.045 },
          { x: -0.56, yTop: 1.26, yBot: 0.91, zMid: 0.16, zBow: 0.06 },
          { x: -0.38, yTop: 1.20, yBot: 0.86, zMid: 0.165, zBow: 0.07 },
        ],
        sd,
        mprMat(),
        8,
      ),
      side,
    );
    push(
      `equ.mus.abd.004-${tag}`, // Recto del abdomen (ventral abdominal strap sternum -> pubis)
      createCurvedMuscleSheetMesh(
        [
          { x: -0.75, yTop: 1.06, yBot: 0.98, zMid: 0.015, zBow: 0.05 },
          { x: -0.50, yTop: 0.89, yBot: 0.82, zMid: 0.015, zBow: 0.085 },
          { x: -0.20, yTop: 0.81, yBot: 0.745, zMid: 0.015, zBow: 0.095 },
          { x: 0.12, yTop: 0.84, yBot: 0.78, zMid: 0.015, zBow: 0.07 },
        ],
        sd,
        mprMat(),
        6,
      ),
      side,
    );
    push(
      `equ.mus.abd.006-${tag}`, // Túnica flava del abdomen (fascia pearly ventral sheet)
      createCurvedMuscleSheetMesh(
        [
          { x: -0.62, yTop: 0.97, yBot: 0.89, zMid: 0.04, zBow: 0.09 },
          { x: -0.32, yTop: 0.87, yBot: 0.77, zMid: 0.03, zBow: 0.14 },
          { x: 0.02, yTop: 0.84, yBot: 0.76, zMid: 0.03, zBow: 0.12 },
        ],
        sd,
        fasMat(),
        6,
      ),
      side,
    );

    // FORELIMB ÉCORCHÉ
    push(
      `equ.mus.hom.001-${tag}`, // Supraespinoso
      createMuscleUnitWithTendonCaps(fl.scapulaTop.clone().add(V3(0.04, -0.02, 0.02 * sd)), fl.shoulder.clone().add(V3(0.03, 0.02, 0.01 * sd)), 0.056, 0.48, mprMat(), tenMat(), 0.45, 0.08, 0.18),
      side,
    );
    push(
      `equ.mus.hom.002-${tag}`, // Infraespinoso (fills caudal scapular fossa!)
      createMuscleUnitWithTendonCaps(fl.scapulaTop.clone().add(V3(-0.04, -0.02, 0.02 * sd)), fl.shoulder.clone().add(V3(-0.02, 0.01, 0.03 * sd)), 0.054, 0.42, mprMat(), tenMat(), 0.45, 0.08, 0.2),
      side,
    );
    push(
      `equ.mus.hom.003-${tag}`, // Deltoides
      createMuscleUnitWithTendonCaps(V3(0.34, 1.34, 0.165 * sd), fl.shoulder.clone().add(V3(-0.04, -0.09, 0.026 * sd)), 0.052, 0.45, msuMat(), tenMat(), 0.42, 0.12, 0.18),
      side,
    );
    push(
      `equ.mus.hom.005-${tag}`, // Redondo mayor (medial caudal border scapula -> humerus)
      createMuscleBellyMesh(fl.scapulaTop.clone().add(V3(-0.06, -0.06, -0.01 * sd)), fl.elbow.clone().add(V3(0.02, 0.14, -0.02 * sd)), 0.036, 0.5, mprMat()),
      side,
    );
    push(
      `equ.mus.bra.007-${tag}`, // Tríceps cabeza larga
      createMuscleUnitWithTendonCaps(V3(0.28, 1.24, 0.16 * sd), fl.elbow.clone().add(V3(-0.02, 0.06, 0.01 * sd)), 0.082, 0.55, msuMat(), tenMat(), 0.42, 0.1, 0.15),
      side,
    );
    push(
      `equ.mus.bra.008-${tag}`, // Tríceps cabeza lateral
      createMuscleUnitWithTendonCaps(fl.shoulder.clone().add(V3(-0.03, -0.03, 0.024 * sd)), fl.elbow.clone().add(V3(-0.01, 0.05, 0.022 * sd)), 0.048, 0.55, msuMat(), tenMat(), 0.46, 0.12, 0.15),
      side,
    );
    push(
      `equ.mus.bra.002-${tag}`, // Tensor de la fascia del antebrazo (caudal border of triceps -> olecranon)
      createMuscleBellyMesh(V3(0.26, 1.18, 0.14 * sd), fl.elbow.clone().add(V3(-0.036, 0.07, 0)), 0.032, 0.35, msuMat()),
      side,
    );
    push(
      `equ.mus.bra.004-${tag}`, // Bíceps braquial (cranial humerus with lacertus fibrosus tendon!)
      createMuscleUnitWithTendonCaps(fl.shoulder.clone().add(V3(0.02, 0.01, 0)), fl.elbow.clone().add(V3(0.02, -0.02, 0)), 0.044, 0.72, mprMat(), tenMat(), 0.48, 0.16, 0.18),
      side,
    );
    push(
      `equ.mus.bra.005-${tag}`, // Braquial (lateral musculospiral groove humerus)
      createMuscleBellyMesh(fl.shoulder.clone().add(V3(-0.02, -0.04, 0.022 * sd)), fl.elbow.clone().add(V3(0.015, -0.01, 0.01 * sd)), 0.032, 0.65, mprMat()),
      side,
    );

    // Forearm extensors & flexors (closing entire antebrachium volume!)
    const ercGrp = new THREE.Group();
    ercGrp.add(createMuscleUnitWithTendonCaps(fl.elbow.clone().add(V3(0.025, 0.02, 0.008 * sd)), fl.carpus.clone().add(V3(0.018, 0.08, 0)), 0.036, 0.65, msuMat(), tenMat(), 0.3, 0.1, 0.25));
    ercGrp.add(createTubeCurveMesh([fl.carpus.clone().add(V3(0.018, 0.08, 0)), fl.carpus.clone().add(V3(0.018, -0.03, -0.004 * sd))], 0.007, tenMat(), 8, 6));
    push(`equ.mus.ant.001-${tag}`, ercGrp, side);

    const edcGrp = new THREE.Group();
    edcGrp.add(createMuscleUnitWithTendonCaps(fl.elbow.clone().add(V3(0.015, 0.0, 0.022 * sd)), fl.carpus.clone().add(V3(0.016, 0.08, 0.01 * sd)), 0.027, 0.65, msuMat(), tenMat(), 0.35, 0.1, 0.22));
    edcGrp.add(
      createTubeCurveMesh(
        [
          fl.carpus.clone().add(V3(0.016, 0.08, 0.008 * sd)),
          fl.carpus.clone().add(V3(0.018, 0, 0)),
          fl.fetlock.clone().add(V3(0.022, 0, 0)),
          fl.pasternMid.clone().add(V3(0.018, 0, 0)),
          fl.hoofCenter.clone().add(V3(0.02, 0.042, 0)),
        ],
        0.0065,
        tenMat(),
        18,
        7,
      ),
    );
    push(`equ.mus.ant.002-${tag}`, edcGrp, side);

    const edlFore = new THREE.Group();
    edlFore.add(createMuscleUnitWithTendonCaps(fl.elbow.clone().add(V3(0.002, -0.01, 0.028 * sd)), fl.carpus.clone().add(V3(0.006, 0.08, 0.02 * sd)), 0.019, 0.65, msuMat(), tenMat(), 0.35, 0.1, 0.22));
    edlFore.add(createTubeCurveMesh([fl.carpus.clone().add(V3(0.006, 0.08, 0.02 * sd)), fl.carpus.clone().add(V3(0.008, 0, 0.018 * sd)), fl.fetlock.clone().add(V3(0.012, 0, 0.01 * sd))], 0.0045, tenMat(), 12, 6));
    push(`equ.mus.ant.003-${tag}`, edlFore, side);

    // Extensor ulnar del carpo / Ulnaris lateralis (equ.mus.ant.004-i/d — lateral forearm!)
    push(
      `equ.mus.ant.004-${tag}`,
      createMuscleUnitWithTendonCaps(fl.elbow.clone().add(V3(-0.014, -0.01, 0.026 * sd)), fl.carpus.clone().add(V3(-0.024, 0.02, 0.016 * sd)), 0.026, 0.62, msuMat(), tenMat(), 0.34, 0.1, 0.25),
      side,
    );
    // Flexor radial del carpo (006) & Flexor ulnar del carpo (007)
    push(
      `equ.mus.ant.006-${tag}`,
      createMuscleUnitWithTendonCaps(fl.elbow.clone().add(V3(-0.015, -0.01, -0.02 * sd)), fl.carpus.clone().add(V3(-0.018, 0.02, -0.016 * sd)), 0.023, 0.65, msuMat(), tenMat(), 0.35, 0.1, 0.24),
      side,
    );
    push(
      `equ.mus.ant.007-${tag}`,
      createMuscleUnitWithTendonCaps(fl.elbow.clone().add(V3(-0.03, 0.02, -0.008 * sd)), fl.carpus.clone().add(V3(-0.026, 0.02, 0.012 * sd)), 0.026, 0.58, msuMat(), tenMat(), 0.34, 0.1, 0.22),
      side,
    );

    const sdfGrp = new THREE.Group();
    sdfGrp.add(createMuscleUnitWithTendonCaps(fl.elbow.clone().add(V3(-0.02, -0.01, -0.005 * sd)), fl.carpus.clone().add(V3(-0.024, 0.10, 0)), 0.032, 0.65, msuMat(), tenMat(), 0.35, 0.1, 0.2));
    const sdfFet = fl.fetlock.clone().add(V3(-0.026, 0, 0));
    sdfGrp.add(createTubeCurveMesh([fl.carpus.clone().add(V3(-0.024, 0.10, 0)), fl.carpus.clone().add(V3(-0.028, 0, 0)), sdfFet], 0.007, tenMat(), 12, 7));
    sdfGrp.add(createTubeCurveMesh([sdfFet, fl.pasternMid.clone().add(V3(-0.016, -0.008, -0.013 * sd))], 0.005, tenMat(), 8, 6));
    sdfGrp.add(createTubeCurveMesh([sdfFet, fl.pasternMid.clone().add(V3(-0.016, -0.008, 0.013 * sd))], 0.005, tenMat(), 8, 6));
    push(`equ.mus.ant.008-${tag}`, sdfGrp, side);

    const ddfGrp = new THREE.Group();
    ddfGrp.add(createMuscleUnitWithTendonCaps(fl.elbow.clone().add(V3(-0.012, -0.02, 0.005 * sd)), fl.carpus.clone().add(V3(-0.018, 0.11, 0)), 0.03, 0.65, mprMat(), tenMat(), 0.35, 0.1, 0.2));
    ddfGrp.add(
      createTubeCurveMesh(
        [
          fl.carpus.clone().add(V3(-0.018, 0.11, 0)),
          fl.carpus.clone().add(V3(-0.02, 0, 0)),
          fl.fetlock.clone().add(V3(-0.02, 0, 0)),
          fl.coronet.clone().add(V3(-0.024, -0.01, 0)),
          fl.hoofCenter.clone().add(V3(-0.008, 0.01, 0)),
        ],
        0.0075,
        tenMat(),
        18,
        7,
      ),
    );
    push(`equ.mus.ant.010-${tag}`, ddfGrp, side);

    // HINDLIMB & CROUP ÉCORCHÉ
    push(
      `equ.mus.cad.001-${tag}`, // Glúteo superficial
      createMuscleUnitWithTendonCaps(V3(-0.74, 1.32, 0.16 * sd), hl.hip.clone().add(V3(-0.04, -0.04, 0.04 * sd)), 0.058, 0.42, msuMat(), tenMat(), 0.45, 0.14, 0.18),
      side,
    );
    push(
      `equ.mus.cad.002-${tag}`, // Glúteo medio (croup dome)
      createCurvedMuscleSheetMesh(
        [
          { x: -0.96, yTop: 1.34, yBot: 1.18, zMid: 0.09, zBow: 0.06 },
          { x: -0.82, yTop: 1.39, yBot: 1.15, zMid: 0.11, zBow: 0.09 },
          { x: -0.66, yTop: 1.38, yBot: 1.16, zMid: 0.11, zBow: 0.085 },
          { x: -0.54, yTop: 1.35, yBot: 1.21, zMid: 0.09, zBow: 0.05 },
        ],
        sd,
        msuMat(),
        8,
      ),
      side,
    );
    push(
      `equ.mus.cad.003-${tag}`, // Glúteo profundo
      createMuscleBellyMesh(V3(-0.78, 1.25, 0.11 * sd), hl.hip.clone().add(V3(-0.01, 0.04, 0.01 * sd)), 0.04, 0.55, mprMat()),
      side,
    );
    push(
      `equ.mus.cad.004-${tag}`, // Tensor de la fascia lata (triangular fan from tuber coxae!)
      createMuscleUnitWithTendonCaps(hl.tuberCoxae, hl.stifle.clone().add(V3(0.01, 0.11, 0.03 * sd)), 0.055, 0.34, msuMat(), tenMat(), 0.35, 0.08, 0.25),
      side,
    );
    push(
      `equ.mus.fas.017-${tag}`, // Fascia lata (pearly lateral thigh aponeurosis sheet!)
      createCurvedMuscleSheetMesh(
        [
          { x: -0.78, yTop: 1.22, yBot: 0.90, zMid: 0.14, zBow: 0.065 },
          { x: -0.69, yTop: 1.20, yBot: 0.87, zMid: 0.15, zBow: 0.072 },
          { x: -0.60, yTop: 1.14, yBot: 0.88, zMid: 0.13, zBow: 0.05 },
        ],
        sd,
        fasMat(),
        8,
      ),
      side,
    );

    // Cuádriceps femoral (recto femoral 004, vasto lateral 005, vasto medial 006)
    push(
      `equ.mus.fem.004-${tag}`,
      createMuscleUnitWithTendonCaps(hl.hip.clone().add(V3(0.04, 0.02, 0)), hl.stifle.clone().add(V3(0.04, 0.03, 0)), 0.052, 0.72, mprMat(), tenMat(), 0.45, 0.1, 0.15),
      side,
    );
    push(
      `equ.mus.fem.005-${tag}`, // Vasto lateral (large lateral thigh muscle)
      createMuscleUnitWithTendonCaps(hl.hip.clone().add(V3(-0.01, 0.02, 0.03 * sd)), hl.stifle.clone().add(V3(0.03, 0.02, 0.025 * sd)), 0.062, 0.55, mprMat(), tenMat(), 0.46, 0.1, 0.15),
      side,
    );
    push(
      `equ.mus.fem.006-${tag}`, // Vasto medial
      createMuscleUnitWithTendonCaps(hl.hip.clone().add(V3(0.01, -0.02, -0.02 * sd)), hl.stifle.clone().add(V3(0.03, 0.02, -0.02 * sd)), 0.048, 0.6, mprMat(), tenMat(), 0.46, 0.1, 0.15),
      side,
    );

    // Bíceps femoral vertebral (012) & pélvica (013), Semitendinoso (002), Semimembranoso (003), Sartorio (008), Grácil (009)
    push(
      `equ.mus.fem.012-${tag}`,
      createMuscleUnitWithTendonCaps(V3(-0.88, 1.24, 0.165 * sd), hl.stifle.clone().add(V3(-0.04, -0.04, 0.03 * sd)), 0.086, 0.55, msuMat(), tenMat(), 0.38, 0.12, 0.18),
      side,
    );
    push(
      `equ.mus.fem.013-${tag}`,
      createMuscleUnitWithTendonCaps(hl.tuberIschii.clone().add(V3(0.02, -0.02, 0.02 * sd)), hl.hock.clone().add(V3(0.01, 0.24, 0.02 * sd)), 0.064, 0.5, msuMat(), tenMat(), 0.38, 0.1, 0.22),
      side,
    );
    push(
      `equ.mus.fem.002-${tag}`,
      createMuscleUnitWithTendonCaps(hl.tuberIschii.clone().add(V3(0, 0.03, 0.01 * sd)), hl.hock.clone().add(V3(0.02, 0.18, -0.02 * sd)), 0.064, 0.65, msuMat(), tenMat(), 0.35, 0.1, 0.22),
      side,
    );
    push(
      `equ.mus.fem.003-${tag}`, // Semimembranoso (massive medial/caudal thigh!)
      createMuscleUnitWithTendonCaps(hl.tuberIschii.clone().add(V3(0.02, -0.02, -0.035 * sd)), hl.stifle.clone().add(V3(-0.03, -0.02, -0.03 * sd)), 0.074, 0.55, msuMat(), tenMat(), 0.42, 0.1, 0.16),
      side,
    );
    push(
      `equ.mus.fem.008-${tag}`, // Sartorio (medial thigh ribbon)
      createMuscleBellyMesh(V3(-0.70, 1.22, 0.04 * sd), hl.stifle.clone().add(V3(0, -0.02, -0.045 * sd)), 0.02, 0.45, msuMat()),
      side,
    );
    push(
      `equ.mus.fem.009-${tag}`, // Grácil (wide medial thigh sheet!)
      createMuscleBellyMesh(V3(-0.84, 1.07, 0.04 * sd), hl.stifle.clone().add(V3(-0.02, -0.07, -0.035 * sd)), 0.056, 0.28, msuMat()),
      side,
    );

    // GASKIN / LEG ÉCORCHÉ (Gastrocnemio lat/med, FDS, FDL, Tibial craneal, Fibular III, Extensores largo/lateral)
    const gastGrp = new THREE.Group();
    gastGrp.add(createMuscleUnitWithTendonCaps(hl.stifle.clone().add(V3(-0.04, -0.02, 0.01 * sd)), hl.calcaneusTip.clone().add(V3(0.01, 0.12, 0)), 0.048, 0.72, msuMat(), tenMat(), 0.32, 0.1, 0.25));
    gastGrp.add(createTubeCurveMesh([hl.calcaneusTip.clone().add(V3(0.01, 0.13, 0)), hl.calcaneusTip], 0.01, tenMat(), 10, 7));
    push(`equ.mus.pie.001-${tag}`, gastGrp, side);

    push(
      `equ.mus.pie.002-${tag}`, // Gastrocnemio medial
      createMuscleUnitWithTendonCaps(hl.stifle.clone().add(V3(-0.04, -0.02, -0.012 * sd)), hl.calcaneusTip.clone().add(V3(0.01, 0.10, 0)), 0.044, 0.7, msuMat(), tenMat(), 0.32, 0.1, 0.28),
      side,
    );

    const sdfHGrp = new THREE.Group();
    sdfHGrp.add(
      createTubeCurveMesh(
        [hl.stifle.clone().add(V3(-0.025, -0.03, 0)), hl.calcaneusTip.clone().add(V3(-0.012, 0.01, 0)), hl.hock.clone().add(V3(-0.03, -0.02, 0)), hl.fetlock.clone().add(V3(-0.026, 0, 0)), hl.pasternMid.clone().add(V3(-0.016, -0.008, 0))],
        0.007,
        tenMat(),
        22,
        7,
      ),
    );
    push(`equ.mus.pie.004-${tag}`, sdfHGrp, side);

    const fdlHGrp = new THREE.Group(); // Flexor digital lateral (gaskin deep flexor belly + plantar DDFT)
    fdlHGrp.add(createMuscleUnitWithTendonCaps(hl.stifle.clone().add(V3(-0.02, -0.06, 0.015 * sd)), hl.hock.clone().add(V3(-0.015, 0.08, 0)), 0.034, 0.65, mprMat(), tenMat(), 0.36, 0.1, 0.24));
    fdlHGrp.add(createTubeCurveMesh([hl.hock.clone().add(V3(-0.018, 0.08, 0)), hl.hock.clone().add(V3(-0.02, 0, 0)), hl.fetlock.clone().add(V3(-0.02, 0, 0)), hl.hoofCenter.clone().add(V3(-0.008, 0.01, 0))], 0.007, tenMat(), 16, 7));
    push(`equ.mus.pie.005-${tag}`, fdlHGrp, side);

    push(
      `equ.mus.pie.008-${tag}`, // Tibial craneal
      createMuscleUnitWithTendonCaps(hl.stifle.clone().add(V3(0.01, -0.05, 0)), hl.hock.clone().add(V3(0.018, 0.04, -0.01 * sd)), 0.026, 0.65, mprMat(), tenMat(), 0.32, 0.08, 0.25),
      side,
    );
    push(
      `equ.mus.pie.009-${tag}`, // Fibular tercero (stay apparatus fibrous cord)
      createTubeCurveMesh([hl.stifle.clone().add(V3(0.015, 0.01, 0.012 * sd)), hl.stifle.clone().lerp(hl.hock, 0.5).add(V3(0.024, 0, 0.008 * sd)), hl.hock.clone().add(V3(0.022, -0.02, 0))], 0.008, tenMat(), 14, 7),
      side,
    );

    const edlHGrp = new THREE.Group(); // Extensor digital largo + dorsal tendon to P3!
    edlHGrp.add(createMuscleUnitWithTendonCaps(hl.stifle.clone().add(V3(0.022, -0.02, 0.015 * sd)), hl.hock.clone().add(V3(0.02, 0.07, 0)), 0.03, 0.68, msuMat(), tenMat(), 0.32, 0.1, 0.25));
    edlHGrp.add(
      createTubeCurveMesh(
        [hl.hock.clone().add(V3(0.02, 0.07, 0)), hl.hock.clone().add(V3(0.02, 0, 0)), hl.fetlock.clone().add(V3(0.022, 0, 0)), hl.pasternMid.clone().add(V3(0.018, 0, 0)), hl.hoofCenter.clone().add(V3(0.02, 0.042, 0))],
        0.0065,
        tenMat(),
        16,
        7,
      ),
    );
    push(`equ.mus.pie.010-${tag}`, edlHGrp, side);

    const edLatHGrp = new THREE.Group(); // Extensor digital lateral pélvico
    edLatHGrp.add(createMuscleUnitWithTendonCaps(hl.stifle.clone().add(V3(-0.005, -0.06, 0.026 * sd)), hl.hock.clone().add(V3(0.008, 0.06, 0.018 * sd)), 0.021, 0.62, msuMat(), tenMat(), 0.36, 0.1, 0.24));
    edLatHGrp.add(createTubeCurveMesh([hl.hock.clone().add(V3(0.008, 0.06, 0.018 * sd)), hl.hock.clone().lerp(hl.fetlock, 0.4).add(V3(0.016, 0, 0.01 * sd)), hl.fetlock.clone().add(V3(0.022, 0, 0))], 0.0045, tenMat(), 10, 6));
    push(`equ.mus.pie.011-${tag}`, edLatHGrp, side);

    // Tail dock musculature (Sacrococcígeo dorsal 001 & ventral 003)
    const c1 = V3(...caudalPos(1));
    const c6 = V3(...caudalPos(7));
    push(`equ.mus.col.001-${tag}`, createMuscleBellyMesh(c1.clone().add(V3(0.05, 0.025, 0.018 * sd)), c6.clone().add(V3(0, 0.015, 0.012 * sd)), 0.022, 0.7, mprMat()), side);
    push(`equ.mus.col.003-${tag}`, createMuscleBellyMesh(c1.clone().add(V3(0.05, -0.02, 0.018 * sd)), c6.clone().add(V3(0, -0.015, 0.012 * sd)), 0.02, 0.7, mprMat()), side);

    // Deep Psoas mayor (equ.mus.sub.001-i/d)
    push(
      `equ.mus.sub.001-${tag}`,
      createMuscleBellyMesh(V3(-0.36, 1.28, 0.05 * sd), hl.hip.clone().add(V3(0.05, 0.04, -0.02 * sd)), 0.032, 0.7, mprMat()),
      side,
    );
  }

  // Línea alba (equ.mus.abd.008 — ventral midline tendinous raphe)
  push('equ.mus.abd.008', createTubeCurveMesh([V3(0.10, 0.80, 0), V3(-0.22, 0.74, 0), V3(-0.68, 0.94, 0)], 0.01, fasMat(), 16, 6), 'center');

  // Diafragma (equ.mus.tor.009)
  push('equ.mus.tor.009', createOrganMesh(V3(-0.08, 1.05, 0), [0.09, 0.24, 0.22], mprMat(), [0, 0, -0.45], 18), 'center');

  return parts;
}
