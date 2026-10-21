# Paquete de Actas y Reportes Técnicos de Calificación (UNA-PUNO — Poder Judicial)

Este paquete contiene la suite completa de **documentos formales y formatos de control operativo** diseñada para la recepción física, validación, lectura óptica y calificación de exámenes bajo convenio interinstitucional entre la **Universidad Nacional del Altiplano de Puno** y la **Corte Superior de Justicia de Puno** (*Proceso de Selección de Personal a Plazo Indeterminado N.° 001-2026-UE-PUNO*).

---

## 🚀 1. Cómo probarlo en el navegador o generar los PDFs

### Visualizador Web Interactivo:
1. Abre el archivo **[`visor.html`](file:///D:/aplications/admision/calificadordad/reportes-actas/visor.html)** con doble clic en tu navegador preferido (Chrome, Edge, Firefox).
2. Usa la barra superior para alternar entre las 6 actas oficiales.
3. Haz clic en el botón verde **`🖨️ Imprimir / Guardar en PDF`** para imprimir o guardar cualquier acta en A4 con fidelidad milimétrica.

### Regeneración Automática de PDFs:
Para generar todos los PDFs individuales y el documento consolidado unificado vía Chrome Headless y Python:
```bash
python D:\aplications\admision\calificadordad\reportes-actas\generar_pdfs.py
```

---

## 📁 2. Estructura de Archivos del Paquete

### A. Actas Oficiales del Proceso de Calificación (Expediente de 11 Páginas Consolidadas)

| Archivo | Documento | Páginas A4 | Momento de Uso |
|---|---|:---:|---|
| **[`01-acta-inicio-apertura.html`](file:///D:/aplications/admision/calificadordad/reportes-actas/01-acta-inicio-apertura.html)** | Acta de Inicio y Apertura de Ambiente | 1 pág. | Antes de iniciar cualquier lectura en el centro de cómputo. |
| **[`02-acta-recepcion-digital.html`](file:///D:/aplications/admision/calificadordad/reportes-actas/02-acta-recepcion-digital.html)** | Acta de Recepción y Entrega Digital | 1 pág. | Recepción exclusiva del padrón oficial `PLANTILLA_PARTICIPANTES_001-2026-UE-PUNO.xlsx` con su hash SHA-256 verificado. |
| **[`03-acta-recepcion-fisica.html`](file:///D:/aplications/admision/calificadordad/reportes-actas/03-acta-recepcion-fisica.html)** | Acta de Recepción Física + Anexos ID y RESP | 5 págs. | Pág 1: Acta Formal de Recepción Física de Fichas Ópticas.<br>Pág 2: Anexo 01-A: Fichas de Identificación (ID) — Turno 1 (25 aulas al 100% de ancho).<br>Pág 3: Anexo 01-B: Fichas de Identificación (ID) — Turno 2 (25 aulas al 100% de ancho).<br>Pág 4: Anexo 02-A: Fichas de Respuestas (RESP) — Turno 1 (25 aulas al 100% de ancho).<br>Pág 5: Anexo 02-B: Fichas de Respuestas (RESP) — Turno 2 (25 aulas al 100% de ancho). |
| **[`04-acta-conformidad-claves.html`](file:///D:/aplications/admision/calificadordad/reportes-actas/04-acta-conformidad-claves.html)** | Acta de Conformidad de Claves Oficiales | 1 pág. | **Antes de calificar.** Aprobación de la matriz de 30 preguntas (escala a 300.000 pts) y hash criptográfico canónico. |
| **[`05-informe-tecnico.html`](file:///D:/aplications/admision/calificadordad/reportes-actas/05-informe-tecnico.html)** | Informe Técnico de Validación y Calificación | 2 págs. | Documento técnico consolidado con pruebas sintéticas, control de versiones del padrón y trazabilidad. |
| **[`06-acta-cierre.html`](file:///D:/aplications/admision/calificadordad/reportes-actas/06-acta-cierre.html)** | Acta de Cierre y Conformidad Final | 1 pág. | Culminación de labores y entrega formal de resultados a la Comisión (1,940 calificados válidos). |
| **[`TODAS-LAS-ACTAS-UNAP-PJ.pdf`](file:///D:/aplications/admision/calificadordad/reportes-actas/pdf/TODAS-LAS-ACTAS-UNAP-PJ.pdf)** | **Expediente Oficial Consolidado** | **11 págs.** | Documento único encuadernado de todas las actas del proceso. |

---

### B. Formatos Independientes para Llenado Manual en Mesa de Recepción Física

Diseñados específicamente para imprimirse antes del examen y llenarse **a mano / con lapicero** en la mesa de control de entrada cuando los responsables de aula traen los sobres lacrados con las fichas ópticas:

| Archivo | Documento | Páginas A4 | Descripción de Uso Operativo |
|---|---|:---:|---|
| **[`formato-control-recepcion-manual.html`](file:///D:/aplications/admision/calificadordad/reportes-actas/formato-control-recepcion-manual.html)**<br>*(PDF: [`FORMATO-CONTROL-RECEPCION-MANUAL-T1-T2.pdf`](file:///D:/aplications/admision/calificadordad/reportes-actas/pdf/FORMATO-CONTROL-RECEPCION-MANUAL-T1-T2.pdf))* | **Control Consolidado en Mesa (ID + RESP en cada fila)** | **2 págs.** | **Página 1 (Turno 1 / Grupo 1 - 25 aulas):** Fila por aula con Padrón Programado pre-impreso y casillas en blanco para: *Fichas ID Recibidas [ ], Fichas RESP Recibidas [ ], Ausentes [ ], N.° Sobre/Precinto [ ] y Firma del Responsable del Aula*. Totales, observaciones y firmas al pie.<br>**Página 2 (Turno 2 / Grupo 2 - 25 aulas):** Idéntico formato para el segundo turno. |
| **[`03-anexos-recepcion-manual.html`](file:///D:/aplications/admision/calificadordad/reportes-actas/03-anexos-recepcion-manual.html)**<br>*(PDF: [`03-ANEXOS-RECEPCION-MANUAL-ID-RESP.pdf`](file:///D:/aplications/admision/calificadordad/reportes-actas/pdf/03-ANEXOS-RECEPCION-MANUAL-ID-RESP.pdf))* | **Anexos de Control Físico en Blanco (ID y RESP Separados)** | **4 págs.** | Formatos de anexo idénticos a los del Acta 03 pero con las casillas de conteo en blanco para llenado manuscrito:<br>• **Pág 1:** Anexo 01-A (ID Turno 1 - 25 aulas)<br>• **Pág 2:** Anexo 01-B (ID Turno 2 - 25 aulas)<br>• **Pág 3:** Anexo 02-A (RESP Turno 1 - 25 aulas)<br>• **Pág 4:** Anexo 02-B (RESP Turno 2 - 25 aulas) |

---

## 🔒 3. Puntos Críticos de Cumplimiento Institucional

1. **Firmas Estrictamente Bipartitas (2 Firmas):**
   * En todas las actas firman exclusivamente los dos responsables máximos:
     - **Dr. Bladimiro Centeno Herrera**: Director de la Dirección de Admisión — UNA-PUNO (DNI 29679918).
     - **Abog. Edson Teofilo Mamani Quispe**: Coordinador de Seguridad Integral — CSJ Puno (DNI 46829313).
2. **Ubicación Oficial Uniformizada:**
   * `Centro de Cómputo y Calificación — UNA-PUNO` en todos los documentos.
3. **Fecha Oficial del Proceso:**
   * `16 de octubre de 2026`.
4. **Huellas Criptográficas SHA-256 Verificadas:**
   * **Padrón Oficial:** `PLANTILLA_PARTICIPANTES_001-2026-UE-PUNO.xlsx` con hash:
     `decf800172efcfdbbc15090eb5dbc67bebacd9303e3ef93a45cd4180db4dff92`
   * **Configuración de Claves Canónica:** Huella SHA-256 de las 30 preguntas:
     `1157033efdf632a759d0c77f282e8481cb185a836a52e61bf54a3edcb63907f4`
5. **Distribución en 2 Turnos de Evaluación (Aulas A01 a A25):**
   * **Turno 1 (Grupo 1):** 998 postulantes distribuidos en 25 aulas (A01 a A25).
   * **Turno 2 (Grupo 2):** 984 postulantes distribuidos en 25 aulas (A01 a A25).
   * **Total General:** 1,982 postulantes.
6. **Examen de 30 Preguntas:**
   * 3 columnas de 10 preguntas cada una (`01-10`, `11-20`, `21-30`) con ponderación a 300.000 puntos máximos.
