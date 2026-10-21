import os
import re

# ═══════════════════════════════════════════════════════════════════════════
# 1. ACTUALIZAR PRINT.CSS: ESPACIADO EN TÍTULOS Y REGLAS DE PRESENTACIÓN
# ═══════════════════════════════════════════════════════════════════════════
CSS_FILE = r"D:\aplications\admision\calificadordad\reportes-actas\assets\print.css"
with open(CSS_FILE, "r", encoding="utf-8") as f:
    css = f.read()

# Increase spacing in .titulo-documento-box and .titulo-documento
css = css.replace(
"""/* Título del Documento y Meta */
.titulo-documento-box {
  text-align: center;
  margin: 14px 0 12px 0;
}

.titulo-documento {
  font-size: 12pt;
  font-weight: 900;
  color: var(--color-primario);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}""",
"""/* Título del Documento y Meta */
.titulo-documento-box {
  text-align: center;
  margin: 22px 0 16px 0;
  padding: 4px 0;
}

.titulo-documento {
  font-size: 13pt;
  font-weight: 900;
  color: var(--color-primario);
  text-transform: uppercase;
  letter-spacing: 0.6px;
  line-height: 1.35;
  margin-bottom: 6px;
}"""
)

with open(CSS_FILE, "w", encoding="utf-8") as f:
    f.write(css)
print("Updated print.css")

# ═══════════════════════════════════════════════════════════════════════════
# 2. ACTUALIZAR HTMLS EN REPORTES-ACTAS
# ═══════════════════════════════════════════════════════════════════════════

# A. 01-acta-inicio-apertura.html
f01 = r"D:\aplications\admision\calificadordad\reportes-actas\01-acta-inicio-apertura.html"
with open(f01, "r", encoding="utf-8") as f:
    c01 = f.read()
# Ensure signatures have DNIs
sig_01_old = """      <div class="cuadro-firma">
        <div class="espacio-sello-firma"></div>
        <div class="linea-firma">
          <div class="nombre">Dr. Bladimiro Centeno Herrera</div>
          <div class="cargo">Director de la Dirección de Admisión</div>
          <div class="entidad">Universidad Nacional del Altiplano</div>
        </div>
      </div>
      <div class="cuadro-firma">
        <div class="espacio-sello-firma"></div>
        <div class="linea-firma">
          <div class="nombre">Abog. Edson Teofilo Mamani Quispe</div>
          <div class="cargo">Coordinador de Seguridad Integral</div>
          <div class="entidad">Corte Superior de Justicia de Puno</div>
        </div>
      </div>"""

sig_uniform = """      <div class="cuadro-firma">
        <div class="espacio-sello-firma"></div>
        <div class="linea-firma">
          <div class="nombre">Dr. Bladimiro Centeno Herrera</div>
          <div class="cargo">Director de la Dirección de Admisión — UNA-PUNO<br>DNI: 29679918</div>
        </div>
      </div>
      <div class="cuadro-firma">
        <div class="espacio-sello-firma"></div>
        <div class="linea-firma">
          <div class="nombre">Abog. Edson Teofilo Mamani Quispe</div>
          <div class="cargo">Coordinador de Seguridad Integral — CSJ Puno<br>DNI: 46829313</div>
        </div>
      </div>"""

c01 = c01.replace(sig_01_old, sig_uniform)
with open(f01, "w", encoding="utf-8") as f:
    f.write(c01)
print("Updated 01-acta-inicio-apertura.html")

# B. 02-acta-recepcion-digital.html
f02 = r"D:\aplications\admision\calificadordad\reportes-actas\02-acta-recepcion-digital.html"
with open(f02, "r", encoding="utf-8") as f:
    c02 = f.read()
c02 = c02.replace("postulantes aptos (1,982 registros", "postulantes convocados (1,982 registros")

