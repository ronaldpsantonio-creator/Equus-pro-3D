export type SystemCode =
  | 'ske'
  | 'art'
  | 'mus'
  | 'dig'
  | 'res'
  | 'car'
  | 'ner'
  | 'uri'
  | 'rep'
  | 'teg'
  | 'end'
  | 'sen';

export type RawSystemCode = Exclude<SystemCode, 'art'>;

export type LayerCode =
  | 'pel'
  | 'fas'
  | 'msu'
  | 'mpr'
  | 'oss'
  | 'art'
  | 'vas'
  | 'ner'
  | 'org'
  | 'cav';

export type SexFilter = 'all' | 'm' | 'f';
export type CutawayMode = 'none' | 'left' | 'right';

export interface FichaData {
  ubicacion?: string;
  descripcion?: string;
  relaciones?: string;
  accidentes?: string;
  articulaciones?: string;
  inserciones?: string;
  irrigacion?: string;
  inervacion?: string;
  funcion?: string;
  especie?: string;
  clinica?: string;
  referencias?: string;
  [key: string]: string | undefined;
}

export interface PlaceholderSpec {
  p: [number, number, number];
  s: [number, number, number];
  c: number;
}

export interface StructureRecord {
  id: string;
  es: string;
  la: string;
  sys: RawSystemCode;
  layer: LayerCode;
  lateralidad?: string;
  sex?: 'm' | 'f';
  model?: string;
  licencia?: string;
  fuente?: string;
  ph?: PlaceholderSpec;
  ficha?: FichaData;
  trazabilidad_ids?: string[];
  historial_origen?: string;
  revision?: {
    estado?: string;
    fecha?: string;
    alcance?: string;
  };
  relacion_conceptual?: {
    tipo?: string;
    vinculada_a?: string;
    tratamiento?: string;
    [key: string]: unknown;
  };
  _catalog?: SystemCode;
}

export interface LoadedModelMeta {
  id: string;
  path: string;
  origin: 'repo' | 'local';
  licencia?: string;
  fuente?: string;
  notas?: string;
}

export interface ModelManifestEntry {
  path: string;
  licencia?: string;
  fuente?: string;
  notas?: string;
  archivo_original_id?: string;
}

export interface ModelManifest {
  version: number;
  models: Record<string, ModelManifestEntry>;
}

export function formatRevisionEstado(estado?: string): string {
  switch (estado) {
    case 'aprobada_y_verificada':
      return 'Aprobada y verificada';
    case 'verificada':
      return 'Verificada';
    case 'aprobada':
      return 'Aprobada';
    case 'redactada_pendiente_de_verificacion':
      return 'Redactada · pendiente de verificación';
    default:
      return estado ? estado.replace(/_/g, ' ') : 'Pendiente de auditoría';
  }
}

export interface LayerState {
  on: boolean;
  op: number; // 0..100
}

export interface InventoryReport {
  totalRecords: number;
  uniquePrimaryIds: number;
  equivalentCount: number;
  selfTraceabilityIds: string[];
  withFichaCount: number;
  verifiedCount: number;
  perSystemCount: Record<SystemCode, number>;
  perLayerCount: Record<LayerCode, number>;
}

export interface CameraPreset {
  id: string;
  label: string;
  position: [number, number, number];
  target: [number, number, number];
}

export interface StudyPreset {
  id: string;
  label: string;
  description: string;
  systems: SystemCode[];
  layers: Partial<Record<LayerCode, { on: boolean; op: number }>>;
  cutaway?: CutawayMode;
  explode?: number;
}

export interface AnatomyPlate {
  src: string;
  alt: string;
  caption: string;
}

export interface ScreenLabel {
  id: string;
  es: string;
  la: string;
  x: number;
  y: number;
  selected: boolean;
}

export interface QuizQuestion {
  mode: 'nombre' | 'visor';
  id?: string;
  sys?: SystemCode;
  key?: string;
  label?: string;
  ans?: string;
  opts?: string[];
  text?: string;
  err?: string;
}

export interface QuizProgress {
  n: number;
  ok: number;
  sys: Record<string, { n: number; ok: number }>;
  miss: Record<string, { t: string; c: number }>;
}

