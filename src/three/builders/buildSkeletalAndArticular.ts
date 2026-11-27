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
  createCurvedLigamentSheetMesh,
  createEquineVertebraMesh,
  createFlatRibMesh,
  createLongBoneMesh,
  createMultiStationLoftTube,
  createOrganMesh,
  createTubeCurveMesh,
} from './geomHelpers';
import { buildSculptedEquineSkullParts } from './sculptEquineSkull';
import { buildSculptedCervicalVertebraeParts } from './sculptEquineCervical';
import { buildSculptedForelimbParts } from './sculptEquineForelimb';
import { buildSculptedHindlimbParts } from './sculptEquineHindlimb';
import { buildSculptedPelvisParts } from './sculptEquinePelvis';

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
  const sculptedBoneMat = () => createTissueMaterial('bone_sculpted', tex);
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

  // --- 1. CRANIUM & MANDIBLE (equ.ske.cra.001..019, individually selectable) ---
  buildSculptedEquineSkullParts({ boneMat, darkBoneMat, sculptedBoneMat, teethMat, push });

  // Aparato hioideo bilateral (equ.ske.hyo.003..006): estilohioides, epihioides, ceratohioides y cartílago timpanohioideo
  for (const sd of [-1, 1] as const) {
    const tag = sd === -1 ? 'i' : 'd';
    const side = sd === -1 ? 'left' : 'right';

    push(
      `equ.ske.hyo.006-${tag}`, // Cartílago timpanohioideo
      createOrganMesh(V3(1.045, 1.625, 0.038 * sd), [0.007, 0.010, 0.005], cartMat()),
      side,
    );
    push(
      `equ.ske.hyo.005-${tag}`, // Epihioides
      createLongBoneMesh(V3(1.05, 1.615, 0.036 * sd), V3(1.07, 1.59, 0.032 * sd), 0.005, 0.007, darkBoneMat()),
      side,
    );
    push(
      `equ.ske.hyo.004-${tag}`, // Estilohioides
      createLongBoneMesh(V3(1.07, 1.59, 0.032 * sd), V3(1.13, 1.540, 0.024 * sd), 0.007, 0.0085, darkBoneMat()),
      side,
    );
    push(
      `equ.ske.hyo.003-${tag}`, // Ceratohioides
      createLongBoneMesh(V3(1.13, 1.540, 0.024 * sd), V3(1.155, 1.518, 0.014 * sd), 0.005, 0.007, darkBoneMat()),
      side,
    );
  }

  // Basihioides (hyo.001) y procesos tirohioideos bilaterales (hyo.002), en la línea media
  push(
    'equ.ske.hyo.001',
    createLongBoneMesh(V3(1.16, 1.515, -0.016), V3(1.16, 1.515, 0.016), 0.007, 0.0065, darkBoneMat(), 0.9),
    'center',
  );
  push(
    'equ.ske.hyo.002',
    buildBilateralArticular((sd) =>
      createLongBoneMesh(V3(1.158, 1.518, 0.014 * sd), V3(1.12, 1.502, 0.020 * sd), 0.0055, 0.0075, darkBoneMat()),
    ),
    'center',
  );

  // --- 2. VERTEBRAL COLUMN (C1-C7 sculpted, T1-T18, L1-L6, S1-S5, Caudal) ---
  buildSculptedCervicalVertebraeParts({ darkBoneMat, sculptedBoneMat, push });

  for (let t = 1; t <= 18; t++) {
    const [x, y] = thoracicPos(t);
    const [nx, ny] = thoracicPos(Math.max(1, t - 1));
    const [px, py] = thoracicPos(Math.min(18, t + 1));
    const id = `equ.ske.tor.${String(t).padStart(3, '0')}`;
    const witherFactor = Math.exp(-Math.pow((t - 5.2) / 4.0, 2));
    const spineH = 0.060 + 0.140 * witherFactor;
    const tiltX = t <= 14 ? -0.038 : 0.01; // anticlinal around T15-T16
    const vMesh = createEquineVertebraMesh(
      {
        pos: V3(x, y, 0),
        forwardDir: V3(nx - px, ny - py, 0),
        bodyLength: 0.046,
        bodyRadius: 0.023,
        spineHeight: spineH,
        spineTiltX: tiltX,
        spineThick: 0.011,
        transverseSpan: 0.042,
        transverseWidth: 0.016,
      },
      boneMat(),
      darkBoneMat(),
    );
    push(id, vMesh, 'center', V3(x, y + spineH * 0.35, 0));
  }

  // Lumbar (L1-L6), Sacrum (S1-S5), Os Coxae (mpe.001-i/d), and Caudal (Cd1-Cd21) sculpted below
  buildSculptedPelvisParts({ sculptedBoneMat, push });

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
      g.add(createLongBoneMesh(V3(0.47, 0.878, 0), V3(-0.08, 0.848, 0), 0.028, 0.038, boneMat(), 0.6));
      g.add(createOrganMesh(V3(0.48, 0.896, 0), [0.030, 0.032, 0.018], cartMat(), undefined, 10)); // Manubrium / cariniform cartilage
      return g;
    })(),
    'center',
  );

  // --- 4. FORELIMBS (equ.ske.mto.001..020-i/d sculpted) & HINDLIMBS (equ.ske.mpe.002..020-i/d sculpted) ---
  buildSculptedForelimbParts({ boneMat, darkBoneMat, sculptedBoneMat, cartMat, push });
  buildSculptedHindlimbParts({ sculptedBoneMat, push });

  // --- 5. ARTICULAR & LIGAMENTOUS STRUCTURES (layer = "art", sistema_articular.json) ---
  // Funículo nucal (equ.ske.lax.001 — paired dorsal cord from external occipital protuberance to T3–T5 withers cap)
  const funiculoGrp = new THREE.Group();
  for (const sd of [-1, 1] as const) {
    funiculoGrp.add(
      createTubeCurveMesh(
        [
          HEAD.poll.clone().add(V3(-0.01, -0.014, 0.007 * sd)),
          V3(0.86, 1.712, 0.008 * sd),
          V3(0.68, 1.590, 0.008 * sd),
          V3(0.50, 1.495, 0.009 * sd),
          V3(0.32, 1.505, 0.010 * sd),
        ],
        0.011,
        ligMat(),
        24,
        8,
      ),
    );
  }
  push('equ.ske.lax.001', funiculoGrp, 'center');

  // Lámina nucal (equ.ske.lax.002 — broad bilateral elastic laminar fan from funicular cord/T2-T3 to C2-C6 spinous crests)
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
      g.add(createCurvedLigamentSheetMesh(topRail, botRail, sd, ligMat(), 0.004, 0.0025, 16, 8));
      // Caudal fibrous digitations toward T1–T3 cranial border
      for (const c of [3, 4, 5, 6]) {
        const [cx, cy] = cervicalPos(c);
        g.add(createTubeCurveMesh([V3(cx, cy + 0.025, 0.010 * sd), V3(0.39, 1.490, 0.010 * sd)], 0.005, ligMat(), 8, 6));
      }
      return g;
    }),
    'center',
  );
  // Ligamento supraespinoso (equ.ske.lax.003) along spinous tips from T3 to S3
  const supraPts: THREE.Vector3[] = [];
  for (let t = 3; t <= 18; t += 3) {
    const [tx, ty] = thoracicPos(t);
    const witherFactor = Math.exp(-Math.pow((t - 5.2) / 4.0, 2));
    supraPts.push(V3(tx - 0.025, ty + 0.068 + 0.135 * witherFactor, 0));
  }
  for (let l = 2; l <= 6; l += 2) {
    const [lx, ly] = lumbarPos(l);
    supraPts.push(V3(lx, ly + 0.082, 0));
  }
  push('equ.ske.lax.003', createTubeCurveMesh(supraPts, 0.009, ligMat(), 28, 8), 'center');

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

  // Articulación sacroilíaca (equ.ske.aax.010), Lig. sacroilíaco dorsal (lax.009) & ventral (lax.010),
  // Lig. sacrotuberal ancho (lax.011), y Sínfisis pelviana (aax.011)
  push(
    'equ.ske.aax.010',
    buildBilateralArticular((sd) =>
      createOrganMesh(V3(-0.772, 1.352, 0.056 * sd), [0.028, 0.016, 0.014], cartMat(), [0.28 * sd, 0, -0.25], 10),
    ),
    'center',
  );
  push(
    'equ.ske.lax.009',
    buildBilateralArticular((sd) => {
      const hl = hindlimbLandmarks(sd);
      const g = new THREE.Group();
      const [s1x, s1y] = sacralPos(1);
      const [s3x, s3y] = sacralPos(3);
      const [s5x, s5y] = sacralPos(5);
      // Funicular (short) dorsal sacroiliac ligament: tuber sacrale -> sacral spinous summits
      g.add(
        createTubeCurveMesh(
          [
            hl.tuberSacrale.clone().add(V3(0.01, 0.004, -0.004 * sd)),
            V3(s1x - 0.012, s1y + 0.058, 0.016 * sd),
            V3(s3x - 0.015, s3y + 0.048, 0.014 * sd),
            V3(s5x - 0.015, s5y + 0.038, 0.012 * sd),
          ],
          0.0085,
          ligMat(),
          14,
          8,
        ),
      );
      // Membranous (long) dorsal sacroiliac sheet: caudal ilium crest -> lateral sacral crest
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
        createTubeCurveMesh(
          [V3(s1x + 0.006, s1y - 0.014, 0.052 * sd), V3(s1x + 0.01, s1y - 0.022, 0.088 * sd)],
          0.0075,
          ligMat(),
          8,
          7,
        ),
      );
      g.add(
        createTubeCurveMesh(
          [V3(s2x, s2y - 0.012, 0.044 * sd), V3(s2x - 0.006, s2y - 0.024, 0.078 * sd)],
          0.007,
          ligMat(),
          8,
          7,
        ),
      );
      return g;
    }),
    'center',
  );
  push(
    'equ.ske.lax.011', // Ligamento sacrotuberal ancho (curved broad fibrous sheet)
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
          V3(-0.868, 1.186, 0.112 * sd), // spina ischiadica
          V3(-0.935, 1.16, 0.108 * sd),  // lesser ischiatic arch
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
    'equ.ske.aax.011', // Sínfisis pelviana (fibrocartilage midline union of pubis & ischium)
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

  // Atlantooccipital & Atlantoaxial joints
  push('equ.ske.aax.002', createOrganMesh(V3(1.01, 1.74, 0), [0.024, 0.026, 0.046], cartMat(), undefined, 10), 'center');
  push('equ.ske.aax.003', createOrganMesh(V3(0.95, 1.69, 0), [0.024, 0.024, 0.034], cartMat(), undefined, 10), 'center');

  // TMJ (equ.ske.aax.001-i/d), Shoulder (amt.001-i/d), Elbow (amt.002-i/d)
  push('equ.ske.aax.001-i', createOrganMesh(V3(1.09, 1.65, -0.062), [0.020, 0.016, 0.015], cartMat(), undefined, 10), 'left');
  push('equ.ske.aax.001-d', createOrganMesh(V3(1.09, 1.65, 0.062), [0.020, 0.016, 0.015], cartMat(), undefined, 10), 'right');

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

  // Hindlimb hip (Articulación coxofemoral + Lig. cabeza del fémur + Lig. accesorio del fémur), stifle & distal joints
  push(
    'equ.ske.amp.001', // Articulación coxofemoral (capsule cuff hugging acetabular rim & femoral neck)
    buildBilateralArticular((sd) => {
      const hl = hindlimbLandmarks(sd);
      return createMultiStationLoftTube(
        [
          { pos: hl.acetabulum.clone().add(V3(0.001, 0.002, -0.008 * sd)), rx: 0.028, ry: 0.028 },
          { pos: hl.acetabulum.clone().add(V3(-0.001, 0, 0.01 * sd)), rx: 0.029, ry: 0.029 },
          { pos: hl.acetabulum.clone().lerp(hl.hip, 0.82), rx: 0.022, ry: 0.023 },
        ],
        cartMat(),
        14,
      );
    }),
    'center',
  );
  push(
    'equ.ske.lmp.001-i', // Ligamento de la cabeza del fémur (intracapsular)
    buildBilateralArticular((sd) => {
      const hl = hindlimbLandmarks(sd);
      return createTubeCurveMesh(
        [
          hl.acetabulum.clone().add(V3(0, -0.005, -0.012 * sd)),
          hl.acetabulum.clone().add(V3(0, 0.001, 0.005 * sd)),
        ],
        0.006,
        ligMat(),
        8,
        6,
      );
    }),
    'center',
  );
  push(
    'equ.ske.lmp.002-i', // Ligamento accesorio del fémur (prepubic -> acetabular notch -> fovea capitis)
    buildBilateralArticular((sd) => {
      const hl = hindlimbLandmarks(sd);
      return createTubeCurveMesh(
        [
          V3(-0.79, 1.072, 0.016 * sd),
          V3(-0.805, 1.096, 0.072 * sd),
          hl.acetabulum.clone().add(V3(0.005, -0.022, -0.008 * sd)),
          hl.acetabulum.clone().add(V3(0, -0.002, 0.004 * sd)),
        ],
        0.0055,
        ligMat(),
        14,
        7,
      );
    }),
    'center',
  );
  push(
    'equ.ske.amp.002', // Articulación femoropatelar
    buildBilateralArticular((sd) => createOrganMesh(hindlimbLandmarks(sd).stifle.clone().add(V3(0.024, 0.012, -0.004 * sd)), [0.030, 0.032, 0.028], cartMat(), undefined, 10)),
    'center',
  );
  push(
    'equ.ske.amp.003-i', // Femorotibial
    buildBilateralArticular((sd) => createOrganMesh(hindlimbLandmarks(sd).stifle, [0.042, 0.036, 0.036], cartMat(), undefined, 12)),
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
      return createTubeCurveMesh([hl.stifle.clone().add(V3(0.026, 0.01, -0.012 * sd)), hl.stifle.clone().add(V3(0.016, -0.056, -0.014 * sd))], 0.006, ligMat(), 8, 7);
    }),
    'center',
  );
  push(
    'equ.ske.lmp.004-i', // Intermediate patellar ligament
    buildBilateralArticular((sd) => {
      const hl = hindlimbLandmarks(sd);
      return createTubeCurveMesh([hl.stifle.clone().add(V3(0.030, 0.008, -0.004 * sd)), hl.stifle.clone().add(V3(0.018, -0.058, -0.004 * sd))], 0.007, ligMat(), 8, 7);
    }),
    'center',
  );
  push(
    'equ.ske.lmp.005-i', // Lateral patellar ligament
    buildBilateralArticular((sd) => {
      const hl = hindlimbLandmarks(sd);
      return createTubeCurveMesh([hl.stifle.clone().add(V3(0.026, 0.01, 0.008 * sd)), hl.stifle.clone().add(V3(0.016, -0.058, 0.010 * sd))], 0.006, ligMat(), 8, 7);
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
