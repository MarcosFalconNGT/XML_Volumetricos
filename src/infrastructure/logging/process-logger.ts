import { ProcessLog, LogLevel } from '../../shared/types';

export class ProcessLogger {
  private readonly logs: ProcessLog[] = [];

  public add(archivoXML: string, nivel: LogLevel, mensaje: string, detalle = ''): void {
    this.logs.push({
      archivoXML,
      fecha: new Date().toISOString(),
      nivel,
      mensaje,
      detalle,
    });
  }

  public all(): ProcessLog[] {
    return [...this.logs];
  }
}
