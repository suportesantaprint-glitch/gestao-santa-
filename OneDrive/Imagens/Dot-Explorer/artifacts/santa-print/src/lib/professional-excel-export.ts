type ReportType = "chamadas" | "pecas"
type ColumnKind = "text" | "center" | "number" | "currency" | "date" | "long"

type ColumnDefinition = {
  label: string
  candidates?: string[]
  width: number
  kind?: ColumnKind
  computed?: (row: Record<string, string>, headers: string[]) => string | number
}

type ResolvedColumn = ColumnDefinition & { source?: string }

type CellValue = {
  value: string | number
  kind: ColumnKind
}

type WorksheetDefinition = {
  name: string
  title: string
  subtitle: string
  columns: Array<{ label: string; width: number; kind: ColumnKind }>
  rows: CellValue[][]
}

const REPORT_COLUMNS: Record<ReportType, ColumnDefinition[]> = {
  chamadas: [
    { label: "OS", candidates: ["chamada_number", "codigo", "chamada", "numero_os"], width: 13, kind: "center" },
    { label: "Abertura", candidates: ["data_abertura", "emissao", "data_emissao"], width: 19, kind: "date" },
    { label: "Encerramento", candidates: ["data_encerramento", "encerramento"], width: 19, kind: "date" },
    { label: "Situação", candidates: ["situacao_zenthi", "situacao", "status"], width: 18, kind: "center" },
    { label: "Cliente", candidates: ["razao_social", "nome_cliente", "cliente_nome", "cliente", "cliente_number"], width: 34 },
    { label: "Cidade", candidates: ["cidade", "nome_cidade"], width: 22 },
    { label: "Técnico", candidates: ["email_tecnico", "nome_tecnico", "tecnico", "usuario_nome", "usuario_c"], width: 28 },
    { label: "Equipamento", candidates: ["produto_descricao", "desc_tipo_equipamento", "tipo_equipamento", "equipamento"], width: 27 },
    { label: "Marca", candidates: ["desc_marca", "marca", "marca_descricao"], width: 17 },
    { label: "Modelo", candidates: ["modelo_equipamento", "modelo_e", "modelo"], width: 19 },
    { label: "Número de série", candidates: ["numero_serie", "serie"], width: 21, kind: "center" },
    { label: "Defeito informado", candidates: ["defeito_equipamento", "defeito_eq", "defeito"], width: 42, kind: "long" },
    { label: "Serviço realizado", candidates: ["servicos_realizados", "servicos_r", "servico_realizado", "servico"], width: 46, kind: "long" },
    { label: "Observações", candidates: ["obs_servico", "observacoes", "observacao"], width: 42, kind: "long" },
    { label: "Entrada", candidates: ["tipo_entrada", "entrada"], width: 15, kind: "center" },
    { label: "Garantia", candidates: ["garantia"], width: 12, kind: "center" },
  ],
  pecas: [
    { label: "ID", candidates: ["id_sales_peca", "id", "peca_id"], width: 13, kind: "center" },
    { label: "OS", candidates: ["chamada_number", "codigo", "chamada", "numero_os"], width: 13, kind: "center" },
    { label: "Registro", candidates: ["data_abertura", "emissao", "data_registro"], width: 19, kind: "date" },
    { label: "Aplicação", candidates: ["data_encerramento", "encerramento", "data_aplicacao"], width: 19, kind: "date" },
    { label: "Produto / Peça", candidates: ["desc_produto", "produto_descricao", "descricao", "peca"], width: 42 },
    { label: "Marca", candidates: ["desc_marca", "marca", "marca_descricao"], width: 18 },
    { label: "Quantidade", candidates: ["qtdem", "quantidade", "qtd"], width: 13, kind: "number" },
    { label: "Valor unitário", candidates: ["valor_item", "valor_unitario", "valor"], width: 17, kind: "currency" },
    {
      label: "Valor total",
      width: 17,
      kind: "currency",
      computed: (row, headers) => {
        const quantityHeader = findHeader(headers, ["qtdem", "quantidade", "qtd"])
        const valueHeader = findHeader(headers, ["valor_item", "valor_unitario", "valor"])
        return parseLocalizedNumber(quantityHeader ? row[quantityHeader] : "") * parseLocalizedNumber(valueHeader ? row[valueHeader] : "")
      },
    },
    { label: "Movimentou estoque", candidates: ["movimentou_estoque", "estoque"], width: 19, kind: "center" },
    { label: "Cliente", candidates: ["razao_social", "nome_cliente", "cliente_nome", "cliente"], width: 34 },
    { label: "Técnico", candidates: ["email_tecnico", "nome_tecnico", "tecnico", "usuario_nome"], width: 28 },
    { label: "Equipamento", candidates: ["produto_equipamento", "desc_tipo_equipamento", "tipo_equipamento", "equipamento"], width: 27 },
    { label: "Modelo", candidates: ["modelo_equipamento", "modelo_e", "modelo"], width: 19 },
    { label: "Número de série", candidates: ["numero_serie", "serie"], width: 21, kind: "center" },
  ],
}

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
const MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
const REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"

