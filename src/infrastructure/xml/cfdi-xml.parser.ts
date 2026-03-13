import fs from 'node:fs/promises';
import path from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import { ParsedCfdi } from '../../domain/entities/cfdi';
import { normalizeProduct } from '../../domain/services/hydrocarbon-classifier';
import { ConceptoRecord, FacturaRecord } from '../../shared/types';

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

    const tfd = this.extractTimbreUuid(comprobante);

    const factura: FacturaRecord = {
      archivoXML,
      uuid: tfd,
      fecha,
      serie,
      folio,
      formaPago: this.getString(comprobante.FormaPago),
      metodoPago: this.getString(comprobante.MetodoPago),
      moneda: this.getString(comprobante.Moneda),
      subTotal: this.getNumber(comprobante.SubTotal),
      total: this.getNumber(comprobante.Total),
    };

    const conceptos = conceptosArray
      .map((concepto) => this.mapConcepto(tfd, serie, folio, fecha, concepto as CfdiNode))
      .filter((item): item is ConceptoRecord => item !== null);

    return { factura, conceptos };
  }

  private mapConcepto(
    uuid: string,
    serie: string,
    folio: string,
    fecha: string,
    concepto: CfdiNode,
  ): ConceptoRecord | null {
    const claveProdServ = this.getString(concepto.ClaveProdServ);
    const descripcion = this.getString(concepto.Descripcion);
    const producto = normalizeProduct(descripcion, claveProdServ);

    if (!producto) {
      return null;
    }

    const impuestos = this.extractConceptIva(concepto);
    const importe = this.getNumber(concepto.Importe);

    return {
      uuid,
      serie,
      folio,
      fecha,
      claveProdServ,
      descripcion: producto,
      claveUnidad: this.getString(concepto.ClaveUnidad),
      unidad: this.getString(concepto.Unidad),
      cantidad: this.getNumber(concepto.Cantidad),
      valorUnitario: this.getNumber(concepto.ValorUnitario),
      importe,

      baseIVA: impuestos.baseIva,
      tasaIVA: impuestos.tasaIva,
      IVA: impuestos.iva,
      total: importe + impuestos.iva,
    };
  }

  private extractTimbreUuid(comprobante: CfdiNode): string {
    const complemento = comprobante.Complemento as CfdiNode | undefined;
    if (!complemento) return '';

    const timbre = (complemento.TimbreFiscalDigital as CfdiNode | undefined) ||
      ((complemento as Record<string, unknown>)['tfd:TimbreFiscalDigital'] as CfdiNode | undefined);

    return timbre ? this.getString(timbre.UUID) : '';
  }

  private extractConceptIva(concepto: CfdiNode): {
    baseIva: number;
    tasaIva: number;
    iva: number;
  } {
    const impuestosNode = concepto.Impuestos as CfdiNode | undefined;
    const trasladosNode = (impuestosNode?.Traslados as CfdiNode | undefined)?.Traslado;

    const traslados = Array.isArray(trasladosNode)
      ? trasladosNode
      : trasladosNode
        ? [trasladosNode]
        : [];

    let baseIva = 0;
    let tasaIva = 0;
    let iva = 0;

    for (const traslado of traslados as CfdiNode[]) {
      const impuesto = this.getString(traslado.Impuesto);

      if (impuesto === '002') {
        baseIva += this.getNumber(traslado.Base);
        iva += this.getNumber(traslado.Importe);
        tasaIva = this.getNumber(traslado.TasaOCuota);
      }
    }

    return {
      baseIva,
      tasaIva,
      iva,
    };
  }


  private getString(value: unknown): string {
    return value == null ? '' : String(value).trim();
  }

  private getNumber(value: unknown): number {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }
}
