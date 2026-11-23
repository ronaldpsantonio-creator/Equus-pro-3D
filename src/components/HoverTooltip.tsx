import React from 'react';
import { getCatalogSystem, LAYERS, StructureRecord, SYSTEMS } from '../types/proclavet';

interface HoverTooltipProps {
  structure: StructureRecord | null;
  x: number;
  y: number;
  blindMode: boolean;
}

export const HoverTooltip: React.FC<HoverTooltipProps> = ({
  structure,
  x,
  y,
  blindMode,
}) => {
  if (!structure) return null;

  const sysLabel =
    SYSTEMS.find((s) => s.code === getCatalogSystem(structure))?.label || structure.sys;
  const layerLabel =
    LAYERS.find((l) => l.code === structure.layer)?.shortLabel || structure.layer;

  return (
    <div
      className="pointer-events-none fixed z-30 max-w-xs rounded-lg border border-slate-700/80 bg-[#0e141d]/95 px-3 py-2 shadow-xl"
      style={{
        left: Math.min(x + 16, window.innerWidth - 260),
        top: Math.max(y - 54, 12),
      }}
    >
      <div className="text-xs font-semibold text-slate-50 leading-snug">
        {blindMode ? `Estructura ${structure.id}` : structure.es}
      </div>
      {!blindMode && (
        <div className="mt-0.5 font-serif italic text-[11px] text-amber-300/90 leading-snug">
          {structure.la}
        </div>
      )}
      <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400">
        <span>{sysLabel}</span>
        <span aria-hidden="true">·</span>
        <span>{layerLabel}</span>
      </div>
    </div>
  );
};
