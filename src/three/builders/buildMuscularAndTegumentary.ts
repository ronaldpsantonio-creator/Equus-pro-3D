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
  createBiospheraMuscleMesh,
  createEquineEarPinnaMesh,
  createEquineEyelidMesh,
  createHoofMesh,
  createOrganMesh,
  createOrientedHalfBodyCoatMesh,
  createSculptedEquineLimbMesh,
  createSculptedMuscleSheetMesh,
  createTaperedHairStrandMesh,
  createTubeCurveMesh,
  OrientedCoatStation,
  VertexColorFn,
} from './geomHelpers';

function makeSideMarked(obj: THREE.Object3D, side: 'left' | 'right'): THREE.Object3D {
  obj.traverse((ch) => {
    ch.userData.side = side;
  });
  return obj;
}

/**
 * Computes rich, natural warm-bay equine coat shading with:
 * - subtle dorsal eel-stripe & crest shadow
 * - golden-chestnut highlight over shoulder, rib barrel & croup
 * - soft velvety dark-bay fade on muzzle, lips & nostril rim
 * - gentle orbital shadow around the eyes
 */
const equineBodyColorFn: VertexColorFn = (x, y, z, _tLong, uAngle, out) => {
  // Base warm bay coat multiplier over coatColor texture
  let r = 1.0;
  let g = 0.94;
  let b = 0.89;

  // Subtle dorsal line darkening along topline (uAngle ~ 0)
  const dorsalDark = Math.exp(-Math.pow(uAngle / 0.11, 2)) * 0.24;
  r -= dorsalDark * 0.85;
  g -= dorsalDark * 0.92;
  b -= dorsalDark * 0.92;

  // Warm golden-bay sheen across muscular shoulder, barrel flank, and croup
  const midFlank = Math.exp(-Math.pow((uAngle - 0.48) / 0.24, 2));
  r += midFlank * 0.08;
  g += midFlank * 0.05;
  b += midFlank * 0.02;

  // Ventral belly underline gentle ambient shadow
  const ventralShade = Math.max(0, (uAngle - 0.78) / 0.22) * 0.16;
  r -= ventralShade;
  g -= ventralShade;
  b -= ventralShade;

  // Soft velvety dark muzzle & lips gradient (x > 1.44)
  if (x > 1.43) {
    const muzzleT = THREE.MathUtils.smoothstep(x, 1.43, 1.565);
    r = THREE.MathUtils.lerp(r, 0.31, muzzleT);
    g = THREE.MathUtils.lerp(g, 0.25, muzzleT);
    b = THREE.MathUtils.lerp(b, 0.22, muzzleT);
  }

  // Subtle orbital ring shading around eye socket (x ~ 1.195, y ~ 1.695)
  const dEye = Math.hypot(x - 1.195, y - 1.695);
  if (dEye < 0.045 && Math.abs(z) > 0.042) {
    const eyeShade = (1 - dEye / 0.045) * 0.22;
    r -= eyeShade;
    g -= eyeShade;
    b -= eyeShade;
  }

  out.setRGB(Math.max(0.15, Math.min(1.12, r)), Math.max(0.12, Math.min(1.08, g)), Math.max(0.1, Math.min(1.04, b)));
};

/**
 * Smooth bay-to-dark-points gradient down the equine limbs (no harsh Lego seams).
 */
const equineLimbColorFn: VertexColorFn = (_x, y, _z, _tLong, _uAngle, out) => {
  // Smoothly transition from bay coat (above y = 0.86) to dark equine points (below y = 0.44)
  const darkPoint = 1 - THREE.MathUtils.smoothstep(y, 0.42, 0.86);
  const r = THREE.MathUtils.lerp(1.0, 0.29, darkPoint);
  const g = THREE.MathUtils.lerp(0.94, 0.23, darkPoint);
  const b = THREE.MathUtils.lerp(0.89, 0.2, darkPoint);
  out.setRGB(r, g, b);
};

