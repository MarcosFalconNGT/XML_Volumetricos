import path from 'node:path';
import os from 'node:os';

export const APP_NAME = 'XML Volumétricos';
export const TEMPLATE_RELATIVE_PATH = path.join('assets', 'templates', 'plantilla_XML_volumetricos.xlsx');
export const DEFAULT_OUTPUT_DIR = path.join(os.homedir(), 'Desktop');

export const SHEETS = {
  RESUMEN: 'Resumen_General',
  FACTURAS: 'Facturas',
  CONCEPTOS: 'Conceptos',
  LOGS: 'Logs',
} as const;

export const CELL_MAP = {
  FECHA_GENERACION: 'A4',
  TOTAL_XML_PROCESADOS: 'C4',
  TOTAL_XML_ERROR: 'E4',
  TOTAL_REGISTROS: 'G4',
  LITROS_TOTALES: 'A6',
  TOTAL_IMPORTE: 'C6',
  TOTAL_IVA: 'E6',
  TOTAL_FACTURADO: 'G6',
  RESUMEN_HEADER_ROW: 8,
  RESUMEN_START_ROW: 9,
  FACTURAS_HEADER_ROW: 1,
  FACTURAS_START_ROW: 2,
  CONCEPTOS_HEADER_ROW: 1,
  CONCEPTOS_START_ROW: 2,
  LOGS_HEADER_ROW: 1,
  LOGS_START_ROW: 2,
};

export const EXCEL_STATUS_FILL_COLORS = {
  OK: null,
  WARNING: 'FFFFE082',
  ERROR: 'FFFFCDD2',
} as const;

export const HIDROCARBON_KEYWORDS = ['MAGNA', 'PREMIUM', 'DIESEL'];
export const HIDROCARBON_KEYS = ['15101514', '15101515', '15101505'];