export const SYSTEMS: ReadonlyArray<{ code: SystemCode; label: string; color: string; file: string }> = [
  { code: 'ske', label: 'Esquelético', color: '#e5dcc5', file: 'sistema_esqueletico.json' },
  { code: 'art', label: 'Articular', color: '#86efac', file: 'sistema_articular.json' },
  { code: 'mus', label: 'Muscular', color: '#c85a48', file: 'sistema_muscular.json' },
  { code: 'dig', label: 'Digestivo', color: '#d99b66', file: 'sistema_digestivo.json' },
  { code: 'res', label: 'Respiratorio', color: '#e28f98', file: 'sistema_respiratorio.json' },
  { code: 'car', label: 'Cardiovascular y linfático', color: '#dc2626', file: 'sistema_cardiovascular.json' },
  { code: 'ner', label: 'Nervioso', color: '#eab308', file: 'sistema_nervioso.json' },
  { code: 'uri', label: 'Urinario', color: '#a86b4c', file: 'sistema_urinario.json' },
  { code: 'rep', label: 'Reproductor', color: '#c084fc', file: 'sistema_reproductor.json' },
  { code: 'teg', label: 'Tegumentario', color: '#9a6342', file: 'sistema_tegumentario.json' },
  { code: 'end', label: 'Endocrino', color: '#38bdf8', file: 'sistema_endocrino.json' },
  { code: 'sen', label: 'Sensorial', color: '#60a5fa', file: 'sistema_sensorial.json' },
];

export const LAYERS: ReadonlyArray<{ code: LayerCode; label: string; shortLabel: string; color: string }> = [
  { code: 'pel', label: 'Piel y tejido subcutáneo', shortLabel: 'Tegumento', color: '#9a6342' },
  { code: 'fas', label: 'Fascias y aponeurosis', shortLabel: 'Fascias', color: '#cbd5e1' },
  { code: 'msu', label: 'Músculos superficiales', shortLabel: 'Músc. sup.', color: '#c85a48' },
  { code: 'mpr', label: 'Músculos profundos', shortLabel: 'Músc. prof.', color: '#9f3b2e' },
  { code: 'oss', label: 'Sistema óseo', shortLabel: 'Óseo', color: '#e5dcc5' },
  { code: 'art', label: 'Articulaciones y ligamentos', shortLabel: 'Articular', color: '#86efac' },
  { code: 'vas', label: 'Sistema vascular', shortLabel: 'Vascular', color: '#dc2626' },
  { code: 'ner', label: 'Sistema nervioso', shortLabel: 'Nervioso', color: '#eab308' },
  { code: 'org', label: 'Órganos internos', shortLabel: 'Órganos', color: '#e28f98' },
  { code: 'cav', label: 'Cavidades y serosas', shortLabel: 'Cavidades', color: '#38bdf8' },
];

export const FICHA_FIELDS: ReadonlyArray<[keyof FichaData, string]> = [
  ['ubicacion', 'Ubicación anatómica'],
  ['descripcion', 'Descripción morfológica'],
  ['relaciones', 'Relaciones anatómicas'],
  ['accidentes', 'Accidentes anatómicos'],
  ['articulaciones', 'Articulaciones'],
  ['inserciones', 'Inserciones musculares'],
  ['irrigacion', 'Irrigación'],
  ['inervacion', 'Inervación'],
  ['funcion', 'Función'],
  ['especie', 'Particularidades de la especie'],
  ['clinica', 'Importancia clínica'],
  ['referencias', 'Referencias bibliográficas'],
];

export const ANATOMY_PLATES: Record<string, AnatomyPlate> = {
  'equ.ske.cer.001': {
    src: `${import.meta.env.BASE_URL}assets/laminas/atlas-equino-c1.svg`,
    alt: 'Atlas equino C1: vistas dorsales y ventrales esquemáticas con arcos, masas laterales, alas y forámenes.',
    caption: 'Lámina original del atlas equino (C1). Esquema didáctico 2D, no a escala ni diagnóstico.',
  },
  'equ.ske.cer.002': {
    src: `${import.meta.env.BASE_URL}assets/laminas/axis-equino-c2.svg`,
    alt: 'Axis equino C2: vistas dorsal y lateral esquemáticas con dens, cuerpo, cresta ventral y proceso espinoso.',
    caption: 'Lámina original del axis equino (C2). Esquema didáctico 2D, no a escala ni diagnóstico.',
  },
};

export const CAMERA_PRESETS: CameraPreset[] = [
  { id: 'lat-izq', label: 'Lateral izq.', position: [0.15, 1.15, -3.6], target: [0.05, 0.95, 0] },
  { id: 'lat-der', label: 'Lateral der.', position: [0.15, 1.15, 3.6], target: [0.05, 0.95, 0] },
  { id: 'tres-cuartos', label: 'Tres cuartos', position: [2.45, 1.55, -2.55], target: [0.1, 0.95, 0] },
  { id: 'frontal', label: 'Frontal', position: [3.4, 1.25, 0.05], target: [0.35, 1.0, 0] },
  { id: 'dorsal', label: 'Dorsal', position: [0.05, 4.1, 0.05], target: [0.05, 0.95, 0] },
  { id: 'torax', label: 'Tórax y corazón', position: [0.55, 1.15, -1.85], target: [0.32, 1.0, 0] },
  { id: 'cabeza', label: 'Cabeza y cuello', position: [2.2, 1.75, -1.55], target: [1.15, 1.45, 0] },
  { id: 'casco', label: 'Miembro distal', position: [1.3, 0.45, -1.35], target: [0.55, 0.35, 0] },
];

