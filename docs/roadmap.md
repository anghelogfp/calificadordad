# Roadmap

## Prioridad 1 - Documentacion

- Consolidar documentacion vigente.
- Mover documentos historicos a `docs/historico/`.
- Mantener `README.md` como entrada corta.

## Prioridad 2 - Fuente De Verdad

- Definir formalmente DB/API como fuente principal de negocio.
- Reducir `localStorage` a UI, tokens y cache explicito.
- Documentar reglas de sincronizacion mientras exista fallback local.
- Completado inicial: se elimino la migracion automatica desde cache local hacia API cuando la API responde vacia.
- Completado fase 2: se quito la persistencia local de tablas grandes, sources, vacantes, formato DAT y configuracion de calificacion.
- Completado backup frontend: export/import ya no usa `localStorage` como respaldo de datos de negocio; backups legacy locales quedan bloqueados.

## Prioridad 3 - Backup

Estado: pendiente controlado.

Ya completado:

- Frontend exporta datos desde API/servidor.
- Frontend ya no genera backups de negocio desde `localStorage`.
- Backups legacy basados solo en `localStorage` quedan bloqueados.

Pendiente:

- Definir si el backup sera personal, institucional o ambos.
- Mover exportacion/importacion a backend de forma completa.
- Agregar validacion previa del payload.
- Agregar tests de restauracion y aislamiento.
- Evitar reemplazar datos globales compartidos salvo en modo institucional explicito.

Riesgo conocido:

- El restore backend actual puede reemplazar plantillas y formato DAT globales. No usar en datos reales sin copia previa de BD.

## Prioridad 4 - Pruebas De Flujo

- Golden tests con fixtures sinteticas.
- Fixtures reales anonimizadas.
- E2E del flujo: padron, identificadores, respuestas, claves, calificacion, historial y export.

## Prioridad 5 - Limpieza Frontend

- Extraer reconciliaciones desde `App.vue`.
- Reducir responsabilidad del orquestador principal.
- Mantener el motor de calificacion como dominio puro.
- Ya se mejoraron resultados y modal de calificacion para reducir ruido visual y reforzar estados operativos.
- Ya se alineo el camino del proceso desde la creacion hasta claves, ponderaciones, calificacion, resultados, historial y dashboard.
- Ya se implemento el stepper con estados, descripciones y acciones para los pasos 1 al 5.
- Ya se agregaron paneles de verificacion para padron, identificadores, respuestas, claves y resultados.
- Pendiente inmediato: seguir afinando el modal si la densidad visual sigue alta en uso real.

## Prioridad 6 - Modelo De Convocatoria

Decision actual:

- Mantener areas/formato/plantillas globales y tratar proceso como unidad principal.
- Se eliminaron `useConvocatoria.js` y `ConvocatoriaPanel.vue` porque apuntaban a endpoints/modelos inexistentes.

Pendiente futuro:

- Reintroducir convocatoria solo si el negocio necesita aislar areas, formato DAT, plantillas, vacantes y procesos por convocatoria formal.

## Punto De Pausa Actual

Trabajo actual:

- Camino del proceso definido al inicio: `Simulacro general`, `Simulacro por areas` o `Convocatoria real`.
- Claves, ponderaciones, modal de calificacion, resultados, historial y dashboard ya respetan ese camino.
- Stepper de pasos 1 al 5 ya muestra estados `Listo`, `Revisar` y `Pendiente`, con accion contextual.
- Paneles de verificacion ya resumen estado, observaciones y faltantes en padron, identificadores, respuestas, claves y resultados.
- Tests unitarios agregados para stepper, paneles compartidos, insignia de camino, claves, respuestas, parsers y calculo.

Siguiente paso recomendado:

1. Revisar visualmente el flujo completo con datos reales o fixtures representativas.
2. Ajustar textos y jerarquia si el negocio quiere menos densidad.
3. Crear fixtures representativas y avanzar con pruebas E2E del flujo completo.
