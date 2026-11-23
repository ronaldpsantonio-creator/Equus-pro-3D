#!/usr/bin/env node
/**
 * Escanea public/models/equino/ en busca de archivos .glb reales y actualiza
 * public/models/equino/manifest.json vinculando cada archivo por ID primario o trazabilidad_ids.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

async function walkFiles(dir) {
  const out = [];
  let entries = [];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      out.push(...(await walkFiles(full)));
    } else if (ent.isFile()) {
      out.push(full);
    }
  }
  return out;
}

async function loadCatalogLookup() {
  const dataDir = path.join(ROOT_DIR, 'public', 'data', 'sistemas');
  const byId = new Map();
  const byTrace = new Map();
  let files = [];
  try {
    files = await fs.readdir(dataDir);
  } catch {
    return { byId, byTrace };
  }

  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    try {
      const parsed = JSON.parse(await fs.readFile(path.join(dataDir, f), 'utf8'));
      const list = parsed?.estructuras || parsed?.structures || [];
      for (const rec of list) {
        if (!rec?.id) continue;
        byId.set(rec.id, rec);
        byTrace.set(rec.id, rec);
        if (Array.isArray(rec.trazabilidad_ids)) {
          for (const tid of rec.trazabilidad_ids) {
            if (typeof tid === 'string' && !byTrace.has(tid)) {
              byTrace.set(tid, rec);
            }
          }
        }
      }
    } catch {
      // ignore invalid file here; schema validation catches it
    }
  }
  return { byId, byTrace };
}

export async function indexEquineModels() {
  const publicDir = path.join(ROOT_DIR, 'public');
  const modelsDir = path.join(publicDir, 'models', 'equino');
  const manifestPath = path.join(modelsDir, 'manifest.json');

  await fs.mkdir(modelsDir, { recursive: true });

  let existingModels = {};
  try {
    const prev = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    if (prev && typeof prev.models === 'object' && prev.models) {
      existingModels = prev.models;
    }
  } catch {
    // fresh manifest
  }

  const { byId, byTrace } = await loadCatalogLookup();
  const allFiles = await walkFiles(modelsDir);
  const glbFiles = allFiles.filter((f) => f.toLowerCase().endsWith('.glb')).sort();

  const nextModels = {};

  for (const fullPath of glbFiles) {
    const relFromPublic = path.relative(publicDir, fullPath).split(path.sep).join('/');
    const baseName = path.basename(fullPath, path.extname(fullPath));
    const matched = byId.get(baseName) || byTrace.get(baseName);
    const targetId = matched ? matched.id : baseName;

    let sidecarMeta = {};
    const metaPath = fullPath.replace(/\.glb$/i, '.meta.json');
    try {
      sidecarMeta = JSON.parse(await fs.readFile(metaPath, 'utf8'));
    } catch {
      // optional sidecar not present
    }

    const prevEntry = existingModels[targetId] || {};
    const entry = {
      path: relFromPublic,
    };

    const licencia = sidecarMeta.licencia || matched?.licencia || prevEntry.licencia;
    const fuente = sidecarMeta.fuente || matched?.fuente || prevEntry.fuente;
    const notas = sidecarMeta.notas || prevEntry.notas;
    const modalidadRespaldo = sidecarMeta.modalidad_respaldo || prevEntry.modalidad_respaldo;
    const resolucionCorte = sidecarMeta.resolucion_corte || prevEntry.resolucion_corte;
    const proyeccionReferencia =
      sidecarMeta.proyeccion_referencia || prevEntry.proyeccion_referencia;
    const calibracionAnatomica =
      sidecarMeta.calibracion_anatomica || prevEntry.calibracion_anatomica;

    if (licencia) entry.licencia = String(licencia);
    if (fuente) entry.fuente = String(fuente);
    if (notas) entry.notas = String(notas);
    if (modalidadRespaldo) entry.modalidad_respaldo = String(modalidadRespaldo);
    if (resolucionCorte) entry.resolucion_corte = String(resolucionCorte);
    if (proyeccionReferencia) entry.proyeccion_referencia = String(proyeccionReferencia);
    if (calibracionAnatomica) entry.calibracion_anatomica = String(calibracionAnatomica);
    if (baseName !== targetId) entry.archivo_original_id = baseName;

    nextModels[targetId] = entry;
  }

  const nextPayload = {
    version: 1,
    description:
      'Índice automático de modelos 3D (.glb) reales en public/models/equino/. Generado por npm run models:index o npm run validate:catalog.',
    models: nextModels,
  };

  const nextJson = `${JSON.stringify(nextPayload, null, 2)}\n`;
  let prevJson = null;
  try {
    prevJson = await fs.readFile(manifestPath, 'utf8');
  } catch {
    // ignore
  }

  if (prevJson !== nextJson) {
    await fs.writeFile(manifestPath, nextJson, 'utf8');
  }

  return {
    count: Object.keys(nextModels).length,
    manifestPath,
  };
}

if (process.argv[1] === __filename) {
  indexEquineModels()
    .then(({ count }) => {
      console.log(`Índice de modelos GLB actualizado: ${count} modelos encontrados en public/models/equino/.`);
    })
    .catch((err) => {
      console.error('Error indexando modelos GLB:', err);
      process.exit(1);
    });
}
