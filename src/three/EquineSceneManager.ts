import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  CutawayMode,
  getCatalogSystem,
  LAYERS,
  LayerCode,
  LayerState,
  ScreenLabel,
  SexFilter,
  StructureRecord,
  SystemCode,
} from '../types/proclavet';
import { buildMuscularAndTegumentaryParts } from './builders/buildMuscularAndTegumentary';
import { buildSkeletalAndArticularParts, BuiltPart } from './builders/buildSkeletalAndArticular';
import { buildVisceraAndNeuroParts } from './builders/buildVisceraAndNeuro';
import { createProceduralTextures, ProceduralTextureSet } from './textures';

export interface SceneItemRuntime {
  record: StructureRecord;
  group: THREE.Group;
  center: THREE.Vector3;
  explodeDir: THREE.Vector3;
  side: 'left' | 'right' | 'center';
  hasMesh: boolean;
  state: 'esquemático' | 'cargado' | 'pendiente';
  visibleOverride: boolean;
  materials: THREE.MeshStandardMaterial[];
  baseColorHex: number[];
}

export interface SceneVisualConfig {
  layers: Record<LayerCode, LayerState>;
  systems: Record<SystemCode, boolean>;
  sex: SexFilter;
  cutaway: CutawayMode;
  explode: number; // 0..100
  selectedId: string | null;
  hoveredId: string | null;
  showLabels: boolean;
  blindMode: boolean;
  vitalSigns: boolean;
}

export interface SceneCallbacks {
  onSelect: (id: string | null) => void;
  onHover: (id: string | null, x: number, y: number) => void;
  onLabelsUpdate: (labels: ScreenLabel[]) => void;
  onContextLost: (lost: boolean) => void;
}

// Reusable scratch objects to keep render loop GC-free
const _v3 = new THREE.Vector3();
const _v3b = new THREE.Vector3();
const _proj = new THREE.Vector3();
const _camPosTarget = new THREE.Vector3(2.45, 1.55, -2.55);
const _camLookTarget = new THREE.Vector3(0.1, 0.95, 0);

const LAYER_ORDER: Record<LayerCode, number> = Object.fromEntries(
  LAYERS.map((l, idx) => [l.code, idx]),
) as Record<LayerCode, number>;

