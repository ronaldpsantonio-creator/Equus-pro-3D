import * as THREE from 'three';
import {
  caudalPos,
  cervicalPos,
  forelimbLandmarks,
  HEAD,
  hindlimbLandmarks,
  lumbarPos,
  sacralPos,
  thoracicPos,
  V3,
} from '../anatomyCoords';
import { createTissueMaterial } from '../materials';
import { ProceduralTextureSet } from '../textures';
import { BuiltPart } from './buildSkeletalAndArticular';
import { createOrganMesh, createTubeCurveMesh } from './geomHelpers';

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

  // Cartílago tiroides (laringe)
  push(
    'equ.res.lar.002',
    createOrganMesh(V3(0.95, 1.57, 0), [0.045, 0.04, 0.038], tracMat(), [0, 0, -0.45], 14),
    'center',
  );

  // Tráquea porción cervical (equ.res.tra.001) y torácica (equ.res.tra.002) con anillos cartilaginosos
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

  // Bronquios y Pulmones izquierdo (-Z) y derecho (+Z)
  for (const sd of [-1, 1] as const) {
    const tag = sd === -1 ? 'i' : 'd';
    const side = sd === -1 ? 'left' : 'right';

    push(
      `equ.res.tra.007-${tag}`,
      createTubeCurveMesh([V3(0.20, 1.11, 0), V3(0.14, 1.09, 0.09 * sd)], 0.016, tracMat(), 8, 8),
      side,
    );

    const lungGrp = new THREE.Group();
    // Caudal main lobe + cranial cardiac lobe
    lungGrp.add(
      createOrganMesh(V3(0.11, 1.09, 0.115 * sd), [0.24, 0.15, 0.082], lungMat(), [0, 0, -0.15], 18),
    );
    lungGrp.add(
      createOrganMesh(V3(0.35, 1.06, 0.095 * sd), [0.11, 0.10, 0.062], lungMat(), [0, 0, -0.2], 14),
    );
    push(`equ.res.pul.001-${tag}`, lungGrp, side);

    // Cavidad nasal (equ.res.cav.001-i/d)
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

  // Corazón equino (equ.car.cor.001 — tilted ventrocaudally & slightly left -Z, between ribs 3–6)
  const heartGrp = new THREE.Group();
  heartGrp.add(createOrganMesh(V3(0.34, 0.99, -0.025), [0.095, 0.135, 0.088], heartMat(), [0.1, 0, 0.28], 20));
  heartGrp.add(createOrganMesh(V3(0.37, 1.09, -0.02), [0.065, 0.045, 0.06], heartMat(), undefined, 14));
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

  // Bilateral carotids, jugulars, subclavians & iliacs
  for (const sd of [-1, 1] as const) {
    const tag = sd === -1 ? 'i' : 'd';
    const side = sd === -1 ? 'left' : 'right';
    const fl = forelimbLandmarks(sd);
    const hl = hindlimbLandmarks(sd);

    push(
      `equ.car.acc.002-${tag}`, // Arteria carótida común
      createTubeCurveMesh([V3(0.45, 1.16, 0.015 * sd), V3(0.75, 1.40, 0.032 * sd), V3(1.02, 1.63, 0.036 * sd)], 0.0075, artMat(), 16, 7),
      side,
    );
    push(
      `equ.car.vcc.001-${tag}`, // Vena yugular externa (surco yugular superficial)
      createTubeCurveMesh([V3(1.02, 1.60, 0.048 * sd), V3(0.74, 1.37, 0.048 * sd), V3(0.53, 1.15, 0.028 * sd)], 0.009, veinMat(), 16, 7),
      side,
    );
    push(
      `equ.car.amt.001-${tag}`, // Arteria axilar / braquial
      createTubeCurveMesh([V3(0.42, 1.14, 0.03 * sd), fl.shoulder.clone().add(V3(-0.04, 0, -0.03 * sd)), fl.elbow.clone().add(V3(0, 0, -0.02 * sd))], 0.007, artMat(), 12, 7),
      side,
    );
    push(
      `equ.car.amp.001-${tag}`, // Arteria ilíaca externa / femoral
      createTubeCurveMesh([V3(-0.76, 1.25, 0.02 * sd), hl.hip.clone().add(V3(0.03, -0.02, -0.02 * sd)), hl.stifle.clone().add(V3(-0.04, 0, -0.02 * sd))], 0.008, artMat(), 14, 7),
      side,
    );
  }

  // Bazo (equ.car.lor.001 — left flank against stomach/ribs!)
  push(
    'equ.car.lor.001',
    createOrganMesh(V3(-0.32, 1.07, -0.19), [0.12, 0.19, 0.025], createTissueMaterial('liver', tex), [0.15, 0, 0.25], 16),
    'left',
  );

  // =========================================================================
  // 3. APARATO DIGESTIVO (dig) — Anatomía característica de fermentador cólico equino
  // =========================================================================
  const livMat = () => createTissueMaterial('liver', tex);
  const stoMat = () => createTissueMaterial('stomach', tex);
  const intMat = () => createTissueMaterial('intestine', tex);
  const cecMat = () => createTissueMaterial('cecum', tex);
  const colMat = () => createTissueMaterial('colon', tex);

  // Esófago cervical y torácico (dorsal-left of trachea!)
  push(
    'equ.dig.eso.001',
    createTubeCurveMesh([V3(0.95, 1.58, -0.015), V3(0.75, 1.40, -0.028), V3(0.55, 1.20, -0.022)], 0.013, stoMat(), 16, 8),
    'left',
  );
  push(
    'equ.dig.eso.002',
    createTubeCurveMesh([V3(0.55, 1.20, -0.022), V3(0.20, 1.18, -0.015), V3(-0.10, 1.12, -0.03)], 0.013, stoMat(), 16, 8),
    'left',
  );

  // Hígado (equ.dig.hig.001 — multi-lobed cranial abdomen, skewed slightly right +Z)
  const liverGrp = new THREE.Group();
  liverGrp.add(createOrganMesh(V3(-0.14, 1.03, 0.075), [0.11, 0.16, 0.09], livMat(), [0.1, 0, -0.25], 16));
  liverGrp.add(createOrganMesh(V3(-0.15, 1.00, -0.055), [0.09, 0.13, 0.075], livMat(), [-0.1, 0, -0.2], 14));
  push('equ.dig.hig.001', liverGrp, 'center', V3(-0.14, 1.02, 0.02));

  // Estómago (equ.dig.est.001 — small J-shaped equine stomach on left cranial abdomen -Z)
  push(
    'equ.dig.est.001',
    createOrganMesh(V3(-0.22, 1.08, -0.10), [0.11, 0.09, 0.075], stoMat(), [0.2, 0.2, 0.3], 18),
    'left',
  );

  // Ciego (equ.dig.cie.001 — huge comma-shaped vat on the RIGHT flank +Z!)
  push(
    'equ.dig.cie.001',
    createTubeCurveMesh(
      [
        V3(-0.68, 1.20, 0.14),
        V3(-0.52, 1.08, 0.16),
        V3(-0.34, 0.94, 0.14),
        V3(-0.16, 0.87, 0.08),
      ],
      0.075,
      cecMat(),
      20,
      14,
    ),
    'right',
  );

  // Colon mayor ascendente (equ.dig.col.001 — double horseshoe loops on ventral abdomen!)
  push(
    'equ.dig.col.001',
    createTubeCurveMesh(
      [
        V3(-0.46, 0.90, 0.09),
        V3(-0.15, 0.86, 0.10),
        V3(-0.08, 0.88, -0.08),
        V3(-0.48, 0.93, -0.12),
        V3(-0.62, 1.03, -0.10),
        V3(-0.22, 1.01, -0.08),
        V3(-0.16, 1.00, 0.07),
        V3(-0.55, 1.06, 0.07),
      ],
      0.052,
      colMat(),
      36,
      12,
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

  // Recto (equ.dig.rec.001)
  push(
    'equ.dig.rec.001',
    createTubeCurveMesh([V3(-0.72, 1.22, 0), V3(-0.98, 1.20, 0)], 0.028, colMat(), 10, 10),
    'center',
  );

  // =========================================================================
  // 4. SISTEMA NERVIOSO (ner)
  // =========================================================================
  const brainMat = () => createTissueMaterial('brain', tex);
  const nerveMat = () => createTissueMaterial('nerve', tex);

  // Encéfalo (equ.ner.enc.001) + Cerebelo (equ.ner.met.008)
  push('equ.ner.enc.001', createOrganMesh(V3(1.13, 1.72, 0), [0.062, 0.044, 0.048], brainMat(), [0, 0, -0.3], 18), 'center');
  push('equ.ner.met.008', createOrganMesh(V3(1.06, 1.72, 0), [0.028, 0.026, 0.032], brainMat(), undefined, 14), 'center');

  // Médula espinal (equ.ner.med.001 — inside vertebral canal from C1 to S5)
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

    // Plexo braquial + nervio radial/mediano (equ.ner.bra.001-i/d)
    push(
      `equ.ner.bra.001-${tag}`,
      createTubeCurveMesh([V3(0.56, 1.24, 0.02 * sd), fl.shoulder.clone().add(V3(-0.04, 0.04, -0.02 * sd)), fl.elbow, fl.carpus], 0.0055, nerveMat(), 20, 6),
      side,
    );
    // Nervio ciático (equ.ner.lum.010-i/d)
    push(
      `equ.ner.lum.010-${tag}`,
      createTubeCurveMesh([V3(-0.76, 1.30, 0.02 * sd), hl.hip.clone().add(V3(-0.04, 0.02, -0.02 * sd)), hl.stifle.clone().add(V3(-0.08, -0.04, 0)), hl.hock], 0.0065, nerveMat(), 22, 6),
      side,
    );
    // Nervio vago (equ.ner.cra.077-i/d)
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

  // Riñón izquierdo (equ.uri.rin.001-i, bean-shaped, caudal L1-L4)
  push('equ.uri.rin.001-i', createOrganMesh(V3(-0.52, 1.25, -0.08), [0.075, 0.042, 0.052], kidMat(), [0, 0.15, 0], 16), 'left');
  // Riñón derecho (equ.uri.rin.001-d, heart-shaped, slightly more cranial T16-L1)
  push('equ.uri.rin.001-d', createOrganMesh(V3(-0.40, 1.26, 0.085), [0.072, 0.045, 0.06], kidMat(), [0, -0.25, 0], 16), 'right');
  // Uréteres
  push('equ.uri.ure.001-i', createTubeCurveMesh([V3(-0.54, 1.23, -0.06), V3(-0.84, 1.17, -0.03), V3(-0.92, 1.13, -0.015)], 0.0045, bladMat(), 12, 6), 'left');
  push('equ.uri.ure.001-d', createTubeCurveMesh([V3(-0.42, 1.24, 0.065), V3(-0.84, 1.17, 0.03), V3(-0.92, 1.13, 0.015)], 0.0045, bladMat(), 12, 6), 'right');
  // Vejiga urinaria
  push('equ.uri.vej.001', createOrganMesh(V3(-0.90, 1.12, 0), [0.07, 0.055, 0.052], bladMat(), undefined, 16), 'center');

  // =========================================================================
  // 6. APARATO REPRODUCTOR (rep — con filtro automático m / f)
  // =========================================================================
  const repMat = () => createTissueMaterial('repro', tex);
  // Male (sex = 'm')
  push('equ.rep.tes.001-i', createOrganMesh(V3(-0.78, 0.85, -0.035), [0.042, 0.03, 0.026], repMat(), undefined, 14), 'left');
  push('equ.rep.tes.001-d', createOrganMesh(V3(-0.78, 0.85, 0.035), [0.042, 0.03, 0.026], repMat(), undefined, 14), 'right');
  push('equ.rep.pen.001', createTubeCurveMesh([V3(-0.96, 1.07, 0), V3(-0.80, 0.90, 0), V3(-0.58, 0.86, 0)], 0.022, repMat(), 14, 10), 'center');

  // Female (sex = 'f')
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

  push('equ.sen.ocu.001-i', createOrganMesh(HEAD.orbitCenter(-1), [0.024, 0.023, 0.022], eyeMat(), undefined, 16), 'left');
  push('equ.sen.ocu.001-d', createOrganMesh(HEAD.orbitCenter(1), [0.024, 0.023, 0.022], eyeMat(), undefined, 16), 'right');

  return parts;
}
