import * as THREE from 'three';
import {
  AngleMeasurement,
  DistanceMeasurement,
  MeasurementRecord,
  MeasurePoint,
  MeasureToolMode,
  MeasureUnit,
  ScreenMeasurementBadge,
} from '../types/proclavet';
import { forelimbLandmarks, hindlimbLandmarks, thoracicPos } from './anatomyCoords';

const ARC_SEGMENTS = 24;

// Pre-allocated math helpers for zero-GC updates & projections
const _vA = new THREE.Vector3();
const _vV = new THREE.Vector3();
const _vB = new THREE.Vector3();
const _u = new THREE.Vector3();
const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _mid = new THREE.Vector3();
const _proj = new THREE.Vector3();

export function formatMeasureDistance(meters: number, unit: MeasureUnit): string {
  if (unit === 'mm') return `${(meters * 1000).toFixed(0)} mm`;
  if (unit === 'm') return `${meters.toFixed(2)} m`;
  return `${(meters * 100).toFixed(1)} cm`;
}

export function computeMeasureDistance(
  p1: [number, number, number],
  p2: [number, number, number],
): number {
  const dx = p2[0] - p1[0];
  const dy = p2[1] - p1[1];
  const dz = p2[2] - p1[2];
  return Math.hypot(dx, dy, dz);
}

export function computeMeasureAngle(
  a: [number, number, number],
  vertex: [number, number, number],
  b: [number, number, number],
): { angleDeg: number; supplementDeg: number } {
  _vA.set(a[0], a[1], a[2]);
  _vV.set(vertex[0], vertex[1], vertex[2]);
  _vB.set(b[0], b[1], b[2]);
  _u.subVectors(_vA, _vV);
  _v.subVectors(_vB, _vV);
  if (_u.lengthSq() < 1e-10 || _v.lengthSq() < 1e-10) {
    return { angleDeg: 0, supplementDeg: 180 };
  }
  _u.normalize();
  _v.normalize();
  const dot = THREE.MathUtils.clamp(_u.dot(_v), -1, 1);
  const angleDeg = (Math.acos(dot) * 180) / Math.PI;
  return {
    angleDeg,
    supplementDeg: Math.max(0, 180 - angleDeg),
  };
}

function buildArcBasis(
  a: THREE.Vector3,
  vertex: THREE.Vector3,
  b: THREE.Vector3,
): { radius: number; theta: number; hasValidPlane: boolean } {
  _u.subVectors(a, vertex);
  _v.subVectors(b, vertex);
  const len1 = _u.length();
  const len2 = _v.length();
  if (len1 < 1e-5 || len2 < 1e-5) {
    return { radius: 0.05, theta: 0, hasValidPlane: false };
  }
  _u.divideScalar(len1);
  _v.divideScalar(len2);

  const dot = THREE.MathUtils.clamp(_u.dot(_v), -1, 1);
  const theta = Math.acos(dot);
  const radius = THREE.MathUtils.clamp(Math.min(len1, len2) * 0.34, 0.045, 0.16);

  // Orthonormal in-plane perpendicular _w
  _w.copy(_v).addScaledVector(_u, -dot);
  if (_w.lengthSq() < 1e-8) {
    // Nearly collinear: pick stable orthogonal vector
    if (Math.abs(_u.y) < 0.9) _w.set(0, 1, 0);
    else _w.set(1, 0, 0);
    _w.addScaledVector(_u, -_w.dot(_u));
  }
  _w.normalize();

  return { radius, theta, hasValidPlane: true };
}

function computeGoniometerBadgeAnchor(
  a: [number, number, number],
  vertex: [number, number, number],
  b: [number, number, number],
  out: THREE.Vector3,
): void {
  _vA.set(a[0], a[1], a[2]);
  _vV.set(vertex[0], vertex[1], vertex[2]);
  _vB.set(b[0], b[1], b[2]);
  const { radius, theta } = buildArcBasis(_vA, _vV, _vB);
  const half = theta * 0.5;
  out
    .copy(_vV)
    .addScaledVector(_u, Math.cos(half) * radius * 1.28)
    .addScaledVector(_w, Math.sin(half) * radius * 1.28);
}

export interface EquineMeasurePreset {
  id: string;
  label: string;
  description: string;
  build: () => MeasurementRecord;
}

