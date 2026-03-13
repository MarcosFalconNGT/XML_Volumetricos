import { normalizeProduct } from './hydrocarbon-classifier';
import {
  ConceptoValidationResult,
  FacturaValidationResult,
  ParsedCfdi,
  ParsedConceptoRaw,
  ParsedFacturaRaw,
  ValidationIssue,
  ValidationSeverity,
} from '../../shared/types';

export interface CfdiValidationConfig {
  preferredVersion: string;
  preferredCurrency: string;
  expectedIvaRate: number;
  totalTolerance: number;
  maxDecimals: number;
}

export interface CfdiValidationContext {
  duplicateUuids: Set<string>;
}

export interface CfdiValidationResult {
  factura: FacturaValidationResult;
  conceptos: ConceptoValidationResult[];
  issues: ValidationIssue[];
  severity: ValidationSeverity;
}

const DEFAULT_CONFIG: CfdiValidationConfig = {
  preferredVersion: '4.0',
  preferredCurrency: 'MXN',
  expectedIvaRate: 0.16,
  totalTolerance: 0.01,
  maxDecimals: 6,
};

export class CfdiValidator {
  constructor(private readonly config: CfdiValidationConfig = DEFAULT_CONFIG) {}

  public validate(parsed: ParsedCfdi, context: CfdiValidationContext): CfdiValidationResult {
    const factura = this.validateFactura(parsed.factura, parsed.conceptos, context);
    const conceptos = parsed.conceptos.map((concepto, index) => this.validateConcepto(concepto, index));

    const issues = [...factura.issues, ...conceptos.flatMap((item) => item.issues)];

    return {
      factura,
      conceptos,
      issues,
      severity: this.getSeverityFromIssues(issues),
    };
  }

  public validateFactura(
    factura: ParsedFacturaRaw,
    conceptos: ParsedConceptoRaw[],
    context: CfdiValidationContext,
  ): FacturaValidationResult {
    const issues: ValidationIssue[] = [];

    if (conceptos.length === 0) {
      issues.push(this.issue('NO_CONCEPTOS', 'ERROR', 'FACTURA', 'El XML no contiene conceptos.'));
    }

    if (!factura.uuid) {
      issues.push(this.issue('UUID_EMPTY', 'WARNING', 'FACTURA', 'UUID vacío.'));
    } else if (context.duplicateUuids.has(factura.uuid)) {
      issues.push(this.issue('UUID_DUPLICATE', 'WARNING', 'FACTURA', `UUID duplicado en lote: ${factura.uuid}`));
    }

    if (!factura.hasTimbreFiscal) {
      issues.push(this.issue('TIMBRE_MISSING', 'WARNING', 'FACTURA', 'XML sin complemento de timbre fiscal.'));
    }

    if (factura.version && factura.version !== this.config.preferredVersion) {
      issues.push(
        this.issue(
          'VERSION_UNEXPECTED',
          'WARNING',
          'FACTURA',
          `Version CFDI ${factura.version}; se prefiere ${this.config.preferredVersion}.`,
        ),
      );
    }

    if (factura.moneda && factura.moneda !== this.config.preferredCurrency) {
      issues.push(
        this.issue(
          'CURRENCY_UNEXPECTED',
          'WARNING',
          'FACTURA',
          `Moneda ${factura.moneda}; se prefiere ${this.config.preferredCurrency}.`,
        ),
      );
    }

    if (factura.subTotal === null) {
      issues.push(this.issue('SUBTOTAL_MISSING', 'ERROR', 'FACTURA', 'SubTotal faltante o inválido.', 'SubTotal'));
    } else if (factura.subTotal < 0) {
      issues.push(this.issue('SUBTOTAL_NEGATIVE', 'ERROR', 'FACTURA', 'SubTotal negativo.', 'SubTotal'));
    }

    if (factura.total === null) {
      issues.push(this.issue('TOTAL_MISSING', 'ERROR', 'FACTURA', 'Total faltante o inválido.', 'Total'));
    } else if (factura.total < 0) {
      issues.push(this.issue('TOTAL_NEGATIVE', 'ERROR', 'FACTURA', 'Total negativo.', 'Total'));
    }

    const expectedTotal = this.calculateExpectedTotal(conceptos);
    if (factura.total !== null && expectedTotal !== null) {
      if (!this.areClose(factura.total, expectedTotal, this.config.totalTolerance)) {
        issues.push(
          this.issue(
            'TOTAL_INCONSISTENT',
            'WARNING',
            'TOTALES',
            `Total inconsistente. XML=${factura.total.toFixed(6)} esperado=${expectedTotal.toFixed(6)}.`,
          ),
        );
      }
    }

    return {
      severity: this.getSeverityFromIssues(issues),
      issues,
    };
  }

