import * as THREE from 'three';
import { forelimbLandmarks, HEAD, hindlimbLandmarks, V3 } from '../anatomyCoords';
import { createTissueMaterial } from '../materials';
import { ProceduralTextureSet } from '../textures';
import { BuiltPart } from './buildSkeletalAndArticular';
import {
  AnatomicalStation,
  createCurvedMuscleSheetMesh,
  createHalfLoftedContourMesh,
  createHoofMesh,
  createMuscleBellyMesh,
  createOrganMesh,
  createSculptedLimbPath,
  createTubeCurveMesh,
} from './geomHelpers';

function buildHalfEquineCoat(
  sd: -1 | 1,
  skinMat: THREE.Material,
  darkPointMat: THREE.Material,
  maneMat: THREE.Material,
): THREE.Group {
  const g = new THREE.Group();
  const side = sd === -1 ? 'left' : 'right';
  g.userData.side = side;

  const mark = <T extends THREE.Object3D>(obj: T): T => {
    obj.userData.side = side;
    return obj;
  };

  // 1. Continuous lofted torso (buttocks -> croup -> flank -> barrel -> withers -> chest)
  const torsoStations: AnatomicalStation[] = [
    { x: -1.11, yCenter: 1.24, halfHeight: 0.015, halfWidth: 0.012 },
    { x: -1.03, yCenter: 1.22, halfHeight: 0.16, halfWidth: 0.145, dorsalTaper: 1.2 },
    { x: -0.84, yCenter: 1.19, halfHeight: 0.245, halfWidth: 0.21, dorsalTaper: 1.25 },
    { x: -0.62, yCenter: 1.14, halfHeight: 0.255, halfWidth: 0.215, flankBias: 0.07 },
    { x: -0.35, yCenter: 1.10, halfHeight: 0.295, halfWidth: 0.255, flankBias: 0.05 },
    { x: -0.04, yCenter: 1.07, halfHeight: 0.335, halfWidth: 0.285, flankBias: 0.03 },
    { x: 0.26, yCenter: 1.16, halfHeight: 0.33, halfWidth: 0.24, dorsalTaper: 1.65 },
    { x: 0.48, yCenter: 1.12, halfHeight: 0.26, halfWidth: 0.19, dorsalTaper: 1.3 },
    { x: 0.61, yCenter: 1.09, halfHeight: 0.155, halfWidth: 0.115 },
    { x: 0.66, yCenter: 1.10, halfHeight: 0.018, halfWidth: 0.014 },
  ];
  g.add(mark(createHalfLoftedContourMesh(torsoStations, sd, skinMat, 24)));

  // 2. Arched equine neck loft (withers/thoracic inlet -> poll/throat)
  const neckStations: AnatomicalStation[] = [
    { x: 0.40, yCenter: 1.27, halfHeight: 0.21, halfWidth: 0.135, dorsalTaper: 1.5 },
    { x: 0.56, yCenter: 1.33, halfHeight: 0.215, halfWidth: 0.13, dorsalTaper: 1.65 },
    { x: 0.72, yCenter: 1.45, halfHeight: 0.19, halfWidth: 0.112, dorsalTaper: 1.75 },
    { x: 0.88, yCenter: 1.58, halfHeight: 0.16, halfWidth: 0.095, dorsalTaper: 1.65 },
    { x: 1.02, yCenter: 1.68, halfHeight: 0.128, halfWidth: 0.084, dorsalTaper: 1.35 },
    { x: 1.08, yCenter: 1.70, halfHeight: 0.03, halfWidth: 0.025 },
  ];
  g.add(mark(createHalfLoftedContourMesh(neckStations, sd, skinMat, 20)));

  // 3. Sculpted equine head (poll/jowl -> cheek -> facial crest -> tapered nasal bridge -> flared muzzle)
  const headStations: AnatomicalStation[] = [
    { x: 0.99, yCenter: 1.70, halfHeight: 0.03, halfWidth: 0.025 },
    { x: 1.07, yCenter: 1.65, halfHeight: 0.14, halfWidth: 0.09 },
    { x: 1.16, yCenter: 1.64, halfHeight: 0.132, halfWidth: 0.095, flankBias: -0.06 },
    { x: 1.28, yCenter: 1.56, halfHeight: 0.098, halfWidth: 0.070 },
    { x: 1.42, yCenter: 1.46, halfHeight: 0.070, halfWidth: 0.054 },
    { x: 1.53, yCenter: 1.38, halfHeight: 0.056, halfWidth: 0.050 },
    { x: 1.59, yCenter: 1.36, halfHeight: 0.015, halfWidth: 0.015 },
  ];
  g.add(mark(createHalfLoftedContourMesh(headStations, sd, skinMat, 20)));

  // Soft dark muzzle tip, nostril flare & lip contour
  g.add(
    mark(
      createOrganMesh(
        V3(1.555, 1.375, 0.024 * sd),
        [0.034, 0.036, 0.028],
        darkPointMat,
        [0, 0, -0.45],
        14,
      ),
    ),
  );
  g.add(
    mark(
      createOrganMesh(
        V3(1.535, 1.405, 0.034 * sd),
        [0.022, 0.016, 0.016],
        maneMat,
        [0.15 * sd, 0.2 * sd, -0.3],
        12,
      ),
    ),
  );

  // Sculpted Equine Ear (external pinna + dark ear tip)
  g.add(
    mark(
      createMuscleBellyMesh(
        V3(1.04, 1.78, 0.048 * sd),
        V3(1.05, 1.94, 0.064 * sd),
        0.025,
        0.62,
        skinMat,
        0.34,
      ),
    ),
  );
  g.add(
    mark(
      createMuscleBellyMesh(
        V3(1.045, 1.88, 0.058 * sd),
        V3(1.055, 1.955, 0.065 * sd),
        0.014,
        0.6,
        darkPointMat,
        0.3,
      ),
    ),
  );

  // 4. Continuous Forelimb Coat (shoulder -> elbow -> forearm -> carpus) + Dark Points (carpus -> fetlock -> coronet)
  const fl = forelimbLandmarks(sd);
  const fUpper = createSculptedLimbPath(
    [
      { pos: fl.scapulaTop.clone().add(V3(0.02, -0.05, 0)), radiusX: 0.11, radiusZ: 0.075 },
      { pos: fl.shoulder.clone().add(V3(-0.02, 0.02, 0)), radiusX: 0.108, radiusZ: 0.08 },
      { pos: fl.elbow.clone().add(V3(0.01, 0.04, 0)), radiusX: 0.095, radiusZ: 0.072 },
      { pos: fl.elbow.clone().lerp(fl.carpus, 0.45), radiusX: 0.068, radiusZ: 0.052 },
      { pos: fl.carpus.clone().add(V3(0, 0.04, 0)), radiusX: 0.044, radiusZ: 0.038 },
    ],
    skinMat,
    18,
  );
  g.add(mark(fUpper));

  const fLower = createSculptedLimbPath(
    [
      { pos: fl.carpus.clone().add(V3(0, 0.045, 0)), radiusX: 0.045, radiusZ: 0.039 },
      { pos: fl.carpus, radiusX: 0.042, radiusZ: 0.038 },
      { pos: fl.carpus.clone().lerp(fl.fetlock, 0.5), radiusX: 0.034, radiusZ: 0.028 },
      { pos: fl.fetlock, radiusX: 0.039, radiusZ: 0.033 },
      { pos: fl.pasternMid, radiusX: 0.031, radiusZ: 0.027 },
      { pos: fl.hoofCenter.clone().add(V3(-0.004, 0.036, 0)), radiusX: 0.037, radiusZ: 0.033 },
    ],
    darkPointMat,
    16,
  );
  g.add(mark(fLower));

  // 5. Continuous Hindlimb Coat (hip -> thigh -> stifle -> gaskin) + Dark Points (hock -> fetlock -> coronet)
  const hl = hindlimbLandmarks(sd);
  const hUpper = createSculptedLimbPath(
    [
      { pos: hl.tuberCoxae.clone().add(V3(-0.04, -0.06, -0.02 * sd)), radiusX: 0.14, radiusZ: 0.105 },
      { pos: hl.hip.clone().add(V3(-0.02, 0.02, 0.01 * sd)), radiusX: 0.15, radiusZ: 0.11 },
      { pos: hl.stifle.clone().add(V3(-0.04, 0.03, 0)), radiusX: 0.115, radiusZ: 0.088 },
      { pos: hl.stifle.clone().lerp(hl.hock, 0.52), radiusX: 0.076, radiusZ: 0.056 },
      { pos: hl.hock.clone().add(V3(-0.015, 0.06, 0)), radiusX: 0.05, radiusZ: 0.04 },
    ],
    skinMat,
    18,
  );
  g.add(mark(hUpper));

  const hLower = createSculptedLimbPath(
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
  );
  g.add(mark(hLower));

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

  // --- 1. INTEGUMENTARY SYSTEM (pel) ---
  const coatGroup = new THREE.Group();
  coatGroup.add(buildHalfEquineCoat(-1, skinMat(), darkPointMat(), maneMat()));
  coatGroup.add(buildHalfEquineCoat(1, skinMat(), darkPointMat(), maneMat()));
  push('equ.teg.pie.001', coatGroup, 'center', V3(0.05, 1.1, 0));

  // Crin (equ.teg.pel.011) flowing along dorsal neck crest + forelock (tupé)
  const maneGroup = new THREE.Group();
  for (let i = 0; i < 16; i++) {
    const t = i / 15;
    const x = THREE.MathUtils.lerp(1.04, 0.39, t);
    const y = THREE.MathUtils.lerp(1.81, 1.48, t) + 0.025 * Math.sin(t * Math.PI);
    const len = 0.16 + 0.07 * Math.sin(t * Math.PI);
    const lock = createMuscleBellyMesh(
      V3(x, y, -0.012),
      V3(x - 0.05, y - len, -0.085 - 0.015 * Math.sin(t * Math.PI * 2)),
      0.026,
      0.42,
      maneMat(),
      0.32,
    );
    lock.userData.side = 'left';
    maneGroup.add(lock);
  }
  const forelock = createMuscleBellyMesh(
    V3(1.10, 1.79, 0),
    V3(1.24, 1.65, -0.018),
    0.024,
    0.45,
    maneMat(),
    0.3,
  );
  maneGroup.add(forelock);
  push('equ.teg.pel.011', maneGroup, 'left', V3(0.75, 1.64, -0.04));

  // Cola / Crin de la cola (equ.teg.pel.012)
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
        [
          V3(-1.02, 1.28, oz * 0.4),
          V3(-1.19 + ox, 1.20, oz * 0.8),
          V3(-1.31 + ox, 0.88, oz),
          V3(-1.35 + ox * 1.4, 0.44, oz * 0.9),
        ],
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

  // --- 2. MUSCULAR SYSTEM: SUPERFICIAL (msu), DEEP (mpr) & FASCIA (fas) ---
  // Masetero (bilateral: equ.mus.cab.018) — sculpted curved fan hugging mandibular ramus & facial crest
  const masseterGroup = new THREE.Group();
  for (const sd of [-1, 1] as const) {
    const m = createCurvedMuscleSheetMesh(
      [
        { x: 1.06, yTop: 1.62, yBot: 1.50, zMid: 0.068, zBow: 0.018 },
        { x: 1.13, yTop: 1.63, yBot: 1.47, zMid: 0.072, zBow: 0.025 },
        { x: 1.21, yTop: 1.59, yBot: 1.47, zMid: 0.065, zBow: 0.02 },
        { x: 1.27, yTop: 1.55, yBot: 1.49, zMid: 0.056, zBow: 0.01 },
      ],
      sd,
      msuMat(),
      8,
    );
    m.userData.side = sd === -1 ? 'left' : 'right';
    masseterGroup.add(m);
  }
  push('equ.mus.cab.018', masseterGroup, 'center', V3(1.13, 1.56, 0));

  for (const sd of [-1, 1] as const) {
    const tag = sd === -1 ? 'i' : 'd';
    const side = sd === -1 ? 'left' : 'right';
    const fl = forelimbLandmarks(sd);
    const hl = hindlimbLandmarks(sd);

    // Braquiocefálico (equ.mus.cue.002-i/d)
    push(
      `equ.mus.cue.002-${tag}`,
      createMuscleBellyMesh(V3(0.98, 1.66, 0.058 * sd), fl.shoulder.clone().add(V3(0.03, 0.02, 0.01 * sd)), 0.06, 0.48, msuMat(), 0.45),
      side,
    );
    // Esternocefálico (equ.mus.cue.003-i/d)
    push(
      `equ.mus.cue.003-${tag}`,
      createMuscleBellyMesh(HEAD.jawAngle(sd), V3(0.49, 0.94, 0.04 * sd), 0.036, 0.55, msuMat(), 0.5),
      side,
    );
    // Esplenio (equ.mus.cue.007-i/d)
    push(
      `equ.mus.cue.007-${tag}`,
      createMuscleBellyMesh(V3(0.96, 1.74, 0.045 * sd), V3(0.45, 1.44, 0.055 * sd), 0.068, 0.4, msuMat(), 0.45),
      side,
    );
    // Trapecio cervical (001) & torácico (002)
    push(
      `equ.mus.ext.001-${tag}`,
      createMuscleBellyMesh(V3(0.84, 1.66, 0.04 * sd), V3(0.36, 1.38, 0.11 * sd), 0.068, 0.3, msuMat(), 0.55),
      side,
    );
    push(
      `equ.mus.ext.002-${tag}`,
      createMuscleBellyMesh(V3(0.32, 1.46, 0.04 * sd), V3(0.18, 1.26, 0.14 * sd), 0.062, 0.3, msuMat(), 0.45),
      side,
    );

    // Dorsal ancho / Latissimus dorsi (equ.mus.ext.005-i/d) — sculpted curved sheet over ribcage to humerus!
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

    // Pectoral descendente & transverso (equ.mus.ext.009/010-i/d)
    push(
      `equ.mus.ext.009-${tag}`,
      createOrganMesh(V3(0.50, 0.94, 0.08 * sd), [0.11, 0.09, 0.075], msuMat(), [0, 0, -0.25], 14),
      side,
    );
    push(
      `equ.mus.ext.010-${tag}`,
      createMuscleBellyMesh(V3(0.34, 0.85, 0.02 * sd), fl.elbow.clone().add(V3(0, 0.02, -0.02 * sd)), 0.048, 0.55, msuMat()),
      side,
    );
    // Deltoides (003) & Supraespinoso (001)
    push(
      `equ.mus.hom.003-${tag}`,
      createMuscleBellyMesh(V3(0.35, 1.34, 0.165 * sd), fl.shoulder.clone().add(V3(-0.04, -0.08, 0.025 * sd)), 0.052, 0.45, msuMat()),
      side,
    );
    push(
      `equ.mus.hom.001-${tag}`,
      createMuscleBellyMesh(fl.scapulaTop.clone().add(V3(0.04, -0.02, 0.02 * sd)), fl.shoulder.clone().add(V3(0.03, 0.02, 0.01 * sd)), 0.056, 0.48, mprMat()),
      side,
    );
    // Tríceps braquial cabeza larga (007) y lateral (008)
    push(
      `equ.mus.bra.007-${tag}`,
      createMuscleBellyMesh(V3(0.29, 1.24, 0.16 * sd), fl.elbow.clone().add(V3(-0.02, 0.05, 0.01 * sd)), 0.08, 0.55, msuMat(), 0.42),
      side,
    );
    push(
      `equ.mus.bra.008-${tag}`,
      createMuscleBellyMesh(fl.shoulder.clone().add(V3(-0.03, -0.03, 0.02 * sd)), fl.elbow.clone().add(V3(-0.01, 0.04, 0.02 * sd)), 0.048, 0.55, msuMat()),
      side,
    );

    // Forelimb extensors & flexors with authentic dorsal/palmar tendon insertions:
    // Extensor radial del carpo (001) -> dorsomedial metacarpal tuberosity
    const ercGrp = new THREE.Group();
    ercGrp.add(createMuscleBellyMesh(fl.elbow.clone().add(V3(0.025, 0.02, 0.008 * sd)), fl.carpus.clone().add(V3(0.018, 0.09, 0)), 0.036, 0.65, msuMat(), 0.3));
    ercGrp.add(createTubeCurveMesh([fl.carpus.clone().add(V3(0.018, 0.09, 0)), fl.carpus.clone().add(V3(0.018, -0.03, -0.004 * sd))], 0.007, tenMat(), 8, 6));
    push(`equ.mus.ant.001-${tag}`, ercGrp, side);

    // Extensor digital común (equ.mus.ant.002-i/d) -> dorsal cannon -> P3 extensor process!
    const edcGrp = new THREE.Group();
    edcGrp.add(createMuscleBellyMesh(fl.elbow.clone().add(V3(0.015, 0.0, 0.022 * sd)), fl.carpus.clone().add(V3(0.016, 0.08, 0.01 * sd)), 0.026, 0.65, msuMat(), 0.35));
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

    // Flexor digital superficial (equ.mus.ant.008-i/d) -> palmar tendon -> splits onto P1/P2!
    const sdfGrp = new THREE.Group();
    sdfGrp.add(createMuscleBellyMesh(fl.elbow.clone().add(V3(-0.02, -0.01, -0.005 * sd)), fl.carpus.clone().add(V3(-0.024, 0.10, 0)), 0.032, 0.65, msuMat(), 0.35));
    const sdfFet = fl.fetlock.clone().add(V3(-0.026, 0, 0));
    sdfGrp.add(createTubeCurveMesh([fl.carpus.clone().add(V3(-0.024, 0.10, 0)), fl.carpus.clone().add(V3(-0.028, 0, 0)), sdfFet], 0.007, tenMat(), 12, 7));
    sdfGrp.add(createTubeCurveMesh([sdfFet, fl.pasternMid.clone().add(V3(-0.016, -0.008, -0.013 * sd))], 0.005, tenMat(), 8, 6));
    sdfGrp.add(createTubeCurveMesh([sdfFet, fl.pasternMid.clone().add(V3(-0.016, -0.008, 0.013 * sd))], 0.005, tenMat(), 8, 6));
    push(`equ.mus.ant.008-${tag}`, sdfGrp, side);

    // Flexor digital profundo, cabeza humeral (equ.mus.ant.010-i/d) -> deep palmar tendon over navicular to solar P3!
    const ddfGrp = new THREE.Group();
    ddfGrp.add(createMuscleBellyMesh(fl.elbow.clone().add(V3(-0.012, -0.02, 0.005 * sd)), fl.carpus.clone().add(V3(-0.018, 0.11, 0)), 0.03, 0.65, mprMat(), 0.35));
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

    // Oblicuo externo del abdomen (equ.mus.abd.001-i/d) — sculpted curved abdominal wall + aponeurosis
    const abdGrp = new THREE.Group();
    abdGrp.add(
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
    );
    // Ventral abdominal tunic aponeurosis seam
    abdGrp.add(
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
    );
    push(`equ.mus.abd.001-${tag}`, abdGrp, side);

    // Glúteo superficial (001) & Glúteo medio (002 curved over ilial croup dome)
    push(
      `equ.mus.cad.001-${tag}`,
      createMuscleBellyMesh(V3(-0.74, 1.32, 0.16 * sd), hl.hip.clone().add(V3(-0.04, -0.04, 0.04 * sd)), 0.058, 0.42, msuMat()),
      side,
    );
    push(
      `equ.mus.cad.002-${tag}`,
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

    // Bíceps femoral (012) & Semitendinoso (002)
    push(
      `equ.mus.fem.012-${tag}`,
      createMuscleBellyMesh(V3(-0.88, 1.24, 0.17 * sd), hl.stifle.clone().add(V3(-0.04, -0.05, 0.03 * sd)), 0.088, 0.55, msuMat(), 0.38),
      side,
    );
    push(
      `equ.mus.fem.002-${tag}`,
      createMuscleBellyMesh(hl.tuberIschii.clone().add(V3(0, 0.03, 0.01 * sd)), hl.hock.clone().add(V3(0.02, 0.18, -0.02 * sd)), 0.064, 0.65, msuMat(), 0.35),
      side,
    );

    // Gastrocnemio + Tendón calcáneo común (equ.mus.pie.001-i/d)
    const gastGrp = new THREE.Group();
    gastGrp.add(createMuscleBellyMesh(hl.stifle.clone().add(V3(-0.04, -0.02, 0)), hl.calcaneusTip.clone().add(V3(0.01, 0.12, 0)), 0.05, 0.72, msuMat(), 0.32));
    gastGrp.add(createTubeCurveMesh([hl.calcaneusTip.clone().add(V3(0.01, 0.13, 0)), hl.calcaneusTip], 0.01, tenMat(), 10, 7));
    push(`equ.mus.pie.001-${tag}`, gastGrp, side);

    // Flexor digital superficial pélvico (equ.mus.pie.004-i/d) — tendon capping tuber calcanei -> plantar cannon -> P1/P2
    const sdfHGrp = new THREE.Group();
    sdfHGrp.add(
      createTubeCurveMesh(
        [
          hl.stifle.clone().add(V3(-0.025, -0.03, 0)),
          hl.calcaneusTip.clone().add(V3(-0.012, 0.01, 0)),
          hl.hock.clone().add(V3(-0.03, -0.02, 0)),
          hl.fetlock.clone().add(V3(-0.026, 0, 0)),
          hl.pasternMid.clone().add(V3(-0.016, -0.008, 0)),
        ],
        0.007,
        tenMat(),
        22,
        7,
      ),
    );
    push(`equ.mus.pie.004-${tag}`, sdfHGrp, side);

    // Fibular tercero / Peroneus tertius (equ.mus.pie.009-i/d) — key stay-apparatus reciprocal cord!
    push(
      `equ.mus.pie.009-${tag}`,
      createTubeCurveMesh(
        [
          hl.stifle.clone().add(V3(0.015, 0.01, 0.012 * sd)),
          hl.stifle.clone().lerp(hl.hock, 0.5).add(V3(0.024, 0, 0.008 * sd)),
          hl.hock.clone().add(V3(0.022, -0.02, 0)),
        ],
        0.008,
        tenMat(),
        14,
        7,
      ),
      side,
    );

    // Deep muscle: Psoas mayor (equ.mus.sub.001-i/d)
    push(
      `equ.mus.sub.001-${tag}`,
      createMuscleBellyMesh(V3(-0.36, 1.28, 0.05 * sd), hl.hip.clone().add(V3(0.05, 0.04, -0.02 * sd)), 0.032, 0.7, mprMat()),
      side,
    );

    // Fascia toracolumbar / pélvica (equ.mus.fas.011-i/d) — sculpted curved aponeurosis over lumbar loin
    push(
      `equ.mus.fas.011-${tag}`,
      createCurvedMuscleSheetMesh(
        [
          { x: -0.78, yTop: 1.40, yBot: 1.25, zMid: 0.05, zBow: 0.07 },
          { x: -0.55, yTop: 1.44, yBot: 1.25, zMid: 0.06, zBow: 0.085 },
          { x: -0.32, yTop: 1.42, yBot: 1.24, zMid: 0.06, zBow: 0.09 },
          { x: -0.14, yTop: 1.39, yBot: 1.24, zMid: 0.05, zBow: 0.07 },
        ],
        sd,
        fasMat(),
        8,
      ),
      side,
    );
  }

  // Diafragma (equ.mus.tor.009 — deep curved dome separating thorax & abdomen)
  const diaph = createOrganMesh(V3(-0.08, 1.05, 0), [0.09, 0.24, 0.22], mprMat(), [0, 0, -0.45], 18);
  push('equ.mus.tor.009', diaph, 'center');

  return parts;
}
