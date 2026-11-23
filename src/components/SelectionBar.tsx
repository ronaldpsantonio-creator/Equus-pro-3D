import React from 'react';
import { Crosshair, FileText, Focus, Maximize2, Upload, X } from 'lucide-react';
import {
  formatRevisionEstado,
  getCatalogSystem,
  LAYERS,
  StructureRecord,
  SYSTEMS,
} from '../types/proclavet';

interface SelectionBarProps {
  structure: StructureRecord | null;
  modelState: 'esquemático' | 'cargado' | 'pendiente';
  hasMesh: boolean;
  blindMode: boolean;
  isolated: boolean;
  onOpenFicha: () => void;
  onFocus: () => void;
  onIsolate: () => void;
  onShowAll: () => void;
  onUploadGlb: () => void;
  onClear: () => void;
}

export const SelectionBar: React.FC<SelectionBarProps> = ({
  structure,
  modelState,
  hasMesh,
  blindMode,
  isolated,
  onOpenFicha,
  onFocus,
  onIsolate,
  onShowAll,
  onUploadGlb,
  onClear,
}) => {
  if (!structure) return null;

  const sysLabel =
    SYSTEMS.find((s) => s.code === getCatalogSystem(structure))?.label || structure.sys;
  const layerLabel = LAYERS.find((l) => l.code === structure.layer)?.label || structure.layer;
  const hasFicha = !!(structure.ficha && Object.keys(structure.ficha).length > 0);
  const revEstado = structure.revision?.estado;
  const traceCount = structure.trazabilidad_ids?.length || 0;

  return (
    <div className="mb-2 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-700/80 bg-[#0e141d]/95 px-4 py-2.5 shadow-xl">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
          <span className="text-sm font-semibold text-teal-300 truncate">
            {blindMode ? `Estructura oculta (${structure.id})` : structure.es}
          </span>
          {!blindMode && (
            <span className="font-serif italic text-xs text-slate-300 truncate">
              {structure.la}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
          <span>{sysLabel}</span>
          <span aria-hidden="true">·</span>
          <span>{layerLabel}</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono">{structure.id}</span>
          <span aria-hidden="true">·</span>
          <span>
            {modelState === 'cargado'
              ? 'GLB verificado'
              : modelState === 'esquemático'
                ? 'Malla 3D anatómica'
                : 'Sin malla 3D'}
          </span>
          {hasFicha && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-amber-300">Ficha disponible</span>
            </>
          )}
          {revEstado && (
            <>
              <span aria-hidden="true">·</span>
              <span
                className={
                  revEstado === 'aprobada_y_verificada' ||
                  revEstado === 'verificada' ||
                  revEstado === 'aprobada'
                    ? 'text-emerald-300/90'
                    : 'text-amber-300/90'
                }
              >
                {formatRevisionEstado(revEstado)}
              </span>
            </>
          )}
          {traceCount > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span>{traceCount} ID{traceCount === 1 ? '' : 's'} de trazabilidad</span>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
        {!blindMode && (
          <button
            type="button"
            onClick={onOpenFicha}
            className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-950 transition-colors hover:bg-amber-400 whitespace-nowrap"
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Ver ficha</span>
          </button>
        )}
        {hasMesh && (
          <button
            type="button"
            onClick={onFocus}
            className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:border-slate-500 hover:text-white whitespace-nowrap"
            title="Acercar cámara a la estructura"
          >
            <Crosshair className="h-3.5 w-3.5" />
            <span>Enfocar</span>
          </button>
        )}
        {hasMesh && (
          <button
            type="button"
            onClick={isolated ? onShowAll : onIsolate}
            className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              isolated
                ? 'border-teal-500/60 bg-teal-950/70 text-teal-200'
                : 'border-slate-700 bg-slate-800/80 text-slate-200 hover:border-slate-500'
            }`}
          >
            {isolated ? (
              <>
                <Maximize2 className="h-3.5 w-3.5" />
                <span>Mostrar todo</span>
              </>
            ) : (
              <>
                <Focus className="h-3.5 w-3.5" />
                <span>Aislar</span>
              </>
            )}
          </button>
        )}
        <button
          type="button"
          onClick={onUploadGlb}
          className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:border-slate-500 hover:text-white whitespace-nowrap"
          title="Probar archivo .glb local en esta estructura"
        >
          <Upload className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Cargar GLB</span>
        </button>
        <button
          type="button"
          onClick={onClear}
          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
          aria-label="Deseleccionar estructura"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
