export type ValidationSeverity = 'OK' | 'WARNING' | 'ERROR';

export type ValidationScope = 'XML' | 'FACTURA' | 'CONCEPTO' | 'TOTALES';

export interface ValidationIssue {
  code: string;
  severity: Exclude<ValidationSeverity, 'OK'>;
  scope: ValidationScope;
  message: string;
  conceptIndex?: number;
  field?: string;
}

export interface ProcessLog {
  archivoXML: string;
  fecha: string;
  estatus: ValidationSeverity;
  mensajePrincipal: string;
  observacionesGenerales: string;
  totalConceptos: number;
  conceptosIncluidosTotales: number;
  conceptosExcluidosTotales: number;
  uuid: string;
  serie: string;
  folio: string;
}

export interface ParsedFacturaRaw {
  archivoXML: string;
  version: string;
  uuid: string;
  fecha: string;
  serie: string;
  folio: string;
  formaPago: string;
  metodoPago: string;
  moneda: string;
  subTotal: number | null;
  total: number | null;
  subTotalRaw: string;
  totalRaw: string;
  hasTimbreFiscal: boolean;
}

export interface ParsedConceptoRaw {
  uuid: string;
  serie: string;
  folio: string;
  fecha: string;
  claveProdServ: string;
  descripcion: string;
  claveUnidad: string;
  unidad: string;
  objetoImp: string;
  cantidad: number | null;
  valorUnitario: number | null;
  importe: number | null;
  baseIVA: number | null;
  tasaIVA: number | null;
  IVA: number | null;
  cantidadRaw: string;
  valorUnitarioRaw: string;
  importeRaw: string;
  tasaIVARaw: string;
  ivaRaw: string;
  hasIvaTraslado: boolean;
}

export interface ParsedCfdi {
  factura: ParsedFacturaRaw;
  conceptos: ParsedConceptoRaw[];
}

export interface FacturaValidationResult {
  severity: ValidationSeverity;
  issues: ValidationIssue[];
}

export interface ConceptoValidationResult {
  conceptIndex: number;
  severity: ValidationSeverity;
  issues: ValidationIssue[];
}

export interface XmlProcessingResult {
  archivoXML: string;
  estatus: ValidationSeverity;
  mensajePrincipal: string;
  observacionesGenerales: string;
  facturaRaw: ParsedFacturaRaw | null;
  conceptosRaw: ParsedConceptoRaw[];
  facturaRecord: FacturaRecord | null;
  conceptoRecords: ConceptoRecord[];
  conceptosIncluidosTotales: number;
  conceptosExcluidosTotales: number;
  issues: ValidationIssue[];
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
  version: string;
  estatus: ValidationSeverity;
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
  objetoImp: string;
  productoNormalizado: string;
  cantidad: number | null;
  valorUnitario: number | null;
  importe: number | null;
  baseIVA: number | null;
  tasaIVA: number | null;
  IVA: number | null;
  total: number | null;
  estatus: ValidationSeverity;
  observaciones: string;
  participaEnTotales: boolean;
  incidencias: ValidationIssue[];
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
  totalXmlOk: number;
  totalXmlWarning: number;
  totalXmlError: number;
  outputPath: string;
}

export interface ProcessProgress {
  current: number;
  total: number;
  message: string;
}