  public validateConcepto(concepto: ParsedConceptoRaw, conceptIndex: number): ConceptoValidationResult {
    const issues: ValidationIssue[] = [];

    if (!concepto.claveProdServ) {
      issues.push(
        this.issue('CLAVE_PROD_SERV_MISSING', 'ERROR', 'CONCEPTO', 'ClaveProdServ obligatoria.', 'ClaveProdServ', conceptIndex),
      );
    } else if (!/^\d{8}$/.test(concepto.claveProdServ)) {
      issues.push(
        this.issue(
          'CLAVE_PROD_SERV_SUSPICIOUS',
          'WARNING',
          'CONCEPTO',
          `ClaveProdServ sospechosa: ${concepto.claveProdServ}.`,
          'ClaveProdServ',
          conceptIndex,
        ),
      );
    }

    if (!concepto.descripcion) {
      issues.push(
        this.issue('DESCRIPCION_MISSING', 'WARNING', 'CONCEPTO', 'Descripcion vacía.', 'Descripcion', conceptIndex),
      );
    }

    if (concepto.cantidad === null) {
      issues.push(this.issue('CANTIDAD_MISSING', 'ERROR', 'CONCEPTO', 'Cantidad faltante o inválida.', 'Cantidad', conceptIndex));
    } else if (concepto.cantidad <= 0) {
      issues.push(this.issue('CANTIDAD_INVALID', 'ERROR', 'CONCEPTO', 'Cantidad debe ser mayor a 0.', 'Cantidad', conceptIndex));
    }

    if (concepto.valorUnitario === null) {
      issues.push(
        this.issue('VALOR_UNITARIO_MISSING', 'ERROR', 'CONCEPTO', 'ValorUnitario faltante o inválido.', 'ValorUnitario', conceptIndex),
      );
    } else if (concepto.valorUnitario <= 0) {
      issues.push(
        this.issue('VALOR_UNITARIO_INVALID', 'ERROR', 'CONCEPTO', 'ValorUnitario debe ser mayor a 0.', 'ValorUnitario', conceptIndex),
      );
    }

    if (concepto.importe === null) {
      issues.push(this.issue('IMPORTE_MISSING', 'ERROR', 'CONCEPTO', 'Importe faltante o inválido.', 'Importe', conceptIndex));
    } else if (concepto.importe < 0) {
      issues.push(this.issue('IMPORTE_NEGATIVE', 'ERROR', 'CONCEPTO', 'Importe no puede ser negativo.', 'Importe', conceptIndex));
    }

    if (concepto.cantidad !== null && concepto.valorUnitario !== null && concepto.importe !== null) {
      const importeEsperado = concepto.cantidad * concepto.valorUnitario;
      if (!this.areClose(concepto.importe, importeEsperado, this.config.totalTolerance)) {
        issues.push(
          this.issue(
            'CONCEPT_TOTAL_INCONSISTENT',
            'WARNING',
            'CONCEPTO',
            `Importe inconsistente. XML=${concepto.importe.toFixed(6)} esperado=${importeEsperado.toFixed(6)}.`,
            'Importe',
            conceptIndex,
          ),
        );
      }
    }

    if (concepto.objetoImp === '02' && !concepto.hasIvaTraslado) {
      issues.push(
        this.issue(
          'IVA_REQUIRED_OBJETO_IMP_02',
          'WARNING',
          'CONCEPTO',
          'ObjetoImp=02 sin traslado de IVA.',
          'Impuestos.Traslados',
          conceptIndex,
        ),
      );
    }

    if (concepto.hasIvaTraslado && concepto.IVA === null) {
      issues.push(this.issue('IVA_MISSING', 'WARNING', 'CONCEPTO', 'IVA faltante.', 'Impuestos.Traslados.Traslado.Importe', conceptIndex));
    } else if (concepto.IVA !== null && concepto.IVA < 0) {
      issues.push(this.issue('IVA_NEGATIVE', 'WARNING', 'CONCEPTO', 'IVA negativo.', 'Impuestos.Traslados.Traslado.Importe', conceptIndex));
    }

    if (concepto.tasaIVA !== null && !this.areClose(concepto.tasaIVA, this.config.expectedIvaRate, 0.000001)) {
      issues.push(
        this.issue(
          'IVA_RATE_UNEXPECTED',
          'WARNING',
          'CONCEPTO',
          `Tasa IVA ${concepto.tasaIVA.toFixed(6)} distinta a ${this.config.expectedIvaRate.toFixed(6)}.`,
          'Impuestos.Traslados.Traslado.TasaOCuota',
          conceptIndex,
        ),
      );
    }

    const normalizedProduct = normalizeProduct(concepto.descripcion, concepto.claveProdServ);
    if (!normalizedProduct) {
      issues.push(
        this.issue(
          'PRODUCT_NOT_RECOGNIZED',
          'WARNING',
          'CONCEPTO',
          'Concepto no reconocido por normalizeProduct.',
          'Descripcion',
          conceptIndex,
        ),
      );
    }

    return {
      conceptIndex,
      severity: this.getSeverityFromIssues(issues),
      issues,
    };
  }

