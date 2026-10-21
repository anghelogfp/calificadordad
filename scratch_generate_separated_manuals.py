import os
import subprocess
from pypdf import PdfReader, PdfWriter

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

def make_rows(aulas, is_id=True):
    rows = []
    badge = "ID" if is_id else "RESP"
    for r in aulas:
        rows.append(f"""          <tr>
            <td class="text-center font-mono font-bold">{r['num']}</td>
            <td><strong>{r['aula']}</strong></td>
            <td class="text-center font-mono font-bold" style="background-color: #f8fafc;">{r['prog']}</td>
            <td class="casilla-manual text-center font-mono">&nbsp;</td>
            <td class="casilla-manual text-center font-mono">&nbsp;</td>
            <td class="casilla-manual text-center font-mono">&nbsp;</td>
            <td class="linea-firma-entrega">&nbsp;</td>
          </tr>""")
    return "\n".join(rows)

def make_page_html(turno_num, grupo_num, padron_total, aulas, is_id=True):
    tipo_str = "IDENTIFICACIÓN (ID)" if is_id else "RESPUESTAS (RESP)"
    tipo_short = "ID" if is_id else "RESP"
    th_class = "th-id" if is_id else "th-resp"
    color_accent = "#0369a1" if is_id else "#0f766e"
    bg_sub = "#e0f2fe" if is_id else "#ccfbf1"
    
    rows_html = make_rows(aulas, is_id)
    
    return f"""<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Control de Recepción Física - Fichas de {tipo_str} — Turno {turno_num}</title>
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
      font-size: 7.6pt;
      margin: 2px 0;
    }}
    .tabla-manual th,
    .tabla-manual td {{
      border: 1px solid #334155;
      padding: 2px 4px;
      line-height: 1.15;
    }}
    .tabla-manual thead th {{
      color: #ffffff;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 7pt;
      text-align: center;
      padding: 3px 2px;
    }}
    .{th_class} {{
      background-color: {color_accent} !important;
    }}
    .casilla-manual {{
      background-color: #ffffff;
      height: 18px;
    }}
    .linea-firma-entrega {{
      background-color: #ffffff;
      border-bottom: 1px dotted #94a3b8 !important;
    }}
    .fila-total-manual {{
      background-color: #f1f5f9;
      font-weight: bold;
      font-size: 8pt;
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

  <div class="hoja-a4 pagina-manual">
    <!-- Encabezado Institucional Doble -->
    <header class="encabezado-institucional">
      <img src="assets/logo-unap.png" alt="UNA-PUNO" class="logo-entidad">
      <div class="texto-encabezado">
        <div class="universidad">Universidad Nacional del Altiplano de Puno</div>
        <div class="area-rectora">Dirección de Admisión — Centro de Cómputo y Calificación</div>
        <div class="subtitulo-convenio">Proceso de Selección de Personal a Plazo Indeterminado N.° 001-2026-UE-PUNO</div>
      </div>
      <img src="assets/logo-pj.jpg" alt="Poder Judicial" class="logo-entidad">
    </header>

    <div class="titulo-documento-box" style="margin: 12px 0 8px 0; padding: 2px 0;">
      <h1 class="titulo-documento" style="font-size: 11pt; margin-bottom: 3px; color: {color_accent};">
        CONTROL DE RECEPCIÓN FÍSICA: FICHAS DE {tipo_str}
      </h1>
      <div class="meta-documento" style="font-size: 7.2pt;">
        <span>TURNO {turno_num} (GRUPO {grupo_num}) — 25 AULAS DE EVALUACIÓN</span>
        <span>FECHA: 16 DE OCTUBRE DE 2026</span>
        <span>PADRÓN PROGRAMADO: {padron_total} POSTULANTES</span>
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
          <th class="{th_class}" style="width: 6%;">N.°</th>
          <th class="{th_class}" style="width: 22%;">Aula de Evaluación</th>
          <th class="{th_class}" style="width: 14%;">Padrón (Prog.)</th>
          <th class="{th_class}" style="width: 20%;">Fichas {tipo_short} Recibidas<br><span style="font-size: 6pt; font-weight: normal;">(Conteo Manual a Lapicero)</span></th>
          <th class="{th_class}" style="width: 12%;">Ausentes<br><span style="font-size: 6pt; font-weight: normal;">(Fichas / Post.)</span></th>
          <th class="{th_class}" style="width: 12%;">N.° Sobre / Precinto</th>
          <th class="{th_class}" style="width: 14%;">Firma Entrega Aula<br><span style="font-size: 6pt; font-weight: normal;">(Responsable de Aula)</span></th>
        </tr>
      </thead>
      <tbody>
{rows_html}
      </tbody>
      <tfoot>
        <tr class="fila-total-manual">
          <td colspan="2" class="text-center font-bold">TOTALES TURNO {turno_num}</td>
          <td class="text-center font-mono font-bold">{padron_total}</td>
          <td class="text-center font-mono font-bold">[ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ]</td>
          <td class="text-center font-mono font-bold">[ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ]</td>
          <td class="text-center" style="font-size: 6.6pt;">Precintos OK [ &nbsp; ]</td>
          <td class="text-center" style="font-size: 6.6pt;">V.°B.° Mesa [ &nbsp; ]</td>
        </tr>
      </tfoot>
    </table>

    <div class="caja-obs-manual">
      <span style="font-weight: bold; color: {color_accent};">Observaciones / Incidencias en Entrega de Fichas de {tipo_str} (Turno {turno_num}):</span>
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

# Create the 4 individual HTML files
files_to_generate = [
    {
        "filename": "formato-manual-id-turno-1.html",
        "pdf_name": "FORMATO-MANUAL-ID-TURNO-1.pdf",
        "html": make_page_html(1, 1, 998, t1_aulas, is_id=True)
    },
    {
        "filename": "formato-manual-id-turno-2.html",
        "pdf_name": "FORMATO-MANUAL-ID-TURNO-2.pdf",
        "html": make_page_html(2, 2, 984, t2_aulas, is_id=True)
    },
    {
        "filename": "formato-manual-resp-turno-1.html",
        "pdf_name": "FORMATO-MANUAL-RESP-TURNO-1.pdf",
        "html": make_page_html(1, 1, 998, t1_aulas, is_id=False)
    },
    {
        "filename": "formato-manual-resp-turno-2.html",
        "pdf_name": "FORMATO-MANUAL-RESP-TURNO-2.pdf",
        "html": make_page_html(2, 2, 984, t2_aulas, is_id=False)
    },
]

for item in files_to_generate:
    hpath = os.path.join(BASE_DIR, item["filename"])
    ppath = os.path.join(PDF_DIR, item["pdf_name"])
    with open(hpath, "w", encoding="utf-8") as f:
        f.write(item["html"])
    print(f"Written: {hpath}")
    
    file_url = "file:///" + hpath.replace("\\", "/")
    cmd = [
        CHROME_PATH,
        "--headless",
        "--disable-gpu",
        "--no-pdf-header-footer",
        f"--print-to-pdf={ppath}",
        file_url
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode == 0:
        r = PdfReader(ppath)
        print(f"  OK PDF: {item['pdf_name']} ({len(r.pages)} pág)")
    else:
        print(f"  ERROR: {res.stderr}")

# Also consolidate ID T1+T2 into one 2-page PDF
id_merged_path = os.path.join(PDF_DIR, "FORMATO-MANUAL-ID-CONSOLIDADO-T1-T2.pdf")
id_writer = PdfWriter()
for pdf_name in ["FORMATO-MANUAL-ID-TURNO-1.pdf", "FORMATO-MANUAL-ID-TURNO-2.pdf"]:
    r = PdfReader(os.path.join(PDF_DIR, pdf_name))
    for p in r.pages:
        id_writer.add_page(p)
with open(id_merged_path, "wb") as f_out:
    id_writer.write(f_out)
print(f"Merged: FORMATO-MANUAL-ID-CONSOLIDADO-T1-T2.pdf (2 págs)")

# Also consolidate RESP T1+T2 into one 2-page PDF
resp_merged_path = os.path.join(PDF_DIR, "FORMATO-MANUAL-RESP-CONSOLIDADO-T1-T2.pdf")
resp_writer = PdfWriter()
for pdf_name in ["FORMATO-MANUAL-RESP-TURNO-1.pdf", "FORMATO-MANUAL-RESP-TURNO-2.pdf"]:
    r = PdfReader(os.path.join(PDF_DIR, pdf_name))
    for p in r.pages:
        resp_writer.add_page(p)
with open(resp_merged_path, "wb") as f_out:
    resp_writer.write(f_out)
print(f"Merged: FORMATO-MANUAL-RESP-CONSOLIDADO-T1-T2.pdf (2 págs)")
