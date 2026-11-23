import * as THREE from 'three';
import { forelimbLandmarks, HEAD, hindlimbLandmarks, V3 } from '../anatomyCoords';
import { createTissueMaterial } from '../materials';
import { ProceduralTextureSet } from '../textures';
import { BuiltPart } from './buildSkeletalAndArticular';
import {
  createHoofMesh,
  createMuscleBellyMesh,
  createOrganMesh,
  createTubeCurveMesh,
} from './geomHelpers';

function buildHalfEquineCoat(sd: -1 | 1, mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const side = sd === -1 ? 'left' : 'right';
  g.userData.side = side;

  // Sculpted half-barrel / thorax / abdomen envelope using Lathe-style ellipsoid sections
  // Thorax + Barrel
  const barrel = createOrganMesh(V3(-0.08, 1.07, 0.08 * sd), [0.68, 0.34, 0.21], mat, [0, 0, -0.04], 20);
  barrel.userData.side = side;
  g.add(barrel);

  // Chest / Breast
  const chest = createOrganMesh(V3(0.47, 1.12, 0.07 * sd), [0.22, 0.25, 0.16], mat, [0, 0, -0.18], 16);
  chest.userData.side = side;
  g.add(chest);

  // Croup / Hindquarters
  const croup = createOrganMesh(V3(-0.74, 1.16, 0.075 * sd), [0.34, 0.27, 0.18], mat, [0, 0, 0.14], 18);
  croup.userData.side = side;
  g.add(croup);

  // Neck crest & throat envelope
  const neck = createMuscleBellyMesh(V3(0.55, 1.24, 0.04 * sd), V3(1.03, 1.70, 0.03 * sd), 0.14, 0.62, mat, 0.35);
  neck.userData.side = side;
  g.add(neck);

  // Head / Muzzle profile
  const head = createMuscleBellyMesh(V3(1.05, 1.72, 0.025 * sd), V3(1.53, 1.38, 0.015 * sd), 0.088, 0.68, mat, 0.28);
  head.userData.side = side;
  g.add(head);

  // Ear
  const ear = createMuscleBellyMesh(V3(1.05, 1.80, 0.048 * sd), V3(1.03, 1.94, 0.062 * sd), 0.024, 0.7, mat, 0.32);
  ear.userData.side = side;
  g.add(ear);

  // Forelimb soft coat sleeve down to fetlock
  const fl = forelimbLandmarks(sd);
  const fUpper = createMuscleBellyMesh(fl.shoulder, fl.elbow, 0.095, 0.75, mat, 0.38);
  const fMid = createMuscleBellyMesh(fl.elbow, fl.carpus, 0.065, 0.85, mat, 0.28);
  const fCan = createMuscleBellyMesh(fl.carpus, fl.fetlock, 0.034, 0.9, mat, 0.45);
  const fPas = createMuscleBellyMesh(fl.fetlock, fl.hoofCenter.clone().add(V3(0, 0.05, 0)), 0.032, 0.9, mat, 0.5);
  [fUpper, fMid, fCan, fPas].forEach((m) => {
    m.userData.side = side;
    g.add(m);
  });

  // Hindlimb soft coat sleeve down to fetlock
  const hl = hindlimbLandmarks(sd);
  const hUpper = createMuscleBellyMesh(hl.hip, hl.stifle, 0.13, 0.72, mat, 0.35);
  const hGask = createMuscleBellyMesh(hl.stifle, hl.hock, 0.08, 0.8, mat, 0.26);
  const hCan = createMuscleBellyMesh(hl.hock, hl.fetlock, 0.035, 0.9, mat, 0.45);
  const hPas = createMuscleBellyMesh(hl.fetlock, hl.hoofCenter.clone().add(V3(0, 0.05, 0)), 0.033, 0.9, mat, 0.5);
  [hUpper, hGask, hCan, hPas].forEach((m) => {
    m.userData.side = side;
    g.add(m);
  });

  return g;
}

