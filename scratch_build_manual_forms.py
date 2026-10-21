import os
import subprocess
from pypdf import PdfReader

CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
BASE_DIR = r"D:\aplications\admision\calificadordad\reportes-actas"
PDF_DIR = os.path.join(BASE_DIR, "pdf")
os.makedirs(PDF_DIR, exist_ok=True)

# 25 Aulas T1 (Prog: 998)
t1_aulas = [
  {"num": "01", "aula": "Aula A01", "prog": 53},
  {"num": "02", "aula": "Aula A02", "prog": 53},
  {"num": "03", "aula": "Aula A03", "prog": 53},
  {"num": "04", "aula": "Aula A04", "prog": 53},
  {"num": "05", "aula": "Aula A05", "prog": 53},
  {"num": "06", "aula": "Aula A06", "prog": 54},
  {"num": "07", "aula": "Aula A07", "prog": 50},
  {"num": "08", "aula": "Aula A08", "prog": 49},
  {"num": "09", "aula": "Aula A09", "prog": 54},
  {"num": "10", "aula": "Aula A10", "prog": 51},
  {"num": "11", "aula": "Aula A11", "prog": 50},
  {"num": "12", "aula": "Aula A12", "prog": 39},
  {"num": "13", "aula": "Aula A13", "prog": 40},
  {"num": "14", "aula": "Aula A14", "prog": 39},
  {"num": "15", "aula": "Aula A15", "prog": 40},
  {"num": "16", "aula": "Aula A16", "prog": 40},
  {"num": "17", "aula": "Aula A17", "prog": 39},
  {"num": "18", "aula": "Aula A18", "prog": 35},
  {"num": "19", "aula": "Aula A19", "prog": 13},
  {"num": "20", "aula": "Aula A20", "prog": 27},
  {"num": "21", "aula": "Aula A21", "prog": 30},
  {"num": "22", "aula": "Aula A22", "prog": 30},
  {"num": "23", "aula": "Aula A23", "prog": 26},
  {"num": "24", "aula": "Aula A24", "prog": 19},
  {"num": "25", "aula": "Aula A25", "prog": 8},
]

# 25 Aulas T2 (Prog: 984)
t2_aulas = [
  {"num": "01", "aula": "Aula A01", "prog": 52},
  {"num": "02", "aula": "Aula A02", "prog": 52},
  {"num": "03", "aula": "Aula A03", "prog": 52},
  {"num": "04", "aula": "Aula A04", "prog": 55},
  {"num": "05", "aula": "Aula A05", "prog": 54},
  {"num": "06", "aula": "Aula A06", "prog": 52},
  {"num": "07", "aula": "Aula A07", "prog": 51},
  {"num": "08", "aula": "Aula A08", "prog": 46},
  {"num": "09", "aula": "Aula A09", "prog": 51},
  {"num": "10", "aula": "Aula A10", "prog": 50},
  {"num": "11", "aula": "Aula A11", "prog": 44},
  {"num": "12", "aula": "Aula A12", "prog": 37},
  {"num": "13", "aula": "Aula A13", "prog": 38},
  {"num": "14", "aula": "Aula A14", "prog": 35},
  {"num": "15", "aula": "Aula A15", "prog": 39},
  {"num": "16", "aula": "Aula A16", "prog": 37},
  {"num": "17", "aula": "Aula A17", "prog": 37},
  {"num": "18", "aula": "Aula A18", "prog": 32},
  {"num": "19", "aula": "Aula A19", "prog": 32},
  {"num": "20", "aula": "Aula A20", "prog": 29},
  {"num": "21", "aula": "Aula A21", "prog": 27},
  {"num": "22", "aula": "Aula A22", "prog": 26},
  {"num": "23", "aula": "Aula A23", "prog": 22},
  {"num": "24", "aula": "Aula A24", "prog": 17},
  {"num": "25", "aula": "Aula A25", "prog": 17},
]

header_html = """    <!-- Encabezado Institucional Doble -->
    <header class="encabezado-institucional">
      <img src="assets/logo-unap.png" alt="UNA-PUNO" class="logo-entidad">
      <div class="texto-encabezado">
        <div class="universidad">Universidad Nacional del Altiplano de Puno</div>
        <div class="area-rectora">Dirección de Admisión — Centro de Cómputo y Calificación</div>
        <div class="subtitulo-convenio">Proceso de Selección de Personal a Plazo Indeterminado N.° 001-2026-UE-PUNO</div>
      </div>
      <img src="assets/logo-pj.jpg" alt="Poder Judicial" class="logo-entidad">
    </header>"""

