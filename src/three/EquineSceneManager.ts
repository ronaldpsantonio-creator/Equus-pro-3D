import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  CutawayMode,
  getCatalogSystem,
  LAYERS,
  LayerCode,
  LayerState,
  LoadedModelMeta,
  MeasurementRecord,
  MeasurePoint,
  MeasureToolMode,
  MeasureUnit,
  ModelManifest,
  MprSliceState,
  ReferencePlaneConfig,
  RenderViewMode,
  SceneTheme,
  ScreenLabel,
  ScreenMeasurementBadge,
  SexFilter,
  StructureRecord,
  SystemCode,
} from '../types/proclavet';
import { buildMuscularAndTegumentaryParts } from './builders/buildMuscularAndTegumentary';
import { buildSkeletalAndArticularParts, BuiltPart } from './builders/buildSkeletalAndArticular';
import { buildVisceraAndNeuroParts } from './builders/buildVisceraAndNeuro';
import { MeasurementOverlayManager } from './measurementOverlay';
import { createProceduralTextures, ProceduralTextureSet } from './textures';

interface MeshMaterialBackup {
  mesh: THREE.Mesh;
  original: THREE.Material | THREE.Material[];
}

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
  meshBackups: MeshMaterialBackup[];
  xrayMaterials: THREE.ShaderMaterial[];
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
  renderMode: RenderViewMode;
  sceneTheme: SceneTheme;
  mpr: MprSliceState;
}

export interface SceneCallbacks {
  onSelect: (id: string | null) => void;
  onHover: (id: string | null, x: number, y: number) => void;
  onLabelsUpdate: (labels: ScreenLabel[]) => void;
  onMeasurePick?: (point: [number, number, number], structureId?: string) => void;
  onMeasureBadgesUpdate?: (badges: ScreenMeasurementBadge[]) => void;
  onContextLost: (lost: boolean) => void;
}

// Reusable scratch objects to keep render loop GC-free
const _v3 = new THREE.Vector3();
const _v3b = new THREE.Vector3();
const _proj = new THREE.Vector3();
const _rayFloorHit = new THREE.Vector3();
const _floorMeasurePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _camPosTarget = new THREE.Vector3(2.45, 1.55, -2.55);
const _camLookTarget = new THREE.Vector3(0.1, 0.95, 0);

const LAYER_ORDER: Record<LayerCode, number> = Object.fromEntries(
  LAYERS.map((l, idx) => [l.code, idx]),
) as Record<LayerCode, number>;

const XRAY_VERTEX_SHADER = `
#include <common>
#include <clipping_planes_pars_vertex>
varying vec3 vNormalView;
varying vec3 vViewPos;
void main() {
  #include <begin_vertex>
  #include <project_vertex>
  #include <clipping_planes_vertex>
  vNormalView = normalize(normalMatrix * normal);
  vViewPos = -mvPosition.xyz;
}
`;

const XRAY_FRAGMENT_SHADER = `
#include <common>
#include <clipping_planes_pars_fragment>
uniform vec3 uColor;
uniform float uDensity;
uniform float uOpacity;
uniform float uSelected;
uniform float uHovered;
varying vec3 vNormalView;
varying vec3 vViewPos;
void main() {
  #include <clipping_planes_fragment>
  vec3 V = normalize(vViewPos);
  float ndotv = abs(dot(normalize(vNormalView), V));
  float rim = pow(1.0 - clamp(ndotv, 0.0, 1.0), 1.45);
  float core = mix(0.08, 0.42, uDensity) * (0.35 + 0.65 * ndotv);
  float intensity = clamp(core + rim * (0.48 + 0.52 * uDensity), 0.04, 1.0);
  vec3 highlight = mix(uColor, vec3(0.10, 0.92, 0.80), uSelected * 0.72);
  highlight = mix(highlight, vec3(0.96, 0.65, 0.14), uHovered * 0.55 * (1.0 - uSelected));
  float alpha = clamp(intensity * uOpacity * (0.28 + 0.72 * uDensity), 0.03, 0.95);
  gl_FragColor = vec4(highlight * (0.72 + 0.68 * rim), alpha);
}
`;

function getXraySpecForLayer(layer: LayerCode): { color: number; density: number } {
  switch (layer) {
    case 'oss':
      return { color: 0xeaf4ff, density: 1.0 };
    case 'art':
      return { color: 0xbae6fd, density: 0.6 };
    case 'org':
    case 'vas':
      return { color: 0x7dd3fc, density: 0.36 };
    case 'ner':
      return { color: 0xfde047, density: 0.32 };
    case 'msu':
    case 'mpr':
    case 'fas':
      return { color: 0x60a5fa, density: 0.22 };
    case 'pel':
    case 'cav':
    default:
      return { color: 0x38bdf8, density: 0.12 };
  }
}

