import re

VUE_FILE = r"D:\aplications\admision\calificadordad\frontend\src\components\views\ActasPjView.vue"

with open(VUE_FILE, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update digitalFilesTable so ONLY the official Excel padrón is included (no RAR, no DATs)
old_digital_table = """const digitalFilesTable = computed(() => {
  const list = [
    {
      correlativo: '01',
      categoria: 'CONTENEDOR OFICIAL (.RAR)',
      nombre: rarFileName.value,
      registros: 'Paquete Comprimido Oficial',
      tamano: formatBytes(rarFileSize.value),
      sha256: rarFileSha256.value,
      sha256Blocks: formatHashBlocks(rarFileSha256.value, 8),
    },
    {
      correlativo: '02',
      categoria: 'PADRÓN OFICIAL (.XLSX)',
      nombre: padFileName.value,
      registros: `${totalPadronCount.value.toLocaleString('es-PE')} postulantes (${totalExamCodesCount.value} exámenes / ${totalPuestosCount.value} puestos)`,
      tamano: formatBytes(padFileSize.value),
      sha256: padFileSha256.value,
      sha256Blocks: formatHashBlocks(padFileSha256.value, 8),
    },
  ]"""

new_digital_table = """const digitalFilesTable = computed(() => {
  const list = [
    {
      correlativo: '01',
      categoria: 'PADRÓN OFICIAL (Microsoft Excel .xlsx)',
      nombre: padFileName.value || 'PLANTILLA_PARTICIPANTES_001-2026-UE-PUNO.xlsx',
      registros: `${totalPadronCount.value.toLocaleString('es-PE')} postulantes convocados (${totalExamCodesCount.value} exámenes / ${totalPuestosCount.value} puestos)`,
      tamano: formatBytes(padFileSize.value || 127777),
      sha256: padFileSha256.value,
      sha256Blocks: formatHashBlocks(padFileSha256.value, 8),
    },
  ]
  return list
})

const _unused_digitalFilesTable = computed(() => {
  const list = []"""

assert old_digital_table in content, "old_digital_table not found"
content = content.replace(old_digital_table, new_digital_table)

# 2. Update config tab card title from RAR to Excel
content = content.replace(
"""          <div class="actas-config-card actas-config-card--hash">
            <h3>Verificación SHA-256 de Contenedor (.rar / .zip)</h3>
            <p class="actas-config-hint">
              Selecciona <code>calificacionPoderJudicial.rar</code> para calcular su huella SHA-256 en el navegador e inyectarla en el Acta 02.
            </p>""",
"""          <div class="actas-config-card actas-config-card--hash">
            <h3>Verificación SHA-256 de Padrón Oficial (.xlsx)</h3>
            <p class="actas-config-hint">
              Selecciona <code>PLANTILLA_PARTICIPANTES_001-2026-UE-PUNO.xlsx</code> para verificar o calcular su huella SHA-256 en el navegador e inyectarla en el Acta 02.
            </p>"""
)

# 3. In doc-05 (Informe Técnico): remove Ganadores / Vacante column from Table 1
old_doc05_t1 = """              <tr>
                <th>Postulantes en Padrón</th>
                <th>Fichas ID Leídas</th>
                <th>Fichas RESP Leídas</th>
                <th>Calificados Válidos</th>
                <th>Ausentes / Sin Resp.</th>
                <th>Anulados Comisión</th>
                <th>Ganadores / Vacante</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="text-center font-mono font-bold">{{ globalTotals.padron }}</td>
                <td class="text-center font-mono">{{ opticalAuditReport.idTotal }}</td>
                <td class="text-center font-mono">{{ opticalAuditReport.respTotal }}</td>
                <td class="text-center font-mono font-bold" style="color: #0369a1">{{ globalTotals.calificados }}</td>
                <td class="text-center font-mono">{{ globalTotals.ausentes }}</td>
                <td class="text-center font-mono" style="color: #b91c1c">{{ globalTotals.anuladosCount }}</td>
                <td class="text-center font-mono font-bold" style="color: #15803d">{{ globalTotals.ganadores }}</td>
              </tr>"""

new_doc05_t1 = """              <tr>
                <th>Postulantes en Padrón</th>
                <th>Fichas ID Leídas</th>
                <th>Fichas RESP Leídas</th>
                <th>Calificados Válidos</th>
                <th>Ausentes / Sin Resp.</th>
                <th>Anulados Comisión</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="text-center font-mono font-bold">{{ globalTotals.padron }}</td>
                <td class="text-center font-mono">{{ opticalAuditReport.idTotal }}</td>
                <td class="text-center font-mono">{{ opticalAuditReport.respTotal }}</td>
                <td class="text-center font-mono font-bold" style="color: #0369a1">{{ globalTotals.calificados }}</td>
                <td class="text-center font-mono">{{ globalTotals.ausentes }}</td>
                <td class="text-center font-mono" style="color: #b91c1c">{{ globalTotals.anuladosCount }}</td>
              </tr>"""

assert old_doc05_t1 in content, "old_doc05_t1 not found"
content = content.replace(old_doc05_t1, new_doc05_t1)

# In doc-05: remove Ganadores column from Table 2 (Estadísticas por Código de Examen)
old_doc05_t2_header = """              <tr>
                <th>COD_EXAMEN</th>
                <th>Inscritos Padrón</th>
                <th>Calificados</th>
                <th>Ausentes</th>
                <th>Ganadores</th>
                <th>Empates</th>
                <th>Puntaje Máx</th>
                <th>Puntaje Mín</th>
                <th>Promedio</th>
              </tr>"""

new_doc05_t2_header = """              <tr>
                <th>COD_EXAMEN</th>
                <th>Inscritos Padrón</th>
                <th>Calificados</th>
                <th>Ausentes</th>
                <th>Empates</th>
                <th>Puntaje Máx</th>
                <th>Puntaje Mín</th>
                <th>Promedio</th>
              </tr>"""

assert old_doc05_t2_header in content, "old_doc05_t2_header not found"
content = content.replace(old_doc05_t2_header, new_doc05_t2_header)

old_doc05_t2_row = """                <td class="text-center font-mono font-bold">{{ exRow.calificadosCount }}</td>
                <td class="text-center font-mono">{{ exRow.ausentesCount }}</td>
                <td class="text-center font-mono" style="color: #15803d">{{ exRow.ganadoresCount }}</td>
                <td class="text-center font-mono">{{ exRow.empatesCount }}</td>"""

new_doc05_t2_row = """                <td class="text-center font-mono font-bold">{{ exRow.calificadosCount }}</td>
                <td class="text-center font-mono">{{ exRow.ausentesCount }}</td>
                <td class="text-center font-mono">{{ exRow.empatesCount }}</td>"""

assert old_doc05_t2_row in content, "old_doc05_t2_row not found"
content = content.replace(old_doc05_t2_row, new_doc05_t2_row)

# 4. In doc-06 (Acta de Cierre): remove Ganadores / Aptos column
old_doc06_t = """              <tr>
                <th>Inscritos en Padrón</th>
                <th>Postulantes Calificados</th>
                <th>Ganadores / Aptos</th>
                <th>Postulantes Ausentes</th>
                <th>Anulados por Comisión</th>
                <th>Puestos / Exámenes</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="text-center font-mono font-bold" style="font-size: 9.5pt">
                  {{ globalTotals.padron.toLocaleString('es-PE') }}
                </td>
                <td class="text-center font-mono font-bold" style="font-size: 9.5pt; color: #0369a1">
                  {{ globalTotals.calificados.toLocaleString('es-PE') }}
                </td>
                <td class="text-center font-mono font-bold" style="font-size: 9.5pt; color: #15803d">
                  {{ globalTotals.ganadores }} / {{ globalTotals.aptos }}
                </td>"""

new_doc06_t = """              <tr>
                <th>Inscritos en Padrón</th>
                <th>Fichas Evaluadas</th>
                <th>Postulantes Calificados</th>
                <th>Postulantes Ausentes</th>
                <th>Anulados por Comisión</th>
                <th>Exámenes / Puestos</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="text-center font-mono font-bold" style="font-size: 9.5pt">
                  {{ globalTotals.padron.toLocaleString('es-PE') }}
                </td>
                <td class="text-center font-mono font-bold" style="font-size: 9.5pt; color: #0f766e">
                  {{ (opticalAuditReport.respTotal || globalTotals.calificados).toLocaleString('es-PE') }}
                </td>
                <td class="text-center font-mono font-bold" style="font-size: 9.5pt; color: #0369a1">
                  {{ globalTotals.calificados.toLocaleString('es-PE') }}
                </td>"""

assert old_doc06_t in content, "old_doc06_t not found"
content = content.replace(old_doc06_t, new_doc06_t)

# 5. Increase vertical space for all titles in scoped CSS and print CSS
content = content.replace(
""".titulo-documento-box {
  text-align: center;
  margin: 10px 0;
}

.titulo-documento {
  font-size: 11pt;
  font-weight: 900;
  color: #0a2446;
  text-transform: uppercase;
}""",
""".titulo-documento-box {
  text-align: center;
  margin: 22px 0 16px 0;
  padding: 4px 0;
}

.titulo-documento {
  font-size: 13pt;
  font-weight: 900;
  color: #0a2446;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  line-height: 1.35;
  margin-bottom: 6px;
}"""
)

# In printElementCleanly injected CSS:
content = content.replace(
"""        .titulo-documento-box {
          text-align: center;
          margin: 6px 0 4px 0;
        }
        .titulo-documento {
          font-size: 10pt;
          font-weight: 900;
          color: #0a2446;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }""",
"""        .titulo-documento-box {
          text-align: center;
          margin: 18px 0 14px 0;
          padding: 2px 0;
        }
        .titulo-documento {
          font-size: 12pt;
          font-weight: 900;
          color: #0a2446;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          line-height: 1.3;
          margin-bottom: 5px;
        }"""
)

with open(VUE_FILE, "w", encoding="utf-8") as f:
    f.write(content)

print("Updated ActasPjView.vue successfully!")
