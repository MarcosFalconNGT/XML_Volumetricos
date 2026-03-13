import path from 'node:path';
import { format } from 'date-fns';
import ExcelJS from 'exceljs';
import { CELL_MAP, EXCEL_STATUS_FILL_COLORS, SHEETS } from '../../shared/constants';
import { ConceptoRecord, FacturaRecord, ProcessLog, ResumenRecord, ValidationSeverity } from '../../shared/types';

export interface ExcelWritePayload {
  templatePath: string;
  outputDir: string;
  facturas: FacturaRecord[];
  conceptos: ConceptoRecord[];
  resumen: ResumenRecord[];
  logs: ProcessLog[];
  totalXmlProcesados: number;
  totalXmlOk: number;
  totalXmlWarning: number;
  totalXmlError: number;
}

// const START_ROWS = {
//   RESUMEN: 7,
//   FACTURAS: 2,
//   CONCEPTOS: 2,
//   LOGS: 2,
// };

export class ExcelReportWriter {
  public async write(payload: ExcelWritePayload): Promise<string> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(payload.templatePath);

    const resumenSheet = workbook.getWorksheet(SHEETS.RESUMEN);
    const facturasSheet = workbook.getWorksheet(SHEETS.FACTURAS);
    const conceptosSheet = workbook.getWorksheet(SHEETS.CONCEPTOS);
    const logsSheet = workbook.getWorksheet(SHEETS.LOGS);

    if (!resumenSheet || !facturasSheet || !conceptosSheet || !logsSheet) {
      throw new Error('La plantilla no contiene todas las hojas requeridas.');
    }

    // Limpiar contenido dinámico antes de escribir
    this.clearWorksheetRows(resumenSheet, CELL_MAP.RESUMEN_START_ROW);
    this.clearWorksheetRows(facturasSheet, CELL_MAP.FACTURAS_START_ROW);
    this.clearWorksheetRows(conceptosSheet, CELL_MAP.CONCEPTOS_START_ROW);
    this.clearWorksheetRows(logsSheet, CELL_MAP.LOGS_START_ROW);

    // Escribir resumen superior
    resumenSheet.getCell(CELL_MAP.FECHA_GENERACION).value = format(new Date(), 'dd/MM/yyyy HH:mm:ss');
    resumenSheet.getCell(CELL_MAP.TOTAL_XML_PROCESADOS).value = payload.totalXmlProcesados;
    resumenSheet.getCell(CELL_MAP.TOTAL_XML_ERROR).value = payload.totalXmlError;

    // Escribir bloques de datos desde filas fijas
    this.fillResumenRows(resumenSheet, payload.resumen);
    this.fillFacturasRows(facturasSheet, payload.facturas);
    this.fillConceptosRows(conceptosSheet, payload.conceptos);
    this.fillLogsRows(logsSheet, payload.logs);

    const fileName = `XML_Volumetricos_${format(new Date(), 'ddMMyyHHmmss')}.xlsx`;
    const fullPath = path.join(payload.outputDir, fileName);

