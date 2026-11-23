# Modelos 3D reales (.glb) de Equus 3D · ProClaVet

Coloca aquí los modelos anatómicos reales en formato `.glb` (con o sin compresión **Draco**) siguiendo el estándar de **ProClaVet-core**:

- **Ruta recomendada por sistema/tipo:**
  - `public/models/equino/ske/equ.ske.cer.001.glb`
  - `public/models/equino/organs/equ.car.cor.001.glb`
  - `public/models/equino/mus/equ.mus.cab.002.glb`
- **Convención espacial obligatoria (`anatomyCoords.ts`):**
  - Escala en metros `1:1` con los cascos apoyados en `Y = 0`.
  - `+X` = Craneal (hocico), `-X` = Caudal (cola), `+Y` = Dorsal, `+Z` = Lado derecho, `-Z` = Lado izquierdo.
  - Exportar desde escena maestra única conservando las coordenadas globales compartidas.
- **Nombre del archivo:** debe coincidir con el `id` oficial de la estructura (o con un ID histórico de `trazabilidad_ids`, p. ej. `equ.ske.amt.004-i.glb`).
- **Metadatos de respaldo imagenológico y licencia (`<ID>.meta.json`):**
  ```json
  {
    "licencia": "CC BY 4.0",
    "fuente": "Colección Anatómica Veterinaria",
    "modalidad_respaldo": "TC + Rx",
    "resolucion_corte": "0.625 mm",
    "proyeccion_referencia": "LM / DP / Oblicua",
    "calibracion_anatomica": "Equino adulto ~500 kg · eje podofalángico 52°",
    "notas": "Segmentado en 3D Slicer y validado ortogonalmente con radiografías"
  }
  ```

Al ejecutar `npm run models:index`, `npm run validate:catalog` o el despliegue automático en GitHub Actions, se actualiza `manifest.json` y el visor 3D carga automáticamente los `.glb` (incluyendo compresión Draco offline) sin bloquear el arranque.