export function buildMuscularAndTegumentaryParts(tex: ProceduralTextureSet): BuiltPart[] {
  const parts: BuiltPart[] = [];
  const msuMat = () => createTissueMaterial('muscle_sup', tex);
  const mprMat = () => createTissueMaterial('muscle_deep', tex);
  const fasMat = () => createTissueMaterial('fascia', tex);
  const tenMat = () => createTissueMaterial('tendon', tex);
  const skinMat = () => createTissueMaterial('skin', tex);
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
  // Piel (equ.teg.pie.001) split internally into left/right halves for sagittal cutaway
  const coatGroup = new THREE.Group();
  coatGroup.add(buildHalfEquineCoat(-1, skinMat()));
  coatGroup.add(buildHalfEquineCoat(1, skinMat()));
  push('equ.teg.pie.001', coatGroup, 'center', V3(0.05, 1.1, 0));

  // Crin (equ.teg.pel.011) along dorsal neck crest + forelock
  const maneGroup = new THREE.Group();
  for (let i = 0; i < 11; i++) {
    const t = i / 10;
    const x = THREE.MathUtils.lerp(1.04, 0.44, t);
    const y = THREE.MathUtils.lerp(1.83, 1.48, t);
    const lock = createMuscleBellyMesh(
      V3(x, y, -0.02),
      V3(x - 0.04, y - 0.14 - 0.05 * Math.sin(t * Math.PI), -0.075),
      0.028,
      0.45,
      maneMat(),
      0.35,
    );
    lock.userData.side = 'left';
    maneGroup.add(lock);
  }
  // Forelock
  maneGroup.add(
    createMuscleBellyMesh(V3(1.12, 1.80, 0), V3(1.22, 1.66, -0.02), 0.025, 0.5, maneMat(), 0.3),
  );
  push('equ.teg.pel.011', maneGroup, 'left', V3(0.76, 1.64, -0.04));

  // Cola / Crin de la cola (equ.teg.pel.012)
  const tailGroup = new THREE.Group();
  for (let s = -1; s <= 1; s++) {
    tailGroup.add(
      createTubeCurveMesh(
        [
          V3(-1.02, 1.28, s * 0.015),
          V3(-1.20, 1.20, s * 0.025),
          V3(-1.30, 0.90, s * 0.03),
          V3(-1.33, 0.48, s * 0.025),
        ],
        0.028 - Math.abs(s) * 0.006,
        maneMat(),
        18,
        8,
      ),
    );
  }
  push('equ.teg.pel.012', tailGroup, 'center', V3(-1.24, 0.95, 0));

  // 4 Keratin Hooves grounded flush at Y = 0
  for (const sd of [-1, 1] as const) {
    const tag = sd === -1 ? 'i' : 'd';
    const side = sd === -1 ? 'left' : 'right';
    const fl = forelimbLandmarks(sd);
    const hl = hindlimbLandmarks(sd);
    push(`equ.teg.cmt.001-${tag}`, createHoofMesh(fl.hoofCenter.x, fl.hoofCenter.z, hoofMat()), side);
    push(`equ.teg.cmp.001-${tag}`, createHoofMesh(hl.hoofCenter.x, hl.hoofCenter.z, hoofMat()), side);
  }

  // --- 2. MUSCULAR SYSTEM: SUPERFICIAL (msu), DEEP (mpr) & FASCIA (fas) ---
  // Masetero (bilateral: equ.mus.cab.018)
  const masseterGroup = new THREE.Group();
  for (const sd of [-1, 1] as const) {
    const m = createOrganMesh(
      V3(1.13, 1.56, 0.072 * sd),
      [0.068, 0.056, 0.024],
      msuMat(),
      [0, 0, -0.35],
      14,
    );
    m.userData.side = sd === -1 ? 'left' : 'right';
    masseterGroup.add(m);
  }
  push('equ.mus.cab.018', masseterGroup, 'center', V3(1.13, 1.56, 0));

  // Bilateral superficial & deep muscles mapped to exact ProClaVet IDs
  for (const sd of [-1, 1] as const) {
    const tag = sd === -1 ? 'i' : 'd';
    const side = sd === -1 ? 'left' : 'right';
    const fl = forelimbLandmarks(sd);
    const hl = hindlimbLandmarks(sd);

    // Braquiocefálico (equ.mus.cue.002-i/d)
    push(
      `equ.mus.cue.002-${tag}`,
      createMuscleBellyMesh(V3(0.98, 1.66, 0.058 * sd), fl.shoulder.clone().add(V3(0.03, 0.02, 0.01 * sd)), 0.058, 0.48, msuMat(), 0.45),
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
      createMuscleBellyMesh(V3(0.96, 1.74, 0.045 * sd), V3(0.45, 1.44, 0.055 * sd), 0.065, 0.4, msuMat(), 0.45),
      side,
    );
    // Trapecio cervical (equ.mus.ext.001-i/d) & torácico (equ.mus.ext.002-i/d)
    push(
      `equ.mus.ext.001-${tag}`,
      createMuscleBellyMesh(V3(0.84, 1.66, 0.04 * sd), V3(0.38, 1.38, 0.11 * sd), 0.068, 0.3, msuMat(), 0.55),
      side,
    );
    push(
      `equ.mus.ext.002-${tag}`,
      createMuscleBellyMesh(V3(0.32, 1.46, 0.04 * sd), V3(0.18, 1.26, 0.14 * sd), 0.062, 0.3, msuMat(), 0.45),
      side,
    );
    // Dorsal ancho / Latissimus dorsi (equ.mus.ext.005-i/d)
    push(
      `equ.mus.ext.005-${tag}`,
      createOrganMesh(V3(-0.02, 1.24, 0.22 * sd), [0.34, 0.14, 0.028], msuMat(), [0, 0, -0.18], 16),
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
    // Deltoides (equ.mus.hom.003-i/d) & Supraespinoso (equ.mus.hom.001-i/d)
    push(
      `equ.mus.hom.003-${tag}`,
      createMuscleBellyMesh(V3(0.36, 1.34, 0.165 * sd), fl.shoulder.clone().add(V3(-0.04, -0.08, 0.025 * sd)), 0.052, 0.45, msuMat()),
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
      createMuscleBellyMesh(V3(0.30, 1.24, 0.16 * sd), fl.elbow.clone().add(V3(-0.02, 0.05, 0.01 * sd)), 0.078, 0.55, msuMat(), 0.42),
      side,
    );
    push(
      `equ.mus.bra.008-${tag}`,
      createMuscleBellyMesh(fl.shoulder.clone().add(V3(-0.03, -0.03, 0.02 * sd)), fl.elbow.clone().add(V3(-0.01, 0.04, 0.02 * sd)), 0.048, 0.55, msuMat()),
      side,
    );
    // Extensor radial del carpo + tendón flexor digital profundo
    const extGrp = new THREE.Group();
    extGrp.add(createMuscleBellyMesh(fl.elbow.clone().add(V3(0.02, 0.02, 0.01 * sd)), fl.carpus.clone().add(V3(0.01, 0.08, 0)), 0.038, 0.65, msuMat(), 0.3));
    extGrp.add(createTubeCurveMesh([fl.carpus.clone().add(V3(-0.015, 0.08, 0)), fl.fetlock.clone().add(V3(-0.015, 0, 0)), fl.hoofCenter.clone().add(V3(-0.02, 0.02, 0))], 0.008, tenMat(), 14, 6));
    push(`equ.mus.ant.001-${tag}`, extGrp, side);

    // Oblicuo externo del abdomen (equ.mus.abd.001-i/d)
    push(
      `equ.mus.abd.001-${tag}`,
      createOrganMesh(V3(-0.34, 1.03, 0.23 * sd), [0.36, 0.19, 0.024], msuMat(), [0, 0, 0.08], 18),
      side,
    );

    // Glúteo superficial (001) y Glúteo medio (002)
    push(
      `equ.mus.cad.001-${tag}`,
      createMuscleBellyMesh(V3(-0.74, 1.32, 0.16 * sd), hl.hip.clone().add(V3(-0.04, -0.04, 0.04 * sd)), 0.056, 0.42, msuMat()),
      side,
    );
    push(
      `equ.mus.cad.002-${tag}`,
      createOrganMesh(V3(-0.74, 1.27, 0.14 * sd), [0.22, 0.12, 0.075], msuMat(), [0, 0, -0.22], 16),
      side,
    );

    // Bíceps femoral (012) & Semitendinoso (002)
    push(
      `equ.mus.fem.012-${tag}`,
      createMuscleBellyMesh(V3(-0.88, 1.24, 0.17 * sd), hl.stifle.clone().add(V3(-0.04, -0.05, 0.03 * sd)), 0.086, 0.55, msuMat(), 0.38),
      side,
    );
    push(
      `equ.mus.fem.002-${tag}`,
      createMuscleBellyMesh(hl.tuberIschii.clone().add(V3(0, 0.03, 0.01 * sd)), hl.hock.clone().add(V3(0.02, 0.18, -0.02 * sd)), 0.062, 0.65, msuMat(), 0.35),
      side,
    );

    // Gastrocnemio + Tendón calcáneo común (equ.mus.pie.001-i/d)
    const gastGrp = new THREE.Group();
    gastGrp.add(createMuscleBellyMesh(hl.stifle.clone().add(V3(-0.04, -0.02, 0)), hl.hock.clone().add(V3(-0.05, 0.15, 0)), 0.048, 0.72, msuMat(), 0.32));
    gastGrp.add(createTubeCurveMesh([hl.hock.clone().add(V3(-0.05, 0.16, 0)), hl.hock.clone().add(V3(-0.06, 0.06, 0))], 0.01, tenMat(), 10, 6));
    push(`equ.mus.pie.001-${tag}`, gastGrp, side);

    // Deep muscle: Psoas mayor (equ.mus.sub.001-i/d)
    push(
      `equ.mus.sub.001-${tag}`,
      createMuscleBellyMesh(V3(-0.36, 1.28, 0.05 * sd), hl.hip.clone().add(V3(0.05, 0.04, -0.02 * sd)), 0.032, 0.7, mprMat()),
      side,
    );

    // Fascia toracolumbar / pélvica (equ.mus.fas.011-i/d)
    push(
      `equ.mus.fas.011-${tag}`,
      createOrganMesh(V3(-0.46, 1.32, 0.13 * sd), [0.28, 0.09, 0.015], fasMat(), [0, 0, -0.05], 14),
      side,
    );
  }

  // Diafragma (equ.mus.tor.009 — deep dome separating thorax & abdomen)
  const diaph = createOrganMesh(V3(-0.08, 1.05, 0), [0.09, 0.24, 0.22], mprMat(), [0, 0, -0.45], 18);
  push('equ.mus.tor.009', diaph, 'center');

  return parts;
}
