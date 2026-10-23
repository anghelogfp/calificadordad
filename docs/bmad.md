# BMAD

BMAD es el conjunto de agentes y flujos de trabajo (analista, PM, arquitecto, desarrollo, UX, revision de codigo, etc.) instalado en el repositorio. Esta pagina explica como esta configurado y como usarlo desde Claude Code.

## Que hay en el repositorio

| Ruta | Contenido | Se edita? |
|---|---|---|
| `.agents/skills/` | 29 skills de BMAD (agentes y flujos). Se versiona. | No: las reescribe el instalador |
| `_bmad/config.toml`, `_bmad/config.user.toml` | Respuestas de la instalacion | No: las regenera el instalador |
| `_bmad/custom/*.toml` | Ajustes del equipo (se versionan) | **Si**: el instalador nunca los toca |
| `_bmad/custom/*.user.toml` | Ajustes personales (ignorados por git) | Si |
| `_bmad/scripts/` | Resolvedores de configuracion | No |
| `AGENTS.md` | Contexto del proyecto para agentes, gestionado por la skill `bmad-project-context` | Mejor regenerarlo con la skill |
| `_bmad-output/` | Documentos que generan los flujos (planificacion, implementacion) | Salida |

## Configuracion del proyecto

- **Idioma:** `_bmad/custom/config.toml` fija `communication_language = "Spanish"` para todo el equipo (el valor base del instalador es `English`). La documentacion generada ya salia en espanol.
- **Contexto del dominio:** 18 archivos `_bmad/custom/<skill>.toml` agregan `persistent_facts` a los 5 agentes y a los flujos que escriben o revisan codigo o planifican (revision de codigo, build, spec, PRD, arquitectura, epicas, correccion de rumbo, pruebas E2E, UX, recorrido y contexto de proyecto). Las listas se **suman** a las de la skill.

Los datos que reciben:

1. Que es el proyecto y por que la correccion pesa mas que la velocidad.
2. Idioma de trabajo y de documentacion: espanol.
3. Reglas inquebrantables: el puntaje por pregunta solo con `scoreAnswerSheet.js`; ningun componente calcula puntajes; las respuestas nunca se recortan; API/BD como fuente de verdad; aislamiento por `created_by`; preflight y auditoria antes de aceptar resultados.
4. Las decisiones humanas que cambian resultados (correcciones de DNI, excepciones de pregunta) son datos auditables, no ediciones de archivos.
5. Todo cambio se documenta en `docs/changelog/` y se verifica con las pruebas.
6. `tools/concurso-catedra/` y `feat/calificacion-pj` son otros productos.
7. Carga de `docs/reglas-de-calificacion.md` y `docs/arquitectura.md`.

Para agregar mas contexto, editar la lista `persistent_facts` en el archivo de la skill correspondiente. Para otra skill, crear `_bmad/custom/<nombre-de-la-skill>.toml` con la seccion `[agent]` (agentes) o `[workflow]` (flujos).

## Verificar la configuracion

```bash
R=$(pwd)   # raiz del repositorio
uv run _bmad/scripts/resolve_config.py -p $R -k core.communication_language
uv run _bmad/scripts/resolve_customization.py --skill $R/.agents/skills/bmad-agent-dev --project-root $R --key agent.persistent_facts
```

El primero debe devolver `Spanish`; el segundo, los datos del proyecto.

## Usarlo desde Claude Code

Claude Code busca las skills del proyecto en `.claude/skills/`. Las de BMAD estan en `.agents/skills/` (para otros agentes de codigo), asi que se enlazan localmente. El enlace **no se versiona** (`.claude/skills` esta en `.gitignore`) porque los enlaces simbolicos no son fiables en todos los sistemas.

macOS / Linux, desde la raiz:

```bash
mkdir -p .claude && ln -s ../.agents/skills .claude/skills
```

Windows (CMD, no requiere permisos de administrador):

```bat
mkdir .claude
mklink /J .claude\skills .agents\skills
```

Despues, abrir una sesion nueva de Claude Code en la raiz del repositorio: las skills se listan al iniciar. Aparecen 29 skills; las que mas se usan: `bmad-help` (que hacer ahora), `bmad-agent-dev`, `bmad-agent-architect`, `bmad-code-review` y `bmad-project-context`.

Nota: cada skill listada ocupa un poco de contexto de la sesion. Si molesta, enlazar solo las que se usan (un enlace por carpeta dentro de `.claude/skills/`).

## Mantenimiento

- Para actualizar BMAD, volver a ejecutar el instalador: conserva `_bmad/custom/` y recuerda las respuestas previas. Despues de actualizar, volver a correr los comandos de verificacion.
- `AGENTS.md` lleva un sello de verificacion (fecha y commit). Esta desactualizado respecto al trabajo del 2026-10-22: no menciona `docs/reglas-de-calificacion.md` ni que el puntaje se calcula solo con `scoreAnswerSheet.js`. Se regenera ejecutando la skill `bmad-project-context`; no editarlo a mano porque es un bloque gestionado.
