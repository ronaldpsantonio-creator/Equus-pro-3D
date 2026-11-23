import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { BottomDock, DockTab } from './components/BottomDock';
import { HoverTooltip } from './components/HoverTooltip';
import { TopBar } from './components/TopBar';
import { useOnlineStatus } from './hooks/usePWA';
import { loadProClaVetCatalog } from './services/catalogLoader';
import { EquineSceneManager, SceneVisualConfig } from './three/EquineSceneManager';
import {
  CameraPreset,
  CutawayMode,
  FichaData,
  InventoryReport,
  LAYERS,
  LayerCode,
  LayerState,
  LoadedModelMeta,
  MprSliceState,
  QuizProgress,
  ReferencePlaneConfig,
  RenderViewMode,
  ScreenLabel,
  SexFilter,
  StructureRecord,
  STUDY_PRESETS,
  StudyPreset,
  SYSTEMS,
  SystemCode,
} from './types/proclavet';

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function createInitialLayers(): Record<LayerCode, LayerState> {
  const defaultPreset = STUDY_PRESETS[0];
  const out = {} as Record<LayerCode, LayerState>;
  for (const l of LAYERS) {
    const p = defaultPreset.layers[l.code];
    out[l.code] = p ? { ...p } : { on: true, op: 100 };
  }
  return out;
}

