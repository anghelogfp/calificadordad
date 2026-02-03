// Claves de pestañas
export const TAB_KEYS = Object.freeze({
  ARCHIVES: 'archives',
  IDENTIFIERS: 'identifiers',
  RESPONSES: 'responses',
  ANSWER_KEYS: 'answer_keys',
  SCORES: 'scores',
})

// Configuración de tabs
export const tabs = [
  { key: TAB_KEYS.ARCHIVES, label: 'Paso 1 · Padrón Excel' },
  { key: TAB_KEYS.IDENTIFIERS, label: 'Paso 2 · Identificadores (.dat)' },
  { key: TAB_KEYS.RESPONSES, label: 'Paso 3 · Respuestas (.dat)' },
  { key: TAB_KEYS.ANSWER_KEYS, label: 'Paso 4 · Claves de respuestas' },
  { key: TAB_KEYS.SCORES, label: 'Paso 5 · Calificación' },
]

// Subtabs
export const IDENTIFIER_SUBTABS = Object.freeze({
  LIST: 'list',
  SOURCES: 'sources',
})

export const RESPONSES_SUBTABS = Object.freeze({
  LIST: 'list',
  SOURCES: 'sources',
})

export const ANSWER_KEY_SUBTABS = Object.freeze({
  LIST: 'list',
  SOURCES: 'sources',
})

// Columnas para archivos (padrón)
export const ARCHIVE_COLUMNS = [
  { key: 'dni', label: 'DNI', placeholder: '01234567' },
  { key: 'paterno', label: 'Apellido paterno', placeholder: 'Pérez' },
  { key: 'materno', label: 'Apellido materno', placeholder: 'García' },
  { key: 'nombres', label: 'Nombres', placeholder: 'María Fernanda' },
  { key: 'observaciones', label: 'Observaciones', placeholder: 'Sin observaciones' },
  { key: 'area', label: 'Área', placeholder: 'Ingeniería' },
]

// Alias de claves para mapeo de columnas Excel
export const ARCHIVE_KEY_ALIASES = {
  dni: ['dni', 'documento', 'numdoc', 'número de documento'],
  paterno: ['paterno', 'apellido paterno', 'ape_pat'],
  materno: ['materno', 'apellido materno', 'ape_mat'],
  nombres: ['nombres', 'nombre', 'nombres completos'],
  observaciones: ['observaciones', 'observacione', 'obs'],
  area: ['area', 'área', 'especialidad'],
}

// Inicializar aliases completos
ARCHIVE_COLUMNS.forEach(({ key }) => {
  const aliases = ARCHIVE_KEY_ALIASES[key] || []
  ARCHIVE_KEY_ALIASES[key] = Array.from(new Set([key, ...aliases]))
})

// Columnas para respuestas
export const RESPONSES_COLUMNS = [
  { key: 'lectura', label: 'N° lectura' },
  { key: 'dni', label: 'DNI' },
  { key: 'tipo', label: 'Tip' },
  { key: 'litho', label: 'Litho' },
  { key: 'answers', label: 'Respuestas' },
  { key: 'observaciones', label: 'Observaciones' },
]

// Columnas para claves de respuestas
export const ANSWER_KEY_COLUMNS = [
  { key: 'area', label: 'Área' },
  { key: 'tipo', label: 'Tip' },
  { key: 'answers', label: 'Respuestas' },
  { key: 'observaciones', label: 'Observaciones' },
]

// Áreas disponibles
export const ANSWER_KEY_AREAS = ['Biomédicas', 'Sociales', 'Ingeniería']

// Alias de áreas para normalización
export const ANSWER_KEY_AREA_ALIASES = Object.freeze({
  biomédica: 'Biomédicas',
  biomedica: 'Biomédicas',
  biomedicas: 'Biomédicas',
  socials: 'Sociales',
  social: 'Sociales',
  sociales: 'Sociales',
  ingenieria: 'Ingeniería',
  ingenierías: 'Ingeniería',
  ingenierias: 'Ingeniería',
  ingeniero: 'Ingeniería',
  ingenieros: 'Ingeniería',
})

