import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { BottomDock, DockTab } from './components/BottomDock';
import { HoverTooltip } from './components/HoverTooltip';
import { TopBar } from './components/TopBar';
import { useOnlineStatus } from './hooks/usePWA';
import { loadProClaVetCatalog } from './services/catalogLoader';
import { EquineSceneManager, SceneVisualConfig } from './three/EquineSceneManager';
import {
  computeMeasureAngle,
  computeMeasureDistance,
  EquineMeasurePreset,
} from './three/measurementOverlay';
import {
  BreadcrumbStep,
  CAMERA_PRESETS,
  CameraPreset,
  CameraProjectionMode,
  CutawayMode,
  FichaData,
  FichaSubView,
  InventoryReport,
  LAYERS,
  LayerCode,
  LayerState,
  LoadedModelMeta,
  MeasurementRecord,
  MeasurePoint,
  MeasureToolMode,
  MeasureUnit,
  MprSliceState,
  QuizProgress,
  ReferencePlaneConfig,
  RenderViewMode,
  SceneTheme,
  ScreenLabel,
  ScreenMeasurementBadge,
  SexFilter,
  StructureRecord,
  STUDY_PRESETS,
  StudyPreset,
  SYSTEMS,
  SystemCode,
} from './types/proclavet';

interface NavHistoryEntry {
  label: string;
  activeTab: DockTab;
  fichaSubView: FichaSubView;
  selectedId: string | null;
  isolated: boolean;
  hiddenIds: string[];
  cutaway: CutawayMode;
  explode: number;
  renderMode: RenderViewMode;
  cameraProjection: CameraProjectionMode;
  xrayExposure: number;
  xrayInverted: boolean;
  blindMode: boolean;
  dissectMode: boolean;
  mpr: MprSliceState;
}

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
  const defaultPreset = STUDY_PRESETS[0];
  const out = {} as Record<SystemCode, boolean>;
  for (const s of SYSTEMS) {
    out[s.code] = defaultPreset.systems.includes(s.code);
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
  const [cameraProjection, setCameraProjection] = useState<CameraProjectionMode>('perspective');
  const [xrayExposure, setXrayExposure] = useState<number>(1.0);
  const [xrayInverted, setXrayInverted] = useState<boolean>(false);
  const [sceneTheme, setSceneTheme] = useState<SceneTheme>(() =>
    loadJson<SceneTheme>('va_theme', 'atlas'),
  );
  const [dissectMode, setDissectMode] = useState(false);
  const dissectModeRef = useRef(false);
  const [measureMode, setMeasureMode] = useState<MeasureToolMode>('none');
  const measureModeRef = useRef<MeasureToolMode>('none');
  const [measureUnit, setMeasureUnit] = useState<MeasureUnit>('cm');
  const [measurements, setMeasurements] = useState<MeasurementRecord[]>([]);
  const [draftPoints, setDraftPoints] = useState<MeasurePoint[]>([]);
  const [measurementBadges, setMeasurementBadges] = useState<ScreenMeasurementBadge[]>([]);
  const measureSeqRef = useRef(1);
  const onMeasurePickRef = useRef<
    (pos: [number, number, number], structureId?: string) => void
  >(() => {});
  const [mpr, setMpr] = useState<MprSliceState>({
    sagittal: { enabled: false, value: 0, flip: false },
    transverse: { enabled: false, value: 0.2, flip: false },
    dorsal: { enabled: false, value: 1.1, flip: false },
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

  // HUD / Dock state & sequential navigation depth
  const [hudHidden, setHudHidden] = useState(false);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<DockTab>('sistemas');
  const [fichaSubView, setFichaSubView] = useState<FichaSubView>('ficha');
  const [navHistory, setNavHistory] = useState<NavHistoryEntry[]>([]);
  const onSelect3DRef = useRef<(id: string | null) => void>(() => {});

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
      cameraProjection,
      xrayExposure,
      xrayInverted,
      sceneTheme,
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
      cameraProjection,
      xrayExposure,
      xrayInverted,
      sceneTheme,
      mpr,
    ],
  );

  useEffect(() => {
    dissectModeRef.current = dissectMode;
  }, [dissectMode]);

  // Initialize Three.js scene & load 12 ProClaVet JSON files once
  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    let active = true;
    const manager = new EquineSceneManager(mount, visualConfig, {
      onSelect: (id) => {
        onSelect3DRef.current(id);
      },
      onHover: (id, x, y) => {
        setHoveredInfo({ id, x, y });
      },
      onLabelsUpdate: (nextLabels) => {
        setLabels(nextLabels);
      },
      onMeasurePick: (pos, structureId) => {
        onMeasurePickRef.current(pos, structureId);
      },
      onMeasureBadgesUpdate: (badges) => {
        setMeasurementBadges(badges);
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

  // Sync 3D Ruler & Articular Goniometer state into scene overlay
  useEffect(() => {
    measureModeRef.current = measureMode;
    sceneRef.current?.setMeasurementState(measureMode, measureUnit, measurements, draftPoints);
  }, [measureMode, measureUnit, measurements, draftPoints]);

  useEffect(() => {
    return () => {
      if (refBlobUrlRef.current) {
        URL.revokeObjectURL(refBlobUrlRef.current);
      }
    };
  }, []);

  const pushHistory = useCallback(
    (label: string) => {
      const hiddenIds = sceneRef.current?.getHiddenStructureIds() ?? [];
      const snap: NavHistoryEntry = {
        label,
        activeTab,
        fichaSubView,
        selectedId,
        isolated,
        hiddenIds,
        cutaway,
        explode,
        renderMode,
        cameraProjection,
        xrayExposure,
        xrayInverted,
        blindMode,
        dissectMode,
        mpr: {
          sagittal: { ...mpr.sagittal },
          transverse: { ...mpr.transverse },
          dorsal: { ...mpr.dorsal },
        },
      };
      setNavHistory((prev) => [...prev.slice(-24), snap]);
    },
    [
      activeTab,
      fichaSubView,
      selectedId,
      isolated,
      cutaway,
      explode,
      renderMode,
      cameraProjection,
      xrayExposure,
      xrayInverted,
      blindMode,
      dissectMode,
      mpr,
    ],
  );

  useEffect(() => {
    onSelect3DRef.current = (id: string | null) => {
      if (id && dissectModeRef.current) {
        pushHistory(`Ocultar ${byId[id]?.es || id}`);
        sceneRef.current?.setStructureVisible(id, false);
        setSelectedId(null);
        setHoveredInfo({ id: null, x: 0, y: 0 });
        setModelBump((n) => n + 1);
        return;
      }
      if (id !== selectedId) {
        pushHistory(selectedId ? byId[selectedId]?.es || 'Selección anterior' : 'Vista previa');
        setSelectedId(id);
        if (!id) setFichaSubView('ficha');
      }
    };
  }, [byId, pushHistory, selectedId]);

  useEffect(() => {
    onMeasurePickRef.current = (pos: [number, number, number], structureId?: string) => {
      const mode = measureModeRef.current;
      if (mode === 'none') return;

      const resolved = structureId ? byId[structureId] || byTraceabilityId[structureId] : undefined;
      const structureName = resolved
        ? blindMode
          ? resolved.id
          : resolved.es
        : pos[1] < 0.015
          ? 'Plano del suelo'
          : undefined;

      const nextPoint: MeasurePoint = {
        position: pos,
        structureId: resolved?.id || structureId,
        structureName,
      };

      if (mode === 'ruler') {
        if (draftPoints.length === 0) {
          setDraftPoints([nextPoint]);
        } else {
          const p0 = draftPoints[0];
          const distanceMeters = computeMeasureDistance(p0.position, nextPoint.position);
          const rec: MeasurementRecord = {
            id: `meas-${measureSeqRef.current++}`,
            kind: 'ruler',
            points: [p0, nextPoint],
            distanceMeters,
          };
          setMeasurements((prev) => [...prev, rec]);
          setDraftPoints([]);
        }
        return;
      }

      if (mode === 'goniometer') {
        if (draftPoints.length < 2) {
          setDraftPoints([...draftPoints, nextPoint]);
        } else {
          const pA = draftPoints[0];
          const pV = draftPoints[1];
          const { angleDeg, supplementDeg } = computeMeasureAngle(
            pA.position,
            pV.position,
            nextPoint.position,
          );
          const rec: MeasurementRecord = {
            id: `meas-${measureSeqRef.current++}`,
            kind: 'goniometer',
            points: [pA, pV, nextPoint],
            angleDeg,
            supplementDeg,
          };
          setMeasurements((prev) => [...prev, rec]);
          setDraftPoints([]);
        }
      }
    };
  }, [blindMode, byId, byTraceabilityId, draftPoints]);

  const handleMeasureModeChange = useCallback((nextMode: MeasureToolMode) => {
    setDraftPoints([]);
    setMeasureMode(nextMode);
    if (nextMode !== 'none') {
      setDissectMode(false);
    }
  }, []);

  const handleToggleDissectMode = useCallback(() => {
    setDissectMode((prev) => {
      const next = !prev;
      if (next) {
        setMeasureMode('none');
        setDraftPoints([]);
      }
      return next;
    });
  }, []);

  const handleApplyMeasurePreset = useCallback((preset: EquineMeasurePreset) => {
    const rec = preset.build();
    setMeasurements((prev) => [...prev.filter((m) => m.id !== rec.id), rec]);
    setDraftPoints([]);
    const focusTarget: [number, number, number] =
      rec.kind === 'ruler'
        ? [
            (rec.points[0].position[0] + rec.points[1].position[0]) * 0.5,
            (rec.points[0].position[1] + rec.points[1].position[1]) * 0.5,
            (rec.points[0].position[2] + rec.points[1].position[2]) * 0.5,
          ]
        : rec.points[1].position;
    sceneRef.current?.focusOnPoint(focusTarget);
  }, []);

  const handleUndoDraftPoint = useCallback(() => {
    setDraftPoints((prev) => prev.slice(0, -1));
  }, []);

  const handleDeleteMeasurement = useCallback((id: string) => {
    setMeasurements((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const handleClearMeasurements = useCallback(() => {
    setMeasurements([]);
    setDraftPoints([]);
  }, []);

  const handleStepBack = useCallback(() => {
    setNavHistory((prev) => {
      if (prev.length === 0) return prev;
      const entry = prev[prev.length - 1];
      setActiveTab(entry.activeTab);
      setFichaSubView(entry.fichaSubView);
      setSelectedId(entry.selectedId);
      setIsolated(entry.isolated);
      setCutaway(entry.cutaway);
      setExplode(entry.explode);
      setRenderMode(entry.renderMode);
      setCameraProjection(entry.cameraProjection);
      setXrayExposure(entry.xrayExposure);
      setXrayInverted(entry.xrayInverted);
      setBlindMode(entry.blindMode);
      setDissectMode(entry.dissectMode);
      setMpr(entry.mpr);
      sceneRef.current?.setHiddenStructureIds(entry.hiddenIds);
      setModelBump((n) => n + 1);
      return prev.slice(0, -1);
    });
  }, []);

  const handleGoHome = useCallback(() => {
    setNavHistory([]);
    setSystems(createInitialSystems());
    setLayers(createInitialLayers());
    setCutaway('none');
    setExplode(0);
    setIsolated(false);
    setSelectedId(null);
    setBlindMode(false);
    setDissectMode(false);
    setMeasureMode('none');
    setDraftPoints([]);
    setMeasurements([]);
    setVitalSigns(false);
    setRenderMode('anatomico');
    setCameraProjection('perspective');
    setXrayExposure(1.0);
    setXrayInverted(false);
    setMpr({
      sagittal: { enabled: false, value: 0, flip: false },
      transverse: { enabled: false, value: 0.2, flip: false },
      dorsal: { enabled: false, value: 1.1, flip: false },
    });
    setReferencePlane((prev) => (prev.visible ? { ...prev, visible: false } : prev));
    setActiveTab('sistemas');
    setFichaSubView('ficha');
    setDockCollapsed(false);
    sceneRef.current?.showAllStructures();
    const defaultCam = CAMERA_PRESETS.find((p) => p.id === 'tres-cuartos');
    if (defaultCam) {
      sceneRef.current?.setCameraView(defaultCam.position, defaultCam.target);
    }
    setModelBump((n) => n + 1);
  }, []);

  // Keyboard shortcuts: H (toggle HUD), Alt+ArrowLeft (step back), Escape (cancel measure / close deep view)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'h' || e.key === 'H') {
        setHudHidden((prev) => !prev);
      } else if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        handleStepBack();
      } else if (e.key === 'Escape') {
        if (draftPoints.length > 0) {
          setDraftPoints([]);
        } else if (measureMode !== 'none') {
          setMeasureMode('none');
        } else if (fichaSubView === 'edit' || fichaSubView === 'coverage') {
          handleStepBack();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [draftPoints.length, fichaSubView, handleStepBack, measureMode]);

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

  const handleTabChange = useCallback(
    (nextTab: DockTab) => {
      if (nextTab === activeTab) return;
      const tabNames: Record<DockTab, string> = {
        sistemas: 'Sistemas',
        capas: 'Capas',
        imagenologia: 'TC y Rx',
        camaras: 'Cámaras',
        ficha: 'Catálogo',
        quiz: 'Quiz',
      };
      pushHistory(tabNames[activeTab]);
      setActiveTab(nextTab);
    },
    [activeTab, pushHistory],
  );

  const handleFichaSubViewChange = useCallback(
    (nextView: FichaSubView) => {
      if (nextView === fichaSubView) return;
      const labels: Record<FichaSubView, string> = {
        ficha: 'Ficha',
        coverage: 'Cobertura',
        edit: 'Editor de ficha',
      };
      pushHistory(labels[fichaSubView]);
      setFichaSubView(nextView);
    },
    [fichaSubView, pushHistory],
  );

  const handleCutawayChange = useCallback(
    (next: CutawayMode) => {
      if (next === cutaway) return;
      pushHistory(cutaway === 'none' ? 'Caballo completo' : `Corte ${cutaway}`);
      setCutaway(next);
    },
    [cutaway, pushHistory],
  );

  const handleRenderModeChange = useCallback(
    (next: RenderViewMode) => {
      if (next === renderMode) return;
      pushHistory(`Modo ${renderMode}`);
      setRenderMode(next);
    },
    [pushHistory, renderMode],
  );

  const handleApplyStudyPreset = useCallback(
    (preset: StudyPreset) => {
      pushHistory('Modo de estudio anterior');
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
      setModelBump((n) => n + 1);
    },
    [pushHistory],
  );

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
    setModelBump((n) => n + 1);
  }, []);

  const handleRestoreHidden = useCallback(() => {
    pushHistory('Antes de restaurar');
    setIsolated(false);
    sceneRef.current?.showAllStructures();
    setModelBump((n) => n + 1);
  }, [pushHistory]);

  const handleHideSelected = useCallback(() => {
    if (!selectedId) return;
    pushHistory(`Ocultar ${byId[selectedId]?.es || selectedId}`);
    sceneRef.current?.setStructureVisible(selectedId, false);
    setSelectedId(null);
    setFichaSubView('ficha');
    setModelBump((n) => n + 1);
  }, [byId, pushHistory, selectedId]);

  const handleToggleTheme = useCallback(() => {
    setSceneTheme((prev) => {
      const next: SceneTheme = prev === 'atlas' ? 'oscuro' : 'atlas';
      persist('va_theme', next);
      return next;
    });
  }, [persist]);

  const handleResetMpr = useCallback(() => {
    setMpr({
      sagittal: { enabled: false, value: 0, flip: false },
      transverse: { enabled: false, value: 0.2, flip: false },
      dorsal: { enabled: false, value: 1.1, flip: false },
    });
  }, []);

  const handleIsolateSelected = useCallback(() => {
    if (!selectedId) return;
    pushHistory('Antes de aislar');
    setIsolated(true);
    sceneRef.current?.isolateStructure(selectedId);
    sceneRef.current?.focusOnStructure(selectedId);
    setModelBump((n) => n + 1);
  }, [pushHistory, selectedId]);

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

  const has3DAnchorFn = useCallback(
    (id: string) => sceneRef.current?.has3DAnchor(id) ?? false,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mounted3DCount, modelBump],
  );

  const get3DAnchorTargetFn = useCallback(
    (id: string) => sceneRef.current?.get3DAnchorTargetRecord(id) ?? null,
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

  const hiddenCount = useMemo(
    () => sceneRef.current?.getHiddenStructureCount() ?? 0,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mounted3DCount, isolated, modelBump],
  );

  const selectedStructure = selectedId
    ? byId[selectedId] || byTraceabilityId[selectedId] || null
    : null;
  const selectedProxyTarget =
    selectedStructure && !hasMeshFn(selectedStructure.id)
      ? get3DAnchorTargetFn(selectedStructure.id)
      : null;
  const hoveredStructure = hoveredInfo.id
    ? byId[hoveredInfo.id] || byTraceabilityId[hoveredInfo.id] || null
    : null;

  const isAtHome =
    activeTab === 'sistemas' &&
    !selectedId &&
    !isolated &&
    hiddenCount === 0 &&
    cutaway === 'none' &&
    explode === 0 &&
    renderMode === 'anatomico' &&
    cameraProjection === 'perspective' &&
    !dissectMode &&
    measureMode === 'none' &&
    measurements.length === 0 &&
    !blindMode &&
    !mpr.sagittal.enabled &&
    !mpr.transverse.enabled &&
    !mpr.dorsal.enabled &&
    !referencePlane.visible;

  const breadcrumbs: BreadcrumbStep[] = useMemo(() => {
    const steps: BreadcrumbStep[] = [
      {
        id: 'home',
        label: 'Inicio',
        onClick: isAtHome ? undefined : handleGoHome,
      },
    ];

    const tabLabels: Record<DockTab, string> = {
      sistemas: 'Sistemas y planos',
      capas: 'Capas y disección',
      imagenologia: 'TC y Rx',
      camaras: 'Cámaras',
      ficha: 'Catálogo y ficha',
      quiz: 'Autoevaluación',
    };

    if (activeTab !== 'sistemas') {
      steps.push({
        id: `tab-${activeTab}`,
        label: tabLabels[activeTab],
        onClick:
          activeTab === 'ficha' && (fichaSubView !== 'ficha' || !!selectedStructure)
            ? () => {
                pushHistory(fichaSubView === 'edit' ? 'Editor de ficha' : 'Ficha');
                setFichaSubView('ficha');
                setSelectedId(null);
              }
            : undefined,
      });
    }

    if (renderMode !== 'anatomico') {
      steps.push({
        id: `mode-${renderMode}`,
        label: renderMode === 'radiografia' ? 'Radiografía Rx' : 'Cortical TC',
        onClick: () => handleRenderModeChange('anatomico'),
      });
    }

    if (cameraProjection === 'orthographic') {
      steps.push({
        id: 'proj-ortho',
        label: 'Ortográfica 1:1',
        onClick: () => setCameraProjection('perspective'),
      });
    }

    if (mpr.sagittal.enabled || mpr.transverse.enabled || mpr.dorsal.enabled) {
      steps.push({
        id: 'mpr-active',
        label: 'Corte MPR',
        onClick: handleResetMpr,
      });
    }

    if (cutaway !== 'none') {
      steps.push({
        id: `cutaway-${cutaway}`,
        label: cutaway === 'left' ? 'Corte izq.' : 'Corte der.',
        onClick: () => handleCutawayChange('none'),
      });
    }

    if (hiddenCount > 0 && !isolated) {
      steps.push({
        id: 'hidden-layers',
        label: `Disección (${hiddenCount} ocultas)`,
        onClick: handleRestoreHidden,
      });
    }

    if (isolated) {
      steps.push({
        id: 'isolated',
        label: 'Pieza aislada',
        onClick: handleRestoreHidden,
      });
    }

    if (selectedStructure) {
      steps.push({
        id: `sel-${selectedStructure.id}`,
        label: blindMode ? selectedStructure.id : selectedStructure.es,
        onClick:
          activeTab === 'ficha' && fichaSubView !== 'ficha'
            ? () => handleFichaSubViewChange('ficha')
            : undefined,
      });
    }

    if (activeTab === 'ficha' && fichaSubView === 'coverage') {
      steps.push({ id: 'ficha-coverage', label: 'Cobertura' });
    } else if (activeTab === 'ficha' && selectedStructure && fichaSubView === 'edit') {
      steps.push({ id: 'ficha-edit', label: 'Editar ficha' });
    }

    if (measureMode !== 'none' || measurements.length > 0) {
      steps.push({
        id: 'measure-3d',
        label:
          measureMode === 'ruler'
            ? 'Regla 3D'
            : measureMode === 'goniometer'
              ? 'Goniómetro'
              : `Mediciones (${measurements.length})`,
        onClick: () => {
          setMeasureMode('none');
          setDraftPoints([]);
          setMeasurements([]);
        },
      });
    }

    return steps;
  }, [
    activeTab,
    blindMode,
    cameraProjection,
    cutaway,
    fichaSubView,
    handleCutawayChange,
    handleFichaSubViewChange,
    handleGoHome,
    handleRenderModeChange,
    handleResetMpr,
    handleRestoreHidden,
    hiddenCount,
    isAtHome,
    isolated,
    measureMode,
    measurements.length,
    mpr.dorsal.enabled,
    mpr.sagittal.enabled,
    mpr.transverse.enabled,
    pushHistory,
    renderMode,
    selectedStructure,
  ]);

  const prevStepLabel =
    navHistory.length > 0 ? navHistory[navHistory.length - 1].label : undefined;

  return (
    <div
      className={`relative h-screen w-screen overflow-hidden text-slate-100 select-none transition-colors ${
        (sceneTheme === 'atlas' && renderMode === 'anatomico') ||
        (renderMode === 'radiografia' && xrayInverted)
          ? 'bg-[#e8edf3]'
          : 'bg-[#0c1118]'
      }`}
    >
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

      {/* Projected 3D Ruler & Articular Goniometer Badges */}
      {!hudHidden && measurementBadges.length > 0 && (
        <div className="pointer-events-none fixed inset-0 z-10 overflow-hidden">
          {measurementBadges.map((b) => {
            const isRuler = b.kind === 'ruler';
            return (
              <div
                key={b.id}
                style={{ left: b.x, top: b.y }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] shadow-md ${
                  b.draft
                    ? 'border border-dashed border-teal-400/80 bg-[#0e141d]/95 text-teal-200'
                    : isRuler
                      ? 'border border-cyan-500/60 bg-[#0e141d]/95 text-cyan-200'
                      : 'border border-amber-500/60 bg-[#0e141d]/95 text-amber-200'
                }`}
              >
                <span className="font-mono font-semibold tabular-nums">{b.primary}</span>
                {b.secondary && (
                  <span className="ml-1.5 text-[10px] text-slate-300">{b.secondary}</span>
                )}
              </div>
            );
          })}
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
        onCutawayChange={handleCutawayChange}
        vitalSigns={vitalSigns}
        onToggleVitalSigns={() => setVitalSigns((v) => !v)}
        dissectMode={dissectMode}
        onToggleDissectMode={handleToggleDissectMode}
        measureMode={measureMode}
        onToggleMeasureMode={handleMeasureModeChange}
        hiddenCount={hiddenCount}
        onRestoreHidden={handleRestoreHidden}
        renderMode={renderMode}
        xrayInverted={xrayInverted}
        sceneTheme={sceneTheme}
        onToggleTheme={handleToggleTheme}
        canStepBack={navHistory.length > 0}
        prevStepLabel={prevStepLabel}
        onStepBack={handleStepBack}
        isAtHome={isAtHome}
        onGoHome={handleGoHome}
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
        onTabChange={handleTabChange}
        hudHidden={hudHidden}
        selectedStructure={selectedStructure}
        selectedModelState={selectedStructure ? getModelStateFn(selectedStructure.id) : 'pendiente'}
        selectedModelMeta={selectedStructure ? loadedModelMeta[selectedStructure.id] : undefined}
        selectedHasMesh={selectedStructure ? hasMeshFn(selectedStructure.id) : false}
        selectedProxyTarget={selectedProxyTarget}
        isolated={isolated}
        onFocusSelected={() => selectedStructure && sceneRef.current?.focusOnStructure(selectedStructure.id)}
        onIsolateSelected={handleIsolateSelected}
        onHideSelected={handleHideSelected}
        hiddenCount={hiddenCount}
        dissectMode={dissectMode}
        onToggleDissectMode={handleToggleDissectMode}
        sceneTheme={sceneTheme}
        onToggleTheme={handleToggleTheme}
        onShowAll={handleShowAll}
        onUploadGlb={handleUploadGlbClick}
        onUploadBatchGlb={() => batchGlbInputRef.current?.click()}
        onClearSelection={() => {
          if (selectedId) {
            pushHistory(byId[selectedId]?.es || 'Selección');
            setSelectedId(null);
            setFichaSubView('ficha');
          }
        }}
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
        onCutawayChange={handleCutawayChange}
        showLabels={showLabels}
        onToggleLabels={() => setShowLabels((v) => !v)}
        blindMode={blindMode}
        onToggleBlindMode={() => setBlindMode((v) => !v)}
        onSelectCameraPreset={handleSelectCameraPreset}
        renderMode={renderMode}
        onRenderModeChange={handleRenderModeChange}
        cameraProjection={cameraProjection}
        onCameraProjectionChange={setCameraProjection}
        xrayExposure={xrayExposure}
        onXrayExposureChange={setXrayExposure}
        xrayInverted={xrayInverted}
        onXrayInvertedChange={setXrayInverted}
        mpr={mpr}
        onMprChange={setMpr}
        onResetMpr={handleResetMpr}
        referencePlane={referencePlane}
        onReferencePlaneChange={setReferencePlane}
        onUploadReferenceImage={() => refImageInputRef.current?.click()}
        measureMode={measureMode}
        onMeasureModeChange={handleMeasureModeChange}
        measureUnit={measureUnit}
        onMeasureUnitChange={setMeasureUnit}
        measurements={measurements}
        draftPoints={draftPoints}
        onUndoDraftPoint={handleUndoDraftPoint}
        onDeleteMeasurement={handleDeleteMeasurement}
        onClearMeasurements={handleClearMeasurements}
        onFocusMeasurePoint={(pos) => sceneRef.current?.focusOnPoint(pos)}
        onApplyMeasurePreset={handleApplyMeasurePreset}
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
        has3DAnchorFn={has3DAnchorFn}
        get3DAnchorTargetFn={get3DAnchorTargetFn}
        getModelStateFn={getModelStateFn}
        isVisibleOverrideFn={isVisibleOverrideFn}
        onSelectStructure={(id) => {
          const resolved = byId[id] || byTraceabilityId[id];
          const nextId = resolved ? resolved.id : id;
          if (nextId !== selectedId) {
            pushHistory(selectedId ? byId[selectedId]?.es || 'Selección anterior' : 'Catálogo');
            setSelectedId(nextId);
          }
        }}
        onFocusStructure={(id) => sceneRef.current?.focusOnStructure(id)}
        onToggleFavorite={handleToggleFavorite}
        onToggleStructureVisible={(id) => {
          pushHistory(`Visibilidad ${byId[id]?.es || id}`);
          const cur = isVisibleOverrideFn(id);
          sceneRef.current?.setStructureVisible(id, !cur);
          setModelBump((n) => n + 1);
        }}
        onUpdateNote={handleUpdateNote}
        onUpdateFichaDraft={handleUpdateFichaDraft}
        onClearFichaDraft={handleClearFichaDraft}
        onVerifyAndNext={handleVerifyAndNext}
        fichaSubView={fichaSubView}
        onFichaSubViewChange={handleFichaSubViewChange}
        breadcrumbs={breadcrumbs}
        canStepBack={navHistory.length > 0}
        prevStepLabel={prevStepLabel}
        onStepBack={handleStepBack}
        isAtHome={isAtHome}
        onGoHome={handleGoHome}
        quizProgress={quizProgress}
        getVisible3DIdsFn={getVisible3DIdsFn}
        onQuizProgressChange={handleQuizProgressChange}
        onQuizHighlight={(id, forceBlind) => {
          setBlindMode(forceBlind);
          setSelectedId(id);
          if (id && (hasMeshFn(id) || has3DAnchorFn(id))) {
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
