"""Smoke tests de los generadores de salida (CSV / XLSX / PDF)."""
import csv

import openpyxl
import pytest

import catedra_core as cc
import catedra_report as rp


@pytest.fixture
def report():
    roster = [
        dict(n="1", salon="1", dni="00000001", apellido_paterno="ABANTO",
             apellido_materno="GOMEZ", nombres="JUAN", escuela_id="1",
             escuela_profesional="Ingeniería Agronómica", facultad_id="1",
             facultad="Ciencias Agrarias", facultad_sigla="FCA",
             plaza="PLA-001", plaza_adicional="\\N"),
        dict(n="2", salon="1", dni="00000002", apellido_paterno="ZAPANA",
             apellido_materno="LI", nombres="ANA", escuela_id="1",
             escuela_profesional="Ingeniería Agronómica", facultad_id="1",
             facultad="Ciencias Agrarias", facultad_sigla="FCA",
             plaza="PLA-002", plaza_adicional="\\N"),
        dict(n="3", salon="1", dni="00000003", apellido_paterno="SIN",
             apellido_materno="HOJA", nombres="X", escuela_id="1",
             escuela_profesional="Ingeniería Agronómica", facultad_id="1",
             facultad="Ciencias Agrarias", facultad_sigla="FCA",
             plaza="PLA-003", plaza_adicional="\\N"),
    ]
    key = "ABCDE" * 6
    return cc.build_report(
        roster=roster, escuelas={1: "Ingeniería Agronómica"},
        identifiers={"000101": "00000001", "000102": "00000002"},
        responses={"000101": key, "000102": "ABCDEABCDEABCDE" + "X" * 15},
        key_answers={1: key}, section_parents={}, blank_lithos=["999999"], umbral=16,
    )


def test_write_csv(tmp_path, report):
    p = tmp_path / "r.csv"
    rp.write_csv(p, report)
    rows = list(csv.reader(p.open(encoding="utf-8-sig")))
    assert rows[0] == rp.CSV_HEADER
    assert len(rows) == 1 + 2  # header + 2 calificados
    assert rows[1][rp.CSV_HEADER.index("Condición")] in ("APTO", "NO APTO")


def test_write_xlsx_tiene_tres_hojas(tmp_path, report):
    p = tmp_path / "r.xlsx"
    rp.write_xlsx(p, report)
    wb = openpyxl.load_workbook(p)
    assert wb.sheetnames == ["Resultados", "Resumen", "Incidencias"]
    ws = wb["Resultados"]
    assert [c.value for c in ws[1]] == rp.CSV_HEADER
    assert ws.max_row == 1 + 2
    assert wb["Incidencias"].max_row >= 2  # encabezado + 1 incidencia


def test_write_pdf_una_pagina_por_escuela(tmp_path, report):
    p = tmp_path / "r.pdf"
    rp.write_pdf(p, report, titulo="CONCURSO PÚBLICO DE CÁTEDRA 2026-II",
                 subtitulo="RESULTADOS DE LA PRUEBA DE CONOCIMIENTOS")
    data = p.read_bytes()
    assert data[:4] == b"%PDF"
    assert len(data) > 1000


def test_write_pdf_es_vertical_a4(tmp_path, report):
    from pypdf import PdfReader
    p = tmp_path / "r.pdf"
    rp.write_pdf(p, report, titulo="T", subtitulo="S")
    box = PdfReader(str(p)).pages[0].mediabox
    assert float(box.height) > float(box.width)  # retrato


def test_write_pdf_logo_inexistente_no_rompe(tmp_path, report):
    p = tmp_path / "r.pdf"
    rp.write_pdf(p, report, titulo="T", subtitulo="S",
                 logo=tmp_path / "no_existe.png")
    assert p.read_bytes()[:4] == b"%PDF"


def test_write_pdf_con_logo(tmp_path, report):
    from pathlib import Path

    logo = Path(__file__).resolve().parents[2] / "frontend" / "public" / "unap.png"
    if not logo.exists():
        import pytest
        pytest.skip("logo unap.png no disponible en este entorno")
    p = tmp_path / "r.pdf"
    rp.write_pdf(p, report, titulo="T", subtitulo="S", logo=logo)
    data = p.read_bytes()
    assert data[:4] == b"%PDF"
    assert len(data) > 5000  # el logo añade peso
