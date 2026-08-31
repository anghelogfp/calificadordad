"""Motor de calificación del Concurso Público de Cátedra (UNAP).

Reglas reconstruidas y validadas contra el reporte oficial:

* Cada escuela profesional tiene su propia clave de 30 respuestas.
* Las secciones (Azángaro / Juli) sin clave propia usan la de su escuela matriz.
* Acierto = la marca coincide con la clave.
* Pregunta anulada = casilla de la clave en blanco -> acierto para todos.
* Respuesta en blanco del postulante = 0, no penaliza.
* Puntaje /30 = aciertos.  Puntaje /20 = aciertos / 30 * 20.
* APTO si aciertos >= umbral (16 por defecto, equivale a nota 10.667 ≈ 11).
"""
from __future__ import annotations

import csv
from dataclasses import dataclass, field

_SECCION_SEP = " - Sección "

# Offsets de ancho fijo dentro de cada línea .dat (0-indexed).
_LITHO = slice(40, 46)
_PAYLOAD = slice(46, None)


def _iter_dat(text: str):
    """Genera (litho, payload) por cada línea con litho numérico de 6 dígitos."""
    for line in text.splitlines():
        litho = line[_LITHO]
        if len(litho) == 6 and litho.isdigit():
            yield litho, line[_PAYLOAD]


def parse_identifiers(text: str) -> dict[str, str]:
    """litho -> DNI (8 dígitos). Omite hojas sin DNI marcado."""
    out: dict[str, str] = {}
    for litho, payload in _iter_dat(text):
        dni = payload[1:9].strip()
        if dni:
            out[litho] = dni
    return out


def parse_blank_identifier_lithos(text: str) -> list[str]:
    """Lithos de hojas de identificación cuyo DNI quedó sin marcar."""
    out: list[str] = []
    for litho, payload in _iter_dat(text):
        if not payload[1:9].strip():
            out.append(litho)
    return out


def parse_responses(text: str) -> dict[str, str]:
    """litho -> cadena de marcas (se conservan los blancos internos)."""
    return {litho: payload.rstrip("\r\n").rstrip() for litho, payload in _iter_dat(text)}


def parse_key_index(text: str) -> dict[str, int]:
    """litho de la hoja-clave -> id de escuela profesional."""
    return {litho: int(payload.strip()) for litho, payload in _iter_dat(text)}


def parse_key_answers(text: str, key_index: dict[str, int]) -> dict[int, str]:
    """id de escuela -> clave de 30 respuestas (los espacios = preguntas anuladas)."""
    out: dict[int, str] = {}
    for litho, payload in _iter_dat(text):
        escuela = key_index.get(litho)
        if escuela is not None:
            out[escuela] = payload.rstrip("\r\n").rstrip()
    return out


def grade_answers(marks: str, key: str) -> dict:
    """Califica una cadena de marcas contra la clave.

    Devuelve correctas, incorrectas, blancos, anuladas, aciertos y preguntas.
    aciertos = correctas + anuladas.
    """
    correctas = incorrectas = blancos = anuladas = 0
    for i, k in enumerate(key):
        m = marks[i] if i < len(marks) else " "
        if k == " ":
            anuladas += 1
        elif m == " " or m == "":
            blancos += 1
        elif m == k:
            correctas += 1
        else:
            incorrectas += 1
    return {
        "correctas": correctas,
        "incorrectas": incorrectas,
        "blancos": blancos,
        "anuladas": anuladas,
        "aciertos": correctas + anuladas,
        "preguntas": len(key),
    }


def score_20(aciertos: int, preguntas: int) -> float:
    """Puntaje en base 20 (regla de tres sobre el total de preguntas)."""
    return round(aciertos / preguntas * 20, 3)


def condicion(aciertos: int, umbral: int = 16) -> str:
    return "APTO" if aciertos >= umbral else "NO APTO"


def resolve_key(escuela_id: int, key_answers: dict[int, str],
                section_parents: dict[int, int]) -> str | None:
    """Clave de la escuela, cayendo a la escuela matriz si es una sección."""
    if escuela_id in key_answers:
        return key_answers[escuela_id]
    padre = section_parents.get(escuela_id)
    if padre is not None:
        return key_answers.get(padre)
    return None


