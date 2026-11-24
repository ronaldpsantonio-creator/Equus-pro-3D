#!/usr/bin/env node
/**
 * Sincroniza, fusiona de forma no destructiva y valida los 12 catálogos anatómicos
 * y láminas entre ProClaVet-core y Equus-pro-3D usando schemas/estructura.schema.json.
 *
 * Uso:
 *   node scripts/sync-proclavet.mjs                         # Descarga ProClaVet-core, fusiona sin sobrescribir fichas locales y valida
 *   node scripts/sync-proclavet.mjs --validate-only         # Solo valida public/data/sistemas/*.json
 *   node scripts/sync-proclavet.mjs --export-core <ruta>    # Respalda y equipara las fichas de Equus-pro-3D hacia un clon local de ProClaVet-core
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { indexEquineModels } from './index-models.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const DEFAULT_BASE_URL =
  process.env.PROCLAVET_CORE_URL ||
  'https://raw.githubusercontent.com/ronaldpsantonio-creator/ProClaVet-core/main';

const SYSTEM_FILES = [
  'sistema_esqueletico.json',
  'sistema_articular.json',
  'sistema_muscular.json',
  'sistema_digestivo.json',
  'sistema_respiratorio.json',
  'sistema_cardiovascular.json',
  'sistema_nervioso.json',
  'sistema_urinario.json',
  'sistema_reproductor.json',
  'sistema_tegumentario.json',
  'sistema_endocrino.json',
  'sistema_sensorial.json',
];

const PLATE_FILES = ['atlas-equino-c1.svg', 'axis-equino-c2.svg'];

const VALID_SYS = new Set([
  'car',
  'dig',
  'end',
  'mus',
  'ner',
  'rep',
  'res',
  'sen',
  'ske',
  'teg',
  'uri',
]);

const VALID_LAYER = new Set([
  'art',
  'cav',
  'fas',
  'mpr',
  'msu',
  'ner',
  'org',
  'oss',
  'pel',
  'vas',
]);

const VALID_SEX = new Set(['f', 'm']);

const VALID_FICHA_KEYS = [
  'ubicacion',
  'descripcion',
  'relaciones',
  'accidentes',
  'articulaciones',
  'inserciones',
  'irrigacion',
  'inervacion',
  'funcion',
  'especie',
  'clinica',
  'referencias',
];

const argv = process.argv.slice(2);
const args = new Set(argv);
const validateOnly = args.has('--validate-only');
const exportCoreFlagIdx = argv.indexOf('--export-core');
const exportCoreDir =
  exportCoreFlagIdx !== -1 && argv[exportCoreFlagIdx + 1]
    ? path.resolve(process.cwd(), argv[exportCoreFlagIdx + 1])
    : null;

function hasFicha(rec) {
  return Boolean(rec?.ficha && typeof rec.ficha === 'object' && Object.keys(rec.ficha).length > 0);
}

function getRevisionRank(rec) {
  const est = rec?.revision?.estado;
  switch (est) {
    case 'aprobada_y_verificada':
      return 4;
    case 'verificada':
      return 3;
    case 'aprobada':
      return 2;
    case 'redactada_pendiente_de_verificacion':
      return 1;
    default:
      return hasFicha(rec) ? 1 : 0;
  }
}

function adaptBilateralFichaForSide(remoteRec, localId) {
  const ficha = structuredClone(remoteRec.ficha);
  if (!ficha || typeof ficha !== 'object') return ficha;
  const sideLabel = localId.endsWith('-i')
    ? 'lado izquierdo'
    : localId.endsWith('-d')
      ? 'lado derecho'
      : null;
  if (!sideLabel || typeof ficha.ubicacion !== 'string') return ficha;

  if (/a cada lado/i.test(ficha.ubicacion)) {
    ficha.ubicacion = ficha.ubicacion.replace(/a cada lado/gi, `en el ${sideLabel}`);
  } else if (!new RegExp(sideLabel, 'i').test(ficha.ubicacion)) {
    ficha.ubicacion = `En el ${sideLabel}: ${ficha.ubicacion.charAt(0).toLowerCase()}${ficha.ubicacion.slice(1)}`;
  }
  return ficha;
}

function mergeSystemPayload(localRaw, remoteRaw) {
  if (!localRaw) return remoteRaw;

  let localParsed;
  let remoteParsed;
  try {
    localParsed = JSON.parse(localRaw);
    remoteParsed = JSON.parse(remoteRaw);
  } catch {
    return localRaw;
  }

  const localKey = Array.isArray(localParsed?.estructuras)
    ? 'estructuras'
    : Array.isArray(localParsed?.structures)
      ? 'structures'
      : null;
  const remoteList = remoteParsed?.estructuras || remoteParsed?.structures;
  if (!localKey || !Array.isArray(remoteList)) {
    return localRaw;
  }

  const localList = localParsed[localKey];
  const localById = new Map(localList.map((r) => [r.id, r]));

  const remoteById = new Map();
  const remoteByTrace = new Map();
  for (const r of remoteList) {
    if (r?.id) remoteById.set(r.id, r);
    if (Array.isArray(r?.trazabilidad_ids)) {
      for (const tid of r.trazabilidad_ids) {
        if (!remoteByTrace.has(tid)) remoteByTrace.set(tid, r);
      }
    }
  }

  let changed = false;

  for (const loc of localList) {
    const rem = remoteById.get(loc.id) || remoteByTrace.get(loc.id);
    if (!rem || !hasFicha(rem)) continue;

    const locHas = hasFicha(loc);
    const locRank = getRevisionRank(loc);
    const remRank = getRevisionRank(rem);

    if (!locHas || remRank > locRank) {
      const incoming = adaptBilateralFichaForSide(rem, loc.id);
      if (locHas && remRank > locRank) {
        // Conserva apartados extra locales si la ficha remota aprobada omitió alguno
        for (const k of VALID_FICHA_KEYS) {
          if (!incoming[k] && loc.ficha?.[k]) {
            incoming[k] = loc.ficha[k];
          }
        }
      }
      loc.ficha = incoming;
      if (rem.revision) {
        loc.revision = structuredClone(rem.revision);
      }
      changed = true;
    }
  }

  // Solo añade registros nuevos de ProClaVet-core si ni su ID ni su trazabilidad existen localmente
  for (const rem of remoteList) {
    if (!rem?.id) continue;
    if (localById.has(rem.id)) continue;
    const traces = Array.isArray(rem.trazabilidad_ids) ? rem.trazabilidad_ids : [];
    const anyTraceExists = traces.some((tid) => localById.has(tid));
    if (anyTraceExists) continue;

    localList.push(structuredClone(rem));
    localById.set(rem.id, rem);
    changed = true;
  }

  return changed ? `${JSON.stringify(localParsed, null, 2)}\n` : localRaw;
}

function generalizeSideFichaForBilateral(locRec, coreRec) {
  const ficha = structuredClone(locRec.ficha);
  if (!ficha || typeof ficha !== 'object') return ficha;

  const isBilateralCore =
    coreRec?.lateralidad === 'bilateral' ||
    (Array.isArray(coreRec?.trazabilidad_ids) && coreRec.trazabilidad_ids.length > 1) ||
    /\(bilateral\)/i.test(coreRec?.es || '');

  if (!isBilateralCore) return ficha;

  for (const k of VALID_FICHA_KEYS) {
    if (typeof ficha[k] !== 'string') continue;
    let text = ficha[k]
      .replace(/^En el lado (?:izquierdo|derecho):\s*/i, '')
      .replace(/\bdel lado (?:izquierdo|derecho)\b/gi, 'bilateral')
      .replace(/\ben el lado (?:izquierdo|derecho)\b/gi, 'a cada lado')
      .replace(/\b(?:izquierdo|derecho)\s+o\s+(?:izquierdo|derecho)\b/gi, 'de cada lado')
      .replace(/\s+\((?:izquierda|izquierdo|derecha|derecho)\)/gi, '');
    if (text.length > 0 && k === 'ubicacion') {
      text = text.charAt(0).toUpperCase() + text.slice(1);
    }
    ficha[k] = text;
  }
  return ficha;
}

