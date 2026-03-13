export type LogLevel = 'INFO' | 'WARNING' | 'ERROR';

export interface ProcessLog {
  archivoXML: string;
  fecha: string;
  nivel: LogLevel;
  mensaje: string;
  detalle: string;
}

export interface FacturaRecord {
  archivoXML: string;
  uuid: string;
  fecha: string;
  serie: string;
  folio: string;
  formaPago: string;
  metodoPago: string;
  moneda: string;
  subTotal: number;
  total: number;
}

export interface ConceptoRecord {
  uuid: string;
  serie: string;
  folio: string;
  fecha: string;
  claveProdServ: string;
  descripcion: string;
  claveUnidad: string;
  unidad: string;
  cantidad: number;
  valorUnitario: number;
  importe: number;
  baseIVA: number;
  tasaIVA: number;
  IVA: number;
  total: number;
}

export interface ResumenRecord {
  claveProdServ: string;
  producto: string;
  cantidad: number;
  valorUnitario: number;
  importe: number;
  iva: number;
  total: number;
  registros: number;
}

export interface ProcessResult {
  facturas: FacturaRecord[];
  conceptos: ConceptoRecord[];
  resumen: ResumenRecord[];
  logs: ProcessLog[];
  totalXmlProcesados: number;
  totalXmlError: number;
  outputPath: string;
}

export interface ProcessProgress {
  current: number;
  total: number;
  message: string;
}
