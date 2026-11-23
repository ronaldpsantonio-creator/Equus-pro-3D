import React, { useMemo, useState } from 'react';
import { CheckCircle2, Eye, EyeOff, Search, Star } from 'lucide-react';
import {
  ANATOMY_PLATES,
  FICHA_FIELDS,
  getCatalogSystem,
  LAYERS,
  SexFilter,
  StructureRecord,
  SYSTEMS,
} from '../types/proclavet';

interface CatalogAndFichaTabProps {
  structures: StructureRecord[];
  byId: Record<string, StructureRecord>;
  selectedId: string | null;
  sex: SexFilter;
  blindMode: boolean;
  favorites: Record<string, boolean>;
  notes: Record<string, string>;
  verified: Record<string, boolean>;
  hasMeshFn: (id: string) => boolean;
  getModelStateFn: (id: string) => 'esquemático' | 'cargado' | 'pendiente';
  isVisibleOverrideFn: (id: string) => boolean;
  onSelect: (id: string) => void;
  onFocus: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onToggleStructureVisible: (id: string) => void;
  onUpdateNote: (id: string, note: string) => void;
  onVerifyAndNext: (id: string) => void;
}

type CatalogFilter = 'all' | '3d' | 'ficha' | 'fav';

export const CatalogAndFichaTab: React.FC<CatalogAndFichaTabProps> = ({
  structures,
  byId,
  selectedId,
  sex,
  blindMode,
  favorites,
  notes,
  verified,
  hasMeshFn,
  getModelStateFn,
  isVisibleOverrideFn,
  onSelect,
  onFocus,
  onToggleFavorite,
  onToggleStructureVisible,
  onUpdateNote,
  onVerifyAndNext,
}) => {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<CatalogFilter>('3d');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out: StructureRecord[] = [];
    for (const s of structures) {
      if (s.sex && sex !== 'all' && s.sex !== sex) continue;
      if (filter === '3d' && !hasMeshFn(s.id)) continue;
      if (filter === 'ficha' && (!s.ficha || Object.keys(s.ficha).length === 0)) continue;
      if (filter === 'fav' && !favorites[s.id]) continue;
      if (q) {
        const hay = `${s.es} ${s.la} ${s.id}`.toLowerCase();
        if (!hay.includes(q)) continue;
      }
      out.push(s);
    }
    return out;
  }, [structures, sex, filter, query, favorites, hasMeshFn]);

  const pinnedRibs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (filter === 'fav') return [];
    const ids = ['equ.ske.cos.018-i', 'equ.ske.cos.018-d'];
    return ids
      .map((id) => byId[id])
      .filter(
        (s): s is StructureRecord =>
          !!s && (!q || 'costilla 18 costa 18'.includes(q) || s.es.toLowerCase().includes(q)),
      );
  }, [byId, query, filter]);

  const visibleList = filtered.slice(0, 90);
  const selected = selectedId ? byId[selectedId] : null;
  const plate = selected && !blindMode ? ANATOMY_PLATES[selected.id] : undefined;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      {/* Left: Searchable structure list */}
      <div className="flex flex-col gap-2 lg:col-span-5">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar estructura (español, latín NAV o ID)…"
            className="w-full rounded-lg border border-slate-700/80 bg-slate-900/90 py-1.5 pr-3 pl-8 text-xs text-slate-100 placeholder:text-slate-500 focus:border-amber-500 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-800 bg-slate-900/60 p-0.5">
          {(
            [
              ['3d', 'Con malla 3D'],
              ['ficha', 'Con ficha'],
              ['fav', 'Favoritas'],
              ['all', 'Todas (3.856)'],
            ] as const
          ).map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => setFilter(val)}
              className={`flex-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors whitespace-nowrap ${
                filter === val
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="anatomy-scroll h-56 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/50 divide-y divide-slate-800/70">
          {pinnedRibs.length > 0 && (
            <div className="bg-slate-900/70 px-3 py-1.5 text-[10px] font-semibold tracking-wider text-amber-400 uppercase">
              Acceso directo · Costilla 18
            </div>
          )}
          {pinnedRibs.map((s) => {
            const isSel = selectedId === s.id;
            return (
              <div
                key={`pin-${s.id}`}
                onClick={() => {
                  onSelect(s.id);
                  if (hasMeshFn(s.id)) onFocus(s.id);
                }}
                className={`flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-xs transition-colors ${
                  isSel ? 'bg-teal-950/60 text-teal-200' : 'hover:bg-slate-900/70 text-slate-200'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">
                    {blindMode ? s.id : s.es}
                  </div>
                  <div className="truncate font-serif italic text-[11px] text-slate-400">
                    {blindMode ? 'nombre oculto' : s.la}
                  </div>
                </div>
              </div>
            );
          })}

          {visibleList.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-slate-400">
              No hay estructuras que coincidan con este filtro.
            </div>
          ) : (
            visibleList.map((s) => {
              const isSel = selectedId === s.id;
              const is3D = hasMeshFn(s.id);
              const vis = isVisibleOverrideFn(s.id);
              const sysColor =
                SYSTEMS.find((sy) => sy.code === getCatalogSystem(s))?.color || '#94a3b8';

              return (
                <div
                  key={s.id}
                  onClick={() => {
                    onSelect(s.id);
                    if (is3D) onFocus(s.id);
                  }}
                  className={`flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-xs transition-colors ${
                    isSel ? 'bg-teal-950/60' : 'hover:bg-slate-900/70'
                  }`}
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: sysColor }}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`truncate font-medium ${
                          isSel ? 'text-teal-200' : 'text-slate-100'
                        }`}
                      >
                        {blindMode ? s.id : s.es}
                      </span>
                      {verified[s.id] && (
                        <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-400" />
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 truncate">
                      <span className="font-serif italic truncate">
                        {blindMode ? 'nombre oculto' : s.la}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono text-[10px]">
                        {is3D ? getModelStateFn(s.id) : 'sin malla'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(s.id);
                      }}
                      className={`rounded p-1 transition-colors ${
                        favorites[s.id]
                          ? 'text-amber-400'
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                      title="Marcar favorito"
                    >
                      <Star className="h-3.5 w-3.5" fill={favorites[s.id] ? 'currentColor' : 'none'} />
                    </button>
                    {is3D && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleStructureVisible(s.id);
                        }}
                        className="rounded p-1 text-slate-400 transition-colors hover:text-white"
                        title={vis ? 'Ocultar en 3D' : 'Mostrar en 3D'}
                      >
                        {vis ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5 text-slate-600" />}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
          {filtered.length > visibleList.length && (
            <div className="px-3 py-2 text-center text-[11px] text-slate-400">
              Mostrando {visibleList.length} de {filtered.length.toLocaleString('es-ES')} resultados. Refina tu búsqueda.
            </div>
          )}
        </div>
      </div>

      {/* Right: Official 12-section anatomical Ficha */}
      <div className="anatomy-scroll h-68 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/50 p-4 lg:col-span-7">
        {!selected ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-xs text-slate-400">
            <p className="font-medium text-slate-300">
              Selecciona una estructura en el visor 3D o en la lista
            </p>
            <p className="mt-1 max-w-md text-slate-500">
              Aquí verás su nomenclatura oficial (NAV), descripción anatómica en 12 apartados,
              láminas didácticas y tus notas de estudio.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="border-b border-slate-800 pb-2.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-50">
                  {blindMode ? selected.id : selected.es}
                </h3>
                <span className="font-mono text-[11px] text-slate-400">{selected.id}</span>
              </div>
              {!blindMode && (
                <p className="font-serif italic text-xs text-amber-300">{selected.la} (NAV)</p>
              )}
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                <span>
                  {SYSTEMS.find((sy) => sy.code === getCatalogSystem(selected))?.label}
                </span>
                <span aria-hidden="true">·</span>
                <span>{LAYERS.find((l) => l.code === selected.layer)?.label}</span>
                <span aria-hidden="true">·</span>
                <span>
                  Modelo 3D:{' '}
                  {getModelStateFn(selected.id) === 'cargado'
                    ? `GLB verificado (${selected.licencia || 'sin documentar'})`
                    : getModelStateFn(selected.id) === 'esquemático'
                      ? 'representación anatómica procedural'
                      : 'pendiente de modelo 3D'}
                </span>
              </div>
            </div>

            {plate && (
              <figure className="rounded-lg border border-slate-800 bg-slate-900/70 p-2.5">
                <img
                  src={plate.src}
                  alt={plate.alt}
                  referrerPolicy="no-referrer"
                  className="mx-auto max-h-44 w-auto rounded bg-white/95 p-1.5"
                />
                <figcaption className="mt-1.5 text-[11px] text-slate-400">
                  {plate.caption}
                </figcaption>
              </figure>
            )}

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {FICHA_FIELDS.map(([key, label]) => {
                const val = selected.ficha?.[key];
                return (
                  <div key={key} className="rounded-md border border-slate-800/80 bg-slate-900/40 p-2.5">
                    <div className="text-[11px] font-semibold text-slate-300">{label}</div>
                    <div className="mt-1 text-xs leading-relaxed text-slate-200">
                      {val ? (
                        val
                      ) : (
                        <span className="text-amber-500/80">
                          Pendiente: sin información verificada
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col gap-2 border-t border-slate-800 pt-3 sm:flex-row sm:items-start">
              <div className="flex-1">
                <label className="block text-[11px] font-medium text-slate-300">
                  Notas personales
                </label>
                <textarea
                  rows={2}
                  value={notes[selected.id] || ''}
                  onChange={(e) => onUpdateNote(selected.id, e.target.value)}
                  placeholder="Anotaciones clínicas o de disección…"
                  className="mt-1 w-full rounded-lg border border-slate-700/80 bg-slate-900/80 px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div className="sm:w-56 sm:pt-5">
                <button
                  type="button"
                  onClick={() => onVerifyAndNext(selected.id)}
                  className={`w-full rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                    verified[selected.id]
                      ? 'border border-emerald-500/50 bg-emerald-950/70 text-emerald-200 hover:bg-emerald-900/70'
                      : 'bg-teal-500 text-slate-950 hover:bg-teal-400'
                  }`}
                >
                  {verified[selected.id]
                    ? 'Verificado · siguiente'
                    : 'Marcar verificado y siguiente'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
