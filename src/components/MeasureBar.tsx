import React from 'react';
import {
  Check,
  Crosshair,
  DraftingCompass,
  Ruler,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import {
  MeasurementRecord,
  MeasurePoint,
  MeasureToolMode,
  MeasureUnit,
} from '../types/proclavet';
import {
  EQUINE_MEASURE_PRESETS,
  EquineMeasurePreset,
  formatMeasureDistance,
} from '../three/measurementOverlay';

interface MeasureBarProps {
  measureMode: MeasureToolMode;
  onMeasureModeChange: (mode: MeasureToolMode) => void;
  measureUnit: MeasureUnit;
  onMeasureUnitChange: (unit: MeasureUnit) => void;
  measurements: MeasurementRecord[];
  draftPoints: MeasurePoint[];
  onUndoDraftPoint: () => void;
  onDeleteMeasurement: (id: string) => void;
  onClearMeasurements: () => void;
  onFocusPoint: (pos: [number, number, number]) => void;
  onApplyPreset: (preset: EquineMeasurePreset) => void;
}

export const MeasureBar: React.FC<MeasureBarProps> = ({
  measureMode,
  onMeasureModeChange,
  measureUnit,
  onMeasureUnitChange,
  measurements,
  draftPoints,
  onUndoDraftPoint,
  onDeleteMeasurement,
  onClearMeasurements,
  onFocusPoint,
  onApplyPreset,
}) => {
  if (measureMode === 'none' && measurements.length === 0) return null;

  const getStepHint = (): string => {
    if (measureMode === 'ruler') {
      return draftPoints.length === 0
        ? 'Paso 1/2: haz clic en el punto inicial (estructura 3D o plano del suelo)'
        : 'Paso 2/2: haz clic en el punto final (arrastra para rotar la cámara)';
    }
    if (measureMode === 'goniometer') {
      if (draftPoints.length === 0) return 'Paso 1/3: marca el brazo proximal';
      if (draftPoints.length === 1) return 'Paso 2/3: marca el vértice articular';
      return 'Paso 3/3: marca el brazo distal para cerrar el ángulo';
    }
    return `Mediciones 3D en pantalla (${measurements.length})`;
  };

  const savedIds = new Set(measurements.map((m) => m.id));

  return (
    <div className="mb-2 space-y-2 rounded-xl border border-slate-700/80 bg-[#0e141d]/95 px-3.5 py-2.5 shadow-xl">
      {/* Top Row: Tool Switcher, Step Guidance, Units & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <div
            className="flex items-center rounded-lg border border-slate-800 bg-slate-950/70 p-0.5"
            role="group"
            aria-label="Herramienta de medición 3D"
          >
            <button
              type="button"
              onClick={() => onMeasureModeChange(measureMode === 'ruler' ? 'none' : 'ruler')}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                measureMode === 'ruler'
                  ? 'bg-cyan-500 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
              title="Regla 3D de distancia punto a punto"
            >
              <Ruler className="h-3.5 w-3.5" />
              <span>Regla 3D</span>
            </button>
            <button
              type="button"
              onClick={() =>
                onMeasureModeChange(measureMode === 'goniometer' ? 'none' : 'goniometer')
              }
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                measureMode === 'goniometer'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
              title="Goniómetro articular de 3 puntos (proximal → vértice → distal)"
            >
              <DraftingCompass className="h-3.5 w-3.5" />
              <span>Goniómetro</span>
            </button>
          </div>

          <span
            className={`text-xs truncate ${
              measureMode === 'ruler'
                ? 'text-cyan-200'
                : measureMode === 'goniometer'
                  ? 'text-amber-200'
                  : 'text-slate-300'
            }`}
          >
            {getStepHint()}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          {/* Unit switcher */}
          <div
            className="flex items-center rounded-lg border border-slate-800 bg-slate-950/70 p-0.5"
            role="group"
            aria-label="Unidad de longitud"
          >
            {(['cm', 'mm', 'm'] as MeasureUnit[]).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => onMeasureUnitChange(u)}
                className={`rounded px-2 py-0.5 font-mono text-[11px] font-medium transition-colors ${
                  measureUnit === u
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {u}
              </button>
            ))}
          </div>

          {draftPoints.length > 0 && (
            <button
              type="button"
              onClick={onUndoDraftPoint}
              className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900/80 px-2 py-1 text-[11px] font-medium text-slate-200 transition-colors hover:border-slate-500 hover:text-white whitespace-nowrap"
              title="Deshacer último punto marcado"
            >
              <Undo2 className="h-3 w-3" />
              <span>Deshacer punto</span>
            </button>
          )}

          {measurements.length > 0 && (
            <button
              type="button"
              onClick={onClearMeasurements}
              className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900/80 px-2 py-1 text-[11px] font-medium text-rose-200 transition-colors hover:border-rose-500/60 hover:text-white whitespace-nowrap"
              title="Eliminar todas las mediciones"
            >
              <Trash2 className="h-3 w-3" />
              <span>Limpiar</span>
            </button>
          )}

          {measureMode !== 'none' && (
            <button
              type="button"
              onClick={() => onMeasureModeChange('none')}
              className="flex items-center gap-1 rounded-lg border border-teal-500/50 bg-teal-950/70 px-2.5 py-1 text-[11px] font-medium text-teal-200 transition-colors hover:border-teal-400 hover:text-white whitespace-nowrap"
              title="Salir del modo medición manteniendo las medidas en pantalla (Esc)"
            >
              <Check className="h-3 w-3" />
              <span>Finalizar</span>
            </button>
          )}
        </div>
      </div>

      {/* Quick Clinical Equine Biomechanical Presets */}
      {measureMode !== 'none' && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-800/80 pt-2">
          <span className="text-[11px] font-medium text-slate-400 mr-1 whitespace-nowrap">
            Referencias equinas:
          </span>
          {EQUINE_MEASURE_PRESETS.map((preset) => {
            const active = savedIds.has(preset.id);
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onApplyPreset(preset)}
                title={preset.description}
                className={`rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'border-amber-500/60 bg-amber-950/60 text-amber-200'
                    : 'border-slate-700/80 bg-slate-900/70 text-slate-300 hover:border-slate-500 hover:text-white'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Saved Measurements Strip */}
      {measurements.length > 0 && (
        <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto border-t border-slate-800/80 pt-2">
          {measurements.map((rec, idx) => {
            const isRuler = rec.kind === 'ruler';
            const valueText = isRuler
              ? formatMeasureDistance(rec.distanceMeters, measureUnit)
              : `${rec.angleDeg.toFixed(1)}° · sup. ${rec.supplementDeg.toFixed(1)}°`;
            const focusTarget: [number, number, number] = isRuler
              ? [
                  (rec.points[0].position[0] + rec.points[1].position[0]) * 0.5,
                  (rec.points[0].position[1] + rec.points[1].position[1]) * 0.5,
                  (rec.points[0].position[2] + rec.points[1].position[2]) * 0.5,
                ]
              : rec.points[1].position;

            const pointNames = rec.points
              .map((p) => p.structureName)
              .filter((n): n is string => !!n);
            const subtitle =
              rec.label ||
              (pointNames.length > 0
                ? pointNames.slice(0, 2).join(' → ')
                : `${isRuler ? 'Distancia' : 'Ángulo'} #${idx + 1}`);

            return (
              <div
                key={rec.id}
                className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] ${
                  isRuler
                    ? 'border-cyan-500/40 bg-cyan-950/35 text-cyan-100'
                    : 'border-amber-500/40 bg-amber-950/35 text-amber-100'
                }`}
              >
                {isRuler ? (
                  <Ruler className="h-3 w-3 shrink-0 text-cyan-300" />
                ) : (
                  <DraftingCompass className="h-3 w-3 shrink-0 text-amber-300" />
                )}
                <button
                  type="button"
                  onClick={() => onFocusPoint(focusTarget)}
                  className="flex items-center gap-1.5 text-left transition-colors hover:text-white"
                  title="Enfocar cámara en esta medición"
                >
                  <span className="font-mono font-semibold tabular-nums">{valueText}</span>
                  <span className="max-w-[165px] truncate text-slate-300">{subtitle}</span>
                  <Crosshair className="h-3 w-3 shrink-0 text-slate-400" />
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteMeasurement(rec.id)}
                  className="rounded p-0.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
                  aria-label={`Eliminar medición ${subtitle}`}
                  title="Eliminar esta medición"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
