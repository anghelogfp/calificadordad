"""Tests de carga de CSV y de inferencia de escuelas matriz."""
import catedra_core as cc


def test_load_escuelas(tmp_path):
    p = tmp_path / "escuelas.csv"
    p.write_text('﻿"id","nombre"\n"1","Ingeniería Agronómica"\n"14","Ciencias de la Comunicación Social"\n',
                 encoding="utf-8")
    assert cc.load_escuelas(p) == {1: "Ingeniería Agronómica",
                                   14: "Ciencias de la Comunicación Social"}


def test_load_roster_normaliza_encabezados(tmp_path):
    p = tmp_path / "data.csv"
    p.write_text(
        "﻿N°,salon,dni,apellido_paterno,apellido_materno,nombres,escuela_id,"
        "escuela_profesional,facultad_id,facultad,facultad_sigla,plaza,plaza_adicional\n"
        "1,1,1324847,GALLEGOS,ROJAS,JUSTO,3,Ingeniería Agroindustrial - Sección Juli,"
        "1,Ciencias Agrarias,FCA,PLA-010,\\N\n",
        encoding="utf-8",
    )
    rows = cc.load_roster(p)
    assert len(rows) == 1
    r = rows[0]
    assert r["n"] == "1"
    assert r["dni"] == "1324847"
    assert r["apellido_paterno"] == "GALLEGOS"
    assert r["escuela_id"] == "3"
    assert r["plaza"] == "PLA-010"


def test_infer_section_parents_por_nombre():
    escuelas = {
        10: "Ingeniería de Minas",
        14: "Ciencias de la Comunicación Social",
        54: "Ingeniería de Minas - Sección Azángaro",
        55: "Ciencias de la Comunicación Social - Sección Azángaro",
        56: "Ciencias de la Comunicación Social - Sección Juli",
    }
    assert cc.infer_section_parents(escuelas) == {54: 10, 55: 14, 56: 14}


def test_infer_section_parents_ignora_seccion_sin_matriz_exacta():
    escuelas = {52: "Ingeniería de Telecomunicaciones - Sección Azángaro"}
    assert cc.infer_section_parents(escuelas) == {}
