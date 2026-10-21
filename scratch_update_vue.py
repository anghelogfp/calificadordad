import re

VUE_FILE = r"D:\aplications\admision\calificadordad\frontend\src\components\views\ActasPjView.vue"

with open(VUE_FILE, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update codigoActa in defaultActaConfig
content = content.replace(
"""  codigoActa03A: 'DOC-03-A-RECEPCION-TURNO-1',
  codigoActa03B: 'DOC-03-B-RECEPCION-TURNO-2',
  codigoActa03C: 'DOC-03-C-LECTURA-ERRORES',""",
"""  codigoActa03A: 'ANEXO-01-A-ID-TURNO-1',
  codigoActa03B: 'ANEXO-01-B-ID-TURNO-2',
  codigoActa03C: 'ANEXO-02-A-RESP-TURNO-1',
  codigoActa03D: 'ANEXO-02-B-RESP-TURNO-2',
  codigoActa03E: 'DOC-03-E-LECTURA-ERRORES',"""
)

# 2. Update DOCUMENTS_TABS
old_tabs = """const DOCUMENTS_TABS = [
  { key: 'doc-01', code: '01', title: 'Acta de Inicio y Apertura', short: '01. Apertura' },
  { key: 'doc-02', code: '02', title: 'Acta de Recepción Digital (SHA-256)', short: '02. Recepción Digital' },
  { key: 'doc-03', code: '03', title: 'Acta de Recepción Física de Fichas Ópticas', short: '03. Recepción Física' },
  { key: 'doc-03a', code: '03-A', title: 'Anexo 01: Fichas de Identificación (ID) — 2 Turnos', short: '03-A. Fichas ID' },
  { key: 'doc-03b', code: '03-B', title: 'Anexo 02: Fichas de Respuestas (RESP) — 2 Turnos', short: '03-B. Fichas Resp.' },
  { key: 'doc-03c', code: '03-C', title: 'Reporte de Lectura Óptica y Errores', short: '03-C. Lectura y Errores' },
  { key: 'doc-04', code: '04', title: 'Conformidad de Claves, Excepciones y 5 Pruebas', short: '04. Claves y Pruebas' },
  { key: 'doc-05', code: '05', title: 'Informe Técnico de Validación y Calificación', short: '05. Informe Técnico' },
  { key: 'doc-06', code: '06', title: 'Acta de Cierre y Conformidad Final', short: '06. Acta de Cierre' },
]"""

new_tabs = """const DOCUMENTS_TABS = [
  { key: 'doc-01', code: '01', title: 'Acta de Inicio y Apertura', short: '01. Apertura' },
  { key: 'doc-02', code: '02', title: 'Acta de Recepción Digital (SHA-256)', short: '02. Recepción Digital' },
  { key: 'doc-03', code: '03', title: 'Acta de Recepción Física de Fichas Ópticas', short: '03. Recepción Física' },
  { key: 'doc-03a', code: '03-A', title: 'Anexo 01-A: Identificación (ID) — Turno 1 (Grupo 1)', short: '03-A. ID Turno 1' },
  { key: 'doc-03b', code: '03-B', title: 'Anexo 01-B: Identificación (ID) — Turno 2 (Grupo 2)', short: '03-B. ID Turno 2' },
  { key: 'doc-03c', code: '03-C', title: 'Anexo 02-A: Respuestas (RESP) — Turno 1 (Grupo 1)', short: '03-C. Resp Turno 1' },
  { key: 'doc-03d', code: '03-D', title: 'Anexo 02-B: Respuestas (RESP) — Turno 2 (Grupo 2)', short: '03-D. Resp Turno 2' },
  { key: 'doc-03e', code: '03-E', title: 'Reporte de Lectura Óptica y Errores', short: '03-E. Lectura y Errores' },
  { key: 'doc-04', code: '04', title: 'Conformidad de Claves, Excepciones y 5 Pruebas', short: '04. Claves y Pruebas' },
  { key: 'doc-05', code: '05', title: 'Informe Técnico de Validación y Calificación', short: '05. Informe Técnico' },
  { key: 'doc-06', code: '06', title: 'Acta de Cierre y Conformidad Final', short: '06. Acta de Cierre' },
]"""

assert old_tabs in content, "old_tabs not found in ActasPjView.vue"
content = content.replace(old_tabs, new_tabs)

# 3. Build replacement for templates doc-03a and doc-03b (ending right before doc-03c)
pattern = re.compile(
    r'(<!-- ─+\s+DOC 03-A: ANEXO 01:.*?)(<!-- ─+\s+DOC 03-C: REPORTE DE LECTURA ÓPTICA)',
    re.DOTALL
)

m = pattern.search(content)
assert m, "doc-03a/03b pattern not found in ActasPjView.vue"

new_articles = """<!-- ─────────────────────────────────────────────────────────────────────
           DOC 03-A: ANEXO 01-A: RECEPCIÓN DE FICHAS DE IDENTIFICACIÓN (ID) — TURNO 1
           ───────────────────────────────────────────────────────────────────── -->
      <article
        v-if="isDocVisible('doc-03a')"
        class="hoja-a4"
        :class="{ 'salto-pagina': printAllMode }"
        data-doc="doc-03a"
      >
        <header class="encabezado-institucional">
          <img src="/unap.png" alt="UNA-PUNO" class="logo-entidad" />
          <div class="texto-encabezado">
            <div class="universidad">Universidad Nacional del Altiplano de Puno</div>
            <div class="area-rectora">Dirección de Admisión — Centro de Cómputo y Calificación</div>
            <div class="subtitulo-convenio">
              {{ actaConfig.procesoNombre }}
            </div>
          </div>
          <img src="/logo-pj.jpg" alt="Poder Judicial - CSJ Puno" class="logo-entidad logo-entidad--pj" />
        </header>

        <div class="titulo-documento-box">
          <h2 class="titulo-documento" style="font-size: 10pt;">ANEXO 01-A: RECEPCIÓN Y VERIFICACIÓN DE FICHAS DE IDENTIFICACIÓN (ID) — TURNO 1 (GRUPO 1)</h2>
          <div class="meta-documento">
            <span>CONTROL DE IDENTIFICACIÓN (ID) — TURNO 1 (25 AULAS)</span>
            <span>FECHA: {{ actaConfig.fecha }}</span>
            <span>PADRÓN PROGRAMADO: {{ receptionTwoBlocks.grupo1.totalCantidad.toLocaleString('es-PE') }} POSTULANTES</span>
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
            <tr v-for="(item, idx) in receptionTwoBlocks.grupo1.aulas" :key="`t1-id-${item.aula}`">
              <td class="text-center font-bold font-mono">{{ String(idx + 1).padStart(2, '0') }}</td>
              <td><strong>Aula {{ item.aulaShort }}</strong></td>
              <td class="text-center font-mono font-bold">{{ item.cantidad }}</td>
              <td class="text-center casilla-conteo-id font-mono font-bold">
                <span v-if="showOpticalCountsIn03A && item.idRead !== null">✓ [{{ item.idRead }}]</span>
                <span v-else>✓ [{{ item.cantidad }}]</span>
              </td>
              <td class="text-center font-mono font-bold" style="color: #0369a1;">
                {{ item.idRead !== null ? item.idRead : item.cantidad }}
              </td>
              <td class="text-center font-mono" :class="{ 'font-bold text-red': item.idRead !== null && (item.cantidad - item.idRead) > 0 }">
                {{ item.idRead !== null ? Math.max(0, item.cantidad - item.idRead) : 0 }}
              </td>
              <td class="text-center"><span class="badge-id">✓ ID RECIBIDO</span></td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="fila-total-turno">
              <td colspan="2" class="text-center font-bold">TOTAL TURNO 1</td>
              <td class="text-center font-mono font-bold">{{ receptionTwoBlocks.grupo1.totalCantidad }}</td>
              <td class="text-center casilla-conteo-id font-mono font-bold">✓ [{{ receptionTwoBlocks.grupo1.totalId !== null ? receptionTwoBlocks.grupo1.totalId : receptionTwoBlocks.grupo1.totalCantidad }}]</td>
              <td class="text-center font-mono font-bold" style="color: #0369a1;">{{ receptionTwoBlocks.grupo1.totalId !== null ? receptionTwoBlocks.grupo1.totalId : receptionTwoBlocks.grupo1.totalCantidad }}</td>
              <td class="text-center font-mono font-bold">{{ receptionTwoBlocks.grupo1.totalId !== null ? Math.max(0, receptionTwoBlocks.grupo1.totalCantidad - receptionTwoBlocks.grupo1.totalId) : 0 }}</td>
              <td class="text-center font-bold" style="color: #15803d;">CONFORME</td>
            </tr>
          </tfoot>
        </table>

        <div class="banner-turno-meta">
          <span>RESUMEN TURNO 1 (GRUPO 1): 25 AULAS PROCESADAS</span>
          <span class="font-mono">
            PROGRAMADOS: {{ receptionTwoBlocks.grupo1.totalCantidad }} &nbsp;|&nbsp;
            FICHAS ID LEÍDAS: {{ receptionTwoBlocks.grupo1.totalId !== null ? receptionTwoBlocks.grupo1.totalId : receptionTwoBlocks.grupo1.totalCantidad }} &nbsp;|&nbsp;
            AUSENTES: {{ receptionTwoBlocks.grupo1.totalId !== null ? Math.max(0, receptionTwoBlocks.grupo1.totalCantidad - receptionTwoBlocks.grupo1.totalId) : 0 }} &nbsp;|&nbsp;
            CONFORMIDAD: 100%
          </span>
        </div>

        <div class="bloque-firmas" style="margin-top: 10px;">
          <div class="cuadro-firma">
            <div class="espacio-sello-firma" style="height: 32px;"></div>
            <div class="linea-firma">
              <div class="nombre">{{ actaConfig.firmanteUnap.nombre }}</div>
              <div class="cargo">Director de Admisión — UNA-PUNO (DNI {{ actaConfig.firmanteUnap.dni }})</div>
            </div>
          </div>
          <div class="cuadro-firma">
            <div class="espacio-sello-firma" style="height: 32px;"></div>
            <div class="linea-firma">
              <div class="nombre">{{ actaConfig.firmantePj.nombre }}</div>
              <div class="cargo">Coordinador de Seguridad Integral — CSJ Puno (DNI {{ actaConfig.firmantePj.dni }})</div>
            </div>
          </div>
        </div>

        <footer class="pie-pagina">
          <span>Sistema de Calificación Óptica — Dirección de Admisión UNA-PUNO</span>
          <span>ANEXO 01-A — IDENTIFICACIÓN (ID) — TURNO 1 (GRUPO 1)</span>
          <span>Fecha: {{ actaConfig.fecha }}</span>
        </footer>
      </article>

      <!-- ─────────────────────────────────────────────────────────────────────
           DOC 03-B: ANEXO 01-B: RECEPCIÓN DE FICHAS DE IDENTIFICACIÓN (ID) — TURNO 2
           ───────────────────────────────────────────────────────────────────── -->
      <article
        v-if="isDocVisible('doc-03b')"
        class="hoja-a4"
        :class="{ 'salto-pagina': printAllMode }"
        data-doc="doc-03b"
      >
        <header class="encabezado-institucional">
          <img src="/unap.png" alt="UNA-PUNO" class="logo-entidad" />
          <div class="texto-encabezado">
            <div class="universidad">Universidad Nacional del Altiplano de Puno</div>
            <div class="area-rectora">Dirección de Admisión — Centro de Cómputo y Calificación</div>
            <div class="subtitulo-convenio">
              {{ actaConfig.procesoNombre }}
            </div>
          </div>
          <img src="/logo-pj.jpg" alt="Poder Judicial - CSJ Puno" class="logo-entidad logo-entidad--pj" />
        </header>

        <div class="titulo-documento-box">
          <h2 class="titulo-documento" style="font-size: 10pt;">ANEXO 01-B: RECEPCIÓN Y VERIFICACIÓN DE FICHAS DE IDENTIFICACIÓN (ID) — TURNO 2 (GRUPO 2)</h2>
          <div class="meta-documento">
            <span>CONTROL DE IDENTIFICACIÓN (ID) — TURNO 2 (25 AULAS)</span>
            <span>FECHA: {{ actaConfig.fecha }}</span>
            <span>PADRÓN PROGRAMADO: {{ receptionTwoBlocks.grupo2.totalCantidad.toLocaleString('es-PE') }} POSTULANTES</span>
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
            <tr v-for="(item, idx) in receptionTwoBlocks.grupo2.aulas" :key="`t2-id-${item.aula}`">
              <td class="text-center font-bold font-mono">{{ String(idx + 1).padStart(2, '0') }}</td>
              <td><strong>Aula {{ item.aulaShort }}</strong></td>
              <td class="text-center font-mono font-bold">{{ item.cantidad }}</td>
              <td class="text-center casilla-conteo-id font-mono font-bold">
                <span v-if="showOpticalCountsIn03A && item.idRead !== null">✓ [{{ item.idRead }}]</span>
                <span v-else>✓ [{{ item.cantidad }}]</span>
              </td>
              <td class="text-center font-mono font-bold" style="color: #0369a1;">
                {{ item.idRead !== null ? item.idRead : item.cantidad }}
              </td>
              <td class="text-center font-mono" :class="{ 'font-bold text-red': item.idRead !== null && (item.cantidad - item.idRead) > 0 }">
                {{ item.idRead !== null ? Math.max(0, item.cantidad - item.idRead) : 0 }}
              </td>
              <td class="text-center"><span class="badge-id">✓ ID RECIBIDO</span></td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="fila-total-turno">
              <td colspan="2" class="text-center font-bold">TOTAL TURNO 2</td>
              <td class="text-center font-mono font-bold">{{ receptionTwoBlocks.grupo2.totalCantidad }}</td>
              <td class="text-center casilla-conteo-id font-mono font-bold">✓ [{{ receptionTwoBlocks.grupo2.totalId !== null ? receptionTwoBlocks.grupo2.totalId : receptionTwoBlocks.grupo2.totalCantidad }}]</td>
              <td class="text-center font-mono font-bold" style="color: #0369a1;">{{ receptionTwoBlocks.grupo2.totalId !== null ? receptionTwoBlocks.grupo2.totalId : receptionTwoBlocks.grupo2.totalCantidad }}</td>
              <td class="text-center font-mono font-bold">{{ receptionTwoBlocks.grupo2.totalId !== null ? Math.max(0, receptionTwoBlocks.grupo2.totalCantidad - receptionTwoBlocks.grupo2.totalId) : 0 }}</td>
              <td class="text-center font-bold" style="color: #15803d;">CONFORME</td>
            </tr>
          </tfoot>
        </table>

        <div class="banner-turno-meta">
          <span>RESUMEN TURNO 2 (GRUPO 2): 25 AULAS PROCESADAS</span>
          <span class="font-mono">
            PROGRAMADOS: {{ receptionTwoBlocks.grupo2.totalCantidad }} &nbsp;|&nbsp;
            FICHAS ID LEÍDAS: {{ receptionTwoBlocks.grupo2.totalId !== null ? receptionTwoBlocks.grupo2.totalId : receptionTwoBlocks.grupo2.totalCantidad }} &nbsp;|&nbsp;
            AUSENTES: {{ receptionTwoBlocks.grupo2.totalId !== null ? Math.max(0, receptionTwoBlocks.grupo2.totalCantidad - receptionTwoBlocks.grupo2.totalId) : 0 }} &nbsp;|&nbsp;
            CONFORMIDAD: 100%
          </span>
        </div>

        <div class="bloque-firmas" style="margin-top: 10px;">
          <div class="cuadro-firma">
            <div class="espacio-sello-firma" style="height: 32px;"></div>
            <div class="linea-firma">
              <div class="nombre">{{ actaConfig.firmanteUnap.nombre }}</div>
              <div class="cargo">Director de Admisión — UNA-PUNO (DNI {{ actaConfig.firmanteUnap.dni }})</div>
            </div>
          </div>
          <div class="cuadro-firma">
            <div class="espacio-sello-firma" style="height: 32px;"></div>
            <div class="linea-firma">
              <div class="nombre">{{ actaConfig.firmantePj.nombre }}</div>
              <div class="cargo">Coordinador de Seguridad Integral — CSJ Puno (DNI {{ actaConfig.firmantePj.dni }})</div>
            </div>
          </div>
        </div>

        <footer class="pie-pagina">
          <span>Sistema de Calificación Óptica — Dirección de Admisión UNA-PUNO</span>
          <span>ANEXO 01-B — IDENTIFICACIÓN (ID) — TURNO 2 (GRUPO 2)</span>
          <span>Fecha: {{ actaConfig.fecha }}</span>
        </footer>
      </article>

      <!-- ─────────────────────────────────────────────────────────────────────
           DOC 03-C: ANEXO 02-A: RECEPCIÓN DE FICHAS DE RESPUESTAS (RESP) — TURNO 1
           ───────────────────────────────────────────────────────────────────── -->
      <article
        v-if="isDocVisible('doc-03c')"
        class="hoja-a4"
        :class="{ 'salto-pagina': printAllMode }"
        data-doc="doc-03c"
      >
        <header class="encabezado-institucional">
          <img src="/unap.png" alt="UNA-PUNO" class="logo-entidad" />
          <div class="texto-encabezado">
            <div class="universidad">Universidad Nacional del Altiplano de Puno</div>
            <div class="area-rectora">Dirección de Admisión — Centro de Cómputo y Calificación</div>
            <div class="subtitulo-convenio">
              {{ actaConfig.procesoNombre }}
            </div>
          </div>
          <img src="/logo-pj.jpg" alt="Poder Judicial - CSJ Puno" class="logo-entidad logo-entidad--pj" />
        </header>

        <div class="titulo-documento-box">
          <h2 class="titulo-documento" style="font-size: 10pt;">ANEXO 02-A: RECEPCIÓN Y VERIFICACIÓN DE FICHAS DE RESPUESTAS (RESP) — TURNO 1 (GRUPO 1)</h2>
          <div class="meta-documento">
            <span>CONTROL DE RESPUESTAS (RESP) — TURNO 1 (25 AULAS)</span>
            <span>FECHA: {{ actaConfig.fecha }}</span>
            <span>PADRÓN PROGRAMADO: {{ receptionTwoBlocks.grupo1.totalCantidad.toLocaleString('es-PE') }} POSTULANTES</span>
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
            <tr v-for="(item, idx) in receptionTwoBlocks.grupo1.aulas" :key="`t1-resp-${item.aula}`">
              <td class="text-center font-bold font-mono">{{ String(idx + 1).padStart(2, '0') }}</td>
              <td><strong>Aula {{ item.aulaShort }}</strong></td>
              <td class="text-center font-mono font-bold">{{ item.cantidad }}</td>
              <td class="text-center casilla-conteo-resp font-mono font-bold">
                <span v-if="showOpticalCountsIn03A && item.respRead !== null">✓ [{{ item.respRead }}]</span>
                <span v-else>✓ [{{ item.cantidad }}]</span>
              </td>
              <td class="text-center font-mono font-bold" style="color: #0f766e;">
                {{ item.respRead !== null ? item.respRead : item.cantidad }}
              </td>
              <td class="text-center font-mono" :class="{ 'font-bold text-red': item.respRead !== null && (item.cantidad - item.respRead) > 0 }">
                {{ item.respRead !== null ? Math.max(0, item.cantidad - item.respRead) : 0 }}
              </td>
              <td class="text-center"><span class="badge-resp">✓ RESP RECIBIDA</span></td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="fila-total-turno">
              <td colspan="2" class="text-center font-bold">TOTAL TURNO 1</td>
              <td class="text-center font-mono font-bold">{{ receptionTwoBlocks.grupo1.totalCantidad }}</td>
              <td class="text-center casilla-conteo-resp font-mono font-bold">✓ [{{ receptionTwoBlocks.grupo1.totalResp !== null ? receptionTwoBlocks.grupo1.totalResp : receptionTwoBlocks.grupo1.totalCantidad }}]</td>
              <td class="text-center font-mono font-bold" style="color: #0f766e;">{{ receptionTwoBlocks.grupo1.totalResp !== null ? receptionTwoBlocks.grupo1.totalResp : receptionTwoBlocks.grupo1.totalCantidad }}</td>
              <td class="text-center font-mono font-bold">{{ receptionTwoBlocks.grupo1.totalResp !== null ? Math.max(0, receptionTwoBlocks.grupo1.totalCantidad - receptionTwoBlocks.grupo1.totalResp) : 0 }}</td>
              <td class="text-center font-bold" style="color: #15803d;">CONFORME</td>
            </tr>
          </tfoot>
        </table>

        <div class="banner-turno-meta">
          <span>RESUMEN TURNO 1 (GRUPO 1): 25 AULAS PROCESADAS</span>
          <span class="font-mono">
            PROGRAMADOS: {{ receptionTwoBlocks.grupo1.totalCantidad }} &nbsp;|&nbsp;
            FICHAS RESP LEÍDAS: {{ receptionTwoBlocks.grupo1.totalResp !== null ? receptionTwoBlocks.grupo1.totalResp : receptionTwoBlocks.grupo1.totalCantidad }} &nbsp;|&nbsp;
            AUSENTES: {{ receptionTwoBlocks.grupo1.totalResp !== null ? Math.max(0, receptionTwoBlocks.grupo1.totalCantidad - receptionTwoBlocks.grupo1.totalResp) : 0 }} &nbsp;|&nbsp;
            CONFORMIDAD: 100%
          </span>
        </div>

        <div class="bloque-firmas" style="margin-top: 10px;">
          <div class="cuadro-firma">
            <div class="espacio-sello-firma" style="height: 32px;"></div>
            <div class="linea-firma">
              <div class="nombre">{{ actaConfig.firmanteUnap.nombre }}</div>
              <div class="cargo">Director de Admisión — UNA-PUNO (DNI {{ actaConfig.firmanteUnap.dni }})</div>
            </div>
          </div>
          <div class="cuadro-firma">
            <div class="espacio-sello-firma" style="height: 32px;"></div>
            <div class="linea-firma">
              <div class="nombre">{{ actaConfig.firmantePj.nombre }}</div>
              <div class="cargo">Coordinador de Seguridad Integral — CSJ Puno (DNI {{ actaConfig.firmantePj.dni }})</div>
            </div>
          </div>
        </div>

        <footer class="pie-pagina">
          <span>Sistema de Calificación Óptica — Dirección de Admisión UNA-PUNO</span>
          <span>ANEXO 02-A — RESPUESTAS (RESP) — TURNO 1 (GRUPO 1)</span>
          <span>Fecha: {{ actaConfig.fecha }}</span>
        </footer>
      </article>

      <!-- ─────────────────────────────────────────────────────────────────────
           DOC 03-D: ANEXO 02-B: RECEPCIÓN DE FICHAS DE RESPUESTAS (RESP) — TURNO 2
           ───────────────────────────────────────────────────────────────────── -->
      <article
        v-if="isDocVisible('doc-03d')"
        class="hoja-a4"
        :class="{ 'salto-pagina': printAllMode }"
        data-doc="doc-03d"
      >
        <header class="encabezado-institucional">
          <img src="/unap.png" alt="UNA-PUNO" class="logo-entidad" />
          <div class="texto-encabezado">
            <div class="universidad">Universidad Nacional del Altiplano de Puno</div>
            <div class="area-rectora">Dirección de Admisión — Centro de Cómputo y Calificación</div>
            <div class="subtitulo-convenio">
              {{ actaConfig.procesoNombre }}
            </div>
          </div>
          <img src="/logo-pj.jpg" alt="Poder Judicial - CSJ Puno" class="logo-entidad logo-entidad--pj" />
        </header>

        <div class="titulo-documento-box">
          <h2 class="titulo-documento" style="font-size: 10pt;">ANEXO 02-B: RECEPCIÓN Y VERIFICACIÓN DE FICHAS DE RESPUESTAS (RESP) — TURNO 2 (GRUPO 2)</h2>
          <div class="meta-documento">
            <span>CONTROL DE RESPUESTAS (RESP) — TURNO 2 (25 AULAS)</span>
            <span>FECHA: {{ actaConfig.fecha }}</span>
            <span>PADRÓN PROGRAMADO: {{ receptionTwoBlocks.grupo2.totalCantidad.toLocaleString('es-PE') }} POSTULANTES</span>
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
            <tr v-for="(item, idx) in receptionTwoBlocks.grupo2.aulas" :key="`t2-resp-${item.aula}`">
              <td class="text-center font-bold font-mono">{{ String(idx + 1).padStart(2, '0') }}</td>
              <td><strong>Aula {{ item.aulaShort }}</strong></td>
              <td class="text-center font-mono font-bold">{{ item.cantidad }}</td>
              <td class="text-center casilla-conteo-resp font-mono font-bold">
                <span v-if="showOpticalCountsIn03A && item.respRead !== null">✓ [{{ item.respRead }}]</span>
                <span v-else>✓ [{{ item.cantidad }}]</span>
              </td>
              <td class="text-center font-mono font-bold" style="color: #0f766e;">
                {{ item.respRead !== null ? item.respRead : item.cantidad }}
              </td>
              <td class="text-center font-mono" :class="{ 'font-bold text-red': item.respRead !== null && (item.cantidad - item.respRead) > 0 }">
                {{ item.respRead !== null ? Math.max(0, item.cantidad - item.respRead) : 0 }}
              </td>
              <td class="text-center"><span class="badge-resp">✓ RESP RECIBIDA</span></td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="fila-total-turno">
              <td colspan="2" class="text-center font-bold">TOTAL TURNO 2</td>
              <td class="text-center font-mono font-bold">{{ receptionTwoBlocks.grupo2.totalCantidad }}</td>
              <td class="text-center casilla-conteo-resp font-mono font-bold">✓ [{{ receptionTwoBlocks.grupo2.totalResp !== null ? receptionTwoBlocks.grupo2.totalResp : receptionTwoBlocks.grupo2.totalCantidad }}]</td>
              <td class="text-center font-mono font-bold" style="color: #0f766e;">{{ receptionTwoBlocks.grupo2.totalResp !== null ? receptionTwoBlocks.grupo2.totalResp : receptionTwoBlocks.grupo2.totalCantidad }}</td>
              <td class="text-center font-mono font-bold">{{ receptionTwoBlocks.grupo2.totalResp !== null ? Math.max(0, receptionTwoBlocks.grupo2.totalCantidad - receptionTwoBlocks.grupo2.totalResp) : 0 }}</td>
              <td class="text-center font-bold" style="color: #15803d;">CONFORME</td>
            </tr>
          </tfoot>
        </table>

        <div class="banner-turno-meta">
          <span>RESUMEN TURNO 2 (GRUPO 2): 25 AULAS PROCESADAS</span>
          <span class="font-mono">
            PROGRAMADOS: {{ receptionTwoBlocks.grupo2.totalCantidad }} &nbsp;|&nbsp;
            FICHAS RESP LEÍDAS: {{ receptionTwoBlocks.grupo2.totalResp !== null ? receptionTwoBlocks.grupo2.totalResp : receptionTwoBlocks.grupo2.totalCantidad }} &nbsp;|&nbsp;
            AUSENTES: {{ receptionTwoBlocks.grupo2.totalResp !== null ? Math.max(0, receptionTwoBlocks.grupo2.totalCantidad - receptionTwoBlocks.grupo2.totalResp) : 0 }} &nbsp;|&nbsp;
            CONFORMIDAD: 100%
          </span>
        </div>

        <div class="bloque-firmas" style="margin-top: 10px;">
          <div class="cuadro-firma">
            <div class="espacio-sello-firma" style="height: 32px;"></div>
            <div class="linea-firma">
              <div class="nombre">{{ actaConfig.firmanteUnap.nombre }}</div>
              <div class="cargo">Director de Admisión — UNA-PUNO (DNI {{ actaConfig.firmanteUnap.dni }})</div>
            </div>
          </div>
          <div class="cuadro-firma">
            <div class="espacio-sello-firma" style="height: 32px;"></div>
            <div class="linea-firma">
              <div class="nombre">{{ actaConfig.firmantePj.nombre }}</div>
              <div class="cargo">Coordinador de Seguridad Integral — CSJ Puno (DNI {{ actaConfig.firmantePj.dni }})</div>
            </div>
          </div>
        </div>

        <footer class="pie-pagina">
          <span>Sistema de Calificación Óptica — Dirección de Admisión UNA-PUNO</span>
          <span>ANEXO 02-B — RESPUESTAS (RESP) — TURNO 2 (GRUPO 2)</span>
          <span>Fecha: {{ actaConfig.fecha }}</span>
        </footer>
      </article>

      """

content = content[:m.start(1)] + new_articles + content[m.start(2):]

# 4. Update the doc-03c article header to doc-03e
content = content.replace("v-if=\"isDocVisible('doc-03c')\"", "v-if=\"isDocVisible('doc-03e')\"")
content = content.replace("data-doc=\"doc-03c\"", "data-doc=\"doc-03e\"")
content = content.replace("codigoActa03C", "codigoActa03E")
content = content.replace("REP-03C-LECTURA-2026", "REP-03E-LECTURA-2026")

# 5. Add tabla-control-ampliada CSS to both printElementCleanly and scoped style
ampliada_css_print = """
        .tabla-control-ampliada {
          width: 100%;
          border-collapse: collapse;
          font-size: 7.6pt;
          line-height: 1.15;
          margin-top: 4px;
          margin-bottom: 4px;
        }
        .tabla-control-ampliada th,
        .tabla-control-ampliada td {
          border: 1px solid #475569;
          padding: 1.8px 4px;
        }
        .tabla-control-ampliada th {
          font-weight: 700;
          font-size: 7.2pt;
        }
        .badge-id {
          display: inline-block;
          padding: 1px 4px;
          font-size: 6.8pt;
          font-weight: 700;
          border-radius: 2px;
          background-color: #e0f2fe;
          color: #0369a1;
          border: 1px solid #bae6fd;
        }
        .badge-resp {
          display: inline-block;
          padding: 1px 4px;
          font-size: 6.8pt;
          font-weight: 700;
          border-radius: 2px;
          background-color: #ccfbf1;
          color: #0f766e;
          border: 1px solid #99f6e4;
        }
"""

if ".tabla-control-ampliada" not in content:
    content = content.replace(
        "        .tabla-control-turno {",
        ampliada_css_print + "        .tabla-control-turno {"
    )

ampliada_css_scoped = """
.tabla-control-ampliada {
  width: 100%;
  border-collapse: collapse;
  font-size: 7.6pt;
  line-height: 1.18;
  margin-top: 4px;
  margin-bottom: 4px;
}

.tabla-control-ampliada th,
.tabla-control-ampliada td {
  border: 1px solid #cbd5e1;
  padding: 2px 4px;
}

.tabla-control-ampliada th {
  font-weight: 700;
  font-size: 7.2pt;
}

.badge-id {
  display: inline-block;
  padding: 1px 4px;
  font-size: 6.8pt;
  font-weight: 700;
  border-radius: 2px;
  background-color: #e0f2fe;
  color: #0369a1;
  border: 1px solid #bae6fd;
}

.badge-resp {
  display: inline-block;
  padding: 1px 4px;
  font-size: 6.8pt;
  font-weight: 700;
  border-radius: 2px;
  background-color: #ccfbf1;
  color: #0f766e;
  border: 1px solid #99f6e4;
}
"""

if ampliada_css_scoped.strip() not in content:
    content = content.replace(
        ".tabla-control-turno {",
        ampliada_css_scoped + "\n.tabla-control-turno {"
    )

with open(VUE_FILE, "w", encoding="utf-8") as f:
    f.write(content)

print(f"Updated {VUE_FILE} successfully!")