export const STUDY_PRESETS: StudyPreset[] = [
  {
    id: 'translucido',
    label: 'Atlas completo',
    description: 'Piel translúcida dejando ver musculatura superficial, esqueleto y vísceras',
    systems: ['ske', 'art', 'mus', 'dig', 'res', 'car', 'ner', 'uri', 'rep', 'teg', 'end', 'sen'],
    layers: {
      pel: { on: true, op: 24 },
      fas: { on: true, op: 40 },
      msu: { on: true, op: 42 },
      mpr: { on: true, op: 70 },
      oss: { on: true, op: 100 },
      art: { on: true, op: 90 },
      vas: { on: true, op: 100 },
      ner: { on: true, op: 100 },
      org: { on: true, op: 95 },
      cav: { on: true, op: 35 },
    },
    cutaway: 'none',
    explode: 0,
  },
  {
    id: 'osteologia',
    label: 'Osteología y artrología',
    description: 'Esqueleto equino completo con articulaciones y ligamento nucal',
    systems: ['ske', 'art'],
    layers: {
      pel: { on: false, op: 100 },
      fas: { on: false, op: 100 },
      msu: { on: false, op: 100 },
      mpr: { on: false, op: 100 },
      oss: { on: true, op: 100 },
      art: { on: true, op: 100 },
      vas: { on: false, op: 100 },
      ner: { on: false, op: 100 },
      org: { on: false, op: 100 },
      cav: { on: false, op: 100 },
    },
    cutaway: 'none',
    explode: 0,
  },
  {
    id: 'miologia',
    label: 'Miología por planos',
    description: 'Planos musculares superficiales, profundos, fascias y soporte óseo',
    systems: ['mus', 'ske', 'art', 'teg'],
    layers: {
      pel: { on: false, op: 100 },
      fas: { on: true, op: 80 },
      msu: { on: true, op: 100 },
      mpr: { on: true, op: 100 },
      oss: { on: true, op: 100 },
      art: { on: true, op: 85 },
      vas: { on: false, op: 100 },
      ner: { on: false, op: 100 },
      org: { on: false, op: 100 },
      cav: { on: false, op: 100 },
    },
    cutaway: 'none',
    explode: 0,
  },
  {
    id: 'esplacnologia',
    label: 'Esplacnología (vísceras)',
    description: 'Corte sagital para estudiar aparato digestivo, respiratorio y urogenital',
    systems: ['ske', 'dig', 'res', 'car', 'uri', 'rep', 'end'],
    layers: {
      pel: { on: true, op: 20 },
      fas: { on: false, op: 100 },
      msu: { on: false, op: 100 },
      mpr: { on: true, op: 85 },
      oss: { on: true, op: 75 },
      art: { on: false, op: 100 },
      vas: { on: true, op: 95 },
      ner: { on: false, op: 100 },
      org: { on: true, op: 100 },
      cav: { on: true, op: 30 },
    },
    cutaway: 'left',
    explode: 0,
  },
  {
    id: 'neurovascular',
    label: 'Neuro-vascular',
    description: 'Encéfalo, médula espinal, plexos nerviosos, corazón y grandes vasos',
    systems: ['ske', 'car', 'ner', 'sen'],
    layers: {
      pel: { on: false, op: 100 },
      fas: { on: false, op: 100 },
      msu: { on: false, op: 100 },
      mpr: { on: false, op: 100 },
      oss: { on: true, op: 35 },
      art: { on: false, op: 100 },
      vas: { on: true, op: 100 },
      ner: { on: true, op: 100 },
      org: { on: true, op: 95 },
      cav: { on: false, op: 100 },
    },
    cutaway: 'none',
    explode: 0,
  },
  {
    id: 'explosiva',
    label: 'Disección por capas',
    description: 'Separación lateral progresiva de cada capa anatómica',
    systems: ['ske', 'art', 'mus', 'dig', 'res', 'car', 'ner', 'uri', 'teg'],
    layers: {
      pel: { on: true, op: 45 },
      fas: { on: true, op: 65 },
      msu: { on: true, op: 85 },
      mpr: { on: true, op: 90 },
      oss: { on: true, op: 100 },
      art: { on: true, op: 95 },
      vas: { on: true, op: 100 },
      ner: { on: true, op: 100 },
      org: { on: true, op: 100 },
      cav: { on: false, op: 100 },
    },
    cutaway: 'none',
    explode: 65,
  },
];

export function getCatalogSystem(s: StructureRecord): SystemCode {
  return s._catalog === 'art' ? 'art' : s.sys;
}