function exportCoreSystemPayload(localRaw, coreRaw) {
  let localParsed;
  let coreParsed;
  try {
    localParsed = JSON.parse(localRaw);
    coreParsed = coreRaw ? JSON.parse(coreRaw) : null;
  } catch {
    return coreRaw;
  }

  const localList = localParsed?.estructuras || localParsed?.structures;
  if (!Array.isArray(localList)) return coreRaw;

  if (!coreParsed) {
    return `${JSON.stringify(localParsed, null, 2)}\n`;
  }

  const coreKey = Array.isArray(coreParsed?.estructuras)
    ? 'estructuras'
    : Array.isArray(coreParsed?.structures)
      ? 'structures'
      : null;
  if (!coreKey) return coreRaw;

  const coreList = coreParsed[coreKey];
  const localById = new Map(localList.map((r) => [r.id, r]));
  const coveredLocalIds = new Set();
  let changed = false;

  for (const coreRec of coreList) {
    if (coreRec?.id) coveredLocalIds.add(coreRec.id);
    const traces = Array.isArray(coreRec?.trazabilidad_ids) ? coreRec.trazabilidad_ids : [];
    for (const tid of traces) coveredLocalIds.add(tid);

    let locMatch = localById.get(coreRec.id);
    if (!locMatch || !hasFicha(locMatch)) {
      for (const tid of traces) {
        const candidate = localById.get(tid);
        if (candidate && hasFicha(candidate)) {
          locMatch = candidate;
          break;
        }
      }
    }

    if (!locMatch || !hasFicha(locMatch)) continue;

    const coreHas = hasFicha(coreRec);
    const coreKeyCount = coreHas ? Object.keys(coreRec.ficha).length : 0;
    const locKeyCount = Object.keys(locMatch.ficha).length;
    const coreRank = getRevisionRank(coreRec);
    const locRank = getRevisionRank(locMatch);

    if (!coreHas || locRank > coreRank || locKeyCount > coreKeyCount) {
      const exported = generalizeSideFichaForBilateral(locMatch, coreRec);
      if (coreHas && coreRank >= locRank) {
        // Conserva campos ya curados en ProClaVet-core y completa los faltantes desde Equus-pro-3D
        const mergedFicha = { ...exported, ...coreRec.ficha };
        for (const k of VALID_FICHA_KEYS) {
          if ((!mergedFicha[k] || !String(mergedFicha[k]).trim()) && exported[k]) {
            mergedFicha[k] = exported[k];
          }
        }
        coreRec.ficha = mergedFicha;
      } else {
        coreRec.ficha = exported;
        if (locMatch.revision && locRank >= coreRank) {
          coreRec.revision = structuredClone(locMatch.revision);
        }
      }
      changed = true;
    }
  }

  for (const locRec of localList) {
    if (!locRec?.id || coveredLocalIds.has(locRec.id)) continue;
    coreList.push(structuredClone(locRec));
    coveredLocalIds.add(locRec.id);
    changed = true;
  }

  return changed ? `${JSON.stringify(coreParsed, null, 2)}\n` : coreRaw;
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Equus-pro-3D-sync/1.0' },
  });
  if (!res.ok) {
    throw new Error(`Error HTTP ${res.status} al consultar ${url}`);
  }
  return res.text();
}