sig_02_old = """      <div class="cuadro-firma">
        <div class="espacio-sello-firma"></div>
        <div class="linea-firma">
          <div class="nombre">Dr. Bladimiro Centeno Herrera</div>
          <div class="cargo">Director de la Dirección de Admisión (RECIBE)</div>
          <div class="entidad">Universidad Nacional del Altiplano</div>
        </div>
      </div>
      <div class="cuadro-firma">
        <div class="espacio-sello-firma"></div>
        <div class="linea-firma">
          <div class="nombre">Abog. Edson Teofilo Mamani Quispe</div>
          <div class="cargo">Coordinador de Seguridad Integral (ENTREGA)</div>
          <div class="entidad">Corte Superior de Justicia de Puno</div>
        </div>
      </div>"""

c02 = c02.replace(sig_02_old, sig_uniform)
with open(f02, "w", encoding="utf-8") as f:
    f.write(c02)
print("Updated 02-acta-recepcion-digital.html")

# C. 04-acta-conformidad-claves.html
f04 = r"D:\aplications\admision\calificadordad\reportes-actas\04-acta-conformidad-claves.html"
with open(f04, "r", encoding="utf-8") as f:
    c04 = f.read()

sig_04_old = """      <div class="cuadro-firma">
        <div class="espacio-sello-firma"></div>
        <div class="linea-firma">
          <div class="nombre">Dr. Bladimiro Centeno Herrera</div>
          <div class="cargo">Director de la Dirección de Admisión (CONFORMIDAD)</div>
          <div class="entidad">Universidad Nacional del Altiplano</div>
        </div>
      </div>
      <div class="cuadro-firma">
        <div class="espacio-sello-firma"></div>
        <div class="linea-firma">
          <div class="nombre">Abog. Edson Teofilo Mamani Quispe</div>
          <div class="cargo">Coordinador de Seguridad Integral (AUTORIZA CLAVES)</div>
          <div class="entidad">Corte Superior de Justicia de Puno</div>
        </div>
      </div>"""

c04 = c04.replace(sig_04_old, sig_uniform)
with open(f04, "w", encoding="utf-8") as f:
    f.write(c04)
print("Updated 04-acta-conformidad-claves.html")

# D. 05-informe-tecnico.html
f05 = r"D:\aplications\admision\calificadordad\reportes-actas\05-informe-tecnico.html"
with open(f05, "r", encoding="utf-8") as f:
    c05 = f.read()

c05 = c05.replace(
    "Proceso de Selección de Personal a Plazo Indeterminado N.° 001-2026-UE-PUNO (65 Vacantes)",
    "Proceso de Selección de Personal a Plazo Indeterminado N.° 001-2026-UE-PUNO"
)
c05 = c05.replace(
"""            <td>Puestos Vacantes en Concurso:</td>
            <td class="text-center font-bold font-mono">65 Vacantes</td>""",
"""            <td>Fichas con Observación Técnica:</td>
            <td class="text-center font-bold font-mono">5 (Anulación / Sin ID)</td>"""
)

sig_05_old = """      <div class="cuadro-firma">
        <div class="espacio-sello-firma"></div>
        <div class="linea-firma">
          <div class="nombre">Dr. Bladimiro Centeno Herrera</div>
          <div class="cargo">Director de la Dirección de Admisión</div>
          <div class="entidad">Universidad Nacional del Altiplano de Puno</div>
        </div>
      </div>
      <div class="cuadro-firma">
        <div class="espacio-sello-firma"></div>
        <div class="linea-firma">
          <div class="nombre">Abog. Edson Teofilo Mamani Quispe</div>
          <div class="cargo">Coordinador de Seguridad Integral</div>
          <div class="entidad">Corte Superior de Justicia de Puno</div>
        </div>
      </div>"""

c05 = c05.replace(sig_05_old, sig_uniform)
with open(f05, "w", encoding="utf-8") as f:
    f.write(c05)
print("Updated 05-informe-tecnico.html")

# E. 06-acta-cierre.html
f06 = r"D:\aplications\admision\calificadordad\reportes-actas\06-acta-cierre.html"
with open(f06, "r", encoding="utf-8") as f:
    c06 = f.read()

