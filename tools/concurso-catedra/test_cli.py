"""Test end-to-end del CLI sobre un set de datos sintético mínimo."""
import csv

import openpyxl

import calificar_catedra as cli


def _pad(prefix, litho, tail):
    """Arma una línea .dat de ancho fijo: litho en cols 41-46, payload desde 47."""
    return f"{prefix}000001001010102001   5310 #0001    N {litho}{tail}"


def _make_data(dirpath):
    key = "ABCDE" * 6  # 30, sin anuladas
    (dirpath / "escuelas.csv").write_text(
        '"id","nombre"\n"1","Ingeniería Agronómica"\n', encoding="utf-8")
    with (dirpath / "data_Catedra.csv").open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["N°", "salon", "dni", "apellido_paterno", "apellido_materno",
                    "nombres", "escuela_id", "escuela_profesional", "facultad_id",
                    "facultad", "facultad_sigla", "plaza", "plaza_adicional"])
        w.writerow(["1", "1", "1111111", "APTO", "TEST", "A", "1",
                    "Ingeniería Agronómica", "1", "FCA", "FCA", "PLA-001", "\\N"])
        w.writerow(["2", "1", "2222222", "NOAPTO", "TEST", "B", "1",
                    "Ingeniería Agronómica", "1", "FCA", "FCA", "PLA-002", "\\N"])
    (dirpath / "claveid.dat").write_text(
        _pad("227", "080001", "         001") + "\n", encoding="utf-8")
    (dirpath / "claveresp.dat").write_text(
        _pad("228", "080001", key) + "\n", encoding="utf-8")
    (dirpath / "id100.dat").write_text(
        _pad("227", "000101", " 01111111001") + "\n"
        + _pad("227", "000102", " 02222222001") + "\n", encoding="utf-8")
    (dirpath / "resp100.dat").write_text(
        _pad("228", "000101", key) + "\n"                       # 30/30 -> APTO
        + _pad("228", "000102", "ABCDE" + "X" * 25) + "\n",     # 5/30 -> NO APTO
        encoding="utf-8")


def test_cli_genera_las_tres_salidas_y_califica(tmp_path):
    data = tmp_path / "data_catedra"
    data.mkdir()
    _make_data(data)
    out = tmp_path / "salida"

    rep = cli.main(["--data", str(data), "--out", str(out), "--umbral", "16"])

    assert (out / "resultados_catedra.csv").exists()
    assert (out / "resultados_catedra.xlsx").exists()
    assert (out / "resultados_catedra.pdf").exists()

    rows = list(csv.reader((out / "resultados_catedra.csv").open(encoding="utf-8-sig")))
    por_dni = {r[2]: r for r in rows[1:]}
    cond = rows[0].index("Condición")
    assert por_dni["01111111"][cond] == "APTO"
    assert por_dni["02222222"][cond] == "NO APTO"

    wb = openpyxl.load_workbook(out / "resultados_catedra.xlsx")
    assert wb["Resumen"]["A2"].value == "Ingeniería Agronómica"
    assert wb["Resumen"]["C2"].value == 1  # 1 APTO
    assert rep.resumen[0]["no_aptos"] == 1
