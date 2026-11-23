import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  FilePenLine,
  GitBranch,
  RotateCcw,
  Search,
  ShieldCheck,
  Star,
} from 'lucide-react';
import {
  ANATOMY_PLATES,
  FICHA_FIELDS,
  FichaData,
  formatRevisionEstado,
  getCatalogSystem,
  LAYERS,
  LoadedModelMeta,
  SexFilter,
  StructureRecord,
  SYSTEMS,
  SystemCode,
} from '../types/proclavet';

interface CatalogAndFichaTabProps {
  structures: StructureRecord[];
  byId: Record<string, StructureRecord>;
  byTraceabilityId: Record<string, StructureRecord>;
  selectedId: string | null;
  sex: SexFilter;
  blindMode: boolean;
  favorites: Record<string, boolean>;
  notes: Record<string, string>;
  verified: Record<string, boolean>;
  fichaDrafts: Record<string, FichaData>;
  loadedModelMeta: Record<string, LoadedModelMeta>;
  hasMeshFn: (id: string) => boolean;
  getModelStateFn: (id: string) => 'esquemático' | 'cargado' | 'pendiente';
  isVisibleOverrideFn: (id: string) => boolean;
  onSelect: (id: string) => void;
  onFocus: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onToggleStructureVisible: (id: string) => void;
  onUpdateNote: (id: string, note: string) => void;
  onUpdateFichaDraft: (id: string, nextFicha: FichaData) => void;
  onClearFichaDraft: (id: string) => void;
  onVerifyAndNext: (id: string) => void;
}

type CatalogFilter = 'all' | '3d' | 'ficha' | 'pend' | 'fav';

function getEffectiveFicha(s: StructureRecord, drafts: Record<string, FichaData>): FichaData | undefined {
  const draft = drafts[s.id];
  if (!s.ficha && !draft) return undefined;
  return { ...(s.ficha || {}), ...(draft || {}) };
}

function hasEffectiveFicha(s: StructureRecord, drafts: Record<string, FichaData>): boolean {
  const eff = getEffectiveFicha(s, drafts);
  return !!(eff && Object.values(eff).some((v) => typeof v === 'string' && v.trim().length > 0));
}