export async function downloadProfessionalExcel(path: string, type: ReportType, filename: string): Promise<void> {
  const response = await window.fetch(path)
  if (!response.ok) {
    const details = await response.text()
    throw new Error(`Falha ao gerar o relatório: ${details}`)
  }

  const csv = await response.text()
  const matrix = parseDelimited(csv, ";")
  if (!matrix.length || !matrix[0]?.length) throw new Error("O relatório não retornou dados válidos")

  const headers = matrix[0].map((header) => cleanText(header))
  const records = matrix.slice(1).filter((row) => row.some((value) => cleanText(value))).map((values) => {
    const row: Record<string, string> = {}
    headers.forEach((header, index) => { row[header] = cleanText(values[index] ?? "") })
    return row
  })

  const url = new URL(path, window.location.origin)
  const period = formatPeriod(url.searchParams.get("dataInicio"), url.searchParams.get("dataFim"))
  const reportName = type === "chamadas" ? "Relatório de Chamadas de Serviço" : "Relatório de Consumo de Peças"
  const generatedAt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date())
  const subtitle = `${period} · ${records.length.toLocaleString("pt-BR")} registro(s) · Gerado em ${generatedAt}`

  const resolvedColumns = resolveColumns(headers, REPORT_COLUMNS[type])
  const mainColumns = resolvedColumns.length ? resolvedColumns : headers.slice(0, 18).map((source) => ({
    label: humanizeHeader(source), source, width: estimateWidth(source, records), kind: "text" as ColumnKind,
  }))

  const mainSheet: WorksheetDefinition = {
    name: type === "chamadas" ? "Chamadas" : "Peças",
    title: reportName,
    subtitle,
    columns: mainColumns.map((column) => ({ label: column.label, width: column.width, kind: column.kind ?? "text" })),
    rows: records.map((row) => mainColumns.map((column) => {
      const rawValue = column.computed ? column.computed(row, headers) : column.source ? row[column.source] ?? "" : ""
      return normalizeCellValue(rawValue, column.kind ?? "text")
    })),
  }

  const rawSheet: WorksheetDefinition = {
    name: "Dados completos",
    title: `${reportName} — Dados completos`,
    subtitle: "Aba técnica com todos os campos originais, preservada para auditoria e conferência.",
    columns: headers.map((header) => ({ label: humanizeHeader(header), width: estimateWidth(header, records), kind: inferRawKind(header) })),
    rows: records.map((row) => headers.map((header) => normalizeCellValue(row[header] ?? "", inferRawKind(header)))),
  }

  const workbook = createXlsx([mainSheet, rawSheet])
  const blob = new Blob([workbook], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
  const href = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = href
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(href)
}

function resolveColumns(headers: string[], definitions: ColumnDefinition[]): ResolvedColumn[] {
  return definitions.flatMap((definition) => {
    if (definition.computed) return [{ ...definition, kind: definition.kind ?? "text" }]
    const source = findHeader(headers, definition.candidates ?? [])
    return source ? [{ ...definition, source, kind: definition.kind ?? "text" }] : []
  })
}

function findHeader(headers: string[], candidates: string[]): string | undefined {
  const normalized = headers.map((header) => ({ header, normalized: normalizeKey(header) }))
  for (const candidate of candidates) {
    const key = normalizeKey(candidate)
    const exact = normalized.find((item) => item.normalized === key)
    if (exact) return exact.header
  }
  for (const candidate of candidates) {
    const key = normalizeKey(candidate)
    const partial = normalized.find((item) => item.normalized.startsWith(key) || key.startsWith(item.normalized))
    if (partial) return partial.header
  }
  return undefined
}

function parseDelimited(input: string, delimiter: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ""
  let quoted = false

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]
    const next = input[index + 1]

    if (char === '"') {
      if (quoted && next === '"') {
        cell += '"'
        index += 1
      } else {
        quoted = !quoted
      }
      continue
    }

    if (char === delimiter && !quoted) {
      row.push(cell)
      cell = ""
      continue
    }

    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1
      row.push(cell)
      rows.push(row)
      row = []
      cell = ""
      continue
    }

    cell += char
  }

  if (cell.length || row.length) {
    row.push(cell)
    rows.push(row)
  }

  if (rows[0]?.[0]?.charCodeAt(0) === 0xfeff) rows[0][0] = rows[0][0].slice(1)
  return rows
}