export const EQUINE_MEASURE_PRESETS: EquineMeasurePreset[] = [
  {
    id: 'preset-cruz',
    label: 'Alzada a la cruz',
    description: 'Distancia vertical desde el suelo (Y=0) hasta la cruz (T4)',
    build: () => {
      const [tx, ty, tz] = thoracicPos(4);
      const p1: MeasurePoint = { position: [tx, 0, tz], structureName: 'Plano de apoyo (suelo)' };
      const p2: MeasurePoint = {
        position: [tx, ty + 0.17, tz],
        structureId: 'equ.ske.tor.004',
        structureName: 'Cruz (T4)',
      };
      return {
        id: 'preset-cruz',
        kind: 'ruler',
        points: [p1, p2],
        distanceMeters: computeMeasureDistance(p1.position, p2.position),
        label: 'Alzada a la cruz',
      };
    },
  },
  {
    id: 'preset-hombro',
    label: 'Hombro (~105°)',
    description: 'Ángulo escapulohumeral izquierdo (cartílago escapular → hombro → codo)',
    build: () => {
      const f = forelimbLandmarks(-1);
      const p1: MeasurePoint = { position: [f.scapulaTop.x, f.scapulaTop.y, f.scapulaTop.z], structureName: 'Escápula dorsal' };
      const p2: MeasurePoint = { position: [f.shoulder.x, f.shoulder.y, f.shoulder.z], structureName: 'Art. del hombro' };
      const p3: MeasurePoint = { position: [f.elbow.x, f.elbow.y, f.elbow.z], structureName: 'Codo' };
      const { angleDeg, supplementDeg } = computeMeasureAngle(p1.position, p2.position, p3.position);
      return {
        id: 'preset-hombro',
        kind: 'goniometer',
        points: [p1, p2, p3],
        angleDeg,
        supplementDeg,
        label: 'Hombro izq.',
      };
    },
  },
  {
    id: 'preset-codo',
    label: 'Codo (~140°)',
    description: 'Ángulo humerorradioulnar izquierdo (hombro → codo → carpo)',
    build: () => {
      const f = forelimbLandmarks(-1);
      const p1: MeasurePoint = { position: [f.shoulder.x, f.shoulder.y, f.shoulder.z], structureName: 'Hombro' };
      const p2: MeasurePoint = { position: [f.elbow.x, f.elbow.y, f.elbow.z], structureName: 'Art. del codo' };
      const p3: MeasurePoint = { position: [f.carpus.x, f.carpus.y, f.carpus.z], structureName: 'Carpo' };
      const { angleDeg, supplementDeg } = computeMeasureAngle(p1.position, p2.position, p3.position);
      return {
        id: 'preset-codo',
        kind: 'goniometer',
        points: [p1, p2, p3],
        angleDeg,
        supplementDeg,
        label: 'Codo izq.',
      };
    },
  },
  {
    id: 'preset-babilla',
    label: 'Babilla (~140°)',
    description: 'Ángulo femorotibial izquierdo (cadera → babilla → corvejón)',
    build: () => {
      const h = hindlimbLandmarks(-1);
      const p1: MeasurePoint = { position: [h.hip.x, h.hip.y, h.hip.z], structureName: 'Cadera' };
      const p2: MeasurePoint = { position: [h.stifle.x, h.stifle.y, h.stifle.z], structureName: 'Art. de la babilla' };
      const p3: MeasurePoint = { position: [h.hock.x, h.hock.y, h.hock.z], structureName: 'Corvejón' };
      const { angleDeg, supplementDeg } = computeMeasureAngle(p1.position, p2.position, p3.position);
      return {
        id: 'preset-babilla',
        kind: 'goniometer',
        points: [p1, p2, p3],
        angleDeg,
        supplementDeg,
        label: 'Babilla izq.',
      };
    },
  },
  {
    id: 'preset-corvejon',
    label: 'Corvejón (~150°)',
    description: 'Ángulo tarsocrural izquierdo (babilla → corvejón → menudillo)',
    build: () => {
      const h = hindlimbLandmarks(-1);
      const p1: MeasurePoint = { position: [h.stifle.x, h.stifle.y, h.stifle.z], structureName: 'Babilla' };
      const p2: MeasurePoint = { position: [h.hock.x, h.hock.y, h.hock.z], structureName: 'Corvejón (tarso)' };
      const p3: MeasurePoint = { position: [h.fetlock.x, h.fetlock.y, h.fetlock.z], structureName: 'Menudillo' };
      const { angleDeg, supplementDeg } = computeMeasureAngle(p1.position, p2.position, p3.position);
      return {
        id: 'preset-corvejon',
        kind: 'goniometer',
        points: [p1, p2, p3],
        angleDeg,
        supplementDeg,
        label: 'Corvejón izq.',
      };
    },
  },
  {
    id: 'preset-podofalangico',
    label: 'Eje podofalángico (~51°)',
    description: 'Inclinación dorsal del dedo respecto al suelo (menudillo → casco → horizontal)',
    build: () => {
      const f = forelimbLandmarks(-1);
      const p1: MeasurePoint = { position: [f.fetlock.x, f.fetlock.y, f.fetlock.z], structureName: 'Menudillo ant.' };
      const p2: MeasurePoint = { position: [f.hoofCenter.x, 0.004, f.hoofCenter.z], structureName: 'Base del casco' };
      const p3: MeasurePoint = {
        position: [f.hoofCenter.x - 0.16, 0.004, f.hoofCenter.z],
        structureName: 'Horizontal caudal del suelo',
      };
      const { angleDeg, supplementDeg } = computeMeasureAngle(p1.position, p2.position, p3.position);
      return {
        id: 'preset-podofalangico',
        kind: 'goniometer',
        points: [p1, p2, p3],
        angleDeg,
        supplementDeg,
        label: 'Eje podofalángico',
      };
    },
  },
];

