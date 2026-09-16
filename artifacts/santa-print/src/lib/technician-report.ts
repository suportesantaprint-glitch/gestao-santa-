export type TechnicianReportMode = "parts" | "returns"

export type TechnicianReportPart = {
  descricao: string
  quantidade: number
  valor: number
}

export type TechnicianReportService = {
  codigo: string | number
  cliente: string
  cidade: string
  marca: string
  modelo: string
  numeroSerie: string
  situacao: string
  emissao: string | null
  encerramento: string | null
  retorno: boolean
  pecas: TechnicianReportPart[]
}

export type TechnicianReportInput = {
  mode: TechnicianReportMode
  technician: string
  services: TechnicianReportService[]
}

const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89
const MARGIN = 40
const BOTTOM_LIMIT = PAGE_HEIGHT - 54

const WIN_ANSI_SPECIAL: Record<number, number> = {
  0x20ac: 0x80,
  0x2018: 0x91,
  0x2019: 0x92,
  0x201c: 0x93,
  0x201d: 0x94,
  0x2022: 0x95,
  0x2013: 0x96,
  0x2014: 0x97,
  0x2122: 0x99,
}

function cleanText(value: unknown): string {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
    .format(Number.isFinite(value) ? value : 0)
}

function formatDateTime(value: string | null): string {
  if (!value) return "Não informado"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return cleanText(value) || "Não informado"
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function reportTitle(mode: TechnicianReportMode): string {
  return mode === "parts" ? "Relatório de Peças Utilizadas" : "Relatório de Atendimentos com Retorno"
}

function reportDescription(mode: TechnicianReportMode): string {
  return mode === "parts"
    ? "Peças aplicadas por ordem de serviço, cliente e equipamento."
    : "Ordens de serviço identificadas como retorno, com peças aplicadas."
}

function slug(value: string): string {
  return cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "tecnico"
}

function escapeHtml(value: unknown): string {
  return cleanText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function countParts(service: TechnicianReportService): number {
  return service.pecas.reduce((total, part) => total + Math.max(0, part.quantidade), 0)
}

function buildPrintableHtml(input: TechnicianReportInput): string {
  const title = reportTitle(input.mode)
  const generatedAt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date())
  const totalParts = input.services.reduce((total, service) => total + countParts(service), 0)

  const services = input.services.map((service) => {
    const equipment = [service.marca, service.modelo].map(cleanText).filter(Boolean).join(" ") || "Não informado"
    const parts = service.pecas.length
      ? `<div class="parts">${service.pecas.map((part) => `
          <div class="part">
            <span><strong>${escapeHtml(part.quantidade)}×</strong> ${escapeHtml(part.descricao || "Peça sem descrição")}</span>
            ${part.valor > 0 ? `<span>${escapeHtml(formatCurrency(part.valor))}</span>` : ""}
          </div>`).join("")}</div>`
      : `<div class="empty">Nenhuma peça registrada neste atendimento.</div>`

    return `<section class="service">
      <div class="service-head">
        <div>
          <h2>OS #${escapeHtml(service.codigo)} · ${escapeHtml(service.cliente || "Cliente não identificado")}</h2>
          <p>${escapeHtml(service.cidade || "Cidade não informada")}</p>
        </div>
        <span class="status">${escapeHtml(service.situacao || "Sem status")}</span>
      </div>
      <div class="meta">
        <div><span>Equipamento</span><strong>${escapeHtml(equipment)}</strong></div>
        <div><span>Número de série</span><strong>${escapeHtml(service.numeroSerie || "Não informado")}</strong></div>
        <div><span>Abertura</span><strong>${escapeHtml(formatDateTime(service.emissao))}</strong></div>
        <div><span>Encerramento</span><strong>${escapeHtml(formatDateTime(service.encerramento))}</strong></div>
        <div><span>Total aplicado</span><strong>${countParts(service)} peça(s)</strong></div>
        ${input.mode === "returns" ? `<div><span>Classificação</span><strong>Retorno</strong></div>` : ""}
      </div>
      ${parts}
    </section>`
  }).join("")

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)} - ${escapeHtml(input.technician)}</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; color: #172033; background: #fff; font: 12px/1.45 Arial, Helvetica, sans-serif; }
  .header { border-bottom: 2px solid #17365d; padding-bottom: 14px; margin-bottom: 18px; }
  .brand { color: #17365d; font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
  h1 { margin: 4px 0 3px; font-size: 22px; }
  .subtitle { color: #667085; margin: 0; }
  .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 16px 0 20px; }
  .summary > div { border: 1px solid #dbe2ea; border-radius: 7px; padding: 9px 10px; }
  .summary span, .meta span { display: block; color: #667085; font-size: 10px; }
  .summary strong { display: block; margin-top: 2px; font-size: 12px; }
  .service { border: 1px solid #dbe2ea; border-radius: 8px; padding: 14px; margin-bottom: 12px; break-inside: avoid; page-break-inside: avoid; }
  .service-head { display: flex; justify-content: space-between; gap: 14px; align-items: flex-start; margin-bottom: 10px; }
  h2 { margin: 0; font-size: 14px; }
  .service-head p { margin: 2px 0 0; color: #667085; }
  .status { border: 1px solid #b7c8e8; background: #eef4ff; color: #2459a9; border-radius: 999px; padding: 3px 8px; white-space: nowrap; font-size: 10px; font-weight: 700; }
  .meta { display: grid; grid-template-columns: repeat(2, 1fr); gap: 7px 18px; margin-bottom: 10px; }
  .meta strong { font-weight: 600; }
  .parts { border-radius: 6px; background: #f6f8fb; padding: 8px 10px; }
  .part { display: flex; justify-content: space-between; gap: 18px; padding: 3px 0; }
  .part + .part { border-top: 1px solid #e7ebf0; }
  .empty { color: #667085; background: #f6f8fb; border-radius: 6px; padding: 9px; }
  footer { color: #667085; margin-top: 16px; padding-top: 10px; border-top: 1px solid #dbe2ea; font-size: 10px; }
  @page { size: A4 portrait; margin: 12mm; }
</style>
</head>
<body>
  <header class="header">
    <div class="brand">Santa Print · Gestão Operacional</div>
    <h1>${escapeHtml(title)}</h1>
    <p class="subtitle">${escapeHtml(reportDescription(input.mode))}</p>
  </header>
  <section class="summary">
    <div><span>Técnico</span><strong>${escapeHtml(input.technician)}</strong></div>
    <div><span>Ordens de serviço</span><strong>${input.services.length}</strong></div>
    <div><span>Peças listadas</span><strong>${totalParts}</strong></div>
  </section>
  ${services || `<p class="empty">Nenhum registro disponível para impressão.</p>`}
  <footer>Gerado em ${escapeHtml(generatedAt)} · Santa Print Gestão Operacional</footer>
</body>
</html>`
}

export function printTechnicianReport(input: TechnicianReportInput): void {
  const printWindow = window.open("", "_blank", "width=1100,height=820")
  if (!printWindow) {
    throw new Error("O navegador bloqueou a janela de impressão. Permita pop-ups para este site e tente novamente.")
  }

  printWindow.opener = null
  printWindow.document.open()
  printWindow.document.write(buildPrintableHtml(input))
  printWindow.document.close()

  const openPrintDialog = () => {
    printWindow.focus()
    printWindow.print()
  }

  if (printWindow.document.readyState === "complete") window.setTimeout(openPrintDialog, 150)
  else printWindow.addEventListener("load", () => window.setTimeout(openPrintDialog, 100), { once: true })
}

function winAnsiHex(value: string): string {
  let hex = ""
  for (const char of cleanText(value)) {
    const codePoint = char.codePointAt(0) ?? 0x3f
    const byte = codePoint <= 0xff ? codePoint : (WIN_ANSI_SPECIAL[codePoint] ?? 0x3f)
    hex += byte.toString(16).padStart(2, "0")
  }
  return `<${hex}>`
}

function approximateTextWidth(value: string, fontSize: number): number {
  let units = 0
  for (const char of value) {
    if (char === " " || /[ilI1.,:;|]/.test(char)) units += 0.28
    else if (/[MW@%]/.test(char)) units += 0.82
    else if (/[A-Z0-9]/.test(char)) units += 0.58
    else units += 0.5
  }
  return units * fontSize
}

function wrapPdfText(value: string, maxWidth: number, fontSize: number): string[] {
  const source = cleanText(value)
  if (!source) return [""]

  const lines: string[] = []
  let current = ""

  for (const word of source.split(/\s+/)) {
    const candidate = current ? `${current} ${word}` : word
    if (approximateTextWidth(candidate, fontSize) <= maxWidth) {
      current = candidate
      continue
    }

    if (current) lines.push(current)
    current = ""

    if (approximateTextWidth(word, fontSize) <= maxWidth) {
      current = word
      continue
    }

    let chunk = ""
    for (const char of word) {
      const next = chunk + char
      if (chunk && approximateTextWidth(next, fontSize) > maxWidth) {
        lines.push(chunk)
        chunk = char
      } else chunk = next
    }
    current = chunk
  }

  if (current) lines.push(current)
  return lines.length ? lines : [""]
}

function asciiBytes(value: string): Uint8Array<ArrayBuffer> {
  const output = new Uint8Array(value.length)
  for (let index = 0; index < value.length; index += 1) output[index] = value.charCodeAt(index) & 0xff
  return output
}

function concatBytes(parts: Uint8Array<ArrayBuffer>[]): Uint8Array<ArrayBuffer> {
  const output = new Uint8Array(parts.reduce((total, part) => total + part.length, 0))
  let offset = 0
  for (const part of parts) {
    output.set(part, offset)
    offset += part.length
  }
  return output
}

export function buildTechnicianReportPdf(input: TechnicianReportInput): Uint8Array<ArrayBuffer> {
  const pages: string[][] = []
  let commands: string[] = []
  let cursorTop = 0

  const pdfY = (top: number) => PAGE_HEIGHT - top
  const text = (value: string, x: number, top: number, size: number, bold = false) => {
    commands.push(`0.10 0.13 0.18 rg BT /${bold ? "F2" : "F1"} ${size.toFixed(2)} Tf ${x.toFixed(2)} ${pdfY(top).toFixed(2)} Td ${winAnsiHex(value)} Tj ET\n`)
  }
  const line = (top: number, gray = 0.82) => {
    commands.push(`${gray.toFixed(2)} G ${MARGIN.toFixed(2)} ${pdfY(top).toFixed(2)} m ${(PAGE_WIDTH - MARGIN).toFixed(2)} ${pdfY(top).toFixed(2)} l S\n`)
  }
  const wrapped = (value: string, x: number, top: number, width: number, size: number, bold = false) => {
    const items = wrapPdfText(value, width, size)
    const lineHeight = size * 1.28
    items.forEach((item, index) => text(item, x, top + index * lineHeight, size, bold))
    return items.length * lineHeight
  }
  const beginPage = () => {
    if (commands.length) pages.push(commands)
    commands = []
    text("SANTA PRINT · GESTÃO OPERACIONAL", MARGIN, 32, 9, true)
    text(reportTitle(input.mode), MARGIN, 54, 17, true)
    wrapped(`Técnico: ${input.technician}`, MARGIN, 72, PAGE_WIDTH - MARGIN * 2, 9.5)
    text(`${input.services.length} ordem(ns) de serviço · Gerado em ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date())}`, MARGIN, 90, 8.5)
    line(102, 0.65)
    cursorTop = 120
  }
  const ensureSpace = (needed: number) => {
    if (cursorTop + needed > BOTTOM_LIMIT) beginPage()
  }

  beginPage()

  for (const service of input.services) {
    ensureSpace(110)
    const titleHeight = wrapped(
      `OS #${service.codigo} · ${service.cliente || "Cliente não identificado"}`,
      MARGIN,
      cursorTop,
      PAGE_WIDTH - MARGIN * 2 - 90,
      11,
      true,
    )
    text(service.situacao || "Sem status", PAGE_WIDTH - MARGIN - 85, cursorTop, 8.5, true)
    cursorTop += Math.max(16, titleHeight)

    if (service.cidade) {
      cursorTop += wrapped(service.cidade, MARGIN, cursorTop, PAGE_WIDTH - MARGIN * 2, 8.5)
      cursorTop += 2
    }

    const equipment = [service.marca, service.modelo].map(cleanText).filter(Boolean).join(" ") || "Não informado"
    const metadata = [
      `Equipamento: ${equipment}`,
      `Número de série: ${service.numeroSerie || "Não informado"}`,
      `Abertura: ${formatDateTime(service.emissao)}`,
      `Encerramento: ${formatDateTime(service.encerramento)}`,
      `Total aplicado: ${countParts(service)} peça(s)`,
    ]
    if (input.mode === "returns") metadata.push("Classificação: Retorno")

    for (const item of metadata) {
      ensureSpace(18)
      cursorTop += Math.max(13, wrapped(item, MARGIN, cursorTop, PAGE_WIDTH - MARGIN * 2, 8.7))
    }

    cursorTop += 4
    if (service.pecas.length) {
      ensureSpace(24)
      text(input.mode === "returns" ? "PEÇAS USADAS NESTE RETORNO" : "PEÇAS APLICADAS", MARGIN, cursorTop, 8, true)
      cursorTop += 14

      for (const part of service.pecas) {
        const label = `${part.quantidade}× ${part.descricao || "Peça sem descrição"}${part.valor > 0 ? ` · ${formatCurrency(part.valor)}` : ""}`
        const wrappedPart = wrapPdfText(label, PAGE_WIDTH - MARGIN * 2 - 8, 8.5)
        ensureSpace(wrappedPart.length * 11 + 8)
        wrappedPart.forEach((item, index) => text(item, MARGIN + 5, cursorTop + index * 11, 8.5, index === 0))
        cursorTop += wrappedPart.length * 11 + 4
      }
    } else {
      ensureSpace(20)
      text("Nenhuma peça registrada neste atendimento.", MARGIN, cursorTop, 8.5)
      cursorTop += 17
    }

    cursorTop += 8
    line(cursorTop, 0.78)
    cursorTop += 17
  }

  if (!input.services.length) text("Nenhum registro disponível para este relatório.", MARGIN, cursorTop, 10)
  if (commands.length) pages.push(commands)

  pages.forEach((page, index) => {
    const footer = `Página ${index + 1} de ${pages.length}`
    page.push(`0.30 0.34 0.40 rg BT /F1 8 Tf ${MARGIN.toFixed(2)} 24 Td ${winAnsiHex("Santa Print Gestão Operacional")} Tj ET\n`)
    page.push(`0.30 0.34 0.40 rg BT /F1 8 Tf ${(PAGE_WIDTH - MARGIN - approximateTextWidth(footer, 8)).toFixed(2)} 24 Td ${winAnsiHex(footer)} Tj ET\n`)
  })

  const pageIds = pages.map((_, index) => 5 + index * 2)
  const objects: string[] = []
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>"
  objects[2] = `<< /Type /Pages /Count ${pages.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] >>`
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"
  objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"

  pages.forEach((page, index) => {
    const pageId = 5 + index * 2
    const contentId = pageId + 1
    const stream = page.join("")
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH.toFixed(2)} ${PAGE_HEIGHT.toFixed(2)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`
    objects[contentId] = `<< /Length ${asciiBytes(stream).length} >>\nstream\n${stream}endstream`
  })

  const chunks: Uint8Array<ArrayBuffer>[] = [asciiBytes("%PDF-1.4\n")]
  const offsets = new Array(objects.length).fill(0) as number[]
  let size = chunks[0]?.length ?? 0

  for (let id = 1; id < objects.length; id += 1) {
    const object = objects[id]
    if (!object) continue
    offsets[id] = size
    const bytes = asciiBytes(`${id} 0 obj\n${object}\nendobj\n`)
    chunks.push(bytes)
    size += bytes.length
  }

  const xrefOffset = size
  chunks.push(asciiBytes([
    `xref\n0 ${objects.length}\n`,
    "0000000000 65535 f \n",
    ...offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`),
    `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
  ].join("")))

  return concatBytes(chunks)
}

export function downloadTechnicianReportPdf(input: TechnicianReportInput): void {
  const bytes = buildTechnicianReportPdf(input)
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  const blob = new Blob([buffer], { type: "application/pdf" })
  const href = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = href
  anchor.download = `${input.mode === "parts" ? "pecas-usadas" : "retornos"}-${slug(input.technician)}.pdf`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(href)
}
