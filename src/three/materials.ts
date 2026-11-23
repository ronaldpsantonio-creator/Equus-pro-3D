import * as THREE from 'three';
import { ProceduralTextureSet } from './textures';

export type TissueKind =
  | 'skin'
  | 'mane'
  | 'hoof'
  | 'fascia'
  | 'muscle_sup'
  | 'muscle_deep'
  | 'tendon'
  | 'bone'
  | 'bone_dark'
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
        color: 0xb2734d,
        roughness: 0.72,
        metalness: 0.02,
        sheen: 0.35,
        sheenRoughness: 0.65,
        sheenColor: new THREE.Color(0xd9a882),
        transparent: true,
        side: THREE.DoubleSide,
      });
    case 'mane':
      return new THREE.MeshStandardMaterial({
        color: 0x261d17,
        roughness: 0.85,
        metalness: 0.02,
        transparent: true,
      });
    case 'hoof':
      return new THREE.MeshPhysicalMaterial({
        color: 0x3b3530,
        roughness: 0.36,
        metalness: 0.05,
        clearcoat: 0.35,
        clearcoatRoughness: 0.35,
        transparent: true,
      });
    case 'fascia':
      return new THREE.MeshPhysicalMaterial({
        color: 0xdce4ee,
        roughness: 0.38,
        metalness: 0.04,
        sheen: 0.4,
        transparent: true,
        side: THREE.DoubleSide,
      });
    case 'muscle_sup':
      return new THREE.MeshPhysicalMaterial({
        map: tex.muscleColor,
        bumpMap: tex.muscleBump,
        bumpScale: 0.012,
        color: 0xcf594d,
        roughness: 0.52,
        metalness: 0.03,
        sheen: 0.3,
        sheenColor: new THREE.Color(0xf0b5aa),
        transparent: true,
      });
    case 'muscle_deep':
      return new THREE.MeshPhysicalMaterial({
        map: tex.muscleColor,
        bumpMap: tex.muscleBump,
        bumpScale: 0.01,
        color: 0xa63c33,
        roughness: 0.56,
        metalness: 0.03,
        transparent: true,
      });
    case 'tendon':
      return new THREE.MeshPhysicalMaterial({
        color: 0xe6e1d3,
        roughness: 0.32,
        metalness: 0.06,
        clearcoat: 0.25,
        transparent: true,
      });
    case 'bone':
      return new THREE.MeshStandardMaterial({
        map: tex.boneColor,
        color: 0xeee5cf,
        roughness: 0.64,
        metalness: 0.04,
        transparent: true,
      });
    case 'bone_dark':
      return new THREE.MeshStandardMaterial({
        map: tex.boneColor,
        color: 0xd8cbb0,
        roughness: 0.68,
        metalness: 0.04,
        transparent: true,
      });
    case 'cartilage':
      return new THREE.MeshPhysicalMaterial({
        color: 0xbfe3ec,
        roughness: 0.28,
        metalness: 0.02,
        clearcoat: 0.45,
        transparent: true,
      });
    case 'ligament':
      return new THREE.MeshStandardMaterial({
        color: 0xa3e0b2,
        roughness: 0.45,
        metalness: 0.04,
        transparent: true,
      });
    case 'artery':
      return new THREE.MeshPhysicalMaterial({
        color: 0xd92638,
        roughness: 0.35,
        metalness: 0.05,
        clearcoat: 0.35,
        transparent: true,
      });
    case 'vein':
      return new THREE.MeshPhysicalMaterial({
        color: 0x2a66c9,
        roughness: 0.38,
        metalness: 0.05,
        clearcoat: 0.3,
        transparent: true,
      });
    case 'heart':
      return new THREE.MeshPhysicalMaterial({
        map: tex.muscleColor,
        color: 0xb32632,
        roughness: 0.38,
        metalness: 0.04,
        clearcoat: 0.45,
        clearcoatRoughness: 0.25,
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
        roughness: 0.48,
        metalness: 0.02,
        clearcoat: 0.3,
        transparent: true,
      });
    case 'lung':
      return new THREE.MeshPhysicalMaterial({
        map: tex.lungColor,
        color: 0xe4959d,
        roughness: 0.58,
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
        roughness: 0.28,
        metalness: 0.05,
        clearcoat: 0.55,
        clearcoatRoughness: 0.2,
        transparent: true,
      });
    case 'stomach':
      return new THREE.MeshPhysicalMaterial({
        color: 0xd98f70,
        roughness: 0.44,
        metalness: 0.02,
        clearcoat: 0.3,
        transparent: true,
      });
    case 'intestine':
      return new THREE.MeshPhysicalMaterial({
        color: 0xdba587,
        roughness: 0.46,
        metalness: 0.02,
        clearcoat: 0.25,
        transparent: true,
      });
    case 'cecum':
      return new THREE.MeshPhysicalMaterial({
        color: 0x999068,
        roughness: 0.52,
        metalness: 0.02,
        clearcoat: 0.2,
        transparent: true,
      });
    case 'colon':
      return new THREE.MeshPhysicalMaterial({
        color: 0xb28765,
        roughness: 0.48,
        metalness: 0.02,
        clearcoat: 0.22,
        transparent: true,
      });
    case 'kidney':
      return new THREE.MeshPhysicalMaterial({
        color: 0x873238,
        roughness: 0.3,
        metalness: 0.04,
        clearcoat: 0.5,
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
        roughness: 0.45,
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
        color: 0x1e1915,
        roughness: 0.1,
        metalness: 0.05,
        clearcoat: 1.0,
        clearcoatRoughness: 0.05,
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
