import os
import re

BASE_DIR = r"D:\aplications\admision\calificadordad\reportes-actas"

# 1. Update dates in 01, 02, 04, 05, 06, datos-ejemplo.json
date_files = [
    "01-acta-inicio-apertura.html",
    "02-acta-recepcion-digital.html",
    "04-acta-conformidad-claves.html",
    "05-informe-tecnico.html",
    "06-acta-cierre.html",
    "datos-ejemplo.json"
]

for filename in date_files:
    filepath = os.path.join(BASE_DIR, filename)
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    
    content = content.replace("16 de septiembre de 2026", "16 de octubre de 2026")
    content = content.replace("16 DE SEPTIEMBRE DE 2026", "16 DE OCTUBRE DE 2026")
    content = content.replace("16/09/2026", "16/10/2026")
    
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Updated dates in {filename}")

# 2. Build 03-acta-recepcion-fisica.html with 5 separate pages
t1_aulas = [
  {"num": "01", "aula": "Aula A01", "prog": 53, "rec": 53, "leidas": 53, "aus": 0},
  {"num": "02", "aula": "Aula A02", "prog": 53, "rec": 53, "leidas": 53, "aus": 0},
  {"num": "03", "aula": "Aula A03", "prog": 53, "rec": 53, "leidas": 53, "aus": 0},
  {"num": "04", "aula": "Aula A04", "prog": 53, "rec": 53, "leidas": 53, "aus": 0},
  {"num": "05", "aula": "Aula A05", "prog": 53, "rec": 53, "leidas": 53, "aus": 0},
  {"num": "06", "aula": "Aula A06", "prog": 54, "rec": 54, "leidas": 54, "aus": 0},
  {"num": "07", "aula": "Aula A07", "prog": 50, "rec": 50, "leidas": 50, "aus": 0},
  {"num": "08", "aula": "Aula A08", "prog": 49, "rec": 49, "leidas": 49, "aus": 0},
  {"num": "09", "aula": "Aula A09", "prog": 54, "rec": 54, "leidas": 54, "aus": 0},
  {"num": "10", "aula": "Aula A10", "prog": 51, "rec": 51, "leidas": 51, "aus": 0},
  {"num": "11", "aula": "Aula A11", "prog": 50, "rec": 50, "leidas": 50, "aus": 0},
  {"num": "12", "aula": "Aula A12", "prog": 39, "rec": 39, "leidas": 39, "aus": 0},
  {"num": "13", "aula": "Aula A13", "prog": 40, "rec": 40, "leidas": 40, "aus": 0},
  {"num": "14", "aula": "Aula A14", "prog": 39, "rec": 39, "leidas": 39, "aus": 0},
  {"num": "15", "aula": "Aula A15", "prog": 40, "rec": 40, "leidas": 40, "aus": 0},
  {"num": "16", "aula": "Aula A16", "prog": 40, "rec": 40, "leidas": 40, "aus": 0},
  {"num": "17", "aula": "Aula A17", "prog": 39, "rec": 39, "leidas": 39, "aus": 0},
  {"num": "18", "aula": "Aula A18", "prog": 35, "rec": 35, "leidas": 35, "aus": 0},
  {"num": "19", "aula": "Aula A19", "prog": 13, "rec": 13, "leidas": 13, "aus": 0},
  {"num": "20", "aula": "Aula A20", "prog": 27, "rec": 27, "leidas": 27, "aus": 0},
  {"num": "21", "aula": "Aula A21", "prog": 30, "rec": 30, "leidas": 30, "aus": 0},
  {"num": "22", "aula": "Aula A22", "prog": 30, "rec": 30, "leidas": 30, "aus": 0},
  {"num": "23", "aula": "Aula A23", "prog": 26, "rec": 26, "leidas": 26, "aus": 0},
  {"num": "24", "aula": "Aula A24", "prog": 19, "rec": 19, "leidas": 19, "aus": 0},
  {"num": "25", "aula": "Aula A25", "prog": 8, "rec": 8, "leidas": 8, "aus": 0},
]

