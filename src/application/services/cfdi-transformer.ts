import { normalizeProduct } from '../../domain/services/hydrocarbon-classifier';
import {
  ConceptoRecord,
  ConceptoValidationResult,
  ParsedCfdi,
  FacturaRecord,
  ValidationSeverity,
} from '../../shared/types';

export class CfdiTransformer {
  private static readonly WARNING_CODES_EXCLUDED_FROM_TOTALS = new Set<string>([
    'IVA_REQUIRED_OBJETO_IMP_02',
    'IVA_MISSING',
    'IVA_NEGATIVE',
    'CONCEPT_TOTAL_INCONSISTENT',
  ]);

  public toFacturaRecord(parsed: ParsedCfdi, estatus: ValidationSeverity): FacturaRecord {
    return {
      archivoXML: parsed.factura.archivoXML,
      uuid: parsed.factura.uuid,
      fecha: parsed.factura.fecha,
      serie: parsed.factura.serie,
      folio: parsed.factura.folio,
      formaPago: parsed.factura.formaPago,
      metodoPago: parsed.factura.metodoPago,
      moneda: parsed.factura.moneda,
      version: parsed.factura.version,
      estatus,
      subTotal: parsed.factura.subTotal ?? 0,
      total: parsed.factura.total ?? 0,
    };
  }

  public toConceptoRecords(
    parsed: ParsedCfdi,
    conceptValidations: ConceptoValidationResult[],
  ): ConceptoRecord[] {
    const records: ConceptoRecord[] = [];

    parsed.conceptos.forEach((concepto, index) => {
      const validation = conceptValidations[index];
      const incidencias = validation?.issues ?? [];
      const estatus = this.getSeverity(incidencias);
      const productoNormalizado = normalizeProduct(concepto.descripcion, concepto.claveProdServ);

      // Solo exportamos conceptos de hidrocarburos al listado de Conceptos.
      if (!productoNormalizado) {
        return;
      }

      const observaciones = incidencias.map((issue) => issue.message).join('; ');

      const total = concepto.importe !== null
        ? concepto.importe + (concepto.IVA ?? 0)
        : null;
      const participaEnTotales = this.shouldParticipateInTotals(incidencias, {
        cantidad: concepto.cantidad,
        valorUnitario: concepto.valorUnitario,
        importe: concepto.importe,
        iva: concepto.IVA,
        total,
      });

      records.push({
        uuid: concepto.uuid,
        serie: concepto.serie,
        folio: concepto.folio,
        fecha: concepto.fecha,
        claveProdServ: concepto.claveProdServ,
        descripcion: concepto.descripcion,
        claveUnidad: concepto.claveUnidad,
        unidad: concepto.unidad,
        objetoImp: concepto.objetoImp,
        productoNormalizado,
        cantidad: concepto.cantidad,
        valorUnitario: concepto.valorUnitario,
        importe: concepto.importe,
        baseIVA: concepto.baseIVA,
        tasaIVA: concepto.tasaIVA,
        IVA: concepto.IVA,
        total,
        estatus,
        observaciones,
        participaEnTotales,
        incidencias,
      });
    });

    return records;
  }

  private getSeverity(issues: ConceptoValidationResult['issues']): ValidationSeverity {
    if (issues.some((issue) => issue.severity === 'ERROR')) {
      return 'ERROR';
    }

    if (issues.some((issue) => issue.severity === 'WARNING')) {
      return 'WARNING';
    }

    return 'OK';
  }

  private shouldParticipateInTotals(
    issues: ConceptoValidationResult['issues'],
    values: {
      cantidad: number | null;
      valorUnitario: number | null;
      importe: number | null;
      iva: number | null;
      total: number | null;
    },
  ): boolean {
    if (
      values.cantidad === null ||
      values.valorUnitario === null ||
      values.importe === null ||
      values.iva === null ||
      values.total === null
    ) {
      return false;
    }

    if (issues.some((issue) => issue.severity === 'ERROR')) {
      return false;
    }

    return !issues.some((issue) =>
      issue.severity === 'WARNING' && CfdiTransformer.WARNING_CODES_EXCLUDED_FROM_TOTALS.has(issue.code),
    );
  }
}
