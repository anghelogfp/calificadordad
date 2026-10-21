import os
import subprocess
from pypdf import PdfReader

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
HTML_PATH = os.path.join(BASE_DIR, "03-acta-recepcion-fisica.html")
PDF_PATH = os.path.join(BASE_DIR, "pdf", "03-acta-recepcion-fisica.pdf")
CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

t1_aulas = [
    ("A01", 53), ("A02", 53), ("A03", 53), ("A04", 53), ("A05", 53),
    ("A06", 54), ("A07", 50), ("A08", 49), ("A09", 54), ("A10", 51),
    ("A11", 50), ("A12", 39), ("A13", 40), ("A14", 39), ("A15", 40),
    ("A16", 40), ("A17", 39), ("A18", 35), ("A19", 13), ("A20", 27),
    ("A21", 30), ("A22", 30), ("A23", 26), ("A24", 19), ("A25", 8)
]

t2_aulas = [
    ("A01", 52), ("A02", 52), ("A03", 52), ("A04", 55), ("A05", 54),
    ("A06", 52), ("A07", 51), ("A08", 46), ("A09", 51), ("A10", 50),
    ("A11", 44), ("A12", 37), ("A13", 38), ("A14", 35), ("A15", 39),
    ("A16", 37), ("A17", 37), ("A18", 32), ("A19", 32), ("A20", 29),
    ("A21", 27), ("A22", 26), ("A23", 22), ("A24", 17), ("A25", 17)
]

def build_rows(aulas):
    rows = []
    for idx, (aula, cant) in enumerate(aulas, start=1):
        rows.append(f"""          <tr>
            <td class="text-center font-bold" style="font-size: 7.2pt;">{idx:02d}</td>
            <td class="font-bold text-center" style="font-size: 7.5pt;">Aula {aula}</td>
            <td class="text-center font-mono font-bold">{cant}</td>
            <td class="text-center casilla-conteo-id">✓ [{cant}]</td>
            <td class="text-center font-mono font-bold" style="color: #0369a1;">{cant}</td>
            <td class="text-center font-bold" style="font-size: 6.8pt; color: #15803d;">Conforme</td>
            <td class="text-center casilla-conteo-resp">✓ [{cant}]</td>
            <td class="text-center font-mono font-bold" style="color: #0f766e;">{cant}</td>
            <td class="text-center font-bold" style="font-size: 6.8pt; color: #15803d;">Conforme</td>
            <td class="text-center font-mono">0</td>
            <td class="text-center font-bold" style="font-size: 6.8pt; color: #15803d;">CONFORME</td>
          </tr>""")
    return "\n".join(rows)

t1_rows = build_rows(t1_aulas)
t2_rows = build_rows(t2_aulas)