function buildHalfEquineCoat(
  sd: -1 | 1,
  skinCoatMat: THREE.Material,
  darkPointMat: THREE.Material,
  maneMat: THREE.Material,
): THREE.Group {
  const g = new THREE.Group();
  const side = sd === -1 ? 'left' : 'right';
  g.userData.side = side;

  const mark = <T extends THREE.Object3D>(obj: T): T => makeSideMarked(obj, side) as T;

  // 1. Single continuous oriented living equine body:
  //    Buttocks -> Croup -> Loin -> Back -> Withers -> Arched Neck -> Throatlatch -> Poll -> Forehead -> Nasal Bridge -> Muzzle
  const bodyStations: OrientedCoatStation[] = [
    { center: V3(-1.11, 1.24, 0), halfHeightDorsal: 0.012, halfHeightVentral: 0.012, halfWidth: 0.01 },
    { center: V3(-1.04, 1.23, 0), halfHeightDorsal: 0.145, halfHeightVentral: 0.145, halfWidth: 0.14, dorsalTaper: 1.15 },
    { center: V3(-0.90, 1.21, 0), halfHeightDorsal: 0.242, halfHeightVentral: 0.225, halfWidth: 0.208, dorsalTaper: 1.18 },
    { center: V3(-0.73, 1.20, 0), halfHeightDorsal: 0.278, halfHeightVentral: 0.23, halfWidth: 0.214, flankBias: 0.04, dorsalTaper: 1.18 },
    { center: V3(-0.56, 1.18, 0), halfHeightDorsal: 0.308, halfHeightVentral: 0.258, halfWidth: 0.216, flankBias: 0.07, dorsalTaper: 1.24 },
    { center: V3(-0.34, 1.14, 0), halfHeightDorsal: 0.322, halfHeightVentral: 0.312, halfWidth: 0.258, flankBias: 0.05, dorsalTaper: 1.26 },
    { center: V3(-0.04, 1.12, 0), halfHeightDorsal: 0.355, halfHeightVentral: 0.372, halfWidth: 0.288, flankBias: 0.03, dorsalTaper: 1.3 },
    { center: V3(0.16, 1.18, 0), halfHeightDorsal: 0.415, halfHeightVentral: 0.355, halfWidth: 0.262, dorsalTaper: 1.55 },
    { center: V3(0.28, 1.21, 0), halfHeightDorsal: 0.408, halfHeightVentral: 0.33, halfWidth: 0.232, dorsalTaper: 1.9 }, // Prominent equine withers
    { center: V3(0.45, 1.24, 0), halfHeightDorsal: 0.315, halfHeightVentral: 0.30, halfWidth: 0.184, dorsalTaper: 1.75, ventralTaper: 1.35 },
    { center: V3(0.58, 1.32, 0), halfHeightDorsal: 0.255, halfHeightVentral: 0.242, halfWidth: 0.142, dorsalTaper: 1.78, ventralTaper: 1.35 },
    { center: V3(0.73, 1.45, 0), halfHeightDorsal: 0.212, halfHeightVentral: 0.18, halfWidth: 0.116, dorsalTaper: 1.85, ventralTaper: 1.3 },
    { center: V3(0.88, 1.59, 0), halfHeightDorsal: 0.168, halfHeightVentral: 0.142, halfWidth: 0.098, dorsalTaper: 1.75, ventralTaper: 1.25 },
    { center: V3(0.99, 1.67, 0), halfHeightDorsal: 0.132, halfHeightVentral: 0.104, halfWidth: 0.084, dorsalTaper: 1.5, ventralTaper: 1.28 }, // Throatlatch
    { center: V3(1.06, 1.685, 0), halfHeightDorsal: 0.114, halfHeightVentral: 0.125, halfWidth: 0.088, dorsalTaper: 1.32, jawBulge: 0.14 }, // Poll/TMJ
    { center: V3(1.165, 1.635, 0), halfHeightDorsal: 0.112, halfHeightVentral: 0.165, halfWidth: 0.09, dorsalTaper: 1.22, jawBulge: 0.24, orbitPocket: 0.95 }, // Orbit & Cheek jowl
    { center: V3(1.29, 1.545, 0), halfHeightDorsal: 0.088, halfHeightVentral: 0.108, halfWidth: 0.071, dorsalTaper: 1.25, jawBulge: 0.12, orbitPocket: 0.15 }, // Mid-face / Facial crest
    { center: V3(1.42, 1.455, 0), halfHeightDorsal: 0.068, halfHeightVentral: 0.076, halfWidth: 0.056, dorsalTaper: 1.2, nostrilFlare: 0.24 }, // Nasal bridge
    { center: V3(1.525, 1.382, 0), halfHeightDorsal: 0.058, halfHeightVentral: 0.062, halfWidth: 0.052, dorsalTaper: 1.15, nostrilFlare: 0.95 }, // Muzzle & Nostrils
    { center: V3(1.585, 1.345, 0), halfHeightDorsal: 0.015, halfHeightVentral: 0.015, halfWidth: 0.014 }, // Lip tip cap
  ];
  g.add(mark(createOrientedHalfBodyCoatMesh(bodyStations, sd, skinCoatMat, 28, 2, equineBodyColorFn)));

  // 2. Muscular Pectoral Breast & Brisket Shell (bridges chest V-cleft between shoulders cleanly)
  const chestStations: OrientedCoatStation[] = [
    { center: V3(0.28, 0.96, 0), halfHeightDorsal: 0.12, halfHeightVentral: 0.145, halfWidth: 0.175, ventralTaper: 1.3 },
    { center: V3(0.45, 0.98, 0), halfHeightDorsal: 0.145, halfHeightVentral: 0.155, halfWidth: 0.172, ventralTaper: 1.45 },
    { center: V3(0.57, 1.03, 0), halfHeightDorsal: 0.145, halfHeightVentral: 0.13, halfWidth: 0.142, ventralTaper: 1.5 },
    { center: V3(0.635, 1.08, 0), halfHeightDorsal: 0.08, halfHeightVentral: 0.065, halfWidth: 0.082 },
    { center: V3(0.665, 1.11, 0), halfHeightDorsal: 0.015, halfHeightVentral: 0.015, halfWidth: 0.012 },
  ];
  g.add(mark(createOrientedHalfBodyCoatMesh(chestStations, sd, skinCoatMat, 18, 2, equineBodyColorFn)));

  // 3. Sculpted Facial Details: Nostril cavities, lower lip chin groove, eyelids, and hollow equine pinnae
  // Dark nostril recess tucked inside flared alar wing
  g.add(mark(createOrganMesh(V3(1.538, 1.398, 0.036 * sd), [0.019, 0.013, 0.012], maneMat, [0.18 * sd, 0.28 * sd, -0.35], 12)));
  // Chin / mentalis contour
  g.add(mark(createOrganMesh(V3(1.515, 1.326, 0.015 * sd), [0.024, 0.018, 0.018], darkPointMat, [0, 0, -0.4], 10)));
  // Sculpted upper & lower eyelids framing the eye socket
  g.add(mark(createEquineEyelidMesh(V3(1.195, 1.695, 0.075 * sd), sd, darkPointMat)));
  // Hollow curved equine external ear (pinna)
  g.add(
    mark(
      createEquineEarPinnaMesh(
        V3(1.045, 1.768, 0.045 * sd),
        V3(1.062, 1.946, 0.056 * sd),
        sd,
        skinCoatMat,
      ),
    ),
  );

  // 4. Sculpted Continuous Forelimb Coat (shoulder -> elbow -> forearm -> carpus -> cannon + flexor tendon -> fetlock -> pastern -> coronet)
  const fl = forelimbLandmarks(sd);
  g.add(
    mark(
      createSculptedEquineLimbMesh(
        [
          { pos: fl.scapulaTop.clone().add(V3(0.01, -0.05, -0.01 * sd)), rCranial: 0.105, rCaudal: 0.115, rLat: 0.078, rMed: 0.058 },
          { pos: fl.shoulder.clone().add(V3(-0.015, 0.02, 0)), rCranial: 0.108, rCaudal: 0.112, rLat: 0.084, rMed: 0.068 },
          { pos: fl.elbow.clone().add(V3(0.01, 0.05, 0)), rCranial: 0.088, rCaudal: 0.102, rLat: 0.076, rMed: 0.066 },
          { pos: fl.elbow.clone().lerp(fl.carpus, 0.38), rCranial: 0.066, rCaudal: 0.072, rLat: 0.058, rMed: 0.052 },
          { pos: fl.elbow.clone().lerp(fl.carpus, 0.74), rCranial: 0.048, rCaudal: 0.049, rLat: 0.043, rMed: 0.04 },
          { pos: fl.carpus.clone().add(V3(0.004, 0.018, 0)), rCranial: 0.044, rCaudal: 0.046, rLat: 0.04, rMed: 0.038, jointFacet: 0.9 },
          { pos: fl.carpus.clone().add(V3(0, -0.016, 0)), rCranial: 0.04, rCaudal: 0.043, rLat: 0.036, rMed: 0.035, jointFacet: 0.7 },
          { pos: fl.carpus.clone().lerp(fl.fetlock, 0.35), rCranial: 0.031, rCaudal: 0.038, rLat: 0.028, rMed: 0.027, tendonRidge: 0.95 },
          { pos: fl.carpus.clone().lerp(fl.fetlock, 0.72), rCranial: 0.03, rCaudal: 0.036, rLat: 0.027, rMed: 0.026, tendonRidge: 0.95 },
          { pos: fl.fetlock.clone().add(V3(0, 0.008, 0)), rCranial: 0.036, rCaudal: 0.042, rLat: 0.032, rMed: 0.031, jointFacet: 0.4 },
          { pos: fl.pasternMid, rCranial: 0.03, rCaudal: 0.031, rLat: 0.027, rMed: 0.026, tendonRidge: 0.35 },
          { pos: fl.coronet.clone().add(V3(0, 0.002, 0)), rCranial: 0.037, rCaudal: 0.036, rLat: 0.034, rMed: 0.033 },
        ],
        sd,
        skinCoatMat,
        22,
        2,
        equineLimbColorFn,
      ),
    ),
  );

  // 5. Sculpted Continuous Hindlimb Coat (croup -> thigh -> stifle -> gaskin -> Achilles groove + hock -> cannon + flexor tendon -> fetlock -> pastern -> coronet)
  const hl = hindlimbLandmarks(sd);
  g.add(
    mark(
      createSculptedEquineLimbMesh(
        [
          { pos: hl.tuberCoxae.clone().add(V3(-0.06, -0.05, -0.02 * sd)), rCranial: 0.145, rCaudal: 0.165, rLat: 0.112, rMed: 0.078 },
          { pos: hl.hip.clone().add(V3(-0.02, 0.01, 0.01 * sd)), rCranial: 0.15, rCaudal: 0.168, rLat: 0.118, rMed: 0.088 },
          { pos: hl.stifle.clone().add(V3(-0.045, 0.035, 0)), rCranial: 0.118, rCaudal: 0.132, rLat: 0.094, rMed: 0.078 },
          { pos: hl.stifle.clone().lerp(hl.hock, 0.38).add(V3(-0.01, 0, 0)), rCranial: 0.08, rCaudal: 0.092, rLat: 0.064, rMed: 0.056 },
          // Concave Achilles tendon chord above point of hock!
          { pos: hl.stifle.clone().lerp(hl.hock, 0.72).add(V3(-0.015, 0, 0)), rCranial: 0.05, rCaudal: 0.068, rLat: 0.044, rMed: 0.04, tendonRidge: 0.9 },
          { pos: hl.hock.clone().add(V3(-0.016, 0.02, 0)), rCranial: 0.046, rCaudal: 0.064, rLat: 0.04, rMed: 0.038, tendonRidge: 0.75, jointFacet: 0.85 },
          { pos: hl.hock.clone().add(V3(-0.01, -0.024, 0)), rCranial: 0.04, rCaudal: 0.048, rLat: 0.036, rMed: 0.034, tendonRidge: 0.8 },
          { pos: hl.hock.clone().lerp(hl.fetlock, 0.38), rCranial: 0.032, rCaudal: 0.039, rLat: 0.028, rMed: 0.027, tendonRidge: 0.95 },
          { pos: hl.hock.clone().lerp(hl.fetlock, 0.74), rCranial: 0.03, rCaudal: 0.036, rLat: 0.027, rMed: 0.026, tendonRidge: 0.95 },
          { pos: hl.fetlock.clone().add(V3(0, 0.008, 0)), rCranial: 0.036, rCaudal: 0.042, rLat: 0.032, rMed: 0.031, jointFacet: 0.4 },
          { pos: hl.pasternMid, rCranial: 0.03, rCaudal: 0.031, rLat: 0.027, rMed: 0.026, tendonRidge: 0.35 },
          { pos: hl.coronet.clone().add(V3(0, 0.002, 0)), rCranial: 0.037, rCaudal: 0.036, rLat: 0.034, rMed: 0.033 },
        ],
        sd,
        skinCoatMat,
        22,
        2,
        equineLimbColorFn,
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
  const skinCoatMat = () => createTissueMaterial('skin_coat', tex);
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
  coatGroup.add(buildHalfEquineCoat(-1, skinCoatMat(), darkPointMat(), maneMat()));
  coatGroup.add(buildHalfEquineCoat(1, skinCoatMat(), darkPointMat(), maneMat()));
  push('equ.teg.pie.001', coatGroup, 'center', V3(0.05, 1.1, 0));

  // Crin (equ.teg.pel.011 — layered arched mane locks hugging neck crest + natural forelock)
  const maneGroup = new THREE.Group();
  for (let i = 0; i < 24; i++) {
    const t = i / 23;
    const x = THREE.MathUtils.lerp(1.03, 0.33, t);
    const y = THREE.MathUtils.lerp(1.80, 1.59, t) + 0.032 * Math.sin(t * Math.PI);
    // Neck width narrows cranially; locks drape naturally over the left (-Z) side of the neck
    const neckZ = THREE.MathUtils.lerp(0.052, 0.095, Math.sin(t * Math.PI * 0.72));
    const dropLen = 0.14 + 0.08 * Math.sin(t * Math.PI) + (i % 3) * 0.018;
    const lockPts = [
      V3(x, y, -0.004),
      V3(x - 0.015, y - dropLen * 0.25, -neckZ * 0.85),
      V3(x - 0.038, y - dropLen * 0.65, -neckZ - 0.012),
      V3(x - 0.055 + (i % 2) * 0.012, y - dropLen, -neckZ - 0.018),
    ];
    const lock = createTaperedHairStrandMesh(lockPts, 0.022, 0.004, maneMat(), 12, 8, 0.45);
    lock.userData.side = 'left';
    maneGroup.add(lock);
  }
  // Flowing forelock (copete) sweeping down between ears over forehead
  for (let f = -1; f <= 1; f++) {
    const forelock = createTaperedHairStrandMesh(
      [
        V3(1.07, 1.795, f * 0.01),
        V3(1.13, 1.775, f * 0.015 - 0.005),
        V3(1.19, 1.735, f * 0.018 - 0.008),
        V3(1.245, 1.675, f * 0.016 - 0.01),
      ],
      0.018,
      0.003,
      maneMat(),
      10,
      7,
      0.55,
    );
    maneGroup.add(forelock);
  }
  push('equ.teg.pel.011', maneGroup, 'left', V3(0.75, 1.64, -0.04));

  // Cola (equ.teg.pel.012 — sculpted fleshy tail dock + 18 overlapping flowing tapered strands)
  const tailGroup = new THREE.Group();
  // Tail dock wrapping proximal caudal vertebrae cleanly from croup
  tailGroup.add(
    createTaperedHairStrandMesh(
      [V3(-1.01, 1.30, 0), V3(-1.12, 1.24, 0), V3(-1.20, 1.12, 0), V3(-1.23, 0.98, 0)],
      0.038,
      0.014,
      maneMat(),
      12,
      10,
      0.88,
    ),
  );
  const tailRings = [
    { ox: 0, oz: 0, baseR: 0.026, tipY: 0.34 },
    { ox: -0.018, oz: -0.022, baseR: 0.022, tipY: 0.38 },
    { ox: -0.018, oz: 0.022, baseR: 0.022, tipY: 0.38 },
    { ox: 0.016, oz: -0.026, baseR: 0.02, tipY: 0.41 },
    { ox: 0.016, oz: 0.026, baseR: 0.02, tipY: 0.41 },
    { ox: -0.026, oz: 0.0, baseR: 0.021, tipY: 0.36 },
    { ox: 0.012, oz: -0.042, baseR: 0.017, tipY: 0.46 },
    { ox: 0.012, oz: 0.042, baseR: 0.017, tipY: 0.46 },
    { ox: -0.028, oz: -0.036, baseR: 0.018, tipY: 0.44 },
    { ox: -0.028, oz: 0.036, baseR: 0.018, tipY: 0.44 },
    { ox: -0.008, oz: -0.014, baseR: 0.02, tipY: 0.33 },
    { ox: -0.008, oz: 0.014, baseR: 0.02, tipY: 0.33 },
  ];
  for (const st of tailRings) {
    tailGroup.add(
      createTaperedHairStrandMesh(
        [
          V3(-1.04, 1.29, st.oz * 0.35),
          V3(-1.17 + st.ox * 0.6, 1.20, st.oz * 0.75),
          V3(-1.26 + st.ox, 0.96, st.oz * 1.1),
          V3(-1.31 + st.ox * 1.35, 0.68, st.oz * 1.2),
          V3(-1.33 + st.ox * 1.6, st.tipY, st.oz * 1.05),
        ],
        st.baseR,
        0.0035,
        maneMat(),
        16,
        8,
        0.72,
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

  // --- 2. HEAD & FACIAL ÉCORCHÉ MUSCULATURE (Biosphera sculpted sheets & curved bellies) ---
  // Masetero (equ.mus.cab.018 — sculpted cheek fan + glistening dorsal aponeurosis)
  push(
    'equ.mus.cab.018',
    buildBilateralMuscular((sd) => {
      const g = new THREE.Group();
      g.add(
        createSculptedMuscleSheetMesh(
          [
            { x: 1.06, yTop: 1.62, yBot: 1.50, zMid: 0.068, zBow: 0.014 },
            { x: 1.13, yTop: 1.625, yBot: 1.465, zMid: 0.073, zBow: 0.018 },
            { x: 1.21, yTop: 1.585, yBot: 1.475, zMid: 0.066, zBow: 0.015 },
            { x: 1.27, yTop: 1.54, yBot: 1.49, zMid: 0.056, zBow: 0.008 },
          ],
          sd,
          msuMat(),
          {
            verticalSegs: 12,
            longSubdivs: 3,
            horizontalFibers: false,
            aponeuroticEdgeFade: true,
            dorsalAponeurosis: 0.28,
            ventralAponeurosis: 0.12,
            thickness: 0.016,
          },
        ),
      );
      g.add(createTubeCurveMesh([V3(1.12, 1.62, 0.075 * sd), V3(1.26, 1.54, 0.063 * sd)], 0.0055, tenMat(), 10, 6));
      return g;
    }),
    'center',
    V3(1.15, 1.55, 0),
  );

  // Músculo temporal (equ.mus.cab.019 — curved fan filling temporal fossa above eye/TMJ)
  push(
    'equ.mus.cab.019',
    buildBilateralMuscular((sd) =>
      createBiospheraMuscleMesh(
        [
          { pos: V3(1.06, 1.755, 0.025 * sd), rx: 0.016, ry: 0.026 },
          { pos: V3(1.115, 1.725, 0.048 * sd), rx: 0.024, ry: 0.042 },
          { pos: V3(1.15, 1.675, 0.056 * sd), rx: 0.015, ry: 0.026 },
        ],
        mprMat(),
        { originTendonFrac: 0.16, insertionTendonFrac: 0.22, radialSegs: 14, grooveAO: 0.2 },
      ),
    ),
    'center',
    V3(1.11, 1.72, 0),
  );

  // Orbicular del ojo (equ.mus.cab.002 — contoured peri-orbital ring hugging lateral skull)
  push(
    'equ.mus.cab.002',
    buildBilateralMuscular((sd) => {
      const pts: { pos: THREE.Vector3; rx: number; ry: number }[] = [];
      const oc = V3(1.195, 1.695, 0.074 * sd);
      for (let i = 0; i <= 12; i++) {
        const ang = (i / 12) * Math.PI * 2;
        pts.push({
          pos: V3(
            oc.x + Math.cos(ang) * 0.026,
            oc.y + Math.sin(ang) * 0.021,
            oc.z + Math.cos(ang * 0.6) * 0.004 * sd,
          ),
          rx: 0.0055,
          ry: 0.0075,
        });
      }
      return createBiospheraMuscleMesh(pts, msuMat(), {
        originTendonFrac: 0,
        insertionTendonFrac: 0,
        radialSegs: 8,
        subdivsPerSpan: 1,
        grooveAO: 0.16,
      });
    }),
    'center',
    V3(1.195, 1.695, 0),
  );

  // Elevador nasolabial (equ.mus.cab.011 — sculpted broad strap from frontal bridge to upper lip/nostril)
  push(
    'equ.mus.cab.011',
    buildBilateralMuscular((sd) =>
      createSculptedMuscleSheetMesh(
        [
          { x: 1.24, yTop: 1.65, yBot: 1.59, zMid: 0.024, zBow: 0.022 },
          { x: 1.38, yTop: 1.55, yBot: 1.48, zMid: 0.032, zBow: 0.019 },
          { x: 1.51, yTop: 1.435, yBot: 1.375, zMid: 0.032, zBow: 0.013 },
        ],
        sd,
        msuMat(),
        {
          verticalSegs: 8,
          longSubdivs: 3,
          horizontalFibers: true,
          aponeuroticEdgeFade: true,
          dorsalAponeurosis: 0.22,
          ventralAponeurosis: 0.2,
          thickness: 0.008,
        },
      ),
    ),
    'center',
    V3(1.38, 1.51, 0),
  );

  // Elevador del labio superior (equ.mus.cab.012 — curved belly with long dorsal nasal tendon)
  push(
    'equ.mus.cab.012',
    buildBilateralMuscular((sd) =>
      createBiospheraMuscleMesh(
        [
          { pos: V3(1.26, 1.59, 0.054 * sd), rx: 0.008, ry: 0.013 },
          { pos: V3(1.35, 1.54, 0.048 * sd), rx: 0.011, ry: 0.016 },
          { pos: V3(1.44, 1.48, 0.03 * sd), rx: 0.006, ry: 0.008 },
          { pos: V3(1.52, 1.415, 0.012 * sd), rx: 0.004, ry: 0.005 },
        ],
        msuMat(),
        { originTendonFrac: 0.1, insertionTendonFrac: 0.44, radialSegs: 12 },
      ),
    ),
    'center',
    V3(1.40, 1.50, 0),
  );

  // Músculo cigomático (equ.mus.cab.015 — curved cheek ribbon facial crest -> lip commissure)
  push(
    'equ.mus.cab.015',
    buildBilateralMuscular((sd) =>
      createBiospheraMuscleMesh(
        [
          { pos: V3(1.245, 1.57, 0.065 * sd), rx: 0.005, ry: 0.01 },
          { pos: V3(1.36, 1.48, 0.056 * sd), rx: 0.006, ry: 0.012 },
          { pos: V3(1.485, 1.382, 0.043 * sd), rx: 0.005, ry: 0.008 },
        ],
        msuMat(),
        { originTendonFrac: 0.22, insertionTendonFrac: 0.16, radialSegs: 10 },
      ),
    ),
    'center',
    V3(1.36, 1.48, 0),
  );

  // Buccinador (equ.mus.cab.014 — thick cheek wall closing space cranial to masseter)
  push(
    'equ.mus.cab.014',
    buildBilateralMuscular((sd) =>
      createSculptedMuscleSheetMesh(
        [
          { x: 1.24, yTop: 1.52, yBot: 1.435, zMid: 0.046, zBow: 0.014 },
          { x: 1.36, yTop: 1.46, yBot: 1.375, zMid: 0.042, zBow: 0.013 },
          { x: 1.475, yTop: 1.40, yBot: 1.345, zMid: 0.036, zBow: 0.009 },
        ],
        sd,
        mprMat(),
        {
          verticalSegs: 8,
          longSubdivs: 3,
          horizontalFibers: true,
          aponeuroticEdgeFade: true,
          dorsalAponeurosis: 0.14,
          ventralAponeurosis: 0.14,
          thickness: 0.011,
        },
      ),
    ),
    'center',
    V3(1.36, 1.43, 0),
  );

  // Orbicular de la boca (equ.mus.cab.013 — horseshoe muzzle sphincter) & Depresor labio inferior (cab.016)
  push(
    'equ.mus.cab.013',
    buildBilateralMuscular((sd) =>
      createBiospheraMuscleMesh(
        [
          { pos: V3(1.495, 1.39, 0.038 * sd), rx: 0.012, ry: 0.016 },
          { pos: V3(1.542, 1.38, 0.025 * sd), rx: 0.015, ry: 0.02 },
          { pos: V3(1.546, 1.355, 0.016 * sd), rx: 0.014, ry: 0.018 },
          { pos: V3(1.505, 1.338, 0.028 * sd), rx: 0.011, ry: 0.014 },
        ],
        msuMat(),
        { originTendonFrac: 0.06, insertionTendonFrac: 0.06, radialSegs: 12 },
      ),
    ),
    'center',
    V3(1.525, 1.37, 0),
  );
  push(
    'equ.mus.cab.016',
    buildBilateralMuscular((sd) =>
      createBiospheraMuscleMesh(
        [
          { pos: V3(1.29, 1.415, 0.044 * sd), rx: 0.006, ry: 0.01 },
          { pos: V3(1.39, 1.368, 0.036 * sd), rx: 0.007, ry: 0.011 },
          { pos: V3(1.495, 1.322, 0.022 * sd), rx: 0.005, ry: 0.008 },
        ],
        msuMat(),
        { originTendonFrac: 0.14, insertionTendonFrac: 0.18, radialSegs: 10 },
      ),
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
    push(
      `equ.mus.cab.028-${tag}`,
      createBiospheraMuscleMesh(
        [
          { pos: V3(1.215, 1.638, 0.068 * sd), rx: 0.007, ry: 0.014 },
          { pos: V3(1.255, 1.59, 0.066 * sd), rx: 0.008, ry: 0.016 },
          { pos: V3(1.295, 1.54, 0.058 * sd), rx: 0.006, ry: 0.012 },
        ],
        msuMat(),
        { originTendonFrac: 0.1, insertionTendonFrac: 0.12, radialSegs: 10 },
      ),
      side,
    );
    push(
      `equ.mus.cab.049-${tag}`,
      createBiospheraMuscleMesh(
        [
          { pos: V3(1.495, 1.422, 0.004 * sd), rx: 0.009, ry: 0.011 },
          { pos: V3(1.515, 1.415, 0.022 * sd), rx: 0.011, ry: 0.014 },
          { pos: V3(1.53, 1.398, 0.036 * sd), rx: 0.008, ry: 0.01 },
        ],
        msuMat(),
        { originTendonFrac: 0.15, insertionTendonFrac: 0.1, radialSegs: 10 },
      ),
      side,
    );

    // NECK ÉCORCHÉ (S-curved Biosphera bellies & overlapping broad sheets)
    push(
      `equ.mus.cue.002-${tag}`, // Braquiocefálico (arched jugular dorsal border)
      createBiospheraMuscleMesh(
        [
          { pos: V3(0.99, 1.655, 0.056 * sd), rx: 0.026, ry: 0.042 },
          { pos: V3(0.83, 1.51, 0.078 * sd), rx: 0.038, ry: 0.064 },
          { pos: V3(0.65, 1.32, 0.098 * sd), rx: 0.044, ry: 0.072 },
          { pos: V3(0.50, 1.15, 0.128 * sd), rx: 0.04, ry: 0.064 },
          { pos: fl.shoulder.clone().add(V3(0.03, -0.04, 0.008 * sd)), rx: 0.026, ry: 0.038 },
        ],
        msuMat(),
        { originTendonFrac: 0.12, insertionTendonFrac: 0.15, radialSegs: 16, grooveAO: 0.28 },
      ),
      side,
    );
    push(
      `equ.mus.cue.003-${tag}`, // Esternocefálico (jugular ventral border)
      createBiospheraMuscleMesh(
        [
          { pos: HEAD.jawAngle(sd), rx: 0.018, ry: 0.024 },
          { pos: V3(0.86, 1.42, 0.056 * sd), rx: 0.024, ry: 0.038 },
          { pos: V3(0.67, 1.16, 0.052 * sd), rx: 0.026, ry: 0.04 },
          { pos: V3(0.49, 0.94, 0.026 * sd), rx: 0.018, ry: 0.026 },
        ],
        msuMat(),
        { originTendonFrac: 0.22, insertionTendonFrac: 0.16, radialSegs: 14, grooveAO: 0.24 },
      ),
      side,
    );
    push(
      `equ.mus.ext.006-${tag}`, // Omotransverso
      createBiospheraMuscleMesh(
        [
          { pos: V3(0.95, 1.68, 0.054 * sd), rx: 0.02, ry: 0.038 },
          { pos: V3(0.75, 1.50, 0.088 * sd), rx: 0.028, ry: 0.05 },
          { pos: V3(0.55, 1.32, 0.125 * sd), rx: 0.028, ry: 0.048 },
          { pos: fl.shoulder.clone().add(V3(0.01, 0.09, 0.024 * sd)), rx: 0.022, ry: 0.036 },
        ],
        msuMat(),
        { originTendonFrac: 0.12, insertionTendonFrac: 0.16, radialSegs: 14, grooveAO: 0.24 },
      ),
      side,
    );
    push(
      `equ.mus.cue.007-${tag}`, // Esplenio (sculpted arched neck sheet)
      createSculptedMuscleSheetMesh(
        [
          { x: 0.36, yTop: 1.54, yBot: 1.38, zMid: 0.072, zBow: 0.022 },
          { x: 0.56, yTop: 1.61, yBot: 1.41, zMid: 0.064, zBow: 0.026 },
          { x: 0.78, yTop: 1.70, yBot: 1.51, zMid: 0.052, zBow: 0.022 },
          { x: 0.98, yTop: 1.76, yBot: 1.63, zMid: 0.036, zBow: 0.014 },
        ],
        sd,
        msuMat(),
        {
          verticalSegs: 12,
          longSubdivs: 3,
          horizontalFibers: true,
          aponeuroticEdgeFade: true,
          dorsalAponeurosis: 0.18,
          ventralAponeurosis: 0.22,
          thickness: 0.016,
        },
      ),
      side,
    );
    push(
      `equ.mus.ext.007-${tag}`, // Serrato ventral cervical
      createSculptedMuscleSheetMesh(
        [
          { x: 0.38, yTop: 1.44, yBot: 1.24, zMid: 0.112, zBow: 0.028 },
          { x: 0.56, yTop: 1.50, yBot: 1.29, zMid: 0.088, zBow: 0.028 },
          { x: 0.72, yTop: 1.57, yBot: 1.38, zMid: 0.064, zBow: 0.024 },
          { x: 0.86, yTop: 1.64, yBot: 1.49, zMid: 0.048, zBow: 0.015 },
        ],
        sd,
        mprMat(),
        {
          verticalSegs: 10,
          longSubdivs: 3,
          horizontalFibers: true,
          aponeuroticEdgeFade: true,
          dorsalAponeurosis: 0.18,
          ventralAponeurosis: 0.24,
          thickness: 0.015,
        },
      ),
      side,
    );
    push(
      `equ.mus.ext.003-${tag}`, // Romboides cervical
      createBiospheraMuscleMesh(
        [
          { pos: V3(0.94, 1.75, 0.022 * sd), rx: 0.018, ry: 0.032 },
          { pos: V3(0.68, 1.65, 0.036 * sd), rx: 0.024, ry: 0.044 },
          { pos: V3(0.36, 1.46, 0.055 * sd), rx: 0.022, ry: 0.04 },
        ],
        mprMat(),
        { originTendonFrac: 0.14, insertionTendonFrac: 0.14, radialSegs: 12 },
      ),
      side,
    );
    push(
      `equ.mus.cue.008-${tag}`, // Semiespinoso de la cabeza
      createBiospheraMuscleMesh(
        [
          { pos: V3(1.00, 1.75, 0.03 * sd), rx: 0.026, ry: 0.042 },
          { pos: V3(0.72, 1.61, 0.04 * sd), rx: 0.034, ry: 0.052 },
          { pos: V3(0.42, 1.42, 0.044 * sd), rx: 0.028, ry: 0.044 },
        ],
        mprMat(),
        { originTendonFrac: 0.14, insertionTendonFrac: 0.14, radialSegs: 14 },
      ),
      side,
    );
    push(
      `equ.mus.cue.011-${tag}`, // Longuísimo del cuello
      createBiospheraMuscleMesh(
        [
          { pos: V3(0.86, 1.62, 0.038 * sd), rx: 0.024, ry: 0.034 },
          { pos: V3(0.68, 1.43, 0.048 * sd), rx: 0.03, ry: 0.04 },
          { pos: V3(0.50, 1.26, 0.048 * sd), rx: 0.024, ry: 0.034 },
        ],
        mprMat(),
        { originTendonFrac: 0.12, insertionTendonFrac: 0.12, radialSegs: 12 },
      ),
      side,
    );
    push(
      `equ.mus.cue.004-${tag}`, // Omohioideo
      createBiospheraMuscleMesh(
        [
          { pos: V3(0.95, 1.59, 0.028 * sd), rx: 0.012, ry: 0.022 },
          { pos: V3(0.74, 1.36, 0.044 * sd), rx: 0.014, ry: 0.026 },
          { pos: V3(0.54, 1.16, 0.048 * sd), rx: 0.012, ry: 0.022 },
        ],
        mprMat(),
        { originTendonFrac: 0.14, insertionTendonFrac: 0.14, radialSegs: 10 },
      ),
      side,
    );
    push(
      `equ.mus.cue.005-${tag}`, // Esternohioideo
      createBiospheraMuscleMesh(
        [
          { pos: V3(0.93, 1.56, 0.016 * sd), rx: 0.012, ry: 0.016 },
          { pos: V3(0.72, 1.26, 0.02 * sd), rx: 0.014, ry: 0.019 },
          { pos: V3(0.49, 0.96, 0.018 * sd), rx: 0.012, ry: 0.016 },
        ],
        mprMat(),
        { originTendonFrac: 0.12, insertionTendonFrac: 0.14, radialSegs: 10 },
      ),
      side,
    );

    // WITHERS, BACK & THORAX ÉCORCHÉ
    push(
      `equ.mus.ext.001-${tag}`, // Trapecio cervical (broad triangular fan from nuchal crest to scapular spine)
      createSculptedMuscleSheetMesh(
        [
          { x: 0.30, yTop: 1.54, yBot: 1.33, zMid: 0.105, zBow: 0.028 },
          { x: 0.48, yTop: 1.59, yBot: 1.39, zMid: 0.088, zBow: 0.026 },
          { x: 0.68, yTop: 1.66, yBot: 1.51, zMid: 0.062, zBow: 0.02 },
          { x: 0.85, yTop: 1.72, yBot: 1.64, zMid: 0.036, zBow: 0.012 },
        ],
        sd,
        msuMat(),
        {
          verticalSegs: 12,
          longSubdivs: 3,
          horizontalFibers: true,
          aponeuroticEdgeFade: true,
          dorsalAponeurosis: 0.26,
          ventralAponeurosis: 0.2,
          thickness: 0.014,
        },
      ),
      side,
    );
    push(
      `equ.mus.ext.002-${tag}`, // Trapecio torácico (triangular sheet from withers to scapular spine)
      createSculptedMuscleSheetMesh(
        [
          { x: 0.02, yTop: 1.40, yBot: 1.34, zMid: 0.048, zBow: 0.02 },
          { x: 0.16, yTop: 1.48, yBot: 1.30, zMid: 0.095, zBow: 0.038 },
          { x: 0.30, yTop: 1.53, yBot: 1.29, zMid: 0.112, zBow: 0.034 },
        ],
        sd,
        msuMat(),
        {
          verticalSegs: 10,
          longSubdivs: 3,
          horizontalFibers: true,
          aponeuroticEdgeFade: true,
          dorsalAponeurosis: 0.28,
          ventralAponeurosis: 0.2,
          thickness: 0.014,
        },
      ),
      side,
    );
    push(
      `equ.mus.ext.004-${tag}`, // Romboides torácico
      createSculptedMuscleSheetMesh(
        [
          { x: 0.14, yTop: 1.47, yBot: 1.36, zMid: 0.05, zBow: 0.025 },
          { x: 0.28, yTop: 1.49, yBot: 1.35, zMid: 0.08, zBow: 0.03 },
          { x: 0.40, yTop: 1.48, yBot: 1.36, zMid: 0.07, zBow: 0.02 },
        ],
        sd,
        mprMat(),
        {
          verticalSegs: 8,
          longSubdivs: 2,
          horizontalFibers: true,
          aponeuroticEdgeFade: true,
          dorsalAponeurosis: 0.18,
          ventralAponeurosis: 0.16,
          thickness: 0.012,
        },
      ),
      side,
    );

    // Longuísimo lumbar (dor.003) & torácico (dor.004) + Iliocostal lumbar (dor.001) & torácico (dor.002)
    push(
      `equ.mus.dor.003-${tag}`,
      createSculptedMuscleSheetMesh(
        [
          { x: -0.76, yTop: 1.39, yBot: 1.27, zMid: 0.035, zBow: 0.055 },
          { x: -0.56, yTop: 1.40, yBot: 1.27, zMid: 0.04, zBow: 0.065 },
          { x: -0.35, yTop: 1.39, yBot: 1.27, zMid: 0.04, zBow: 0.065 },
        ],
        sd,
        msuMat(),
        { verticalSegs: 10, longSubdivs: 3, aponeuroticEdgeFade: true, dorsalAponeurosis: 0.28, ventralAponeurosis: 0.14, thickness: 0.018 },
      ),
      side,
    );
    push(
      `equ.mus.dor.004-${tag}`,
      createSculptedMuscleSheetMesh(
        [
          { x: -0.35, yTop: 1.39, yBot: 1.27, zMid: 0.04, zBow: 0.065 },
          { x: -0.05, yTop: 1.38, yBot: 1.25, zMid: 0.045, zBow: 0.072 },
          { x: 0.25, yTop: 1.38, yBot: 1.24, zMid: 0.045, zBow: 0.062 },
          { x: 0.46, yTop: 1.34, yBot: 1.23, zMid: 0.04, zBow: 0.04 },
        ],
        sd,
        msuMat(),
        { verticalSegs: 10, longSubdivs: 3, aponeuroticEdgeFade: true, dorsalAponeurosis: 0.26, ventralAponeurosis: 0.14, thickness: 0.018 },
      ),
      side,
    );
    push(
      `equ.mus.dor.001-${tag}`,
      createBiospheraMuscleMesh(
        [
          { pos: V3(-0.70, 1.33, 0.095 * sd), rx: 0.022, ry: 0.032 },
          { pos: V3(-0.52, 1.31, 0.118 * sd), rx: 0.026, ry: 0.038 },
          { pos: V3(-0.34, 1.28, 0.125 * sd), rx: 0.022, ry: 0.032 },
        ],
        msuMat(),
        { radialSegs: 12 },
      ),
      side,
    );
    push(
      `equ.mus.dor.002-${tag}`,
      createBiospheraMuscleMesh(
        [
          { pos: V3(-0.34, 1.28, 0.125 * sd), rx: 0.02, ry: 0.032 },
          { pos: V3(0.02, 1.25, 0.132 * sd), rx: 0.024, ry: 0.036 },
          { pos: V3(0.38, 1.22, 0.105 * sd), rx: 0.018, ry: 0.028 },
        ],
        msuMat(),
        { radialSegs: 12 },
      ),
      side,
    );

    // Serrato dorsal craneal (tor.001) & caudal (tor.002) with serrated ventral digitations
    push(
      `equ.mus.tor.001-${tag}`,
      createSculptedMuscleSheetMesh(
        [
          { x: -0.02, yTop: 1.32, yBot: 1.19, zMid: 0.14, zBow: 0.065 },
          { x: 0.16, yTop: 1.33, yBot: 1.19, zMid: 0.13, zBow: 0.06 },
          { x: 0.30, yTop: 1.33, yBot: 1.21, zMid: 0.11, zBow: 0.04 },
        ],
        sd,
        msuMat(),
        { verticalSegs: 8, longSubdivs: 3, aponeuroticEdgeFade: true, dorsalAponeurosis: 0.34, ventralAponeurosis: 0.12, costalDigitations: 4, thickness: 0.011 },
      ),
      side,
    );
    push(
      `equ.mus.tor.002-${tag}`,
      createSculptedMuscleSheetMesh(
        [
          { x: -0.36, yTop: 1.31, yBot: 1.16, zMid: 0.14, zBow: 0.06 },
          { x: -0.18, yTop: 1.32, yBot: 1.16, zMid: 0.15, zBow: 0.07 },
          { x: -0.02, yTop: 1.32, yBot: 1.18, zMid: 0.14, zBow: 0.065 },
        ],
        sd,
        msuMat(),
        { verticalSegs: 8, longSubdivs: 3, aponeuroticEdgeFade: true, dorsalAponeurosis: 0.34, ventralAponeurosis: 0.12, costalDigitations: 4, thickness: 0.011 },
      ),
      side,
    );

    // Serrato ventral torácico (equ.mus.ext.008-i/d — 7 curved fan digitations wrapping ribs up to scapula)
    const serrThor = new THREE.Group();
    for (let dig = 0; dig < 7; dig++) {
      const rIdx = 2 + dig;
      const arc = ribArcPoints(rIdx, sd);
      const originRib = arc[2].clone().lerp(arc[3], 0.35 + dig * 0.05);
      const insScap = fl.scapulaTop.clone().lerp(fl.shoulder, 0.25).add(V3(-0.02 + dig * 0.008, -0.02, -0.015 * sd));
      const midRib = originRib.clone().lerp(insScap, 0.5).add(V3(0, 0.01, 0.012 * sd));
      serrThor.add(
        createBiospheraMuscleMesh(
          [
            { pos: originRib, rx: 0.012, ry: 0.024 },
            { pos: midRib, rx: 0.016, ry: 0.032 },
            { pos: insScap, rx: 0.012, ry: 0.022 },
          ],
          mprMat(),
          { originTendonFrac: 0.2, insertionTendonFrac: 0.14, radialSegs: 12, grooveAO: 0.22 },
        ),
      );
    }
    push(`equ.mus.ext.008-${tag}`, serrThor, side);

    // 17 Intercostales externos (equ.mus.tor.012..028-i/d)
    for (let sp = 1; sp <= 17; sp++) {
      const arcA = ribArcPoints(sp, sd);
      const arcB = ribArcPoints(sp + 1, sd);
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
      const icIdNum = 11 + sp;
      push(`equ.mus.tor.${String(icIdNum).padStart(3, '0')}-${tag}`, icMesh, side);
    }

    // Dorsal ancho / Latissimus dorsi (equ.mus.ext.005-i/d)
    push(
      `equ.mus.ext.005-${tag}`,
      createSculptedMuscleSheetMesh(
        [
          { x: -0.34, yTop: 1.38, yBot: 1.24, zMid: 0.15, zBow: 0.052 },
          { x: -0.14, yTop: 1.36, yBot: 1.15, zMid: 0.19, zBow: 0.068 },
          { x: 0.08, yTop: 1.33, yBot: 1.07, zMid: 0.21, zBow: 0.062 },
          { x: 0.28, yTop: 1.26, yBot: 0.99, zMid: 0.18, zBow: 0.036 },
          { x: 0.42, yTop: 1.12, yBot: 0.98, zMid: 0.155, zBow: 0.015 },
        ],
        sd,
        msuMat(),
        { verticalSegs: 14, longSubdivs: 3, aponeuroticEdgeFade: true, dorsalAponeurosis: 0.36, ventralAponeurosis: 0.14, thickness: 0.015 },
      ),
      side,
    );

    // Fascia toracolumbar (equ.mus.tor.011-i/d)
    push(
      `equ.mus.tor.011-${tag}`,
      createSculptedMuscleSheetMesh(
        [
          { x: -0.78, yTop: 1.40, yBot: 1.26, zMid: 0.05, zBow: 0.068 },
          { x: -0.55, yTop: 1.44, yBot: 1.25, zMid: 0.06, zBow: 0.082 },
          { x: -0.32, yTop: 1.42, yBot: 1.25, zMid: 0.06, zBow: 0.086 },
          { x: -0.12, yTop: 1.39, yBot: 1.24, zMid: 0.05, zBow: 0.07 },
        ],
        sd,
        fasMat(),
        { verticalSegs: 10, longSubdivs: 3, aponeuroticEdgeFade: false, thickness: 0.008 },
      ),
      side,
    );

    // Pectoral descendente (009), transverso (010), profundo ascendente (011)
    push(
      `equ.mus.ext.009-${tag}`,
      createBiospheraMuscleMesh(
        [
          { pos: V3(0.49, 0.95, 0.018 * sd), rx: 0.04, ry: 0.055 },
          { pos: V3(0.48, 0.89, 0.072 * sd), rx: 0.062, ry: 0.086 },
          { pos: fl.shoulder.clone().add(V3(0.02, -0.13, 0.005 * sd)), rx: 0.036, ry: 0.052 },
        ],
        msuMat(),
        { radialSegs: 14, grooveAO: 0.26 },
      ),
      side,
    );
    push(
      `equ.mus.ext.010-${tag}`,
      createBiospheraMuscleMesh(
        [
          { pos: V3(0.35, 0.84, 0.018 * sd), rx: 0.026, ry: 0.042 },
          { pos: V3(0.34, 0.82, 0.082 * sd), rx: 0.034, ry: 0.052 },
          { pos: fl.elbow.clone().add(V3(0.01, 0.02, -0.02 * sd)), rx: 0.024, ry: 0.036 },
        ],
        msuMat(),
        { radialSegs: 14, grooveAO: 0.24 },
      ),
      side,
    );
    push(
      `equ.mus.ext.011-${tag}`,
      createBiospheraMuscleMesh(
        [
          { pos: V3(-0.04, 0.80, 0.075 * sd), rx: 0.038, ry: 0.068 },
          { pos: V3(0.18, 0.82, 0.118 * sd), rx: 0.046, ry: 0.082 },
          { pos: fl.shoulder.clone().add(V3(0.01, 0.02, -0.02 * sd)), rx: 0.032, ry: 0.056 },
        ],
        mprMat(),
        { radialSegs: 14, grooveAO: 0.22 },
      ),
      side,
    );

    // ABDOMINAL WALL ÉCORCHÉ (signature Biosphera costal digitations + ventral aponeurosis)
    push(
      `equ.mus.abd.001-${tag}`, // Oblicuo externo del abdomen
      createSculptedMuscleSheetMesh(
        [
          { x: -0.68, yTop: 1.24, yBot: 0.96, zMid: 0.15, zBow: 0.052 },
          { x: -0.48, yTop: 1.23, yBot: 0.87, zMid: 0.16, zBow: 0.082 },
          { x: -0.25, yTop: 1.21, yBot: 0.82, zMid: 0.17, zBow: 0.096 },
          { x: -0.02, yTop: 1.18, yBot: 0.81, zMid: 0.17, zBow: 0.092 },
          { x: 0.16, yTop: 1.13, yBot: 0.84, zMid: 0.15, zBow: 0.056 },
        ],
        sd,
        msuMat(),
        {
          verticalSegs: 14,
          longSubdivs: 4,
          horizontalFibers: true,
          aponeuroticEdgeFade: true,
          dorsalAponeurosis: 0.1,
          ventralAponeurosis: 0.34,
          costalDigitations: 6,
          thickness: 0.015,
        },
      ),
      side,
    );
    push(
      `equ.mus.abd.002-${tag}`, // Oblicuo interno del abdomen
      createSculptedMuscleSheetMesh(
        [
          { x: -0.71, yTop: 1.32, yBot: 1.00, zMid: 0.15, zBow: 0.045 },
          { x: -0.56, yTop: 1.26, yBot: 0.91, zMid: 0.16, zBow: 0.062 },
          { x: -0.38, yTop: 1.20, yBot: 0.86, zMid: 0.165, zBow: 0.072 },
        ],
        sd,
        mprMat(),
        { verticalSegs: 10, longSubdivs: 3, aponeuroticEdgeFade: true, dorsalAponeurosis: 0.12, ventralAponeurosis: 0.28, thickness: 0.013 },
      ),
      side,
    );
    push(
      `equ.mus.abd.004-${tag}`, // Recto del abdomen
      createSculptedMuscleSheetMesh(
        [
          { x: -0.75, yTop: 1.06, yBot: 0.98, zMid: 0.015, zBow: 0.05 },
          { x: -0.50, yTop: 0.89, yBot: 0.82, zMid: 0.015, zBow: 0.085 },
          { x: -0.20, yTop: 0.81, yBot: 0.745, zMid: 0.015, zBow: 0.095 },
          { x: 0.12, yTop: 0.84, yBot: 0.78, zMid: 0.015, zBow: 0.07 },
        ],
        sd,
        mprMat(),
        { verticalSegs: 8, longSubdivs: 3, aponeuroticEdgeFade: true, dorsalAponeurosis: 0.14, ventralAponeurosis: 0.18, thickness: 0.014 },
      ),
      side,
    );
    push(
      `equ.mus.abd.006-${tag}`, // Túnica flava del abdomen
      createSculptedMuscleSheetMesh(
        [
          { x: -0.62, yTop: 0.97, yBot: 0.89, zMid: 0.04, zBow: 0.09 },
          { x: -0.32, yTop: 0.87, yBot: 0.77, zMid: 0.03, zBow: 0.14 },
          { x: 0.02, yTop: 0.84, yBot: 0.76, zMid: 0.03, zBow: 0.12 },
        ],
        sd,
        fasMat(),
        { verticalSegs: 8, longSubdivs: 3, aponeuroticEdgeFade: false, thickness: 0.008 },
      ),
      side,
    );

    // FORELIMB ÉCORCHÉ (sculpted interlocking curved shoulder, triceps & forearm bellies)
    push(
      `equ.mus.hom.001-${tag}`, // Supraespinoso
      createBiospheraMuscleMesh(
        [
          { pos: fl.scapulaTop.clone().add(V3(0.04, -0.02, 0.02 * sd)), rx: 0.026, ry: 0.048 },
          { pos: fl.scapulaTop.clone().lerp(fl.shoulder, 0.5).add(V3(0.045, 0.01, 0.026 * sd)), rx: 0.032, ry: 0.06 },
          { pos: fl.shoulder.clone().add(V3(0.03, 0.02, 0.01 * sd)), rx: 0.024, ry: 0.042 },
        ],
        mprMat(),
        { originTendonFrac: 0.1, insertionTendonFrac: 0.2, radialSegs: 14, grooveAO: 0.26 },
      ),
      side,
    );
    push(
      `equ.mus.hom.002-${tag}`, // Infraespinoso
      createBiospheraMuscleMesh(
        [
          { pos: fl.scapulaTop.clone().add(V3(-0.04, -0.02, 0.02 * sd)), rx: 0.024, ry: 0.046 },
          { pos: fl.scapulaTop.clone().lerp(fl.shoulder, 0.52).add(V3(-0.035, 0, 0.032 * sd)), rx: 0.03, ry: 0.058 },
          { pos: fl.shoulder.clone().add(V3(-0.02, 0.01, 0.03 * sd)), rx: 0.022, ry: 0.042 },
        ],
        mprMat(),
        { originTendonFrac: 0.1, insertionTendonFrac: 0.22, radialSegs: 14, grooveAO: 0.26 },
      ),
      side,
    );
    push(
      `equ.mus.hom.003-${tag}`, // Deltoides (curved acromial/scapular spine arc)
      createBiospheraMuscleMesh(
        [
          { pos: V3(0.34, 1.34, 0.165 * sd), rx: 0.022, ry: 0.044 },
          { pos: V3(0.37, 1.19, 0.184 * sd), rx: 0.028, ry: 0.056 },
          { pos: fl.shoulder.clone().add(V3(-0.04, -0.09, 0.028 * sd)), rx: 0.02, ry: 0.038 },
        ],
        msuMat(),
        { originTendonFrac: 0.18, insertionTendonFrac: 0.18, radialSegs: 14, grooveAO: 0.26 },
      ),
      side,
    );
    push(
      `equ.mus.hom.005-${tag}`, // Redondo mayor
      createBiospheraMuscleMesh(
        [
          { pos: fl.scapulaTop.clone().add(V3(-0.06, -0.06, -0.01 * sd)), rx: 0.018, ry: 0.032 },
          { pos: fl.scapulaTop.clone().lerp(fl.elbow, 0.45).add(V3(-0.03, 0.03, -0.02 * sd)), rx: 0.022, ry: 0.04 },
          { pos: fl.elbow.clone().add(V3(0.02, 0.14, -0.02 * sd)), rx: 0.016, ry: 0.028 },
        ],
        mprMat(),
        { radialSegs: 12 },
      ),
      side,
    );
    push(
      `equ.mus.bra.007-${tag}`, // Tríceps cabeza larga (massive triangular Biosphera dome)
      createBiospheraMuscleMesh(
        [
          { pos: V3(0.28, 1.24, 0.16 * sd), rx: 0.042, ry: 0.068 },
          { pos: V3(0.295, 1.07, 0.174 * sd), rx: 0.052, ry: 0.09 },
          { pos: fl.elbow.clone().add(V3(-0.02, 0.06, 0.012 * sd)), rx: 0.034, ry: 0.054 },
        ],
        msuMat(),
        { originTendonFrac: 0.12, insertionTendonFrac: 0.16, radialSegs: 16, grooveAO: 0.28 },
      ),
      side,
    );
    push(
      `equ.mus.bra.008-${tag}`, // Tríceps cabeza lateral
      createBiospheraMuscleMesh(
        [
          { pos: fl.shoulder.clone().add(V3(-0.03, -0.03, 0.026 * sd)), rx: 0.028, ry: 0.044 },
          { pos: fl.shoulder.clone().lerp(fl.elbow, 0.48).add(V3(-0.02, 0.01, 0.034 * sd)), rx: 0.034, ry: 0.052 },
          { pos: fl.elbow.clone().add(V3(-0.01, 0.05, 0.024 * sd)), rx: 0.024, ry: 0.038 },
        ],
        msuMat(),
        { originTendonFrac: 0.14, insertionTendonFrac: 0.18, radialSegs: 14, grooveAO: 0.26 },
      ),
      side,
    );
    push(
      `equ.mus.bra.002-${tag}`, // Tensor de la fascia del antebrazo
      createBiospheraMuscleMesh(
        [
          { pos: V3(0.26, 1.18, 0.14 * sd), rx: 0.012, ry: 0.028 },
          { pos: V3(0.26, 1.01, 0.15 * sd), rx: 0.015, ry: 0.036 },
          { pos: fl.elbow.clone().add(V3(-0.038, 0.07, 0)), rx: 0.012, ry: 0.026 },
        ],
        msuMat(),
        { originTendonFrac: 0.15, insertionTendonFrac: 0.25, radialSegs: 12 },
      ),
      side,
    );
    push(
      `equ.mus.bra.004-${tag}`, // Bíceps braquial
      createBiospheraMuscleMesh(
        [
          { pos: fl.shoulder.clone().add(V3(0.02, 0.01, 0)), rx: 0.028, ry: 0.038 },
          { pos: fl.shoulder.clone().lerp(fl.elbow, 0.48).add(V3(0.03, 0, 0.008 * sd)), rx: 0.036, ry: 0.048 },
          { pos: fl.elbow.clone().add(V3(0.02, -0.02, 0)), rx: 0.024, ry: 0.032 },
        ],
        mprMat(),
        { originTendonFrac: 0.18, insertionTendonFrac: 0.18, radialSegs: 14 },
      ),
      side,
    );
    push(
      `equ.mus.bra.005-${tag}`, // Braquial (spiraling in musculospiral groove)
      createBiospheraMuscleMesh(
        [
          { pos: fl.shoulder.clone().add(V3(-0.02, -0.04, 0.022 * sd)), rx: 0.02, ry: 0.028 },
          { pos: fl.shoulder.clone().lerp(fl.elbow, 0.5).add(V3(0.01, -0.01, 0.024 * sd)), rx: 0.024, ry: 0.034 },
          { pos: fl.elbow.clone().add(V3(0.015, -0.01, 0.01 * sd)), rx: 0.018, ry: 0.024 },
        ],
        mprMat(),
        { radialSegs: 12 },
      ),
      side,
    );

    const ercGrp = new THREE.Group();
    ercGrp.add(
      createBiospheraMuscleMesh(
        [
          { pos: fl.elbow.clone().add(V3(0.025, 0.02, 0.008 * sd)), rx: 0.022, ry: 0.032 },
          { pos: fl.elbow.clone().lerp(fl.carpus, 0.32).add(V3(0.032, 0, 0.008 * sd)), rx: 0.026, ry: 0.04 },
          { pos: fl.carpus.clone().add(V3(0.018, 0.08, 0)), rx: 0.014, ry: 0.022 },
        ],
        msuMat(),
        { originTendonFrac: 0.12, insertionTendonFrac: 0.3, radialSegs: 14, grooveAO: 0.24 },
      ),
    );
    ercGrp.add(createTubeCurveMesh([fl.carpus.clone().add(V3(0.018, 0.08, 0)), fl.carpus.clone().add(V3(0.018, -0.03, -0.004 * sd))], 0.007, tenMat(), 8, 6));
    push(`equ.mus.ant.001-${tag}`, ercGrp, side);

    const edcGrp = new THREE.Group();
    edcGrp.add(
      createBiospheraMuscleMesh(
        [
          { pos: fl.elbow.clone().add(V3(0.015, 0.0, 0.022 * sd)), rx: 0.016, ry: 0.024 },
          { pos: fl.elbow.clone().lerp(fl.carpus, 0.34).add(V3(0.02, 0, 0.022 * sd)), rx: 0.02, ry: 0.03 },
          { pos: fl.carpus.clone().add(V3(0.016, 0.08, 0.01 * sd)), rx: 0.011, ry: 0.016 },
        ],
        msuMat(),
        { originTendonFrac: 0.12, insertionTendonFrac: 0.28, radialSegs: 12, grooveAO: 0.22 },
      ),
    );
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
    edlFore.add(
      createBiospheraMuscleMesh(
        [
          { pos: fl.elbow.clone().add(V3(0.002, -0.01, 0.028 * sd)), rx: 0.012, ry: 0.018 },
          { pos: fl.elbow.clone().lerp(fl.carpus, 0.36).add(V3(0.006, 0, 0.028 * sd)), rx: 0.015, ry: 0.022 },
          { pos: fl.carpus.clone().add(V3(0.006, 0.08, 0.02 * sd)), rx: 0.008, ry: 0.012 },
        ],
        msuMat(),
        { originTendonFrac: 0.12, insertionTendonFrac: 0.26, radialSegs: 12 },
      ),
    );
    edlFore.add(createTubeCurveMesh([fl.carpus.clone().add(V3(0.006, 0.08, 0.02 * sd)), fl.carpus.clone().add(V3(0.008, 0, 0.018 * sd)), fl.fetlock.clone().add(V3(0.012, 0, 0.01 * sd))], 0.0045, tenMat(), 12, 6));
    push(`equ.mus.ant.003-${tag}`, edlFore, side);

    push(
      `equ.mus.ant.004-${tag}`,
      createBiospheraMuscleMesh(
        [
          { pos: fl.elbow.clone().add(V3(-0.014, -0.01, 0.026 * sd)), rx: 0.015, ry: 0.024 },
          { pos: fl.elbow.clone().lerp(fl.carpus, 0.38).add(V3(-0.024, 0, 0.026 * sd)), rx: 0.019, ry: 0.03 },
          { pos: fl.carpus.clone().add(V3(-0.024, 0.02, 0.016 * sd)), rx: 0.01, ry: 0.016 },
        ],
        msuMat(),
        { originTendonFrac: 0.12, insertionTendonFrac: 0.28, radialSegs: 12, grooveAO: 0.22 },
      ),
      side,
    );
    push(
      `equ.mus.ant.006-${tag}`,
      createBiospheraMuscleMesh(
        [
          { pos: fl.elbow.clone().add(V3(-0.015, -0.01, -0.02 * sd)), rx: 0.014, ry: 0.022 },
          { pos: fl.elbow.clone().lerp(fl.carpus, 0.36).add(V3(-0.022, 0, -0.02 * sd)), rx: 0.017, ry: 0.026 },
          { pos: fl.carpus.clone().add(V3(-0.018, 0.02, -0.016 * sd)), rx: 0.009, ry: 0.014 },
        ],
        msuMat(),
        { originTendonFrac: 0.12, insertionTendonFrac: 0.26, radialSegs: 12 },
      ),
      side,
    );
    push(
      `equ.mus.ant.007-${tag}`,
      createBiospheraMuscleMesh(
        [
          { pos: fl.elbow.clone().add(V3(-0.03, 0.02, -0.008 * sd)), rx: 0.015, ry: 0.024 },
          { pos: fl.elbow.clone().lerp(fl.carpus, 0.35).add(V3(-0.032, 0, 0.006 * sd)), rx: 0.018, ry: 0.028 },
          { pos: fl.carpus.clone().add(V3(-0.026, 0.02, 0.012 * sd)), rx: 0.01, ry: 0.016 },
        ],
        msuMat(),
        { originTendonFrac: 0.12, insertionTendonFrac: 0.24, radialSegs: 12 },
      ),
      side,
    );

    const sdfGrp = new THREE.Group();
    sdfGrp.add(
      createBiospheraMuscleMesh(
        [
          { pos: fl.elbow.clone().add(V3(-0.02, -0.01, -0.005 * sd)), rx: 0.02, ry: 0.03 },
          { pos: fl.elbow.clone().lerp(fl.carpus, 0.36).add(V3(-0.028, 0, 0)), rx: 0.024, ry: 0.036 },
          { pos: fl.carpus.clone().add(V3(-0.024, 0.10, 0)), rx: 0.013, ry: 0.02 },
        ],
        msuMat(),
        { originTendonFrac: 0.12, insertionTendonFrac: 0.24, radialSegs: 12 },
      ),
    );
    const sdfFet = fl.fetlock.clone().add(V3(-0.026, 0, 0));
    sdfGrp.add(createTubeCurveMesh([fl.carpus.clone().add(V3(-0.024, 0.10, 0)), fl.carpus.clone().add(V3(-0.028, 0, 0)), sdfFet], 0.007, tenMat(), 12, 7));
    sdfGrp.add(createTubeCurveMesh([sdfFet, fl.pasternMid.clone().add(V3(-0.016, -0.008, -0.013 * sd))], 0.005, tenMat(), 8, 6));
    sdfGrp.add(createTubeCurveMesh([sdfFet, fl.pasternMid.clone().add(V3(-0.016, -0.008, 0.013 * sd))], 0.005, tenMat(), 8, 6));
    push(`equ.mus.ant.008-${tag}`, sdfGrp, side);

    const ddfGrp = new THREE.Group();
    ddfGrp.add(
      createBiospheraMuscleMesh(
        [
          { pos: fl.elbow.clone().add(V3(-0.012, -0.02, 0.005 * sd)), rx: 0.018, ry: 0.028 },
          { pos: fl.elbow.clone().lerp(fl.carpus, 0.36).add(V3(-0.02, 0, 0.004 * sd)), rx: 0.022, ry: 0.034 },
          { pos: fl.carpus.clone().add(V3(-0.018, 0.11, 0)), rx: 0.012, ry: 0.018 },
        ],
        mprMat(),
        { originTendonFrac: 0.12, insertionTendonFrac: 0.24, radialSegs: 12 },
      ),
    );
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

    // HINDLIMB & CROUP ÉCORCHÉ (Biosphera croup dome, sculpted hamstring clefts & thigh contours)
    push(
      `equ.mus.cad.001-${tag}`, // Glúteo superficial
      createBiospheraMuscleMesh(
        [
          { pos: V3(-0.74, 1.33, 0.145 * sd), rx: 0.024, ry: 0.056 },
          { pos: V3(-0.74, 1.24, 0.188 * sd), rx: 0.03, ry: 0.066 },
          { pos: hl.hip.clone().add(V3(-0.04, -0.04, 0.04 * sd)), rx: 0.022, ry: 0.046 },
        ],
        msuMat(),
        { originTendonFrac: 0.18, insertionTendonFrac: 0.22, radialSegs: 14, grooveAO: 0.26 },
      ),
      side,
    );
    push(
      `equ.mus.cad.002-${tag}`, // Glúteo medio (voluminous rounded equine croup dome)
      createSculptedMuscleSheetMesh(
        [
          { x: -0.96, yTop: 1.34, yBot: 1.18, zMid: 0.09, zBow: 0.064 },
          { x: -0.82, yTop: 1.39, yBot: 1.15, zMid: 0.115, zBow: 0.094 },
          { x: -0.66, yTop: 1.38, yBot: 1.16, zMid: 0.115, zBow: 0.088 },
          { x: -0.54, yTop: 1.35, yBot: 1.21, zMid: 0.09, zBow: 0.052 },
        ],
        sd,
        msuMat(),
        { verticalSegs: 12, longSubdivs: 3, aponeuroticEdgeFade: true, dorsalAponeurosis: 0.22, ventralAponeurosis: 0.12, thickness: 0.032 },
      ),
      side,
    );
    push(
      `equ.mus.cad.003-${tag}`, // Glúteo profundo
      createBiospheraMuscleMesh(
        [
          { pos: V3(-0.78, 1.25, 0.11 * sd), rx: 0.022, ry: 0.038 },
          { pos: hl.hip.clone().add(V3(-0.01, 0.04, 0.01 * sd)), rx: 0.026, ry: 0.042 },
        ],
        mprMat(),
        { radialSegs: 12 },
      ),
      side,
    );
    push(
      `equ.mus.cad.004-${tag}`, // Tensor de la fascia lata
      createBiospheraMuscleMesh(
        [
          { pos: hl.tuberCoxae, rx: 0.02, ry: 0.052 },
          { pos: hl.tuberCoxae.clone().lerp(hl.stifle, 0.44).add(V3(0.015, 0.02, 0.024 * sd)), rx: 0.026, ry: 0.064 },
          { pos: hl.stifle.clone().add(V3(0.01, 0.11, 0.03 * sd)), rx: 0.018, ry: 0.044 },
        ],
        msuMat(),
        { originTendonFrac: 0.1, insertionTendonFrac: 0.28, radialSegs: 14, grooveAO: 0.26 },
      ),
      side,
    );
    push(
      `equ.mus.fas.017-${tag}`, // Fascia lata (glistening silvery lateral thigh sheet)
      createSculptedMuscleSheetMesh(
        [
          { x: -0.78, yTop: 1.22, yBot: 0.90, zMid: 0.14, zBow: 0.065 },
          { x: -0.69, yTop: 1.20, yBot: 0.87, zMid: 0.15, zBow: 0.072 },
          { x: -0.60, yTop: 1.14, yBot: 0.88, zMid: 0.13, zBow: 0.05 },
        ],
        sd,
        fasMat(),
        { verticalSegs: 10, longSubdivs: 3, aponeuroticEdgeFade: false, thickness: 0.009 },
      ),
      side,
    );

    // Cuádriceps femoral (contoured cranial thigh bellies bowing around femur shaft)
    push(
      `equ.mus.fem.004-${tag}`,
      createBiospheraMuscleMesh(
        [
          { pos: hl.hip.clone().add(V3(0.04, 0.02, 0)), rx: 0.036, ry: 0.048 },
          { pos: hl.hip.clone().lerp(hl.stifle, 0.48).add(V3(0.062, 0, 0)), rx: 0.046, ry: 0.058 },
          { pos: hl.stifle.clone().add(V3(0.04, 0.03, 0)), rx: 0.032, ry: 0.04 },
        ],
        mprMat(),
        { originTendonFrac: 0.12, insertionTendonFrac: 0.18, radialSegs: 14 },
      ),
      side,
    );
    push(
      `equ.mus.fem.005-${tag}`,
      createBiospheraMuscleMesh(
        [
          { pos: hl.hip.clone().add(V3(-0.01, 0.02, 0.032 * sd)), rx: 0.034, ry: 0.062 },
          { pos: hl.hip.clone().lerp(hl.stifle, 0.48).add(V3(0.028, 0.01, 0.045 * sd)), rx: 0.042, ry: 0.072 },
          { pos: hl.stifle.clone().add(V3(0.03, 0.02, 0.026 * sd)), rx: 0.03, ry: 0.05 },
        ],
        mprMat(),
        { originTendonFrac: 0.12, insertionTendonFrac: 0.18, radialSegs: 14, grooveAO: 0.24 },
      ),
      side,
    );
    push(
      `equ.mus.fem.006-${tag}`,
      createBiospheraMuscleMesh(
        [
          { pos: hl.hip.clone().add(V3(0.01, -0.02, -0.022 * sd)), rx: 0.028, ry: 0.048 },
          { pos: hl.hip.clone().lerp(hl.stifle, 0.48).add(V3(0.03, 0, -0.024 * sd)), rx: 0.034, ry: 0.056 },
          { pos: hl.stifle.clone().add(V3(0.03, 0.02, -0.02 * sd)), rx: 0.024, ry: 0.042 },
        ],
        mprMat(),
        { originTendonFrac: 0.12, insertionTendonFrac: 0.18, radialSegs: 14 },
      ),
      side,
    );

    // Bíceps femoral, Semitendinoso, Semimembranoso, Aductor, Sartorio, Grácil
    push(
      `equ.mus.fem.012-${tag}`, // Bíceps femoral (wide sweeping lateral hamstring plate)
      createBiospheraMuscleMesh(
        [
          { pos: V3(-0.88, 1.25, 0.155 * sd), rx: 0.042, ry: 0.088 },
          { pos: V3(-0.85, 1.07, 0.186 * sd), rx: 0.052, ry: 0.108 },
          { pos: hl.stifle.clone().add(V3(-0.07, 0.02, 0.068 * sd)), rx: 0.046, ry: 0.092 },
          { pos: hl.stifle.clone().add(V3(-0.04, -0.06, 0.032 * sd)), rx: 0.03, ry: 0.06 },
        ],
        msuMat(),
        { originTendonFrac: 0.12, insertionTendonFrac: 0.2, radialSegs: 16, grooveAO: 0.3 },
      ),
      side,
    );
    push(
      `equ.mus.fem.013-${tag}`, // Semitendinoso (graceful curved caudal buttock line)
      createBiospheraMuscleMesh(
        [
          { pos: hl.tuberIschii.clone().add(V3(0.02, -0.01, 0.025 * sd)), rx: 0.036, ry: 0.064 },
          { pos: V3(-1.00, 1.04, 0.115 * sd), rx: 0.044, ry: 0.074 },
          { pos: V3(-0.92, 0.81, 0.098 * sd), rx: 0.036, ry: 0.06 },
          { pos: hl.hock.clone().add(V3(0.01, 0.24, 0.02 * sd)), rx: 0.022, ry: 0.036 },
        ],
        msuMat(),
        { originTendonFrac: 0.1, insertionTendonFrac: 0.24, radialSegs: 16, grooveAO: 0.3 },
      ),
      side,
    );
    push(
      `equ.mus.fem.002-${tag}`, // Aductor
      createBiospheraMuscleMesh(
        [
          { pos: hl.tuberIschii.clone().add(V3(0, 0.03, 0.01 * sd)), rx: 0.04, ry: 0.058 },
          { pos: V3(-0.82, 0.96, 0.08 * sd), rx: 0.046, ry: 0.068 },
          { pos: hl.hock.clone().add(V3(0.02, 0.18, -0.02 * sd)), rx: 0.028, ry: 0.042 },
        ],
        msuMat(),
        { originTendonFrac: 0.1, insertionTendonFrac: 0.22, radialSegs: 14, grooveAO: 0.26 },
      ),
      side,
    );
    push(
      `equ.mus.fem.003-${tag}`, // Semimembranoso
      createBiospheraMuscleMesh(
        [
          { pos: hl.tuberIschii.clone().add(V3(0.02, -0.02, -0.032 * sd)), rx: 0.042, ry: 0.068 },
          { pos: V3(-0.87, 1.03, 0.042 * sd), rx: 0.05, ry: 0.082 },
          { pos: hl.stifle.clone().add(V3(-0.03, -0.02, -0.03 * sd)), rx: 0.034, ry: 0.056 },
        ],
        msuMat(),
        { originTendonFrac: 0.1, insertionTendonFrac: 0.16, radialSegs: 14, grooveAO: 0.28 },
      ),
      side,
    );
    push(
      `equ.mus.fem.008-${tag}`, // Sartorio
      createBiospheraMuscleMesh(
        [
          { pos: V3(-0.70, 1.22, 0.04 * sd), rx: 0.012, ry: 0.022 },
          { pos: V3(-0.70, 1.04, 0.048 * sd), rx: 0.014, ry: 0.026 },
          { pos: hl.stifle.clone().add(V3(0, -0.02, -0.045 * sd)), rx: 0.012, ry: 0.02 },
        ],
        msuMat(),
        { radialSegs: 10 },
      ),
      side,
    );
    push(
      `equ.mus.fem.009-${tag}`, // Grácil
      createBiospheraMuscleMesh(
        [
          { pos: V3(-0.84, 1.07, 0.04 * sd), rx: 0.018, ry: 0.056 },
          { pos: V3(-0.81, 0.94, 0.052 * sd), rx: 0.02, ry: 0.062 },
          { pos: hl.stifle.clone().add(V3(-0.02, -0.07, -0.035 * sd)), rx: 0.015, ry: 0.044 },
        ],
        msuMat(),
        { radialSegs: 12, grooveAO: 0.24 },
      ),
      side,
    );

    // GASKIN / LEG ÉCORCHÉ (contoured gastrocnemius & digital extensors/flexors -> crisp Achilles tendon)
    const gastGrp = new THREE.Group();
    gastGrp.add(
      createBiospheraMuscleMesh(
        [
          { pos: hl.stifle.clone().add(V3(-0.04, -0.02, 0.01 * sd)), rx: 0.032, ry: 0.044 },
          { pos: hl.stifle.clone().lerp(hl.calcaneusTip, 0.34).add(V3(-0.02, 0.01, 0.012 * sd)), rx: 0.038, ry: 0.052 },
          { pos: hl.calcaneusTip.clone().add(V3(0.01, 0.12, 0)), rx: 0.016, ry: 0.022 },
        ],
        msuMat(),
        { originTendonFrac: 0.1, insertionTendonFrac: 0.28, radialSegs: 14, grooveAO: 0.26 },
      ),
    );
    gastGrp.add(createTubeCurveMesh([hl.calcaneusTip.clone().add(V3(0.01, 0.13, 0)), hl.calcaneusTip], 0.01, tenMat(), 10, 7));
    push(`equ.mus.pie.001-${tag}`, gastGrp, side);

    push(
      `equ.mus.pie.002-${tag}`,
      createBiospheraMuscleMesh(
        [
          { pos: hl.stifle.clone().add(V3(-0.04, -0.02, -0.012 * sd)), rx: 0.03, ry: 0.042 },
          { pos: hl.stifle.clone().lerp(hl.calcaneusTip, 0.34).add(V3(-0.02, 0.01, -0.014 * sd)), rx: 0.035, ry: 0.048 },
          { pos: hl.calcaneusTip.clone().add(V3(0.01, 0.10, 0)), rx: 0.015, ry: 0.02 },
        ],
        msuMat(),
        { originTendonFrac: 0.1, insertionTendonFrac: 0.28, radialSegs: 14 },
      ),
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

    const fdlHGrp = new THREE.Group();
    fdlHGrp.add(
      createBiospheraMuscleMesh(
        [
          { pos: hl.stifle.clone().add(V3(-0.02, -0.06, 0.015 * sd)), rx: 0.022, ry: 0.032 },
          { pos: hl.stifle.clone().lerp(hl.hock, 0.36).add(V3(-0.022, 0, 0.014 * sd)), rx: 0.026, ry: 0.038 },
          { pos: hl.hock.clone().add(V3(-0.015, 0.08, 0)), rx: 0.013, ry: 0.018 },
        ],
        mprMat(),
        { originTendonFrac: 0.1, insertionTendonFrac: 0.26, radialSegs: 12 },
      ),
    );
    fdlHGrp.add(createTubeCurveMesh([hl.hock.clone().add(V3(-0.018, 0.08, 0)), hl.hock.clone().add(V3(-0.02, 0, 0)), hl.fetlock.clone().add(V3(-0.02, 0, 0)), hl.hoofCenter.clone().add(V3(-0.008, 0.01, 0))], 0.007, tenMat(), 16, 7));
    push(`equ.mus.pie.005-${tag}`, fdlHGrp, side);

    push(
      `equ.mus.pie.008-${tag}`,
      createBiospheraMuscleMesh(
        [
          { pos: hl.stifle.clone().add(V3(0.01, -0.05, 0)), rx: 0.017, ry: 0.024 },
          { pos: hl.stifle.clone().lerp(hl.hock, 0.34).add(V3(0.016, 0, -0.004 * sd)), rx: 0.02, ry: 0.03 },
          { pos: hl.hock.clone().add(V3(0.018, 0.04, -0.01 * sd)), rx: 0.01, ry: 0.014 },
        ],
        mprMat(),
        { originTendonFrac: 0.08, insertionTendonFrac: 0.25, radialSegs: 12 },
      ),
      side,
    );
    push(
      `equ.mus.pie.009-${tag}`,
      createTubeCurveMesh([hl.stifle.clone().add(V3(0.015, 0.01, 0.012 * sd)), hl.stifle.clone().lerp(hl.hock, 0.5).add(V3(0.024, 0, 0.008 * sd)), hl.hock.clone().add(V3(0.022, -0.02, 0))], 0.008, tenMat(), 14, 7),
      side,
    );

    const edlHGrp = new THREE.Group();
    edlHGrp.add(
      createBiospheraMuscleMesh(
        [
          { pos: hl.stifle.clone().add(V3(0.022, -0.02, 0.015 * sd)), rx: 0.02, ry: 0.028 },
          { pos: hl.stifle.clone().lerp(hl.hock, 0.34).add(V3(0.028, 0, 0.012 * sd)), rx: 0.024, ry: 0.034 },
          { pos: hl.hock.clone().add(V3(0.02, 0.07, 0)), rx: 0.012, ry: 0.016 },
        ],
        msuMat(),
        { originTendonFrac: 0.1, insertionTendonFrac: 0.28, radialSegs: 12, grooveAO: 0.22 },
      ),
    );
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

    const edLatHGrp = new THREE.Group();
    edLatHGrp.add(
      createBiospheraMuscleMesh(
        [
          { pos: hl.stifle.clone().add(V3(-0.005, -0.06, 0.026 * sd)), rx: 0.014, ry: 0.02 },
          { pos: hl.stifle.clone().lerp(hl.hock, 0.36).add(V3(0.002, 0, 0.026 * sd)), rx: 0.017, ry: 0.024 },
          { pos: hl.hock.clone().add(V3(0.008, 0.06, 0.018 * sd)), rx: 0.009, ry: 0.014 },
        ],
        msuMat(),
        { originTendonFrac: 0.1, insertionTendonFrac: 0.24, radialSegs: 12 },
      ),
    );
    edLatHGrp.add(createTubeCurveMesh([hl.hock.clone().add(V3(0.008, 0.06, 0.018 * sd)), hl.hock.clone().lerp(hl.fetlock, 0.4).add(V3(0.016, 0, 0.01 * sd)), hl.fetlock.clone().add(V3(0.022, 0, 0))], 0.0045, tenMat(), 10, 6));
    push(`equ.mus.pie.011-${tag}`, edLatHGrp, side);

    // Tail dock musculature
    const c1 = V3(...caudalPos(1));
    const c6 = V3(...caudalPos(7));
    push(
      `equ.mus.col.001-${tag}`,
      createBiospheraMuscleMesh(
        [
          { pos: c1.clone().add(V3(0.05, 0.025, 0.018 * sd)), rx: 0.016, ry: 0.022 },
          { pos: c6.clone().add(V3(0, 0.015, 0.012 * sd)), rx: 0.009, ry: 0.012 },
        ],
        mprMat(),
        { radialSegs: 10 },
      ),
      side,
    );
    push(
      `equ.mus.col.003-${tag}`,
      createBiospheraMuscleMesh(
        [
          { pos: c1.clone().add(V3(0.05, -0.02, 0.018 * sd)), rx: 0.014, ry: 0.02 },
          { pos: c6.clone().add(V3(0, -0.015, 0.012 * sd)), rx: 0.008, ry: 0.011 },
        ],
        mprMat(),
        { radialSegs: 10 },
      ),
      side,
    );

    // Deep Psoas mayor
    push(
      `equ.mus.sub.001-${tag}`,
      createBiospheraMuscleMesh(
        [
          { pos: V3(-0.36, 1.28, 0.05 * sd), rx: 0.022, ry: 0.032 },
          { pos: V3(-0.58, 1.24, 0.048 * sd), rx: 0.026, ry: 0.036 },
          { pos: hl.hip.clone().add(V3(0.05, 0.04, -0.02 * sd)), rx: 0.018, ry: 0.026 },
        ],
        mprMat(),
        { radialSegs: 12 },
      ),
      side,
    );
  }

  // Línea alba (equ.mus.abd.008)
  push('equ.mus.abd.008', createTubeCurveMesh([V3(0.10, 0.80, 0), V3(-0.22, 0.74, 0), V3(-0.68, 0.94, 0)], 0.01, fasMat(), 16, 6), 'center');

  // Diafragma (equ.mus.tor.009)
  push('equ.mus.tor.009', createOrganMesh(V3(-0.08, 1.05, 0), [0.09, 0.24, 0.22], mprMat(), [0, 0, -0.45], 18), 'center');

  return parts;
}
