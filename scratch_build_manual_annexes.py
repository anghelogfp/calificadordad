import os
import subprocess
from pypdf import PdfReader

CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
BASE_DIR = r"D:\aplications\admision\calificadordad\reportes-actas"
PDF_DIR = os.path.join(BASE_DIR, "pdf")

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

firmas_anexo_html = """    <!-- Bloque de Firmas al Pie -->
    <div class="seccion-firmas-anexo">
      <div class="firma-box-anexo">
        <div class="linea-firma"></div>
        <div class="nombre-firmante">Dr. Bladimiro Centeno Herrera</div>
        <div class="cargo-firmante">Director de Admisión — UNA-PUNO<br>DNI: 29679918 (RECEPCIÓN Y CUSTODIA)</div>
      </div>
      <div class="firma-box-anexo">
        <div class="linea-firma"></div>
        <div class="nombre-firmante">Abog. Edson Teofilo Mamani Quispe</div>
        <div class="cargo-firmante">Coordinador de Seguridad Integral — CSJ Puno<br>DNI: 46829313 (ENTREGA Y SUPERVISIÓN)</div>
      </div>
    </div>"""

def build_anexo_manual_rows(aulas):
    rows = []
    for r in aulas:
        rows.append(f"""          <tr>
            <td class="text-center font-mono font-bold">{r['num']}</td>
            <td><strong>{r['aula']}</strong></td>
            <td class="text-center font-mono font-bold" style="background-color: #f8fafc;">{r['prog']}</td>
            <td class="text-center font-mono" style="background-color: #ffffff;">&nbsp;</td>
            <td class="text-center font-mono" style="background-color: #ffffff;">&nbsp;</td>
            <td class="text-center font-mono" style="background-color: #ffffff;">&nbsp;</td>
            <td class="text-center" style="font-size: 6.8pt; color: #475569;">[ &nbsp;&nbsp;&nbsp; ] CONFORME</td>
          </tr>""")
    return "\n".join(rows)

t1_anexo_rows = build_anexo_manual_rows(t1_aulas)
t2_anexo_rows = build_anexo_manual_rows(t2_aulas)

