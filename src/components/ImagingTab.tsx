import React, { useState } from 'react';
import {
  ArrowLeftRight,
  Box,
  DraftingCompass,
  EyeOff,
  ImagePlus,
  Layers,
  RotateCcw,
  Ruler,
  ScanLine,
  SlidersHorizontal,
  Square,
  SunMoon,
  Trash2,
} from 'lucide-react';
import {
  EQUINE_MEASURE_PRESETS,
  EquineMeasurePreset,
} from '../three/measurementOverlay';
import {
  CameraProjectionMode,
  MeasureToolMode,
  MprSliceState,
  ReferencePlaneConfig,
  ReferenceProjection,
  RenderViewMode,
} from '../types/proclavet';

interface ImagingTabProps {
  renderMode: RenderViewMode;
  onRenderModeChange: (mode: RenderViewMode) => void;
  cameraProjection: CameraProjectionMode;
  onCameraProjectionChange: (proj: CameraProjectionMode) => void;
  xrayExposure: number;
  onXrayExposureChange: (val: number) => void;
  xrayInverted: boolean;
  onXrayInvertedChange: (inv: boolean) => void;
  mpr: MprSliceState;
  onMprChange: (next: MprSliceState) => void;
  onResetMpr: () => void;
  referencePlane: ReferencePlaneConfig;
  onReferencePlaneChange: (next: ReferencePlaneConfig) => void;
  onUploadReferenceImage: () => void;
  onSelectPresetCamera?: (mode: 'lat' | 'distal' | 'frontal' | 'dorsal' | 'cabeza') => void;
  measureMode: MeasureToolMode;
  onMeasureModeChange: (mode: MeasureToolMode) => void;
  measurementCount: number;
  onApplyMeasurePreset: (preset: EquineMeasurePreset) => void;
  onClearMeasurements: () => void;
}

type ImagingSubTab = 'mpr' | 'plano' | 'medicion';

const MPR_PRESETS: ReadonlyArray<{
  id: string;
  label: string;
  mpr: MprSliceState;
  camera?: 'lat' | 'distal' | 'frontal' | 'cabeza';
}> = [
  {
    id: 'sag-med',
    label: 'Sagital medio',
    mpr: {
      sagittal: { enabled: true, value: 0, flip: false },
      transverse: { enabled: false, value: 0.2, flip: false },
      dorsal: { enabled: false, value: 1.1, flip: false },
    },
    camera: 'lat',
  },
  {
    id: 'torax-t10',
    label: 'Tórax (T10)',
    mpr: {
      sagittal: { enabled: false, value: 0, flip: false },
      transverse: { enabled: true, value: 0.12, flip: false },
      dorsal: { enabled: false, value: 1.1, flip: false },
    },
  },
  {
    id: 'craneo-senos',
    label: 'Cráneo / Senos',
    mpr: {
      sagittal: { enabled: true, value: 0, flip: false },
      transverse: { enabled: true, value: 1.02, flip: true },
      dorsal: { enabled: false, value: 1.1, flip: false },
    },
    camera: 'cabeza',
  },
  {
    id: 'distal-casco',
    label: 'Menudillo / Casco',
    mpr: {
      sagittal: { enabled: false, value: 0, flip: false },
      transverse: { enabled: false, value: 0.2, flip: false },
      dorsal: { enabled: true, value: 0.44, flip: false },
    },
    camera: 'distal',
  },
];

