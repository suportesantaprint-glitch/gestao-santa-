type ReportType = "chamadas" | "pecas"
type ColumnKind = "text" | "center" | "number" | "currency" | "date" | "long"

type ColumnDefinition = {
  label: string
  candidates?: string[]
  width: number
  kind: ColumnKind
  computed?: (row: Record<string, string>, headers: string[]) => string | number
}

type ResolvedColumn = ColumnDefinition & { source?: string }
type CellValue = { value: string | number; kind: ColumnKind }
type WorksheetDefinition = {
  name: string
  title: string
  subtitle: string
  columns: Array<{ label: string; width: number; kind: ColumnKind }>
  rows: CellValue[][]
}

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
const MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
const REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"

const REPORT_COLUMNS: Record<ReportType, ColumnDefinition[]> = {
  chamadas: [
    column("OS", 13, "center", "chamada_number", "codigo", "chamada", "numero_os"),
    column("Abertura", 19, "date", "data_abertura", "emissao", "data_emissao"),
    column("Encerramento", 19, "date", "data_encerramento", "encerramento"),
    column("Situação", 18, "center", "situacao_zenthi", "situacao", "status"),
    column("Cliente", 34, "text", "razao_social", "nome_cliente", "cliente_nome", "cliente", "cliente_number"),
    column("Cidade", 22, "text", "cidade", "nome_cidade"),
    column("Técnico", 28, "text", "email_tecnico", "nome_tecnico", "tecnico", "usuario_nome", "usuario_c"),
    column("Equipamento", 27, "text", "produto_descricao", "desc_tipo_equipamento", "tipo_equipamento", "equipamento"),
    column("Marca", 17, "text", "desc_marca", "marca", "marca_descricao"),
    column("Modelo", 19, "text", "modelo_equipamento", "modelo_e", "modelo"),
    column("Número de série", 21, "center", "numero_serie", "serie"),
    column("Defeito informado", 42, "long", "defeito_equipamento", "defeito_eq", "defeito"),
    column("Serviço realizado", 46, "long", "servicos_realizados", "servicos_r", "servico_realizado", "servico"),
    column("Observações", 42, "long", "obs_servico", "observacoes", "observacao"),
    column("Entrada", 15, "center", "tipo_entrada", "entrada"),
    column("Garantia", 12, "center", "garantia"),
  ],
  pecas: [
    column("ID", 13, "center", "id_sales_peca", "id", "peca_id"),
    column("OS", 13, "center", "chamada_number", "codigo", "chamada", "numero_os"),
    column("Registro", 19, "date", "data_abertura", "emissao", "data_registro"),
    column("Aplicação", 19, "date", "data_encerramento", "encerramento", "data_aplicacao"),
    column("Produto / Peça", 42, "text", "desc_produto", "produto_descricao", "descricao", "peca"),
    column("Marca", 18, "text", "desc_marca", "marca", "marca_descricao"),
    column("Quantidade", 13, "number", "qtdem", "quantidade", "qtd"),
    column("Valor unitário", 17, "currency", "valor_item", "valor_unitario", "valor"),
    {
      label: "Valor total",
      width: 17,
      kind: "currency",
      computed: (row, headers) => {
        const quantity = findHeader(headers, ["qtdem", "quantidade", "qtd"])
        const value = findHeader(headers, ["valor_item", "valor_unitario", "valor"])
        return parseNumber(quantity ? row[quantity] : "") * parseNumber(value ? row[value] : "")
      },
    },
    column("Movimentou estoque", 19, "center", "movimentou_estoque", "estoque"),
    column("Cliente", 34, "text", "razao_social", "nome_cliente", "cliente_nome", "cliente"),
    column("Técnico", 28, "text", "email_tecnico", "nome_tecnico", "tecnico", "usuario_nome"),
    column("Equipamento", 27, "text", "produto_equipamento", "desc_tipo_equipamento", "tipo_equipamento", "equipamento"),
    column("Modelo", 19, "text", "modelo_equipamento", "modelo_e", "modelo"),
    column("Número de série", 21, "center", "numero_serie", "serie"),
  ],
}

