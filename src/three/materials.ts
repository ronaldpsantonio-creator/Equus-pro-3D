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
  | 'teeth'
  | 'cartilage'
  | 'ligament'
  | 'artery'
  | 'vein'
  | 'heart'
  | 'nerve'
  | 'brain'
  | 'lung'
  | 'trachea'
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
        normalScale: new THREE.Vector2(0.55, 0.55),
        color: 0xa6633e,
        roughness: 0.64,
        metalness: 0.02,
        sheen: 0.54,
        sheenRoughness: 0.52,
        sheenColor: new THREE.Color(0xe6b58f),
        transparent: true,
        side: THREE.DoubleSide,
      });
    case 'skin_coat':
      return new THREE.MeshPhysicalMaterial({
        map: tex.coatColor,
        normalMap: tex.coatNormal,
        normalScale: new THREE.Vector2(0.48, 0.48),
        color: 0xffffff,
        vertexColors: true,
        roughness: 0.58,
        metalness: 0.02,
        sheen: 0.62,
        sheenRoughness: 0.46,
        sheenColor: new THREE.Color(0xf0c7a4),
        transparent: true,
        side: THREE.DoubleSide,
      });
    case 'skin_points':
      return new THREE.MeshPhysicalMaterial({
        map: tex.coatColor,
        normalMap: tex.coatNormal,
        normalScale: new THREE.Vector2(0.5, 0.5),
        color: 0x3b2a22,
        roughness: 0.62,
        metalness: 0.02,
        sheen: 0.38,
        sheenRoughness: 0.58,
        sheenColor: new THREE.Color(0x6e5243),
        transparent: true,
        side: THREE.DoubleSide,
      });
    case 'mane':
      return new THREE.MeshPhysicalMaterial({
        normalMap: tex.tendonNormal,
        normalScale: new THREE.Vector2(0.32, 0.32),
        color: 0x1a1411,
        roughness: 0.72,
        metalness: 0.02,
        sheen: 0.42,
        sheenRoughness: 0.56,
        sheenColor: new THREE.Color(0x524035),
        transparent: true,
      });
    case 'hoof':
      return new THREE.MeshPhysicalMaterial({
        map: tex.hoofColor,
        normalMap: tex.hoofNormal,
        normalScale: new THREE.Vector2(0.7, 0.7),
        color: 0x4b433c,
        roughness: 0.36,
        metalness: 0.05,
        clearcoat: 0.45,
        clearcoatRoughness: 0.3,
        transparent: true,
      });
    case 'fascia':
      return new THREE.MeshPhysicalMaterial({
        normalMap: tex.tendonNormal,
        normalScale: new THREE.Vector2(0.32, 0.32),
        color: 0xe2e8f0,
        roughness: 0.32,
        metalness: 0.04,
        sheen: 0.5,
        sheenColor: new THREE.Color(0xffffff),
        clearcoat: 0.2,
        transparent: true,
        side: THREE.DoubleSide,
      });
    case 'muscle_sup':
      return new THREE.MeshPhysicalMaterial({
        map: tex.muscleColor,
        normalMap: tex.muscleNormal,
        normalScale: new THREE.Vector2(0.85, 0.85),
        color: 0xd14d41,
        roughness: 0.44,
        metalness: 0.03,
        sheen: 0.38,
        sheenRoughness: 0.48,
        sheenColor: new THREE.Color(0xf4beb3),
        transparent: true,
      });
    case 'muscle_deep':
      return new THREE.MeshPhysicalMaterial({
        map: tex.muscleColor,
        normalMap: tex.muscleNormal,
        normalScale: new THREE.Vector2(0.7, 0.7),
        color: 0x9b322a,
        roughness: 0.5,
        metalness: 0.03,
        sheen: 0.24,
        sheenColor: new THREE.Color(0xe08d82),
        transparent: true,
      });
    case 'muscle_ecorche_sup':
      return new THREE.MeshPhysicalMaterial({
        map: tex.muscleColor,
        normalMap: tex.muscleNormal,
        normalScale: new THREE.Vector2(0.88, 0.88),
        color: 0xffffff,
        vertexColors: true,
        roughness: 0.42,
        metalness: 0.03,
        sheen: 0.4,
        sheenRoughness: 0.46,
        sheenColor: new THREE.Color(0xf8cbc2),
        transparent: true,
      });
    case 'muscle_ecorche_deep':
      return new THREE.MeshPhysicalMaterial({
        map: tex.muscleColor,
        normalMap: tex.muscleNormal,
        normalScale: new THREE.Vector2(0.74, 0.74),
        color: 0xffffff,
        vertexColors: true,
        roughness: 0.48,
        metalness: 0.03,
        sheen: 0.28,
        sheenColor: new THREE.Color(0xe59d93),
        transparent: true,
      });
    case 'tendon':
      return new THREE.MeshPhysicalMaterial({
        normalMap: tex.tendonNormal,
        normalScale: new THREE.Vector2(0.55, 0.55),
        color: 0xf0ebe0,
        roughness: 0.25,
        metalness: 0.05,
        sheen: 0.36,
        sheenColor: new THREE.Color(0xffffff),
        clearcoat: 0.38,
        clearcoatRoughness: 0.24,
        transparent: true,
      });
    case 'bone':
      return new THREE.MeshStandardMaterial({
        map: tex.boneColor,
        normalMap: tex.boneNormal,
        normalScale: new THREE.Vector2(0.45, 0.45),
        roughnessMap: tex.boneRoughness,
        color: 0xf2ead7,
        roughness: 0.62,
        metalness: 0.04,
        transparent: true,
      });
    case 'bone_dark':
      return new THREE.MeshStandardMaterial({
        map: tex.boneColor,
        normalMap: tex.boneNormal,
        normalScale: new THREE.Vector2(0.4, 0.4),
        roughnessMap: tex.boneRoughness,
        color: 0xdccfb4,
        roughness: 0.66,
        metalness: 0.04,
        transparent: true,
      });
    case 'teeth':
      return new THREE.MeshPhysicalMaterial({
        color: 0xf4efdf,
        roughness: 0.24,
        metalness: 0.03,
        clearcoat: 0.55,
        clearcoatRoughness: 0.22,
        transparent: true,
      });
    case 'cartilage':
      return new THREE.MeshPhysicalMaterial({
        color: 0xbfe3ec,
        roughness: 0.24,
        metalness: 0.02,
        clearcoat: 0.52,
        transparent: true,
      });
    case 'ligament':
      return new THREE.MeshStandardMaterial({
        color: 0xa3e0b2,
        roughness: 0.42,
        metalness: 0.04,
        transparent: true,
      });
    case 'artery':
      return new THREE.MeshPhysicalMaterial({
        color: 0xd92638,
        roughness: 0.32,
        metalness: 0.05,
        clearcoat: 0.4,
        transparent: true,
      });
    case 'vein':
      return new THREE.MeshPhysicalMaterial({
        color: 0x2a66c9,
        roughness: 0.36,
        metalness: 0.05,
        clearcoat: 0.35,
        transparent: true,
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
        transparent: true,
      });
    case 'nerve':
      return new THREE.MeshStandardMaterial({
        color: 0xf4c430,
        roughness: 0.42,
        metalness: 0.06,
        emissive: new THREE.Color(0x3a2800),
        emissiveIntensity: 0.25,
        transparent: true,
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
        transparent: true,
      });
    case 'lung':
      return new THREE.MeshPhysicalMaterial({
        map: tex.lungColor,
        color: 0xe4959d,
        roughness: 0.56,
        metalness: 0.02,
        sheen: 0.25,
        transparent: true,
      });
    case 'trachea':
      return new THREE.MeshStandardMaterial({
        color: 0xcbe4eb,
        roughness: 0.42,
        metalness: 0.04,
        transparent: true,
      });
    case 'liver':
      return new THREE.MeshPhysicalMaterial({
        color: 0x702624,
        roughness: 0.26,
        metalness: 0.05,
        clearcoat: 0.58,
        clearcoatRoughness: 0.18,
        transparent: true,
      });
    case 'stomach':
      return new THREE.MeshPhysicalMaterial({
        color: 0xd98f70,
        roughness: 0.42,
        metalness: 0.02,
        clearcoat: 0.32,
        transparent: true,
      });
    case 'intestine':
      return new THREE.MeshPhysicalMaterial({
        color: 0xdba587,
        roughness: 0.44,
        metalness: 0.02,
        clearcoat: 0.28,
        transparent: true,
      });
    case 'cecum':
      return new THREE.MeshPhysicalMaterial({
        color: 0x999068,
        roughness: 0.5,
        metalness: 0.02,
        clearcoat: 0.22,
        transparent: true,
      });
    case 'colon':
      return new THREE.MeshPhysicalMaterial({
        color: 0xb28765,
        roughness: 0.46,
        metalness: 0.02,
        clearcoat: 0.24,
        transparent: true,
      });
    case 'kidney':
      return new THREE.MeshPhysicalMaterial({
        color: 0x873238,
        roughness: 0.28,
        metalness: 0.04,
        clearcoat: 0.52,
        transparent: true,
      });
    case 'bladder':
      return new THREE.MeshPhysicalMaterial({
        color: 0xd9b382,
        roughness: 0.42,
        metalness: 0.02,
        clearcoat: 0.3,
        transparent: true,
      });
    case 'repro':
      return new THREE.MeshPhysicalMaterial({
        color: 0xc07db8,
        roughness: 0.44,
        metalness: 0.02,
        clearcoat: 0.28,
        transparent: true,
      });
    case 'endocrine':
      return new THREE.MeshPhysicalMaterial({
        color: 0x4db8e8,
        roughness: 0.35,
        metalness: 0.05,
        clearcoat: 0.4,
        transparent: true,
      });
    case 'eye':
      return new THREE.MeshPhysicalMaterial({
        map: tex.eyeColor,
        color: 0xffffff,
        roughness: 0.04,
        metalness: 0.04,
        clearcoat: 1.0,
        clearcoatRoughness: 0.03,
        transparent: true,
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
