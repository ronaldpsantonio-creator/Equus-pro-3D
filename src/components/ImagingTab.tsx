import React, { useState } from 'react';
import {
  DraftingCompass,
  EyeOff,
  ImagePlus,
  Layers,
  RotateCcw,
  Ruler,
  ScanLine,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import {
  EQUINE_MEASURE_PRESETS,
  EquineMeasurePreset,
} from '../three/measurementOverlay';
import {
  MeasureToolMode,
  MprSliceState,
  ReferencePlaneConfig,
  ReferenceProjection,
  RenderViewMode,
} from '../types/proclavet';

interface ImagingTabProps {
  renderMode: RenderViewMode;
  onRenderModeChange: (mode: RenderViewMode) => void;
  mpr: MprSliceState;
  onMprChange: (next: MprSliceState) => void;
  onResetMpr: () => void;
  referencePlane: ReferencePlaneConfig;
  onReferencePlaneChange: (next: ReferencePlaneConfig) => void;
  onUploadReferenceImage: () => void;
  onSelectPresetCamera?: (mode: 'lat' | 'distal') => void;
  measureMode: MeasureToolMode;
  onMeasureModeChange: (mode: MeasureToolMode) => void;
  measurementCount: number;
  onApplyMeasurePreset: (preset: EquineMeasurePreset) => void;
  onClearMeasurements: () => void;
}

type ImagingSubTab = 'mpr' | 'plano' | 'medicion';

export const ImagingTab: React.FC<ImagingTabProps> = ({
  renderMode,
  onRenderModeChange,
  mpr,
  onMprChange,
  onResetMpr,
  referencePlane,
  onReferencePlaneChange,
  onUploadReferenceImage,
  onSelectPresetCamera,
  measureMode,
  onMeasureModeChange,
  measurementCount,
  onApplyMeasurePreset,
  onClearMeasurements,
}) => {
  const [subTab, setSubTab] = useState<ImagingSubTab>('mpr');
  const anyMprActive = mpr.sagittal.enabled || mpr.transverse.enabled || mpr.dorsal.enabled;

  return (
    <div className="space-y-2">
      {/* Compact top bar: 3D Modality + Section selector */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-950/70 p-0.5"
          role="group"
          aria-label="Modalidad de visualización 3D"
        >
          <ScanLine className="ml-1.5 mr-0.5 hidden h-3.5 w-3.5 text-teal-400 sm:block" />
          {(
            [
              ['anatomico', 'Anatómico'],
              ['radiografia', 'Radiografía Rx'],
              ['tc', 'Cortical TC'],
            ] as const
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              onClick={() => onRenderModeChange(mode)}
              className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors whitespace-nowrap sm:px-2.5 sm:text-xs ${
                renderMode === mode
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div
          className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900/70 p-0.5"
          role="tablist"
          aria-label="Herramientas de TC y Rx"
        >
          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'mpr'}
            onClick={() => setSubTab('mpr')}
            className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors whitespace-nowrap ${
              subTab === 'mpr'
                ? 'bg-slate-700 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <SlidersHorizontal className="h-3 w-3 text-amber-400" />
            <span>Cortes MPR</span>
            {anyMprActive && (
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'plano'}
            onClick={() => setSubTab('plano')}
            className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors whitespace-nowrap ${
              subTab === 'plano'
                ? 'bg-slate-700 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="h-3 w-3 text-cyan-400" />
            <span>Plano Rx/TC</span>
            {referencePlane.visible && (
              <span className="h-1.5 w-1.5 rounded-full bg-teal-400" aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'medicion'}
            onClick={() => setSubTab('medicion')}
            className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors whitespace-nowrap ${
              subTab === 'medicion'
                ? 'bg-slate-700 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Ruler className="h-3 w-3 text-teal-400" />
            <span>Medición</span>
            {measurementCount > 0 && (
              <span className="font-mono text-[10px] text-amber-300 tabular-nums">
                ({measurementCount})
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Sub-panel 1: Compact Multiplanar Reconstruction (MPR) Sliders */}
      {subTab === 'mpr' && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-2.5 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium text-slate-300">
              Cortes multiplanares en tiempo real (MPR tipo TC)
            </span>
            {anyMprActive && (
              <button
                type="button"
                onClick={onResetMpr}
                className="flex items-center gap-1 rounded border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300 hover:border-slate-500 hover:text-white whitespace-nowrap"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Restablecer</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            {/* Sagittal plane Z */}
            <div className="rounded-md border border-slate-800/80 bg-slate-950/50 px-2.5 py-1.5">
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <label className="flex cursor-pointer items-center gap-1.5 text-slate-200">
                  <input
                    type="checkbox"
                    checked={mpr.sagittal.enabled}
                    onChange={(e) =>
                      onMprChange({
                        ...mpr,
                        sagittal: { ...mpr.sagittal, enabled: e.target.checked },
                      })
                    }
                    className="h-3.5 w-3.5 accent-cyan-400"
                  />
                  <span>Sagital (Z)</span>
                </label>
                <span className="font-mono text-[11px] text-cyan-300 tabular-nums">
                  {mpr.sagittal.value >= 0 ? '+' : ''}
                  {mpr.sagittal.value.toFixed(2)} m
                </span>
              </div>
              <input
                type="range"
                min={-0.45}
                max={0.45}
                step={0.01}
                value={mpr.sagittal.value}
                onChange={(e) =>
                  onMprChange({
                    ...mpr,
                    sagittal: { enabled: true, value: Number(e.target.value) },
                  })
                }
                className="anatomy-slider mt-1 w-full"
                aria-label="Corte sagital en metros"
              />
            </div>

            {/* Transverse plane X */}
            <div className="rounded-md border border-slate-800/80 bg-slate-950/50 px-2.5 py-1.5">
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <label className="flex cursor-pointer items-center gap-1.5 text-slate-200">
                  <input
                    type="checkbox"
                    checked={mpr.transverse.enabled}
                    onChange={(e) =>
                      onMprChange({
                        ...mpr,
                        transverse: { ...mpr.transverse, enabled: e.target.checked },
                      })
                    }
                    className="h-3.5 w-3.5 accent-amber-400"
                  />
                  <span>Transverso (X)</span>
                </label>
                <span className="font-mono text-[11px] text-amber-300 tabular-nums">
                  {mpr.transverse.value >= 0 ? '+' : ''}
                  {mpr.transverse.value.toFixed(2)} m
                </span>
              </div>
              <input
                type="range"
                min={-1.45}
                max={1.65}
                step={0.01}
                value={mpr.transverse.value}
                onChange={(e) =>
                  onMprChange({
                    ...mpr,
                    transverse: { enabled: true, value: Number(e.target.value) },
                  })
                }
                className="anatomy-slider mt-1 w-full"
                aria-label="Corte transverso en metros"
              />
            </div>

            {/* Dorsal plane Y */}
            <div className="rounded-md border border-slate-800/80 bg-slate-950/50 px-2.5 py-1.5">
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <label className="flex cursor-pointer items-center gap-1.5 text-slate-200">
                  <input
                    type="checkbox"
                    checked={mpr.dorsal.enabled}
                    onChange={(e) =>
                      onMprChange({
                        ...mpr,
                        dorsal: { ...mpr.dorsal, enabled: e.target.checked },
                      })
                    }
                    className="h-3.5 w-3.5 accent-emerald-400"
                  />
                  <span>Dorsal (Y)</span>
                </label>
                <span className="font-mono text-[11px] text-emerald-300 tabular-nums">
                  {mpr.dorsal.value.toFixed(2)} m
                </span>
              </div>
              <input
                type="range"
                min={0.05}
                max={2.02}
                step={0.01}
                value={mpr.dorsal.value}
                onChange={(e) =>
                  onMprChange({
                    ...mpr,
                    dorsal: { enabled: true, value: Number(e.target.value) },
                  })
                }
                className="anatomy-slider mt-1 w-full"
                aria-label="Corte dorsal en metros"
              />
            </div>
          </div>
        </div>
      )}

      {/* Sub-panel 2: Calibrated Radiograph / CT Reference Plane */}
      {subTab === 'plano' && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-2.5 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => {
                  onReferencePlaneChange({
                    visible: true,
                    projection: 'LM',
                    opacity: 75,
                    scale: 1.0,
                    offsetX: 0,
                    offsetY: 0,
                    imageUrl: `${import.meta.env.BASE_URL}assets/laminas/rx-guia-lateral-equino.svg`,
                    label: 'Guía esquemática lateral (LM · cuerpo completo)',
                  });
                  onSelectPresetCamera?.('lat');
                }}
                className="rounded-lg border border-slate-700/80 bg-slate-950/70 px-2.5 py-1 text-[11px] font-medium text-slate-200 hover:border-cyan-500/60 hover:text-white whitespace-nowrap"
              >
                Guía ejes lateral (LM)
              </button>
              <button
                type="button"
                onClick={() => {
                  onReferencePlaneChange({
                    visible: true,
                    projection: 'LM',
                    opacity: 80,
                    scale: 0.34,
                    offsetX: 0.25,
                    offsetY: -0.76,
                    imageUrl: `${import.meta.env.BASE_URL}assets/laminas/rx-guia-dedo-lm.svg`,
                    label: 'Guía esquemática distal (LM · eje podofalángico ~52°)',
                  });
                  onSelectPresetCamera?.('distal');
                }}
                className="rounded-lg border border-slate-700/80 bg-slate-950/70 px-2.5 py-1 text-[11px] font-medium text-slate-200 hover:border-cyan-500/60 hover:text-white whitespace-nowrap"
              >
                Guía miembro distal (LM)
              </button>
              <button
                type="button"
                onClick={onUploadReferenceImage}
                className="flex items-center gap-1.5 rounded-lg border border-teal-500/50 bg-teal-950/50 px-2.5 py-1 text-[11px] font-medium text-teal-200 hover:border-teal-400 whitespace-nowrap"
              >
                <ImagePlus className="h-3.5 w-3.5" />
                <span>Cargar Rx / TC (PNG/JPG)</span>
              </button>
            </div>

            {referencePlane.visible && (
              <button
                type="button"
                onClick={() =>
                  onReferencePlaneChange({
                    ...referencePlane,
                    visible: false,
                  })
                }
                className="flex items-center gap-1 rounded border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300 hover:border-slate-500 hover:text-white whitespace-nowrap"
              >
                <EyeOff className="h-3 w-3" />
                <span>Ocultar plano</span>
              </button>
            )}
          </div>

          {referencePlane.visible && referencePlane.imageUrl ? (
            <div className="space-y-2 border-t border-slate-800 pt-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <span className="truncate font-medium text-cyan-300">{referencePlane.label}</span>
                <div className="flex items-center gap-1 rounded border border-slate-800 bg-slate-950/80 p-0.5">
                  {(['LM', 'DP', 'DV'] as ReferenceProjection[]).map((proj) => (
                    <button
                      key={proj}
                      type="button"
                      onClick={() =>
                        onReferencePlaneChange({ ...referencePlane, projection: proj })
                      }
                      className={`rounded px-2 py-0.5 text-[10px] font-mono font-medium ${
                        referencePlane.projection === proj
                          ? 'bg-cyan-500 text-slate-950'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      {proj}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
                <label className="space-y-0.5">
                  <div className="flex justify-between text-slate-400">
                    <span>Opacidad</span>
                    <span className="font-mono text-slate-200 tabular-nums">
                      {referencePlane.opacity}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={100}
                    value={referencePlane.opacity}
                    onChange={(e) =>
                      onReferencePlaneChange({
                        ...referencePlane,
                        opacity: Number(e.target.value),
                      })
                    }
                    className="anatomy-slider w-full"
                  />
                </label>

                <label className="space-y-0.5">
                  <div className="flex justify-between text-slate-400">
                    <span>Escala</span>
                    <span className="font-mono text-slate-200 tabular-nums">
                      {referencePlane.scale.toFixed(2)}×
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.2}
                    max={2.2}
                    step={0.02}
                    value={referencePlane.scale}
                    onChange={(e) =>
                      onReferencePlaneChange({
                        ...referencePlane,
                        scale: Number(e.target.value),
                      })
                    }
                    className="anatomy-slider w-full"
                  />
                </label>

                <label className="space-y-0.5">
                  <div className="flex justify-between text-slate-400">
                    <span>Despl. X</span>
                    <span className="font-mono text-slate-200 tabular-nums">
                      {referencePlane.offsetX.toFixed(2)} m
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-1.4}
                    max={1.4}
                    step={0.02}
                    value={referencePlane.offsetX}
                    onChange={(e) =>
                      onReferencePlaneChange({
                        ...referencePlane,
                        offsetX: Number(e.target.value),
                      })
                    }
                    className="anatomy-slider w-full"
                  />
                </label>

                <label className="space-y-0.5">
                  <div className="flex justify-between text-slate-400">
                    <span>Despl. Y</span>
                    <span className="font-mono text-slate-200 tabular-nums">
                      {referencePlane.offsetY.toFixed(2)} m
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-1.0}
                    max={1.0}
                    step={0.02}
                    value={referencePlane.offsetY}
                    onChange={(e) =>
                      onReferencePlaneChange({
                        ...referencePlane,
                        offsetY: Number(e.target.value),
                      })
                    }
                    className="anatomy-slider w-full"
                  />
                </label>
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-slate-800/80 bg-slate-950/50 px-2.5 py-2 text-[11px] text-slate-400">
              Superpone una radiografía o corte tomográfico real (PNG/JPG) en 1:1. Decodificadores locales Draco y Meshopt activos sin conexión para modelos{' '}
              <span className="font-mono text-slate-300">.glb</span> con metadatos{' '}
              <span className="font-mono text-slate-300">&lt;ID&gt;.meta.json</span>.
            </div>
          )}
        </div>
      )}

      {/* Sub-panel 3: Clinical 3D Morphometry & Goniometric Presets */}
      {subTab === 'medicion' && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-2.5 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => onMeasureModeChange(measureMode === 'ruler' ? 'none' : 'ruler')}
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap ${
                  measureMode === 'ruler'
                    ? 'border-cyan-400 bg-cyan-500 text-slate-950'
                    : 'border-slate-700/80 bg-slate-950/70 text-slate-200 hover:border-cyan-500/60'
                }`}
              >
                <Ruler className="h-3.5 w-3.5" />
                <span>Regla 3D libre</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  onMeasureModeChange(measureMode === 'goniometer' ? 'none' : 'goniometer')
                }
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap ${
                  measureMode === 'goniometer'
                    ? 'border-amber-400 bg-amber-500 text-slate-950'
                    : 'border-slate-700/80 bg-slate-950/70 text-slate-200 hover:border-amber-500/60'
                }`}
              >
                <DraftingCompass className="h-3.5 w-3.5" />
                <span>Goniómetro libre (3 pts)</span>
              </button>
            </div>

            {measurementCount > 0 && (
              <button
                type="button"
                onClick={onClearMeasurements}
                className="flex items-center gap-1 rounded border border-slate-700 px-2 py-0.5 text-[11px] text-rose-200 hover:border-rose-500/60 hover:text-white whitespace-nowrap"
              >
                <Trash2 className="h-3 w-3" />
                <span>Limpiar ({measurementCount})</span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-1">
            {EQUINE_MEASURE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => onApplyMeasurePreset(preset)}
                title={preset.description}
                className="rounded-md border border-slate-700/80 bg-slate-950/60 px-2 py-0.5 text-[11px] text-slate-300 transition-colors hover:border-amber-500/60 hover:text-white whitespace-nowrap"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
