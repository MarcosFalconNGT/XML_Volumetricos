import { ProcessLog, ValidationSeverity } from '../../shared/types';

export class ProcessLogger {
  private readonly logs: ProcessLog[] = [];

  public add(params: {
    archivoXML: string;
    estatus: ValidationSeverity;
    mensajePrincipal: string;
    observacionesGenerales?: string;
    totalConceptos?: number;
    conceptosIncluidosTotales?: number;
    conceptosExcluidosTotales?: number;
    uuid?: string;
    serie?: string;
    folio?: string;
  }): void {
    this.logs.push({
      archivoXML: params.archivoXML,
      fecha: new Date().toISOString(),
      estatus: params.estatus,
      mensajePrincipal: params.mensajePrincipal,
      observacionesGenerales: params.observacionesGenerales ?? '',
      totalConceptos: params.totalConceptos ?? 0,
      conceptosIncluidosTotales: params.conceptosIncluidosTotales ?? 0,
      conceptosExcluidosTotales: params.conceptosExcluidosTotales ?? 0,
      uuid: params.uuid ?? '',
      serie: params.serie ?? '',
      folio: params.folio ?? '',
    });
  }

  public all(): ProcessLog[] {
    return [...this.logs];
  }
}
