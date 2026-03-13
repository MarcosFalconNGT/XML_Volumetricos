import path from 'node:path';
import { FileSystemService } from '../../infrastructure/fs/file-system.service';
import { CfdiXmlParser } from '../../infrastructure/xml/cfdi-xml.parser';
import { ExcelReportWriter } from '../../infrastructure/excel/excel-report.writer';
import { ProcessLogger } from '../../infrastructure/logging/process-logger';
import { CfdiValidator } from '../../domain/services/cfdi-validator';
import { CfdiTransformer } from '../services/cfdi-transformer';
import {
  ParsedCfdi,
  ProcessProgress,
  ProcessResult,
  ResumenRecord,
  ValidationIssue,
  ValidationSeverity,
  XmlProcessingResult,
} from '../../shared/types';

interface ParsedFileResult {
  archivoXML: string;
  parsed: ParsedCfdi | null;
  parseError: string;
}

export interface ProcessXmlBatchInput {
  inputDir: string;
  outputDir: string;
  templatePath: string;
  onProgress?: (progress: ProcessProgress) => void;
}

export class ProcessXmlBatchUseCase {
  constructor(
    private readonly fsService: FileSystemService,
    private readonly parser: CfdiXmlParser,
    private readonly excelWriter: ExcelReportWriter,
    private readonly validator: CfdiValidator = new CfdiValidator(),
    private readonly transformer: CfdiTransformer = new CfdiTransformer(),
  ) {}

  public async execute(input: ProcessXmlBatchInput): Promise<ProcessResult> {
    const logger = new ProcessLogger();
    const xmlFiles = await this.fsService.listXmlFiles(input.inputDir);

    if (xmlFiles.length === 0) {
      throw new Error('No se encontraron archivos XML en la carpeta seleccionada.');
    }

    await this.fsService.ensureDirectory(input.outputDir);

    const facturas = [] as ProcessResult['facturas'];
    const conceptos = [] as ProcessResult['conceptos'];
    const parsedFiles: ParsedFileResult[] = [];

    for (const [index, filePath] of xmlFiles.entries()) {
      const archivoXML = path.basename(filePath);

      input.onProgress?.({
        current: index + 1,
        total: xmlFiles.length,
        message: `Procesando ${archivoXML}`,
      });

      try {
        const parsed = await this.parser.parse(filePath);
        parsedFiles.push({
          archivoXML,
          parsed,
          parseError: '',
        });
      } catch (error) {
        parsedFiles.push({
          archivoXML,
          parsed: null,
          parseError: error instanceof Error ? error.message : 'Error desconocido',
        });
      }
    }

    const duplicateUuids = this.findDuplicateUuids(parsedFiles);
    const processingResults = parsedFiles.map((item) => this.processParsedFile(item, duplicateUuids));

    for (const result of processingResults) {
      if (result.facturaRecord) {
        facturas.push(result.facturaRecord);
      }
      conceptos.push(...result.conceptoRecords);

      logger.add({
        archivoXML: result.archivoXML,
        estatus: result.estatus,
        mensajePrincipal: result.mensajePrincipal,
        observacionesGenerales: result.observacionesGenerales,
        totalConceptos: result.conceptosRaw.length,
        conceptosIncluidosTotales: result.conceptosIncluidosTotales,
        conceptosExcluidosTotales: result.conceptosExcluidosTotales,
        uuid: result.facturaRaw?.uuid ?? '',
        serie: result.facturaRaw?.serie ?? '',
        folio: result.facturaRaw?.folio ?? '',
      });
    }

    const totalXmlError = processingResults.filter((item) => item.estatus === 'ERROR').length;
    const totalXmlWarning = processingResults.filter((item) => item.estatus === 'WARNING').length;
    const totalXmlOk = processingResults.filter((item) => item.estatus === 'OK').length;
    const totalConceptosProcesados = processingResults.reduce((sum, item) => sum + item.conceptosRaw.length, 0);
    const totalConceptosIncluidosTotales = processingResults.reduce(
      (sum, item) => sum + item.conceptosIncluidosTotales,
      0,
    );
    const totalConceptosExcluidosTotales = processingResults.reduce(
      (sum, item) => sum + item.conceptosExcluidosTotales,
      0,
    );

    const resumen = this.buildResumen(conceptos);
    const outputPath = await this.excelWriter.write({
      templatePath: input.templatePath,
      outputDir: input.outputDir,
      facturas,
      conceptos,
      resumen,
      logs: logger.all(),
      totalXmlProcesados: xmlFiles.length,
      totalXmlOk,
      totalXmlWarning,
      totalXmlError,
    });

    logger.add({
      archivoXML: 'GLOBAL',
      estatus: 'OK',
      mensajePrincipal: 'Proceso completado',
      observacionesGenerales: `Archivo generado: ${outputPath}`,
      totalConceptos: totalConceptosProcesados,
      conceptosIncluidosTotales: totalConceptosIncluidosTotales,
      conceptosExcluidosTotales: totalConceptosExcluidosTotales,
    });

    return {
      facturas,
      conceptos,
      resumen,
      logs: logger.all(),
      totalXmlProcesados: xmlFiles.length,
      totalXmlOk,
      totalXmlWarning,
      totalXmlError,
      outputPath,
    };
  }

