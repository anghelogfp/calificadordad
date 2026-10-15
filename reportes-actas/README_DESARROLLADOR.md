# Paquete de Actas y Reportes Técnicos de Calificación (UNA-PUNO — Poder Judicial)

Este paquete contiene la suite completa de **6 documentos formales (5 actas + 1 informe técnico)** diseñada para la recepción, validación, lectura óptica y calificación de exámenes bajo convenio interinstitucional entre la **Universidad Nacional del Altiplano de Puno** y la **Corte Superior de Justicia de Puno** (Concurso D.L. 728 N.° 001-2026-UE-PUNO).

---

## 🚀 1. Cómo probarlo en el navegador o generar los PDFs

### Visualizador Web Interactivo:
1. Abre el archivo **[`visor.html`](file:///D:/aplications/admision/calificadordad/reportes-actas/visor.html)** con doble clic en tu navegador preferido (Chrome, Edge, Firefox).
2. Usa la barra superior para alternar entre las 6 actas.
3. Haz clic en el botón verde **`🖨️ Imprimir / Guardar en PDF`** para imprimir o guardar cualquier acta en A4 con fidelidad milimétrica.

### Regeneración Automática de PDFs:
Para generar todos los PDFs individuales y el documento consolidado unificado vía Chrome Headless y Python:
```bash
python D:\aplications\admision\calificadordad\reportes-actas\generar_pdfs.py
```

---

## 📁 2. Estructura de Archivos del Paquete

| Archivo | Documento | Páginas A4 | Momento de Uso |
|---|---|:---:|---|
| **[`01-acta-inicio-apertura.html`](file:///D:/aplications/admision/calificadordad/reportes-actas/01-acta-inicio-apertura.html)** | Acta de Inicio y Apertura de Ambiente | 1 pág. | Antes de iniciar cualquier lectura en el centro de cómputo. |
| **[`02-acta-recepcion-digital.html`](file:///D:/aplications/admision/calificadordad/reportes-actas/02-acta-recepcion-digital.html)** | Acta de Recepción y Entrega Digital | 1 pág. | Recepción del padrón oficial `PLANTILLA_PARTICIPANTES_001-2026-UE-PUNO.xlsx` con su hash SHA-256 verificado. |
| **[`03-acta-recepcion-fisica.html`](file:///D:/aplications/admision/calificadordad/reportes-actas/03-acta-recepcion-fisica.html)** | Acta de Recepción Física + Anexo Aulas | 2 págs. | Recepción de sobres por aula en 2 columnas: **Grupo 1 (Turno Mañana: 998 post., 25 aulas)** y **Grupo 2 (Turno Tarde: 984 post., 25 aulas)**. |
| **[`04-acta-conformidad-claves.html`](file:///D:/aplications/admision/calificadordad/reportes-actas/04-acta-conformidad-claves.html)** | Acta de Conformidad de Claves Oficiales | 1 pág. | **Antes de calificar.** Aprobación de la matriz de 30 preguntas (escala a 300.000 pts) y hash criptográfico canónico. |
| **[`05-informe-tecnico.html`](file:///D:/aplications/admision/calificadordad/reportes-actas/05-informe-tecnico.html)** | Informe Técnico de Validación y Calificación | 2 págs. | Documento técnico consolidado con pruebas sintéticas, control de versiones del padrón y trazabilidad. |
| **[`06-acta-cierre.html`](file:///D:/aplications/admision/calificadordad/reportes-actas/06-acta-cierre.html)** | Acta de Cierre y Conformidad Final | 1 pág. | Culminación de labores y entrega formal de resultados a la Comisión. |
| **[`datos-ejemplo.json`](file:///D:/aplications/admision/calificadordad/reportes-actas/datos-ejemplo.json)** | Contrato de Datos JSON | - | Variables operativas sincronizadas (1,982 postulantes divididos en 2 grupos, 30 preguntas, hashes reales). |
| **`assets/logo-unap.png`** | Escudo Oficial UNA-PUNO | - | Logotipo institucional para el encabezado izquierdo. |
| **`assets/logo-pj.jpg`** | Logo Oficial Poder Judicial / CSJ Puno | - | Emblema oficial del Poder Judicial para el encabezado derecho. |

---

## 🔒 3. Puntos Críticos de Cumplimiento Institucional

1. **Firmas Estrictamente Bipartitas (2 Firmas):**
   * En todas las actas firman exclusivamente los dos responsables máximos:
     - **Dr. Bladimiro Centeno Herrera**: Director de Admisión — UNA-PUNO.
     - **Abog. Benny José Álvarez Quiñonez**: Presidente de la Corte Superior de Justicia de Puno / Comisión de Concurso.
2. **Huellas Criptográficas SHA-256 Verificadas:**
   * **Padrón Oficial:** `PLANTILLA_PARTICIPANTES_001-2026-UE-PUNO.xlsx` con hash:
     `decf800172efcfdbbc15090eb5dbc67bebacd9303e3ef93a45cd4180db4dff92`
   * **Configuración de Claves Canónica:** Huella SHA-256 de las 30 preguntas:
     `1157033efdf632a759d0c77f282e8481cb185a836a52e61bf54a3edcb63907f4`
3. **Distribución en 2 Grupos de Turno (Aulas A01 a A25):**
   * **Grupo 1 (Turno Mañana):** 998 postulantes distribuidos en aulas A01 a A25 (24 aulas de 40 post. + aula A25 con 38 post.).
   * **Grupo 2 (Turno Tarde):** 984 postulantes distribuidos en las mismas aulas A01 a A25 (24 aulas de 40 post. + aula A25 con 24 post.).
   * **Total General:** 1,982 postulantes.
4. **Examen de 30 Preguntas:**
   * 3 columnas de 10 preguntas cada una (`01-10`, `11-20`, `21-30`) con ponderación a 300.000 puntos máximos.
