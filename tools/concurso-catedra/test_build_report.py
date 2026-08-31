"""Tests del armado del reporte completo (build_report)."""
import catedra_core as cc


def _roster_row(**kw):
    base = dict(
        n="1", salon="1", dni="00000001",
        apellido_paterno="PEREZ", apellido_materno="GOMEZ", nombres="JUAN",
        escuela_id="1", escuela_profesional="Ingeniería Agronómica",
        facultad_id="1", facultad="Ciencias Agrarias", facultad_sigla="FCA",
        plaza="PLA-001", plaza_adicional="\\N",
    )
    base.update(kw)
    return base


KEY = "ABCDE" * 6                     # 30 respuestas, sin anuladas
ALL_RIGHT = KEY
HALF = "ABCDEABCDEABCDE" + "X" * 15   # 15 correctas


def test_parse_blank_identifier_lithos():
    text = (
        "227000001001010102001   5310 #0001    N 001663 01221167001\n"
        "227000010001010102001   5310 #0001    N 001616            \n"
        "227000046001010102001   5310 #0001    N \n"
    )
    assert cc.parse_blank_identifier_lithos(text) == ["001616"]


def test_build_report_ordena_por_escuela_y_puntaje_descendente():
    roster = [
        _roster_row(n="1", dni="00000001", apellido_paterno="ABANTO", escuela_id="1"),
        _roster_row(n="2", dni="00000002", apellido_paterno="ZAPANA", escuela_id="1"),
    ]
    rep = cc.build_report(
        roster=roster, escuelas={1: "Ingeniería Agronómica"},
        identifiers={"000101": "00000001", "000102": "00000002"},
        responses={"000101": HALF, "000102": ALL_RIGHT},  # ABANTO 15, ZAPANA 30
        key_answers={1: KEY}, section_parents={}, blank_lithos=[], umbral=16,
    )
    assert [r["dni"] for r in rep.resultados] == ["00000002", "00000001"]  # 30 antes que 15
    zapana, abanto = rep.resultados
    assert zapana["aciertos"] == 30
    assert zapana["puntaje30"] == 30
    assert zapana["puntaje20"] == 20.0
    assert zapana["condicion"] == "APTO"
    assert abanto["aciertos"] == 15
    assert abanto["puntaje20"] == 10.0
    assert abanto["condicion"] == "NO APTO"
    assert abanto["nombre"] == "ABANTO GOMEZ, JUAN"


def test_build_report_empate_de_puntaje_desempata_por_apellido():
    roster = [
        _roster_row(dni="00000001", apellido_paterno="ZETA", escuela_id="1"),
        _roster_row(dni="00000002", apellido_paterno="ALFA", escuela_id="1"),
    ]
    rep = cc.build_report(
        roster=roster, escuelas={1: "Ingeniería Agronómica"},
        identifiers={"a": "00000001", "b": "00000002"},
        responses={"a": ALL_RIGHT, "b": ALL_RIGHT},  # mismo puntaje
        key_answers={1: KEY}, section_parents={}, blank_lithos=[], umbral=16,
    )
    assert [r["dni"] for r in rep.resultados] == ["00000002", "00000001"]  # ALFA antes que ZETA


def test_build_report_resumen_por_escuela():
    roster = [
        _roster_row(dni="00000001", escuela_id="1"),
        _roster_row(dni="00000002", escuela_id="1"),
        _roster_row(dni="00000003", escuela_id="2", escuela_profesional="Sociología"),
    ]
    rep = cc.build_report(
        roster=roster, escuelas={1: "Ingeniería Agronómica", 2: "Sociología"},
        identifiers={"a": "00000001", "b": "00000002", "c": "00000003"},
        responses={"a": ALL_RIGHT, "b": HALF, "c": ALL_RIGHT},
        key_answers={1: KEY, 2: KEY}, section_parents={}, blank_lithos=[], umbral=16,
    )
    resumen = {r["escuela_id"]: r for r in rep.resumen}
    assert resumen[1]["postulantes"] == 2
    assert resumen[1]["aptos"] == 1
    assert resumen[1]["no_aptos"] == 1
    assert resumen[2]["aptos"] == 1


def test_build_report_incidencia_sin_identificar():
    rep = cc.build_report(
        roster=[_roster_row(dni="00000001")],
        escuelas={1: "Ingeniería Agronómica"},
        identifiers={"aaa": "00000001"},
        responses={"aaa": ALL_RIGHT, "zzz": HALF},
        key_answers={1: KEY}, section_parents={},
        blank_lithos=["zzz"], umbral=16,
    )
    tipos = [i["tipo"] for i in rep.incidencias]
    assert "SIN_IDENTIFICAR" in tipos
    inc = next(i for i in rep.incidencias if i["tipo"] == "SIN_IDENTIFICAR")
    assert inc["litho"] == "zzz"


def test_build_report_incidencia_no_rindio():
    rep = cc.build_report(
        roster=[_roster_row(dni="00000001"), _roster_row(dni="00000002")],
        escuelas={1: "Ingeniería Agronómica"},
        identifiers={"aaa": "00000001"},
        responses={"aaa": ALL_RIGHT},
        key_answers={1: KEY}, section_parents={}, blank_lithos=[], umbral=16,
    )
    inc = [i for i in rep.incidencias if i["tipo"] == "NO_RINDIO"]
    assert len(inc) == 1 and inc[0]["dni"] == "00000002"
    # quien no rindió no aparece en resultados calificados
    assert [r["dni"] for r in rep.resultados] == ["00000001"]


def test_build_report_incidencia_sin_clave():
    rep = cc.build_report(
        roster=[_roster_row(dni="00000001", escuela_id="7",
                            escuela_profesional="Escuela rara sin clave")],
        escuelas={7: "Escuela rara sin clave"},
        identifiers={"aaa": "00000001"},
        responses={"aaa": ALL_RIGHT},
        key_answers={1: KEY}, section_parents={}, blank_lithos=[], umbral=16,
    )
    inc = [i for i in rep.incidencias if i["tipo"] == "SIN_CLAVE"]
    assert len(inc) == 1 and inc[0]["dni"] == "00000001"
    assert rep.resultados == []


def test_build_report_seccion_usa_clave_matriz():
    rep = cc.build_report(
        roster=[_roster_row(dni="00000001", escuela_id="54",
                            escuela_profesional="Ingeniería de Minas - Sección Azángaro")],
        escuelas={54: "Ingeniería de Minas - Sección Azángaro", 10: "Ingeniería de Minas"},
        identifiers={"aaa": "00000001"},
        responses={"aaa": ALL_RIGHT},
        key_answers={10: KEY}, section_parents={54: 10}, blank_lithos=[], umbral=16,
    )
    assert rep.resultados[0]["condicion"] == "APTO"
    assert rep.incidencias == []