function normalizeCellValue(value: string | number, kind: ColumnKind): CellValue {
  if (typeof value === "number") return { value: Number.isFinite(value) ? value : 0, kind }
  const cleaned = cleanText(value)
  if (kind === "number" || kind === "currency") return { value: parseLocalizedNumber(cleaned), kind }
  if (kind === "date") return { value: formatDateValue(cleaned), kind }
  if (kind === "center" && ["s", "sim", "true", "1"].includes(normalizeKey(cleaned))) return { value: "Sim", kind }
  if (kind === "center" && ["n", "nao", "false", "0"].includes(normalizeKey(cleaned))) return { value: "Não", kind }
  return { value: cleaned, kind }
}

function parseLocalizedNumber(value: string): number {
  const text = cleanText(value)
  if (!text) return 0
  const normalized = text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text
  const parsed = Number.parseFloat(normalized.replace(/[^0-9.-]/g, ""))
  return Number.isFinite(parsed) ? parsed : 0
}

function formatDateValue(value: string): string {
  if (!value) return ""
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  const hasTime = /T|\d{1,2}:\d{2}/.test(value)
  return new Intl.DateTimeFormat("pt-BR", hasTime
    ? { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }
    : { day: "2-digit", month: "2-digit", year: "numeric" }).format(parsed)
}

function formatPeriod(start: string | null, end: string | null): string {
  if (!start && !end) return "Todos os períodos"
  const format = (value: string | null) => value ? formatDateValue(`${value}T12:00:00`) : "início"
  return `Período: ${format(start)} até ${format(end)}`
}

function inferRawKind(header: string): ColumnKind {
  const key = normalizeKey(header)
  if (/(data|emissao|abertura|encerramento|previsao)/.test(key)) return "date"
  if (/(valor|preco|total)/.test(key)) return "currency"
  if (/(qtd|quantidade)/.test(key)) return "number"
  if (/(defeito|servico|observacao|obs|descricao)/.test(key)) return "long"
  if (/(situacao|status|garantia|estoque|entrada)/.test(key)) return "center"
  return "text"
}

function estimateWidth(header: string, records: Record<string, string>[]): number {
  const sample = records.slice(0, 150)
  const longest = Math.max(humanizeHeader(header).length, ...sample.map((row) => cleanText(row[header] ?? "").split(/\r?\n/).reduce((max, part) => Math.max(max, part.length), 0)))
  const key = normalizeKey(header)
  if (/(defeito|servico|observacao|obs|descricao)/.test(key)) return Math.min(48, Math.max(28, longest + 2))
  return Math.min(30, Math.max(11, longest + 2))
}