export class MeasurementOverlayManager {
  public readonly group = new THREE.Group();
  private savedGroup = new THREE.Group();
  private hoverGroup = new THREE.Group();

  // Shared geometries & materials
  private markerGeo = new THREE.SphereGeometry(0.011, 14, 10);
  private vertexGeo = new THREE.SphereGeometry(0.014, 14, 10);
  private reticleGeo = new THREE.SphereGeometry(0.009, 12, 10);

  private rulerLineMat = new THREE.LineBasicMaterial({
    color: 0x22d3ee,
    depthTest: false,
    transparent: true,
    opacity: 0.95,
  });
  private gonioLineMat = new THREE.LineBasicMaterial({
    color: 0xf59e0b,
    depthTest: false,
    transparent: true,
    opacity: 0.95,
  });
  private draftLineMat = new THREE.LineBasicMaterial({
    color: 0x2dd4bf,
    depthTest: false,
    transparent: true,
    opacity: 0.9,
  });
  private sectorMat = new THREE.MeshBasicMaterial({
    color: 0xf59e0b,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.24,
    depthWrite: false,
    depthTest: false,
  });
  private rulerMarkerMat = new THREE.MeshBasicMaterial({
    color: 0x22d3ee,
    depthTest: false,
  });
  private gonioMarkerMat = new THREE.MeshBasicMaterial({
    color: 0xf59e0b,
    depthTest: false,
  });
  private vertexMarkerMat = new THREE.MeshBasicMaterial({
    color: 0x14b8a6,
    depthTest: false,
  });
  private reticleMat = new THREE.MeshBasicMaterial({
    color: 0x5eead4,
    depthTest: false,
    transparent: true,
    opacity: 0.9,
  });

  // Reusable zero-GC preview objects
  private reticleMesh: THREE.Mesh;
  private previewLineGeo: THREE.BufferGeometry;
  private previewLinePositions: Float32Array;
  private previewLine: THREE.Line;
  private previewArcGeo: THREE.BufferGeometry;
  private previewArcPositions: Float32Array;
  private previewArcLine: THREE.Line;

  private lastSignature = '';

  constructor() {
    this.group.name = 'EquusMeasurementOverlay';
    this.savedGroup.renderOrder = 20;
    this.hoverGroup.renderOrder = 22;

    this.reticleMesh = new THREE.Mesh(this.reticleGeo, this.reticleMat);
    this.reticleMesh.renderOrder = 24;
    this.reticleMesh.visible = false;

    this.previewLinePositions = new Float32Array(3 * 3);
    this.previewLineGeo = new THREE.BufferGeometry();
    this.previewLineGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(this.previewLinePositions, 3),
    );
    this.previewLine = new THREE.Line(this.previewLineGeo, this.draftLineMat);
    this.previewLine.renderOrder = 21;
    this.previewLine.frustumCulled = false;
    this.previewLine.visible = false;

