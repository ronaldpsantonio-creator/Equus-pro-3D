import React from 'react';
import {
  ArrowLeft,
  BookOpen,
  Camera,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  GraduationCap,
  Home,
  Layers,
  RotateCcw,
  ScanLine,
  Sliders,
  Upload,
} from 'lucide-react';
import {
  BreadcrumbStep,
  CAMERA_PRESETS,
  CameraPreset,
  CutawayMode,
  FichaData,
  FichaSubView,
  InventoryReport,
  LAYERS,
  LayerCode,
  LayerState,
  LoadedModelMeta,
  MeasurementRecord,
  MeasurePoint,
  MeasureToolMode,
  MeasureUnit,
  MprSliceState,
  QuizProgress,
  ReferencePlaneConfig,
  RenderViewMode,
  SceneTheme,
  SexFilter,
  StructureRecord,
  STUDY_PRESETS,
  StudyPreset,
  SYSTEMS,
  SystemCode,
} from '../types/proclavet';
import { EquineMeasurePreset } from '../three/measurementOverlay';
import { CatalogAndFichaTab } from './CatalogAndFichaTab';
import { ImagingTab } from './ImagingTab';
import { MeasureBar } from './MeasureBar';
import { QuizTab } from './QuizTab';
import { SelectionBar } from './SelectionBar';

export type DockTab = 'sistemas' | 'capas' | 'imagenologia' | 'camaras' | 'ficha' | 'quiz';

interface BottomDockProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  activeTab: DockTab;
  onTabChange: (tab: DockTab) => void;
  hudHidden: boolean;

  // Selection bar props
  selectedStructure: StructureRecord | null;
  selectedModelState: 'esquemático' | 'cargado' | 'pendiente';
  selectedModelMeta?: LoadedModelMeta;
  selectedHasMesh: boolean;
  selectedProxyTarget?: StructureRecord | null;
  isolated: boolean;
  onFocusSelected: () => void;
  onIsolateSelected: () => void;
  onHideSelected: () => void;
  hiddenCount: number;
  dissectMode: boolean;
  onToggleDissectMode: () => void;
  sceneTheme: SceneTheme;
  onToggleTheme: () => void;
  onShowAll: () => void;
  onUploadGlb: () => void;
  onUploadBatchGlb: () => void;
  onClearSelection: () => void;

  // Systems & Layers
  report: InventoryReport | null;
  systems: Record<SystemCode, boolean>;
  onToggleSystem: (code: SystemCode) => void;
  onApplyStudyPreset: (preset: StudyPreset) => void;
  layers: Record<LayerCode, LayerState>;
  onToggleLayer: (code: LayerCode) => void;
  onLayerOpacity: (code: LayerCode, op: number) => void;
  explode: number;
  onExplodeChange: (val: number) => void;
  cutaway: CutawayMode;
  onCutawayChange: (mode: CutawayMode) => void;
  showLabels: boolean;
  onToggleLabels: () => void;
  blindMode: boolean;
  onToggleBlindMode: () => void;

  // Camera
  onSelectCameraPreset: (preset: CameraPreset) => void;

  // Imaging (TC / Rx / MPR / Calibrated Plane)
  renderMode: RenderViewMode;
  onRenderModeChange: (mode: RenderViewMode) => void;
  mpr: MprSliceState;
  onMprChange: (next: MprSliceState) => void;
  onResetMpr: () => void;
  referencePlane: ReferencePlaneConfig;
  onReferencePlaneChange: (next: ReferencePlaneConfig) => void;
  onUploadReferenceImage: () => void;

  // 3D Ruler & Goniometer
  measureMode: MeasureToolMode;
  onMeasureModeChange: (mode: MeasureToolMode) => void;
  measureUnit: MeasureUnit;
  onMeasureUnitChange: (unit: MeasureUnit) => void;
  measurements: MeasurementRecord[];
  draftPoints: MeasurePoint[];
  onUndoDraftPoint: () => void;
  onDeleteMeasurement: (id: string) => void;
  onClearMeasurements: () => void;
  onFocusMeasurePoint: (pos: [number, number, number]) => void;
  onApplyMeasurePreset: (preset: EquineMeasurePreset) => void;

  // Catalog & Ficha
  structures: StructureRecord[];
  byId: Record<string, StructureRecord>;
  byTraceabilityId: Record<string, StructureRecord>;
  sex: SexFilter;
  favorites: Record<string, boolean>;
  notes: Record<string, string>;
  verified: Record<string, boolean>;
  fichaDrafts: Record<string, FichaData>;
  loadedModelMeta: Record<string, LoadedModelMeta>;
  hasMeshFn: (id: string) => boolean;
  has3DAnchorFn?: (id: string) => boolean;
  get3DAnchorTargetFn?: (id: string) => StructureRecord | null;
  getModelStateFn: (id: string) => 'esquemático' | 'cargado' | 'pendiente';
  isVisibleOverrideFn: (id: string) => boolean;
  onSelectStructure: (id: string) => void;
  onFocusStructure: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onToggleStructureVisible: (id: string) => void;
  onUpdateNote: (id: string, note: string) => void;
  onUpdateFichaDraft: (id: string, nextFicha: FichaData) => void;
  onClearFichaDraft: (id: string) => void;
  onVerifyAndNext: (id: string) => void;
  fichaSubView: FichaSubView;
  onFichaSubViewChange: (view: FichaSubView) => void;

  // Navigation depth (sequential back + direct home)
  breadcrumbs: BreadcrumbStep[];
  canStepBack: boolean;
  prevStepLabel?: string;
  onStepBack: () => void;
  isAtHome: boolean;
  onGoHome: () => void;

  // Quiz
  quizProgress: QuizProgress;
  getVisible3DIdsFn: () => string[];
  onQuizProgressChange: (next: QuizProgress) => void;
  onQuizHighlight: (id: string | null, forceBlind: boolean) => void;
}

