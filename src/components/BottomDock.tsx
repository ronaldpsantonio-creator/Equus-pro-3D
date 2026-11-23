import React from 'react';
import {
  BookOpen,
  Camera,
  ChevronDown,
  ChevronUp,
  GraduationCap,
  Layers,
  RotateCcw,
  Sliders,
  Upload,
} from 'lucide-react';
import {
  CAMERA_PRESETS,
  CameraPreset,
  CutawayMode,
  InventoryReport,
  LAYERS,
  LayerCode,
  LayerState,
  QuizProgress,
  SexFilter,
  StructureRecord,
  STUDY_PRESETS,
  StudyPreset,
  SYSTEMS,
  SystemCode,
} from '../types/proclavet';
import { CatalogAndFichaTab } from './CatalogAndFichaTab';
import { QuizTab } from './QuizTab';
import { SelectionBar } from './SelectionBar';

export type DockTab = 'sistemas' | 'capas' | 'camaras' | 'ficha' | 'quiz';

interface BottomDockProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  activeTab: DockTab;
  onTabChange: (tab: DockTab) => void;
  hudHidden: boolean;

  // Selection bar props
  selectedStructure: StructureRecord | null;
  selectedModelState: 'esquemático' | 'cargado' | 'pendiente';
  selectedHasMesh: boolean;
  isolated: boolean;
  onFocusSelected: () => void;
  onIsolateSelected: () => void;
  onShowAll: () => void;
  onUploadGlb: () => void;
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

  // Catalog & Ficha
  structures: StructureRecord[];
  byId: Record<string, StructureRecord>;
  sex: SexFilter;
  favorites: Record<string, boolean>;
  notes: Record<string, string>;
  verified: Record<string, boolean>;
  hasMeshFn: (id: string) => boolean;
  getModelStateFn: (id: string) => 'esquemático' | 'cargado' | 'pendiente';
  isVisibleOverrideFn: (id: string) => boolean;
  onSelectStructure: (id: string) => void;
  onFocusStructure: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onToggleStructureVisible: (id: string) => void;
  onUpdateNote: (id: string, note: string) => void;
  onVerifyAndNext: (id: string) => void;

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
    selectedHasMesh,
    isolated,
    onFocusSelected,
    onIsolateSelected,
    onShowAll,
    onUploadGlb,
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
    structures,
    byId,
    sex,
    favorites,
    notes,
    verified,
    hasMeshFn,
    getModelStateFn,
    isVisibleOverrideFn,
    onSelectStructure,
    onFocusStructure,
    onToggleFavorite,
    onToggleStructureVisible,
    onUpdateNote,
    onVerifyAndNext,
    quizProgress,
    getVisible3DIdsFn,
    onQuizProgressChange,
    onQuizHighlight,
  } = props;

  if (hudHidden) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-20 w-[min(980px,95vw)] -translate-x-1/2">
      <div className="pointer-events-auto">
        <SelectionBar
          structure={selectedStructure}
          modelState={selectedModelState}
          hasMesh={selectedHasMesh}
          blindMode={blindMode}
          isolated={isolated}
          onOpenFicha={() => {
            if (collapsed) onToggleCollapse();
            onTabChange('ficha');
          }}
          onFocus={onFocusSelected}
          onIsolate={onIsolateSelected}
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
            {/* Tab bar */}
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
              <div className="flex flex-wrap items-center gap-1">
                {(
                  [
                    ['sistemas', 'Sistemas y planos', Layers],
                    ['capas', 'Capas y disección', Sliders],
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
                <button
                  type="button"
                  onClick={onShowAll}
                  className="flex items-center gap-1 rounded-lg border border-slate-700/80 px-2.5 py-1 text-[11px] font-medium text-slate-300 transition-colors hover:border-slate-500 hover:text-white whitespace-nowrap"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Mostrar todo</span>
                </button>
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
                    >
                      <Upload className="h-3.5 w-3.5" />
                      <span>Probar .glb</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 3: Camera Presets */}
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
                selectedId={selectedStructure?.id || null}
                sex={sex}
                blindMode={blindMode}
                favorites={favorites}
                notes={notes}
                verified={verified}
                hasMeshFn={hasMeshFn}
                getModelStateFn={getModelStateFn}
                isVisibleOverrideFn={isVisibleOverrideFn}
                onSelect={onSelectStructure}
                onFocus={onFocusStructure}
                onToggleFavorite={onToggleFavorite}
                onToggleStructureVisible={onToggleStructureVisible}
                onUpdateNote={onUpdateNote}
                onVerifyAndNext={onVerifyAndNext}
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
