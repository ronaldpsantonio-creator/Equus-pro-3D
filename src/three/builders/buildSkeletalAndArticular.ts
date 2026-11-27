import * as THREE from 'three';
import { V3 } from '../anatomyCoords';
import { createTissueMaterial } from '../materials';
import { ProceduralTextureSet } from '../textures';
import { createMultiStationLoftTube, VariableTubeWaypoint } from './geomHelpers';
import { buildSculptedArticularParts } from './sculptEquineArticular';
import { buildSculptedEquineSkullParts } from './sculptEquineSkull';
import { buildSculptedCervicalVertebraeParts } from './sculptEquineCervical';
import { buildSculptedForelimbParts } from './sculptEquineForelimb';
import { buildSculptedHindlimbParts } from './sculptEquineHindlimb';
import { buildSculptedPelvisParts } from './sculptEquinePelvis';
import { buildSculptedRibcageParts } from './sculptEquineRibcage';

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

const BONE_BRIGHT = new THREE.Color(0xf3ead6);
const BONE_SHADE = new THREE.Color(0xb6a78f);

function buildSculptedLoftBone(
  waypoints: VariableTubeWaypoint[],
  mat: THREE.Material,
  radialSegs = 12,
  aoBase = 0.88,
): THREE.Mesh {
  const mesh = createMultiStationLoftTube(waypoints, mat, radialSegs);
  const geo = mesh.geometry;
  const pos = geo.getAttribute('position');
  const norm = geo.getAttribute('normal');
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const ny = norm ? norm.getY(i) : 0;
    const ao = THREE.MathUtils.clamp(aoBase + ny * 0.10, 0.45, 1.0);
    c.lerpColors(BONE_SHADE, BONE_BRIGHT, ao);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return mesh;
}