function column(label: string, width: number, kind: ColumnKind, ...candidates: string[]): ColumnDefinition {
  return { label, width, kind, candidates }
}

export async function downloadProfessionalExcel(path: string, type: ReportType, filename: string): Promise<void> {
  const response = await window.fetch(path)
  if (!response.ok) throw new Error(`Falha ao gerar o relatório: ${await response.text()}`)

  const matrix = parseDelimited(await response.text(), ";")
  if (!matrix.length || !matrix[0]?.length) throw new Error("O relatório não retornou dados válidos")

  const headers = matrix[0].map(cleanText)
  const records = matrix.slice(1)
    .filter((values) => values.some((value) => cleanText(value)))
    .map((values) => Object.fromEntries(headers.map((header, index) => [header, cleanText(values[index] ?? "")])))

  const url = new URL(path, window.location.origin)
  const reportName = type === "chamadas" ? "Relatório de Chamadas de Serviço" : "Relatório de Consumo de Peças"
  const generatedAt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date())
  const subtitle = `${formatPeriod(url.searchParams.get("dataInicio"), url.searchParams.get("dataFim"))} · ${records.length.toLocaleString("pt-BR")} registro(s) · Gerado em ${generatedAt}`

  const resolved = resolveColumns(headers, REPORT_COLUMNS[type])
  const mainColumns: ResolvedColumn[] = resolved.length
    ? resolved
    : headers.slice(0, 18).map((source): ResolvedColumn => ({
        label: humanize(source), source, width: estimateWidth(source, records), kind: inferKind(source),
      }))

  const mainSheet: WorksheetDefinition = {
    name: type === "chamadas" ? "Chamadas" : "Peças",
    title: reportName,
    subtitle,
    columns: mainColumns.map(({ label, width, kind }) => ({ label, width, kind })),
    rows: records.map((row) => mainColumns.map((definition) => {
      const raw = definition.computed
        ? definition.computed(row, headers)
        : definition.source
          ? row[definition.source] ?? ""
          : ""
      return normalizeCell(raw, definition.kind)
    })),
  }

  const rawSheet: WorksheetDefinition = {
    name: "Dados completos",
    title: `${reportName} — Dados completos`,
    subtitle: "Todos os campos originais preservados para auditoria e conferência.",
    columns: headers.map((header) => ({ label: humanize(header), width: estimateWidth(header, records), kind: inferKind(header) })),
    rows: records.map((row) => headers.map((header) => normalizeCell(row[header] ?? "", inferKind(header)))),
  }

  const bytes = createXlsx([mainSheet, rawSheet])
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
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
  return definitions.flatMap((definition): ResolvedColumn[] => {
    if (definition.computed) return [{ ...definition }]
    const source = findHeader(headers, definition.candidates ?? [])
    return source ? [{ ...definition, source }] : []
  })
}

function findHeader(headers: string[], candidates: string[]): string | undefined {
  const normalized = headers.map((header) => ({ header, key: normalizeKey(header) }))
  for (const candidate of candidates) {
    const exact = normalized.find((entry) => entry.key === normalizeKey(candidate))
    if (exact) return exact.header
  }
  for (const candidate of candidates) {
    const key = normalizeKey(candidate)
    const partial = normalized.find((entry) => entry.key.startsWith(key) || key.startsWith(entry.key))
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
      if (quoted && next === '"') { cell += '"'; index += 1 } else quoted = !quoted
    } else if (char === delimiter && !quoted) {
      row.push(cell); cell = ""
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1
      row.push(cell); rows.push(row); row = []; cell = ""
    } else cell += char
  }

  if (cell.length || row.length) { row.push(cell); rows.push(row) }
  if (rows[0]?.[0]?.charCodeAt(0) === 0xfeff) rows[0][0] = rows[0][0].slice(1)
  return rows
}