async function fetchRemoteModelTree() {
  try {
    const res = await fetch(
      'https://api.github.com/repos/ronaldpsantonio-creator/ProClaVet-core/git/trees/main?recursive=1',
      { headers: { 'User-Agent': 'Equus-pro-3D-sync/1.0' } },
    );
    if (!res.ok) return [];
    const data = await res.json();
    const tree = Array.isArray(data?.tree) ? data.tree : [];
    return tree
      .filter(
        (item) =>
          item?.type === 'blob' &&
          typeof item.path === 'string' &&
          item.path.startsWith('models/equino/') &&
          (item.path.toLowerCase().endsWith('.glb') || item.path.toLowerCase().endsWith('.meta.json')),
      )
      .map((item) => item.path);
  } catch {
    return [];
  }
}

function validateRecord(rec, fileName, idx, seenIds, errors, warnings) {
  if (!rec || typeof rec !== 'object' || Array.isArray(rec)) {
    errors.push(`${fileName}[${idx}]: El registro no es un objeto JSON válido.`);
    return;
  }

  for (const reqField of ['id', 'es', 'la', 'sys', 'layer']) {
    if (typeof rec[reqField] !== 'string' || rec[reqField].trim().length === 0) {
      errors.push(`${fileName}[${idx}] (${rec.id || 'sin-id'}): Falta campo requerido '${reqField}'.`);
    }
  }

  if (typeof rec.id === 'string' && rec.id.trim().length > 0) {
    if (seenIds.has(rec.id)) {
      errors.push(`${fileName}[${idx}]: ID primario duplicado '${rec.id}' (ya visto en ${seenIds.get(rec.id)}).`);
    } else {
      seenIds.set(rec.id, fileName);
    }
  }

  if (typeof rec.sys === 'string' && !VALID_SYS.has(rec.sys)) {
    errors.push(`${fileName}[${idx}] (${rec.id}): Código 'sys' inválido '${rec.sys}'.`);
  }

  if (typeof rec.layer === 'string' && !VALID_LAYER.has(rec.layer)) {
    errors.push(`${fileName}[${idx}] (${rec.id}): Código 'layer' inválido '${rec.layer}'.`);
  }

  if (rec.sex !== undefined && (typeof rec.sex !== 'string' || !VALID_SEX.has(rec.sex))) {
    errors.push(`${fileName}[${idx}] (${rec.id}): Valor 'sex' inválido '${String(rec.sex)}'.`);
  }

  if (rec.trazabilidad_ids !== undefined) {
    if (!Array.isArray(rec.trazabilidad_ids) || rec.trazabilidad_ids.some((x) => typeof x !== 'string')) {
      errors.push(`${fileName}[${idx}] (${rec.id}): 'trazabilidad_ids' debe ser un arreglo de strings.`);
    } else if (rec.trazabilidad_ids.includes(rec.id)) {
      warnings.push(`${fileName} (${rec.id}): incluye su propio ID en trazabilidad_ids.`);
    }
  }

  if (rec.ficha !== undefined) {
    if (!rec.ficha || typeof rec.ficha !== 'object' || Array.isArray(rec.ficha)) {
      errors.push(`${fileName}[${idx}] (${rec.id}): 'ficha' debe ser un objeto.`);
    } else {
      for (const k of VALID_FICHA_KEYS) {
        if (rec.ficha[k] !== undefined && typeof rec.ficha[k] !== 'string') {
          errors.push(`${fileName}[${idx}] (${rec.id}): ficha.${k} debe ser texto.`);
        }
      }
    }
  }
}