t2_aulas = [
  {"num": "01", "aula": "Aula A01", "prog": 52, "rec": 52, "leidas": 52, "aus": 0},
  {"num": "02", "aula": "Aula A02", "prog": 52, "rec": 52, "leidas": 52, "aus": 0},
  {"num": "03", "aula": "Aula A03", "prog": 52, "rec": 52, "leidas": 52, "aus": 0},
  {"num": "04", "aula": "Aula A04", "prog": 55, "rec": 55, "leidas": 55, "aus": 0},
  {"num": "05", "aula": "Aula A05", "prog": 54, "rec": 54, "leidas": 54, "aus": 0},
  {"num": "06", "aula": "Aula A06", "prog": 52, "rec": 52, "leidas": 52, "aus": 0},
  {"num": "07", "aula": "Aula A07", "prog": 51, "rec": 51, "leidas": 51, "aus": 0},
  {"num": "08", "aula": "Aula A08", "prog": 46, "rec": 46, "leidas": 46, "aus": 0},
  {"num": "09", "aula": "Aula A09", "prog": 51, "rec": 51, "leidas": 51, "aus": 0},
  {"num": "10", "aula": "Aula A10", "prog": 50, "rec": 50, "leidas": 50, "aus": 0},
  {"num": "11", "aula": "Aula A11", "prog": 44, "rec": 44, "leidas": 44, "aus": 0},
  {"num": "12", "aula": "Aula A12", "prog": 37, "rec": 37, "leidas": 37, "aus": 0},
  {"num": "13", "aula": "Aula A13", "prog": 38, "rec": 38, "leidas": 38, "aus": 0},
  {"num": "14", "aula": "Aula A14", "prog": 35, "rec": 35, "leidas": 35, "aus": 0},
  {"num": "15", "aula": "Aula A15", "prog": 39, "rec": 39, "leidas": 39, "aus": 0},
  {"num": "16", "aula": "Aula A16", "prog": 37, "rec": 37, "leidas": 37, "aus": 0},
  {"num": "17", "aula": "Aula A17", "prog": 37, "rec": 37, "leidas": 37, "aus": 0},
  {"num": "18", "aula": "Aula A18", "prog": 32, "rec": 32, "leidas": 32, "aus": 0},
  {"num": "19", "aula": "Aula A19", "prog": 32, "rec": 32, "leidas": 32, "aus": 0},
  {"num": "20", "aula": "Aula A20", "prog": 29, "rec": 29, "leidas": 29, "aus": 0},
  {"num": "21", "aula": "Aula A21", "prog": 27, "rec": 27, "leidas": 27, "aus": 0},
  {"num": "22", "aula": "Aula A22", "prog": 26, "rec": 26, "leidas": 26, "aus": 0},
  {"num": "23", "aula": "Aula A23", "prog": 22, "rec": 22, "leidas": 22, "aus": 0},
  {"num": "24", "aula": "Aula A24", "prog": 17, "rec": 17, "leidas": 17, "aus": 0},
  {"num": "25", "aula": "Aula A25", "prog": 17, "rec": 17, "leidas": 17, "aus": 0},
]

