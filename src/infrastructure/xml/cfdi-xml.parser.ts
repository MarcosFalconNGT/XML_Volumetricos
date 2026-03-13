import fs from 'node:fs/promises';
import path from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import { ParsedCfdi } from '../../domain/entities/cfdi';
import { ParsedConceptoRaw, ParsedFacturaRaw } from '../../shared/types';

interface CfdiNode {
  [key: string]: unknown;
}

export class CfdiXmlParser {
  private readonly parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    removeNSPrefix: true,
    parseTagValue: false,
    trimValues: true,
  });

  public async parse(filePath: string): Promise<ParsedCfdi> {
    const xmlContent = await fs.readFile(filePath, 'utf-8');
    const parsed = this.parser.parse(xmlContent) as { Comprobante?: CfdiNode };
    const comprobante = parsed.Comprobante;

    if (!comprobante) {
      throw new Error('No se encontró el nodo Comprobante en el XML.');
    }

    const conceptosNode = (comprobante.Conceptos as CfdiNode | undefined)?.Concepto;
    const conceptosArray = Array.isArray(conceptosNode)
      ? conceptosNode
      : conceptosNode
        ? [conceptosNode]
        : [];

    const archivoXML = path.basename(filePath);
    const serie = this.getString(comprobante.Serie);
    const folio = this.getString(comprobante.Folio);
    const fecha = this.getString(comprobante.Fecha);

    const timbre = this.extractTimbreData(comprobante);

    const factura: ParsedFacturaRaw = {
      archivoXML,
      version: this.getString(comprobante.Version),
      uuid: timbre.uuid,
      fecha,
      serie,
      folio,
      formaPago: this.getString(comprobante.FormaPago),
      metodoPago: this.getString(comprobante.MetodoPago),
      moneda: this.getString(comprobante.Moneda),
      subTotal: this.getOptionalNumber(comprobante.SubTotal),
      total: this.getOptionalNumber(comprobante.Total),
      subTotalRaw: this.getString(comprobante.SubTotal),
      totalRaw: this.getString(comprobante.Total),
      hasTimbreFiscal: timbre.exists,
    };

    const conceptos = conceptosArray.map((concepto) =>
      this.mapConcepto(timbre.uuid, serie, folio, fecha, concepto as CfdiNode),
    );

    return { factura, conceptos };
  }

  private mapConcepto(
    uuid: string,
    serie: string,
    folio: string,
    fecha: string,
    concepto: CfdiNode,
  ): ParsedConceptoRaw {
    const claveProdServ = this.getString(concepto.ClaveProdServ);
    const descripcion = this.getString(concepto.Descripcion);

    const impuestos = this.extractConceptIva(concepto);

    return {
      uuid,
      serie,
      folio,
      fecha,
      claveProdServ,
      descripcion,
      claveUnidad: this.getString(concepto.ClaveUnidad),
      unidad: this.getString(concepto.Unidad),
      objetoImp: this.getString(concepto.ObjetoImp),
      cantidad: this.getOptionalNumber(concepto.Cantidad),
      valorUnitario: this.getOptionalNumber(concepto.ValorUnitario),
      importe: this.getOptionalNumber(concepto.Importe),
      baseIVA: impuestos.baseIva,
      tasaIVA: impuestos.tasaIva,
      IVA: impuestos.iva,
      cantidadRaw: this.getString(concepto.Cantidad),
      valorUnitarioRaw: this.getString(concepto.ValorUnitario),
      importeRaw: this.getString(concepto.Importe),
      tasaIVARaw: impuestos.tasaIvaRaw,
      ivaRaw: impuestos.ivaRaw,
      hasIvaTraslado: impuestos.hasIvaTraslado,
    };
  }

  private extractTimbreData(comprobante: CfdiNode): { uuid: string; exists: boolean } {
    const complemento = comprobante.Complemento as CfdiNode | undefined;
    if (!complemento) {
      return { uuid: '', exists: false };
    }

    const timbre = (complemento.TimbreFiscalDigital as CfdiNode | undefined) ||
      ((complemento as Record<string, unknown>)['tfd:TimbreFiscalDigital'] as CfdiNode | undefined);

    if (!timbre) {
      return { uuid: '', exists: false };
    }

    return { uuid: this.getString(timbre.UUID), exists: true };
  }

  private extractConceptIva(concepto: CfdiNode): {
    baseIva: number | null;
    tasaIva: number | null;
    iva: number | null;
    tasaIvaRaw: string;
    ivaRaw: string;
    hasIvaTraslado: boolean;
  } {
    const impuestosNode = concepto.Impuestos as CfdiNode | undefined;
    const trasladosNode = (impuestosNode?.Traslados as CfdiNode | undefined)?.Traslado;

    const traslados = Array.isArray(trasladosNode)
      ? trasladosNode
      : trasladosNode
        ? [trasladosNode]
        : [];

    let baseIvaSum = 0;
    let ivaSum = 0;
    let hasBase = false;
    let hasIva = false;
    let tasaIva: number | null = null;
    let tasaIvaRaw = '';
    let ivaRaw = '';
    let hasIvaTraslado = false;

    for (const traslado of traslados as CfdiNode[]) {
      const impuesto = this.getString(traslado.Impuesto);

      if (impuesto === '002') {
        hasIvaTraslado = true;

        const base = this.getOptionalNumber(traslado.Base);
        if (base !== null) {
          hasBase = true;
          baseIvaSum += base;
        }

        const iva = this.getOptionalNumber(traslado.Importe);
        if (iva !== null) {
          hasIva = true;
          ivaSum += iva;
          ivaRaw = this.getString(traslado.Importe);
        }

        const tasa = this.getOptionalNumber(traslado.TasaOCuota);
        if (tasa !== null) {
          tasaIva = tasa;
          tasaIvaRaw = this.getString(traslado.TasaOCuota);
        }
      }
    }

    return {
      baseIva: hasBase ? baseIvaSum : null,
      tasaIva,
      iva: hasIva ? ivaSum : null,
      tasaIvaRaw,
      ivaRaw,
      hasIvaTraslado,
    };
  }


  private getString(value: unknown): string {
    return value == null ? '' : String(value).trim();
  }

  private getOptionalNumber(value: unknown): number | null {
    const raw = this.getString(value);
    if (!raw) {
      return null;
    }

    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private requireNumber(value: unknown, fieldName: string): number {
    const parsed = this.getOptionalNumber(value);
    if (parsed === null) {
      throw new Error(`El campo numérico ${fieldName} es requerido y no es válido.`);
    }

    return parsed;
  }
}
