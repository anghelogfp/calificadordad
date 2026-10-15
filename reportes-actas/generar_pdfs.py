import os
import subprocess
import time
from pypdf import PdfReader, PdfWriter

CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PDF_DIR = os.path.join(BASE_DIR, "pdf")

DOCS = [
    "01-acta-inicio-apertura",
    "02-acta-recepcion-digital",
    "03-acta-recepcion-fisica",
    "04-acta-conformidad-claves",
    "05-informe-tecnico",
    "06-acta-cierre"
]

os.makedirs(PDF_DIR, exist_ok=True)

print("=" * 60)
print("GENERACIÓN DE REPORTES PDF — UNA-PUNO / PODER JUDICIAL")
print("=" * 60)

for doc in DOCS:
    html_path = os.path.join(BASE_DIR, f"{doc}.html")
    pdf_path = os.path.join(PDF_DIR, f"{doc}.pdf")
    file_url = "file:///" + html_path.replace("\\", "/")
    
    cmd = [
        CHROME_PATH,
        "--headless",
        "--disable-gpu",
        "--no-pdf-header-footer",
        f"--print-to-pdf={pdf_path}",
        file_url
    ]
    
    print(f"Generando: {doc}.pdf...")
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print(f"  ERROR al generar {doc}.pdf: {res.stderr}")
    else:
        # Check pages
        reader = PdfReader(pdf_path)
        print(f"  OK: {len(reader.pages)} página(s) | {os.path.getsize(pdf_path):,} bytes")

# Consolidar en un solo documento
merged_path = os.path.join(PDF_DIR, "TODAS-LAS-ACTAS-UNAP-PJ.pdf")
writer = PdfWriter()

print("-" * 60)
print("Consolidando en documento único:")

total_pages = 0
for doc in DOCS:
    pdf_path = os.path.join(PDF_DIR, f"{doc}.pdf")
    reader = PdfReader(pdf_path)
    count = len(reader.pages)
    total_pages += count
    print(f"  + {doc}.pdf ({count} pág)")
    for page in reader.pages:
        writer.add_page(page)

with open(merged_path, "wb") as f_out:
    writer.write(f_out)

print(f"\nDocumento consolidado generado exitosamente:")
print(f"  Ruta: {merged_path}")
print(f"  Total páginas: {total_pages}")
print(f"  Tamaño: {os.path.getsize(merged_path):,} bytes")
print("=" * 60)