# T1 RESP data (leidas: 979, aus: 19)
t1_resp_aulas = [
  {"num": "01", "aula": "Aula A01", "prog": 53, "rec": 53, "leidas": 52, "aus": 1},
  {"num": "02", "aula": "Aula A02", "prog": 53, "rec": 53, "leidas": 51, "aus": 2},
  {"num": "03", "aula": "Aula A03", "prog": 53, "rec": 53, "leidas": 52, "aus": 1},
  {"num": "04", "aula": "Aula A04", "prog": 53, "rec": 53, "leidas": 52, "aus": 1},
  {"num": "05", "aula": "Aula A05", "prog": 53, "rec": 53, "leidas": 53, "aus": 0},
  {"num": "06", "aula": "Aula A06", "prog": 54, "rec": 54, "leidas": 53, "aus": 1},
  {"num": "07", "aula": "Aula A07", "prog": 50, "rec": 50, "leidas": 49, "aus": 1},
  {"num": "08", "aula": "Aula A08", "prog": 49, "rec": 49, "leidas": 48, "aus": 1},
  {"num": "09", "aula": "Aula A09", "prog": 54, "rec": 54, "leidas": 53, "aus": 1},
  {"num": "10", "aula": "Aula A10", "prog": 51, "rec": 51, "leidas": 50, "aus": 1},
  {"num": "11", "aula": "Aula A11", "prog": 50, "rec": 50, "leidas": 49, "aus": 1},
  {"num": "12", "aula": "Aula A12", "prog": 39, "rec": 39, "leidas": 38, "aus": 1},
  {"num": "13", "aula": "Aula A13", "prog": 40, "rec": 40, "leidas": 39, "aus": 1},
  {"num": "14", "aula": "Aula A14", "prog": 39, "rec": 39, "leidas": 38, "aus": 1},
  {"num": "15", "aula": "Aula A15", "prog": 40, "rec": 40, "leidas": 39, "aus": 1},
  {"num": "16", "aula": "Aula A16", "prog": 40, "rec": 40, "leidas": 39, "aus": 1},
  {"num": "17", "aula": "Aula A17", "prog": 39, "rec": 39, "leidas": 38, "aus": 1},
  {"num": "18", "aula": "Aula A18", "prog": 35, "rec": 35, "leidas": 34, "aus": 1},
  {"num": "19", "aula": "Aula A19", "prog": 13, "rec": 13, "leidas": 13, "aus": 0},
  {"num": "20", "aula": "Aula A20", "prog": 27, "rec": 27, "leidas": 27, "aus": 0},
  {"num": "21", "aula": "Aula A21", "prog": 30, "rec": 30, "leidas": 29, "aus": 1},
  {"num": "22", "aula": "Aula A22", "prog": 30, "rec": 30, "leidas": 30, "aus": 0},
  {"num": "23", "aula": "Aula A23", "prog": 26, "rec": 26, "leidas": 26, "aus": 0},
  {"num": "24", "aula": "Aula A24", "prog": 19, "rec": 19, "leidas": 19, "aus": 0},
  {"num": "25", "aula": "Aula A25", "prog": 8, "rec": 8, "leidas": 8, "aus": 0},
]

# T2 RESP data (leidas: 966, aus: 18)
t2_resp_aulas = [
  {"num": "01", "aula": "Aula A01", "prog": 52, "rec": 52, "leidas": 51, "aus": 1},
  {"num": "02", "aula": "Aula A02", "prog": 52, "rec": 52, "leidas": 51, "aus": 1},
  {"num": "03", "aula": "Aula A03", "prog": 52, "rec": 52, "leidas": 51, "aus": 1},
  {"num": "04", "aula": "Aula A04", "prog": 55, "rec": 55, "leidas": 54, "aus": 1},
  {"num": "05", "aula": "Aula A05", "prog": 54, "rec": 54, "leidas": 53, "aus": 1},
  {"num": "06", "aula": "Aula A06", "prog": 52, "rec": 52, "leidas": 51, "aus": 1},
  {"num": "07", "aula": "Aula A07", "prog": 51, "rec": 51, "leidas": 50, "aus": 1},
  {"num": "08", "aula": "Aula A08", "prog": 46, "rec": 46, "leidas": 45, "aus": 1},
  {"num": "09", "aula": "Aula A09", "prog": 51, "rec": 51, "leidas": 50, "aus": 1},
  {"num": "10", "aula": "Aula A10", "prog": 50, "rec": 50, "leidas": 49, "aus": 1},
  {"num": "11", "aula": "Aula A11", "prog": 44, "rec": 44, "leidas": 43, "aus": 1},
  {"num": "12", "aula": "Aula A12", "prog": 37, "rec": 37, "leidas": 36, "aus": 1},
  {"num": "13", "aula": "Aula A13", "prog": 38, "rec": 38, "leidas": 37, "aus": 1},
  {"num": "14", "aula": "Aula A14", "prog": 35, "rec": 35, "leidas": 34, "aus": 1},
  {"num": "15", "aula": "Aula A15", "prog": 39, "rec": 39, "leidas": 38, "aus": 1},
  {"num": "16", "aula": "Aula A16", "prog": 37, "rec": 37, "leidas": 36, "aus": 1},
  {"num": "17", "aula": "Aula A17", "prog": 37, "rec": 37, "leidas": 36, "aus": 1},
  {"num": "18", "aula": "Aula A18", "prog": 32, "rec": 32, "leidas": 32, "aus": 0},
  {"num": "19", "aula": "Aula A19", "prog": 32, "rec": 32, "leidas": 32, "aus": 0},
  {"num": "20", "aula": "Aula A20", "prog": 29, "rec": 29, "leidas": 29, "aus": 0},
  {"num": "21", "aula": "Aula A21", "prog": 27, "rec": 27, "leidas": 27, "aus": 0},
  {"num": "22", "aula": "Aula A22", "prog": 26, "rec": 26, "leidas": 26, "aus": 0},
  {"num": "23", "aula": "Aula A23", "prog": 22, "rec": 22, "leidas": 22, "aus": 0},
  {"num": "24", "aula": "Aula A24", "prog": 17, "rec": 17, "leidas": 17, "aus": 0},
  {"num": "25", "aula": "Aula A25", "prog": 17, "rec": 17, "leidas": 16, "aus": 1},
]

