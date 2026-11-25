import React from 'react';
import {
  ArrowLeft,
  Camera,
  DraftingCompass,
  Eye,
  EyeOff,
  HeartPulse,
  Home,
  Moon,
  RotateCcw,
  Ruler,
  Scissors,
  Sun,
} from 'lucide-react';
import {
  CutawayMode,
  InventoryReport,
  MeasureToolMode,
  RenderViewMode,
  SceneTheme,
  SexFilter,
} from '../types/proclavet';
import { PWAInstallButton } from './PWAInstallButton';

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
  dissectMode: boolean;
  onToggleDissectMode: () => void;
  measureMode: MeasureToolMode;
  onToggleMeasureMode: (mode: MeasureToolMode) => void;
  hiddenCount: number;
  onRestoreHidden: () => void;
  renderMode: RenderViewMode;
  sceneTheme: SceneTheme;
  onToggleTheme: () => void;
  canStepBack: boolean;
  prevStepLabel?: string;
  onStepBack: () => void;
  isAtHome: boolean;
  onGoHome: () => void;
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
  dissectMode,
  onToggleDissectMode,
  measureMode,
  onToggleMeasureMode,
  hiddenCount,
  onRestoreHidden,
  renderMode,
  sceneTheme,
  onToggleTheme,
  canStepBack,
  prevStepLabel,
  onStepBack,
  isAtHome,
  onGoHome,
  onSnapshot,
  hudHidden,
  onToggleHud,
}) => {
  const isLightBackdrop = sceneTheme === 'atlas' && renderMode === 'anatomico';

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
    <header className="pointer-events-none fixed top-0 left-0 right-0 z-20 flex flex-wrap items-center justify-between gap-1.5 sm:gap-3 px-3 py-2 sm:px-5 sm:py-3.5">
      {/* Left: Brand & quiet unboxed telemetry */}
      <div className="pointer-events-auto flex flex-col gap-0.5">
        <div className="flex items-baseline gap-3">
          <h1
            className={`text-base font-semibold tracking-tight whitespace-nowrap shrink-0 transition-colors ${
              isLightBackdrop ? 'text-slate-900' : 'text-slate-50'
            }`}
          >
            Equus 3D · ProClaVet
          </h1>
          <span
            className={`hidden sm:inline text-xs whitespace-nowrap transition-colors ${
              isLightBackdrop ? 'text-slate-600' : 'text-slate-400'
            }`}
          >
            Atlas de Anatomía Equina por Capas
          </span>
        </div>
        <div
          className={`flex flex-wrap items-center gap-2 text-xs font-mono tabular-nums transition-colors ${
            isLightBackdrop ? 'text-slate-600' : 'text-slate-400'
          }`}
        >
          {report ? (
            <>
              <span>{report.totalRecords.toLocaleString('es-ES')} estructuras</span>
              <span aria-hidden="true">·</span>
              <span>{mounted3DCount} mallas 3D</span>
              {loadedGlbCount > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className={isLightBackdrop ? 'text-emerald-700' : 'text-emerald-300'}>
                    {loadedGlbCount} GLB
                  </span>
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
      <div className="pointer-events-auto flex flex-wrap items-center gap-1.5">
        {/* Sequential Back & Direct Home */}
        {(canStepBack || !isAtHome) && (
          <div
            className="flex items-center rounded-lg border border-slate-700/90 bg-[#0e141d]/95 p-0.5 shadow-sm"
            role="group"
            aria-label="Navegación de regreso"
          >
            <button
              type="button"
              disabled={!canStepBack}
              onClick={onStepBack}
              className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-800 hover:text-white disabled:opacity-40 whitespace-nowrap shrink-0"
              title={
                prevStepLabel
                  ? `Volver un paso atrás (${prevStepLabel})`
                  : 'Volver un paso atrás en secuencia'
              }
            >
              <ArrowLeft className="h-3.5 w-3.5 text-amber-400" />
              <span className="hidden sm:inline">Atrás</span>
            </button>
            <button
              type="button"
              onClick={onGoHome}
              disabled={isAtHome}
              className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-teal-200 transition-colors hover:bg-teal-950/80 hover:text-white disabled:opacity-40 whitespace-nowrap shrink-0"
              title="Volver a Inicio de una sola vez (restaura vista inicial, capas y cámara)"
            >
              <Home className="h-3.5 w-3.5 text-teal-400" />
              <span className="hidden sm:inline">Inicio</span>
            </button>
          </div>
        )}

        {/* Sex filter */}
        <div
          className="flex items-center rounded-lg border border-slate-800 bg-[#0e141d]/95 p-0.5 shadow-sm"
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
          className="hidden md:flex items-center rounded-lg border border-slate-800 bg-[#0e141d]/95 p-0.5 shadow-sm"
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

        {/* Interactive Dissection (click to peel/hide structure) */}
        <button
          type="button"
          onClick={onToggleDissectMode}
          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 shadow-sm ${
            dissectMode
              ? 'border-amber-400 bg-amber-500 text-slate-950'
              : 'border-slate-800 bg-[#0e141d]/95 text-slate-300 hover:border-slate-700 hover:text-white'
          }`}
          title="Modo disección: cada clic sobre el caballo oculta esa estructura capa por capa"
        >
          <Scissors className="h-3.5 w-3.5" />
          <span className="hidden xl:inline">Disección</span>
        </button>

        {/* 3D Distance Ruler & Articular Goniometer */}
        <div
          className="flex items-center rounded-lg border border-slate-800 bg-[#0e141d]/95 p-0.5 shadow-sm"
          role="group"
          aria-label="Medición morfométrica 3D"
        >
          <button
            type="button"
            onClick={() => onToggleMeasureMode(measureMode === 'ruler' ? 'none' : 'ruler')}
            className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              measureMode === 'ruler'
                ? 'bg-cyan-500 text-slate-950'
                : 'text-slate-300 hover:text-white'
            }`}
            title="Regla 3D: mide distancias lineales sobre mallas 3D o plano del suelo (cm/mm/m)"
          >
            <Ruler className="h-3.5 w-3.5" />
            <span className="hidden xl:inline">Regla 3D</span>
          </button>
          <button
            type="button"
            onClick={() =>
              onToggleMeasureMode(measureMode === 'goniometer' ? 'none' : 'goniometer')
            }
            className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              measureMode === 'goniometer'
                ? 'bg-amber-500 text-slate-950'
                : 'text-slate-300 hover:text-white'
            }`}
            title="Goniómetro articular 3D: mide ángulos (3 puntos) en hombro, codo, babilla, corvejón o casco"
          >
            <DraftingCompass className="h-3.5 w-3.5" />
            <span className="hidden xl:inline">Goniómetro</span>
          </button>
        </div>

        {/* Restore hidden structures counter */}
        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={onRestoreHidden}
            className="flex items-center gap-1 rounded-lg border border-teal-500/60 bg-teal-950/90 px-2.5 py-1.5 text-xs font-medium text-teal-200 shadow-sm transition-colors hover:border-teal-400 hover:text-white whitespace-nowrap shrink-0"
            title="Restaurar todas las estructuras ocultas"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="font-mono tabular-nums">+{hiddenCount}</span>
          </button>
        )}

        {/* Biosphera Pearl Atlas Light / Studio Dark backdrop toggle */}
        <button
          type="button"
          onClick={onToggleTheme}
          disabled={renderMode !== 'anatomico'}
          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 shadow-sm disabled:opacity-45 ${
            sceneTheme === 'atlas' && renderMode === 'anatomico'
              ? 'border-sky-400/70 bg-sky-950/90 text-sky-100 hover:border-sky-300'
              : 'border-slate-800 bg-[#0e141d]/95 text-slate-300 hover:border-slate-700 hover:text-white'
          }`}
          title={
            renderMode === 'anatomico'
              ? 'Alternar fondo clínico Atlas Claro (estilo Biosphera) / Estudio Oscuro'
              : 'Disponible en modo Anatómico'
          }
        >
          {sceneTheme === 'atlas' ? (
            <Moon className="h-3.5 w-3.5 text-sky-300" />
          ) : (
            <Sun className="h-3.5 w-3.5 text-amber-300" />
          )}
          <span className="hidden xl:inline">
            {sceneTheme === 'atlas' ? 'Estudio oscuro' : 'Atlas claro'}
          </span>
        </button>

        {/* Vital signs toggle */}
        <button
          type="button"
          onClick={onToggleVitalSigns}
          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 shadow-sm ${
            vitalSigns
              ? 'border-rose-500/60 bg-rose-950/80 text-rose-200'
              : 'border-slate-800 bg-[#0e141d]/95 text-slate-300 hover:border-slate-700 hover:text-white'
          }`}
          title="Animar pulso cardíaco (~38 lpm) y respiración (~14 rpm)"
        >
          <HeartPulse className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Signos vitales</span>
        </button>

        {/* PWA Install (auto-hides when already installed in standalone mode) */}
        <PWAInstallButton />

        {/* Screenshot */}
        <button
          type="button"
          onClick={onSnapshot}
          className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-[#0e141d]/95 px-2.5 py-1.5 text-xs font-medium text-slate-300 shadow-sm transition-colors hover:border-slate-700 hover:text-white whitespace-nowrap shrink-0"
          title="Exportar captura PNG del visor"
        >
          <Camera className="h-3.5 w-3.5" />
          <span className="hidden lg:inline">Captura</span>
        </button>

        {/* Zen mode */}
        <button
          type="button"
          onClick={onToggleHud}
          className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-[#0e141d]/95 px-2.5 py-1.5 text-xs font-medium text-slate-300 shadow-sm transition-colors hover:border-slate-700 hover:text-white whitespace-nowrap shrink-0"
          title="Ocultar controles (H)"
        >
          <EyeOff className="h-3.5 w-3.5" />
          <span className="hidden lg:inline">Ocultar (H)</span>
        </button>
      </div>
    </header>
  );
};