function normalizeCell(value: string | number, kind: ColumnKind): CellValue {
  if (typeof value === "number") return { value: Number.isFinite(value) ? value : 0, kind }
  const cleaned = cleanText(value)
  if (kind === "number" || kind === "currency") return { value: parseNumber(cleaned), kind }
  if (kind === "date") return { value: formatDate(cleaned), kind }
  if (kind === "center") {
    const key = normalizeKey(cleaned)
    if (["s", "sim", "true", "1"].includes(key)) return { value: "Sim", kind }
    if (["n", "nao", "false", "0"].includes(key)) return { value: "Não", kind }
  }
  return { value: cleaned, kind }
}

function parseNumber(value: string): number {
  const cleaned = cleanText(value)
  if (!cleaned) return 0
  const normalized = cleaned.includes(",") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned
  const parsed = Number.parseFloat(normalized.replace(/[^0-9.-]/g, ""))
  return Number.isFinite(parsed) ? parsed : 0
}

function formatDate(value: string): string {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const options: Intl.DateTimeFormatOptions = /T|\d{1,2}:\d{2}/.test(value)
    ? { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }
    : { day: "2-digit", month: "2-digit", year: "numeric" }
  return new Intl.DateTimeFormat("pt-BR", options).format(date)
}

function formatPeriod(start: string | null, end: string | null): string {
  if (!start && !end) return "Todos os períodos"
  const display = (value: string | null, fallback: string) => value ? formatDate(`${value}T12:00:00`) : fallback
  return `Período: ${display(start, "início")} até ${display(end, "hoje")}`
}

function inferKind(header: string): ColumnKind {
  const key = normalizeKey(header)
  if (/(data|emissao|abertura|encerramento|previsao)/.test(key)) return "date"
  if (/(valor|preco|total)/.test(key)) return "currency"
  if (/(qtd|quantidade)/.test(key)) return "number"
  if (/(defeito|servico|observacao|obs|descricao)/.test(key)) return "long"
  if (/(situacao|status|garantia|estoque|entrada)/.test(key)) return "center"
  return "text"
}

function estimateWidth(header: string, rows: Record<string, string>[]): number {
  const longest = Math.max(humanize(header).length, ...rows.slice(0, 150).map((row) => cleanText(row[header] ?? "").split(/\r?\n/).reduce((max, line) => Math.max(max, line.length), 0)))
  return inferKind(header) === "long" ? Math.min(48, Math.max(28, longest + 2)) : Math.min(30, Math.max(11, longest + 2))
}