  public calculateExpectedTotal(conceptos: ParsedConceptoRaw[]): number | null {
    let subtotal = 0;
    let iva = 0;

    for (const concepto of conceptos) {
      if (concepto.importe === null) {
        return null;
      }
      subtotal += concepto.importe;

      if (concepto.IVA !== null) {
        iva += concepto.IVA;
      }
    }

    return subtotal + iva;
  }

  public areClose(a: number, b: number, tolerance: number): boolean {
    return Math.abs(a - b) <= tolerance;
  }

  private addDecimalWarning(
    issues: ValidationIssue[],
    code: string,
    rawValue: string,
    field: string,
    conceptIndex?: number,
  ): void {
    const decimals = this.countDecimals(rawValue);
    if (decimals > this.config.maxDecimals) {
      issues.push(
        this.issue(
          code,
          'WARNING',
          conceptIndex === undefined ? 'FACTURA' : 'CONCEPTO',
          `${field} con muchos decimales (${decimals}).`,
          field,
          conceptIndex,
        ),
      );
    }
  }

  private countDecimals(rawValue: string): number {
    const normalized = rawValue.trim();
    if (!normalized.includes('.')) {
      return 0;
    }

    return normalized.split('.')[1].length;
  }

  private issue(
    code: string,
    severity: Exclude<ValidationSeverity, 'OK'>,
    scope: 'XML' | 'FACTURA' | 'CONCEPTO' | 'TOTALES',
    message: string,
    field?: string,
    conceptIndex?: number,
  ): ValidationIssue {
    return {
      code,
      severity,
      scope,
      message,
      field,
      conceptIndex,
    };
  }

  private getSeverityFromIssues(issues: ValidationIssue[]): ValidationSeverity {
    if (issues.some((issue) => issue.severity === 'ERROR')) {
      return 'ERROR';
    }

    if (issues.some((issue) => issue.severity === 'WARNING')) {
      return 'WARNING';
    }

    return 'OK';
  }
}