function downloadJsonFile(filename: string, payload: unknown): void {
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const CatalogAndFichaTab: React.FC<CatalogAndFichaTabProps> = ({
  structures,
  byId,
  byTraceabilityId,
  selectedId,
  sex,
  blindMode,
  favorites,
  notes,
  verified,
  fichaDrafts,
  loadedModelMeta,
  hasMeshFn,
  getModelStateFn,
  isVisibleOverrideFn,
  onSelect,
  onFocus,
  onToggleFavorite,
  onToggleStructureVisible,
  onUpdateNote,
  onUpdateFichaDraft,
  onClearFichaDraft,
  onVerifyAndNext,
}) => {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<CatalogFilter>('3d');
  const [systemFilter, setSystemFilter] = useState<'all' | SystemCode>('all');
  const [showCoverage, setShowCoverage] = useState(false);
  const [editingFicha, setEditingFicha] = useState(false);

  useEffect(() => {
    setEditingFicha(false);
  }, [selectedId]);

  const trimmedQuery = query.trim().toLowerCase();

  const coverageStats = useMemo(() => {
    const perSys = SYSTEMS.map((sys) => ({
      code: sys.code,
      label: sys.label,
      color: sys.color,
      file: sys.file,
      total: 0,
      withFicha: 0,
      audited: 0,
      withDraft: 0,
    }));
    const bySys = Object.fromEntries(perSys.map((r) => [r.code, r])) as Record<
      SystemCode,
      (typeof perSys)[number]
    >;

    let totalFichas = 0;
    let totalAudited = 0;

    for (const s of structures) {
      const cat = getCatalogSystem(s);
      const row = bySys[cat];
      if (!row) continue;
      row.total++;
      if (hasEffectiveFicha(s, fichaDrafts)) {
        row.withFicha++;
        totalFichas++;
      }
      if (
        s.revision?.estado === 'aprobada_y_verificada' ||
        s.revision?.estado === 'verificada' ||
        s.revision?.estado === 'aprobada'
      ) {
        row.audited++;
        totalAudited++;
      }
      if (fichaDrafts[s.id]) {
        row.withDraft++;
      }
    }

    return {
      perSys,
      totalRecords: structures.length,
      totalFichas,
      totalAudited,
      totalDrafts: Object.keys(fichaDrafts).length,
      totalGlbs: Object.keys(loadedModelMeta).length,
    };
  }, [structures, fichaDrafts, loadedModelMeta]);

  const filtered = useMemo(() => {
    const out: StructureRecord[] = [];
    for (const s of structures) {
      if (s.sex && sex !== 'all' && s.sex !== sex) continue;
      if (systemFilter !== 'all' && getCatalogSystem(s) !== systemFilter) continue;
      if (filter === '3d' && !hasMeshFn(s.id)) continue;
      if (filter === 'ficha' && !hasEffectiveFicha(s, fichaDrafts)) continue;
      if (filter === 'pend' && hasEffectiveFicha(s, fichaDrafts)) continue;
      if (filter === 'fav' && !favorites[s.id]) continue;
      if (trimmedQuery) {
        const traceHay = s.trazabilidad_ids ? s.trazabilidad_ids.join(' ') : '';
        const hay = `${s.es} ${s.la} ${s.id} ${traceHay}`.toLowerCase();
        if (!hay.includes(trimmedQuery)) continue;
      }
      out.push(s);
    }
    return out;
  }, [structures, sex, systemFilter, filter, trimmedQuery, favorites, fichaDrafts, hasMeshFn]);

  const pinnedRibs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (filter === 'fav' || (systemFilter !== 'all' && systemFilter !== 'ske')) return [];
    const ids = ['equ.ske.cos.018-i', 'equ.ske.cos.018-d'];
    return ids
      .map((id) => byId[id])
      .filter(
        (s): s is StructureRecord =>
          !!s && (!q || 'costilla 18 costa 18'.includes(q) || s.es.toLowerCase().includes(q)),
      );
  }, [byId, query, filter, systemFilter]);

  const visibleList = filtered.slice(0, 90);
  const selected = selectedId ? byId[selectedId] : null;
  const effectiveSelectedFicha = selected ? getEffectiveFicha(selected, fichaDrafts) : undefined;
  const selectedHasDraft = selected ? !!fichaDrafts[selected.id] : false;
  const plate = selected && !blindMode ? ANATOMY_PLATES[selected.id] : undefined;

  const handleExportSingleFicha = () => {
    if (!selected) return;
    const today = new Date().toISOString().slice(0, 10);
    const updatedRecord: StructureRecord = {
      ...selected,
      ficha: effectiveSelectedFicha || {},
      revision: selectedHasDraft
        ? {
            estado: 'redactada_pendiente_de_verificacion',
            fecha: today,
            alcance:
              'Ficha redactada o actualizada desde Equus 3D · ProClaVet siguiendo el estándar oficial; pendiente de verificación documental.',
          }
        : selected.revision,
    };
    downloadJsonFile(`${selected.id}.ficha.json`, updatedRecord);
  };

  const handleExportSystemCatalog = (sysCode: SystemCode) => {
    const sysEntry = SYSTEMS.find((s) => s.code === sysCode);
    if (!sysEntry) return;
    const today = new Date().toISOString().slice(0, 10);
    const records = structures
      .filter((s) => getCatalogSystem(s) === sysCode)
      .map((s) => {
        const clean = { ...s };
        delete clean._catalog;
        if (fichaDrafts[s.id]) {
          clean.ficha = getEffectiveFicha(s, fichaDrafts);
          clean.revision = {
            estado: 'redactada_pendiente_de_verificacion',
            fecha: today,
            alcance:
              'Ficha redactada o actualizada desde Equus 3D · ProClaVet; pendiente de verificación documental.',
          };
        }
        return clean;
      });
    downloadJsonFile(sysEntry.file, { estructuras: records });
  };

  const showingCoveragePanel = showCoverage || !selected;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      {/* Left: Searchable structure list */}
      <div className="flex flex-col gap-2 lg:col-span-5">
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar (español, latín NAV, ID o histórico)…"
              className="w-full rounded-lg border border-slate-700/80 bg-slate-900/90 py-1.5 pr-3 pl-8 text-xs text-slate-100 placeholder:text-slate-500 focus:border-amber-500 focus:outline-none"
            />
          </div>
          <select
            value={systemFilter}
            onChange={(e) => setSystemFilter(e.target.value as 'all' | SystemCode)}
            aria-label="Filtrar por catálogo de sistema"
            className="max-w-[140px] rounded-lg border border-slate-700/80 bg-slate-900/90 px-2 py-1.5 text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
          >
            <option value="all">12 sistemas</option>
            {SYSTEMS.map((s) => (
              <option key={s.code} value={s.code}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-800 bg-slate-900/60 p-0.5">
          {(
            [
              ['3d', 'Malla 3D'],
              ['ficha', 'Con ficha'],
              ['pend', 'Sin ficha'],
              ['fav', 'Fav.'],
              ['all', `Todas (${structures.length.toLocaleString('es-ES')})`],
            ] as const
          ).map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => setFilter(val)}
              className={`flex-1 rounded-md px-1.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap ${
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
                  setShowCoverage(false);
                  onSelect(s.id);
                  if (hasMeshFn(s.id)) onFocus(s.id);
                }}
                className={`flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-xs transition-colors ${
                  isSel ? 'bg-teal-950/60 text-teal-200' : 'hover:bg-slate-900/70 text-slate-200'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{blindMode ? s.id : s.es}</div>
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
              const hasDraft = !!fichaDrafts[s.id];
              const sysColor =
                SYSTEMS.find((sy) => sy.code === getCatalogSystem(s))?.color || '#94a3b8';

              const matchedTraceId =
                trimmedQuery && s.trazabilidad_ids
                  ? s.trazabilidad_ids.find(
                      (tid) => tid !== s.id && tid.toLowerCase().includes(trimmedQuery),
                    )
                  : undefined;

              return (
                <div
                  key={s.id}
                  onClick={() => {
                    setShowCoverage(false);
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
                      {(verified[s.id] ||
                        s.revision?.estado === 'aprobada_y_verificada' ||
                        s.revision?.estado === 'verificada') && (
                        <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-400" />
                      )}
                      {hasDraft && (
                        <span className="font-mono text-[9px] text-amber-300 shrink-0">
                          borrador
                        </span>
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
                      {matchedTraceId && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono text-[10px] text-amber-300">
                            hist. {matchedTraceId}
                          </span>
                        </>
                      )}
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
                        {vis ? (
                          <Eye className="h-3.5 w-3.5" />
                        ) : (
                          <EyeOff className="h-3.5 w-3.5 text-slate-600" />
                        )}
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

      {/* Right: Coverage Dashboard OR Selected 12-section Ficha & Live Editor */}
      <div className="anatomy-scroll h-68 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/50 p-4 lg:col-span-7">
        {showingCoveragePanel ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
              <div>
                <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-100">
                  <BarChart3 className="h-4 w-4 text-amber-400" />
                  <span>Cobertura de fichas por sistema (ProClaVet)</span>
                </h3>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  Haz clic en un sistema para filtrar sus estructuras pendientes y redactar o exportar fichas.
                </p>
              </div>
              {selected && (
                <button
                  type="button"
                  onClick={() => setShowCoverage(false)}
                  className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-teal-300 hover:border-teal-500/60"
                >
                  Volver a {blindMode ? selected.id : selected.es}
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 text-xs">
              <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-2.5">
                <div className="text-[10px] text-slate-400">Fichas completas</div>
                <div className="mt-0.5 font-mono text-sm font-semibold text-amber-300 tabular-nums">
                  {coverageStats.totalFichas} / {coverageStats.totalRecords.toLocaleString('es-ES')}
                </div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-2.5">
                <div className="text-[10px] text-slate-400">Auditadas en catálogo</div>
                <div className="mt-0.5 font-mono text-sm font-semibold text-emerald-300 tabular-nums">
                  {coverageStats.totalAudited}
                </div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-2.5">
                <div className="text-[10px] text-slate-400">Borradores locales</div>
                <div className="mt-0.5 font-mono text-sm font-semibold text-slate-100 tabular-nums">
                  {coverageStats.totalDrafts}
                </div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-2.5">
                <div className="text-[10px] text-slate-400">Modelos GLB reales</div>
                <div className="mt-0.5 font-mono text-sm font-semibold text-teal-300 tabular-nums">
                  {coverageStats.totalGlbs}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              {coverageStats.perSys.map((row) => {
                const pct = row.total > 0 ? Math.round((row.withFicha / row.total) * 100) : 0;
                return (
                  <div
                    key={row.code}
                    className="flex items-center gap-2 rounded-lg border border-slate-800/80 bg-slate-900/40 px-2.5 py-1.5 text-xs hover:border-slate-700"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSystemFilter(row.code);
                        setFilter(row.withFicha < row.total ? 'pend' : 'ficha');
                      }}
                      className="flex flex-1 items-center gap-2.5 text-left min-w-0"
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-sm"
                        style={{ backgroundColor: row.color }}
                        aria-hidden="true"
                      />
                      <span className="w-36 truncate font-medium text-slate-200">{row.label}</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
                        <div
                          className="h-full rounded-full bg-amber-500 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-24 text-right font-mono text-[11px] text-slate-300 tabular-nums shrink-0">
                        {row.withFicha}/{row.total} ({pct}%)
                      </span>
                    </button>
                    {row.withDraft > 0 && (
                      <button
                        type="button"
                        onClick={() => handleExportSystemCatalog(row.code)}
                        title={`Exportar ${row.file} actualizado con ${row.withDraft} borrador(es) para ProClaVet-core`}
                        className="flex items-center gap-1 rounded border border-teal-500/40 bg-teal-950/50 px-2 py-0.5 text-[10px] font-medium text-teal-200 hover:border-teal-400 shrink-0"
                      >
                        <Download className="h-3 w-3" />
                        <span>JSON ({row.withDraft})</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="border-b border-slate-800 pb-2.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <h3 className="text-sm font-semibold text-slate-50">
                      {blindMode ? selected.id : selected.es}
                    </h3>
                    <span className="font-mono text-[11px] text-slate-400">{selected.id}</span>
                  </div>
                  {!blindMode && (
                    <p className="font-serif italic text-xs text-amber-300">{selected.la} (NAV)</p>
                  )}
                </div>

                {!blindMode && (
                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowCoverage(true)}
                      className="flex items-center gap-1 rounded-lg border border-slate-700/80 bg-slate-900 px-2 py-1 text-[11px] text-slate-300 hover:text-white"
                      title="Ver avance de fichas por sistema"
                    >
                      <BarChart3 className="h-3 w-3 text-amber-400" />
                      <span>Cobertura</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingFicha((v) => !v)}
                      className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium transition-colors ${
                        editingFicha
                          ? 'border-amber-500 bg-amber-500 text-slate-950'
                          : 'border-slate-700/80 bg-slate-900 text-slate-200 hover:border-amber-500/60'
                      }`}
                    >
                      <FilePenLine className="h-3 w-3" />
                      <span>{editingFicha ? 'Vista lectura' : 'Editar ficha'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleExportSingleFicha}
                      className="flex items-center gap-1 rounded-lg border border-teal-500/40 bg-teal-950/50 px-2 py-1 text-[11px] font-medium text-teal-200 hover:border-teal-400"
                      title="Descargar registro JSON listo para ProClaVet-core"
                    >
                      <Download className="h-3 w-3" />
                      <span>JSON</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                <span>{SYSTEMS.find((sy) => sy.code === getCatalogSystem(selected))?.label}</span>
                <span aria-hidden="true">·</span>
                <span>{LAYERS.find((l) => l.code === selected.layer)?.label}</span>
                <span aria-hidden="true">·</span>
                <span>
                  Modelo 3D:{' '}
                  {getModelStateFn(selected.id) === 'cargado'
                    ? `GLB verificado (${loadedModelMeta[selected.id]?.licencia || selected.licencia || 'licencia sin documentar'})`
                    : getModelStateFn(selected.id) === 'esquemático'
                      ? 'representación anatómica procedural (esquemática, no equivale a malla verificada)'
                      : 'pendiente de modelo 3D'}
                </span>
              </div>
              {getModelStateFn(selected.id) === 'cargado' && loadedModelMeta[selected.id] && (
                <div className="mt-1 space-y-0.5 text-[11px] text-emerald-300/90">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono">
                      {loadedModelMeta[selected.id].origin === 'repo'
                        ? loadedModelMeta[selected.id].path
                        : `Local: ${loadedModelMeta[selected.id].path}`}
                    </span>
                    {loadedModelMeta[selected.id].fuente && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>Fuente: {loadedModelMeta[selected.id].fuente}</span>
                      </>
                    )}
                    {loadedModelMeta[selected.id].modalidad_respaldo && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-cyan-300">
                          Respaldo: {loadedModelMeta[selected.id].modalidad_respaldo}
                          {loadedModelMeta[selected.id].resolucion_corte
                            ? ` (${loadedModelMeta[selected.id].resolucion_corte})`
                            : ''}
                        </span>
                      </>
                    )}
                  </div>
                  {(loadedModelMeta[selected.id].proyeccion_referencia ||
                    loadedModelMeta[selected.id].calibracion_anatomica ||
                    loadedModelMeta[selected.id].notas) && (
                    <div className="text-slate-300">
                      {[
                        loadedModelMeta[selected.id].proyeccion_referencia
                          ? `Proyección: ${loadedModelMeta[selected.id].proyeccion_referencia}`
                          : null,
                        loadedModelMeta[selected.id].calibracion_anatomica,
                        loadedModelMeta[selected.id].notas,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  )}
                </div>
              )}
              {getModelStateFn(selected.id) !== 'cargado' && (
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                  <span>
                    Ruta esperada para GLB:{' '}
                    <span className="font-mono text-slate-400">
                      public/{selected.model || `models/equino/${getCatalogSystem(selected)}/${selected.id}.glb`}
                    </span>
                  </span>
                  {!blindMode && (
                    <button
                      type="button"
                      onClick={() =>
                        downloadJsonFile(`${selected.id}.meta.json`, {
                          licencia: 'CC BY 4.0',
                          fuente: 'Segmentación DICOM / Colección Veterinaria',
                          modalidad_respaldo: 'TC + Rx',
                          resolucion_corte: '0.625 mm',
                          proyeccion_referencia: 'LM / DP',
                          calibracion_anatomica: `Alineado en coordenadas globales ProClaVet (${selected.es})`,
                          notas: 'Pendiente de completar datos del estudio imagenológico',
                        })
                      }
                      className="text-cyan-400/90 hover:text-cyan-300 underline-offset-2 hover:underline"
                      title="Descargar plantilla de metadatos imagenológicos (.meta.json) para acompañar al .glb"
                    >
                      Plantilla .meta.json
                    </button>
                  )}
                </div>
              )}
            </div>

            {editingFicha && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/40 bg-amber-950/25 px-3 py-2 text-[11px] text-amber-200">
                <span>
                  Estándar ProClaVet: redacta solo información anatómica equina verificable (NAV) y
                  cita fuentes bibliográficas en el apartado 12. Se guarda como borrador local.
                </span>
                {selectedHasDraft && (
                  <button
                    type="button"
                    onClick={() => onClearFichaDraft(selected.id)}
                    className="flex items-center gap-1 rounded border border-amber-400/50 px-2 py-0.5 text-[10px] font-medium text-amber-100 hover:bg-amber-900/40"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>Descartar borrador</span>
                  </button>
                )}
              </div>
            )}

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
                const val = effectiveSelectedFicha?.[key] || '';
                const isDraftField = !!(
                  fichaDrafts[selected.id] && fichaDrafts[selected.id][key] !== undefined
                );
                return (
                  <div
                    key={key}
                    className={`rounded-md border p-2.5 ${
                      isDraftField
                        ? 'border-amber-500/40 bg-amber-950/15'
                        : 'border-slate-800/80 bg-slate-900/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 text-[11px] font-semibold text-slate-300">
                      <span>{label}</span>
                      {isDraftField && (
                        <span className="font-mono text-[9px] text-amber-300">editado</span>
                      )}
                    </div>
                    {editingFicha ? (
                      <textarea
                        rows={3}
                        value={val}
                        onChange={(e) => {
                          const nextFicha: FichaData = {
                            ...(effectiveSelectedFicha || {}),
                            [key]: e.target.value,
                          };
                          onUpdateFichaDraft(selected.id, nextFicha);
                        }}
                        placeholder="Pendiente de verificación…"
                        className="mt-1.5 w-full rounded border border-slate-700/80 bg-slate-950/80 px-2 py-1 text-xs leading-relaxed text-slate-100 placeholder:text-slate-600 focus:border-amber-500 focus:outline-none"
                      />
                    ) : (
                      <div className="mt-1 text-xs leading-relaxed text-slate-200">
                        {val ? (
                          val
                        ) : (
                          <span className="text-amber-500/80">
                            Pendiente: sin información verificada
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Traceability, Audit & Conceptual Links (ProClaVet Standard) */}
            <div className="rounded-lg border border-slate-800/90 bg-slate-900/50 p-3 text-xs space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 font-semibold text-slate-200">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Auditoría y trazabilidad ProClaVet</span>
                </span>
                <span
                  className={`text-[11px] ${
                    selectedHasDraft
                      ? 'text-amber-300'
                      : selected.revision?.estado === 'aprobada_y_verificada' ||
                          selected.revision?.estado === 'verificada' ||
                          selected.revision?.estado === 'aprobada'
                        ? 'text-emerald-300'
                        : 'text-amber-300/90'
                  }`}
                >
                  {selectedHasDraft
                    ? 'Borrador local pendiente de subir a ProClaVet-core'
                    : `${formatRevisionEstado(selected.revision?.estado)}${selected.revision?.fecha ? ` · ${selected.revision.fecha}` : ''}`}
                </span>
              </div>

              {selected.revision?.alcance && (
                <p className="text-[11px] leading-relaxed text-slate-400">
                  {selected.revision.alcance}
                </p>
              )}

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-[11px]">
                {selected.lateralidad && (
                  <div className="text-slate-300">
                    <span className="text-slate-500">Lateralidad: </span>
                    <span className="capitalize">{selected.lateralidad}</span>
                  </div>
                )}

                {selected.trazabilidad_ids && selected.trazabilidad_ids.length > 0 && (
                  <div className="text-slate-300 sm:col-span-2">
                    <span className="inline-flex items-center gap-1 text-slate-500">
                      <GitBranch className="h-3 w-3" />
                      IDs de trazabilidad:{' '}
                    </span>
                    <span className="font-mono text-amber-300/90">
                      {selected.trazabilidad_ids.join(', ')}
                    </span>
                  </div>
                )}

                {selected.historial_origen && (
                  <div className="text-slate-400 sm:col-span-2">
                    <span className="text-slate-500">Origen histórico: </span>
                    {selected.historial_origen}
                  </div>
                )}

                {selected.relacion_conceptual && (
                  <div className="rounded border border-amber-500/30 bg-amber-950/20 p-2 sm:col-span-2 space-y-1">
                    <div className="text-amber-200 font-medium">
                      Relación conceptual:{' '}
                      {String(selected.relacion_conceptual.tipo || '').replace(/_/g, ' ')}
                    </div>
                    {selected.relacion_conceptual.tratamiento && (
                      <div className="text-slate-300">
                        {selected.relacion_conceptual.tratamiento}
                      </div>
                    )}
                    {selected.relacion_conceptual.vinculada_a &&
                      (() => {
                        const linkedId = selected.relacion_conceptual.vinculada_a!;
                        const linked = byId[linkedId] || byTraceabilityId[linkedId];
                        return (
                          <button
                            type="button"
                            onClick={() => {
                              const targetId = linked ? linked.id : linkedId;
                              onSelect(targetId);
                              if (hasMeshFn(targetId)) onFocus(targetId);
                            }}
                            className="inline-flex items-center gap-1 font-mono text-teal-300 hover:text-teal-200 underline-offset-2 hover:underline"
                          >
                            <span>
                              Ir a{' '}
                              {linked
                                ? blindMode
                                  ? linked.id
                                  : `${linked.es} (${linked.id})`
                                : linkedId}
                            </span>
                            <ArrowRight className="h-3 w-3" />
                          </button>
                        );
                      })()}
                  </div>
                )}
              </div>
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
