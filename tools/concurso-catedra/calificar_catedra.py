"""Califica el Concurso Público de Cátedra (UNAP) a partir de la carpeta de datos.

Espera dentro de --data los 6 archivos:
    escuelas.csv  data_Catedra.csv  claveid.dat  claveresp.dat  id100.dat  resp100.dat

Genera en --out:
    resultados_catedra.csv    tabla plana de todos los calificados
    resultados_catedra.xlsx   hojas Resultados / Resumen / Incidencias
    resultados_catedra.pdf    una página por escuela profesional

Uso:
    python calificar_catedra.py --data ".../data_catedra" --out ".../salida" [--umbral 16]
"""
from __future__ import annotations

import argparse
import csv
import datetime as _dt
import sys
from pathlib import Path

import catedra_core as cc
import catedra_report as rp

TITULO = "CONCURSO PÚBLICO DE CÁTEDRA 2026-II"
SUBTITULO = "RESULTADOS DE LA PRUEBA DE CONOCIMIENTOS"
LOGO_DEFAULT = Path(__file__).resolve().parents[2] / "frontend" / "public" / "unap.png"

_ARCHIVOS = ["escuelas.csv", "data_Catedra.csv", "claveid.dat", "claveresp.dat",
             "id100.dat", "resp100.dat"]


def _leer(path: Path) -> str:
    return path.read_text(encoding="latin-1")


def _cargar_overrides(path: Path) -> dict[str, str]:
    """CSV opcional litho,dni para identificar manualmente hojas sin DNI marcado."""
    mapping: dict[str, str] = {}
    with open(path, encoding="utf-8-sig", newline="") as f:
        for row in csv.reader(f):
            if len(row) >= 2 and row[0].strip().isdigit():
                mapping[row[0].strip()] = row[1].strip().zfill(8)
    return mapping


def _safe_write(writer, path: Path, *args, **kw):
    """Escribe la salida; si el archivo está bloqueado (abierto en un visor),
    guarda una copia con sufijo y avisa, en vez de abortar todo."""
    try:
        writer(path, *args, **kw)
        return path
    except PermissionError:
        alt = path.with_name(f"{path.stem}_{_dt.datetime.now():%H%M%S}{path.suffix}")
        writer(alt, *args, **kw)
        print(f"  aviso: '{path.name}' estaba bloqueado; escribí '{alt.name}'")
        return alt


def main(argv=None):
    ap = argparse.ArgumentParser(description="Calificador del Concurso de Cátedra UNAP")
    ap.add_argument("--data", required=True, help="carpeta con los 6 archivos de entrada")
    ap.add_argument("--out", required=True, help="carpeta de salida")
    ap.add_argument("--umbral", type=int, default=16,
                    help="aciertos mínimos para APTO (def. 16 = nota 10.667 ≈ 11)")
    ap.add_argument("--overrides", help="CSV opcional litho,dni para hojas sin DNI")
    ap.add_argument("--logo", default=str(LOGO_DEFAULT),
                    help="PNG de la insignia para el encabezado del PDF")
    args = ap.parse_args(argv)

    data = Path(args.data)
    out = Path(args.out)
    faltan = [n for n in _ARCHIVOS if not (data / n).exists()]
    if faltan:
        ap.error(f"faltan archivos en {data}: {', '.join(faltan)}")
    out.mkdir(parents=True, exist_ok=True)

    escuelas = cc.load_escuelas(data / "escuelas.csv")
    roster = cc.load_roster(data / "data_Catedra.csv")
    section_parents = cc.infer_section_parents(escuelas)

    key_index = cc.parse_key_index(_leer(data / "claveid.dat"))
    key_answers = cc.parse_key_answers(_leer(data / "claveresp.dat"), key_index)

    id_text = _leer(data / "id100.dat")
    identifiers = cc.parse_identifiers(id_text)
    blank_lithos = cc.parse_blank_identifier_lithos(id_text)
    if args.overrides:
        for litho, dni in _cargar_overrides(Path(args.overrides)).items():
            identifiers[litho] = dni
            if litho in blank_lithos:
                blank_lithos.remove(litho)

    responses = cc.parse_responses(_leer(data / "resp100.dat"))

    report = cc.build_report(
        roster=roster, escuelas=escuelas, identifiers=identifiers,
        responses=responses, key_answers=key_answers,
        section_parents=section_parents, blank_lithos=blank_lithos,
        umbral=args.umbral,
    )

    _safe_write(rp.write_csv, out / "resultados_catedra.csv", report)
    _safe_write(rp.write_xlsx, out / "resultados_catedra.xlsx", report)
    _safe_write(rp.write_pdf, out / "resultados_catedra.pdf", report,
                titulo=TITULO, subtitulo=SUBTITULO, umbral=args.umbral,
                logo=args.logo)

    _resumen_consola(report, args.umbral, out)
    return report


def _resumen_consola(report, umbral, out):
    total = len(report.resultados)
    aptos = sum(1 for r in report.resultados if r["condicion"] == "APTO")
    print(f"Calificados : {total}")
    print(f"  APTO      : {aptos}")
    print(f"  NO APTO   : {total - aptos}   (umbral {umbral} aciertos)")
    print(f"Escuelas    : {len(report.resumen)}")
    if report.incidencias:
        print(f"Incidencias : {len(report.incidencias)}")
        from collections import Counter
        for tipo, n in Counter(i["tipo"] for i in report.incidencias).most_common():
            print(f"  - {tipo}: {n}")
    print(f"\nSalida en   : {out.resolve()}")


if __name__ == "__main__":
    sys.exit(0 if main() else 0)
