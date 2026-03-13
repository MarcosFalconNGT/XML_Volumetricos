import path from 'node:path';
import { FileSystemService } from '../../infrastructure/fs/file-system.service';
import { CfdiXmlParser } from '../../infrastructure/xml/cfdi-xml.parser';
import { ExcelReportWriter } from '../../infrastructure/excel/excel-report.writer';
import { ProcessLogger } from '../../infrastructure/logging/process-logger';
import { ProcessProgress, ProcessResult, ResumenRecord } from '../../shared/types';

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
    let totalXmlError = 0;

    for (const [index, filePath] of xmlFiles.entries()) {
      const archivoXML = path.basename(filePath);

      input.onProgress?.({
        current: index + 1,
        total: xmlFiles.length,
        message: `Procesando ${archivoXML}`,
      });

      try {
        const parsed = await this.parser.parse(filePath);
        facturas.push(parsed.factura);
        conceptos.push(...parsed.conceptos);
        logger.add(archivoXML, 'INFO', 'XML procesado correctamente', `Conceptos detectados: ${parsed.conceptos.length}`);
      } catch (error) {
        totalXmlError += 1;
        logger.add(
          archivoXML,
          'ERROR',
          'Error al procesar XML',
          error instanceof Error ? error.message : 'Error desconocido',
        );
      }
    }

    const resumen = this.buildResumen(conceptos);
    const outputPath = await this.excelWriter.write({
      templatePath: input.templatePath,
      outputDir: input.outputDir,
      facturas,
      conceptos,
      resumen,
      logs: logger.all(),
      totalXmlProcesados: xmlFiles.length,
      totalXmlError,
    });

    logger.add('GLOBAL', 'INFO', 'Proceso completado', `Archivo generado: ${outputPath}`);

    return {
      facturas,
      conceptos,
      resumen,
      logs: logger.all(),
      totalXmlProcesados: xmlFiles.length,
      totalXmlError,
      outputPath,
    };
  }

  private buildResumen(conceptos: ProcessResult['conceptos']): ResumenRecord[] {
    const grouped = new Map<string, ResumenRecord>();

    for (const concepto of conceptos) {
      const key = `${concepto.claveProdServ}|${concepto.descripcion}|${concepto.valorUnitario.toFixed(6)}`;
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
        producto: concepto.descripcion,
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
