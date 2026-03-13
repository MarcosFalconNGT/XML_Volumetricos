import path from 'node:path';
import { format } from 'date-fns';
import ExcelJS from 'exceljs';
import { CELL_MAP, SHEETS } from '../../shared/constants';
import { ConceptoRecord, FacturaRecord, ProcessLog, ResumenRecord } from '../../shared/types';

export interface ExcelWritePayload {
  templatePath: string;
  outputDir: string;
  facturas: FacturaRecord[];
  conceptos: ConceptoRecord[];
  resumen: ResumenRecord[];
  logs: ProcessLog[];
  totalXmlProcesados: number;
  totalXmlError: number;
}

const START_ROWS = {
  RESUMEN: 7,
  FACTURAS: 2,
  CONCEPTOS: 2,
  LOGS: 2,
};

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
    this.clearWorksheetRows(resumenSheet, START_ROWS.RESUMEN);
    this.clearWorksheetRows(facturasSheet, START_ROWS.FACTURAS);
    this.clearWorksheetRows(conceptosSheet, START_ROWS.CONCEPTOS);
    this.clearWorksheetRows(logsSheet, START_ROWS.LOGS);

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
    let rowIndex = START_ROWS.RESUMEN;

    for (const row of rows) {
      this.copyRowStyle(sheet, START_ROWS.RESUMEN, rowIndex);
      this.writeRow(sheet, rowIndex, [
        row.claveProdServ,
        row.producto,
        row.cantidad,
        row.valorUnitario,
        row.importe,
        row.registros,
      ]);
      rowIndex++;
    }
  }

  private fillFacturasRows(sheet: ExcelJS.Worksheet, rows: FacturaRecord[]): void {
    let rowIndex = START_ROWS.FACTURAS;

    for (const row of rows) {
      this.copyRowStyle(sheet, START_ROWS.FACTURAS, rowIndex);
      this.writeRow(sheet, rowIndex, [
        row.archivoXML,
        row.uuid,
        row.fecha,
        row.serie,
        row.folio,
        row.formaPago,
        row.metodoPago,
        row.moneda,
        row.subTotal,
        row.total,
      ]);
      rowIndex++;
    }
  }

  private fillConceptosRows(sheet: ExcelJS.Worksheet, rows: ConceptoRecord[]): void {
    let rowIndex = START_ROWS.CONCEPTOS;

    for (const row of rows) {
      this.copyRowStyle(sheet, START_ROWS.CONCEPTOS, rowIndex);
      this.writeRow(sheet, rowIndex, [
        row.archivoXML,
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
      ]);
      rowIndex++;
    }
  }

  private fillLogsRows(sheet: ExcelJS.Worksheet, rows: ProcessLog[]): void {
    let rowIndex = START_ROWS.LOGS;

    for (const row of rows) {
      this.copyRowStyle(sheet, START_ROWS.LOGS, rowIndex);
      this.writeRow(sheet, rowIndex, [
        row.archivoXML,
        row.fecha,
        row.nivel,
        row.mensaje,
        row.detalle,
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