async function runExportCore(dataDir, coreRootDir) {
  const coreDataDir = path.join(coreRootDir, 'data', 'sistemas');
  try {
    await fs.access(coreDataDir);
  } catch {
    throw new Error(`No se encontró la carpeta '${coreDataDir}'. Verifica la ruta de ProClaVet-core.`);
  }

  console.log(`Equiparando y respaldando catálogos desde Equus-pro-3D hacia ${coreDataDir}...`);
  const seenIds = new Map();
  const errors = [];
  const warnings = [];
  let updatedFiles = 0;
  let totalRecords = 0;
  let totalFichas = 0;

  for (const file of SYSTEM_FILES) {
    const localRaw = await fs.readFile(path.join(dataDir, file), 'utf8');
    const corePath = path.join(coreDataDir, file);
    let coreRaw = null;
    try {
      coreRaw = await fs.readFile(corePath, 'utf8');
    } catch {
      coreRaw = null;
    }

    const nextRaw = exportCoreSystemPayload(localRaw, coreRaw);
    const parsed = JSON.parse(nextRaw);
    const list = parsed?.estructuras || parsed?.structures || [];
    let fileFichas = 0;
    list.forEach((rec, idx) => {
      validateRecord(rec, file, idx, seenIds, errors, warnings);
      if (hasFicha(rec)) fileFichas++;
    });
    totalRecords += list.length;
    totalFichas += fileFichas;

    if (nextRaw !== coreRaw) {
      await fs.writeFile(corePath, nextRaw, 'utf8');
      updatedFiles++;
    }
    console.log(
      `  - ${file.padEnd(29)} ${String(list.length).padStart(4)} registros | ${String(fileFichas).padStart(3)} con ficha`,
    );
  }

  if (errors.length > 0) {
    console.error(`\nSe encontraron ${errors.length} errores al exportar a ProClaVet-core:`);
    errors.slice(0, 25).forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }

  console.log(
    `\nRespaldo en ProClaVet-core completado: ${totalRecords} registros, ${totalFichas} fichas, ${updatedFiles} archivos actualizados.`,
  );
}