anexos_manual_html = f"""<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Anexos de Control Físico de Fichas (Llenado Manual)</title>
  <link rel="stylesheet" href="assets/print.css">
  <style>
    @page {{
      size: A4 portrait;
      margin: 8mm 10mm 8mm 10mm;
    }}
    .pagina-anexo-manual {{
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      min-height: 281mm;
      box-sizing: border-box;
    }}
    @media print {{
      .pagina-anexo-manual {{
        height: 281mm !important;
        max-height: 281mm !important;
        overflow: hidden !important;
        padding: 0 !important;
        margin: 0 !important;
      }}
    }}
    .tabla-control-ampliada th,
    .tabla-control-ampliada td {{
      border: 1px solid #334155;
      padding: 1.8px 4px;
      line-height: 1.15;
    }}
    .header-id {{
      background-color: #0369a1 !important;
      color: #ffffff !important;
      text-align: center;
      padding: 3px 6px !important;
      font-size: 8pt !important;
    }}
    .header-sub-id {{
      background-color: #e0f2fe !important;
      color: #0369a1 !important;
      text-align: center;
    }}
    .header-resp {{
      background-color: #0f766e !important;
      color: #ffffff !important;
      text-align: center;
      padding: 3px 6px !important;
      font-size: 8pt !important;
    }}
    .header-sub-resp {{
      background-color: #ccfbf1 !important;
      color: #0f766e !important;
      text-align: center;
    }}
    .fila-total-turno {{
      background-color: #f8fafc;
      font-weight: bold;
      font-size: 8pt;
      border-top: 2px solid #0f172a;
    }}
    .banner-turno-meta {{
      background-color: #f8fafc;
      border: 1px solid #cbd5e1;
      padding: 3px 8px;
      margin-top: 4px;
      display: flex;
      justify-content: space-between;
      font-size: 7.5pt;
      font-weight: bold;
    }}
    .seccion-firmas-anexo {{
      margin-top: 8px;
      display: flex;
      justify-content: space-around;
      gap: 20px;
    }}
    .firma-box-anexo {{
      flex: 1;
      max-width: 250px;
      text-align: center;
    }}
    .firma-box-anexo .linea-firma {{
      border-top: 1.2px solid #334155;
      margin-top: 26px;
      margin-bottom: 3px;
    }}
    .firma-box-anexo .nombre-firmante {{
      font-weight: bold;
      font-size: 7.8pt;
      color: #0f172a;
    }}
    .firma-box-anexo .cargo-firmante {{
      font-size: 6.8pt;
      color: #475569;
      line-height: 1.15;
    }}
  </style>
</head>
<body>

  <!-- =======================================================================
       HOJA 1: ANEXO 01-A: IDENTIFICACIÓN (ID) — TURNO 1 (GRUPO 1) — LLENADO MANUAL
       ======================================================================= -->
  <div class="hoja-a4 pagina-anexo-manual">
{header_html}

    <div class="titulo-documento-box" style="margin: 12px 0 8px 0; padding: 2px 0;">
      <h2 class="titulo-documento" style="font-size: 10pt; margin-bottom: 4px;">
        ANEXO 01-A: RECEPCIÓN Y VERIFICACIÓN DE FICHAS DE IDENTIFICACIÓN (ID) — TURNO 1 (GRUPO 1)
      </h2>
      <div class="meta-documento" style="font-size: 7.2pt;">
        <span>FORMATO DE CONTROL DE ENTRADA — LLENADO MANUSCRITO</span>
        <span>FECHA: 16/10/2026</span>
        <span>PADRÓN PROGRAMADO: 998 POSTULANTES</span>
      </div>
    </div>

    <table class="tabla-control-ampliada">
      <thead>
        <tr>
          <th colspan="7" class="header-id">TURNO 1 (GRUPO 1) — CONTROL DE RECEPCIÓN DE FICHAS DE IDENTIFICACIÓN (ID)</th>
        </tr>
        <tr>
          <th class="header-sub-id" style="width: 6%;">N.°</th>
          <th class="header-sub-id" style="width: 24%;">Aula de Evaluación</th>
          <th class="header-sub-id" style="width: 14%;">Padrón (Prog.)</th>
          <th class="header-sub-id" style="width: 18%;">Fichas Recibidas<br><span style="font-size: 6pt; font-weight: normal;">(Conteo Manual)</span></th>
          <th class="header-sub-id" style="width: 14%;">Fichas Leídas<br><span style="font-size: 6pt; font-weight: normal;">(Cómputo)</span></th>
          <th class="header-sub-id" style="width: 10%;">Ausentes</th>
          <th class="header-sub-id" style="width: 14%;">Conformidad</th>
        </tr>
      </thead>
      <tbody>
{t1_anexo_rows}
      </tbody>
      <tfoot>
        <tr class="fila-total-turno">
          <td colspan="2" class="text-center font-bold">TOTAL TURNO 1</td>
          <td class="text-center font-mono font-bold">998</td>
          <td class="text-center font-mono font-bold">[ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ]</td>
          <td class="text-center font-mono font-bold">[ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ]</td>
          <td class="text-center font-mono font-bold">[ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ]</td>
          <td class="text-center font-bold" style="color: #15803d;">CONFORME [ &nbsp; ]</td>
        </tr>
      </tfoot>
    </table>

    <div class="banner-turno-meta">
      <span>RESUMEN TURNO 1 (GRUPO 1): 25 AULAS DE EVALUACIÓN</span>
      <span class="font-mono">PROGRAMADOS: 998 &nbsp;|&nbsp; FICHAS ID RECIBIDAS: [ _______ ] &nbsp;|&nbsp; AUSENTES: [ _______ ]</span>
    </div>

{firmas_anexo_html}
  </div>

  <!-- =======================================================================
       HOJA 2: ANEXO 01-B: IDENTIFICACIÓN (ID) — TURNO 2 (GRUPO 2) — LLENADO MANUAL
       ======================================================================= -->
  <div class="hoja-a4 salto-pagina pagina-anexo-manual">
{header_html}

    <div class="titulo-documento-box" style="margin: 12px 0 8px 0; padding: 2px 0;">
      <h2 class="titulo-documento" style="font-size: 10pt; margin-bottom: 4px;">
        ANEXO 01-B: RECEPCIÓN Y VERIFICACIÓN DE FICHAS DE IDENTIFICACIÓN (ID) — TURNO 2 (GRUPO 2)
      </h2>
      <div class="meta-documento" style="font-size: 7.2pt;">
        <span>FORMATO DE CONTROL DE ENTRADA — LLENADO MANUSCRITO</span>
        <span>FECHA: 16/10/2026</span>
        <span>PADRÓN PROGRAMADO: 984 POSTULANTES</span>
      </div>
    </div>

    <table class="tabla-control-ampliada">
      <thead>
        <tr>
          <th colspan="7" class="header-id">TURNO 2 (GRUPO 2) — CONTROL DE RECEPCIÓN DE FICHAS DE IDENTIFICACIÓN (ID)</th>
        </tr>
        <tr>
          <th class="header-sub-id" style="width: 6%;">N.°</th>
          <th class="header-sub-id" style="width: 24%;">Aula de Evaluación</th>
          <th class="header-sub-id" style="width: 14%;">Padrón (Prog.)</th>
          <th class="header-sub-id" style="width: 18%;">Fichas Recibidas<br><span style="font-size: 6pt; font-weight: normal;">(Conteo Manual)</span></th>
          <th class="header-sub-id" style="width: 14%;">Fichas Leídas<br><span style="font-size: 6pt; font-weight: normal;">(Cómputo)</span></th>
          <th class="header-sub-id" style="width: 10%;">Ausentes</th>
          <th class="header-sub-id" style="width: 14%;">Conformidad</th>
        </tr>
      </thead>
      <tbody>
{t2_anexo_rows}
      </tbody>
      <tfoot>
        <tr class="fila-total-turno">
          <td colspan="2" class="text-center font-bold">TOTAL TURNO 2</td>
          <td class="text-center font-mono font-bold">984</td>
          <td class="text-center font-mono font-bold">[ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ]</td>
          <td class="text-center font-mono font-bold">[ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ]</td>
          <td class="text-center font-mono font-bold">[ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ]</td>
          <td class="text-center font-bold" style="color: #15803d;">CONFORME [ &nbsp; ]</td>
        </tr>
      </tfoot>
    </table>

    <div class="banner-turno-meta">
      <span>RESUMEN TURNO 2 (GRUPO 2): 25 AULAS DE EVALUACIÓN</span>
      <span class="font-mono">PROGRAMADOS: 984 &nbsp;|&nbsp; FICHAS ID RECIBIDAS: [ _______ ] &nbsp;|&nbsp; AUSENTES: [ _______ ]</span>
    </div>

{firmas_anexo_html}
  </div>

  <!-- =======================================================================
       HOJA 3: ANEXO 02-A: RESPUESTAS (RESP) — TURNO 1 (GRUPO 1) — LLENADO MANUAL
       ======================================================================= -->
  <div class="hoja-a4 salto-pagina pagina-anexo-manual">
{header_html}

    <div class="titulo-documento-box" style="margin: 12px 0 8px 0; padding: 2px 0;">
      <h2 class="titulo-documento" style="font-size: 10pt; margin-bottom: 4px;">
        ANEXO 02-A: RECEPCIÓN Y VERIFICACIÓN DE FICHAS DE RESPUESTAS (RESP) — TURNO 1 (GRUPO 1)
      </h2>
      <div class="meta-documento" style="font-size: 7.2pt;">
        <span>FORMATO DE CONTROL DE ENTRADA — LLENADO MANUSCRITO</span>
        <span>FECHA: 16/10/2026</span>
        <span>PADRÓN PROGRAMADO: 998 POSTULANTES</span>
      </div>
    </div>

    <table class="tabla-control-ampliada">
      <thead>
        <tr>
          <th colspan="7" class="header-resp">TURNO 1 (GRUPO 1) — CONTROL DE RECEPCIÓN DE FICHAS DE RESPUESTAS (RESP)</th>
        </tr>
        <tr>
          <th class="header-sub-resp" style="width: 6%;">N.°</th>
          <th class="header-sub-resp" style="width: 24%;">Aula de Evaluación</th>
          <th class="header-sub-resp" style="width: 14%;">Padrón (Prog.)</th>
          <th class="header-sub-resp" style="width: 18%;">Fichas Recibidas<br><span style="font-size: 6pt; font-weight: normal;">(Conteo Manual)</span></th>
          <th class="header-sub-resp" style="width: 14%;">Fichas Leídas<br><span style="font-size: 6pt; font-weight: normal;">(Cómputo)</span></th>
          <th class="header-sub-resp" style="width: 10%;">Ausentes</th>
          <th class="header-sub-resp" style="width: 14%;">Conformidad</th>
        </tr>
      </thead>
      <tbody>
{t1_anexo_rows}
      </tbody>
      <tfoot>
        <tr class="fila-total-turno">
          <td colspan="2" class="text-center font-bold">TOTAL TURNO 1</td>
          <td class="text-center font-mono font-bold">998</td>
          <td class="text-center font-mono font-bold">[ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ]</td>
          <td class="text-center font-mono font-bold">[ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ]</td>
          <td class="text-center font-mono font-bold">[ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ]</td>
          <td class="text-center font-bold" style="color: #15803d;">CONFORME [ &nbsp; ]</td>
        </tr>
      </tfoot>
    </table>

    <div class="banner-turno-meta">
      <span>RESUMEN TURNO 1 (GRUPO 1): 25 AULAS DE EVALUACIÓN</span>
      <span class="font-mono">PROGRAMADOS: 998 &nbsp;|&nbsp; FICHAS RESP RECIBIDAS: [ _______ ] &nbsp;|&nbsp; AUSENTES: [ _______ ]</span>
    </div>

{firmas_anexo_html}
  </div>

  <!-- =======================================================================
       HOJA 4: ANEXO 02-B: RESPUESTAS (RESP) — TURNO 2 (GRUPO 2) — LLENADO MANUAL
       ======================================================================= -->
  <div class="hoja-a4 salto-pagina pagina-anexo-manual">
{header_html}

    <div class="titulo-documento-box" style="margin: 12px 0 8px 0; padding: 2px 0;">
      <h2 class="titulo-documento" style="font-size: 10pt; margin-bottom: 4px;">
        ANEXO 02-B: RECEPCIÓN Y VERIFICACIÓN DE FICHAS DE RESPUESTAS (RESP) — TURNO 2 (GRUPO 2)
      </h2>
      <div class="meta-documento" style="font-size: 7.2pt;">
        <span>FORMATO DE CONTROL DE ENTRADA — LLENADO MANUSCRITO</span>
        <span>FECHA: 16/10/2026</span>
        <span>PADRÓN PROGRAMADO: 984 POSTULANTES</span>
      </div>
    </div>

    <table class="tabla-control-ampliada">
      <thead>
        <tr>
          <th colspan="7" class="header-resp">TURNO 2 (GRUPO 2) — CONTROL DE RECEPCIÓN DE FICHAS DE RESPUESTAS (RESP)</th>
        </tr>
        <tr>
          <th class="header-sub-resp" style="width: 6%;">N.°</th>
          <th class="header-sub-resp" style="width: 24%;">Aula de Evaluación</th>
          <th class="header-sub-resp" style="width: 14%;">Padrón (Prog.)</th>
          <th class="header-sub-resp" style="width: 18%;">Fichas Recibidas<br><span style="font-size: 6pt; font-weight: normal;">(Conteo Manual)</span></th>
          <th class="header-sub-resp" style="width: 14%;">Fichas Leídas<br><span style="font-size: 6pt; font-weight: normal;">(Cómputo)</span></th>
          <th class="header-sub-resp" style="width: 10%;">Ausentes</th>
          <th class="header-sub-resp" style="width: 14%;">Conformidad</th>
        </tr>
      </thead>
      <tbody>
{t2_anexo_rows}
      </tbody>
      <tfoot>
        <tr class="fila-total-turno">
          <td colspan="2" class="text-center font-bold">TOTAL TURNO 2</td>
          <td class="text-center font-mono font-bold">984</td>
          <td class="text-center font-mono font-bold">[ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ]</td>
          <td class="text-center font-mono font-bold">[ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ]</td>
          <td class="text-center font-mono font-bold">[ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ]</td>
          <td class="text-center font-bold" style="color: #15803d;">CONFORME [ &nbsp; ]</td>
        </tr>
      </tfoot>
    </table>

    <div class="banner-turno-meta">
      <span>RESUMEN TURNO 2 (GRUPO 2): 25 AULAS DE EVALUACIÓN</span>
      <span class="font-mono">PROGRAMADOS: 984 &nbsp;|&nbsp; FICHAS RESP RECIBIDAS: [ _______ ] &nbsp;|&nbsp; AUSENTES: [ _______ ]</span>
    </div>

{firmas_anexo_html}
  </div>

</body>
</html>
"""

target_anexos_manual = os.path.join(BASE_DIR, "03-anexos-recepcion-manual.html")
with open(target_anexos_manual, "w", encoding="utf-8") as f:
    f.write(anexos_manual_html)
print(f"Generated {target_anexos_manual}")

# ═══════════════════════════════════════════════════════════════════════════
# GENERAR PDF DE ANEXOS DE CONTROL MANUAL (4 PÁGINAS A4)
# ═══════════════════════════════════════════════════════════════════════════
pdf_anexos_manual_path = os.path.join(PDF_DIR, "03-ANEXOS-RECEPCION-MANUAL-ID-RESP.pdf")
file_url2 = "file:///" + target_anexos_manual.replace("\\", "/")

cmd2 = [
    CHROME_PATH,
    "--headless",
    "--disable-gpu",
    "--no-pdf-header-footer",
    f"--print-to-pdf={pdf_anexos_manual_path}",
    file_url2
]

res2 = subprocess.run(cmd2, capture_output=True, text=True)
if res2.returncode == 0:
    r2 = PdfReader(pdf_anexos_manual_path)
    print(f"OK PDF generado: {pdf_anexos_manual_path} ({len(r2.pages)} páginas)")
else:
    print(f"ERROR: {res2.stderr}")