  private processParsedFile(item: ParsedFileResult, duplicateUuids: Set<string>): XmlProcessingResult {
    if (!item.parsed) {
      return {
        archivoXML: item.archivoXML,
        estatus: 'ERROR',
        mensajePrincipal: 'Error al procesar XML',
        observacionesGenerales: item.parseError,
        facturaRaw: null,
        conceptosRaw: [],
        facturaRecord: null,
        conceptoRecords: [],
        conceptosIncluidosTotales: 0,
        conceptosExcluidosTotales: 0,
        issues: [
          {
            code: 'XML_PARSE_ERROR',
            severity: 'ERROR',
            scope: 'XML',
            message: item.parseError,
          },
        ],
      };
    }

    const validation = this.validator.validate(item.parsed, { duplicateUuids });
    const estatus = validation.severity;

    const facturaRecord = this.transformer.toFacturaRecord(item.parsed, estatus);
    const conceptoRecords = this.transformer.toConceptoRecords(item.parsed, validation.conceptos);
    const conceptosIncluidosTotales = conceptoRecords.filter((concepto) => concepto.participaEnTotales).length;
    const conceptosExcluidosTotales = item.parsed.conceptos.length - conceptosIncluidosTotales;
    const observacionesGenerales = this.buildIssuesDetail(validation.issues);

    return {
      archivoXML: item.archivoXML,
      estatus,
      mensajePrincipal: this.getMainMessage(estatus),
      observacionesGenerales,
      facturaRaw: item.parsed.factura,
      conceptosRaw: item.parsed.conceptos,
      facturaRecord,
      conceptoRecords,
      conceptosIncluidosTotales,
      conceptosExcluidosTotales,
      issues: validation.issues,
    };
  }

  private getMainMessage(estatus: ValidationSeverity): string {
    if (estatus === 'OK') {
      return 'XML procesado correctamente';
    }

    if (estatus === 'WARNING') {
      return 'XML procesado con advertencias';
    }

    return 'XML procesado con errores de validación';
  }

  private buildIssuesDetail(issues: ValidationIssue[]): string {
    if (issues.length === 0) {
      return '';
    }

    return issues.map((issue) => issue.message).join('; ');
  }

  private findDuplicateUuids(parsedFiles: ParsedFileResult[]): Set<string> {
    const occurrences = new Map<string, number>();

    for (const item of parsedFiles) {
      const uuid = item.parsed?.factura.uuid.trim();
      if (!uuid) {
        continue;
      }

      const count = occurrences.get(uuid) ?? 0;
      occurrences.set(uuid, count + 1);
    }

    const duplicates = new Set<string>();
    for (const [uuid, count] of occurrences.entries()) {
      if (count > 1) {
        duplicates.add(uuid);
      }
    }

    return duplicates;
  }

  private buildResumen(conceptos: ProcessResult['conceptos']): ResumenRecord[] {
    const grouped = new Map<string, ResumenRecord>();

    for (const concepto of conceptos) {
      if (!concepto.participaEnTotales) {
        continue;
      }

      if (
        concepto.cantidad === null ||
        concepto.valorUnitario === null ||
        concepto.importe === null ||
        concepto.IVA === null ||
        concepto.total === null
      ) {
        continue;
      }

      const productoResumen = concepto.productoNormalizado !== 'NO_RECONOCIDO'
        ? concepto.productoNormalizado
        : concepto.descripcion;
      const key = `${concepto.claveProdServ}|${productoResumen}|${concepto.valorUnitario.toFixed(6)}`;
      const existing = grouped.get(key);

      if (existing) {
        existing.cantidad += concepto.cantidad;
        existing.importe += concepto.importe;
        existing.iva += concepto.IVA;
        existing.total += concepto.total;
        existing.registros += 1;
        continue;
      }

      grouped.set(key, {
        claveProdServ: concepto.claveProdServ,
        producto: productoResumen,
        cantidad: concepto.cantidad,
        valorUnitario: concepto.valorUnitario,
        importe: concepto.importe,
        iva: concepto.IVA,
        total: concepto.total,
        registros: 1,
      });
    }

    return [...grouped.values()].sort((a, b) => {
      const byProduct = a.producto.localeCompare(b.producto);
      return byProduct !== 0 ? byProduct : a.valorUnitario - b.valorUnitario;
    });
  }
}