// Claves de almacenamiento localStorage
export const STORAGE_KEYS = Object.freeze({
  ARCHIVE: 'calificador-candidatos',
  IDENTIFIER: 'calificador-identificadores',
  RESPONSES: 'calificador-respuestas',
  ANSWER_KEYS: 'calificador-claves',
  PONDERATION: 'calificador-ponderaciones',
  SCORE_RESULTS: 'calificador-calificaciones',
  ACTIVE_TAB: 'calificador-active-tab',
  IDENTIFIER_SUBTAB: 'calificador-identificador-subtab',
  RESPONSES_SUBTAB: 'calificador-respuestas-subtab',
  ANSWER_KEY_SUBTAB: 'calificador-claves-subtab',
  IDENTIFIER_SOURCES: 'calificador-identificador-sources',
  RESPONSES_SOURCES: 'calificador-respuestas-sources',
  ANSWER_KEY_SOURCES: 'calificador-claves-sources',
})

// Ponderaciones por defecto
export const DEFAULT_PONDERATIONS = [
  { area: 'Biomédicas', subject: 'Aritmética', questionCount: 3, ponderation: 3.331, order: 1 },
  { area: 'Biomédicas', subject: 'Álgebra', questionCount: 3, ponderation: 3.202, order: 2 },
  { area: 'Biomédicas', subject: 'Geometría', questionCount: 3, ponderation: 3.301, order: 3 },
  { area: 'Biomédicas', subject: 'Trigonometría', questionCount: 3, ponderation: 3.404, order: 4 },
  { area: 'Biomédicas', subject: 'Física', questionCount: 3, ponderation: 5.505, order: 5 },
  { area: 'Biomédicas', subject: 'Química', questionCount: 5, ponderation: 6.623, order: 6 },
  { area: 'Biomédicas', subject: 'Biología y Anatomía', questionCount: 6, ponderation: 7.816, order: 7 },
  { area: 'Biomédicas', subject: 'Psicología y Filosofía', questionCount: 4, ponderation: 4.006, order: 8 },
  { area: 'Biomédicas', subject: 'Geografía', questionCount: 2, ponderation: 2.8, order: 9 },
  { area: 'Biomédicas', subject: 'Historia', questionCount: 2, ponderation: 3.302, order: 10 },
  { area: 'Biomédicas', subject: 'Educación Cívica', questionCount: 2, ponderation: 3.571, order: 11 },
  { area: 'Biomédicas', subject: 'Economía', questionCount: 2, ponderation: 3.406, order: 12 },
  { area: 'Biomédicas', subject: 'Comunicación', questionCount: 4, ponderation: 3.302, order: 13 },
  { area: 'Biomédicas', subject: 'Literatura', questionCount: 2, ponderation: 2.805, order: 14 },
  { area: 'Biomédicas', subject: 'Razonamiento Matemático', questionCount: 6, ponderation: 7.201, order: 15 },
  { area: 'Biomédicas', subject: 'Razonamiento Verbal', questionCount: 6, ponderation: 7.201, order: 16 },
  { area: 'Biomédicas', subject: 'Inglés', questionCount: 2, ponderation: 4.087, order: 17 },
  { area: 'Biomédicas', subject: 'Quechua y aimara', questionCount: 2, ponderation: 4.087, order: 18 },
  { area: 'Sociales', subject: 'Aritmética', questionCount: 3, ponderation: 3.331, order: 1 },
  { area: 'Sociales', subject: 'Álgebra', questionCount: 3, ponderation: 3.185, order: 2 },
  { area: 'Sociales', subject: 'Geometría', questionCount: 2, ponderation: 3.12, order: 3 },
  { area: 'Sociales', subject: 'Trigonometría', questionCount: 2, ponderation: 3.12, order: 4 },
  { area: 'Sociales', subject: 'Física', questionCount: 2, ponderation: 2.302, order: 5 },
  { area: 'Sociales', subject: 'Química', questionCount: 2, ponderation: 2.404, order: 6 },
  { area: 'Sociales', subject: 'Biología y Anatomía', questionCount: 2, ponderation: 2.504, order: 7 },
  { area: 'Sociales', subject: 'Psicología y Filosofía', questionCount: 4, ponderation: 4.807, order: 8 },
  { area: 'Sociales', subject: 'Geografía', questionCount: 4, ponderation: 4.907, order: 9 },
  { area: 'Sociales', subject: 'Historia', questionCount: 4, ponderation: 5.805, order: 10 },
  { area: 'Sociales', subject: 'Educación Cívica', questionCount: 4, ponderation: 6.576, order: 11 },
  { area: 'Sociales', subject: 'Economía', questionCount: 4, ponderation: 4.607, order: 12 },
  { area: 'Sociales', subject: 'Comunicación', questionCount: 4, ponderation: 6.09, order: 13 },
  { area: 'Sociales', subject: 'Literatura', questionCount: 4, ponderation: 4.3, order: 14 },
  { area: 'Sociales', subject: 'Razonamiento Matemático', questionCount: 6, ponderation: 7.203, order: 15 },
  { area: 'Sociales', subject: 'Razonamiento Verbal', questionCount: 6, ponderation: 7.603, order: 16 },
  { area: 'Sociales', subject: 'Inglés', questionCount: 2, ponderation: 4.087, order: 17 },
  { area: 'Sociales', subject: 'Quechua y aimara', questionCount: 2, ponderation: 4.087, order: 18 },
  { area: 'Ingeniería', subject: 'Aritmética', questionCount: 4, ponderation: 5.201, order: 1 },
  { area: 'Ingeniería', subject: 'Álgebra', questionCount: 4, ponderation: 5.202, order: 2 },
  { area: 'Ingeniería', subject: 'Geometría', questionCount: 4, ponderation: 5.303, order: 3 },
  { area: 'Ingeniería', subject: 'Trigonometría', questionCount: 4, ponderation: 5.404, order: 4 },
  { area: 'Ingeniería', subject: 'Física', questionCount: 4, ponderation: 5.905, order: 5 },
  { area: 'Ingeniería', subject: 'Química', questionCount: 4, ponderation: 5.406, order: 6 },
  { area: 'Ingeniería', subject: 'Biología y Anatomía', questionCount: 2, ponderation: 3.177, order: 7 },
  { area: 'Ingeniería', subject: 'Psicología y Filosofía', questionCount: 4, ponderation: 3.802, order: 8 },
  { area: 'Ingeniería', subject: 'Geografía', questionCount: 2, ponderation: 2.576, order: 9 },
  { area: 'Ingeniería', subject: 'Historia', questionCount: 2, ponderation: 3.701, order: 10 },
  { area: 'Ingeniería', subject: 'Educación Cívica', questionCount: 2, ponderation: 3.101, order: 11 },
  { area: 'Ingeniería', subject: 'Economía', questionCount: 2, ponderation: 3.502, order: 12 },
  { area: 'Ingeniería', subject: 'Comunicación', questionCount: 4, ponderation: 3.352, order: 13 },
  { area: 'Ingeniería', subject: 'Literatura', questionCount: 2, ponderation: 2.501, order: 14 },
  { area: 'Ingeniería', subject: 'Razonamiento Matemático', questionCount: 6, ponderation: 7.603, order: 15 },
  { area: 'Ingeniería', subject: 'Razonamiento Verbal', questionCount: 6, ponderation: 7.103, order: 16 },
  { area: 'Ingeniería', subject: 'Inglés', questionCount: 2, ponderation: 4.087, order: 17 },
  { area: 'Ingeniería', subject: 'Quechua y aimara', questionCount: 2, ponderation: 4.087, order: 18 },
]

// Configuración de la API
export const API_BASE_URL = 'http://localhost:8000/api'
