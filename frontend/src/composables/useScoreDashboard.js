import { computed } from 'vue'

/**
 * Composable puramente computado para dashboard de resultados.
 * Sin API calls, sin localStorage. Solo derivaciones reactivas.
 */
export function useScoreDashboard(calificationResults, areaByName) {
  /**
   * Resultados ordenados globalmente. isIngresante y positionInPrograma
   * ya vienen calculados por useCalification — no se recalculan aquí.
   */
  const rankedResults = computed(() => {
    if (!calificationResults.value?.length) return []
    return [...calificationResults.value].sort((a, b) => b.score - a.score)
  })

  /**
   * Estadísticas por área
   */
  const statsByArea = computed(() => {
    const stats = new Map()
    if (!rankedResults.value?.length) return stats

    rankedResults.value.forEach((row) => {
      if (!stats.has(row.area)) {
        stats.set(row.area, {
          area: row.area,
          count: 0,
          ingresantes: 0,
          scores: [],
        })
      }
      const s = stats.get(row.area)
      s.count += 1
      s.scores.push(row.score)
      if (row.isIngresante) s.ingresantes += 1
    })

    stats.forEach((s) => {
      const sorted = [...s.scores].sort((a, b) => a - b)
      s.min = sorted[0] ?? 0
      s.max = sorted[sorted.length - 1] ?? 0
      s.avg = s.scores.reduce((acc, v) => acc + v, 0) / s.scores.length
      s.avg = Math.round(s.avg * 100) / 100
    })

    return stats
  })

  /**
   * Distribución de puntajes en buckets de 10 puntos
   */
  const scoreDistribution = computed(() => {
    if (!rankedResults.value?.length) return []

    const buckets = Array.from({ length: 10 }, (_, i) => ({
      range: `${i * 10}–${(i + 1) * 10}`,
      min: i * 10,
      max: (i + 1) * 10,
      count: 0,
    }))
    // Bucket extra para 100
    buckets.push({ range: '100', min: 100, max: 101, count: 0 })

    rankedResults.value.forEach((row) => {
      const bucket = buckets.find((b) => row.score >= b.min && row.score < b.max)
      if (bucket) bucket.count += 1
    })

    return buckets.filter((b) => b.count > 0)
  })

  /**
   * Resumen global
   */
  const globalSummary = computed(() => {
    if (!rankedResults.value?.length) return null
    const total = rankedResults.value.length
    const ingresantes = rankedResults.value.filter((r) => r.isIngresante).length
    const scores = rankedResults.value.map((r) => r.score)
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length
    const max = Math.max(...scores)
    const min = Math.min(...scores)
    return {
      total,
      ingresantes,
      noIngresantes: total - ingresantes,
      avg: Math.round(avg * 100) / 100,
      max,
      min,
    }
  })

  return {
    rankedResults,
    statsByArea,
    scoreDistribution,
    globalSummary,
  }
}
