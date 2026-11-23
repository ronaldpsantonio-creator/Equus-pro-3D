# Modelos 3D reales (.glb) de Equus 3D · ProClaVet

Coloca aquí los modelos anatómicos reales en formato `.glb` siguiendo el estándar de **ProClaVet-core**:

- **Ruta recomendada por sistema/tipo:**
  - `public/models/equino/ske/equ.ske.cer.001.glb`
  - `public/models/equino/organs/equ.car.cor.001.glb`
  - `public/models/equino/mus/equ.mus.cab.002.glb`
- **Nombre del archivo:** debe coincidir con el `id` oficial de la estructura (o con un ID histórico de `trazabilidad_ids`, p. ej. `equ.ske.amt.004-i.glb`).
- **Metadatos opcionales de licencia/procedencia:** puedes crear un archivo hermano `<ID>.meta.json` junto al `.glb`:
  ```json
  {
    "licencia": "CC BY 4.0",
    "fuente": "Colección Anatómica Veterinaria",
    "notas": "Modelo segmentado por TC"
  }
  ```

Al ejecutar `npm run models:index`, `npm run validate:catalog` o el despliegue automático en GitHub Actions, se actualiza `manifest.json` y el visor 3D carga automáticamente los `.glb` disponibles sin bloquear el arranque.