export const BottomDock: React.FC<BottomDockProps> = (props) => {
  const {
    collapsed,
    onToggleCollapse,
    activeTab,
    onTabChange,
    hudHidden,
    selectedStructure,
    selectedModelState,
    selectedModelMeta,
    selectedHasMesh,
    selectedProxyTarget,
    isolated,
    onFocusSelected,
    onIsolateSelected,
    onHideSelected,
    hiddenCount,
    dissectMode,
    onToggleDissectMode,
    sceneTheme,
    onToggleTheme,
    onShowAll,
    onUploadGlb,
    onUploadBatchGlb,
    onClearSelection,
    report,
    systems,
    onToggleSystem,
    onApplyStudyPreset,
    layers,
    onToggleLayer,
    onLayerOpacity,
    explode,
    onExplodeChange,
    cutaway,
    onCutawayChange,
    showLabels,
    onToggleLabels,
    blindMode,
    onToggleBlindMode,
    onSelectCameraPreset,
    renderMode,
    onRenderModeChange,
    mpr,
    onMprChange,
    onResetMpr,
    referencePlane,
    onReferencePlaneChange,
    onUploadReferenceImage,
    measureMode,
    onMeasureModeChange,
    measureUnit,
    onMeasureUnitChange,
    measurements,
    draftPoints,
    onUndoDraftPoint,
    onDeleteMeasurement,
    onClearMeasurements,
    onFocusMeasurePoint,
    onApplyMeasurePreset,
    structures,
    byId,
    byTraceabilityId,
    sex,
    favorites,
    notes,
    verified,
    fichaDrafts,
    loadedModelMeta,
    hasMeshFn,
    has3DAnchorFn,
    get3DAnchorTargetFn,
    getModelStateFn,
    isVisibleOverrideFn,
    onSelectStructure,
    onFocusStructure,
    onToggleFavorite,
    onToggleStructureVisible,
    onUpdateNote,
    onUpdateFichaDraft,
    onClearFichaDraft,
    onVerifyAndNext,
    fichaSubView,
    onFichaSubViewChange,
    breadcrumbs,
    canStepBack,
    prevStepLabel,
    onStepBack,
    isAtHome,
    onGoHome,
    quizProgress,
    getVisible3DIdsFn,
    onQuizProgressChange,
    onQuizHighlight,
  } = props;

  if (hudHidden) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-20 w-[min(980px,95vw)] -translate-x-1/2">
      <div className="pointer-events-auto">
        <MeasureBar
          measureMode={measureMode}
          onMeasureModeChange={onMeasureModeChange}
          measureUnit={measureUnit}
          onMeasureUnitChange={onMeasureUnitChange}
          measurements={measurements}
          draftPoints={draftPoints}
          onUndoDraftPoint={onUndoDraftPoint}
          onDeleteMeasurement={onDeleteMeasurement}
          onClearMeasurements={onClearMeasurements}
          onFocusPoint={onFocusMeasurePoint}
          onApplyPreset={onApplyMeasurePreset}
        />

        <SelectionBar
          structure={selectedStructure}
          modelState={selectedModelState}
          modelMeta={selectedModelMeta}
          hasMesh={selectedHasMesh}
          proxyTarget={selectedProxyTarget}
          blindMode={blindMode}
          isolated={isolated}
          onOpenFicha={() => {
            if (collapsed) onToggleCollapse();
            onTabChange('ficha');
            if (fichaSubView !== 'ficha') onFichaSubViewChange('ficha');
          }}
          onFocus={onFocusSelected}
          onIsolate={onIsolateSelected}
          onHide={onHideSelected}
          onShowAll={onShowAll}
          onUploadGlb={onUploadGlb}
          onClear={onClearSelection}
        />

        {/* Collapse handle */}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={onToggleCollapse}
            className="flex items-center gap-1.5 rounded-t-lg border border-b-0 border-slate-700/80 bg-[#0e141d]/95 px-4 py-1 text-[11px] font-medium text-slate-300 transition-colors hover:text-white"
          >
            {collapsed ? (
              <>
                <ChevronUp className="h-3.5 w-3.5 text-amber-400" />
                <span>Mostrar controles</span>
              </>
            ) : (
              <>
                <ChevronDown className="h-3.5 w-3.5 text-amber-400" />
                <span>Ocultar controles</span>
              </>
            )}
          </button>
        </div>

        {/* Dock container */}
        {!collapsed && (
          <div className="rounded-xl border border-slate-700/80 bg-[#0e141d]/95 p-3.5 shadow-2xl">
            {/* Sequential Breadcrumb & Quick Return Bar */}
            {(breadcrumbs.length > 1 || canStepBack || !isAtHome) && (
              <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800/90 bg-slate-900/75 px-2.5 py-1.5 text-xs">
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
                  <button
                    type="button"
                    disabled={!canStepBack}
                    onClick={onStepBack}
                    className="mr-1 flex items-center gap-1 rounded-md border border-slate-700/80 bg-slate-950/70 px-2 py-0.5 text-[11px] font-medium text-slate-200 transition-colors hover:border-amber-500/60 hover:text-white disabled:opacity-40 whitespace-nowrap shrink-0"
                    title={
                      prevStepLabel
                        ? `Retroceder en secuencia (${prevStepLabel})`
                        : 'Retroceder un paso en secuencia'
                    }
                  >
                    <ArrowLeft className="h-3 w-3 text-amber-400" />
                    <span>Atrás</span>
                  </button>

                  <nav
                    aria-label="Ruta de profundidad anatómica"
                    className="flex flex-wrap items-center gap-1 min-w-0 text-[11px]"
                  >
                    {breadcrumbs.map((crumb, idx) => {
                      const isLast = idx === breadcrumbs.length - 1;
                      return (
                        <React.Fragment key={crumb.id}>
                          {idx > 0 && (
                            <ChevronRight
                              className="h-3 w-3 shrink-0 text-slate-600"
                              aria-hidden="true"
                            />
                          )}
                          {crumb.onClick && !isLast ? (
                            <button
                              type="button"
                              onClick={crumb.onClick}
                              className="truncate max-w-[160px] rounded px-1.5 py-0.5 font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-amber-300"
                            >
                              {crumb.label}
                            </button>
                          ) : (
                            <span className="truncate max-w-[190px] px-1 font-semibold text-teal-300">
                              {crumb.label}
                            </span>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </nav>
                </div>

                <button
                  type="button"
                  onClick={onGoHome}
                  disabled={isAtHome}
                  className="flex items-center gap-1 rounded-md border border-teal-500/40 bg-teal-950/60 px-2.5 py-0.5 text-[11px] font-medium text-teal-200 transition-colors hover:border-teal-400 hover:text-white disabled:opacity-40 whitespace-nowrap shrink-0"
                  title="Volver a Inicio de una sola vez"
                >
                  <Home className="h-3 w-3" />
                  <span>Inicio</span>
                </button>
              </div>
            )}

            {/* Tab bar */}
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
              <div className="flex flex-wrap items-center gap-1">
                {(
                  [
                    ['sistemas', 'Sistemas y planos', Layers],
                    ['capas', 'Capas y disección', Sliders],
                    ['imagenologia', 'TC y Rx', ScanLine],
                    ['camaras', 'Cámaras', Camera],
                    ['ficha', 'Catálogo y ficha', BookOpen],
                    ['quiz', 'Autoevaluación', GraduationCap],
                  ] as const
                ).map(([id, label, Icon]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onTabChange(id)}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      activeTab === id
                        ? 'bg-amber-500 text-slate-950'
                        : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                {hiddenCount > 0 && (
                  <button
                    type="button"
                    onClick={onShowAll}
                    className="flex items-center gap-1 rounded-lg border border-slate-700/80 px-2.5 py-1 text-[11px] font-medium text-slate-300 transition-colors hover:border-slate-500 hover:text-white whitespace-nowrap"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>Restaurar ({hiddenCount})</span>
                  </button>
                )}
              </div>
            </div>

            {/* Tab 1: Systems & Study Presets */}
            {activeTab === 'sistemas' && (
              <div className="space-y-3">
                <div>
                  <div className="mb-1.5 text-[11px] font-medium text-slate-400">
                    Modos de estudio por planos anatómicos
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {STUDY_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => onApplyStudyPreset(preset)}
                        title={preset.description}
                        className="rounded-lg border border-slate-700/80 bg-slate-900/70 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:border-amber-500/70 hover:text-white whitespace-nowrap"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 text-[11px] font-medium text-slate-400">
                    Los 12 catálogos del cuerpo equino
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4">
                    {SYSTEMS.map((sys) => {
                      const active = systems[sys.code] !== false;
                      const count = report?.perSystemCount[sys.code] ?? 0;
                      return (
                        <button
                          key={sys.code}
                          type="button"
                          onClick={() => onToggleSystem(sys.code)}
                          className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs transition-colors ${
                            active
                              ? 'border-slate-600 bg-slate-800/85 text-slate-100'
                              : 'border-slate-800/80 bg-slate-950/50 text-slate-500 hover:text-slate-300'
                          }`}
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-sm"
                              style={{
                                backgroundColor: sys.color,
                                opacity: active ? 1 : 0.3,
                              }}
                              aria-hidden="true"
                            />
                            <span className="truncate font-medium">{sys.label}</span>
                          </span>
                          <span className="font-mono text-[10px] text-slate-400 tabular-nums shrink-0">
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: 10 Anatomical Layers & Dissection Controls */}
            {activeTab === 'capas' && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
                  {LAYERS.map((layer, idx) => {
                    const st = layers[layer.code];
                    return (
                      <div
                        key={layer.code}
                        className="rounded-lg border border-slate-800 bg-slate-900/50 px-2.5 py-2"
                      >
                        <label className="flex cursor-pointer items-center justify-between gap-1.5 text-xs">
                          <span className="flex items-center gap-1.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={st.on}
                              onChange={() => onToggleLayer(layer.code)}
                              className="h-3.5 w-3.5 accent-amber-500"
                            />
                            <span
                              className="h-2 w-2 shrink-0 rounded-full"
                              style={{ backgroundColor: layer.color }}
                              aria-hidden="true"
                            />
                            <span className="truncate font-medium text-slate-200">
                              {idx + 1}. {layer.shortLabel}
                            </span>
                          </span>
                          <span className="font-mono text-[10px] text-slate-400 tabular-nums">
                            {st.op}%
                          </span>
                        </label>
                        <input
                          type="range"
                          min={5}
                          max={100}
                          value={st.op}
                          disabled={!st.on}
                          onChange={(e) => onLayerOpacity(layer.code, Number(e.target.value))}
                          className="anatomy-slider mt-2 w-full disabled:opacity-40"
                          aria-label={`Opacidad de ${layer.label}`}
                        />
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-800 pt-2.5">
                  <div className="flex flex-1 min-w-[220px] items-center gap-3">
                    <span className="text-xs font-medium text-slate-300 whitespace-nowrap">
                      Separar capas:
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={explode}
                      onChange={(e) => onExplodeChange(Number(e.target.value))}
                      className="anatomy-slider flex-1"
                    />
                    <span className="w-10 text-right font-mono text-xs text-amber-400 tabular-nums">
                      {explode}%
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center rounded-lg border border-slate-800 bg-slate-900/60 p-0.5 md:hidden">
                      {(
                        [
                          ['none', 'Completo'],
                          ['left', 'Corte izq.'],
                          ['right', 'Corte der.'],
                        ] as const
                      ).map(([val, label]) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => onCutawayChange(val)}
                          className={`rounded px-2 py-1 text-[11px] font-medium ${
                            cutaway === val ? 'bg-teal-500 text-slate-950' : 'text-slate-300'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-300">
                      <input
                        type="checkbox"
                        checked={dissectMode}
                        onChange={onToggleDissectMode}
                        className="h-3.5 w-3.5 accent-amber-500"
                      />
                      <span>Disección al clic</span>
                    </label>

                    <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-300">
                      <input
                        type="checkbox"
                        checked={sceneTheme === 'atlas'}
                        onChange={onToggleTheme}
                        disabled={renderMode !== 'anatomico'}
                        className="h-3.5 w-3.5 accent-sky-400"
                      />
                      <span>Atlas claro</span>
                    </label>

                    <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-300">
                      <input
                        type="checkbox"
                        checked={showLabels}
                        onChange={onToggleLabels}
                        className="h-3.5 w-3.5 accent-amber-500"
                      />
                      <span>Nombres 3D</span>
                    </label>

                    <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-300">
                      <input
                        type="checkbox"
                        checked={blindMode}
                        onChange={onToggleBlindMode}
                        className="h-3.5 w-3.5 accent-amber-500"
                      />
                      <span>Modo ciego</span>
                    </label>

                    <button
                      type="button"
                      onClick={onUploadGlb}
                      className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/80 px-2.5 py-1 text-xs font-medium text-slate-200 hover:border-slate-500 whitespace-nowrap"
                      title="Cargar un archivo .glb sobre la estructura seleccionada"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      <span>Probar .glb</span>
                    </button>

                    <button
                      type="button"
                      onClick={onUploadBatchGlb}
                      className="flex items-center gap-1.5 rounded-lg border border-teal-500/40 bg-teal-950/50 px-2.5 py-1 text-xs font-medium text-teal-200 hover:border-teal-400/70 whitespace-nowrap"
                      title="Seleccionar múltiples archivos <ID>.glb y vincularlos automáticamente por ID o trazabilidad"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      <span>Lote .glb</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 3: Imaging (TC / Rx / MPR) */}
            {activeTab === 'imagenologia' && (
              <ImagingTab
                renderMode={renderMode}
                onRenderModeChange={onRenderModeChange}
                mpr={mpr}
                onMprChange={onMprChange}
                onResetMpr={onResetMpr}
                referencePlane={referencePlane}
                onReferencePlaneChange={onReferencePlaneChange}
                onUploadReferenceImage={onUploadReferenceImage}
                onSelectPresetCamera={(mode) => {
                  const targetPreset = CAMERA_PRESETS.find((p) =>
                    mode === 'distal' ? p.id === 'casco' : p.id === 'lat-izq',
                  );
                  if (targetPreset) onSelectCameraPreset(targetPreset);
                }}
                measureMode={measureMode}
                onMeasureModeChange={onMeasureModeChange}
                measurementCount={measurements.length}
                onApplyMeasurePreset={onApplyMeasurePreset}
                onClearMeasurements={onClearMeasurements}
              />
            )}

            {/* Tab 4: Camera Presets */}
            {activeTab === 'camaras' && (
              <div className="space-y-2.5">
                <div className="text-[11px] text-slate-400">
                  Vistas anatómicas rápidas · Doble clic en cualquier estructura del caballo para
                  enfocarla directamente
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {CAMERA_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => onSelectCameraPreset(preset)}
                      className="rounded-lg border border-slate-700/80 bg-slate-900/70 px-3 py-2 text-xs font-medium text-slate-200 transition-colors hover:border-amber-500/70 hover:text-white"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Tab 4: Catalog & 12-field Ficha */}
            {activeTab === 'ficha' && (
              <CatalogAndFichaTab
                structures={structures}
                byId={byId}
                byTraceabilityId={byTraceabilityId}
                selectedId={selectedStructure?.id || null}
                sex={sex}
                blindMode={blindMode}
                favorites={favorites}
                notes={notes}
                verified={verified}
                fichaDrafts={fichaDrafts}
                loadedModelMeta={loadedModelMeta}
                hasMeshFn={hasMeshFn}
                has3DAnchorFn={has3DAnchorFn}
                get3DAnchorTargetFn={get3DAnchorTargetFn}
                getModelStateFn={getModelStateFn}
                isVisibleOverrideFn={isVisibleOverrideFn}
                onSelect={onSelectStructure}
                onFocus={onFocusStructure}
                onToggleFavorite={onToggleFavorite}
                onToggleStructureVisible={onToggleStructureVisible}
                onUpdateNote={onUpdateNote}
                onUpdateFichaDraft={onUpdateFichaDraft}
                onClearFichaDraft={onClearFichaDraft}
                onVerifyAndNext={onVerifyAndNext}
                fichaSubView={fichaSubView}
                onFichaSubViewChange={onFichaSubViewChange}
              />
            )}

            {/* Tab 5: Self-Assessment Quiz */}
            {activeTab === 'quiz' && (
              <QuizTab
                structures={structures}
                sex={sex}
                progress={quizProgress}
                hasMeshFn={hasMeshFn}
                getVisible3DIdsFn={getVisible3DIdsFn}
                onProgressChange={onQuizProgressChange}
                onHighlightStructure={onQuizHighlight}
                onIsolate={onIsolateSelected}
                onShowAll={onShowAll}
                onOpenFicha={(id) => {
                  onSelectStructure(id);
                  onTabChange('ficha');
                }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};