c06 = c06.replace('<th style="width: 25%;">Vacantes Asignadas</th>', '<th style="width: 25%;">Calificados Válidos</th>')
c06 = c06.replace(
    '<td class="text-center font-mono font-bold" style="font-size: 9pt; color: #15803d;">65 Puestos</td>',
    '<td class="text-center font-mono font-bold" style="font-size: 9pt; color: #15803d;">1,940 Postulantes</td>'
)
c06 = c06.replace("Cuadro de Mérito y Ganadores en PDF:", "Relación en Orden de Mérito (PDF):")

sig_06_old = """      <div class="cuadro-firma">
        <div class="espacio-sello-firma"></div>
        <div class="linea-firma">
          <div class="nombre">Dr. Bladimiro Centeno Herrera</div>
          <div class="cargo">Director de la Dirección de Admisión (ENTREGA)</div>
          <div class="entidad">Universidad Nacional del Altiplano</div>
        </div>
      </div>
      <div class="cuadro-firma">
        <div class="espacio-sello-firma"></div>
        <div class="linea-firma">
          <div class="nombre">Abog. Edson Teofilo Mamani Quispe</div>
          <div class="cargo">Coordinador de Seguridad Integral (RECEPCIONA)</div>
          <div class="entidad">Corte Superior de Justicia de Puno</div>
        </div>
      </div>"""

c06 = c06.replace(sig_06_old, sig_uniform)
with open(f06, "w", encoding="utf-8") as f:
    f.write(c06)
print("Updated 06-acta-cierre.html")

# F. datos-ejemplo.json
fjson = r"D:\aplications\admision\calificadordad\reportes-actas\datos-ejemplo.json"
with open(fjson, "r", encoding="utf-8") as f:
    cjson = f.read()
cjson = cjson.replace('"vacantes_total": 65,', '"calificados_validos": 1940,')
cjson = cjson.replace(
    '"producto": "Relación de Postulantes Aprobados en Orden de Mérito",',
    '"producto": "Relación de Postulantes en Orden de Mérito",'
)
with open(fjson, "w", encoding="utf-8") as f:
    f.write(cjson)
print("Updated datos-ejemplo.json")

# ═══════════════════════════════════════════════════════════════════════════
# 3. ACTUALIZAR 03-ACTA-RECEPCION-FISICA.HTML: ESPACIADO EN TÍTULOS
# ═══════════════════════════════════════════════════════════════════════════
f03 = r"D:\aplications\admision\calificadordad\reportes-actas\03-acta-recepcion-fisica.html"
with open(f03, "r", encoding="utf-8") as f:
    c03 = f.read()

# Add extra margin-top and margin-bottom to titulo-documento-box in page 1
c03 = c03.replace(
"""    <!-- Título y Metadatos -->
    <div class="titulo-documento-box">
      <h1 class="titulo-documento">Acta de Recepción Física de Fichas Ópticas</h1>""",
"""    <!-- Título y Metadatos -->
    <div class="titulo-documento-box" style="margin: 22px 0 16px 0; padding: 4px 0;">
      <h1 class="titulo-documento" style="font-size: 13pt; margin-bottom: 6px;">Acta de Recepción Física de Fichas Ópticas</h1>"""
)

# In anexo pages 2, 3, 4, 5, give nice breathing space
c03 = c03.replace(
    '<div class="titulo-documento-box">\n      <h2 class="titulo-documento"',
    '<div class="titulo-documento-box" style="margin: 14px 0 10px 0; padding: 2px 0;">\n      <h2 class="titulo-documento" style="font-size: 10pt; margin-bottom: 4px;"'
)

with open(f03, "w", encoding="utf-8") as f:
    f.write(c03)
print("Updated 03-acta-recepcion-fisica.html")

print("\n--- ALL REPORT FILES UPDATED SUCCESSFULLY ---")