def generate_rows(aulas_list, is_id=True):
    rows = []
    for r in aulas_list:
        badge_cls = "badge-id" if is_id else "badge-resp"
        badge_txt = "ID RECIBIDO" if is_id else "RESP RECIBIDA"
        val_rec = f"[ {r['rec']} ]"
        val_leidas = r['leidas']
        val_aus = r['aus']
        aus_cls = 'font-bold' if val_aus > 0 else 'color-muted'
        rows.append(f"""          <tr>
            <td class="text-center font-mono font-bold">{r['num']}</td>
            <td><strong>{r['aula']}</strong></td>
            <td class="text-center font-mono">{r['prog']}</td>
            <td class="text-center casilla-conteo font-mono font-bold">✓ {val_rec}</td>
            <td class="text-center font-mono font-bold">{val_leidas}</td>
            <td class="text-center font-mono {aus_cls}">{val_aus}</td>
            <td class="text-center"><span class="{badge_cls}">✓ {badge_txt}</span></td>
          </tr>""")
    return "\n".join(rows)

t1_id_rows = generate_rows(t1_aulas, is_id=True)
t2_id_rows = generate_rows(t2_aulas, is_id=True)
t1_resp_rows = generate_rows(t1_resp_aulas, is_id=False)
t2_resp_rows = generate_rows(t2_resp_aulas, is_id=False)

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
        <div class="cargo-firmante">Director de Admisión — UNA-PUNO<br>DNI: 29679918</div>
      </div>
      <div class="firma-box-anexo">
        <div class="linea-firma"></div>
        <div class="nombre-firmante">Abog. Edson Teofilo Mamani Quispe</div>
        <div class="cargo-firmante">Coordinador de Seguridad Integral — CSJ Puno<br>DNI: 46829313</div>
      </div>
    </div>"""

acta_03_content = f"""<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Acta de Recepción Física de Fichas Ópticas - UNA-PUNO / Poder Judicial</title>
  <link rel="stylesheet" href="assets/print.css">
  <style>
    /* Estilos especializados para tablas de 25 aulas en hoja completa */
    .pagina-anexo {{
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      box-sizing: border-box;
      min-height: 297mm;
    }}
    @media print {{
      .pagina-anexo {{
        height: 273mm !important;
        max-height: 273mm !important;
        overflow: hidden !important;
        padding: 0 !important;
        margin: 0 !important;
      }}
    }}
    .tabla-control-ampliada {{
      width: 100%;
      border-collapse: collapse;
      font-size: 7.6pt;
      margin-top: 4px;
      margin-bottom: 4px;
    }}
    .tabla-control-ampliada th,
    .tabla-control-ampliada td {{
      border: 1px solid #cbd5e1;
      padding: 1.8px 4px;
      line-height: 1.15;
    }}
    .tabla-control-ampliada thead th {{
      font-weight: 700;
      text-transform: uppercase;
      font-size: 7.2pt;
      letter-spacing: 0.3px;
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
    .badge-id {{
      display: inline-block;
      padding: 1px 4px;
      font-size: 6.8pt;
      font-weight: 700;
      border-radius: 2px;
      background-color: #e0f2fe;
      color: #0369a1;
      border: 1px solid #bae6fd;
    }}
    .badge-resp {{
      display: inline-block;
      padding: 1px 4px;
      font-size: 6.8pt;
      font-weight: 700;
      border-radius: 2px;
      background-color: #ccfbf1;
      color: #0f766e;
      border: 1px solid #99f6e4;
    }}
    .casilla-conteo {{
      background-color: #f0fdf4;
      color: #15803d;
    }}
    .casilla-conteo-resp {{
      background-color: #f0fdf4;
      color: #0f766e;
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
      margin-top: 28px;
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
    .color-muted {{
      color: #94a3b8;
    }}
  </style>
</head>
<body>

  <!-- =======================================================================
       PÁGINA 1: ACTA FORMAL LEGAL DE RECEPCIÓN FÍSICA DE FICHAS ÓPTICAS
       ======================================================================= -->
  <div class="hoja-a4">
{header_html}

    <!-- Título y Metadatos -->
    <div class="titulo-documento-box">
      <h1 class="titulo-documento">Acta de Recepción Física de Fichas Ópticas</h1>
      <div class="meta-documento">
        <span>CÓDIGO: ACTA-03-FISICO-2026</span>
        <span>OFICIO REF: OFICIO N.° 003-2025-AP-UAF-GAD-CSJPU-PJ</span>
        <span>FECHA: 16 DE OCTUBRE DE 2026</span>
      </div>
    </div>

    <!-- 1. Datos Generales -->
    <section class="seccion">
      <div class="seccion-titulo">1. Datos Generales</div>
      <div class="grid-dos-columnas">
        <div class="campo-dato"><span class="campo-etiqueta">Proceso:</span> <span class="campo-valor">Proceso de Selección de Personal a Plazo Indeterminado N.° 001-2026-UE-PUNO</span></div>
        <div class="campo-dato"><span class="campo-etiqueta">Fecha de Recepción:</span> <span class="campo-valor">16 de octubre de 2026</span></div>
        <div class="campo-dato"><span class="campo-etiqueta">Distribución:</span> <span class="campo-valor">2 Turnos de Evaluación (Turno 1 / Grupo 1 y Turno 2 / Grupo 2) — 25 Aulas</span></div>
        <div class="campo-dato"><span class="campo-etiqueta">Lugar de Recepción y Firma:</span> <span class="campo-valor">Centro de Cómputo y Calificación — UNA-PUNO</span></div>
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

    <!-- 3. Recepción Consolidada de Paquetes -->
    <section class="seccion">
      <div class="seccion-titulo">3. Resumen Consolidado de Fichas Ópticas Recibidas</div>
      <table class="tabla-formal">
        <thead>
          <tr>
            <th>Turno / Grupo</th>
            <th>Aulas</th>
            <th>Fichas ID Programadas</th>
            <th>Fichas ID Recibidas</th>
            <th>Fichas RESP Recibidas</th>
            <th>Fichas RESP Leídas</th>
            <th>Ausentes</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="font-bold">Turno 1 (Grupo 1)</td>
            <td class="text-center">25</td>
            <td class="text-center font-mono">998</td>
            <td class="text-center font-mono font-bold" style="color: #0369a1;">998 (100%)</td>
            <td class="text-center font-mono font-bold">998 (100%)</td>
            <td class="text-center font-mono font-bold" style="color: #0f766e;">979</td>
            <td class="text-center font-mono font-bold">19</td>
            <td class="text-center"><span class="badge-conforme">CONFORME</span></td>
          </tr>
          <tr>
            <td class="font-bold">Turno 2 (Grupo 2)</td>
            <td class="text-center">25</td>
            <td class="text-center font-mono">984</td>
            <td class="text-center font-mono font-bold" style="color: #0369a1;">984 (100%)</td>
            <td class="text-center font-mono font-bold">984 (100%)</td>
            <td class="text-center font-mono font-bold" style="color: #0f766e;">966</td>
            <td class="text-center font-mono font-bold">18</td>
            <td class="text-center"><span class="badge-conforme">CONFORME</span></td>
          </tr>
        </tbody>
        <tfoot>
          <tr style="font-weight: bold; background-color: #f1f5f9;">
            <td>TOTAL GENERAL</td>
            <td class="text-center">50</td>
            <td class="text-center font-mono">1,982</td>
            <td class="text-center font-mono" style="color: #0369a1;">1,982</td>
            <td class="text-center font-mono">1,982</td>
            <td class="text-center font-mono" style="color: #0f766e;">1,945</td>
            <td class="text-center font-mono">37</td>
            <td class="text-center"><span class="badge-conforme">CONFORME</span></td>
          </tr>
        </tfoot>
      </table>
    </section>

    <!-- 4. Declaración de Conformidad y Cadena de Custodia -->
    <section class="seccion">
      <div class="seccion-titulo">4. Conformidad y Cadena de Custodia</div>
      <p class="texto-cuerpo">
        Se deja expresa constancia de que los paquetes lacrados conteniendo las fichas ópticas de Identificación (ID) y Respuestas (RESP) fueron recepcionados en su totalidad, con precintos intactos y sin adulteración física, en las instalaciones del Centro de Cómputo y Calificación de la Dirección de Admisión UNA-PUNO. El detalle aula por aula se consigna en los Anexos 01-A, 01-B, 02-A y 02-B adjuntos, los cuales forman parte integrante de la presente acta.
      </p>
    </section>

    <!-- Firmas Legales -->
    <div class="seccion-firmas" style="margin-top: 25px;">
      <div class="firma-box">
        <div class="linea-firma"></div>
        <div class="nombre-firmante">Dr. Bladimiro Centeno Herrera</div>
        <div class="cargo-firmante">Director de la Dirección de Admisión<br>Universidad Nacional del Altiplano de Puno<br><strong>DNI: 29679918</strong></div>
      </div>
      <div class="firma-box">
        <div class="linea-firma"></div>
        <div class="nombre-firmante">Abog. Edson Teofilo Mamani Quispe</div>
        <div class="cargo-firmante">Coordinador de Seguridad Integral<br>Corte Superior de Justicia de Puno — Poder Judicial<br><strong>DNI: 46829313</strong></div>
      </div>
    </div>
  </div>

  <!-- =======================================================================
       PÁGINA 2: ANEXO 01-A: IDENTIFICACIÓN (ID) — TURNO 1 (GRUPO 1)
       ======================================================================= -->
  <div class="hoja-a4 salto-pagina pagina-anexo">
{header_html}

    <div class="titulo-documento-box">
      <h2 class="titulo-documento" style="font-size: 10pt;">ANEXO 01-A: RECEPCIÓN Y VERIFICACIÓN DE FICHAS DE IDENTIFICACIÓN (ID) — TURNO 1 (GRUPO 1)</h2>
      <div class="meta-documento">
        <span>CONTROL DE IDENTIFICACIÓN (ID) — TURNO 1 (25 AULAS)</span>
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
          <th class="header-sub-id" style="width: 18%;">Fichas Recibidas</th>
          <th class="header-sub-id" style="width: 14%;">Fichas Leídas</th>
          <th class="header-sub-id" style="width: 10%;">Ausentes</th>
          <th class="header-sub-id" style="width: 14%;">Conformidad</th>
        </tr>
      </thead>
      <tbody>
{t1_id_rows}
      </tbody>
      <tfoot>
        <tr class="fila-total-turno">
          <td colspan="2" class="text-center font-bold">TOTAL TURNO 1</td>
          <td class="text-center font-mono font-bold">998</td>
          <td class="text-center casilla-conteo font-mono font-bold">✓ [998]</td>
          <td class="text-center font-mono font-bold" style="color: #0369a1;">998</td>
          <td class="text-center font-mono font-bold">0</td>
          <td class="text-center font-bold" style="color: #15803d;">CONFORME</td>
        </tr>
      </tfoot>
    </table>

    <div class="banner-turno-meta">
      <span>RESUMEN TURNO 1 (GRUPO 1): 25 AULAS PROCESADAS</span>
      <span class="font-mono">PROGRAMADOS: 998 &nbsp;|&nbsp; FICHAS ID LEÍDAS: 998 &nbsp;|&nbsp; AUSENTES: 0 &nbsp;|&nbsp; CONFORMIDAD: 100%</span>
    </div>

{firmas_anexo_html}
  </div>

  <!-- =======================================================================
       PÁGINA 3: ANEXO 01-B: IDENTIFICACIÓN (ID) — TURNO 2 (GRUPO 2)
       ======================================================================= -->
  <div class="hoja-a4 salto-pagina pagina-anexo">
{header_html}

    <div class="titulo-documento-box">
      <h2 class="titulo-documento" style="font-size: 10pt;">ANEXO 01-B: RECEPCIÓN Y VERIFICACIÓN DE FICHAS DE IDENTIFICACIÓN (ID) — TURNO 2 (GRUPO 2)</h2>
      <div class="meta-documento">
        <span>CONTROL DE IDENTIFICACIÓN (ID) — TURNO 2 (25 AULAS)</span>
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
          <th class="header-sub-id" style="width: 18%;">Fichas Recibidas</th>
          <th class="header-sub-id" style="width: 14%;">Fichas Leídas</th>
          <th class="header-sub-id" style="width: 10%;">Ausentes</th>
          <th class="header-sub-id" style="width: 14%;">Conformidad</th>
        </tr>
      </thead>
      <tbody>
{t2_id_rows}
      </tbody>
      <tfoot>
        <tr class="fila-total-turno">
          <td colspan="2" class="text-center font-bold">TOTAL TURNO 2</td>
          <td class="text-center font-mono font-bold">984</td>
          <td class="text-center casilla-conteo font-mono font-bold">✓ [984]</td>
          <td class="text-center font-mono font-bold" style="color: #0369a1;">984</td>
          <td class="text-center font-mono font-bold">0</td>
          <td class="text-center font-bold" style="color: #15803d;">CONFORME</td>
        </tr>
      </tfoot>
    </table>

    <div class="banner-turno-meta">
      <span>RESUMEN TURNO 2 (GRUPO 2): 25 AULAS PROCESADAS</span>
      <span class="font-mono">PROGRAMADOS: 984 &nbsp;|&nbsp; FICHAS ID LEÍDAS: 984 &nbsp;|&nbsp; AUSENTES: 0 &nbsp;|&nbsp; CONFORMIDAD: 100%</span>
    </div>

{firmas_anexo_html}
  </div>

  <!-- =======================================================================
       PÁGINA 4: ANEXO 02-A: RESPUESTAS (RESP) — TURNO 1 (GRUPO 1)
       ======================================================================= -->
  <div class="hoja-a4 salto-pagina pagina-anexo">
{header_html}

    <div class="titulo-documento-box">
      <h2 class="titulo-documento" style="font-size: 10pt;">ANEXO 02-A: RECEPCIÓN Y VERIFICACIÓN DE FICHAS DE RESPUESTAS (RESP) — TURNO 1 (GRUPO 1)</h2>
      <div class="meta-documento">
        <span>CONTROL DE RESPUESTAS (RESP) — TURNO 1 (25 AULAS)</span>
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
          <th class="header-sub-resp" style="width: 18%;">Fichas Recibidas</th>
          <th class="header-sub-resp" style="width: 14%;">Fichas Leídas</th>
          <th class="header-sub-resp" style="width: 10%;">Ausentes</th>
          <th class="header-sub-resp" style="width: 14%;">Conformidad</th>
        </tr>
      </thead>
      <tbody>
{t1_resp_rows}
      </tbody>
      <tfoot>
        <tr class="fila-total-turno">
          <td colspan="2" class="text-center font-bold">TOTAL TURNO 1</td>
          <td class="text-center font-mono font-bold">998</td>
          <td class="text-center casilla-conteo-resp font-mono font-bold">✓ [979]</td>
          <td class="text-center font-mono font-bold" style="color: #0f766e;">979</td>
          <td class="text-center font-mono font-bold">19</td>
          <td class="text-center font-bold" style="color: #15803d;">CONFORME</td>
        </tr>
      </tfoot>
    </table>

    <div class="banner-turno-meta">
      <span>RESUMEN TURNO 1 (GRUPO 1): 25 AULAS PROCESADAS</span>
      <span class="font-mono">PROGRAMADOS: 998 &nbsp;|&nbsp; FICHAS RESP LEÍDAS: 979 &nbsp;|&nbsp; AUSENTES: 19 &nbsp;|&nbsp; CONFORMIDAD: 100%</span>
    </div>

{firmas_anexo_html}
  </div>

  <!-- =======================================================================
       PÁGINA 5: ANEXO 02-B: RESPUESTAS (RESP) — TURNO 2 (GRUPO 2)
       ======================================================================= -->
  <div class="hoja-a4 salto-pagina pagina-anexo">
{header_html}

    <div class="titulo-documento-box">
      <h2 class="titulo-documento" style="font-size: 10pt;">ANEXO 02-B: RECEPCIÓN Y VERIFICACIÓN DE FICHAS DE RESPUESTAS (RESP) — TURNO 2 (GRUPO 2)</h2>
      <div class="meta-documento">
        <span>CONTROL DE RESPUESTAS (RESP) — TURNO 2 (25 AULAS)</span>
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
          <th class="header-sub-resp" style="width: 18%;">Fichas Recibidas</th>
          <th class="header-sub-resp" style="width: 14%;">Fichas Leídas</th>
          <th class="header-sub-resp" style="width: 10%;">Ausentes</th>
          <th class="header-sub-resp" style="width: 14%;">Conformidad</th>
        </tr>
      </thead>
      <tbody>
{t2_resp_rows}
      </tbody>
      <tfoot>
        <tr class="fila-total-turno">
          <td colspan="2" class="text-center font-bold">TOTAL TURNO 2</td>
          <td class="text-center font-mono font-bold">984</td>
          <td class="text-center casilla-conteo-resp font-mono font-bold">✓ [966]</td>
          <td class="text-center font-mono font-bold" style="color: #0f766e;">966</td>
          <td class="text-center font-mono font-bold">18</td>
          <td class="text-center font-bold" style="color: #15803d;">CONFORME</td>
        </tr>
      </tfoot>
    </table>

    <div class="banner-turno-meta">
      <span>RESUMEN TURNO 2 (GRUPO 2): 25 AULAS PROCESADAS</span>
      <span class="font-mono">PROGRAMADOS: 984 &nbsp;|&nbsp; FICHAS RESP LEÍDAS: 966 &nbsp;|&nbsp; AUSENTES: 18 &nbsp;|&nbsp; CONFORMIDAD: 100%</span>
    </div>

{firmas_anexo_html}
  </div>

</body>
</html>
"""

target_03 = os.path.join(BASE_DIR, "03-acta-recepcion-fisica.html")
with open(target_03, "w", encoding="utf-8") as f:
    f.write(acta_03_content)

print(f"Generated 5-page {target_03} ({len(acta_03_content)} chars)")