def load_escuelas(path) -> dict[int, str]:
    """Lee escuelas.csv -> {id: nombre}."""
    out: dict[int, str] = {}
    with open(path, encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            out[int(row["id"])] = row["nombre"].strip()
    return out


_ROSTER_ALIASES = {"n°": "n", "nº": "n", "n": "n"}


def load_roster(path) -> list[dict]:
    """Lee data_Catedra.csv normalizando el encabezado (N° -> n)."""
    out: list[dict] = []
    with open(path, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            norm = {}
            for k, v in row.items():
                if k is None:
                    continue
                key = _ROSTER_ALIASES.get(k.strip().lower(), k.strip())
                norm[key] = (v or "").strip()
            out.append(norm)
    return out


def infer_section_parents(escuelas: dict[int, str]) -> dict[int, int]:
    """Deduce la escuela matriz de cada sección por coincidencia exacta de nombre."""
    by_name = {nombre: eid for eid, nombre in escuelas.items()}
    parents: dict[int, int] = {}
    for eid, nombre in escuelas.items():
        if _SECCION_SEP in nombre:
            base = nombre.split(_SECCION_SEP, 1)[0]
            if base in by_name:
                parents[eid] = by_name[base]
    return parents


@dataclass
class Report:
    resultados: list[dict] = field(default_factory=list)
    resumen: list[dict] = field(default_factory=list)
    incidencias: list[dict] = field(default_factory=list)


def _nombre(row: dict) -> str:
    return (f"{row['apellido_paterno']} {row['apellido_materno']}, "
            f"{row['nombres']}").upper().strip()


def build_report(*, roster: list[dict], escuelas: dict[int, str],
                 identifiers: dict[str, str], responses: dict[str, str],
                 key_answers: dict[int, str], section_parents: dict[int, int],
                 blank_lithos=(), umbral: int = 16) -> Report:
    """Cruza padrón + hojas + claves y arma resultados, resumen e incidencias."""
    rep = Report()
    dni_to_litho = {dni: litho for litho, dni in identifiers.items()}
    roster_dnis = set()

    for row in roster:
        dni = row["dni"].strip().zfill(8)
        roster_dnis.add(dni)
        litho = dni_to_litho.get(dni)
        if litho is None:
            rep.incidencias.append({
                "tipo": "NO_RINDIO", "dni": dni, "nombre": _nombre(row),
                "escuela": row.get("escuela_profesional", ""),
                "detalle": "En el padrón pero sin hoja de identificación",
            })
            continue

        escuela_id = int(row["escuela_id"])
        key = resolve_key(escuela_id, key_answers, section_parents)
        if key is None:
            rep.incidencias.append({
                "tipo": "SIN_CLAVE", "dni": dni, "nombre": _nombre(row),
                "escuela": row.get("escuela_profesional", ""),
                "detalle": f"No hay clave para la escuela {escuela_id} ni escuela matriz",
            })
            continue

        g = grade_answers(responses.get(litho, ""), key)
        rep.resultados.append({
            "n": row.get("n", ""),
            "salon": row.get("salon", ""),
            "dni": dni,
            "nombre": _nombre(row),
            "escuela_id": escuela_id,
            "escuela": escuelas.get(escuela_id, row.get("escuela_profesional", "")),
            "facultad": row.get("facultad", ""),
            "facultad_sigla": row.get("facultad_sigla", ""),
            "plaza": row.get("plaza", ""),
            "plaza_adicional": row.get("plaza_adicional", ""),
            "litho": litho,
            "correctas": g["correctas"],
            "incorrectas": g["incorrectas"],
            "blancos": g["blancos"],
            "anuladas": g["anuladas"],
            "preguntas": g["preguntas"],
            "aciertos": g["aciertos"],
            "puntaje30": g["aciertos"],
            "puntaje20": score_20(g["aciertos"], g["preguntas"]),
            "condicion": condicion(g["aciertos"], umbral),
        })

    for litho in blank_lithos:
        rep.incidencias.append({
            "tipo": "SIN_IDENTIFICAR", "litho": litho,
            "detalle": "Hoja con respuestas pero sin DNI marcado; no calificable",
        })

    for litho, dni in identifiers.items():
        if dni.zfill(8) not in roster_dnis:
            rep.incidencias.append({
                "tipo": "DNI_FUERA_DE_PADRON", "litho": litho, "dni": dni,
                "detalle": "DNI de la hoja no está en el padrón",
            })

    # por escuela; dentro de cada una, mayor puntaje primero (desempate: apellido)
    rep.resultados.sort(key=lambda r: (r["escuela_id"], -r["aciertos"], r["nombre"]))

    por_escuela: dict[int, dict] = {}
    for r in rep.resultados:
        e = por_escuela.setdefault(r["escuela_id"], {
            "escuela_id": r["escuela_id"], "escuela": r["escuela"],
            "postulantes": 0, "aptos": 0, "no_aptos": 0,
        })
        e["postulantes"] += 1
        if r["condicion"] == "APTO":
            e["aptos"] += 1
        else:
            e["no_aptos"] += 1
    rep.resumen = [por_escuela[k] for k in sorted(por_escuela)]

    return rep
