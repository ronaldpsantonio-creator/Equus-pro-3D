import * as THREE from 'three';
import { ProceduralTextureSet } from './textures';

export type TissueKind =
  | 'skin'
  | 'skin_coat'
  | 'skin_points'
  | 'mane'
  | 'hoof'
  | 'fascia'
  | 'muscle_sup'
  | 'muscle_deep'
  | 'muscle_ecorche_sup'
  | 'muscle_ecorche_deep'
  | 'tendon'
  | 'bone'
  | 'bone_dark'
  | 'bone_sculpted'
  | 'teeth'
  | 'cartilage'
  | 'joint_capsule'
  | 'ligament'
  | 'ligament_elastic'
  | 'ligament_sculpted'
  | 'artery'
  | 'vein'
  | 'lymph'
  | 'heart'
  | 'nerve'
  | 'brain'
  | 'lung'
  | 'trachea'
  | 'salivary'
  | 'liver'
  | 'stomach'
  | 'intestine'
  | 'cecum'
  | 'colon'
  | 'kidney'
  | 'bladder'
  | 'repro'
  | 'endocrine'
  | 'eye'
  | 'cavity';

export function createTissueMaterial(
  kind: TissueKind,
  tex: ProceduralTextureSet,
): THREE.MeshStandardMaterial {
  switch (kind) {
    case 'skin':
      return new THREE.MeshPhysicalMaterial({
        map: tex.coatColor,
        normalMap: tex.coatNormal,
        normalScale: new THREE.Vector2(0.70, 0.70),
        roughnessMap: tex.coatRoughness,
        color: 0xa6633e,
        roughness: 0.54,
        metalness: 0.02,
        sheen: 0.76,
        sheenRoughness: 0.40,
        sheenColor: new THREE.Color(0xf4caa2),
        transparent: false,
        side: THREE.DoubleSide,
      });
    case 'skin_coat':
      return new THREE.MeshPhysicalMaterial({
        map: tex.coatColor,
        normalMap: tex.coatNormal,
        normalScale: new THREE.Vector2(0.66, 0.66),
        roughnessMap: tex.coatRoughness,
        color: 0xffffff,
        vertexColors: true,
        roughness: 0.50,
        metalness: 0.02,
        sheen: 0.82,
        sheenRoughness: 0.36,
        sheenColor: new THREE.Color(0xf6cfa8),
        transparent: false,
        side: THREE.DoubleSide,
      });
    case 'skin_points':
      return new THREE.MeshPhysicalMaterial({
        map: tex.coatColor,
        normalMap: tex.coatNormal,
        normalScale: new THREE.Vector2(0.62, 0.62),
        roughnessMap: tex.coatRoughness,
        color: 0x3b2a22,
        roughness: 0.52,
        metalness: 0.02,
        sheen: 0.54,
        sheenRoughness: 0.48,
        sheenColor: new THREE.Color(0x785949),
        transparent: false,
        side: THREE.DoubleSide,
      });
    case 'mane':
      return new THREE.MeshPhysicalMaterial({
        normalMap: tex.tendonNormal,
        normalScale: new THREE.Vector2(0.48, 0.48),
        color: 0x191310,
        roughness: 0.58,
        metalness: 0.03,
        sheen: 0.58,
        sheenRoughness: 0.44,
        sheenColor: new THREE.Color(0x634d3f),
        transparent: false,
      });
    case 'hoof':
      return new THREE.MeshPhysicalMaterial({
        map: tex.hoofColor,
        normalMap: tex.hoofNormal,
        normalScale: new THREE.Vector2(0.92, 0.92),
        color: 0x5c524a,
        roughness: 0.30,
        metalness: 0.04,
        clearcoat: 0.58,
        clearcoatRoughness: 0.22,
        transparent: false,
      });
    case 'fascia':
      return new THREE.MeshPhysicalMaterial({
        normalMap: tex.tendonNormal,
        normalScale: new THREE.Vector2(0.52, 0.52),
        color: 0xebeef2,
        roughness: 0.25,
        metalness: 0.04,
        sheen: 0.64,
        sheenColor: new THREE.Color(0xffffff),
        clearcoat: 0.42,
        clearcoatRoughness: 0.20,
        transparent: false,
        side: THREE.DoubleSide,
      });
    case 'muscle_sup':
      return new THREE.MeshPhysicalMaterial({
        map: tex.muscleColor,
        normalMap: tex.muscleNormal,
        normalScale: new THREE.Vector2(1.18, 1.18),
        color: 0xc9463a,
        roughness: 0.35,
        metalness: 0.03,
        sheen: 0.52,
        sheenRoughness: 0.38,
        sheenColor: new THREE.Color(0xf8cbc0),
        clearcoat: 0.26,
        clearcoatRoughness: 0.28,
        transparent: false,
      });
    case 'muscle_deep':
      return new THREE.MeshPhysicalMaterial({
        map: tex.muscleColor,
        normalMap: tex.muscleNormal,
        normalScale: new THREE.Vector2(1.02, 1.02),
        color: 0x912b24,
        roughness: 0.41,
        metalness: 0.03,
        sheen: 0.36,
        sheenColor: new THREE.Color(0xe6988c),
        clearcoat: 0.18,
        clearcoatRoughness: 0.34,
        transparent: false,
      });
    case 'muscle_ecorche_sup':
      return new THREE.MeshPhysicalMaterial({
        map: tex.muscleColor,
        normalMap: tex.muscleNormal,
        normalScale: new THREE.Vector2(1.22, 1.22),
        color: 0xffffff,
        vertexColors: true,
        roughness: 0.34,
        metalness: 0.03,
        sheen: 0.54,
        sheenRoughness: 0.38,
        sheenColor: new THREE.Color(0xfad2c8),
        clearcoat: 0.28,
        clearcoatRoughness: 0.28,
        transparent: false,
      });
    case 'muscle_ecorche_deep':
      return new THREE.MeshPhysicalMaterial({
        map: tex.muscleColor,
        normalMap: tex.muscleNormal,
        normalScale: new THREE.Vector2(1.04, 1.04),
        color: 0xffffff,
        vertexColors: true,
        roughness: 0.40,
        metalness: 0.03,
        sheen: 0.36,
        sheenColor: new THREE.Color(0xeaa89c),
        clearcoat: 0.18,
        clearcoatRoughness: 0.34,
        transparent: false,
      });
    case 'tendon':
      return new THREE.MeshPhysicalMaterial({
        normalMap: tex.tendonNormal,
        normalScale: new THREE.Vector2(0.74, 0.74),
        color: 0xf4eee4,
        roughness: 0.20,
        metalness: 0.04,
        sheen: 0.56,
        sheenColor: new THREE.Color(0xffffff),
        clearcoat: 0.54,
        clearcoatRoughness: 0.18,
        transparent: false,
      });
    case 'bone':
      return new THREE.MeshPhysicalMaterial({
        map: tex.boneColor,
        normalMap: tex.boneNormal,
        normalScale: new THREE.Vector2(0.84, 0.84),
        roughnessMap: tex.boneRoughness,
        color: 0xf3ead6,
        roughness: 0.45,
        metalness: 0.02,
        clearcoat: 0.15,
        clearcoatRoughness: 0.36,
        sheen: 0.12,
        sheenRoughness: 0.55,
        sheenColor: new THREE.Color(0xfff6e5),
        transparent: false,
      });
    case 'bone_dark':
      return new THREE.MeshPhysicalMaterial({
        map: tex.boneColor,
        normalMap: tex.boneNormal,
        normalScale: new THREE.Vector2(0.80, 0.80),
        roughnessMap: tex.boneRoughness,
        color: 0xdccfba,
        roughness: 0.48,
        metalness: 0.02,
        clearcoat: 0.12,
        clearcoatRoughness: 0.40,
        sheen: 0.10,
        sheenRoughness: 0.60,
        sheenColor: new THREE.Color(0xf7ead4),
        transparent: false,
      });
    case 'bone_sculpted':
      return new THREE.MeshPhysicalMaterial({
        map: tex.boneColor,
        normalMap: tex.boneNormal,
        normalScale: new THREE.Vector2(0.86, 0.86),
        roughnessMap: tex.boneRoughness,
        color: 0xffffff,
        vertexColors: true,
        roughness: 0.44,
        metalness: 0.02,
        clearcoat: 0.16,
        clearcoatRoughness: 0.34,
        sheen: 0.14,
        sheenRoughness: 0.52,
        sheenColor: new THREE.Color(0xfff8eb),
        transparent: false,
      });
    case 'teeth':
      return new THREE.MeshPhysicalMaterial({
        color: 0xf4efdf,
        roughness: 0.20,
        metalness: 0.03,
        clearcoat: 0.68,
        clearcoatRoughness: 0.16,
        transparent: false,
      });
    case 'cartilage':
      return new THREE.MeshPhysicalMaterial({
        color: 0xdbe2e7,
        roughness: 0.24,
        metalness: 0.02,
        clearcoat: 0.54,
        clearcoatRoughness: 0.20,
        sheen: 0.28,
        sheenColor: new THREE.Color(0xf5f9fc),
        transparent: false,
      });
    case 'joint_capsule':
      return new THREE.MeshPhysicalMaterial({
        normalMap: tex.tendonNormal,
        normalScale: new THREE.Vector2(0.28, 0.28),
        color: 0xdbe3ea,
        roughness: 0.26,
        metalness: 0.02,
        clearcoat: 0.48,
        clearcoatRoughness: 0.22,
        sheen: 0.34,
        sheenColor: new THREE.Color(0xf4f8fc),
        transparent: true,
        opacity: 0.34,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
    case 'ligament':
      return new THREE.MeshPhysicalMaterial({
        normalMap: tex.tendonNormal,
        normalScale: new THREE.Vector2(0.66, 0.66),
        color: 0xe3dfd4,
        roughness: 0.30,
        metalness: 0.03,
        sheen: 0.50,
        sheenRoughness: 0.36,
        sheenColor: new THREE.Color(0xf8f6ef),
        clearcoat: 0.34,
        clearcoatRoughness: 0.24,
        transparent: false,
      });
    case 'ligament_elastic':
      return new THREE.MeshPhysicalMaterial({
        normalMap: tex.tendonNormal,
        normalScale: new THREE.Vector2(0.62, 0.62),
        color: 0xdcc578,
        roughness: 0.36,
        metalness: 0.02,
        sheen: 0.44,
        sheenRoughness: 0.40,
        sheenColor: new THREE.Color(0xf6eab8),
        clearcoat: 0.24,
        clearcoatRoughness: 0.30,
        transparent: false,
      });
    case 'ligament_sculpted':
      return new THREE.MeshPhysicalMaterial({
        normalMap: tex.tendonNormal,
        normalScale: new THREE.Vector2(0.72, 0.72),
        color: 0xffffff,
        vertexColors: true,
        roughness: 0.28,
        metalness: 0.03,
        sheen: 0.52,
        sheenRoughness: 0.34,
        sheenColor: new THREE.Color(0xfaf8f2),
        clearcoat: 0.38,
        clearcoatRoughness: 0.22,
        transparent: false,
      });
    case 'artery':
      return new THREE.MeshPhysicalMaterial({
        color: 0xd92638,
        roughness: 0.32,
        metalness: 0.05,
        clearcoat: 0.4,
        transparent: false,
      });
    case 'vein':
      return new THREE.MeshPhysicalMaterial({
        color: 0x2a66c9,
        roughness: 0.36,
        metalness: 0.05,
        clearcoat: 0.35,
        transparent: false,
      });
    case 'lymph':
      return new THREE.MeshPhysicalMaterial({
        color: 0x24b659,
        roughness: 0.32,
        metalness: 0.04,
        clearcoat: 0.38,
        clearcoatRoughness: 0.24,
        emissive: new THREE.Color(0x082e16),
        emissiveIntensity: 0.18,
        transparent: false,
      });
    case 'heart':
      return new THREE.MeshPhysicalMaterial({
        map: tex.muscleColor,
        normalMap: tex.muscleNormal,
        normalScale: new THREE.Vector2(0.6, 0.6),
        color: 0xb32632,
        roughness: 0.36,
        metalness: 0.04,
        clearcoat: 0.48,
        clearcoatRoughness: 0.22,
        transparent: false,
      });
    case 'nerve':
      return new THREE.MeshStandardMaterial({
        color: 0xf4c430,
        roughness: 0.42,
        metalness: 0.06,
        emissive: new THREE.Color(0x3a2800),
        emissiveIntensity: 0.25,
        transparent: false,
      });
    case 'brain':
      return new THREE.MeshPhysicalMaterial({
        map: tex.brainColor,
        normalMap: tex.brainNormal,
        normalScale: new THREE.Vector2(0.75, 0.75),
        color: 0xf2d9c2,
        roughness: 0.42,
        metalness: 0.02,
        clearcoat: 0.42,
        clearcoatRoughness: 0.24,
        transparent: false,
      });
    case 'lung':
      return new THREE.MeshPhysicalMaterial({
        map: tex.lungColor,
        color: 0xe4959d,
        roughness: 0.56,
        metalness: 0.02,
        sheen: 0.25,
        transparent: false,
      });
    case 'trachea':
      return new THREE.MeshStandardMaterial({
        color: 0xcbe4eb,
        roughness: 0.42,
        metalness: 0.04,
        transparent: false,
      });
    case 'salivary':
      return new THREE.MeshPhysicalMaterial({
        color: 0xe8d089,
        roughness: 0.44,
        metalness: 0.02,
        clearcoat: 0.34,
        clearcoatRoughness: 0.28,
        transparent: false,
      });
    case 'liver':
      return new THREE.MeshPhysicalMaterial({
        color: 0x702624,
        roughness: 0.26,
        metalness: 0.05,
        clearcoat: 0.58,
        clearcoatRoughness: 0.18,
        transparent: false,
      });
    case 'stomach':
      return new THREE.MeshPhysicalMaterial({
        color: 0xd98f70,
        roughness: 0.42,
        metalness: 0.02,
        clearcoat: 0.32,
        transparent: false,
      });
    case 'intestine':
      return new THREE.MeshPhysicalMaterial({
        color: 0xdba587,
        roughness: 0.44,
        metalness: 0.02,
        clearcoat: 0.28,
        transparent: false,
      });
    case 'cecum':
      return new THREE.MeshPhysicalMaterial({
        color: 0x999068,
        roughness: 0.5,
        metalness: 0.02,
        clearcoat: 0.22,
        transparent: false,
      });
    case 'colon':
      return new THREE.MeshPhysicalMaterial({
        color: 0xb28765,
        roughness: 0.46,
        metalness: 0.02,
        clearcoat: 0.24,
        transparent: false,
      });
    case 'kidney':
      return new THREE.MeshPhysicalMaterial({
        color: 0x873238,
        roughness: 0.28,
        metalness: 0.04,
        clearcoat: 0.52,
        transparent: false,
      });
    case 'bladder':
      return new THREE.MeshPhysicalMaterial({
        color: 0xd9b382,
        roughness: 0.42,
        metalness: 0.02,
        clearcoat: 0.3,
        transparent: false,
      });
    case 'repro':
      return new THREE.MeshPhysicalMaterial({
        color: 0xc07db8,
        roughness: 0.44,
        metalness: 0.02,
        clearcoat: 0.28,
        transparent: false,
      });
    case 'endocrine':
      return new THREE.MeshPhysicalMaterial({
        color: 0x4db8e8,
        roughness: 0.35,
        metalness: 0.05,
        clearcoat: 0.4,
        transparent: false,
      });
    case 'eye':
      return new THREE.MeshPhysicalMaterial({
        map: tex.eyeColor,
        color: 0xffffff,
        roughness: 0.04,
        metalness: 0.04,
        clearcoat: 1.0,
        clearcoatRoughness: 0.03,
        transparent: false,
      });
    case 'cavity':
      return new THREE.MeshPhysicalMaterial({
        color: 0x67b8e3,
        roughness: 0.3,
        metalness: 0.02,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
  }
}