function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export class EquineSceneManager {
  private container: HTMLElement;
  private callbacks: SceneCallbacks;
  private isSoftwareGl: boolean;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private textures: ProceduralTextureSet;
  private envRT: THREE.WebGLRenderTarget | null = null;
  private gltfLoader = new GLTFLoader();

  private items: Record<string, SceneItemRuntime> = {};
  private clickableMeshes: THREE.Object3D[] = [];
  private raycaster = new THREE.Raycaster();
  private pointerNDC = new THREE.Vector2();

  private config: SceneVisualConfig;
  private currentExplode = 0;
  private cameraAnimating = false;
  private pointerDownPos: [number, number] | null = null;
  private lastHoverCheck = 0;
  private lastLabelEmit = 0;

  private frameId = 0;
  private renderBusy = false;
  private renderDirty = false;
  private lastTime = performance.now();
  private vitalClock = 0;
  private disposed = false;

  // Dynamic vital references
  private heartGroup: THREE.Object3D | null = null;
  private lungGroups: THREE.Object3D[] = [];

  constructor(
    container: HTMLElement,
    initialConfig: SceneVisualConfig,
    callbacks: SceneCallbacks,
  ) {
    this.container = container;
    this.config = initialConfig;
    this.callbacks = callbacks;
    this.isSoftwareGl = detectSoftwareWebGL();

    const width = Math.max(container.clientWidth, 1);
    const height = Math.max(container.clientHeight, 1);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height, false);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.touchAction = 'none';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    const bgColor = 0x0c1118;
    this.scene.background = new THREE.Color(bgColor);
    this.scene.fog = new THREE.FogExp2(bgColor, 0.055);

    this.camera = new THREE.PerspectiveCamera(40, width / height, 0.05, 60);
    this.camera.position.copy(_camPosTarget);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.copy(_camLookTarget);
    this.controls.enableDamping = !this.isSoftwareGl;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 0.65;
    this.controls.maxDistance = 8.5;
    this.controls.maxPolarAngle = Math.PI * 0.52;
    this.controls.update();

    // Procedural Studio Environment Map
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this.envRT.texture;
    pmrem.dispose();

    // 3-Point Warm/Cool Studio Lighting
    const hemi = new THREE.HemisphereLight(0xdbeafe, 0x1e293b, 0.72);
    this.scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xfff4e0, 1.55);
    keyLight.position.set(3.2, 4.8, -3.5);
    keyLight.castShadow = !this.isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 14;
    const d = 2.4;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    this.scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x93c5fd, 0.65);
    rimLight.position.set(-3.5, 2.8, 3.2);
    this.scene.add(rimLight);

    // Procedural textures
    this.textures = createProceduralTextures(this.renderer.capabilities.getMaxAnisotropy());

    // Studio floor at Y = 0
    this.buildStudioFloor();

    // Events
    this.bindEvents();
  }

  private buildStudioFloor(): void {
    const shadowMat = new THREE.MeshBasicMaterial({
      map: this.textures.floorShadow,
      transparent: true,
      depthWrite: false,
      opacity: 0.75,
    });
    const shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.2), shadowMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.set(-0.05, 0.002, 0);
    shadowPlane.renderOrder = 1;
    this.scene.add(shadowPlane);

    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0f1621,
      roughness: 0.88,
      metalness: 0.08,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
    const floor = new THREE.Mesh(new THREE.CircleGeometry(14, 48), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    floor.receiveShadow = true;
    this.scene.add(floor);

    const grid = new THREE.GridHelper(8, 16, 0x334155, 0x1e293b);
    grid.position.y = 0.001;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.35;
    this.scene.add(grid);
  }

  public populateCatalog(structures: StructureRecord[]): {
    mounted3DCount: number;
    matchedIds: Set<string>;
  } {
    // Build all procedural anatomical 3D parts
    const builtParts: BuiltPart[] = [
      ...buildSkeletalAndArticularParts(this.textures),
      ...buildMuscularAndTegumentaryParts(this.textures),
      ...buildVisceraAndNeuroParts(this.textures),
    ];

    const builtMap = new Map<string, BuiltPart>();
    for (const part of builtParts) {
      builtMap.set(part.id, part);
    }

    const matchedIds = new Set<string>();
    let mounted3DCount = 0;

    for (const s of structures) {
      const group = new THREE.Group();
      group.userData.id = s.id;

      const part = builtMap.get(s.id);
      const mats: THREE.MeshStandardMaterial[] = [];
      const baseColorHex: number[] = [];

      let center = new THREE.Vector3(0, 1, 0);
      let side: 'left' | 'right' | 'center' =
        s.id.endsWith('-i') ? 'left' : s.id.endsWith('-d') ? 'right' : 'center';
      let hasMesh = false;

      if (part) {
        group.add(part.mesh);
        center = part.center.clone();
        side = part.side;
        hasMesh = true;
        mounted3DCount++;
        matchedIds.add(s.id);

        if (s.id === 'equ.car.cor.001') this.heartGroup = part.mesh;
        if (s.id.startsWith('equ.res.pul.001')) this.lungGroups.push(part.mesh);
      } else if (s.ph) {
        const phGeo = new THREE.BoxGeometry(s.ph.s[0], s.ph.s[1], s.ph.s[2]);
        const phMat = new THREE.MeshStandardMaterial({
          color: s.ph.c,
          transparent: true,
          roughness: 0.5,
        });
        const phMesh = new THREE.Mesh(phGeo, phMat);
        phMesh.position.set(s.ph.p[0], s.ph.p[1], s.ph.p[2]);
        group.add(phMesh);
        center.set(s.ph.p[0], s.ph.p[1], s.ph.p[2]);
        hasMesh = true;
        mounted3DCount++;
        matchedIds.add(s.id);
      }

      group.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          if (Array.isArray(m.material)) {
            m.material = m.material.map((mm) => mm.clone());
            m.material.forEach((mm) => {
              if (mm instanceof THREE.MeshStandardMaterial) {
                mats.push(mm);
                baseColorHex.push(mm.color.getHex());
              }
            });
          } else if (m.material instanceof THREE.MeshStandardMaterial) {
            const cloned = m.material.clone() as THREE.MeshStandardMaterial;
            m.material = cloned;
            mats.push(cloned);
            baseColorHex.push(cloned.color.getHex());
          }
          m.userData.id = s.id;
          this.clickableMeshes.push(m);
        }
      });

      // Radial + lateral explosion direction anchored around equine torso center (0.05, 1.05, 0)
      const explodeDir = center.clone().sub(_v3.set(0.05, 1.05, 0));
      if (explodeDir.lengthSq() < 0.001) explodeDir.set(0, 0.2, 0);
      explodeDir.normalize();

      this.scene.add(group);
      this.items[s.id] = {
        record: s,
        group,
        center,
        explodeDir,
        side,
        hasMesh,
        state: hasMesh ? 'esquemático' : 'pendiente',
        visibleOverride: true,
        materials: mats,
        baseColorHex,
      };
    }

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.applyVisualConfig(this.config, true);
    this.requestRender();

    return { mounted3DCount, matchedIds };
  }

  public getItemState(id: string): SceneItemRuntime['state'] {
    return this.items[id]?.state || 'pendiente';
  }

  public hasMesh(id: string): boolean {
    return !!this.items[id]?.hasMesh;
  }

  public getVisible3DIds(): string[] {
    return Object.values(this.items)
      .filter((it) => it.hasMesh && it.group.visible)
      .map((it) => it.record.id);
  }

  public isolateStructure(id: string | null): void {
    Object.values(this.items).forEach((it) => {
      it.visibleOverride = id ? it.record.id === id : true;
    });
    this.applyVisualConfig(this.config, true);
    this.requestRender();
  }

  public setStructureVisible(id: string, vis: boolean): void {
    const it = this.items[id];
    if (!it) return;
    it.visibleOverride = vis;
    this.applyVisualConfig(this.config, true);
    this.requestRender();
  }

  public isStructureVisibleOverride(id: string): boolean {
    return this.items[id]?.visibleOverride ?? true;
  }

  public showAllStructures(): void {
    Object.values(this.items).forEach((it) => {
      it.visibleOverride = true;
    });
    this.applyVisualConfig(this.config, true);
    this.requestRender();
  }

  public setCameraView(pos: [number, number, number], target: [number, number, number]): void {
    _camPosTarget.set(pos[0], pos[1], pos[2]);
    _camLookTarget.set(target[0], target[1], target[2]);
    this.cameraAnimating = true;
    this.startLoopIfActive();
  }

  public focusOnStructure(id: string): void {
    const it = this.items[id];
    if (!it || !it.hasMesh) return;
    const worldCenter = it.center.clone().add(it.group.position);
    const offset = this.camera.position.clone().sub(this.controls.target);
    const dist = THREE.MathUtils.clamp(offset.length(), 0.9, 2.2);
    offset.normalize().multiplyScalar(dist);
    _camLookTarget.copy(worldCenter);
    _camPosTarget.copy(worldCenter).add(offset);
    this.cameraAnimating = true;
    this.startLoopIfActive();
  }

  public async loadCustomGlb(id: string, file: File): Promise<void> {
    const it = this.items[id];
    if (!it) throw new Error('Estructura no encontrada');
    const url = URL.createObjectURL(file);
    try {
      const gltf = await new Promise<{ scene: THREE.Group }>((resolve, reject) => {
        this.gltfLoader.load(url, resolve, undefined, reject);
      });
      // Remove existing children
      while (it.group.children.length > 0) {
        const ch = it.group.children[0];
        it.group.remove(ch);
      }
      it.materials = [];
      it.baseColorHex = [];
      it.group.add(gltf.scene);
      gltf.scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          if (m.material instanceof THREE.MeshStandardMaterial) {
            const cloned = m.material.clone() as THREE.MeshStandardMaterial;
            cloned.transparent = true;
            m.material = cloned;
            it.materials.push(cloned);
            it.baseColorHex.push(cloned.color.getHex());
          }
          m.userData.id = id;
          m.castShadow = true;
          m.receiveShadow = true;
          this.clickableMeshes.push(m);
        }
      });
      const box = new THREE.Box3().setFromObject(gltf.scene);
      box.getCenter(it.center);
      it.hasMesh = true;
      it.state = 'cargado';
      this.applyVisualConfig(this.config, true);
      this.requestRender();
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  public captureSnapshot(): string {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }

  public applyVisualConfig(nextConfig: SceneVisualConfig, immediate = false): void {
    const prevVital = this.config.vitalSigns;
    this.config = nextConfig;
    const { layers, systems, sex, cutaway, selectedId, hoveredId } = nextConfig;

    if (immediate) {
      this.currentExplode = nextConfig.explode / 100;
    }

    const ex = this.currentExplode;

    Object.values(this.items).forEach((it) => {
      if (!it.hasMesh) {
        it.group.visible = false;
        return;
      }

      const s = it.record;
      const sysKey = getCatalogSystem(s);
      const layerState = layers[s.layer];
      const sexOk = !s.sex || sex === 'all' || s.sex === sex;
      const baseVis =
        layerState.on && systems[sysKey] !== false && sexOk && it.visibleOverride;

      // Cutaway check for whole-part sidedness
      const hidePartByCutaway =
        (cutaway === 'left' && it.side === 'left' && (s.layer === 'pel' || s.layer === 'msu' || s.layer === 'fas' || s.id.startsWith('equ.ske.cos.'))) ||
        (cutaway === 'right' && it.side === 'right' && (s.layer === 'pel' || s.layer === 'msu' || s.layer === 'fas' || s.id.startsWith('equ.ske.cos.')));

      it.group.visible = baseVis && !hidePartByCutaway;

      // Per-child side cutaway (for bilateral single records like Piel or Masetero)
      if (it.group.visible) {
        it.group.traverse((ch) => {
          if (ch !== it.group && ch.userData.side) {
            const hideChild =
              (cutaway === 'left' && ch.userData.side === 'left' && (s.layer === 'pel' || s.layer === 'msu')) ||
              (cutaway === 'right' && ch.userData.side === 'right' && (s.layer === 'pel' || s.layer === 'msu'));
            ch.visible = !hideChild;
          }
        });
      }

      // Exploded position
      this.applyItemExplosion(it, ex);

      // Opacity, selection & hover highlight
      const op = layerState.op / 100;
      const isSel = selectedId === s.id;
      const isHov = hoveredId === s.id;

      it.materials.forEach((m) => {
        m.opacity = isSel ? Math.max(op, 0.88) : op;
        m.depthWrite = op > 0.85;
        if (isSel) {
          m.emissive.setHex(0x14b8a6);
          m.emissiveIntensity = 0.65;
        } else if (isHov) {
          m.emissive.setHex(0xf59e0b);
          m.emissiveIntensity = 0.35;
        } else {
          m.emissive.setHex(s.layer === 'ner' ? 0x3a2800 : 0x000000);
          m.emissiveIntensity = s.layer === 'ner' ? 0.22 : 0;
        }
      });
    });

    const needsContinuous =
      nextConfig.vitalSigns ||
      Math.abs(this.currentExplode - nextConfig.explode / 100) > 0.002 ||
      this.cameraAnimating;

    if (needsContinuous || prevVital !== nextConfig.vitalSigns) {
      this.startLoopIfActive();
    } else {
      this.requestRender();
    }
  }

  private applyItemExplosion(it: SceneItemRuntime, ex: number): void {
    const layerIdx = LAYER_ORDER[it.record.layer] ?? 4;
    // Outward lateral separation based on anatomical side + layer depth
    const sideSign = it.side === 'left' ? -1 : it.side === 'right' ? 1 : 0;
    const lateralLayerFactor = (9 - layerIdx) * 0.065; // outer layers move farther out
    const zOffset = sideSign * ex * (0.18 + lateralLayerFactor);
    const yOffset = (layerIdx === 0 ? 0.14 : layerIdx <= 3 ? 0.06 : 0) * ex;

    it.group.position.set(
      it.explodeDir.x * ex * 0.16,
      it.explodeDir.y * ex * 0.12 + yOffset,
      zOffset,
    );
  }

  private bindEvents(): void {
    const dom = this.renderer.domElement;

    this.controls.addEventListener('start', () => {
      this.cameraAnimating = false;
    });
    this.controls.addEventListener('change', () => {
      this.requestRender();
    });

    dom.addEventListener('pointerdown', this.onPointerDown);
    dom.addEventListener('pointermove', this.onPointerMove);
    dom.addEventListener('pointerup', this.onPointerUp);
    dom.addEventListener('dblclick', this.onDoubleClick);
    dom.addEventListener('webglcontextlost', this.onContextLost);
    dom.addEventListener('webglcontextrestored', this.onContextRestored);
    window.addEventListener('resize', this.onResize);
  }

  private onContextLost = (e: Event): void => {
    e.preventDefault();
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.callbacks.onContextLost(true);
  };

  private onContextRestored = (): void => {
    this.callbacks.onContextLost(false);
    this.requestRender();
  };

  private onResize = (): void => {
    if (this.disposed) return;
    const w = Math.max(this.container.clientWidth, 1);
    const h = Math.max(this.container.clientHeight, 1);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.requestRender();
  };

  private updatePointerNDC(e: PointerEvent | MouseEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private pickStructureId(e: PointerEvent | MouseEvent): string | null {
    this.updatePointerNDC(e);
    this.raycaster.setFromCamera(this.pointerNDC, this.camera);
    const hits = this.raycaster.intersectObjects(this.clickableMeshes, false);
    for (const hit of hits) {
      let cur: THREE.Object3D | null = hit.object;
      let visible = true;
      while (cur) {
        if (!cur.visible) {
          visible = false;
          break;
        }
        cur = cur.parent;
      }
      if (!visible) continue;
      const id = hit.object.userData.id as string | undefined;
      if (id && this.items[id]?.group.visible) {
        return id;
      }
    }
    return null;
  }

  private onPointerDown = (e: PointerEvent): void => {
    this.pointerDownPos = [e.clientX, e.clientY];
  };

  private onPointerMove = (e: PointerEvent): void => {
    const now = performance.now();
    if (now - this.lastHoverCheck < 45) return;
    this.lastHoverCheck = now;
    if (e.buttons !== 0) return;

    const hitId = this.pickStructureId(e);
    this.renderer.domElement.style.cursor = hitId ? 'pointer' : 'grab';
    if (hitId !== this.config.hoveredId) {
      this.callbacks.onHover(hitId, e.clientX, e.clientY);
    } else if (hitId) {
      this.callbacks.onHover(hitId, e.clientX, e.clientY);
    }
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (!this.pointerDownPos) return;
    const dist = Math.hypot(e.clientX - this.pointerDownPos[0], e.clientY - this.pointerDownPos[1]);
    this.pointerDownPos = null;
    if (dist > 5) return;

    const hitId = this.pickStructureId(e);
    this.callbacks.onSelect(hitId);
  };

  private onDoubleClick = (e: MouseEvent): void => {
    const hitId = this.pickStructureId(e);
    if (hitId) {
      this.callbacks.onSelect(hitId);
      this.focusOnStructure(hitId);
    }
  };

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || !gl.fenceSync) {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) {
        if (sync) gl.deleteSync(sync);
        return;
      }
      const state = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  public requestRender(): void {
    if (this.disposed) return;
    if (this.renderBusy) {
      this.renderDirty = true;
      return;
    }
    this.renderBusy = true;
    this.frameId = requestAnimationFrame(() => {
      if (this.disposed) return;
      this.renderDirty = false;
      const now = performance.now();
      const dt = Math.min((now - this.lastTime) / 1000, 0.1);
      this.lastTime = now;

      const stillMoving = this.stepTransitions(dt);
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
      this.emitLabels(now);

      const done = () => {
        this.renderBusy = false;
        if (this.disposed) return;
        if (stillMoving || this.renderDirty) {
          this.requestRender();
        }
      };

      if (this.isSoftwareGl) this.afterDraw(done);
      else done();
    });
  }

  private startLoopIfActive(): void {
    this.requestRender();
  }

  private stepTransitions(dt: number): boolean {
    let active = false;

    // 1. Explode layer damping
    const targetEx = this.config.explode / 100;
    if (Math.abs(this.currentExplode - targetEx) > 0.0015) {
      this.currentExplode = THREE.MathUtils.damp(this.currentExplode, targetEx, 7.5, dt);
      Object.values(this.items).forEach((it) => {
        if (it.hasMesh && it.group.visible) {
          this.applyItemExplosion(it, this.currentExplode);
        }
      });
      active = true;
    } else if (this.currentExplode !== targetEx) {
      this.currentExplode = targetEx;
    }

    // 2. Camera preset / focus damping
    if (this.cameraAnimating) {
      const posDist = this.camera.position.distanceTo(_camPosTarget);
      const tgtDist = this.controls.target.distanceTo(_camLookTarget);
      if (posDist > 0.006 || tgtDist > 0.006) {
        const alpha = 1 - Math.exp(-7 * dt);
        this.camera.position.lerp(_camPosTarget, alpha);
        this.controls.target.lerp(_camLookTarget, alpha);
        active = true;
      } else {
        this.camera.position.copy(_camPosTarget);
        this.controls.target.copy(_camLookTarget);
        this.cameraAnimating = false;
      }
    }

    // 3. Subtle equine physiological vital signs (~38 BPM heartbeat & ~14 breaths/min)
    if (this.config.vitalSigns) {
      this.vitalClock += dt;
      // Resting equine heart rate ~38 bpm -> 0.63 Hz
      const beatPhase = (this.vitalClock * 0.63) % 1;
      const pulse =
        Math.exp(-Math.pow((beatPhase - 0.12) / 0.05, 2)) * 0.055 +
        Math.exp(-Math.pow((beatPhase - 0.28) / 0.06, 2)) * 0.03;
      if (this.heartGroup) {
        this.heartGroup.scale.setScalar(1 + pulse);
      }
      // Resting equine breathing ~14 breaths/min -> 0.23 Hz
      const breath = 1 + Math.sin(this.vitalClock * 0.23 * Math.PI * 2) * 0.025;
      for (const lg of this.lungGroups) {
        lg.scale.set(1 + (breath - 1) * 0.4, breath, breath);
      }
      active = true;
    } else {
      if (this.heartGroup && this.heartGroup.scale.x !== 1) this.heartGroup.scale.setScalar(1);
      for (const lg of this.lungGroups) {
        if (lg.scale.y !== 1) lg.scale.set(1, 1, 1);
      }
    }

    return active;
  }

  private emitLabels(now: number): void {
    if (now - this.lastLabelEmit < 75) return;
    this.lastLabelEmit = now;

    if (this.config.blindMode || (!this.config.showLabels && !this.config.selectedId)) {
      this.callbacks.onLabelsUpdate([]);
      return;
    }

    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    const distToTarget = this.camera.position.distanceTo(this.controls.target);
    const showAuto = this.config.showLabels && distToTarget < 3.4;

    const candidates: Array<{ distFromCenter: number; label: ScreenLabel }> = [];
    const out: ScreenLabel[] = [];

    for (const it of Object.values(this.items)) {
      if (!it.hasMesh || !it.group.visible) continue;
      const isSel = this.config.selectedId === it.record.id;
      if (!isSel && !showAuto) continue;

      _v3b.copy(it.center).add(it.group.position);
      _proj.copy(_v3b).project(this.camera);
      if (_proj.z >= 1 || _proj.z < -1) continue;
      if (Math.abs(_proj.x) > 0.96 || Math.abs(_proj.y) > 0.92) continue;

      const label: ScreenLabel = {
        id: it.record.id,
        es: it.record.es,
        la: it.record.la,
        x: ((_proj.x + 1) / 2) * w,
        y: ((1 - _proj.y) / 2) * h,
        selected: isSel,
      };

      if (isSel) {
        out.push(label);
      } else {
        candidates.push({ distFromCenter: Math.hypot(_proj.x, _proj.y), label });
      }
    }

    if (showAuto && candidates.length > 0) {
      candidates.sort((a, b) => a.distFromCenter - b.distFromCenter);
      for (let i = 0; i < Math.min(4, candidates.length); i++) {
        out.push(candidates[i].label);
      }
    }

    this.callbacks.onLabelsUpdate(out);
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    const dom = this.renderer.domElement;
    dom.removeEventListener('pointerdown', this.onPointerDown);
    dom.removeEventListener('pointermove', this.onPointerMove);
    dom.removeEventListener('pointerup', this.onPointerUp);
    dom.removeEventListener('dblclick', this.onDoubleClick);
    dom.removeEventListener('webglcontextlost', this.onContextLost);
    dom.removeEventListener('webglcontextrestored', this.onContextRestored);
    window.removeEventListener('resize', this.onResize);

    this.scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        m.geometry?.dispose();
        if (Array.isArray(m.material)) {
          m.material.forEach((mat) => mat.dispose());
        } else {
          m.material?.dispose();
        }
      }
    });

    this.textures.dispose();
    this.envRT?.dispose();
    this.controls.dispose();
    this.renderer.dispose();
    if (dom.parentNode === this.container) {
      this.container.removeChild(dom);
    }
  }
}
