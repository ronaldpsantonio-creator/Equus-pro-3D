import React from 'react';
import { EyeOff, ImagePlus, RotateCcw, ScanLine, SlidersHorizontal } from 'lucide-react';
import {
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
}

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
}) => {
  const anyMprActive = mpr.sagittal.enabled || mpr.transverse.enabled || mpr.dorsal.enabled;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      {/* Left: Render View Mode & Real-Time CT MPR Slicing */}
      <div className="space-y-3 lg:col-span-6">
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
              <ScanLine className="h-3.5 w-3.5 text-teal-400" />
              <span>Modalidad de visualización 3D</span>
            </span>
            <span className="text-[11px] text-slate-400">
              {renderMode === 'anatomico'
                ? 'PBR vivo'
                : renderMode === 'radiografia'
                  ? 'Atenuación cortical'
                  : 'Contraste óseo'}
            </span>
          </div>

          <div
            className="grid grid-cols-3 gap-1 rounded-lg border border-slate-800 bg-slate-950/70 p-0.5"
            role="group"
            aria-label="Modalidad de visualización 3D"
          >
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
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  renderMode === mode
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
              <SlidersHorizontal className="h-3.5 w-3.5 text-amber-400" />
              <span>Planos de corte multiplanar (MPR tipo TC)</span>
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

          <div className="space-y-2">
            {/* Sagittal plane Z */}
            <div className="rounded-md border border-slate-800/80 bg-slate-950/50 px-2.5 py-1.5">
              <div className="flex items-center justify-between gap-2 text-xs">
                <label className="flex cursor-pointer items-center gap-2 text-slate-200">
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
                  <span>Sagital (Z · izq/der)</span>
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
                className="anatomy-slider mt-1.5 w-full"
                aria-label="Corte sagital en metros"
              />
            </div>

            {/* Transverse plane X */}
            <div className="rounded-md border border-slate-800/80 bg-slate-950/50 px-2.5 py-1.5">
              <div className="flex items-center justify-between gap-2 text-xs">
                <label className="flex cursor-pointer items-center gap-2 text-slate-200">
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
                  <span>Transverso (X · caudal/craneal)</span>
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
                className="anatomy-slider mt-1.5 w-full"
                aria-label="Corte transverso en metros"
              />
            </div>

            {/* Dorsal plane Y */}
            <div className="rounded-md border border-slate-800/80 bg-slate-950/50 px-2.5 py-1.5">
              <div className="flex items-center justify-between gap-2 text-xs">
                <label className="flex cursor-pointer items-center gap-2 text-slate-200">
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
                  <span>Dorsal (Y · suelo/cruz)</span>
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
                className="anatomy-slider mt-1.5 w-full"
                aria-label="Corte dorsal en metros"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Right: Calibrated Radiograph / CT Reference Plane */}
      <div className="space-y-3 lg:col-span-6">
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-200">
              Plano de calibración radiográfica / TC
            </span>
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

          <p className="text-[11px] leading-relaxed text-slate-400">
            Superpone ejes anatómicos esquemáticos o una radiografía / corte tomográfico real
            (PNG/JPG) para contrastar ángulos articulares y proporciones en 1:1.
          </p>

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
              className="rounded-lg border border-slate-700/80 bg-slate-950/70 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:border-cyan-500/60 hover:text-white whitespace-nowrap"
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
              className="rounded-lg border border-slate-700/80 bg-slate-950/70 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:border-cyan-500/60 hover:text-white whitespace-nowrap"
            >
              Guía miembro distal (LM)
            </button>
            <button
              type="button"
              onClick={onUploadReferenceImage}
              className="flex items-center gap-1.5 rounded-lg border border-teal-500/50 bg-teal-950/50 px-2.5 py-1.5 text-xs font-medium text-teal-200 hover:border-teal-400 whitespace-nowrap"
            >
              <ImagePlus className="h-3.5 w-3.5" />
              <span>Cargar Rx / TC (PNG/JPG)</span>
            </button>
          </div>

          {referencePlane.visible && referencePlane.imageUrl ? (
            <div className="space-y-2 border-t border-slate-800 pt-2.5">
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

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <label className="space-y-1">
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

                <label className="space-y-1">
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

                <label className="space-y-1">
                  <div className="flex justify-between text-slate-400">
                    <span>Despl. horizontal</span>
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

                <label className="space-y-1">
                  <div className="flex justify-between text-slate-400">
                    <span>Despl. vertical</span>
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
            <div className="rounded-md border border-slate-800/80 bg-slate-950/50 p-2.5 text-[11px] text-slate-400">
              Decodificador Draco local habilitado sin conexión para modelos{' '}
              <span className="font-mono text-slate-300">.glb</span> segmentados por TC/RM y
              documentados mediante archivo hermano{' '}
              <span className="font-mono text-slate-300">&lt;ID&gt;.meta.json</span>.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
