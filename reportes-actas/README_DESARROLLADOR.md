# Paquete de Actas y Reportes Técnicos de Calificación (UNA-PUNO — Poder Judicial)

Este paquete contiene la suite completa de **6 documentos formales (5 actas + 1 informe técnico)** diseñada para la recepción, validación, lectura óptica y calificación de exámenes bajo convenio interinstitucional entre la **Universidad Nacional del Altiplano de Puno** y la **Corte Superior de Justicia de Puno** (Concurso D.L. 728).

---

## 🚀 1. Cómo probarlo en 5 segundos (Sin instalar nada)

1. Abre el archivo **`visor.html`** directamente con doble clic en tu navegador preferido (Google Chrome, Edge o Firefox).
2. Usa la barra superior para alternar entre las 6 actas.
3. Haz clic en el botón verde **`🖨️ Imprimir / Guardar en PDF`** para comprobar cómo se renderiza milimétricamente en hoja **A4**.

---

## 📁 2. Estructura de Archivos del Paquete

| Archivo | Documento | Páginas A4 | Momento de Uso |
|---|---|:---:|---|
| **`01-acta-inicio-apertura.html`** | Acta de Inicio y Apertura de Ambiente | 1 pág. | Antes de iniciar cualquier lectura en el centro de cómputo. |
| **`02-acta-recepcion-digital.html`** | Acta de Recepción y Entrega Digital | 1 pág. | Al recibir el USB/WinRAR con el padrón (incluye SHA-256). |
| **`03-acta-recepcion-fisica.html`** | Acta de Recepción Física + Anexo Aulas | 2 págs. | Al llegar los sobres con fichas ID y RESP (réplica de `modelo.jpeg`). |
| **`04-acta-conformidad-claves.html`** | Acta de Conformidad de Claves Oficiales | 1 pág. | **Antes de calificar.** Aprobación de claves y ponderación con huella digital. |
| **`05-informe-tecnico.html`** | Informe Técnico de Validación y Calificación | 2 págs. | Documento técnico consolidado con pruebas sintéticas y lecturas. |
| **`06-acta-cierre.html`** | Acta de Cierre y Conformidad Final | 1 pág. | Culminación de labores y entrega formal de resultados a la Comisión. |
| **`datos-ejemplo.json`** | Contrato de Datos JSON | - | Mapeo de variables reales del proceso (1,982 postulantes, 65 vacantes). |
| **`assets/print.css`** | Hoja de Estilos de Impresión | - | Reglas maestras para tamaño A4, bordes, tipografía y saltos de página. |
| **`assets/logo-unap.png`** | Escudo Oficial UNA-PUNO | - | Logotipo institucional para el encabezado izquierdo. |
| **`assets/logo-pj.svg`** | Emblema Vectorial Poder Judicial | - | Logotipo institucional para el encabezado derecho. |

---

## ⚙️ 3. Cómo integrarlo en tu sistema

### Opción A: En motores de plantillas de backend (Laravel/Blade, Django/Jinja, Node/EJS, PHP)
1. Copia el HTML del cuerpo de cada documento a tu vista de reporte.
2. Reemplaza los textos estáticos con variables de tu backend siguiendo la misma estructura de **`datos-ejemplo.json`**.
   * Ejemplo: Reemplazar `"Proceso de Selección D.L. 728..."` por `{{ proceso.nombre }}`.
   * Reemplazar los valores de la tabla de aulas con un bucle:
     ```html
     <!-- En Blade / Jinja -->
     {% for aula in control_aulas %}
     <tr>
       <td>{{ aula.aula }}</td>
       <td class="font-mono">{{ aula.cantidad_declarada }}</td>
       <td class="casilla-conteo">✓ [{{ aula.verificado_id }}]</td>
       <td class="casilla-conteo">✓ [{{ aula.verificado_resp }}]</td>
     </tr>
     {% endfor %}
     ```

### Opción B: En aplicaciones Frontend SPA (Vue, React, Svelte, Angular)
1. Puedes encapsular cada acta como un componente que recibe un prop `data` con la forma de `datos-ejemplo.json`.
2. Para imprimir desde el navegador, basta con llamar a:
   ```javascript
   window.print();
   ```

### Opción C: Generación de PDF en servidor (Puppeteer, Playwright o wkhtmltopdf)
Si generas el PDF en Node.js o Python mediante Chrome Headless / Puppeteer, usa esta configuración para obtener fidelidad 100%:
```javascript
await page.pdf({
  path: 'Acta-01-Inicio.pdf',
  format: 'A4',
  printBackground: true,
  margin: {
    top: '0mm',
    bottom: '0mm',
    left: '0mm',
    right: '0mm'
  }
});
```
*(Nota: No añadas márgenes en Puppeteer porque el archivo `assets/print.css` ya define la regla `@page { size: A4; margin: 12mm 15mm; }`).*

---

## 🔒 4. Puntos Críticos de Auditoría y Seguridad Legal

1. **Huellas Criptográficas SHA-256 (`.caja-hash`):**
   * En el Acta 02 se consigna el hash del archivo comprimido recibido en el USB versus la copia en el servidor.
   * En el Acta 04 se calcula la huella de la configuración de claves y ponderación antes del cálculo. Si esta huella coincide con la del Informe Técnico (05), queda acreditado que no hubo adulteración de claves.
2. **Bloque de Firmas Blindado (`.bloque-firmas`):**
   * Gracias a la regla CSS `page-break-inside: avoid; break-inside: avoid;`, el bloque de firmas jamás se cortará ni quedará huérfano en una página posterior en blanco.
3. **Anexo de Aulas (`modelo.jpeg`):**
   * El Anexo 01 del Acta 03 reproduce fielmente la distribución a doble columna utilizada históricamente por la Dirección de Admisión de la UNA-PUNO para el conteo físico en puerta de entrada.