function humanizeHeader(value: string): string {
  return cleanText(value)
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function normalizeKey(value: string): string {
  return cleanText(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "")
}

function cleanText(value: unknown): string {
  return String(value ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim()
}

function createXlsx(sheets: WorksheetDefinition[]): Uint8Array {
  const files: Array<{ name: string; content: string }> = []
  const sheetOverrides = sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")

  files.push({
    name: "[Content_Types].xml",
    content: `${XML_HEADER}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheetOverrides}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`,
  })

  files.push({ name: "_rels/.rels", content: `${XML_HEADER}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>` })

  const sheetNames = sheets.map((sheet, index) => `<sheet name="${escapeXml(sheet.name.slice(0, 31))}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("")
  files.push({ name: "xl/workbook.xml", content: `${XML_HEADER}<workbook xmlns="${MAIN_NS}" xmlns:r="${REL_NS}"><bookViews><workbookView xWindow="0" yWindow="0" windowWidth="24000" windowHeight="12000"/></bookViews><sheets>${sheetNames}</sheets><calcPr calcId="191029"/></workbook>` })

  const relationships = sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("")
  files.push({ name: "xl/_rels/workbook.xml.rels", content: `${XML_HEADER}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationships}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` })
  files.push({ name: "xl/styles.xml", content: buildStylesXml() })

  sheets.forEach((sheet, index) => files.push({ name: `xl/worksheets/sheet${index + 1}.xml`, content: buildSheetXml(sheet) }))

  const now = new Date().toISOString()
  files.push({ name: "docProps/core.xml", content: `${XML_HEADER}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Relatório Santa Print</dc:title><dc:creator>Santa Print — Gestão Operacional</dc:creator><cp:lastModifiedBy>Santa Print — Gestão Operacional</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>` })
  files.push({ name: "docProps/app.xml", content: `${XML_HEADER}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Santa Print Gestão</Application><AppVersion>1.0</AppVersion><Company>Santa Print</Company></Properties>` })

  return zipStored(files)
}

function buildSheetXml(sheet: WorksheetDefinition): string {
  const columnCount = Math.max(1, sheet.columns.length)
  const lastColumn = columnName(columnCount)
  const lastRow = sheet.rows.length + 5
  const columns = sheet.columns.map((column, index) => `<col min="${index + 1}" max="${index + 1}" width="${column.width}" customWidth="1"/>`).join("")
  const rowXml: string[] = []

  rowXml.push(`<row r="1" ht="30" customHeight="1">${inlineCell("A1", sheet.title, 1)}</row>`)
  rowXml.push(`<row r="2" ht="21" customHeight="1">${inlineCell("A2", sheet.subtitle, 2)}</row>`)
  rowXml.push(`<row r="3" ht="18" customHeight="1">${inlineCell("A3", "Santa Print · Gestão Operacional", 3)}</row>`)
  rowXml.push(`<row r="4" ht="8" customHeight="1"></row>`)
  rowXml.push(`<row r="5" ht="32" customHeight="1">${sheet.columns.map((column, index) => inlineCell(`${columnName(index + 1)}5`, column.label, 4)).join("")}</row>`)

  sheet.rows.forEach((row, rowIndex) => {
    const excelRow = rowIndex + 6
    const alternate = rowIndex % 2 === 1
    const cells = row.map((cell, columnIndex) => {
      const reference = `${columnName(columnIndex + 1)}${excelRow}`
      return cellXml(reference, cell, styleFor(cell.kind, alternate))
    }).join("")
    rowXml.push(`<row r="${excelRow}" ht="${row.some((cell) => cell.kind === "long" && String(cell.value).length > 70) ? 42 : 20}" customHeight="1">${cells}</row>`)
  })

  const mergeCells = `<mergeCells count="3"><mergeCell ref="A1:${lastColumn}1"/><mergeCell ref="A2:${lastColumn}2"/><mergeCell ref="A3:${lastColumn}3"/></mergeCells>`
  const autoFilter = sheet.rows.length ? `<autoFilter ref="A5:${lastColumn}${lastRow}"/>` : ""

  return `${XML_HEADER}<worksheet xmlns="${MAIN_NS}"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:${lastColumn}${lastRow}"/><sheetViews><sheetView tabSelected="1" workbookViewId="0"><pane ySplit="5" topLeftCell="A6" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A6" sqref="A6"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="20"/><cols>${columns}</cols><sheetData>${rowXml.join("")}</sheetData>${mergeCells}${autoFilter}<pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0" paperSize="9"/><headerFooter><oddFooter>&amp;LRelatório Santa Print&amp;RPágina &amp;P de &amp;N</oddFooter></headerFooter></worksheet>`
}

function buildStylesXml(): string {
  const thinBorder = '<border><left style="thin"><color rgb="FFD9E2F3"/></left><right style="thin"><color rgb="FFD9E2F3"/></right><top style="thin"><color rgb="FFD9E2F3"/></top><bottom style="thin"><color rgb="FFD9E2F3"/></bottom><diagonal/></border>'
  return `${XML_HEADER}<styleSheet xmlns="${MAIN_NS}"><numFmts count="1"><numFmt numFmtId="164" formatCode="[$R$-pt-BR] #,##0.00"/></numFmts><fonts count="4"><font><sz val="10"/><name val="Aptos"/><family val="2"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="18"/><name val="Aptos Display"/></font><font><i/><color rgb="FF44546A"/><sz val="10"/><name val="Aptos"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="10"/><name val="Aptos"/></font></fonts><fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF17365D"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFD9EAF7"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF3F6FA"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>${thinBorder}</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="18"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>${dataStyleXfs()}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles><dxfs count="0"/><tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/></styleSheet>`
}

function dataStyleXfs(): string {
  const variants: Array<{ fill: number; align?: string; wrap?: boolean; numFmt?: number }> = []
  for (const fill of [0, 4]) {
    variants.push(
      { fill },
      { fill, align: "center" },
      { fill, align: "right", numFmt: 1 },
      { fill, align: "right", numFmt: 164 },
      { fill, align: "center" },
      { fill, wrap: true },
    )
  }
  return variants.map((variant) => `<xf numFmtId="${variant.numFmt ?? 0}" fontId="0" fillId="${variant.fill}" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"${variant.numFmt ? ' applyNumberFormat="1"' : ""}><alignment horizontal="${variant.align ?? "left"}" vertical="${variant.wrap ? "top" : "center"}"${variant.wrap ? ' wrapText="1"' : ""}/></xf>`).join("")
}

function styleFor(kind: ColumnKind, alternate: boolean): number {
  const offset = alternate ? 11 : 5
  if (kind === "center" || kind === "date") return offset + 1
  if (kind === "number") return offset + 2
  if (kind === "currency") return offset + 3
  if (kind === "long") return offset + 5
  return offset
}

function inlineCell(reference: string, value: string, style: number): string {
  return `<c r="${reference}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`
}

function cellXml(reference: string, cell: CellValue, style: number): string {
  if ((cell.kind === "number" || cell.kind === "currency") && typeof cell.value === "number") {
    return `<c r="${reference}" s="${style}" t="n"><v>${Number.isFinite(cell.value) ? cell.value : 0}</v></c>`
  }
  return inlineCell(reference, String(cell.value ?? ""), style)
}

function columnName(index: number): string {
  let result = ""
  let current = index
  while (current > 0) {
    current -= 1
    result = String.fromCharCode(65 + (current % 26)) + result
    current = Math.floor(current / 26)
  }
  return result
}

function escapeXml(value: string): string {
  return cleanText(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;")
}

function zipStored(files: Array<{ name: string; content: string }>): Uint8Array {
  const encoder = new TextEncoder()
  const localParts: Uint8Array[] = []
  const centralParts: Uint8Array[] = []
  let offset = 0
  const { time, date } = dosDateTime(new Date())

  for (const file of files) {
    const name = encoder.encode(file.name)
    const data = encoder.encode(file.content)
    const checksum = crc32(data)

    const local = new Uint8Array(30 + name.length)
    const localView = new DataView(local.buffer)
    localView.setUint32(0, 0x04034b50, true)
    localView.setUint16(4, 20, true)
    localView.setUint16(6, 0x0800, true)
    localView.setUint16(8, 0, true)
    localView.setUint16(10, time, true)
    localView.setUint16(12, date, true)
    localView.setUint32(14, checksum, true)
    localView.setUint32(18, data.length, true)
    localView.setUint32(22, data.length, true)
    localView.setUint16(26, name.length, true)
    localView.setUint16(28, 0, true)
    local.set(name, 30)
    localParts.push(local, data)

    const central = new Uint8Array(46 + name.length)
    const centralView = new DataView(central.buffer)
    centralView.setUint32(0, 0x02014b50, true)
    centralView.setUint16(4, 20, true)
    centralView.setUint16(6, 20, true)
    centralView.setUint16(8, 0x0800, true)
    centralView.setUint16(10, 0, true)
    centralView.setUint16(12, time, true)
    centralView.setUint16(14, date, true)
    centralView.setUint32(16, checksum, true)
    centralView.setUint32(20, data.length, true)
    centralView.setUint32(24, data.length, true)
    centralView.setUint16(28, name.length, true)
    centralView.setUint16(30, 0, true)
    centralView.setUint16(32, 0, true)
    centralView.setUint16(34, 0, true)
    centralView.setUint16(36, 0, true)
    centralView.setUint32(38, 0, true)
    centralView.setUint32(42, offset, true)
    central.set(name, 46)
    centralParts.push(central)
    offset += local.length + data.length
  }

  const centralOffset = offset
  const centralSize = centralParts.reduce((total, part) => total + part.length, 0)
  const end = new Uint8Array(22)
  const endView = new DataView(end.buffer)
  endView.setUint32(0, 0x06054b50, true)
  endView.setUint16(4, 0, true)
  endView.setUint16(6, 0, true)
  endView.setUint16(8, files.length, true)
  endView.setUint16(10, files.length, true)
  endView.setUint32(12, centralSize, true)
  endView.setUint32(16, centralOffset, true)
  endView.setUint16(20, 0, true)

  return concatBytes([...localParts, ...centralParts, end])
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const length = parts.reduce((total, part) => total + part.length, 0)
  const result = new Uint8Array(length)
  let offset = 0
  for (const part of parts) {
    result.set(part, offset)
    offset += part.length
  }
  return result
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let index = 0; index < 256; index += 1) {
    let value = index
    for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    table[index] = value >>> 0
  }
  return table
})()

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function dosDateTime(value: Date): { time: number; date: number } {
  const year = Math.max(1980, value.getFullYear())
  return {
    time: (value.getHours() << 11) | (value.getMinutes() << 5) | Math.floor(value.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((value.getMonth() + 1) << 5) | value.getDate(),
  }
}