# ═══════════════════════════════════════════════════════════════════════════
# GENERADOR 1: FORMATO CONSOLIDADO EN MESA (ID + RESP EN CADA FILA POR AULA)
# ═══════════════════════════════════════════════════════════════════════════

def build_combined_rows(aulas):
    rows = []
    for r in aulas:
        rows.append(f"""          <tr>
            <td class="text-center font-mono font-bold">{r['num']}</td>
            <td><strong>{r['aula']}</strong></td>
            <td class="text-center font-mono font-bold" style="background-color: #f8fafc;">{r['prog']}</td>
            <td class="casilla-manual text-center font-mono">&nbsp;</td>
            <td class="casilla-manual text-center font-mono">&nbsp;</td>
            <td class="casilla-manual text-center font-mono">&nbsp;</td>
            <td class="casilla-manual text-center font-mono">&nbsp;</td>
            <td class="linea-firma-entrega">&nbsp;</td>
          </tr>""")
    return "\n".join(rows)

t1_comb_rows = build_combined_rows(t1_aulas)
t2_comb_rows = build_combined_rows(t2_aulas)

formato_control_html = f"""<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Formato de Control de Recepción Física en Mesa (Llenado Manual)</title>
  <link rel="stylesheet" href="assets/print.css">
  <style>
    @page {{
      size: A4 portrait;
      margin: 8mm 10mm 8mm 10mm;
    }}
    .pagina-manual {{
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      min-height: 281mm;
      box-sizing: border-box;
    }}
    @media print {{
      .pagina-manual {{
        height: 281mm !important;
        max-height: 281mm !important;
        overflow: hidden !important;
        padding: 0 !important;
        margin: 0 !important;
      }}
    }}
    .datos-mesa-grid {{
      display: grid;
      grid-template-columns: 2fr 1fr 1fr;
      gap: 6px;
      background-color: #f8fafc;
      border: 1px solid #cbd5e1;
      padding: 4px 8px;
      font-size: 7.4pt;
      margin-bottom: 4px;
    }}
    .datos-mesa-item {{
      display: flex;
      gap: 4px;
    }}
    .datos-mesa-item .label {{
      font-weight: bold;
      color: #1e3a5f;
    }}
    .datos-mesa-item .linea-llenado {{
      flex: 1;
      border-bottom: 1px dotted #475569;
    }}
    .tabla-manual {{
      width: 100%;
      border-collapse: collapse;
      font-size: 7.5pt;
      margin: 2px 0;
    }}
    .tabla-manual th,
    .tabla-manual td {{
      border: 1px solid #334155;
      padding: 1.8px 3px;
      line-height: 1.15;
    }}
    .tabla-manual thead th {{
      background-color: #1e3a5f;
      color: #ffffff;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 7pt;
      text-align: center;
      padding: 2.5px 2px;
    }}
    .tabla-manual thead th.th-id {{
      background-color: #0369a1 !important;
    }}
    .tabla-manual thead th.th-resp {{
      background-color: #0f766e !important;
    }}
    .casilla-manual {{
      background-color: #ffffff;
      height: 17px;
    }}
    .linea-firma-entrega {{
      background-color: #ffffff;
      border-bottom: 1px dotted #94a3b8 !important;
    }}
    .fila-total-manual {{
      background-color: #f1f5f9;
      font-weight: bold;
      font-size: 7.8pt;
      border-top: 2px solid #0f172a;
    }}
    .caja-obs-manual {{
      border: 1px solid #cbd5e1;
      background-color: #fafafa;
      padding: 4px 8px;
      font-size: 7pt;
      margin-top: 4px;
    }}
    .renglon-linea {{
      border-bottom: 1px dotted #94a3b8;
      height: 13px;
      margin-top: 2px;
    }}
    .seccion-firmas-manual {{
      margin-top: 6px;
      display: flex;
      justify-content: space-around;
      gap: 20px;
    }}
    .firma-manual-box {{
      flex: 1;
      max-width: 250px;
      text-align: center;
    }}
    .firma-manual-box .linea-firma {{
      border-top: 1.2px solid #334155;
      margin-top: 24px;
      margin-bottom: 2px;
    }}
    .firma-manual-box .nombre {{
      font-weight: bold;
      font-size: 7.6pt;
      color: #0f172a;
    }}
    .firma-manual-box .cargo {{
      font-size: 6.6pt;
      color: #475569;
      line-height: 1.15;
    }}
  </style>
</head>
<body>

  <!-- =======================================================================
       HOJA 1: TURNO 1 (GRUPO 1) — CONTROL DE RECEPCIÓN FÍSICA EN MESA
       ======================================================================= -->
  <div class="hoja-a4 pagina-manual">
{header_html}

    <div class="titulo-documento-box" style="margin: 12px 0 8px 0; padding: 2px 0;">
      <h1 class="titulo-documento" style="font-size: 11pt; margin-bottom: 3px;">
        CONTROL DE RECEPCIÓN FÍSICA DE FICHAS ÓPTICAS — TURNO 1 (GRUPO 1)
      </h1>
      <div class="meta-documento" style="font-size: 7.2pt;">
        <span>FORMATO OFICIAL DE MESA DE ENTRADA — LLENADO MANUSCRITO</span>
        <span>FECHA: 16 DE OCTUBRE DE 2026</span>
        <span>TOTAL AULAS: 25 | PADRÓN: 998 POSTULANTES</span>
      </div>
    </div>

    <!-- Metadatos de la Mesa para Llenar a Mano -->
    <div class="datos-mesa-grid">
      <div class="datos-mesa-item">
        <span class="label">Responsable de Mesa (Receptor):</span>
        <div class="linea-llenado"></div>
      </div>
      <div class="datos-mesa-item">
        <span class="label">Hora Inicio:</span>
        <div class="linea-llenado"></div>
      </div>
      <div class="datos-mesa-item">
        <span class="label">Hora Cierre:</span>
        <div class="linea-llenado"></div>
      </div>
    </div>

    <table class="tabla-manual">
      <thead>
        <tr>
          <th style="width: 5%;">N.°</th>
          <th style="width: 17%;">Aula Evaluación</th>
          <th style="width: 10%;">Padrón (Prog.)</th>
          <th class="th-id" style="width: 15%;">Fichas ID Recibidas<br><span style="font-size: 6pt; font-weight: normal;">(Conteo Manual)</span></th>
          <th class="th-resp" style="width: 15%;">Fichas RESP Recibidas<br><span style="font-size: 6pt; font-weight: normal;">(Conteo Manual)</span></th>
          <th style="width: 10%;">Ausentes<br><span style="font-size: 6pt; font-weight: normal;">(Fichas / Post.)</span></th>
          <th style="width: 13%;">N.° Sobre / Precinto</th>
          <th style="width: 15%;">Firma Responsable Aula<br><span style="font-size: 6pt; font-weight: normal;">(Entrega Conforme)</span></th>
        </tr>
      </thead>
      <tbody>
{t1_comb_rows}
      </tbody>
      <tfoot>
        <tr class="fila-total-manual">
          <td colspan="2" class="text-center">TOTALES TURNO 1</td>
          <td class="text-center font-mono font-bold">998</td>
          <td class="text-center font-mono font-bold">[ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ]</td>
          <td class="text-center font-mono font-bold">[ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ]</td>
          <td class="text-center font-mono font-bold">[ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ]</td>
          <td class="text-center" style="font-size: 6.5pt;">Precintos OK [ &nbsp; ]</td>
          <td class="text-center" style="font-size: 6.5pt;">V.°B.° Mesa [ &nbsp; ]</td>
        </tr>
      </tfoot>
    </table>

    <div class="caja-obs-manual">
      <span style="font-weight: bold; color: #1e3a5f;">Observaciones / Incidencias en Recepción Turno 1:</span>
      <div class="renglon-linea"></div>
      <div class="renglon-linea"></div>
    </div>

    <div class="seccion-firmas-manual">
      <div class="firma-manual-box">
        <div class="linea-firma"></div>
        <div class="nombre">Dr. Bladimiro Centeno Herrera</div>
        <div class="cargo">Director de Admisión — UNA-PUNO<br>DNI: 29679918 (RECEPCIÓN Y CUSTODIA)</div>
      </div>
      <div class="firma-manual-box">
        <div class="linea-firma"></div>
        <div class="nombre">Abog. Edson Teofilo Mamani Quispe</div>
        <div class="cargo">Coordinador de Seguridad Integral — CSJ Puno<br>DNI: 46829313 (ENTREGA Y SUPERVISIÓN)</div>
      </div>
    </div>
  </div>

  <!-- =======================================================================
       HOJA 2: TURNO 2 (GRUPO 2) — CONTROL DE RECEPCIÓN FÍSICA EN MESA
       ======================================================================= -->
  <div class="hoja-a4 salto-pagina pagina-manual">
{header_html}

    <div class="titulo-documento-box" style="margin: 12px 0 8px 0; padding: 2px 0;">
      <h1 class="titulo-documento" style="font-size: 11pt; margin-bottom: 3px;">
        CONTROL DE RECEPCIÓN FÍSICA DE FICHAS ÓPTICAS — TURNO 2 (GRUPO 2)
      </h1>
      <div class="meta-documento" style="font-size: 7.2pt;">
        <span>FORMATO OFICIAL DE MESA DE ENTRADA — LLENADO MANUSCRITO</span>
        <span>FECHA: 16 DE OCTUBRE DE 2026</span>
        <span>TOTAL AULAS: 25 | PADRÓN: 984 POSTULANTES</span>
      </div>
    </div>

    <!-- Metadatos de la Mesa para Llenar a Mano -->
    <div class="datos-mesa-grid">
      <div class="datos-mesa-item">
        <span class="label">Responsable de Mesa (Receptor):</span>
        <div class="linea-llenado"></div>
      </div>
      <div class="datos-mesa-item">
        <span class="label">Hora Inicio:</span>
        <div class="linea-llenado"></div>
      </div>
      <div class="datos-mesa-item">
        <span class="label">Hora Cierre:</span>
        <div class="linea-llenado"></div>
      </div>
    </div>

    <table class="tabla-manual">
      <thead>
        <tr>
          <th style="width: 5%;">N.°</th>
          <th style="width: 17%;">Aula Evaluación</th>
          <th style="width: 10%;">Padrón (Prog.)</th>
          <th class="th-id" style="width: 15%;">Fichas ID Recibidas<br><span style="font-size: 6pt; font-weight: normal;">(Conteo Manual)</span></th>
          <th class="th-resp" style="width: 15%;">Fichas RESP Recibidas<br><span style="font-size: 6pt; font-weight: normal;">(Conteo Manual)</span></th>
          <th style="width: 10%;">Ausentes<br><span style="font-size: 6pt; font-weight: normal;">(Fichas / Post.)</span></th>
          <th style="width: 13%;">N.° Sobre / Precinto</th>
          <th style="width: 15%;">Firma Responsable Aula<br><span style="font-size: 6pt; font-weight: normal;">(Entrega Conforme)</span></th>
        </tr>
      </thead>
      <tbody>
{t2_comb_rows}
      </tbody>
      <tfoot>
        <tr class="fila-total-manual">
          <td colspan="2" class="text-center">TOTALES TURNO 2</td>
          <td class="text-center font-mono font-bold">984</td>
          <td class="text-center font-mono font-bold">[ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ]</td>
          <td class="text-center font-mono font-bold">[ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ]</td>
          <td class="text-center font-mono font-bold">[ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ]</td>
          <td class="text-center" style="font-size: 6.5pt;">Precintos OK [ &nbsp; ]</td>
          <td class="text-center" style="font-size: 6.5pt;">V.°B.° Mesa [ &nbsp; ]</td>
        </tr>
      </tfoot>
    </table>

    <div class="caja-obs-manual">
      <span style="font-weight: bold; color: #1e3a5f;">Observaciones / Incidencias en Recepción Turno 2:</span>
      <div class="renglon-linea"></div>
      <div class="renglon-linea"></div>
    </div>

    <div class="seccion-firmas-manual">
      <div class="firma-manual-box">
        <div class="linea-firma"></div>
        <div class="nombre">Dr. Bladimiro Centeno Herrera</div>
        <div class="cargo">Director de Admisión — UNA-PUNO<br>DNI: 29679918 (RECEPCIÓN Y CUSTODIA)</div>
      </div>
      <div class="firma-manual-box">
        <div class="linea-firma"></div>
        <div class="nombre">Abog. Edson Teofilo Mamani Quispe</div>
        <div class="cargo">Coordinador de Seguridad Integral — CSJ Puno<br>DNI: 46829313 (ENTREGA Y SUPERVISIÓN)</div>
      </div>
    </div>
  </div>

</body>
</html>
"""

target_manual_file = os.path.join(BASE_DIR, "formato-control-recepcion-manual.html")
with open(target_manual_file, "w", encoding="utf-8") as f:
    f.write(formato_control_html)
print(f"Generated {target_manual_file}")

# ═══════════════════════════════════════════════════════════════════════════
# GENERAR PDF DE FORMATO DE CONTROL MANUAL (2 PÁGINAS A4)
# ═══════════════════════════════════════════════════════════════════════════
pdf_manual_path = os.path.join(PDF_DIR, "FORMATO-CONTROL-RECEPCION-MANUAL-T1-T2.pdf")
file_url = "file:///" + target_manual_file.replace("\\", "/")

cmd = [
    CHROME_PATH,
    "--headless",
    "--disable-gpu",
    "--no-pdf-header-footer",
    f"--print-to-pdf={pdf_manual_path}",
    file_url
]

res = subprocess.run(cmd, capture_output=True, text=True)
if res.returncode == 0:
    r = PdfReader(pdf_manual_path)
    print(f"OK PDF generado: {pdf_manual_path} ({len(r.pages)} páginas)")
else:
    print(f"ERROR: {res.stderr}")