export const ImagingTab: React.FC<ImagingTabProps> = ({
  renderMode,
  onRenderModeChange,
  cameraProjection,
  onCameraProjectionChange,
  xrayExposure,
  onXrayExposureChange,
  xrayInverted,
  onXrayInvertedChange,
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
      {/* Compact top bar: 3D Modality + Projection + Section selector */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
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
            className="flex items-center gap-0.5 rounded-lg border border-slate-800 bg-slate-950/70 p-0.5"
            role="group"
            aria-label="Tipo de cámara"
          >
            <button
              type="button"
              onClick={() => onCameraProjectionChange('perspective')}
              className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors whitespace-nowrap ${
                cameraProjection === 'perspective'
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Vista con perspectiva cónica natural"
            >
              <Box className="h-3 w-3" />
              <span>Persp.</span>
            </button>
            <button
              type="button"
              onClick={() => onCameraProjectionChange('orthographic')}
              className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors whitespace-nowrap ${
                cameraProjection === 'orthographic'
                  ? 'bg-cyan-500 text-slate-950'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Vista ortográfica sin distorsión para superposición Rx/TC"
            >
              <Square className="h-3 w-3" />
              <span>Orto.</span>
            </button>
          </div>
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

      {/* Radiographic Windowing Strip (when Radiografía Rx mode is active) */}
      {renderMode === 'radiografia' && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-cyan-500/30 bg-cyan-950/20 px-2.5 py-1.5 text-[11px]">
          <div className="flex flex-1 min-w-[200px] items-center gap-2">
            <span className="text-slate-300 whitespace-nowrap">Exposición Rx</span>
            <input
              type="range"
              min={0.6}
              max={1.6}
              step={0.05}
              value={xrayExposure}
              onChange={(e) => onXrayExposureChange(Number(e.target.value))}
              className="anatomy-slider flex-1"
              aria-label="Exposición radiográfica"
            />
            <span className="w-10 text-right font-mono text-cyan-300 tabular-nums">
              {xrayExposure.toFixed(2)}×
            </span>
          </div>

          <button
            type="button"
            onClick={() => onXrayInvertedChange(!xrayInverted)}
            className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap ${
              xrayInverted
                ? 'border-amber-400 bg-amber-500 text-slate-950'
                : 'border-slate-700 bg-slate-900/80 text-slate-200 hover:border-cyan-500/60'
            }`}
            title="Alternar entre radiografía digital oscura y negatoscopio clásico claro"
          >
            <SunMoon className="h-3.5 w-3.5" />
            <span>{xrayInverted ? 'Negatoscopio claro' : 'Placa digital oscura'}</span>
          </button>
        </div>
      )}

      {/* Sub-panel 1: Bidirectional Multiplanar Reconstruction (MPR) Sliders & Clinical Presets */}
      {subTab === 'mpr' && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-2.5 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <div className="flex flex-wrap items-center gap-1">
              {MPR_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    onMprChange(preset.mpr);
                    if (preset.camera) onSelectPresetCamera?.(preset.camera);
                  }}
                  className="rounded border border-slate-700/80 bg-slate-950/70 px-2 py-0.5 text-[11px] text-slate-300 transition-colors hover:border-cyan-500/60 hover:text-white whitespace-nowrap"
                >
                  {preset.label}
                </button>
              ))}
            </div>
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
              <div className="flex items-center justify-between gap-1.5 text-[11px]">
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
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      onMprChange({
                        ...mpr,
                        sagittal: { ...mpr.sagittal, enabled: true, flip: !mpr.sagittal.flip },
                      })
                    }
                    className={`flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-[10px] transition-colors ${
                      mpr.sagittal.flip
                        ? 'border-cyan-500/60 bg-cyan-950/70 text-cyan-200'
                        : 'border-slate-700/80 text-slate-400 hover:text-slate-200'
                    }`}
                    title="Invertir hemisferio visible (Izquierdo / Derecho)"
                  >
                    <ArrowLeftRight className="h-2.5 w-2.5" />
                    <span>{mpr.sagittal.flip ? 'Der' : 'Izq'}</span>
                  </button>
                  <span className="font-mono text-[11px] text-cyan-300 tabular-nums">
                    {mpr.sagittal.value >= 0 ? '+' : ''}
                    {mpr.sagittal.value.toFixed(2)} m
                  </span>
                </div>
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
                    sagittal: { ...mpr.sagittal, enabled: true, value: Number(e.target.value) },
                  })
                }
                className="anatomy-slider mt-1 w-full"
                aria-label="Corte sagital en metros"
              />
            </div>

            {/* Transverse plane X */}
            <div className="rounded-md border border-slate-800/80 bg-slate-950/50 px-2.5 py-1.5">
              <div className="flex items-center justify-between gap-1.5 text-[11px]">
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
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      onMprChange({
                        ...mpr,
                        transverse: {
                          ...mpr.transverse,
                          enabled: true,
                          flip: !mpr.transverse.flip,
                        },
                      })
                    }
                    className={`flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-[10px] transition-colors ${
                      mpr.transverse.flip
                        ? 'border-amber-500/60 bg-amber-950/70 text-amber-200'
                        : 'border-slate-700/80 text-slate-400 hover:text-slate-200'
                    }`}
                    title="Invertir segmento visible (Caudal / Craneal)"
                  >
                    <ArrowLeftRight className="h-2.5 w-2.5" />
                    <span>{mpr.transverse.flip ? 'Cra' : 'Cau'}</span>
                  </button>
                  <span className="font-mono text-[11px] text-amber-300 tabular-nums">
                    {mpr.transverse.value >= 0 ? '+' : ''}
                    {mpr.transverse.value.toFixed(2)} m
                  </span>
                </div>
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
                    transverse: { ...mpr.transverse, enabled: true, value: Number(e.target.value) },
                  })
                }
                className="anatomy-slider mt-1 w-full"
                aria-label="Corte transverso en metros"
              />
            </div>

            {/* Dorsal plane Y */}
            <div className="rounded-md border border-slate-800/80 bg-slate-950/50 px-2.5 py-1.5">
              <div className="flex items-center justify-between gap-1.5 text-[11px]">
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
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      onMprChange({
                        ...mpr,
                        dorsal: { ...mpr.dorsal, enabled: true, flip: !mpr.dorsal.flip },
                      })
                    }
                    className={`flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-[10px] transition-colors ${
                      mpr.dorsal.flip
                        ? 'border-emerald-500/60 bg-emerald-950/70 text-emerald-200'
                        : 'border-slate-700/80 text-slate-400 hover:text-slate-200'
                    }`}
                    title="Invertir mitad visible (Ventral / Dorsal)"
                  >
                    <ArrowLeftRight className="h-2.5 w-2.5" />
                    <span>{mpr.dorsal.flip ? 'Dor' : 'Ven'}</span>
                  </button>
                  <span className="font-mono text-[11px] text-emerald-300 tabular-nums">
                    {mpr.dorsal.value.toFixed(2)} m
                  </span>
                </div>
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
                    dorsal: { ...mpr.dorsal, enabled: true, value: Number(e.target.value) },
                  })
                }
                className="anatomy-slider mt-1 w-full"
                aria-label="Corte dorsal en metros"
              />
            </div>
          </div>
        </div>
      )}

      {/* Sub-panel 2: Calibrated Radiograph / CT Reference Plane in Orthographic Projection */}
      {subTab === 'plano' && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-2.5 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => {
                  onCameraProjectionChange('orthographic');
                  onReferencePlaneChange({
                    visible: true,
                    projection: 'LM',
                    opacity: 75,
                    scale: 1.0,
                    offsetX: 0,
                    offsetY: 0,
                    imageUrl: `${import.meta.env.BASE_URL}assets/laminas/rx-guia-lateral-equino.svg`,
                    label: 'Guía ortográfica lateral (LM · cuerpo completo)',
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
                  onCameraProjectionChange('orthographic');
                  onReferencePlaneChange({
                    visible: true,
                    projection: 'LM',
                    opacity: 80,
                    scale: 0.34,
                    offsetX: 0.25,
                    offsetY: -0.76,
                    imageUrl: `${import.meta.env.BASE_URL}assets/laminas/rx-guia-dedo-lm.svg`,
                    label: 'Guía ortográfica distal (LM · eje podofalángico ~52°)',
                  });
                  onSelectPresetCamera?.('distal');
                }}
                className="rounded-lg border border-slate-700/80 bg-slate-950/70 px-2.5 py-1 text-[11px] font-medium text-slate-200 hover:border-cyan-500/60 hover:text-white whitespace-nowrap"
              >
                Guía miembro distal (LM)
              </button>
              <button
                type="button"
                onClick={() => {
                  onCameraProjectionChange('orthographic');
                  onUploadReferenceImage();
                }}
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
                      onClick={() => {
                        onCameraProjectionChange('orthographic');
                        onReferencePlaneChange({ ...referencePlane, projection: proj });
                        if (proj === 'LM') onSelectPresetCamera?.('lat');
                        else if (proj === 'DP') onSelectPresetCamera?.('frontal');
                        else onSelectPresetCamera?.('dorsal');
                      }}
                      className={`rounded px-2 py-0.5 text-[10px] font-mono font-medium ${
                        referencePlane.projection === proj
                          ? 'bg-cyan-500 text-slate-950'
                          : 'text-slate-300 hover:text-white'
                      }`}
                      title={`Alinear plano y vista ortográfica ${proj}`}
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
              Superpone una radiografía o corte tomográfico real (PNG/JPG) en vista ortográfica 1:1 sin distorsión de perspectiva.
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
