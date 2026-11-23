import {
  InventoryReport,
  LAYERS,
  LayerCode,
  StructureRecord,
  SYSTEMS,
  SystemCode,
} from '../types/proclavet';

export interface CatalogLoadResult {
  structures: StructureRecord[];
  byId: Record<string, StructureRecord>;
  report: InventoryReport;
}

export async function loadProClaVetCatalog(): Promise<CatalogLoadResult> {
  const perSystemCount = Object.fromEntries(SYSTEMS.map((s) => [s.code, 0])) as Record<
    SystemCode,
    number
  >;
  const perLayerCount = Object.fromEntries(LAYERS.map((l) => [l.code, 0])) as Record<
    LayerCode,
    number
  >;

  const parts = await Promise.all(
    SYSTEMS.map(async (sysEntry) => {
      const url = `${import.meta.env.BASE_URL}data/sistemas/${sysEntry.file}`;
      const res = await fetch(url, { cache: 'no-cache' });
      if (!res.ok) {
        throw new Error(`Error cargando ${sysEntry.file} (HTTP ${res.status})`);
      }
      const data = await res.json();
      const rawArr: StructureRecord[] = data.structures || data.estructuras || [];
      return rawArr
        .filter((s) => !s.id.startsWith('equ.prv.ske.'))
        .map((s) => ({
          ...s,
          _catalog: sysEntry.code,
        }));
    }),
  );

  const structures = parts.flat();
  const byId: Record<string, StructureRecord> = {};
  const selfTraceabilityIds: string[] = [];
  const uniquePrimary = new Set<string>();

  let equivalentCount = 0;
  let withFichaCount = 0;
  let verifiedCount = 0;

  for (const s of structures) {
    if (uniquePrimary.has(s.id)) {
      throw new Error(`ID primario duplicado detectado en catálogo: ${s.id}`);
    }
    uniquePrimary.add(s.id);
    byId[s.id] = s;

    const cat = s._catalog === 'art' ? 'art' : s.sys;
    if (cat in perSystemCount) perSystemCount[cat]++;
    if (s.layer in perLayerCount) perLayerCount[s.layer]++;

    if (s.trazabilidad_ids && s.trazabilidad_ids.includes(s.id)) {
      selfTraceabilityIds.push(s.id);
    }
    equivalentCount += (s.trazabilidad_ids && s.trazabilidad_ids.length) || 1;

    if (s.ficha && Object.keys(s.ficha).length > 0) {
      withFichaCount++;
    }
    const estado = s.revision?.estado;
    if (estado === 'verificada' || estado === 'aprobada_y_verificada') {
      verifiedCount++;
    }
  }

  return {
    structures,
    byId,
    report: {
      totalRecords: structures.length,
      uniquePrimaryIds: uniquePrimary.size,
      equivalentCount,
      selfTraceabilityIds,
      withFichaCount,
      verifiedCount,
      perSystemCount,
      perLayerCount,
    },
  };
}
