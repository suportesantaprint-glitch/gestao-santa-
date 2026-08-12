import * as XLSX from "xlsx";

type ExcelColumnType = "text" | "integer" | "decimal" | "currency" | "date" | "datetime";

export interface ExcelColumn {
  key: string;
  header: string;
  width: number;
  type?: ExcelColumnType;
}

interface BuildExcelOptions {
  sheetName: string;
  title: string;
  columns: ExcelColumn[];
  rows: Record<string, unknown>[];
}

const FORMATS: Partial<Record<ExcelColumnType, string>> = {
  integer: "#,##0",
  decimal: "#,##0.00",
  currency: 'R$ #,##0.00',
  date: "dd/mm/yyyy",
  datetime: "dd/mm/yyyy hh:mm",
};

function parseNumber(value: unknown): number | string {
  if (typeof value === "number") return Number.isFinite(value) ? value : "";
  if (typeof value !== "string") return "";

  const input = value.trim();
  if (!input) return "";

  const normalized = input.includes(",")
    ? input.replace(/\./g, "").replace(",", ".")
    : input;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : input;
}

function parseDate(value: unknown): Date | string {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : value;
  if (typeof value !== "string") return "";

  const input = value.trim();
  if (!input) return "";

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  const parsed = new Date(input);
  return Number.isNaN(parsed.getTime()) ? input : parsed;
}

function normalizeCellValue(value: unknown, type: ExcelColumnType): unknown {
  if (value === null || value === undefined) return "";

  switch (type) {
    case "integer":
    case "decimal":
    case "currency":
      return parseNumber(value);
    case "date":
    case "datetime":
      return parseDate(value);
    case "text":
    default:
      return typeof value === "string" ? value.trim() : String(value);
  }
}

export function buildProfessionalExcel({
  sheetName,
  title,
  columns,
  rows,
}: BuildExcelOptions): Buffer {
  const data = [
    columns.map((column) => column.header),
    ...rows.map((row) =>
      columns.map((column) => normalizeCellValue(row[column.key], column.type ?? "text")),
    ),
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(data, {
    cellDates: true,
    dateNF: "dd/mm/yyyy hh:mm",
  });

  worksheet["!cols"] = columns.map((column) => ({ wch: column.width }));
  worksheet["!rows"] = [{ hpt: 24 }];

  if (worksheet["!ref"]) {
    worksheet["!autofilter"] = { ref: worksheet["!ref"] };
  }

  for (let rowIndex = 1; rowIndex < data.length; rowIndex += 1) {
    columns.forEach((column, columnIndex) => {
      const format = FORMATS[column.type ?? "text"];
      if (!format) return;

      const address = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
      const cell = worksheet[address];
      if (cell) cell.z = format;
    });
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  workbook.Props = {
    Title: title,
    Subject: "Relatório gerencial exportado pelo Gestão Santa Print",
    Author: "Santa Print",
    Company: "Santa Print",
    Category: "Relatórios Gerenciais",
    Comments: `Exportação com ${rows.length} registro(s).`,
    CreatedDate: new Date(),
  };

  return XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
    cellDates: true,
    compression: true,
  }) as Buffer;
}
