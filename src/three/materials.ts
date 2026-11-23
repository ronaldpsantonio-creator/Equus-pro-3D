import * as THREE from 'three';
import { ProceduralTextureSet } from './textures';

export type TissueKind =
  | 'skin'
  | 'skin_points'
  | 'mane'
  | 'hoof'
  | 'fascia'
  | 'muscle_sup'
  | 'muscle_deep'
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
        bumpMap: tex.coatBump,
        bumpScale: 0.0045,
        color: 0xa6633e,
        roughness: 0.66,
        metalness: 0.02,
        sheen: 0.52,
        sheenRoughness: 0.55,
        sheenColor: new THREE.Color(0xe3b189),
        transparent: true,
        side: THREE.DoubleSide,
      });
    case 'skin_points':
      return new THREE.MeshPhysicalMaterial({
        map: tex.coatColor,
        bumpMap: tex.coatBump,
        bumpScale: 0.004,
        color: 0x3b2a22,
        roughness: 0.64,
        metalness: 0.02,
        sheen: 0.35,
        sheenRoughness: 0.6,
        sheenColor: new THREE.Color(0x6e5243),
        transparent: true,
        side: THREE.DoubleSide,
      });
    case 'mane':
      return new THREE.MeshPhysicalMaterial({
        color: 0x1d1612,
        roughness: 0.78,
        metalness: 0.02,
        sheen: 0.3,
        sheenRoughness: 0.65,
        sheenColor: new THREE.Color(0x4a3b32),
        transparent: true,
      });
    case 'hoof':
      return new THREE.MeshPhysicalMaterial({
        map: tex.hoofColor,
        bumpMap: tex.hoofBump,
        bumpScale: 0.006,
        color: 0x4b433c,
        roughness: 0.38,
        metalness: 0.05,
        clearcoat: 0.42,
        clearcoatRoughness: 0.32,
        transparent: true,
      });
    case 'fascia':
      return new THREE.MeshPhysicalMaterial({
        color: 0xdce4ee,
        roughness: 0.34,
        metalness: 0.04,
        sheen: 0.45,
        clearcoat: 0.15,
        transparent: true,
        side: THREE.DoubleSide,
      });
    case 'muscle_sup':
      return new THREE.MeshPhysicalMaterial({
        map: tex.muscleColor,
        bumpMap: tex.muscleBump,
        bumpScale: 0.014,
        color: 0xc95448,
        roughness: 0.48,
        metalness: 0.03,
        sheen: 0.34,
        sheenColor: new THREE.Color(0xf0b5aa),
        transparent: true,
      });
    case 'muscle_deep':
      return new THREE.MeshPhysicalMaterial({
        map: tex.muscleColor,
        bumpMap: tex.muscleBump,
        bumpScale: 0.011,
        color: 0xa23a31,
        roughness: 0.54,
        metalness: 0.03,
        transparent: true,
      });
    case 'tendon':
      return new THREE.MeshPhysicalMaterial({
        color: 0xe6e1d3,
        roughness: 0.28,
        metalness: 0.06,
        clearcoat: 0.3,
        transparent: true,
      });
    case 'bone':
      return new THREE.MeshStandardMaterial({
        map: tex.boneColor,
        bumpMap: tex.boneBump,
        bumpScale: 0.006,
        color: 0xefe6cf,
        roughness: 0.62,
        metalness: 0.04,
        transparent: true,
      });
    case 'bone_dark':
      return new THREE.MeshStandardMaterial({
        map: tex.boneColor,
        bumpMap: tex.boneBump,
        bumpScale: 0.005,
        color: 0xd9ccb0,
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
        bumpMap: tex.muscleBump,
        bumpScale: 0.008,
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
        color: 0xe6c7a8,
        roughness: 0.46,
        metalness: 0.02,
        clearcoat: 0.35,
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
        color: 0x16120f,
        roughness: 0.06,
        metalness: 0.05,
        clearcoat: 1.0,
        clearcoatRoughness: 0.04,
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