export function buildSkeletalAndArticularParts(tex: ProceduralTextureSet): BuiltPart[] {
  const parts: BuiltPart[] = [];
  const boneMat = () => createTissueMaterial('bone', tex);
  const darkBoneMat = () => createTissueMaterial('bone_dark', tex);
  const sculptedBoneMat = () => createTissueMaterial('bone_sculpted', tex);
  const teethMat = () => createTissueMaterial('teeth', tex);
  const cartMat = () => createTissueMaterial('cartilage', tex);
  const capsuleMat = () => createTissueMaterial('joint_capsule', tex);
  const ligMat = () => createTissueMaterial('ligament', tex);
  const ligElasticMat = () => createTissueMaterial('ligament_elastic', tex);
  const ligSculptedMat = () => createTissueMaterial('ligament_sculpted', tex);

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

  // Aparato hioideo bilateral (equ.ske.hyo.003..006): estilohioides con angulus, epihioides, ceratohioides y cartílago timpanohioideo
  for (const sd of [-1, 1] as const) {
    const tag = sd === -1 ? 'i' : 'd';
    const side = sd === -1 ? 'left' : 'right';

    push(
      `equ.ske.hyo.006-${tag}`, // Cartílago timpanohioideo
      createMultiStationLoftTube(
        [
          { pos: V3(1.042, 1.630, 0.039 * sd), rx: 0.0045, ry: 0.0055 },
          { pos: V3(1.048, 1.620, 0.037 * sd), rx: 0.005, ry: 0.006 },
        ],
        cartMat(),
        8,
      ),
      side,
    );
    push(
      `equ.ske.hyo.005-${tag}`, // Epihioides (slender intermediate osseous rod)
      buildSculptedLoftBone(
        [
          { pos: V3(1.048, 1.618, 0.0365 * sd), rx: 0.0048, ry: 0.0058 },
          { pos: V3(1.059, 1.604, 0.0345 * sd), rx: 0.0034, ry: 0.0042 },
          { pos: V3(1.070, 1.590, 0.032 * sd), rx: 0.0050, ry: 0.0062 },
        ],
        sculptedBoneMat(),
        10,
        0.84,
      ),
      side,
    );
    push(
      `equ.ske.hyo.004-${tag}`, // Estilohioides (compressed flat blade + caudal muscular angle)
      (() => {
        const g = new THREE.Group();
        g.add(
          buildSculptedLoftBone(
            [
              { pos: V3(1.070, 1.590, 0.032 * sd), rx: 0.0035, ry: 0.0115 },
              { pos: V3(1.092, 1.572, 0.029 * sd), rx: 0.0032, ry: 0.0095 },
              { pos: V3(1.114, 1.554, 0.026 * sd), rx: 0.0034, ry: 0.0085 },
              { pos: V3(1.132, 1.540, 0.024 * sd), rx: 0.0048, ry: 0.0072 },
            ],
            sculptedBoneMat(),
            12,
            0.88,
          ),
        );
        // Angulus stylohyoideus (caudal muscular wing)
        g.add(
          buildSculptedLoftBone(
            [
              { pos: V3(1.074, 1.588, 0.0315 * sd), rx: 0.003, ry: 0.008 },
              { pos: V3(1.056, 1.580, 0.0310 * sd), rx: 0.0025, ry: 0.0055 },
            ],
            sculptedBoneMat(),
            8,
            0.80,
          ),
        );
        return g;
      })(),
      side,
    );
    push(
      `equ.ske.hyo.003-${tag}`, // Ceratohioides
      buildSculptedLoftBone(
        [
          { pos: V3(1.132, 1.540, 0.024 * sd), rx: 0.0042, ry: 0.0060 },
          { pos: V3(1.144, 1.528, 0.019 * sd), rx: 0.0032, ry: 0.0045 },
          { pos: V3(1.156, 1.518, 0.014 * sd), rx: 0.0045, ry: 0.0058 },
        ],
        sculptedBoneMat(),
        10,
        0.85,
      ),
      side,
    );
  }

  // Basihioides (hyo.001 with rostral lingual process) y procesos tirohioideos bilaterales (hyo.002)
  push(
    'equ.ske.hyo.001',
    (() => {
      const g = new THREE.Group();
      // Transverse basihioid body
      g.add(
        buildSculptedLoftBone(
          [
            { pos: V3(1.158, 1.516, -0.016), rx: 0.0052, ry: 0.0055 },
            { pos: V3(1.162, 1.516, 0), rx: 0.0068, ry: 0.0072 },
            { pos: V3(1.158, 1.516, 0.016), rx: 0.0052, ry: 0.0055 },
          ],
          sculptedBoneMat(),
          10,
          0.90,
        ),
      );
      // Characteristic equine Processus lingualis projecting rostrally
      g.add(
        buildSculptedLoftBone(
          [
            { pos: V3(1.162, 1.516, 0), rx: 0.0050, ry: 0.0062 },
            { pos: V3(1.182, 1.514, 0), rx: 0.0034, ry: 0.0048 },
            { pos: V3(1.198, 1.511, 0), rx: 0.0020, ry: 0.0026 },
          ],
          sculptedBoneMat(),
          10,
          0.86,
        ),
      );
      return g;
    })(),
    'center',
  );
  push(
    'equ.ske.hyo.002',
    buildBilateralArticular((sd) =>
      buildSculptedLoftBone(
        [
          { pos: V3(1.158, 1.517, 0.014 * sd), rx: 0.0046, ry: 0.0056 },
          { pos: V3(1.138, 1.510, 0.017 * sd), rx: 0.0036, ry: 0.0046 },
          { pos: V3(1.116, 1.501, 0.020 * sd), rx: 0.0042, ry: 0.0050 },
        ],
        sculptedBoneMat(),
        10,
        0.84,
      ),
    ),
    'center',
  );

  // --- 2. VERTEBRAL COLUMN (C1-C7 sculpted, T1-T18, L1-L6, S1-S5, Caudal) ---
  buildSculptedCervicalVertebraeParts({ darkBoneMat, sculptedBoneMat, push });

  // Thoracic (T1-T18), Costal (R1-R18-i/d), Sternum (ste.001), Lumbar, Sacrum, Coxal, and Caudal sculpted below
  buildSculptedRibcageParts({ sculptedBoneMat, cartMat, push });
  buildSculptedPelvisParts({ sculptedBoneMat, push });

  // --- 4. FORELIMBS (equ.ske.mto.001..020-i/d sculpted) & HINDLIMBS (equ.ske.mpe.002..020-i/d sculpted) ---
  buildSculptedForelimbParts({ boneMat, darkBoneMat, sculptedBoneMat, cartMat, push });
  buildSculptedHindlimbParts({ sculptedBoneMat, push });

  // --- 5. ARTICULAR & LIGAMENTOUS STRUCTURES (layer = "art", sistema_articular.json) ---
  buildSculptedArticularParts({
    cartMat,
    capsuleMat,
    ligMat,
    ligElasticMat,
    ligSculptedMat,
    buildBilateralArticular,
    push,
  });

  return parts;
}
