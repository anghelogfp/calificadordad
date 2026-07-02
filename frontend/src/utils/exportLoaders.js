export async function loadExcelDeps() {
  const { default: ExcelJS } = await import('exceljs')
  return { ExcelJS }
}

export async function loadExcelExportDeps() {
  const [{ ExcelJS }, { saveAs }] = await Promise.all([
    loadExcelDeps(),
    import('file-saver'),
  ])
  return { ExcelJS, saveAs }
}

export async function loadPdfExportDeps() {
  const [{ jsPDF, default: jsPdfDefault }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])
  return {
    jsPDF: jsPDF || jsPdfDefault,
    autoTable,
  }
}
