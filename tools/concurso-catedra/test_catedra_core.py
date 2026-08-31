"""Tests para el motor de calificación del Concurso Público de Cátedra."""
import catedra_core as cc


# ---------------------------------------------------------------------------
# Parsing de archivos .dat (ancho fijo)
# ---------------------------------------------------------------------------

def test_parse_identifiers_extrae_litho_y_dni():
    line = "227000001001010102001   5310 #0001    N 001663 01221167001\n"
    assert cc.parse_identifiers(line) == {"001663": "01221167"}


def test_parse_identifiers_omite_hoja_con_dni_en_blanco():
    line = "227000010001010102001   5310 #0001    N 001616            \n"
    assert cc.parse_identifiers(line) == {}


def test_parse_identifiers_omite_linea_terminador_sin_litho():
    line = "227000046001010102001   5310 #0001    N \n"
    assert cc.parse_identifiers(line) == {}


def test_parse_responses_extrae_30_marcas():
    line = "228000001001010102001   5310 #0001    N 001645DDBDEDECDCDACCEAADADADDEBEBACA\n"
    out = cc.parse_responses(line)
    assert out == {"001645": "DDBDEDECDCDACCEAADADADDEBEBACA"}
    assert len(out["001645"]) == 30


def test_parse_responses_conserva_blancos_internos():
    line = "228000010001010102001   5310 #0001    N 001653DDAD   CABCEBEEEE ABADDEBEBACA\n"
    assert cc.parse_responses(line)["001653"] == "DDAD   CABCEBEEEE ABADDEBEBACA"


def test_parse_key_index_mapea_litho_a_escuela_id():
    text = (
        "227000001001010102001   5310 #0001    N 082331         007\n"
        "227000002001010102001   5310 #0001    N 082330         053\n"
    )
    assert cc.parse_key_index(text) == {"082331": 7, "082330": 53}


def test_parse_key_answers_indexa_por_escuela():
    key_index = {"082331": 7}
    text = "228000001001010102001   5310 #0001    N 082331EBDADDCCCBBDBADCBBABACDCEBBCAA\n"
    out = cc.parse_key_answers(text, key_index)
    assert out == {7: "EBDADDCCCBBDBADCBBABACDCEBBCAA"}


def test_parse_key_answers_conserva_pregunta_anulada_como_espacio():
    key_index = {"082290": 5}
    text = "228000029001010102001   5310 #0001    N 082290BCDCCCDBCBEEDBDDADABACD EBBCAA\n"
    # la pregunta 24 (índice 23) está anulada -> espacio en la clave
    assert cc.parse_key_answers(text, key_index)[5][23] == " "


# ---------------------------------------------------------------------------
# Calificación
# ---------------------------------------------------------------------------

def test_grade_cuenta_aciertos_simples():
    r = cc.grade_answers("ABC", "ABX")
    assert r["correctas"] == 2
    assert r["incorrectas"] == 1
    assert r["aciertos"] == 2


def test_grade_pregunta_anulada_es_acierto_para_todos():
    # clave con espacio en la posicion 2 -> anulada
    r = cc.grade_answers("XXX", "AB ")
    assert r["anuladas"] == 1
    assert r["aciertos"] == 1  # las 2 primeras estan mal, la anulada suma
    assert r["correctas"] == 0


def test_grade_blanco_del_postulante_no_penaliza_ni_suma():
    r = cc.grade_answers("A C", "ABC")
    assert r["blancos"] == 1
    assert r["correctas"] == 2
    assert r["incorrectas"] == 0
    assert r["aciertos"] == 2


def test_grade_marcas_mas_cortas_que_la_clave_cuentan_como_blanco():
    r = cc.grade_answers("AB", "ABCDE")
    assert r["blancos"] == 3
    assert r["aciertos"] == 2


def test_grade_preguntas_es_largo_de_la_clave():
    assert cc.grade_answers("", "A" * 30)["preguntas"] == 30


# Caso real validado contra calificadodeOtro.pdf:
# CASTILLO PACA (esc 5) -> 15 correctas + 1 anulada = 16 aciertos -> APTO
def test_grade_caso_real_castillo_paca():
    key = "BCDCCCDBCBEEDBDDADABACD EBBCAA"
    marks = "BDDCBCABABEEDAEDBBBBBADEBBBAAB"
    assert cc.grade_answers(marks, key)["aciertos"] == 16


# ---------------------------------------------------------------------------
# Puntajes y condición
# ---------------------------------------------------------------------------

def test_score_20_regla_de_tres_sobre_30():
    assert cc.score_20(16, 30) == 10.667
    assert cc.score_20(15, 30) == 10.0
    assert cc.score_20(30, 30) == 20.0
    assert cc.score_20(0, 30) == 0.0


def test_condicion_apto_desde_el_umbral():
    assert cc.condicion(16, umbral=16) == "APTO"
    assert cc.condicion(15, umbral=16) == "NO APTO"


# ---------------------------------------------------------------------------
# Resolución de clave por escuela (secciones sin clave propia)
# ---------------------------------------------------------------------------

def test_resolve_key_usa_clave_propia_si_existe():
    keys = {10: "A" * 30}
    assert cc.resolve_key(10, keys, section_parents={}) == "A" * 30


def test_resolve_key_cae_a_la_escuela_matriz():
    keys = {10: "A" * 30}
    assert cc.resolve_key(54, keys, section_parents={54: 10}) == "A" * 30


def test_resolve_key_devuelve_none_si_no_hay_clave_ni_matriz():
    assert cc.resolve_key(99, {}, section_parents={}) is None
