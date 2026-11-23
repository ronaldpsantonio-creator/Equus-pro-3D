#!/usr/bin/env node
/**
 * Sincroniza y valida los 12 catálogos anatómicos y láminas desde ProClaVet-core
 * hacia Equus-pro-3D usando las reglas oficiales de schemas/estructura.schema.json.
 *
 * Uso:
 *   node scripts/sync-proclavet.mjs                 # Descarga, valida y actualiza archivos locales
 *   node scripts/sync-proclavet.mjs --validate-only # Solo valida public/data/sistemas/*.json
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

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

const args = new Set(process.argv.slice(2));
const validateOnly = args.has('--validate-only');

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Equus-pro-3D-sync/1.0' },
  });
  if (!res.ok) {
    throw new Error(`Error HTTP ${res.status} al consultar ${url}`);
  }
  return res.text();
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

async function main() {
  const dataDir = path.join(ROOT_DIR, 'public', 'data', 'sistemas');
  const platesDir = path.join(ROOT_DIR, 'public', 'assets', 'laminas');
  const schemaPath = path.join(ROOT_DIR, 'schemas', 'estructura.schema.json');

  console.log(
    validateOnly
      ? 'Validando catálogos locales de Equus-pro-3D contra estructura.schema.json...'
      : `Sincronizando desde ProClaVet-core (${DEFAULT_BASE_URL})...`,
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
        const raw = await fetchText(`${DEFAULT_BASE_URL}/data/sistemas/${file}`);
        payloads.set(file, raw);
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
  }

  console.log('\nResumen de validación ProClaVet:');
  for (const row of perFileStats) {
    console.log(
      `  - ${row.file.padEnd(29)} ${String(row.count).padStart(4)} registros | ${String(row.fichas).padStart(3)} con ficha`,
    );
  }
  console.log(`\nTotal: ${totalRecords} registros, ${seenIds.size} IDs únicos, ${totalFichas} fichas.`);
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
