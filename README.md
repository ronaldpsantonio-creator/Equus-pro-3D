# Equus 3D · ProClaVet

Atlas anatómico equino interactivo en 3D construido con React, TypeScript, Tailwind CSS y Three.js sobre los 12 catálogos anatómicos de **ProClaVet-core**.

## Características principales
- **Catálogo vivo sincronizado con `ProClaVet-core`** (**12 sistemas**: `ske`, `art`, `mus`, `dig`, `res`, `car`, `ner`, `uri`, `rep`, `teg`, `end`, `sen`; y **10 capas**: `pel`, `fas`, `msu`, `mpr`, `oss`, `art`, `vas`, `ner`, `org`, `cav`).
- **Visor 3D por capas** con control individual de visibilidad y opacidad, vista explosiva (*separar capas*), corte sagital (*izquierdo / derecho / completo*), animación fisiológica de signos vitales y carga local de modelos `.glb`.
- **Fichas oficiales de 12 apartados (NAV)**, láminas SVG (`C1` y `C2`), filtro por sexo (`Caballo ♂ / Yegua ♀`), notas personales, verificación y modo **Autoevaluación (Quiz)**.

## Sincronización y validación con `ProClaVet-core`
```bash
npm run validate:catalog   # Valida los 12 JSON locales contra schemas/estructura.schema.json
npm run sync:proclavet     # Descarga, valida y actualiza catálogos y láminas desde ProClaVet-core
```

## Desarrollo local
```bash
npm install --legacy-peer-deps
npm run dev
```

## Compilación
```bash
npm run build
```