html = f"""<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Acta 03 - Recepción Física de Fichas Ópticas y Material</title>
  <link rel="stylesheet" href="assets/print.css">
  <style>
    .tabla-control-turno {{
      width: 100%;
      border-collapse: collapse;
      font-size: 7.1pt;
      line-height: 1.18;
      margin-top: 3px;
    }}
    .tabla-control-turno th,
    .tabla-control-turno td {{
      border: 1px solid #475569;
      padding: 1.5px 3px;
    }}
    .tabla-control-turno th {{
      background-color: #f1f5f9;
      color: #0f172a;
      font-weight: 700;
      font-size: 6.9pt;
      text-align: center;
    }}
    .header-id {{
      background-color: #0369a1 !important;
      color: #ffffff !important;
      font-weight: 800 !important;
      letter-spacing: 0.2px;
      font-size: 7.2pt !important;
      text-align: center;
    }}
    .header-resp {{
      background-color: #0f766e !important;
      color: #ffffff !important;
      font-weight: 800 !important;
      letter-spacing: 0.2px;
      font-size: 7.2pt !important;
      text-align: center;
    }}
    .header-sub-id {{
      background-color: #e0f2fe !important;
      color: #0369a1 !important;
      font-size: 6.5pt !important;
      font-weight: 700 !important;
      text-align: center;
    }}
    .header-sub-resp {{
      background-color: #ccfbf1 !important;
      color: #0f766e !important;
      font-size: 6.5pt !important;
      font-weight: 700 !important;
      text-align: center;
    }}
    .casilla-conteo-id {{
      font-weight: bold;
      color: #0369a1;
      font-family: var(--fuente-mono);
      font-size: 7pt;
    }}
    .casilla-conteo-resp {{
      font-weight: bold;
      color: #0f766e;
      font-family: var(--fuente-mono);
      font-size: 7pt;
    }}
    .fila-total-turno {{
      background-color: #f8fafc;
      font-weight: bold;
      border-top: 2px solid #0f172a;
    }}
    .banner-turno-meta {{
      background-color: #f8fafc;
      border: 1px solid #cbd5e1;
      padding: 3px 8px;
      margin-top: 4px;
      display: flex;
      justify-content: space-between;
      font-size: 7pt;
      font-weight: bold;
    }}
  </style>
</head>
<body>

  <!-- =======================================================================
       PÁGINA 1: ACTA FORMAL LEGAL DE RECEPCIÓN FÍSICA DE FICHAS Y MATERIAL
       ======================================================================= -->
  <div class="hoja-a4">
    <!-- Encabezado Institucional Doble -->
    <header class="encabezado-institucional">
      <img src="assets/logo-unap.png" alt="UNA-PUNO" class="logo-entidad">
      <div class="texto-encabezado">
        <div class="universidad">Universidad Nacional del Altiplano de Puno</div>
        <div class="area-rectora">Dirección de Admisión — Centro de Cómputo y Calificación</div>
        <div class="subtitulo-convenio">Convenio de Cooperación Interinstitucional con la Corte Superior de Justicia de Puno</div>
      </div>
      <img src="assets/logo-pj.jpg" alt="Poder Judicial" class="logo-entidad">
    </header>

    <!-- Título y Metadatos -->
    <div class="titulo-documento-box">
      <h1 class="titulo-documento">Acta de Recepción Física de Fichas Ópticas y Material</h1>
      <div class="meta-documento">
        <span>CÓDIGO: ACTA-03-FISICO-2026</span>
        <span>OFICIO REF: OFICIO N.° 003-2025-AP-UAF-GAD-CSJPU-PJ</span>
        <span>VERSIÓN: 2.0 (2 TURNOS INDEPENDIENTES)</span>
      </div>
    </div>

    <!-- 1. Datos Generales -->
    <section class="seccion">
      <div class="seccion-titulo">1. Datos Generales</div>
      <div class="grid-dos-columnas">
        <div class="campo-dato"><span class="campo-etiqueta">Proceso:</span> <span class="campo-valor">Proceso de Selección de Personal a Plazo Indeterminado N.° 001-2026-UE-PUNO</span></div>
        <div class="campo-dato"><span class="campo-etiqueta">Fecha de Recepción:</span> <span class="campo-valor">16 de septiembre de 2026</span></div>
        <div class="campo-dato"><span class="campo-etiqueta">Distribución:</span> <span class="campo-valor">2 Turnos de Evaluación (Turno 1 / Grupo 1 y Turno 2 / Grupo 2) — 25 Aulas</span></div>
        <div class="campo-dato"><span class="campo-etiqueta">Lugar de Recepción:</span> <span class="campo-valor">Mesa de Control de Entrada — Centro de Cómputo UNA-PUNO</span></div>
      </div>
    </section>

    <!-- 2. Personas que Intervienen -->
    <section class="seccion">
      <div class="seccion-titulo">2. Intervinientes en la Custodia y Entrega Física</div>
      <table class="tabla-formal">
        <thead>
          <tr>
            <th style="width: 25%;">Rol</th>
            <th style="width: 35%;">Nombres y Apellidos</th>
            <th style="width: 15%;">DNI</th>
            <th style="width: 25%;">Cargo / Entidad</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="font-bold">ENTREGA (Comisión)</td>
            <td>Abog. Edson Teofilo Mamani Quispe</td>
            <td class="text-center font-mono">46829313</td>
            <td>Coordinador de Seguridad Integral — CSJ Puno</td>
          </tr>
          <tr>
            <td class="font-bold">RECIBE (Custodia Cómputo)</td>
            <td>Dr. Bladimiro Centeno Herrera</td>
            <td class="text-center font-mono">29679918</td>
            <td>Director de Admisión — UNA-PUNO</td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- 3. Relación del Material Recibido -->
    <section class="seccion">
      <div class="seccion-titulo">3. Relación General del Material Físico Recibido (2 Turnos)</div>
      <table class="tabla-formal">
        <thead>
          <tr>
            <th style="width: 8%;">N.°</th>
            <th style="width: 42%;">Descripción del Material</th>
            <th style="width: 15%;">Cant. Declarada</th>
            <th style="width: 15%;">Cant. Verificada</th>
            <th style="width: 20%;">Estado Físico</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="text-center font-bold">01</td>
            <td>Fichas Ópticas ID (Turno 1: 998 | Turno 2: 984)</td>
            <td class="text-center font-mono">1,982</td>
            <td class="text-center font-mono font-bold">1,945</td>
            <td class="text-center">Conforme / Íntegro</td>
          </tr>
          <tr>
            <td class="text-center font-bold">02</td>
            <td>Fichas Ópticas RESP (Turno 1: 998 | Turno 2: 984)</td>
            <td class="text-center font-mono">1,982</td>
            <td class="text-center font-mono font-bold">1,945</td>
            <td class="text-center">Conforme / Íntegro</td>
          </tr>
          <tr>
            <td class="text-center font-bold">03</td>
            <td>Sobre Lacrado con Claves Oficiales de Calificación</td>
            <td class="text-center font-mono">1 sobre</td>
            <td class="text-center font-mono font-bold">1 sobre</td>
            <td class="text-center">Lacrado Intacto (#LC-091)</td>
          </tr>
          <tr>
            <td class="text-center font-bold">04</td>
            <td>Padrón de Firmas y Control de Asistencia en Aulas</td>
            <td class="text-center font-mono">50 paquetes</td>
            <td class="text-center font-mono font-bold">50 paquetes</td>
            <td class="text-center">Conforme</td>
          </tr>
        </tbody>
      </table>
      <p style="font-size: 8pt; color: #475569; margin-top: 2px;">
        * Nota: La diferencia de 37 fichas respecto al padrón inicial (1,982) corresponde a postulantes ausentes reportados en las 25 aulas en ambos turnos (Turno 1: 19 ausentes | Turno 2: 18 ausentes).
      </p>
    </section>

    <!-- 4. Constancia de Recepción -->
    <section class="seccion">
      <div class="seccion-titulo">4. Constancia de Entrega y Verificación de Entrada</div>
      <p class="texto-cuerpo">
        Se deja constancia de que los paquetes y sobres correspondientes a las 25 aulas en sus dos turnos (Turno 1 / Grupo 1: Mañana y Turno 2 / Grupo 2: Tarde) fueron recibidos, contados y verificados en la mesa de control de entrada, adjuntándose los Anexos 01-A y 01-B con el detalle independiente aula por aula diferenciando tarjetas de identificación y respuestas.
      </p>
    </section>

    <!-- 5. Firmas (2 Firmas) -->
    <div class="bloque-firmas" style="margin-top: 48px;">
      <div class="cuadro-firma">
        <div class="espacio-sello-firma" style="height: 70px;"></div>
        <div class="linea-firma">
          <div class="nombre">Dr. Bladimiro Centeno Herrera</div>
          <div class="cargo">Director de la Dirección de Admisión (RECIBE)</div>
          <div class="entidad">Universidad Nacional del Altiplano</div>
        </div>
      </div>
      <div class="cuadro-firma">
        <div class="espacio-sello-firma" style="height: 70px;"></div>
        <div class="linea-firma">
          <div class="nombre">Abog. Edson Teofilo Mamani Quispe</div>
          <div class="cargo">Coordinador de Seguridad Integral (ENTREGA)</div>
          <div class="entidad">Corte Superior de Justicia de Puno</div>
        </div>
      </div>
    </div>
  </div>

  <!-- =======================================================================
       PÁGINA 2: ANEXO 01-A: RECEPCIÓN DE TARJETAS POR AULA — TURNO 1 (MAÑANA)
       ======================================================================= -->
  <div class="hoja-a4 salto-pagina">
    <!-- Encabezado Institucional -->
    <header class="encabezado-institucional">
      <img src="assets/logo-unap.png" alt="UNA-PUNO" class="logo-entidad">
      <div class="texto-encabezado">
        <div class="universidad">Universidad Nacional del Altiplano de Puno</div>
        <div class="area-rectora">Dirección de Admisión — Coordinación de Operaciones</div>
        <div class="subtitulo-convenio">EVALUACIÓN TÉCNICA CSJ PUNO — PROCESO A PLAZO INDETERMINADO N.° 001-2026-UE-PUNO</div>
      </div>
      <img src="assets/logo-pj.jpg" alt="Poder Judicial" class="logo-entidad">
    </header>

    <div class="titulo-documento-box">
      <h2 class="titulo-documento" style="font-size: 10pt;">ANEXO 01-A: RECEPCIÓN DE TARJETAS ÓPTICAS — TURNO 1 (GRUPO 1: MAÑANA)</h2>
      <div class="meta-documento">
        <span>TURNO 1 (MAÑANA) — 25 AULAS (A01 a A25)</span>
        <span>FECHA: 16/09/2026</span>
        <span>TOTAL PADRÓN: 998 POSTULANTES</span>
      </div>
    </div>

    <!-- Tabla Detallada Turno 1 -->
    <table class="tabla-control-turno">
      <thead>
        <tr>
          <th rowspan="2" style="width: 4%;">N.°</th>
          <th rowspan="2" style="width: 13%;">Aula</th>
          <th rowspan="2" style="width: 10%;">Padrón (Prog.)</th>
          <th colspan="3" class="header-id">TARJETAS DE IDENTIFICACIÓN (ID)</th>
          <th colspan="3" class="header-resp">TARJETAS DE RESPUESTAS (RESP)</th>
          <th rowspan="2" style="width: 7%;">Ausentes</th>
          <th rowspan="2" style="width: 11%;">Conformidad</th>
        </tr>
        <tr>
          <th class="header-sub-id" style="width: 11%;">Recibidas</th>
          <th class="header-sub-id" style="width: 9%;">Leídas</th>
          <th class="header-sub-id" style="width: 9%;">Estado</th>
          <th class="header-sub-resp" style="width: 11%;">Recibidas</th>
          <th class="header-sub-resp" style="width: 9%;">Leídas</th>
          <th class="header-sub-resp" style="width: 9%;">Estado</th>
        </tr>
      </thead>
      <tbody>
{t1_rows}
      </tbody>
      <tfoot>
        <tr class="fila-total-turno">
          <td colspan="2" class="text-center font-bold" style="font-size: 7.2pt;">TOTAL TURNO 1</td>
          <td class="text-center font-mono font-bold">998</td>
          <td class="text-center casilla-conteo-id font-mono">✓ [979]</td>
          <td class="text-center font-mono font-bold" style="color: #0369a1;">979</td>
          <td class="text-center font-bold" style="color: #15803d; font-size: 6.8pt;">OK</td>
          <td class="text-center casilla-conteo-resp font-mono">✓ [979]</td>
          <td class="text-center font-mono font-bold" style="color: #0f766e;">979</td>
          <td class="text-center font-bold" style="color: #15803d; font-size: 6.8pt;">OK</td>
          <td class="text-center font-mono font-bold">19</td>
          <td class="text-center font-bold" style="color: #15803d; font-size: 6.8pt;">CONFORME</td>
        </tr>
      </tfoot>
    </table>

    <div class="banner-turno-meta">
      <span>RESUMEN TURNO 1 (MAÑANA): 25 AULAS PROCESADAS</span>
      <span class="font-mono">PROGRAMADOS: 998 &nbsp;|&nbsp; FICHAS ID: 979 &nbsp;|&nbsp; FICHAS RESP: 979 &nbsp;|&nbsp; AUSENTES: 19</span>
    </div>

    <!-- Firmas al pie de Turno 1 -->
    <div class="bloque-firmas" style="margin-top: 10px;">
      <div class="cuadro-firma">
        <div class="espacio-sello-firma" style="height: 32px;"></div>
        <div class="linea-firma">
          <div class="nombre">Dr. Bladimiro Centeno Herrera</div>
          <div class="cargo">Director de Admisión — UNA-PUNO (DNI 29679918)</div>
        </div>
      </div>
      <div class="cuadro-firma">
        <div class="espacio-sello-firma" style="height: 32px;"></div>
        <div class="linea-firma">
          <div class="nombre">Abog. Edson Teofilo Mamani Quispe</div>
          <div class="cargo">Coordinador de Seguridad Integral — CSJ Puno (DNI 46829313)</div>
        </div>
      </div>
    </div>
  </div>

  <!-- =======================================================================
       PÁGINA 3: ANEXO 01-B: RECEPCIÓN DE TARJETAS POR AULA — TURNO 2 (TARDE)
       ======================================================================= -->
  <div class="hoja-a4 salto-pagina">
    <!-- Encabezado Institucional -->
    <header class="encabezado-institucional">
      <img src="assets/logo-unap.png" alt="UNA-PUNO" class="logo-entidad">
      <div class="texto-encabezado">
        <div class="universidad">Universidad Nacional del Altiplano de Puno</div>
        <div class="area-rectora">Dirección de Admisión — Coordinación de Operaciones</div>
        <div class="subtitulo-convenio">EVALUACIÓN TÉCNICA CSJ PUNO — PROCESO A PLAZO INDETERMINADO N.° 001-2026-UE-PUNO</div>
      </div>
      <img src="assets/logo-pj.jpg" alt="Poder Judicial" class="logo-entidad">
    </header>

    <div class="titulo-documento-box">
      <h2 class="titulo-documento" style="font-size: 10pt;">ANEXO 01-B: RECEPCIÓN DE TARJETAS ÓPTICAS — TURNO 2 (GRUPO 2: TARDE)</h2>
      <div class="meta-documento">
        <span>TURNO 2 (TARDE) — 25 AULAS (A01 a A25)</span>
        <span>FECHA: 16/09/2026</span>
        <span>TOTAL PADRÓN: 984 POSTULANTES</span>
      </div>
    </div>

    <!-- Tabla Detallada Turno 2 -->
    <table class="tabla-control-turno">
      <thead>
        <tr>
          <th rowspan="2" style="width: 4%;">N.°</th>
          <th rowspan="2" style="width: 13%;">Aula</th>
          <th rowspan="2" style="width: 10%;">Padrón (Prog.)</th>
          <th colspan="3" class="header-id">TARJETAS DE IDENTIFICACIÓN (ID)</th>
          <th colspan="3" class="header-resp">TARJETAS DE RESPUESTAS (RESP)</th>
          <th rowspan="2" style="width: 7%;">Ausentes</th>
          <th rowspan="2" style="width: 11%;">Conformidad</th>
        </tr>
        <tr>
          <th class="header-sub-id" style="width: 11%;">Recibidas</th>
          <th class="header-sub-id" style="width: 9%;">Leídas</th>
          <th class="header-sub-id" style="width: 9%;">Estado</th>
          <th class="header-sub-resp" style="width: 11%;">Recibidas</th>
          <th class="header-sub-resp" style="width: 9%;">Leídas</th>
          <th class="header-sub-resp" style="width: 9%;">Estado</th>
        </tr>
      </thead>
      <tbody>
{t2_rows}
      </tbody>
      <tfoot>
        <tr class="fila-total-turno">
          <td colspan="2" class="text-center font-bold" style="font-size: 7.2pt;">TOTAL TURNO 2</td>
          <td class="text-center font-mono font-bold">984</td>
          <td class="text-center casilla-conteo-id font-mono">✓ [966]</td>
          <td class="text-center font-mono font-bold" style="color: #0369a1;">966</td>
          <td class="text-center font-bold" style="color: #15803d; font-size: 6.8pt;">OK</td>
          <td class="text-center casilla-conteo-resp font-mono">✓ [966]</td>
          <td class="text-center font-mono font-bold" style="color: #0f766e;">966</td>
          <td class="text-center font-bold" style="color: #15803d; font-size: 6.8pt;">OK</td>
          <td class="text-center font-mono font-bold">18</td>
          <td class="text-center font-bold" style="color: #15803d; font-size: 6.8pt;">CONFORME</td>
        </tr>
      </tfoot>
    </table>

    <div class="banner-turno-meta">
      <span>RESUMEN TURNO 2 (TARDE): 25 AULAS PROCESADAS</span>
      <span class="font-mono">PROGRAMADOS: 984 &nbsp;|&nbsp; FICHAS ID: 966 &nbsp;|&nbsp; FICHAS RESP: 966 &nbsp;|&nbsp; AUSENTES: 18</span>
    </div>

    <!-- Firmas al pie de Turno 2 -->
    <div class="bloque-firmas" style="margin-top: 10px;">
      <div class="cuadro-firma">
        <div class="espacio-sello-firma" style="height: 32px;"></div>
        <div class="linea-firma">
          <div class="nombre">Dr. Bladimiro Centeno Herrera</div>
          <div class="cargo">Director de Admisión — UNA-PUNO (DNI 29679918)</div>
        </div>
      </div>
      <div class="cuadro-firma">
        <div class="espacio-sello-firma" style="height: 32px;"></div>
        <div class="linea-firma">
          <div class="nombre">Abog. Edson Teofilo Mamani Quispe</div>
          <div class="cargo">Coordinador de Seguridad Integral — CSJ Puno (DNI 46829313)</div>
        </div>
      </div>
    </div>
  </div>

</body>
</html>
"""

with open(HTML_PATH, "w", encoding="utf-8") as f:
    f.write(html)
print(f"HTML generado: {HTML_PATH}")

# Generar PDF de prueba
file_url = "file:///" + HTML_PATH.replace("\\", "/")
cmd = [
    CHROME_PATH,
    "--headless",
    "--disable-gpu",
    "--no-pdf-header-footer",
    f"--print-to-pdf={PDF_PATH}",
    file_url
]
res = subprocess.run(cmd, capture_output=True, text=True)
if res.returncode != 0:
    print(f"Error generando PDF: {res.stderr}")
else:
    reader = PdfReader(PDF_PATH)
    print(f"PDF generado exitosamente: {len(reader.pages)} página(s) | {os.path.getsize(PDF_PATH):,} bytes")