    this.previewArcPositions = new Float32Array((ARC_SEGMENTS + 1) * 3);
    this.previewArcGeo = new THREE.BufferGeometry();
    this.previewArcGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(this.previewArcPositions, 3),
    );
    this.previewArcLine = new THREE.Line(this.previewArcGeo, this.draftLineMat);
    this.previewArcLine.renderOrder = 21;
    this.previewArcLine.frustumCulled = false;
    this.previewArcLine.visible = false;

    this.hoverGroup.add(this.reticleMesh, this.previewLine, this.previewArcLine);
    this.group.add(this.savedGroup, this.hoverGroup);
  }

  private clearSavedGroup(): void {
    while (this.savedGroup.children.length > 0) {
      const ch = this.savedGroup.children[0];
      ch.traverse((obj) => {
        if (obj instanceof THREE.Line || obj instanceof THREE.Mesh) {
          if (
            obj.geometry !== this.markerGeo &&
            obj.geometry !== this.vertexGeo &&
            obj.geometry !== this.reticleGeo
          ) {
            obj.geometry.dispose();
          }
        }
      });
      this.savedGroup.remove(ch);
    }
  }

  private addMarker(pos: [number, number, number], isVertex: boolean, kind: 'ruler' | 'goniometer') {
    const mat = isVertex
      ? this.vertexMarkerMat
      : kind === 'ruler'
        ? this.rulerMarkerMat
        : this.gonioMarkerMat;
    const mesh = new THREE.Mesh(isVertex ? this.vertexGeo : this.markerGeo, mat);
    mesh.position.set(pos[0], pos[1], pos[2]);
    mesh.renderOrder = 22;
    this.savedGroup.add(mesh);
  }

  private addSegment(p1: [number, number, number], p2: [number, number, number], mat: THREE.LineBasicMaterial) {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(p1[0], p1[1], p1[2]),
      new THREE.Vector3(p2[0], p2[1], p2[2]),
    ]);
    const line = new THREE.Line(geo, mat);
    line.renderOrder = 20;
    this.savedGroup.add(line);
  }

  private addAngleArcAndSector(
    a: [number, number, number],
    vertex: [number, number, number],
    b: [number, number, number],
  ) {
    _vA.set(a[0], a[1], a[2]);
    _vV.set(vertex[0], vertex[1], vertex[2]);
    _vB.set(b[0], b[1], b[2]);
    const { radius, theta, hasValidPlane } = buildArcBasis(_vA, _vV, _vB);
    if (!hasValidPlane || theta < 0.005) return;

    const arcPts: THREE.Vector3[] = [];
    const sectorVerts: number[] = [];

    for (let i = 0; i <= ARC_SEGMENTS; i++) {
      const ang = (i / ARC_SEGMENTS) * theta;
      const pt = _vV
        .clone()
        .addScaledVector(_u, Math.cos(ang) * radius)
        .addScaledVector(_w, Math.sin(ang) * radius);
      arcPts.push(pt);
    }

    const arcGeo = new THREE.BufferGeometry().setFromPoints(arcPts);
    const arcLine = new THREE.Line(arcGeo, this.gonioLineMat);
    arcLine.renderOrder = 21;
    this.savedGroup.add(arcLine);

    for (let i = 0; i < ARC_SEGMENTS; i++) {
      const p1 = arcPts[i];
      const p2 = arcPts[i + 1];
      sectorVerts.push(
        _vV.x,
        _vV.y,
        _vV.z,
        p1.x,
        p1.y,
        p1.z,
        p2.x,
        p2.y,
        p2.z,
      );
    }
    const sectorGeo = new THREE.BufferGeometry();
    sectorGeo.setAttribute('position', new THREE.Float32BufferAttribute(sectorVerts, 3));
    const sectorMesh = new THREE.Mesh(sectorGeo, this.sectorMat);
    sectorMesh.renderOrder = 19;
    this.savedGroup.add(sectorMesh);
  }

  public syncSavedAndDraft(
    measurements: MeasurementRecord[],
    draftPoints: MeasurePoint[],
    mode: MeasureToolMode,
  ): void {
    const sig = JSON.stringify({
      m: measurements.map((x) => [x.id, x.points]),
      d: draftPoints.map((p) => p.position),
      mode,
    });
    if (sig === this.lastSignature) return;
    this.lastSignature = sig;

    this.clearSavedGroup();

    for (const rec of measurements) {
      if (rec.kind === 'ruler') {
        const [p1, p2] = rec.points;
        this.addMarker(p1.position, false, 'ruler');
        this.addMarker(p2.position, false, 'ruler');
        this.addSegment(p1.position, p2.position, this.rulerLineMat);
      } else {
        const [pA, pV, pB] = rec.points;
        this.addMarker(pA.position, false, 'goniometer');
        this.addMarker(pV.position, true, 'goniometer');
        this.addMarker(pB.position, false, 'goniometer');
        this.addSegment(pV.position, pA.position, this.gonioLineMat);
        this.addSegment(pV.position, pB.position, this.gonioLineMat);
        this.addAngleArcAndSector(pA.position, pV.position, pB.position);
      }
    }

    if (mode !== 'none' && draftPoints.length > 0) {
      const kind = mode;
      draftPoints.forEach((pt, idx) => {
        this.addMarker(pt.position, kind === 'goniometer' && idx === 1, kind);
      });
      if (draftPoints.length >= 2) {
        this.addSegment(draftPoints[0].position, draftPoints[1].position, this.draftLineMat);
      }
    }
  }

  public updateHoverPreview(
    hoverPos: THREE.Vector3 | null,
    draftPoints: MeasurePoint[],
    mode: MeasureToolMode,
  ): void {
    if (mode === 'none' || !hoverPos) {
      this.reticleMesh.visible = false;
      this.previewLine.visible = false;
      this.previewArcLine.visible = false;
      return;
    }

    this.reticleMesh.position.copy(hoverPos);
    this.reticleMesh.visible = true;

    if (draftPoints.length === 0) {
      this.previewLine.visible = false;
      this.previewArcLine.visible = false;
      return;
    }

    const posAttr = this.previewLineGeo.getAttribute('position') as THREE.BufferAttribute;
    if (draftPoints.length === 1) {
      const p0 = draftPoints[0].position;
      posAttr.setXYZ(0, p0[0], p0[1], p0[2]);
      posAttr.setXYZ(1, hoverPos.x, hoverPos.y, hoverPos.z);
      posAttr.needsUpdate = true;
      this.previewLineGeo.setDrawRange(0, 2);
      this.previewLine.visible = true;
      this.previewArcLine.visible = false;
      return;
    }

    if (mode === 'goniometer' && draftPoints.length === 2) {
      const pA = draftPoints[0].position;
      const pV = draftPoints[1].position;
      posAttr.setXYZ(0, pA[0], pA[1], pA[2]);
      posAttr.setXYZ(1, pV[0], pV[1], pV[2]);
      posAttr.setXYZ(2, hoverPos.x, hoverPos.y, hoverPos.z);
      posAttr.needsUpdate = true;
      this.previewLineGeo.setDrawRange(0, 3);
      this.previewLine.visible = true;

      _vA.set(pA[0], pA[1], pA[2]);
      _vV.set(pV[0], pV[1], pV[2]);
      const { radius, theta, hasValidPlane } = buildArcBasis(_vA, _vV, hoverPos);
      if (hasValidPlane && theta >= 0.01) {
        const arcAttr = this.previewArcGeo.getAttribute('position') as THREE.BufferAttribute;
        for (let i = 0; i <= ARC_SEGMENTS; i++) {
          const ang = (i / ARC_SEGMENTS) * theta;
          arcAttr.setXYZ(
            i,
            _vV.x + _u.x * Math.cos(ang) * radius + _w.x * Math.sin(ang) * radius,
            _vV.y + _u.y * Math.cos(ang) * radius + _w.y * Math.sin(ang) * radius,
            _vV.z + _u.z * Math.cos(ang) * radius + _w.z * Math.sin(ang) * radius,
          );
        }
        arcAttr.needsUpdate = true;
        this.previewArcGeo.setDrawRange(0, ARC_SEGMENTS + 1);
        this.previewArcLine.visible = true;
      } else {
        this.previewArcLine.visible = false;
      }
    } else {
      this.previewLine.visible = false;
      this.previewArcLine.visible = false;
    }
  }

  public projectBadges(
    camera: THREE.Camera,
    width: number,
    height: number,
    measurements: MeasurementRecord[],
    draftPoints: MeasurePoint[],
    hoverPos: THREE.Vector3 | null,
    mode: MeasureToolMode,
    unit: MeasureUnit,
  ): ScreenMeasurementBadge[] {
    const out: ScreenMeasurementBadge[] = [];

    const pushProjected = (
      id: string,
      worldPos: THREE.Vector3,
      primary: string,
      kind: 'ruler' | 'goniometer',
      secondary?: string,
      draft?: boolean,
    ) => {
      _proj.copy(worldPos).project(camera);
      if (_proj.z >= 1 || _proj.z < -1) return;
      if (Math.abs(_proj.x) > 1.05 || Math.abs(_proj.y) > 1.05) return;
      out.push({
        id,
        x: ((_proj.x + 1) / 2) * width,
        y: ((1 - _proj.y) / 2) * height,
        primary,
        secondary,
        draft,
        kind,
      });
    };

    for (const rec of measurements) {
      if (rec.kind === 'ruler') {
        const [a, b] = rec.points;
        _mid.set(
          (a.position[0] + b.position[0]) * 0.5,
          (a.position[1] + b.position[1]) * 0.5,
          (a.position[2] + b.position[2]) * 0.5,
        );
        pushProjected(
          rec.id,
          _mid,
          formatMeasureDistance(rec.distanceMeters, unit),
          'ruler',
          rec.label,
          false,
        );
      } else {
        const [a, v, b] = rec.points;
        computeGoniometerBadgeAnchor(a.position, v.position, b.position, _mid);
        pushProjected(
          rec.id,
          _mid,
          `${rec.angleDeg.toFixed(1)}°`,
          'goniometer',
          rec.label ? `${rec.label} · sup. ${rec.supplementDeg.toFixed(1)}°` : `sup. ${rec.supplementDeg.toFixed(1)}°`,
          false,
        );
      }
    }

    if (mode === 'ruler' && draftPoints.length === 1 && hoverPos) {
      const p0 = draftPoints[0].position;
      const dist = computeMeasureDistance(p0, [hoverPos.x, hoverPos.y, hoverPos.z]);
      _mid.set(
        (p0[0] + hoverPos.x) * 0.5,
        (p0[1] + hoverPos.y) * 0.5,
        (p0[2] + hoverPos.z) * 0.5,
      );
      pushProjected('draft-ruler', _mid, formatMeasureDistance(dist, unit), 'ruler', 'Vista previa', true);
    } else if (mode === 'goniometer' && draftPoints.length === 2 && hoverPos) {
      const pA = draftPoints[0].position;
      const pV = draftPoints[1].position;
      const { angleDeg, supplementDeg } = computeMeasureAngle(pA, pV, [
        hoverPos.x,
        hoverPos.y,
        hoverPos.z,
      ]);
      computeGoniometerBadgeAnchor(pA, pV, [hoverPos.x, hoverPos.y, hoverPos.z], _mid);
      pushProjected(
        'draft-gonio',
        _mid,
        `${angleDeg.toFixed(1)}°`,
        'goniometer',
        `sup. ${supplementDeg.toFixed(1)}°`,
        true,
      );
    }

    return out;
  }

  public dispose(): void {
    this.clearSavedGroup();
    this.markerGeo.dispose();
    this.vertexGeo.dispose();
    this.reticleGeo.dispose();
    this.previewLineGeo.dispose();
    this.previewArcGeo.dispose();
    this.rulerLineMat.dispose();
    this.gonioLineMat.dispose();
    this.draftLineMat.dispose();
    this.sectorMat.dispose();
    this.rulerMarkerMat.dispose();
    this.gonioMarkerMat.dispose();
    this.vertexMarkerMat.dispose();
    this.reticleMat.dispose();
  }
}