async function main() {
  const dataDir = path.join(ROOT_DIR, 'public', 'data', 'sistemas');
  const platesDir = path.join(ROOT_DIR, 'public', 'assets', 'laminas');
  const schemaPath = path.join(ROOT_DIR, 'schemas', 'estructura.schema.json');

  if (exportCoreDir) {
    await runExportCore(dataDir, exportCoreDir);
    return;
  }

  console.log(
    validateOnly
      ? 'Validando catálogos locales de Equus-pro-3D contra estructura.schema.json...'
      : `Sincronizando (fusión no destructiva) desde ProClaVet-core (${DEFAULT_BASE_URL})...`,
  );

  const payloads = new Map();
  let schemaText = null;
  const plateTexts = new Map();

  if (validateOnly) {
    for (const file of SYSTEM_FILES) {
      const fullPath = path.join(dataDir, file);
      const raw = await fs.readFile(fullPath, 'utf8');
      payloads.set(file, raw);
    }
  } else {
    schemaText = await fetchText(`${DEFAULT_BASE_URL}/schemas/estructura.schema.json`);
    JSON.parse(schemaText);

    await Promise.all(
      SYSTEM_FILES.map(async (file) => {
        const remoteRaw = await fetchText(`${DEFAULT_BASE_URL}/data/sistemas/${file}`);
        let localRaw = null;
        try {
          localRaw = await fs.readFile(path.join(dataDir, file), 'utf8');
        } catch {
          localRaw = null;
        }
        const merged = mergeSystemPayload(localRaw, remoteRaw);
        payloads.set(file, merged);
      }),
    );

    await Promise.all(
      PLATE_FILES.map(async (plate) => {
        const svg = await fetchText(`${DEFAULT_BASE_URL}/assets/laminas/${plate}`);
        plateTexts.set(plate, svg);
      }),
    );
  }

  const seenIds = new Map();
  const errors = [];
  const warnings = [];
  let totalRecords = 0;
  let totalFichas = 0;
  const perFileStats = [];

  for (const file of SYSTEM_FILES) {
    const raw = payloads.get(file);
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      errors.push(`${file}: JSON inválido (${err instanceof Error ? err.message : String(err)}).`);
      continue;
    }

    const list = parsed?.estructuras || parsed?.structures;
    if (!Array.isArray(list)) {
      errors.push(`${file}: Falta el arreglo 'estructuras' o 'structures'.`);
      continue;
    }

    let fileFichas = 0;
    list.forEach((rec, idx) => {
      validateRecord(rec, file, idx, seenIds, errors, warnings);
      if (rec?.ficha && typeof rec.ficha === 'object' && Object.keys(rec.ficha).length > 0) {
        fileFichas++;
      }
    });

    totalRecords += list.length;
    totalFichas += fileFichas;
    perFileStats.push({ file, count: list.length, fichas: fileFichas });
  }

  if (errors.length > 0) {
    console.error(`\nSe encontraron ${errors.length} errores de esquema:`);
    errors.slice(0, 25).forEach((e) => console.error(`  - ${e}`));
    if (errors.length > 25) {
      console.error(`  ... y ${errors.length - 25} errores adicionales.`);
    }
    process.exit(1);
  }

  let updatedFiles = 0;
  if (!validateOnly) {
    await fs.mkdir(dataDir, { recursive: true });
    await fs.mkdir(platesDir, { recursive: true });
    await fs.mkdir(path.dirname(schemaPath), { recursive: true });

    const writeIfChanged = async (targetPath, nextContent) => {
      let prev = null;
      try {
        prev = await fs.readFile(targetPath, 'utf8');
      } catch {
        // file does not exist yet
      }
      if (prev !== nextContent) {
        await fs.writeFile(targetPath, nextContent, 'utf8');
        updatedFiles++;
      }
    };

    if (schemaText) {
      await writeIfChanged(schemaPath, schemaText.endsWith('\n') ? schemaText : `${schemaText}\n`);
    }

    for (const [file, raw] of payloads.entries()) {
      await writeIfChanged(path.join(dataDir, file), raw.endsWith('\n') ? raw : `${raw}\n`);
    }

    for (const [plate, svg] of plateTexts.entries()) {
      await writeIfChanged(path.join(platesDir, plate), svg);
    }

    const remoteModelPaths = await fetchRemoteModelTree();
    for (const relModelPath of remoteModelPaths) {
      try {
        const res = await fetch(`${DEFAULT_BASE_URL}/${relModelPath}`, {
          headers: { 'User-Agent': 'Equus-pro-3D-sync/1.0' },
        });
        if (!res.ok) continue;
        const buf = Buffer.from(await res.arrayBuffer());
        const target = path.join(ROOT_DIR, 'public', relModelPath);
        await fs.mkdir(path.dirname(target), { recursive: true });
        let same = false;
        try {
          const prevBuf = await fs.readFile(target);
          same = prevBuf.equals(buf);
        } catch {
          // new model file
        }
        if (!same) {
          await fs.writeFile(target, buf);
          updatedFiles++;
        }
      } catch {
        // skip transient model fetch error
      }
    }
  }

  const { count: modelCount } = await indexEquineModels();

  console.log('\nResumen de validación ProClaVet:');
  for (const row of perFileStats) {
    console.log(
      `  - ${row.file.padEnd(29)} ${String(row.count).padStart(4)} registros | ${String(row.fichas).padStart(3)} con ficha`,
    );
  }
  console.log(`\nTotal: ${totalRecords} registros, ${seenIds.size} IDs únicos, ${totalFichas} fichas.`);
  console.log(`Modelos GLB indexados en public/models/equino/: ${modelCount}`);
  if (warnings.length > 0) {
    console.log(`Avisos de trazabilidad autorreferenciada (tolerados): ${warnings.length}`);
  }
  if (!validateOnly) {
    console.log(`Archivos actualizados en disco: ${updatedFiles}`);
  }
  console.log('Validación completada con éxito.');
}

main().catch((err) => {
  console.error('Fallo en sync-proclavet:', err);
  process.exit(1);
});
