# Hoja de ruta: Realismo 3D y respaldo imagenológico (TC / Rx) — Equus 3D · ProClaVet

Documento de referencia para la siguiente fase de mejora morfológica y visual de los modelos 3D en **Equus 3D · ProClaVet**.

---

## 1. Flujo de respaldo morfológico: DICOM (TC) → `.glb` + Calibración Rx

1. **Segmentación volumétrica desde TC equina real:**
   - Software recomendado: **3D Slicer** (*Segment Editor*) o **ITK-SNAP**.
   - Segmentar por rangos de unidades Hounsfield (HU): hueso cortical/esponjoso, cartílagos mineralizados, tráquea/pulmón y tejidos blandos con contraste.
   - Exportar mallas base (`.stl` / `.obj`) conservando relieves anatómicos reales (cóndilos, trócleas, crestas, forámenes nutricios, senos paranasales).

2. **Optimización y validación ortogonal con Radiografías (Rx) en Blender:**
   - Cargar radiografías reales calibradas en escala métrica como referencia ortográfica:
     - **Lateromedial (LM)**
     - **Dorsopalmar / Dorsoplantar (DP)**
     - **Oblicuas** (especialmente en carpo, tarso y aparato podotroclear)
   - Verificar proporciones y ángulos fisiológicos en estación:
     - Eje podofalángico (~48–55°) y relación falange distal–navicular–tendón flexor digital profundo.
     - Ángulo del menudillo (~140–150°), inclinación escapular (~55–60°) y escapulohumeral (~100–110°).
     - Curvatura cervical en S (`C1`–`C7`) y profundidad/anchura torácica real (`T1`–`T18`).
   - Reducir densidad a **15k–60k triángulos** (piezas complejas como cráneo, pelvis, carpo/tarso) y **3k–12k** (huesos largos/costillas) aplicando *Remesh/Decimate* sin perder detalles de inserción.

3. **Compresión web obligatoria:**
   - Exportar en `.glb` con compresión **Draco** (y texturas WebP/KTX2) para mantener piezas de alta fidelidad entre **400 KB y 2 MB** y preservar el funcionamiento fluido y offline en la PWA.

---

## 2. Convención espacial única y direcciones anatómicas

Respetar estrictamente la convención definida en `src/three/anatomyCoords.ts` (en metros, escala `1:1` con cascos apoyados en `Y = 0`):

- **`+X`**: Craneal (hacia el hocico) | **`-X`**: Caudal (hacia la cola)
- **`+Y`**: Dorsal (arriba) | **`-Y`**: Ventral (suelo = `0`)
- **`+Z`**: Lado derecho | **`-Z`**: Lado izquierdo

### Reglas de ensamblaje en escena maestra
- Trabajar todas las estructuras dentro de una **única escena maestra en Blender** y exportar cada `.glb` manteniendo su **origen global compartido**, de modo que `loadManifestModels()` (`autoFitIsolated = false`) ensamble articulaciones y vísceras con contacto real sin desplazamientos.
- Nombrar cada archivo con el `id` oficial de ProClaVet (p. ej. `equ.ske.ext.001.glb` o ID en `trazabilidad_ids`) dentro de `public/models/equino/<sistema>/`.
- Acompañar cada `.glb` con su archivo hermano `<ID>.meta.json` declarando licencia, fuente, modalidad de respaldo (TC/Rx) y notas de calibración.

---

## 3. Realismo visual PBR en mallas y texturas

- **Normal Map + Ambient Occlusion (AO)** horneados desde la malla de alta resolución (TC) para revelar surcos vasculares, suturas, forámenes y estriaciones musculares/tendinosas sin disparar el conteo poligonal.
- **Roughness Map diferenciado:** hueso cortical mate-satinado (`0.55–0.70`), carillas articulares con cartílago hialino brillante (`0.15–0.25` + `clearcoat`), serosas viscerales húmedas y fascia nacarada.
- Preservar las texturas PBR originales de los `.glb` cargados al aplicar selección/hover/opacidad en `EquineSceneManager.ts`.

---

## 4. Mejoras planificadas para el visor 3D (`EquineSceneManager.ts` + UI)

1. **Soporte `DRACOLoader` + `MeshoptDecoder`** en `GLTFLoader` para cargar modelos `.glb` reales comprimidos.
2. **Planos de corte tipo Tomografía (MPR en tiempo real):** habilitar `renderer.localClippingEnabled = true` con 3 deslizadores (**Sagital**, **Transverso** y **Dorsal**).
3. **Modo Radiografía virtual (X-Ray Shader):** renderizado translúcido por espesor/Fresnel en escala radiográfica para comparar directamente contra Rx reales.
4. **Calcos radiográficos calibrados en vistas ortográficas:** opción para superponer placas Rx de referencia detrás del esqueleto en cámaras ortográficas.
5. **Ampliación de `<ID>.meta.json` y ficha 3D:** campos para modalidad de respaldo (`TC`, `Rx`, `Resonancia`, `Fotogrametría`), resolución de corte y proyección de referencia.

---

## 5. Prioridad sugerida de sustitución por regiones clínicas

1. **Extremidad distal** (metacarpo/metatarso III, falanges I–III, navicular, sesamoideos, tendones flexores, ligamento suspensor y casco).
2. **Carpo y Tarso** (articulaciones complejas).
3. **Cráneo y arcadas dentarias** (senos paranasales y mandíbula).
4. **Corazón, grandes vasos y aparato digestivo** (estómago, ciego y colon mayor).