function createInitialSystems(): Record<SystemCode, boolean> {
  const out = {} as Record<SystemCode, boolean>;
  for (const s of SYSTEMS) {
    out[s.code] = true;
  }
  return out;
}

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<EquineSceneManager | null>(null);
  const glbInputRef = useRef<HTMLInputElement | null>(null);
  const batchGlbInputRef = useRef<HTMLInputElement | null>(null);
  const refImageInputRef = useRef<HTMLInputElement | null>(null);
  const refBlobUrlRef = useRef<string | null>(null);

  const [structures, setStructures] = useState<StructureRecord[]>([]);
  const [byId, setById] = useState<Record<string, StructureRecord>>({});
  const [byTraceabilityId, setByTraceabilityId] = useState<Record<string, StructureRecord>>({});
  const [report, setReport] = useState<InventoryReport | null>(null);
  const [mounted3DCount, setMounted3DCount] = useState(0);
  const [loadedModelMeta, setLoadedModelMeta] = useState<Record<string, LoadedModelMeta>>({});
  const [batchNotice, setBatchNotice] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [contextLost, setContextLost] = useState(false);

  // Visual state
  const [layers, setLayers] = useState<Record<LayerCode, LayerState>>(createInitialLayers);
  const [systems, setSystems] = useState<Record<SystemCode, boolean>>(createInitialSystems);
  const [sex, setSex] = useState<SexFilter>('all');
  const [cutaway, setCutaway] = useState<CutawayMode>('none');
  const [explode, setExplode] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredInfo, setHoveredInfo] = useState<{
    id: string | null;
    x: number;
    y: number;
  }>({ id: null, x: 0, y: 0 });
  const [showLabels, setShowLabels] = useState(true);
  const [blindMode, setBlindMode] = useState(false);
  const [vitalSigns, setVitalSigns] = useState(false);
  const [isolated, setIsolated] = useState(false);
  const [labels, setLabels] = useState<ScreenLabel[]>([]);
  const [renderMode, setRenderMode] = useState<RenderViewMode>('anatomico');
  const [mpr, setMpr] = useState<MprSliceState>({
    sagittal: { enabled: false, value: 0 },
    transverse: { enabled: false, value: 0.2 },
    dorsal: { enabled: false, value: 1.1 },
  });
  const [referencePlane, setReferencePlane] = useState<ReferencePlaneConfig>({
    visible: false,
    projection: 'LM',
    opacity: 75,
    scale: 1.0,
    offsetX: 0,
    offsetY: 0,
    imageUrl: null,
    label: '',
  });

  // HUD / Dock state
  const [hudHidden, setHudHidden] = useState(false);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<DockTab>('sistemas');

  // Persisted study state (compatible with ProClaVet-core localStorage keys)
  const [favorites, setFavorites] = useState<Record<string, boolean>>(() =>
    loadJson('va_fav', {}),
  );
  const [notes, setNotes] = useState<Record<string, string>>(() => loadJson('va_notes', {}));
  const [verified, setVerified] = useState<Record<string, boolean>>(() =>
    loadJson('va_verified', {}),
  );
  const [quizProgress, setQuizProgress] = useState<QuizProgress>(() =>
    loadJson('va_prog', { n: 0, ok: 0, sys: {}, miss: {} }),
  );
  const [fichaDrafts, setFichaDrafts] = useState<Record<string, FichaData>>(() =>
    loadJson('va_drafts', {}),
  );
  const [modelBump, setModelBump] = useState(0);
  const isOnline = useOnlineStatus();

  const visualConfig: SceneVisualConfig = useMemo(
    () => ({
      layers,
      systems,
      sex,
      cutaway,
      explode,
      selectedId,
      hoveredId: hoveredInfo.id,
      showLabels,
      blindMode,
      vitalSigns,
      renderMode,
      mpr,
    }),
    [
      layers,
      systems,
      sex,
      cutaway,
      explode,
      selectedId,
      hoveredInfo.id,
      showLabels,
      blindMode,
      vitalSigns,
      renderMode,
      mpr,
    ],
  );

  // Initialize Three.js scene & load 12 ProClaVet JSON files once
  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    let active = true;
    const manager = new EquineSceneManager(mount, visualConfig, {
      onSelect: (id) => {
        setSelectedId(id);
      },
      onHover: (id, x, y) => {
        setHoveredInfo({ id, x, y });
      },
      onLabelsUpdate: (nextLabels) => {
        setLabels(nextLabels);
      },
      onContextLost: (lost) => {
        setContextLost(lost);
      },
    });
    sceneRef.current = manager;

    loadProClaVetCatalog()
      .then((res) => {
        if (!active) return;
        setStructures(res.structures);
        setById(res.byId);
        setByTraceabilityId(res.byTraceabilityId);
        setReport(res.report);
        const { mounted3DCount: count } = manager.populateCatalog(res.structures);
        setMounted3DCount(count);

        manager.loadManifestModels(res.byTraceabilityId, (meta) => {
          if (!active) return;
          setLoadedModelMeta((prev) => ({ ...prev, [meta.id]: meta }));
          setMounted3DCount(manager.getMounted3DCount());
          setModelBump((n) => n + 1);
        });
      })
      .catch((err: unknown) => {
        if (!active) return;
        setLoadError(err instanceof Error ? err.message : String(err));
      });

    return () => {
      active = false;
      manager.dispose();
      sceneRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push visual config changes into Three.js without recreating the canvas
  useEffect(() => {
    sceneRef.current?.applyVisualConfig(visualConfig);
  }, [visualConfig, modelBump]);

  // Sync calibrated Radiographic / CT reference plane
  useEffect(() => {
    sceneRef.current?.setReferencePlane(referencePlane);
  }, [referencePlane]);

  useEffect(() => {
    return () => {
      if (refBlobUrlRef.current) {
        URL.revokeObjectURL(refBlobUrlRef.current);
      }
    };
  }, []);

  // Keyboard shortcut H to toggle HUD (Zen mode)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'h' || e.key === 'H') {
        setHudHidden((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const persist = useCallback((key: string, val: unknown) => {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch {
      // Ignore storage quota errors
    }
  }, []);

  const handleToggleSystem = useCallback((code: SystemCode) => {
    setSystems((prev) => ({ ...prev, [code]: prev[code] === false }));
  }, []);

  const handleToggleLayer = useCallback((code: LayerCode) => {
    setLayers((prev) => ({
      ...prev,
      [code]: { ...prev[code], on: !prev[code].on },
    }));
  }, []);

  const handleLayerOpacity = useCallback((code: LayerCode, op: number) => {
    setLayers((prev) => ({
      ...prev,
      [code]: { ...prev[code], op },
    }));
  }, []);

  const handleApplyStudyPreset = useCallback((preset: StudyPreset) => {
    const nextSys = {} as Record<SystemCode, boolean>;
    for (const s of SYSTEMS) {
      nextSys[s.code] = preset.systems.includes(s.code);
    }
    setSystems(nextSys);

    setLayers((prev) => {
      const next = { ...prev };
      for (const l of LAYERS) {
        const override = preset.layers[l.code];
        if (override) next[l.code] = { ...override };
      }
      return next;
    });

    if (preset.cutaway !== undefined) setCutaway(preset.cutaway);
    if (preset.explode !== undefined) setExplode(preset.explode);
    setIsolated(false);
    sceneRef.current?.showAllStructures();
  }, []);

  const handleShowAll = useCallback(() => {
    const allSys = {} as Record<SystemCode, boolean>;
    SYSTEMS.forEach((s) => {
      allSys[s.code] = true;
    });
    const allLayers = {} as Record<LayerCode, LayerState>;
    LAYERS.forEach((l) => {
      allLayers[l.code] = { on: true, op: l.code === 'pel' ? 24 : 100 };
    });
    setSystems(allSys);
    setLayers(allLayers);
    setCutaway('none');
    setExplode(0);
    setIsolated(false);
    setRenderMode('anatomico');
    setMpr({
      sagittal: { enabled: false, value: 0 },
      transverse: { enabled: false, value: 0.2 },
      dorsal: { enabled: false, value: 1.1 },
    });
    sceneRef.current?.showAllStructures();
  }, []);

  const handleResetMpr = useCallback(() => {
    setMpr({
      sagittal: { enabled: false, value: 0 },
      transverse: { enabled: false, value: 0.2 },
      dorsal: { enabled: false, value: 1.1 },
    });
  }, []);

  const handleIsolateSelected = useCallback(() => {
    if (!selectedId) return;
    setIsolated(true);
    sceneRef.current?.isolateStructure(selectedId);
    sceneRef.current?.focusOnStructure(selectedId);
  }, [selectedId]);

  const handleSnapshot = useCallback(() => {
    if (!sceneRef.current) return;
    const dataUrl = sceneRef.current.captureSnapshot();
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `equus-3d-${selectedId || 'anatomia'}.png`;
    a.click();
  }, [selectedId]);

  const handleSelectCameraPreset = useCallback((preset: CameraPreset) => {
    sceneRef.current?.setCameraView(preset.position, preset.target);
  }, []);

  const handleToggleFavorite = useCallback(
    (id: string) => {
      setFavorites((prev) => {
        const next = { ...prev, [id]: !prev[id] };
        persist('va_fav', next);
        return next;
      });
    },
    [persist],
  );

  const handleUpdateNote = useCallback(
    (id: string, note: string) => {
      setNotes((prev) => {
        const next = { ...prev, [id]: note };
        persist('va_notes', next);
        return next;
      });
    },
    [persist],
  );

  const handleVerifyAndNext = useCallback(
    (id: string) => {
      setVerified((prev) => {
        const next = { ...prev, [id]: true };
        persist('va_verified', next);
        return next;
      });
      const region = id.split('.')[2];
      const prefix = `equ.ske.${region}.`;
      const series = structures
        .map((s) => s.id)
        .filter((sid) => sid.startsWith(prefix) && /^equ\.ske\.(?:mto|mpe|cos)\.\d{3}-[id]$/.test(sid));
      const idx = series.indexOf(id);
      if (idx >= 0 && series[idx + 1]) {
        setSelectedId(series[idx + 1]);
      }
    },
    [persist, structures],
  );

  const handleQuizProgressChange = useCallback(
    (next: QuizProgress) => {
      setQuizProgress(next);
      persist('va_prog', next);
    },
    [persist],
  );

  const handleUpdateFichaDraft = useCallback(
    (id: string, nextFicha: FichaData) => {
      setFichaDrafts((prev) => {
        const cleaned: FichaData = {};
        for (const [k, v] of Object.entries(nextFicha)) {
          if (typeof v === 'string' && v.trim().length > 0) {
            cleaned[k] = v;
          }
        }
        const next = { ...prev };
        if (Object.keys(cleaned).length === 0) {
          delete next[id];
        } else {
          next[id] = cleaned;
        }
        persist('va_drafts', next);
        return next;
      });
    },
    [persist],
  );

  const handleClearFichaDraft = useCallback(
    (id: string) => {
      setFichaDrafts((prev) => {
        const next = { ...prev };
        delete next[id];
        persist('va_drafts', next);
        return next;
      });
    },
    [persist],
  );

  const handleUploadGlbClick = useCallback(() => {
    if (!selectedId) {
      setActiveTab('ficha');
      setDockCollapsed(false);
      return;
    }
    glbInputRef.current?.click();
  }, [selectedId]);

  const handleGlbFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file || !selectedId || !sceneRef.current) return;
      try {
        const meta = await sceneRef.current.loadCustomGlb(selectedId, file);
        setLoadedModelMeta((prev) => ({ ...prev, [meta.id]: meta }));
        setMounted3DCount(sceneRef.current.getMounted3DCount());
        setModelBump((n) => n + 1);
      } catch {
        setLoadError('No se pudo leer el archivo .glb seleccionado.');
      }
    },
    [selectedId],
  );

  const handleBatchGlbChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      e.target.value = '';
      if (files.length === 0 || !sceneRef.current) return;
      const result = await sceneRef.current.loadGlbFilesBatch(files, byTraceabilityId);
      if (result.loaded.length > 0) {
        setLoadedModelMeta((prev) => {
          const next = { ...prev };
          for (const m of result.loaded) next[m.id] = m;
          return next;
        });
        setMounted3DCount(sceneRef.current.getMounted3DCount());
        setModelBump((n) => n + 1);
      }
      const partsMsg: string[] = [];
      partsMsg.push(`${result.loaded.length} GLB cargado${result.loaded.length === 1 ? '' : 's'}`);
      if (result.unmatched.length > 0) {
        partsMsg.push(`${result.unmatched.length} sin ID coincidente`);
      }
      if (result.errors.length > 0) {
        partsMsg.push(`${result.errors.length} con error de lectura`);
      }
      setBatchNotice(partsMsg.join(' · '));
      window.setTimeout(() => setBatchNotice(null), 6000);
    },
    [byTraceabilityId],
  );

  const handleRefImageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (refBlobUrlRef.current) {
      URL.revokeObjectURL(refBlobUrlRef.current);
    }
    const url = URL.createObjectURL(file);
    refBlobUrlRef.current = url;
    setReferencePlane((prev) => ({
      ...prev,
      visible: true,
      imageUrl: url,
      label: `Placa local: ${file.name}`,
    }));
  }, []);

  const hasMeshFn = useCallback(
    (id: string) => sceneRef.current?.hasMesh(id) ?? false,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mounted3DCount, modelBump],
  );

  const getModelStateFn = useCallback(
    (id: string) => sceneRef.current?.getItemState(id) ?? 'pendiente',
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mounted3DCount, modelBump],
  );

  const isVisibleOverrideFn = useCallback(
    (id: string) => sceneRef.current?.isStructureVisibleOverride(id) ?? true,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mounted3DCount, isolated, modelBump],
  );

  const getVisible3DIdsFn = useCallback(
    () => sceneRef.current?.getVisible3DIds() ?? [],
    [],
  );

  const selectedStructure = selectedId
    ? byId[selectedId] || byTraceabilityId[selectedId] || null
    : null;
  const hoveredStructure = hoveredInfo.id
    ? byId[hoveredInfo.id] || byTraceabilityId[hoveredInfo.id] || null
    : null;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#0c1118] text-slate-100 select-none">
      {/* Dedicated WebGL Mount */}
      <div ref={canvasMountRef} className="fixed inset-0 z-0" />

      {/* Pooled Screen-Space Anatomical Labels (max 5) */}
      {!hudHidden && labels.length > 0 && (
        <div className="pointer-events-none fixed inset-0 z-10 overflow-hidden">
          {labels.map((lb) => (
            <div
              key={lb.id}
              style={{ left: lb.x, top: lb.y }}
              className={`absolute -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] shadow ${
                lb.selected
                  ? 'border border-teal-400/70 bg-teal-950/95 font-semibold text-teal-100'
                  : 'border border-slate-700/80 bg-[#0e141d]/90 text-slate-200'
              }`}
            >
              {lb.es}
            </div>
          ))}
        </div>
      )}

      {/* Cursor Hover Tooltip */}
      {!hudHidden && (
        <HoverTooltip
          structure={hoveredStructure}
          x={hoveredInfo.x}
          y={hoveredInfo.y}
          blindMode={blindMode}
        />
      )}

      {/* Minimal Top Bar */}
      <TopBar
        report={report}
        mounted3DCount={mounted3DCount}
        loadedGlbCount={Object.keys(loadedModelMeta).length}
        sex={sex}
        onSexChange={(nextSex) => {
          setSex(nextSex);
          if (selectedStructure?.sex && nextSex !== 'all' && selectedStructure.sex !== nextSex) {
            setSelectedId(null);
          }
        }}
        cutaway={cutaway}
        onCutawayChange={setCutaway}
        vitalSigns={vitalSigns}
        onToggleVitalSigns={() => setVitalSigns((v) => !v)}
        onSnapshot={handleSnapshot}
        hudHidden={hudHidden}
        onToggleHud={() => setHudHidden((h) => !h)}
      />

      {/* Load Error / WebGL Context Lost / GLB Batch Notice Banner */}
      {(loadError || contextLost || batchNotice) && (
        <div
          className={`fixed top-20 left-1/2 z-30 -translate-x-1/2 rounded-lg border px-4 py-2 text-xs shadow-lg ${
            loadError || contextLost
              ? 'border-rose-500/50 bg-rose-950/95 text-rose-100'
              : 'border-teal-500/50 bg-teal-950/95 text-teal-100'
          }`}
        >
          {contextLost
            ? 'Contexto WebGL suspendido temporalmente. Restaurando visor 3D…'
            : loadError || batchNotice}
        </div>
      )}

      {/* Offline PWA Status Indicator */}
      {!isOnline && (
        <div className="fixed bottom-4 left-4 z-30 flex items-center gap-2 rounded-lg border border-amber-500/50 bg-[#0e141d]/95 px-3 py-1.5 text-xs font-medium text-amber-200 shadow-lg">
          <WifiOff className="h-3.5 w-3.5 text-amber-400" />
          <span>Modo sin conexión · catálogos en caché</span>
        </div>
      )}

      {/* Collapsible Bottom Control Dock */}
      <BottomDock
        collapsed={dockCollapsed}
        onToggleCollapse={() => setDockCollapsed((c) => !c)}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        hudHidden={hudHidden}
        selectedStructure={selectedStructure}
        selectedModelState={selectedStructure ? getModelStateFn(selectedStructure.id) : 'pendiente'}
        selectedModelMeta={selectedStructure ? loadedModelMeta[selectedStructure.id] : undefined}
        selectedHasMesh={selectedStructure ? hasMeshFn(selectedStructure.id) : false}
        isolated={isolated}
        onFocusSelected={() => selectedStructure && sceneRef.current?.focusOnStructure(selectedStructure.id)}
        onIsolateSelected={handleIsolateSelected}
        onShowAll={handleShowAll}
        onUploadGlb={handleUploadGlbClick}
        onUploadBatchGlb={() => batchGlbInputRef.current?.click()}
        onClearSelection={() => setSelectedId(null)}
        report={report}
        systems={systems}
        onToggleSystem={handleToggleSystem}
        onApplyStudyPreset={handleApplyStudyPreset}
        layers={layers}
        onToggleLayer={handleToggleLayer}
        onLayerOpacity={handleLayerOpacity}
        explode={explode}
        onExplodeChange={setExplode}
        cutaway={cutaway}
        onCutawayChange={setCutaway}
        showLabels={showLabels}
        onToggleLabels={() => setShowLabels((v) => !v)}
        blindMode={blindMode}
        onToggleBlindMode={() => setBlindMode((v) => !v)}
        onSelectCameraPreset={handleSelectCameraPreset}
        renderMode={renderMode}
        onRenderModeChange={setRenderMode}
        mpr={mpr}
        onMprChange={setMpr}
        onResetMpr={handleResetMpr}
        referencePlane={referencePlane}
        onReferencePlaneChange={setReferencePlane}
        onUploadReferenceImage={() => refImageInputRef.current?.click()}
        structures={structures}
        byId={byId}
        byTraceabilityId={byTraceabilityId}
        sex={sex}
        favorites={favorites}
        notes={notes}
        verified={verified}
        fichaDrafts={fichaDrafts}
        loadedModelMeta={loadedModelMeta}
        hasMeshFn={hasMeshFn}
        getModelStateFn={getModelStateFn}
        isVisibleOverrideFn={isVisibleOverrideFn}
        onSelectStructure={(id) => {
          const resolved = byId[id] || byTraceabilityId[id];
          setSelectedId(resolved ? resolved.id : id);
        }}
        onFocusStructure={(id) => sceneRef.current?.focusOnStructure(id)}
        onToggleFavorite={handleToggleFavorite}
        onToggleStructureVisible={(id) => {
          const cur = isVisibleOverrideFn(id);
          sceneRef.current?.setStructureVisible(id, !cur);
          setModelBump((n) => n + 1);
        }}
        onUpdateNote={handleUpdateNote}
        onUpdateFichaDraft={handleUpdateFichaDraft}
        onClearFichaDraft={handleClearFichaDraft}
        onVerifyAndNext={handleVerifyAndNext}
        quizProgress={quizProgress}
        getVisible3DIdsFn={getVisible3DIdsFn}
        onQuizProgressChange={handleQuizProgressChange}
        onQuizHighlight={(id, forceBlind) => {
          setBlindMode(forceBlind);
          setSelectedId(id);
          if (id && hasMeshFn(id)) {
            sceneRef.current?.focusOnStructure(id);
          }
        }}
      />

      {/* Hidden GLB loader inputs */}
      <input
        ref={glbInputRef}
        type="file"
        accept=".glb"
        className="hidden"
        onChange={handleGlbFileChange}
      />
      <input
        ref={batchGlbInputRef}
        type="file"
        accept=".glb"
        multiple
        className="hidden"
        onChange={handleBatchGlbChange}
      />
      <input
        ref={refImageInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        onChange={handleRefImageChange}
      />
    </div>
  );
}