function getCtColorForLayer(layer: LayerCode, baseHex: number): number {
  switch (layer) {
    case 'oss':
      return 0xf8fafc;
    case 'art':
      return 0x7dd3fc;
    case 'vas':
      return 0xef4444;
    case 'ner':
      return 0xfacc15;
    case 'org':
      return 0xcbd5e1;
    case 'msu':
    case 'mpr':
      return 0x94a3b8;
    case 'fas':
    case 'pel':
      return 0x475569;
    default:
      return baseHex;
  }
}

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
  private dracoLoader: DRACOLoader;
  private gltfLoader: GLTFLoader;
  private textureLoader = new THREE.TextureLoader();

  private floorGroup: THREE.Group | null = null;
  private floorMat: THREE.MeshStandardMaterial | null = null;
  private floorShadowMat: THREE.MeshBasicMaterial | null = null;
  private gridDark: THREE.GridHelper | null = null;
  private gridLight: THREE.GridHelper | null = null;
  private hemiLight: THREE.HemisphereLight;
  private keyLight: THREE.DirectionalLight;
  private rimLight: THREE.DirectionalLight;

  private bgStandard = new THREE.Color(0x0c1118);
  private bgAtlas = new THREE.Color(0xe8edf3);
  private bgXray = new THREE.Color(0x04070c);
  private bgCt = new THREE.Color(0x070b11);

  // MPR CT-style clipping planes & visual slice guides
  private sagittalPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0.45);
  private transversePlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 1.65);
  private dorsalPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 2.05);
  private activeClippingPlanes: THREE.Plane[] = [];
  private lastClipCount = 0;
  private lastRenderMode: RenderViewMode = 'anatomico';
  private lastSceneTheme: SceneTheme = 'oscuro';

  private sagittalGuide: THREE.LineLoop;
  private transverseGuide: THREE.LineLoop;
  private dorsalGuide: THREE.LineLoop;

  // Calibrated Radiographic / CT Reference Plane
  private referenceGroup: THREE.Group;
  private referenceMesh: THREE.Mesh;
  private referenceFrame: THREE.LineLoop;
  private referenceMat: THREE.MeshBasicMaterial;
  private referenceTexture: THREE.Texture | null = null;
  private currentRefUrl: string | null = null;
  private referenceAspect = 1.4;

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

  // 3D Ruler & Articular Goniometer state
  private measurementOverlay: MeasurementOverlayManager;
  private measureMode: MeasureToolMode = 'none';
  private measureUnit: MeasureUnit = 'cm';
  private measurements: MeasurementRecord[] = [];
  private draftPoints: MeasurePoint[] = [];
  private measureHoverPos: THREE.Vector3 | null = null;
  private measureHoverTemp = new THREE.Vector3();

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
    this.renderer.localClippingEnabled = true;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.touchAction = 'none';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = this.bgStandard.clone();
    this.scene.fog = new THREE.FogExp2(0x0c1118, 0.055);

    this.camera = new THREE.PerspectiveCamera(40, width / height, 0.05, 60);
    this.camera.position.copy(_camPosTarget);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.copy(_camLookTarget);
    this.controls.enableDamping = !this.isSoftwareGl;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 0.45;
    this.controls.maxDistance = 8.5;
    this.controls.maxPolarAngle = Math.PI * 0.52;
    this.controls.update();

    // Local offline Draco decoder for CT-segmented .glb models
    this.dracoLoader = new DRACOLoader();
    this.dracoLoader.setDecoderPath(`${import.meta.env.BASE_URL}draco/`);
    this.gltfLoader = new GLTFLoader();
    this.gltfLoader.setDRACOLoader(this.dracoLoader);

    // Procedural Studio Environment Map
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this.envRT.texture;
    pmrem.dispose();

    // 3-Point Warm/Cool Studio Lighting
    this.hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x1e293b, 0.76);
    this.scene.add(this.hemiLight);

    this.keyLight = new THREE.DirectionalLight(0xfff4e0, 1.55);
    this.keyLight.position.set(3.2, 4.8, -3.5);
    this.keyLight.castShadow = !this.isSoftwareGl;
    const shadowRes = this.isSoftwareGl ? 1024 : 2048;
    this.keyLight.shadow.mapSize.set(shadowRes, shadowRes);
    this.keyLight.shadow.camera.near = 0.5;
    this.keyLight.shadow.camera.far = 14;
    const d = 2.4;
    this.keyLight.shadow.camera.left = -d;
    this.keyLight.shadow.camera.right = d;
    this.keyLight.shadow.camera.top = d;
    this.keyLight.shadow.camera.bottom = -d;
    this.keyLight.shadow.bias = -0.0005;
    this.keyLight.shadow.normalBias = 0.02;
    this.scene.add(this.keyLight);

    this.rimLight = new THREE.DirectionalLight(0x93c5fd, 0.68);
    this.rimLight.position.set(-3.5, 2.8, 3.2);
    this.scene.add(this.rimLight);

    // Procedural textures
    this.textures = createProceduralTextures(this.renderer.capabilities.getMaxAnisotropy());

    // Studio floor at Y = 0
    this.buildStudioFloor();

    // MPR slice visual indicator frames
    this.sagittalGuide = this.createSliceGuideRect(3.3, 2.1, 0x22d3ee);
    this.sagittalGuide.position.set(0.1, 1.05, 0);
    this.transverseGuide = this.createSliceGuideRect(1.0, 2.1, 0xf59e0b);
    this.transverseGuide.rotation.y = Math.PI / 2;
    this.transverseGuide.position.set(0, 1.05, 0);
    this.dorsalGuide = this.createSliceGuideRect(3.3, 1.0, 0x34d399);
    this.dorsalGuide.rotation.x = Math.PI / 2;
    this.dorsalGuide.position.set(0.1, 1.0, 0);
    this.scene.add(this.sagittalGuide, this.transverseGuide, this.dorsalGuide);

    // Calibrated Radiographic / CT Reference Plane
    this.referenceGroup = new THREE.Group();
    this.referenceGroup.visible = false;
    this.referenceMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.78,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.referenceMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.referenceMat);
    const frameGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-0.5, -0.5, 0),
      new THREE.Vector3(0.5, -0.5, 0),
      new THREE.Vector3(0.5, 0.5, 0),
      new THREE.Vector3(-0.5, 0.5, 0),
    ]);
    this.referenceFrame = new THREE.LineLoop(
      frameGeo,
      new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.55 }),
    );
    this.referenceGroup.add(this.referenceMesh, this.referenceFrame);
    this.scene.add(this.referenceGroup);

    // 3D Ruler & Articular Goniometer Overlay
    this.measurementOverlay = new MeasurementOverlayManager();
    this.scene.add(this.measurementOverlay.group);

    // Events
    this.bindEvents();
  }

  private createSliceGuideRect(w: number, h: number, color: number): THREE.LineLoop {
    const hw = w * 0.5;
    const hh = h * 0.5;
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-hw, -hh, 0),
      new THREE.Vector3(hw, -hh, 0),
      new THREE.Vector3(hw, hh, 0),
      new THREE.Vector3(-hw, hh, 0),
    ]);
    const mat = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.55,
    });
    const loop = new THREE.LineLoop(geo, mat);
    loop.visible = false;
    return loop;
  }

  private buildStudioFloor(): void {
    const fg = new THREE.Group();
    const shadowMat = new THREE.MeshBasicMaterial({
      map: this.textures.floorShadow,
      transparent: true,
      depthWrite: false,
      opacity: 0.78,
    });
    this.floorShadowMat = shadowMat;
    const shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.2), shadowMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.set(-0.05, 0.002, 0);
    shadowPlane.renderOrder = 1;
    fg.add(shadowPlane);

    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0f1621,
      roughness: 0.88,
      metalness: 0.08,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
    this.floorMat = floorMat;
    const floor = new THREE.Mesh(new THREE.CircleGeometry(14, 48), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    floor.receiveShadow = true;
    fg.add(floor);

    const gridDark = new THREE.GridHelper(8, 16, 0x334155, 0x1e293b);
    gridDark.position.y = 0.001;
    (gridDark.material as THREE.Material).transparent = true;
    (gridDark.material as THREE.Material).opacity = 0.35;
    this.gridDark = gridDark;
    fg.add(gridDark);

    const gridLight = new THREE.GridHelper(8, 16, 0x94a3b8, 0xcbd5e1);
    gridLight.position.y = 0.001;
    (gridLight.material as THREE.Material).transparent = true;
    (gridLight.material as THREE.Material).opacity = 0.42;
    gridLight.visible = false;
    this.gridLight = gridLight;
    fg.add(gridLight);

    this.floorGroup = fg;
    this.scene.add(fg);
  }

  private buildXrayMaterialForLayer(layer: LayerCode): THREE.ShaderMaterial {
    const spec = getXraySpecForLayer(layer);
    return new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(spec.color) },
        uDensity: { value: spec.density },
        uOpacity: { value: 1.0 },
        uSelected: { value: 0.0 },
        uHovered: { value: 0.0 },
      },
      vertexShader: XRAY_VERTEX_SHADER,
      fragmentShader: XRAY_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      clipping: true,
    });
  }

  private captureMeshMaterialsForItem(
    group: THREE.Group,
    id: string,
    layer: LayerCode,
    cloneStandardMaterials: boolean,
  ): {
    mats: THREE.MeshStandardMaterial[];
    baseColorHex: number[];
    meshBackups: MeshMaterialBackup[];
    xrayMaterials: THREE.ShaderMaterial[];
  } {
    const mats: THREE.MeshStandardMaterial[] = [];
    const baseColorHex: number[] = [];
    const meshBackups: MeshMaterialBackup[] = [];
    const xrayMaterials: THREE.ShaderMaterial[] = [];

    group.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        if (Array.isArray(m.material)) {
          m.material = m.material.map((mm) => {
            const mat = cloneStandardMaterials ? mm.clone() : mm;
            mat.transparent = true;
            if (mat instanceof THREE.MeshStandardMaterial) {
              mats.push(mat);
              baseColorHex.push(mat.color.getHex());
            }
            return mat;
          });
        } else if (m.material instanceof THREE.MeshStandardMaterial) {
          const mat = cloneStandardMaterials
            ? (m.material.clone() as THREE.MeshStandardMaterial)
            : m.material;
          mat.transparent = true;
          m.material = mat;
          mats.push(mat);
          baseColorHex.push(mat.color.getHex());
        } else {
          const fallbackMat = new THREE.MeshStandardMaterial({
            color: 0xe2dcd0,
            roughness: 0.55,
            transparent: true,
          });
          m.material = fallbackMat;
          mats.push(fallbackMat);
          baseColorHex.push(fallbackMat.color.getHex());
        }

        meshBackups.push({ mesh: m, original: m.material });
        const xrayMat = this.buildXrayMaterialForLayer(layer);
        xrayMaterials.push(xrayMat);

        m.userData.id = id;
        m.castShadow = true;
        m.receiveShadow = true;
        this.clickableMeshes.push(m);
      }
    });

    return { mats, baseColorHex, meshBackups, xrayMaterials };
  }

  public populateCatalog(structures: StructureRecord[]): {
    mounted3DCount: number;
    matchedIds: Set<string>;
  } {
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

      const { mats, baseColorHex, meshBackups, xrayMaterials } = this.captureMeshMaterialsForItem(
        group,
        s.id,
        s.layer,
        true,
      );

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
        meshBackups,
        xrayMaterials,
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

  public getLoadedGlbCount(): number {
    let count = 0;
    for (const it of Object.values(this.items)) {
      if (it.state === 'cargado') count++;
    }
    return count;
  }

  public getMounted3DCount(): number {
    let count = 0;
    for (const it of Object.values(this.items)) {
      if (it.hasMesh) count++;
    }
    return count;
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

  public getHiddenStructureCount(): number {
    let count = 0;
    for (const it of Object.values(this.items)) {
      if (it.hasMesh && !it.visibleOverride) count++;
    }
    return count;
  }

  public getHiddenStructureIds(): string[] {
    const out: string[] = [];
    for (const it of Object.values(this.items)) {
      if (it.hasMesh && !it.visibleOverride) out.push(it.record.id);
    }
    return out;
  }

  public setHiddenStructureIds(hiddenIds: string[]): void {
    const hiddenSet = new Set(hiddenIds);
    Object.values(this.items).forEach((it) => {
      it.visibleOverride = !hiddenSet.has(it.record.id);
    });
    this.applyVisualConfig(this.config, true);
    this.requestRender();
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
    const dist = THREE.MathUtils.clamp(offset.length(), 0.75, 2.2);
    offset.normalize().multiplyScalar(dist);
    _camLookTarget.copy(worldCenter);
    _camPosTarget.copy(worldCenter).add(offset);
    this.cameraAnimating = true;
    this.startLoopIfActive();
  }

  public focusOnPoint(pos: [number, number, number]): void {
    const targetPt = new THREE.Vector3(pos[0], pos[1], pos[2]);
    const offset = this.camera.position.clone().sub(this.controls.target);
    const dist = THREE.MathUtils.clamp(offset.length(), 0.75, 2.4);
    offset.normalize().multiplyScalar(dist);
    _camLookTarget.copy(targetPt);
    _camPosTarget.copy(targetPt).add(offset);
    this.cameraAnimating = true;
    this.startLoopIfActive();
  }

  public setMeasurementState(
    mode: MeasureToolMode,
    unit: MeasureUnit,
    measurements: MeasurementRecord[],
    draftPoints: MeasurePoint[],
  ): void {
    this.measureMode = mode;
    this.measureUnit = unit;
    this.measurements = measurements;
    this.draftPoints = draftPoints;
    if (mode === 'none') {
      this.measureHoverPos = null;
    }
    this.measurementOverlay.syncSavedAndDraft(measurements, draftPoints, mode);
    this.measurementOverlay.updateHoverPreview(this.measureHoverPos, draftPoints, mode);
    this.emitMeasureBadges();
    this.requestRender();
  }

  public setReferencePlane(cfg: ReferencePlaneConfig): void {
    if (!cfg.visible || !cfg.imageUrl) {
      this.referenceGroup.visible = false;
      this.requestRender();
      return;
    }

    const applyTransform = () => {
      const baseH = 2.25 * cfg.scale;
      const w = baseH * this.referenceAspect;
      this.referenceMesh.scale.set(w, baseH, 1);
      this.referenceFrame.scale.set(w, baseH, 1);
      this.referenceMat.opacity = THREE.MathUtils.clamp(cfg.opacity / 100, 0.05, 1);

      if (cfg.projection === 'LM') {
        this.referenceGroup.rotation.set(0, 0, 0);
        this.referenceGroup.position.set(0.18 + cfg.offsetX, 1.12 + cfg.offsetY, 0.62);
      } else if (cfg.projection === 'DP') {
        this.referenceGroup.rotation.set(0, Math.PI / 2, 0);
        this.referenceGroup.position.set(-1.55, 1.12 + cfg.offsetY, cfg.offsetX);
      } else {
        this.referenceGroup.rotation.set(-Math.PI / 2, 0, 0);
        this.referenceGroup.position.set(0.15 + cfg.offsetX, 0.018, cfg.offsetY);
      }
      this.referenceGroup.visible = true;
      this.requestRender();
    };

    if (this.currentRefUrl === cfg.imageUrl && this.referenceTexture) {
      applyTransform();
      return;
    }

    this.currentRefUrl = cfg.imageUrl;
    this.textureLoader.load(
      cfg.imageUrl,
      (tex) => {
        if (this.disposed) {
          tex.dispose();
          return;
        }
        this.referenceTexture?.dispose();
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = Math.min(this.renderer.capabilities.getMaxAnisotropy() || 1, 8);
        this.referenceTexture = tex;
        this.referenceMat.map = tex;
        this.referenceMat.needsUpdate = true;
        const img = tex.image as { width?: number; height?: number } | undefined;
        if (img?.width && img?.height) {
          this.referenceAspect = img.width / img.height;
        } else {
          this.referenceAspect = 1.4;
        }
        applyTransform();
      },
      undefined,
      () => {
        this.referenceGroup.visible = false;
        this.requestRender();
      },
    );
  }

  private replaceItemWithGlbScene(
    id: string,
    gltfScene: THREE.Group,
    autoFitIsolated: boolean,
  ): void {
    const it = this.items[id];
    if (!it) return;

    const hadProcedural = it.hasMesh && it.group.children.length > 0;
    let prevCenter: THREE.Vector3 | null = null;
    let prevMaxDim = 0;
    if (hadProcedural) {
      const prevBox = new THREE.Box3().setFromObject(it.group);
      if (!prevBox.isEmpty()) {
        prevCenter = prevBox.getCenter(new THREE.Vector3());
        const prevSize = prevBox.getSize(new THREE.Vector3());
        prevMaxDim = Math.max(prevSize.x, prevSize.y, prevSize.z);
      }
    }

    this.clickableMeshes = this.clickableMeshes.filter((m) => m.userData.id !== id);
    it.xrayMaterials.forEach((xm) => xm.dispose());

    while (it.group.children.length > 0) {
      const ch = it.group.children[0];
      ch.traverse((obj) => {
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
      it.group.remove(ch);
    }

    if (autoFitIsolated && prevCenter && prevMaxDim > 0.005) {
      const rawBox = new THREE.Box3().setFromObject(gltfScene);
      if (!rawBox.isEmpty()) {
        const rawCenter = rawBox.getCenter(new THREE.Vector3());
        const rawSize = rawBox.getSize(new THREE.Vector3());
        const rawMaxDim = Math.max(rawSize.x, rawSize.y, rawSize.z);
        const looksOriginCentered =
          rawCenter.length() < 0.35 && prevCenter.distanceTo(rawCenter) > 0.45;
        const looksWrongUnits = rawMaxDim > 3.5 || (rawMaxDim > 0 && rawMaxDim < 0.015);
        if ((looksOriginCentered || looksWrongUnits) && rawMaxDim > 0.0001) {
          const scale = prevMaxDim / rawMaxDim;
          gltfScene.scale.multiplyScalar(scale);
          gltfScene.updateMatrixWorld(true);
          const scaledBox = new THREE.Box3().setFromObject(gltfScene);
          const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
          gltfScene.position.add(prevCenter.clone().sub(scaledCenter));
        }
      }
    }

    it.group.add(gltfScene);
    const captured = this.captureMeshMaterialsForItem(
      gltfScene,
      id,
      it.record.layer,
      true,
    );
    it.materials = captured.mats;
    it.baseColorHex = captured.baseColorHex;
    it.meshBackups = captured.meshBackups;
    it.xrayMaterials = captured.xrayMaterials;

    if (id === 'equ.car.cor.001') this.heartGroup = gltfScene;
    if (id.startsWith('equ.res.pul.001')) this.lungGroups.push(gltfScene);

    const box = new THREE.Box3().setFromObject(gltfScene);
    if (!box.isEmpty()) {
      box.getCenter(it.center);
    }
    const explodeDir = it.center.clone().sub(_v3.set(0.05, 1.05, 0));
    if (explodeDir.lengthSq() < 0.001) explodeDir.set(0, 0.2, 0);
    it.explodeDir.copy(explodeDir.normalize());

    if (!hadProcedural) {
      it.hasMesh = true;
    }
    it.state = 'cargado';
    this.applyVisualConfig(this.config, true);
    this.requestRender();
  }

  public async loadCustomGlb(id: string, file: File): Promise<LoadedModelMeta> {
    const it = this.items[id];
    if (!it) throw new Error('Estructura no encontrada');
    const url = URL.createObjectURL(file);
    try {
      const gltf = await new Promise<{ scene: THREE.Group }>((resolve, reject) => {
        this.gltfLoader.load(url, resolve, undefined, reject);
      });
      this.replaceItemWithGlbScene(id, gltf.scene, true);
      return {
        id,
        path: file.name,
        origin: 'local',
        licencia: it.record.licencia || 'Archivo local sin licencia declarada',
      };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  public async loadGlbFilesBatch(
    files: File[],
    byTraceabilityId: Record<string, StructureRecord>,
  ): Promise<{ loaded: LoadedModelMeta[]; unmatched: string[]; errors: string[] }> {
    const matchedTasks: Array<{ id: string; file: File }> = [];
    const unmatched: string[] = [];

    for (const file of files) {
      const baseName = file.name.replace(/\.glb$/i, '').trim();
      const targetId = this.items[baseName] ? baseName : byTraceabilityId[baseName]?.id;
      if (targetId && this.items[targetId]) {
        matchedTasks.push({ id: targetId, file });
      } else {
        unmatched.push(file.name);
      }
    }

    const loaded: LoadedModelMeta[] = [];
    const errors: string[] = [];
    const queue = [...matchedTasks];

    const worker = async () => {
      while (queue.length > 0 && !this.disposed) {
        const next = queue.shift();
        if (!next) break;
        try {
          const meta = await this.loadCustomGlb(next.id, next.file);
          loaded.push(meta);
        } catch {
          errors.push(next.file.name);
        }
      }
    };

    await Promise.all([worker(), worker()]);
    return { loaded, unmatched, errors };
  }

  public async loadManifestModels(
    byTraceabilityId: Record<string, StructureRecord>,
    onLoaded?: (meta: LoadedModelMeta) => void,
  ): Promise<LoadedModelMeta[]> {
    const manifestUrl = `${import.meta.env.BASE_URL}models/equino/manifest.json`;
    let manifest: ModelManifest | null = null;
    try {
      const res = await fetch(manifestUrl, { cache: 'no-cache' });
      if (!res.ok) return [];
      manifest = (await res.json()) as ModelManifest;
    } catch {
      return [];
    }

    const entries = Object.entries(manifest?.models || {});
    if (entries.length === 0) return [];

    const tasks: Array<{ id: string; url: string; meta: LoadedModelMeta }> = [];
    for (const [rawId, entry] of entries) {
      if (!entry?.path) continue;
      const targetId = this.items[rawId] ? rawId : byTraceabilityId[rawId]?.id;
      if (!targetId || !this.items[targetId]) continue;

      const resolvedUrl = /^https?:\/\//i.test(entry.path)
        ? entry.path
        : `${import.meta.env.BASE_URL}${entry.path.replace(/^\/+/, '')}`;

      tasks.push({
        id: targetId,
        url: resolvedUrl,
        meta: {
          id: targetId,
          path: entry.path,
          origin: 'repo',
          licencia: entry.licencia || this.items[targetId].record.licencia,
          fuente: entry.fuente || this.items[targetId].record.fuente,
          notas: entry.notas,
          modalidad_respaldo: entry.modalidad_respaldo,
          resolucion_corte: entry.resolucion_corte,
          proyeccion_referencia: entry.proyeccion_referencia,
          calibracion_anatomica: entry.calibracion_anatomica,
        },
      });
    }

    const loaded: LoadedModelMeta[] = [];
    const queue = [...tasks];

    const worker = async () => {
      while (queue.length > 0 && !this.disposed) {
        const task = queue.shift();
        if (!task) break;
        try {
          const gltf = await new Promise<{ scene: THREE.Group }>((resolve, reject) => {
            this.gltfLoader.load(task.url, resolve, undefined, reject);
          });
          if (this.disposed) break;
          this.replaceItemWithGlbScene(task.id, gltf.scene, false);
          loaded.push(task.meta);
          onLoaded?.(task.meta);
        } catch {
          // Skip unreadable GLB without blocking remaining models
        }
      }
    };

    await Promise.all([worker(), worker()]);
    return loaded;
  }

  public captureSnapshot(): string {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }

  public applyVisualConfig(nextConfig: SceneVisualConfig, immediate = false): void {
    const prevVital = this.config.vitalSigns;
    this.config = nextConfig;
    const { layers, systems, sex, cutaway, selectedId, hoveredId, renderMode, sceneTheme, mpr } =
      nextConfig;

    if (immediate) {
      this.currentExplode = nextConfig.explode / 100;
    }

    // Update scene backdrop, floor, & lighting balance for imaging mode / theme
    const modeChanged = renderMode !== this.lastRenderMode;
    const themeChanged = sceneTheme !== this.lastSceneTheme;
    this.lastRenderMode = renderMode;
    this.lastSceneTheme = sceneTheme;

    if (renderMode === 'radiografia') {
      this.scene.background = this.bgXray;
      if (this.scene.fog instanceof THREE.FogExp2) {
        this.scene.fog.color.copy(this.bgXray);
        this.scene.fog.density = 0.055;
      }
      if (this.floorGroup) this.floorGroup.visible = false;
      this.renderer.toneMappingExposure = 1.12;
    } else if (renderMode === 'tc') {
      this.scene.background = this.bgCt;
      if (this.scene.fog instanceof THREE.FogExp2) {
        this.scene.fog.color.copy(this.bgCt);
        this.scene.fog.density = 0.055;
      }
      if (this.floorGroup) this.floorGroup.visible = true;
      if (this.floorMat) this.floorMat.color.setHex(0x0f1621);
      if (this.floorShadowMat) this.floorShadowMat.opacity = 0.78;
      if (this.gridDark) this.gridDark.visible = true;
      if (this.gridLight) this.gridLight.visible = false;
      this.hemiLight.intensity = 0.76;
      this.hemiLight.color.setHex(0xdbeafe);
      this.hemiLight.groundColor.setHex(0x1e293b);
      this.keyLight.intensity = 1.55;
      this.rimLight.intensity = 0.68;
      this.renderer.toneMappingExposure = 1.12;
    } else if (sceneTheme === 'atlas') {
      this.scene.background = this.bgAtlas;
      if (this.scene.fog instanceof THREE.FogExp2) {
        this.scene.fog.color.copy(this.bgAtlas);
        this.scene.fog.density = 0.022;
      }
      if (this.floorGroup) this.floorGroup.visible = true;
      if (this.floorMat) this.floorMat.color.setHex(0xdfe5ee);
      if (this.floorShadowMat) this.floorShadowMat.opacity = 0.36;
      if (this.gridDark) this.gridDark.visible = false;
      if (this.gridLight) this.gridLight.visible = true;
      this.hemiLight.intensity = 0.92;
      this.hemiLight.color.setHex(0xffffff);
      this.hemiLight.groundColor.setHex(0xcbd5e1);
      this.keyLight.intensity = 1.42;
      this.rimLight.intensity = 0.72;
      this.renderer.toneMappingExposure = 1.05;
    } else {
      this.scene.background = this.bgStandard;
      if (this.scene.fog instanceof THREE.FogExp2) {
        this.scene.fog.color.copy(this.bgStandard);
        this.scene.fog.density = 0.055;
      }
      if (this.floorGroup) this.floorGroup.visible = true;
      if (this.floorMat) this.floorMat.color.setHex(0x0f1621);
      if (this.floorShadowMat) this.floorShadowMat.opacity = 0.78;
      if (this.gridDark) this.gridDark.visible = true;
      if (this.gridLight) this.gridLight.visible = false;
      this.hemiLight.intensity = 0.76;
      this.hemiLight.color.setHex(0xdbeafe);
      this.hemiLight.groundColor.setHex(0x1e293b);
      this.keyLight.intensity = 1.55;
      this.rimLight.intensity = 0.68;
      this.renderer.toneMappingExposure = 1.12;
    }
    void themeChanged;

    // Update MPR clipping planes & guide lines
    this.activeClippingPlanes.length = 0;
    if (mpr.sagittal.enabled) {
      this.sagittalPlane.constant = mpr.sagittal.value;
      this.activeClippingPlanes.push(this.sagittalPlane);
      this.sagittalGuide.position.z = mpr.sagittal.value;
      this.sagittalGuide.visible = true;
    } else {
      this.sagittalGuide.visible = false;
    }

    if (mpr.transverse.enabled) {
      this.transversePlane.constant = mpr.transverse.value;
      this.activeClippingPlanes.push(this.transversePlane);
      this.transverseGuide.position.x = mpr.transverse.value;
      this.transverseGuide.visible = true;
    } else {
      this.transverseGuide.visible = false;
    }

    if (mpr.dorsal.enabled) {
      this.dorsalPlane.constant = mpr.dorsal.value;
      this.activeClippingPlanes.push(this.dorsalPlane);
      this.dorsalGuide.position.y = mpr.dorsal.value;
      this.dorsalGuide.visible = true;
    } else {
      this.dorsalGuide.visible = false;
    }

    const clipCountChanged = this.activeClippingPlanes.length !== this.lastClipCount;
    this.lastClipCount = this.activeClippingPlanes.length;
    const clipPlanesForMat = this.activeClippingPlanes.length > 0 ? this.activeClippingPlanes : null;

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

      const hidePartByCutaway =
        (cutaway === 'left' &&
          it.side === 'left' &&
          (s.layer === 'pel' || s.layer === 'msu' || s.layer === 'fas' || s.id.startsWith('equ.ske.cos.'))) ||
        (cutaway === 'right' &&
          it.side === 'right' &&
          (s.layer === 'pel' || s.layer === 'msu' || s.layer === 'fas' || s.id.startsWith('equ.ske.cos.')));

      it.group.visible = baseVis && !hidePartByCutaway;

      if (it.group.visible) {
        it.group.traverse((ch) => {
          if (ch !== it.group && ch.userData.side) {
            const sliceable =
              s.layer === 'pel' || s.layer === 'msu' || s.layer === 'mpr' || s.layer === 'fas';
            const hideChild =
              (cutaway === 'left' && ch.userData.side === 'left' && sliceable) ||
              (cutaway === 'right' && ch.userData.side === 'right' && sliceable);
            ch.visible = !hideChild;
          }
        });
      }

      this.applyItemExplosion(it, ex);

      const op = layerState.op / 100;
      const isSel = selectedId === s.id;
      const isHov = hoveredId === s.id;

      if (renderMode === 'radiografia') {
        it.meshBackups.forEach((bk, idx) => {
          const xm = it.xrayMaterials[idx];
          if (xm) {
            if (bk.mesh.material !== xm) {
              bk.mesh.material = xm;
            }
            xm.uniforms.uOpacity.value = isSel ? Math.max(op, 0.92) : op;
            xm.uniforms.uSelected.value = isSel ? 1.0 : 0.0;
            xm.uniforms.uHovered.value = isHov ? 1.0 : 0.0;
            xm.clippingPlanes = clipPlanesForMat;
            if (clipCountChanged || modeChanged) xm.needsUpdate = true;
          }
        });
      } else {
        it.meshBackups.forEach((bk) => {
          if (bk.mesh.material !== bk.original) {
            bk.mesh.material = bk.original;
          }
        });

        it.materials.forEach((m, idx) => {
          const baseHex = it.baseColorHex[idx] ?? 0xe2dcd0;
          if (renderMode === 'tc') {
            m.color.setHex(getCtColorForLayer(s.layer, baseHex));
          } else {
            m.color.setHex(baseHex);
          }
          m.opacity = isSel ? Math.max(op, 0.88) : op;
          m.depthWrite = op > 0.85;
          m.clippingPlanes = clipPlanesForMat;
          m.clipShadows = true;
          if (clipCountChanged || modeChanged) m.needsUpdate = true;

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
      }
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
    const sideSign = it.side === 'left' ? -1 : it.side === 'right' ? 1 : 0;
    const lateralLayerFactor = (9 - layerIdx) * 0.065;
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

  private pickSurfaceHit(
    e: PointerEvent | MouseEvent,
    allowFloorFallback: boolean,
  ): { id: string | null; point: THREE.Vector3 } | null {
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
      // Ignore hits on the clipped-away half of active MPR planes
      let clippedOut = false;
      for (const plane of this.activeClippingPlanes) {
        if (plane.distanceToPoint(hit.point) < 0) {
          clippedOut = true;
          break;
        }
      }
      if (clippedOut) continue;

      const id = hit.object.userData.id as string | undefined;
      if (id && this.items[id]?.group.visible) {
        return { id, point: hit.point.clone() };
      }
    }

    if (allowFloorFallback && this.raycaster.ray.intersectPlane(_floorMeasurePlane, _rayFloorHit)) {
      if (Math.abs(_rayFloorHit.x) <= 2.3 && Math.abs(_rayFloorHit.z) <= 1.2) {
        return { id: null, point: _rayFloorHit.clone() };
      }
    }

    return null;
  }

  private pickStructureId(e: PointerEvent | MouseEvent): string | null {
    return this.pickSurfaceHit(e, false)?.id ?? null;
  }

  private onPointerDown = (e: PointerEvent): void => {
    this.pointerDownPos = [e.clientX, e.clientY];
  };

  private onPointerMove = (e: PointerEvent): void => {
    const now = performance.now();
    if (now - this.lastHoverCheck < 45) return;
    this.lastHoverCheck = now;
    if (e.buttons !== 0) return;

    if (this.measureMode !== 'none') {
      const hit = this.pickSurfaceHit(e, true);
      if (hit) {
        this.measureHoverTemp.copy(hit.point);
        this.measureHoverPos = this.measureHoverTemp;
        this.renderer.domElement.style.cursor = 'crosshair';
      } else {
        this.measureHoverPos = null;
        this.renderer.domElement.style.cursor = 'grab';
      }
      this.measurementOverlay.updateHoverPreview(
        this.measureHoverPos,
        this.draftPoints,
        this.measureMode,
      );
      this.emitMeasureBadges();
      this.requestRender();

      const hitId = hit?.id ?? null;
      if (hitId !== this.config.hoveredId || hitId) {
        this.callbacks.onHover(hitId, e.clientX, e.clientY);
      }
      return;
    }

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

    if (this.measureMode !== 'none') {
      const hit = this.pickSurfaceHit(e, true);
      if (hit) {
        this.callbacks.onMeasurePick?.(
          [hit.point.x, hit.point.y, hit.point.z],
          hit.id ?? undefined,
        );
      }
      return;
    }

    const hitId = this.pickStructureId(e);
    this.callbacks.onSelect(hitId);
  };

  private onDoubleClick = (e: MouseEvent): void => {
    if (this.measureMode !== 'none') return;
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

    if (this.config.vitalSigns) {
      this.vitalClock += dt;
      const beatPhase = (this.vitalClock * 0.63) % 1;
      const pulse =
        Math.exp(-Math.pow((beatPhase - 0.12) / 0.05, 2)) * 0.055 +
        Math.exp(-Math.pow((beatPhase - 0.28) / 0.06, 2)) * 0.03;
      if (this.heartGroup) {
        this.heartGroup.scale.setScalar(1 + pulse);
      }
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

  private emitMeasureBadges(): void {
    if (!this.callbacks.onMeasureBadgesUpdate) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w <= 0 || h <= 0) return;
    const badges = this.measurementOverlay.projectBadges(
      this.camera,
      w,
      h,
      this.measurements,
      this.draftPoints,
      this.measureHoverPos,
      this.measureMode,
      this.measureUnit,
    );
    this.callbacks.onMeasureBadgesUpdate(badges);
  }

  private emitLabels(now: number): void {
    if (now - this.lastLabelEmit < 75) return;
    this.lastLabelEmit = now;

    this.emitMeasureBadges();

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

    Object.values(this.items).forEach((it) => {
      it.xrayMaterials.forEach((xm) => xm.dispose());
    });

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

    this.sagittalGuide.geometry.dispose();
    (this.sagittalGuide.material as THREE.Material).dispose();
    this.transverseGuide.geometry.dispose();
    (this.transverseGuide.material as THREE.Material).dispose();
    this.dorsalGuide.geometry.dispose();
    (this.dorsalGuide.material as THREE.Material).dispose();
    this.referenceMesh.geometry.dispose();
    this.referenceFrame.geometry.dispose();
    (this.referenceFrame.material as THREE.Material).dispose();
    this.referenceMat.dispose();
    this.referenceTexture?.dispose();
    this.measurementOverlay.dispose();

    this.dracoLoader.dispose();
    this.textures.dispose();
    this.envRT?.dispose();
    this.controls.dispose();
    this.renderer.dispose();
    if (dom.parentNode === this.container) {
      this.container.removeChild(dom);
    }
  }
}
