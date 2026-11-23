import React, { useMemo, useState } from 'react';
import {
  getCatalogSystem,
  QuizProgress,
  QuizQuestion,
  SexFilter,
  StructureRecord,
  SYSTEMS,
  SystemCode,
} from '../types/proclavet';

interface QuizTabProps {
  structures: StructureRecord[];
  sex: SexFilter;
  progress: QuizProgress;
  hasMeshFn: (id: string) => boolean;
  getVisible3DIdsFn: () => string[];
  onProgressChange: (next: QuizProgress) => void;
  onHighlightStructure: (id: string | null, forceBlind: boolean) => void;
  onIsolate: () => void;
  onShowAll: () => void;
  onOpenFicha: (id: string) => void;
}

const SIDE_RE = / \((izquierd[oa]|derech[oa])\)$/;
const baseName = (s: StructureRecord) => s.es.replace(SIDE_RE, '');
const regionOf = (s: StructureRecord) => s.id.split('.')[2] || '';
const pct = (ok: number, n: number) => (n ? `${Math.round((ok / n) * 100)}%` : '–');

function shuffle<T>(arr: T[]): T[] {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildDistractors(
  all: StructureRecord[],
  target: StructureRecord,
  textOf: (s: StructureRecord) => string,
  ans: string,
): string[] {
  const sy = getCatalogSystem(target);
  const ok = (x: StructureRecord) =>
    x !== target && x.la !== target.la && baseName(x) !== baseName(target);
  const A = all.filter(
    (x) => ok(x) && getCatalogSystem(x) === sy && x.layer === target.layer && regionOf(x) === regionOf(target),
  );
  const B = all.filter(
    (x) => ok(x) && getCatalogSystem(x) === sy && x.layer === target.layer && regionOf(x) !== regionOf(target),
  );
  const C = all.filter(
    (x) => ok(x) && getCatalogSystem(x) === sy && x.layer !== target.layer,
  );
  const D = all.filter((x) => ok(x) && getCatalogSystem(x) !== sy);

  const seen = new Set([ans]);
  const out: string[] = [];
  for (const grp of [A, B, C, D]) {
    for (const x of shuffle(grp)) {
      const t = textOf(x);
      if (t && !seen.has(t)) {
        seen.add(t);
        out.push(t);
        if (out.length >= 3) return out;
      }
    }
  }
  return out;
}

export const QuizTab: React.FC<QuizTabProps> = ({
  structures,
  sex,
  progress,
  hasMeshFn,
  getVisible3DIdsFn,
  onProgressChange,
  onHighlightStructure,
  onIsolate,
  onShowAll,
  onOpenFicha,
}) => {
  const [mode, setMode] = useState<'nombre' | 'visor'>('nombre');
  const [sysFilter, setSysFilter] = useState<'all' | SystemCode>('all');
  const [current, setCurrent] = useState<QuizQuestion | null>(null);
  const [chosenIdx, setChosenIdx] = useState<number | null>(null);
  const [session, setSession] = useState({ n: 0, ok: 0 });

  const pool = useMemo(
    () =>
      structures.filter(
        (s) =>
          (!s.sex || sex === 'all' || s.sex === sex) &&
          !!s.es &&
          (sysFilter === 'all' || getCatalogSystem(s) === sysFilter),
      ),
    [structures, sex, sysFilter],
  );

  const startQuestion = () => {
    setChosenIdx(null);
    if (mode === 'nombre') {
      const valid = pool.filter((s) => !!s.la);
      if (valid.length < 4) {
        setCurrent({
          mode: 'nombre',
          err: 'No hay suficientes estructuras en este sistema para armar una pregunta. Elige «Todos».',
        });
        return;
      }
      const target = valid[Math.floor(Math.random() * valid.length)];
      const toEs = Math.random() < 0.5;
      const ans = toEs ? baseName(target) : target.la;
      const dist = buildDistractors(valid, target, (x) => (toEs ? baseName(x) : x.la), ans);
      onHighlightStructure(hasMeshFn(target.id) ? target.id : null, false);
      setCurrent({
        mode: 'nombre',
        id: target.id,
        sys: getCatalogSystem(target),
        key: `${target.la}|${baseName(target)}`,
        label: `${baseName(target)} · ${target.la}`,
        ans,
        opts: shuffle([ans, ...dist]),
        text: toEs
          ? `Nombre latino (NAV): ${target.la}. ¿Cuál es su nombre en español?`
          : `Nombre en español: ${baseName(target)}. ¿Cuál es su nombre latino (NAV)?`,
      });
    } else {
      const visibleIds = new Set(getVisible3DIdsFn());
      const visPool = pool.filter((s) => visibleIds.has(s.id));
      if (visPool.length === 0) {
        setCurrent({
          mode: 'visor',
          err: 'No hay estructuras con malla 3D visible para este filtro. Activa capas/sistemas en el visor o usa «Todos».',
        });
        return;
      }
      const target = visPool[Math.floor(Math.random() * visPool.length)];
      const ans = target.es;
      const dist = buildDistractors(pool, target, (x) => x.es, ans);
      if (dist.length === 0) {
        setCurrent({
          mode: 'visor',
          err: 'No hay suficientes distractores parecidos. Elige «Todos».',
        });
        return;
      }
      onHighlightStructure(target.id, true);
      setCurrent({
        mode: 'visor',
        id: target.id,
        sys: getCatalogSystem(target),
        key: `${target.la}|${baseName(target)}`,
        label: `${target.es} · ${target.la}`,
        ans,
        opts: shuffle([ans, ...dist]),
        text: 'En el visor hay una estructura resaltada en turquesa (modo ciego). ¿Cuál es?',
      });
    }
  };

  const handleAnswer = (idx: number) => {
    if (!current || current.err || chosenIdx !== null || !current.opts || !current.ans) return;
    setChosenIdx(idx);
    const right = current.opts[idx] === current.ans;
    const k = current.sys || 'ske';

    setSession((prev) => ({ n: prev.n + 1, ok: prev.ok + (right ? 1 : 0) }));

    const nextProg: QuizProgress = {
      n: progress.n + 1,
      ok: progress.ok + (right ? 1 : 0),
      sys: {
        ...progress.sys,
        [k]: {
          n: (progress.sys[k]?.n || 0) + 1,
          ok: (progress.sys[k]?.ok || 0) + (right ? 1 : 0),
        },
      },
      miss: { ...progress.miss },
    };

    if (current.key && current.label) {
      if (right) {
        const existing = nextProg.miss[current.key];
        if (existing) {
          if (existing.c <= 1) delete nextProg.miss[current.key];
          else nextProg.miss[current.key] = { ...existing, c: existing.c - 1 };
        }
      } else {
        const existing = nextProg.miss[current.key];
        nextProg.miss[current.key] = {
          t: current.label,
          c: (existing?.c || 0) + 1,
        };
      }
    }

    onProgressChange(nextProg);
    if (current.mode === 'visor' && current.id) {
      onHighlightStructure(current.id, false);
    }
  };

  const topMissed = Object.values(progress.miss)
    .sort((a, b) => b.c - a.c)
    .slice(0, 4);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <div className="space-y-3 lg:col-span-7">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-lg border border-slate-800 bg-slate-900/70 p-0.5">
            <button
              type="button"
              onClick={() => {
                setMode('nombre');
                setCurrent(null);
                setChosenIdx(null);
                onHighlightStructure(null, false);
              }}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                mode === 'nombre'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Nombre (NAV)
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('visor');
                setCurrent(null);
                setChosenIdx(null);
                onHighlightStructure(null, false);
              }}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                mode === 'visor'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Identificar en el visor 3D
            </button>
          </div>

          <select
            value={sysFilter}
            onChange={(e) => {
              setSysFilter(e.target.value as 'all' | SystemCode);
              setCurrent(null);
              setChosenIdx(null);
            }}
            className="rounded-lg border border-slate-700/80 bg-slate-900/90 px-2.5 py-1.5 text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
          >
            <option value="all">Todos los sistemas</option>
            {SYSTEMS.map((s) => (
              <option key={s.code} value={s.code}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {!current ? (
          <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
            <p className="text-xs leading-relaxed text-slate-300">
              {mode === 'visor'
                ? 'Se resalta una estructura anatómica en el modelo 3D sin su nombre para que la identifiques entre cuatro opciones.'
                : `Practica la correspondencia entre nomenclatura en español y latín oficial (NAV) sobre las ${structures.length.toLocaleString('es-ES')} estructuras del catálogo.`}
            </p>
            <button
              type="button"
              onClick={startQuestion}
              className="mt-3 rounded-lg bg-amber-500 px-4 py-2 text-xs font-semibold text-slate-950 transition-colors hover:bg-amber-400"
            >
              Empezar autoevaluación
            </button>
          </div>
        ) : current.err ? (
          <div className="rounded-lg border border-amber-500/40 bg-amber-950/30 p-3 text-xs text-amber-200">
            {current.err}
          </div>
        ) : (
          <div className="space-y-2.5 rounded-lg border border-slate-800 bg-slate-900/50 p-3.5">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="font-mono">
                Pregunta {session.n + (chosenIdx === null ? 1 : 0)}
              </span>
              {current.mode === 'visor' && chosenIdx === null && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onIsolate}
                    className="text-teal-300 hover:underline"
                  >
                    Aislar pieza
                  </button>
                  <button
                    type="button"
                    onClick={onShowAll}
                    className="text-slate-300 hover:underline"
                  >
                    Mostrar todo
                  </button>
                </div>
              )}
            </div>

            <p className="text-xs font-medium text-slate-100 leading-relaxed">{current.text}</p>

            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {current.opts?.map((opt, idx) => {
                const done = chosenIdx !== null;
                const isAns = opt === current.ans;
                const isPicked = idx === chosenIdx;
                let cls =
                  'border-slate-700/80 bg-slate-900/80 text-slate-200 hover:border-slate-500';
                if (done && isAns) {
                  cls = 'border-emerald-500/70 bg-emerald-950/70 text-emerald-200';
                } else if (done && isPicked && !isAns) {
                  cls = 'border-rose-500/70 bg-rose-950/70 text-rose-200';
                }

                return (
                  <button
                    key={`${idx}-${opt}`}
                    type="button"
                    disabled={done}
                    onClick={() => handleAnswer(idx)}
                    className={`rounded-lg border px-3 py-2 text-left text-xs transition-colors ${cls}`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>

            {chosenIdx !== null && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-2.5">
                <div className="text-xs">
                  <span
                    className={
                      current.opts?.[chosenIdx] === current.ans
                        ? 'font-semibold text-emerald-400'
                        : 'font-semibold text-rose-400'
                    }
                  >
                    {current.opts?.[chosenIdx] === current.ans ? 'Correcto' : 'Incorrecto'}
                  </span>
                  <span className="mx-2 text-slate-500">·</span>
                  <span className="text-slate-300">{current.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  {current.id && (
                    <button
                      type="button"
                      onClick={() => onOpenFicha(current.id!)}
                      className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:border-slate-500"
                    >
                      Ver ficha
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={startQuestion}
                    className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-amber-400"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right: Stats & weak spots */}
      <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/50 p-3.5 lg:col-span-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-200">Progreso acumulado</span>
          {progress.n > 0 && (
            <button
              type="button"
              onClick={() => {
                onProgressChange({ n: 0, ok: 0, sys: {}, miss: {} });
                setSession({ n: 0, ok: 0 });
              }}
              className="text-[11px] text-slate-400 hover:text-rose-300"
            >
              Reiniciar
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 font-mono text-xs tabular-nums">
          <div className="rounded-md border border-slate-800 bg-slate-900/50 p-2">
            <div className="font-sans text-[11px] text-slate-400">Sesión actual</div>
            <div className="mt-0.5 text-sm font-semibold text-slate-100">
              {session.ok}/{session.n} ({pct(session.ok, session.n)})
            </div>
          </div>
          <div className="rounded-md border border-slate-800 bg-slate-900/50 p-2">
            <div className="font-sans text-[11px] text-slate-400">Histórico</div>
            <div className="mt-0.5 text-sm font-semibold text-amber-400">
              {progress.ok}/{progress.n} ({pct(progress.ok, progress.n)})
            </div>
          </div>
        </div>

        {topMissed.length > 0 && (
          <div>
            <div className="text-[11px] font-medium text-slate-400">Para repasar</div>
            <div className="mt-1 space-y-1">
              {topMissed.map((m) => (
                <div
                  key={m.t}
                  className="flex items-center justify-between gap-2 text-[11px] text-slate-300"
                >
                  <span className="truncate">{m.t}</span>
                  <span className="font-mono text-amber-400 shrink-0">×{m.c}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
