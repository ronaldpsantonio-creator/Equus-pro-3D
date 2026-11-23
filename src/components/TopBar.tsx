import React from 'react';
import { Camera, Eye, EyeOff, HeartPulse } from 'lucide-react';
import { CutawayMode, InventoryReport, SexFilter } from '../types/proclavet';

interface TopBarProps {
  report: InventoryReport | null;
  mounted3DCount: number;
  loadedGlbCount: number;
  sex: SexFilter;
  onSexChange: (sex: SexFilter) => void;
  cutaway: CutawayMode;
  onCutawayChange: (mode: CutawayMode) => void;
  vitalSigns: boolean;
  onToggleVitalSigns: () => void;
  onSnapshot: () => void;
  hudHidden: boolean;
  onToggleHud: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  report,
  mounted3DCount,
  loadedGlbCount,
  sex,
  onSexChange,
  cutaway,
  onCutawayChange,
  vitalSigns,
  onToggleVitalSigns,
  onSnapshot,
  hudHidden,
  onToggleHud,
}) => {
  if (hudHidden) {
    return (
      <div className="pointer-events-none fixed top-4 right-5 z-20 flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleHud}
          className="pointer-events-auto flex items-center gap-2 rounded-lg border border-slate-700/70 bg-[#0e141d]/95 px-3.5 py-2 text-xs font-medium text-slate-200 shadow-lg transition-colors hover:border-amber-500/50 hover:text-white whitespace-nowrap shrink-0"
          title="Mostrar controles (H)"
        >
          <Eye className="h-3.5 w-3.5 text-amber-400" />
          <span>Mostrar interfaz (H)</span>
        </button>
      </div>
    );
  }

  return (
    <header className="pointer-events-none fixed top-0 left-0 right-0 z-20 flex flex-wrap items-center justify-between gap-4 px-5 py-3.5">
      {/* Left: Brand & quiet unboxed telemetry */}
      <div className="pointer-events-auto flex flex-col gap-0.5">
        <div className="flex items-baseline gap-3">
          <h1 className="text-base font-semibold tracking-tight text-slate-50 whitespace-nowrap shrink-0">
            Equus 3D · ProClaVet
          </h1>
          <span className="hidden sm:inline text-xs text-slate-400 whitespace-nowrap">
            Atlas de Anatomía Equina por Capas
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 font-mono tabular-nums">
          {report ? (
            <>
              <span>{report.totalRecords.toLocaleString('es-ES')} estructuras</span>
              <span aria-hidden="true">·</span>
              <span>{mounted3DCount} mallas 3D</span>
              {loadedGlbCount > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-emerald-300">{loadedGlbCount} GLB</span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span>{report.withFichaCount} fichas</span>
              <span aria-hidden="true">·</span>
              <span>12 sistemas</span>
            </>
          ) : (
            <span>Cargando catálogos anatómicos…</span>
          )}
        </div>
      </div>

      {/* Right: Single-line quick clinical viewport controls */}
      <div className="pointer-events-auto flex flex-wrap items-center gap-2">
        {/* Sex filter */}
        <div
          className="flex items-center rounded-lg border border-slate-800 bg-[#0e141d]/95 p-0.5"
          role="group"
          aria-label="Filtro por sexo anatómico"
        >
          {(
            [
              ['all', 'Todos'],
              ['m', 'Caballo ♂'],
              ['f', 'Yegua ♀'],
            ] as const
          ).map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => onSexChange(val)}
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                sex === val
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Sagittal cutaway toggle */}
        <div
          className="hidden md:flex items-center rounded-lg border border-slate-800 bg-[#0e141d]/95 p-0.5"
          role="group"
          aria-label="Corte sagital por capas"
        >
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
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                cutaway === val
                  ? 'bg-teal-500 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Vital signs toggle */}
        <button
          type="button"
          onClick={onToggleVitalSigns}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
            vitalSigns
              ? 'border-rose-500/60 bg-rose-950/80 text-rose-200'
              : 'border-slate-800 bg-[#0e141d]/95 text-slate-300 hover:border-slate-700 hover:text-white'
          }`}
          title="Animar pulso cardíaco (~38 lpm) y respiración (~14 rpm)"
        >
          <HeartPulse className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Signos vitales</span>
        </button>

        {/* Screenshot */}
        <button
          type="button"
          onClick={onSnapshot}
          className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-[#0e141d]/95 px-2.5 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-slate-700 hover:text-white whitespace-nowrap shrink-0"
          title="Exportar captura PNG del visor"
        >
          <Camera className="h-3.5 w-3.5" />
          <span className="hidden lg:inline">Captura</span>
        </button>

        {/* Zen mode */}
        <button
          type="button"
          onClick={onToggleHud}
          className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-[#0e141d]/95 px-2.5 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-slate-700 hover:text-white whitespace-nowrap shrink-0"
          title="Ocultar controles (H)"
        >
          <EyeOff className="h-3.5 w-3.5" />
          <span className="hidden lg:inline">Ocultar (H)</span>
        </button>
      </div>
    </header>
  );
};