    await workbook.xlsx.writeFile(fullPath);
    return fullPath;
  }

  private fillResumenRows(sheet: ExcelJS.Worksheet, rows: ResumenRecord[]): void {
    let rowIndex = CELL_MAP.RESUMEN_START_ROW;

    for (const row of rows) {
      this.copyRowStyle(sheet, CELL_MAP.RESUMEN_START_ROW, rowIndex);
      this.writeRow(sheet, rowIndex, [
        row.claveProdServ,
        row.producto,
        row.cantidad,
        row.valorUnitario,
        row.importe,
        row.iva,
        row.total,
        row.registros,
      ]);
      rowIndex++;
    }
  }

  private fillFacturasRows(sheet: ExcelJS.Worksheet, rows: FacturaRecord[]): void {
    let rowIndex = CELL_MAP.FACTURAS_START_ROW;

    for (const row of rows) {
      this.copyRowStyle(sheet, CELL_MAP.FACTURAS_START_ROW, rowIndex);
      this.writeRow(sheet, rowIndex, [
        row.archivoXML,
        row.uuid,
        row.fecha,
        row.serie,
        row.folio,
        row.formaPago,
        row.metodoPago,
        row.moneda,
        row.version,
        row.estatus,
        row.subTotal,
        row.total,
      ]);
      rowIndex++;
    }
  }

  private fillConceptosRows(sheet: ExcelJS.Worksheet, rows: ConceptoRecord[]): void {
    let rowIndex = CELL_MAP.CONCEPTOS_START_ROW;

    for (const row of rows) {
      this.copyRowStyle(sheet, CELL_MAP.CONCEPTOS_START_ROW, rowIndex);
      this.writeRow(sheet, rowIndex, [
        row.uuid,
        row.serie,
        row.folio,
        row.fecha,
        row.claveProdServ,
        row.descripcion,
        row.claveUnidad,
        row.unidad,
        row.cantidad,
        row.valorUnitario,
        row.importe,
        row.baseIVA,
        row.tasaIVA,
        row.IVA,
        row.total,
        row.estatus,
        row.observaciones,
        row.participaEnTotales ? 'Si' : 'No',
      ]);
      this.applyConceptStatusStyle(sheet, rowIndex, row.estatus);
      rowIndex++;
    }
  }

  private fillLogsRows(sheet: ExcelJS.Worksheet, rows: ProcessLog[]): void {
    let rowIndex = CELL_MAP.LOGS_START_ROW;

    for (const row of rows) {
      this.copyRowStyle(sheet, CELL_MAP.LOGS_START_ROW, rowIndex);
      this.writeRow(sheet, rowIndex, [
        row.archivoXML,
        row.estatus,
        row.mensajePrincipal,
        row.totalConceptos,
        row.conceptosIncluidosTotales,
        row.conceptosExcluidosTotales,
        row.observacionesGenerales,
        row.uuid,
        row.serie,
        row.folio,
        row.fecha,
      ]);
      rowIndex++;
    }
  }

  private writeRow(
    sheet: ExcelJS.Worksheet,
    rowIndex: number,
    values: Array<string | number | null | undefined>
  ): void {
    values.forEach((value, index) => {
      sheet.getCell(rowIndex, index + 1).value = value ?? null;
    });
  }

  private clearWorksheetRows(sheet: ExcelJS.Worksheet, startRow: number): void {
    const maxRows = sheet.rowCount;
    const maxCols = sheet.columnCount || 20;

    for (let rowIndex = startRow; rowIndex <= maxRows; rowIndex++) {
      for (let colIndex = 1; colIndex <= maxCols; colIndex++) {
        sheet.getCell(rowIndex, colIndex).value = null;
      }
    }
  }

  private applyConceptStatusStyle(
    sheet: ExcelJS.Worksheet,
    rowIndex: number,
    estatus: ValidationSeverity,
  ): void {
    const fillColor = EXCEL_STATUS_FILL_COLORS[estatus];
    if (!fillColor) {
      return;
    }

    const maxCols = sheet.columnCount || 20;

    for (let colIndex = 1; colIndex <= maxCols; colIndex++) {
      const cell = sheet.getCell(rowIndex, colIndex);
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: fillColor },
      };
    }
  }

  private copyRowStyle(sheet: ExcelJS.Worksheet, sourceRowNumber: number, targetRowNumber: number): void {
    if (sourceRowNumber === targetRowNumber) {
      return;
    }

    const sourceRow = sheet.getRow(sourceRowNumber);
    const targetRow = sheet.getRow(targetRowNumber);
    const maxCols = sheet.columnCount || 20;

    for (let colIndex = 1; colIndex <= maxCols; colIndex++) {
      const sourceCell = sourceRow.getCell(colIndex);
      const targetCell = targetRow.getCell(colIndex);

      if (sourceCell.style) {
        targetCell.style = JSON.parse(JSON.stringify(sourceCell.style));
      }

      if (sourceCell.numFmt) {
        targetCell.numFmt = sourceCell.numFmt;
      }
    }

    if (sourceRow.height) {
      targetRow.height = sourceRow.height;
    }
  }
}