function humanize(value: string): string {
  return cleanText(value).replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function normalizeKey(value: string): string {
  return cleanText(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "")
}

function cleanText(value: unknown): string {
  return String(value ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim()
}

function createXlsx(sheets: WorksheetDefinition[]): Uint8Array<ArrayBuffer> {
  const files: Array<{ name: string; content: string }> = []
  const overrides = sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")
  files.push({ name: "[Content_Types].xml", content: `${XML_HEADER}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${overrides}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>` })
  files.push({ name: "_rels/.rels", content: `${XML_HEADER}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>` })
  const sheetNames = sheets.map((sheet, index) => `<sheet name="${escapeXml(sheet.name.slice(0, 31))}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("")
  files.push({ name: "xl/workbook.xml", content: `${XML_HEADER}<workbook xmlns="${MAIN_NS}" xmlns:r="${REL_NS}"><bookViews><workbookView windowWidth="24000" windowHeight="12000"/></bookViews><sheets>${sheetNames}</sheets><calcPr calcId="191029"/></workbook>` })
  const relations = sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("")
  files.push({ name: "xl/_rels/workbook.xml.rels", content: `${XML_HEADER}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relations}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` })
  files.push({ name: "xl/styles.xml", content: stylesXml() })
  sheets.forEach((sheet, index) => files.push({ name: `xl/worksheets/sheet${index + 1}.xml`, content: sheetXml(sheet) }))
  const now = new Date().toISOString()
  files.push({ name: "docProps/core.xml", content: `${XML_HEADER}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Relatório Santa Print</dc:title><dc:creator>Santa Print — Gestão Operacional</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>` })
  files.push({ name: "docProps/app.xml", content: `${XML_HEADER}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Santa Print Gestão</Application><Company>Santa Print</Company></Properties>` })
  return zipStored(files)
}

function sheetXml(sheet: WorksheetDefinition): string {
  const lastColumn = columnName(Math.max(1, sheet.columns.length))
  const lastRow = sheet.rows.length + 5
  const columns = sheet.columns.map((item, index) => `<col min="${index + 1}" max="${index + 1}" width="${item.width}" customWidth="1"/>`).join("")
  const rows: string[] = [
    `<row r="1" ht="30" customHeight="1">${stringCell("A1", sheet.title, 1)}</row>`,
    `<row r="2" ht="21" customHeight="1">${stringCell("A2", sheet.subtitle, 2)}</row>`,
    `<row r="3" ht="18" customHeight="1">${stringCell("A3", "Santa Print · Gestão Operacional", 3)}</row>`,
    `<row r="4" ht="8" customHeight="1"></row>`,
    `<row r="5" ht="32" customHeight="1">${sheet.columns.map((item, index) => stringCell(`${columnName(index + 1)}5`, item.label, 4)).join("")}</row>`,
  ]
  sheet.rows.forEach((row, rowIndex) => {
    const excelRow = rowIndex + 6
    const alternate = rowIndex % 2 === 1
    const cells = row.map((cell, columnIndex) => valueCell(`${columnName(columnIndex + 1)}${excelRow}`, cell, styleFor(cell.kind, alternate))).join("")
    const height = row.some((cell) => cell.kind === "long" && String(cell.value).length > 70) ? 42 : 20
    rows.push(`<row r="${excelRow}" ht="${height}" customHeight="1">${cells}</row>`)
  })
  const filter = sheet.rows.length ? `<autoFilter ref="A5:${lastColumn}${lastRow}"/>` : ""
  return `${XML_HEADER}<worksheet xmlns="${MAIN_NS}"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:${lastColumn}${lastRow}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="5" topLeftCell="A6" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A6" sqref="A6"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="20"/><cols>${columns}</cols><sheetData>${rows.join("")}</sheetData><mergeCells count="3"><mergeCell ref="A1:${lastColumn}1"/><mergeCell ref="A2:${lastColumn}2"/><mergeCell ref="A3:${lastColumn}3"/></mergeCells>${filter}<pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0" paperSize="9"/><headerFooter><oddFooter>&amp;LRelatório Santa Print&amp;RPágina &amp;P de &amp;N</oddFooter></headerFooter></worksheet>`
}

function stylesXml(): string {
  const border = '<border><left style="thin"><color rgb="FFD9E2F3"/></left><right style="thin"><color rgb="FFD9E2F3"/></right><top style="thin"><color rgb="FFD9E2F3"/></top><bottom style="thin"><color rgb="FFD9E2F3"/></bottom><diagonal/></border>'
  const data = [
    dataXf(0, "left"), dataXf(4, "left"), dataXf(0, "center"), dataXf(4, "center"),
    dataXf(0, "right", 1), dataXf(4, "right", 1), dataXf(0, "right", 164), dataXf(4, "right", 164),
    dataXf(0, "left", 0, true), dataXf(4, "left", 0, true),
  ].join("")
  return `${XML_HEADER}<styleSheet xmlns="${MAIN_NS}"><numFmts count="1"><numFmt numFmtId="164" formatCode="[$R$-pt-BR] #,##0.00"/></numFmts><fonts count="4"><font><sz val="10"/><name val="Aptos"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="18"/><name val="Aptos Display"/></font><font><i/><color rgb="FF44546A"/><sz val="10"/><name val="Aptos"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="10"/><name val="Aptos"/></font></fonts><fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF17365D"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFD9EAF7"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF3F6FA"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>${border}</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="15"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>${data}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles><dxfs count="0"/><tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/></styleSheet>`
}

function dataXf(fill: number, align: string, numFmt = 0, wrap = false): string {
  return `<xf numFmtId="${numFmt}" fontId="0" fillId="${fill}" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"${numFmt ? ' applyNumberFormat="1"' : ""}><alignment horizontal="${align}" vertical="${wrap ? "top" : "center"}"${wrap ? ' wrapText="1"' : ""}/></xf>`
}

function styleFor(kind: ColumnKind, alternate: boolean): number {
  if (kind === "center" || kind === "date") return alternate ? 8 : 7
  if (kind === "number") return alternate ? 10 : 9
  if (kind === "currency") return alternate ? 12 : 11
  if (kind === "long") return alternate ? 14 : 13
  return alternate ? 6 : 5
}

function stringCell(reference: string, value: string, style: number): string {
  return `<c r="${reference}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`
}

function valueCell(reference: string, cell: CellValue, style: number): string {
  if ((cell.kind === "number" || cell.kind === "currency") && typeof cell.value === "number") return `<c r="${reference}" s="${style}" t="n"><v>${cell.value}</v></c>`
  return stringCell(reference, String(cell.value ?? ""), style)
}

function columnName(index: number): string {
  let result = ""
  for (let current = index; current > 0; current = Math.floor((current - 1) / 26)) result = String.fromCharCode(65 + ((current - 1) % 26)) + result
  return result
}

function escapeXml(value: string): string {
  return cleanText(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;")
}

function zipStored(files: Array<{ name: string; content: string }>): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder()
  const locals: Uint8Array<ArrayBuffer>[] = []
  const centrals: Uint8Array<ArrayBuffer>[] = []
  let offset = 0
  const stamp = dosDateTime(new Date())

  for (const file of files) {
    const name = encoder.encode(file.name) as Uint8Array<ArrayBuffer>
    const data = encoder.encode(file.content) as Uint8Array<ArrayBuffer>
    const checksum = crc32(data)
    const local = new Uint8Array(30 + name.length)
    const localView = new DataView(local.buffer)
    localView.setUint32(0, 0x04034b50, true); localView.setUint16(4, 20, true); localView.setUint16(6, 0x0800, true)
    localView.setUint16(8, 0, true); localView.setUint16(10, stamp.time, true); localView.setUint16(12, stamp.date, true)
    localView.setUint32(14, checksum, true); localView.setUint32(18, data.length, true); localView.setUint32(22, data.length, true)
    localView.setUint16(26, name.length, true); local.set(name, 30); locals.push(local, data)

    const central = new Uint8Array(46 + name.length)
    const centralView = new DataView(central.buffer)
    centralView.setUint32(0, 0x02014b50, true); centralView.setUint16(4, 20, true); centralView.setUint16(6, 20, true)
    centralView.setUint16(8, 0x0800, true); centralView.setUint16(10, 0, true); centralView.setUint16(12, stamp.time, true); centralView.setUint16(14, stamp.date, true)
    centralView.setUint32(16, checksum, true); centralView.setUint32(20, data.length, true); centralView.setUint32(24, data.length, true)
    centralView.setUint16(28, name.length, true); centralView.setUint32(42, offset, true); central.set(name, 46); centrals.push(central)
    offset += local.length + data.length
  }

  const centralSize = centrals.reduce((sum, item) => sum + item.length, 0)
  const end = new Uint8Array(22)
  const view = new DataView(end.buffer)
  view.setUint32(0, 0x06054b50, true); view.setUint16(8, files.length, true); view.setUint16(10, files.length, true)
  view.setUint32(12, centralSize, true); view.setUint32(16, offset, true)
  return concatBytes([...locals, ...centrals, end])
}

function concatBytes(parts: Uint8Array<ArrayBuffer>[]): Uint8Array<ArrayBuffer> {
  const output = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
  let offset = 0
  for (const part of parts) { output.set(part, offset); offset += part.length }
  return output
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let index = 0; index < 256; index += 1) {
    let value = index
    for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    table[index] = value >>> 0
  }
  return table
})()

function crc32(data: Uint8Array<ArrayBuffer>): number {
  let crc = 0xffffffff
  for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function dosDateTime(date: Date): { time: number; date: number } {
  const year = Math.max(1980, date.getFullYear())
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  }
}
