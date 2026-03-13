import { ConceptoRecord, FacturaRecord } from '../../shared/types';

export interface ParsedCfdi {
  factura: FacturaRecord;
  conceptos: ConceptoRecord[];
}
