# Equus 3D · ProClaVet

Atlas anatómico equino interactivo en 3D construido con React, TypeScript, Tailwind CSS y Three.js sobre los 12 catálogos anatómicos de **ProClaVet-core**.

## Características principales
- **3.856 estructuras anatómicas** organizadas en **12 sistemas** (`ske`, `art`, `mus`, `dig`, `res`, `car`, `ner`, `uri`, `rep`, `teg`, `end`, `sen`) y **10 capas** (`pel`, `fas`, `msu`, `mpr`, `oss`, `art`, `vas`, `ner`, `org`, `cav`).
- **Visor 3D por capas** con control individual de visibilidad y opacidad, vista explosiva (*separar capas*), corte sagital (*izquierdo / derecho / completo*), animación fisiológica de signos vitales y carga local de modelos `.glb`.
- **Fichas oficiales de 12 apartados (NAV)**, láminas SVG (`C1` y `C2`), filtro por sexo (`Caballo ♂ / Yegua ♀`), notas personales, verificación y modo **Autoevaluación (Quiz)**.

## Desarrollo local
```bash
npm install
npm run dev
```

## Compilación
```bash
npm run build
```
