# Manual de Mantenimiento

Guia tecnica para modificar el sistema sin romper el flujo de parseo, validacion, consolidacion y exportacion Excel.

## 1. Objetivo de este manual

Este documento explica como mantener y extender el sistema en los puntos mas comunes:

1. Agregar o quitar columnas del Excel
2. Cambiar celdas fijas o filas de inicio de la plantilla
3. Extraer nuevos valores desde el XML
4. Agregar, quitar o modificar validaciones
5. Cambiar reglas de clasificacion de hidrocarburos
6. Ajustar colores de severidad
7. Entender como se excluyen conceptos o XML
8. Entender como funciona la bandera `Participa en Totales`

## 2. Mapa rapido de archivos importantes

### Contratos y constantes

1. `src/shared/types.ts`: define estructuras de datos compartidas
2. `src/shared/constants.ts`: hojas, celdas fijas, filas de inicio, colores, claves de hidrocarburos

### Parseo y negocio

1. `src/infrastructure/xml/cfdi-xml.parser.ts`: extrae datos crudos desde el XML
2. `src/domain/services/cfdi-validator.ts`: valida factura y conceptos
3. `src/domain/services/hydrocarbon-classifier.ts`: decide si un concepto es hidrocarburo
4. `src/application/services/cfdi-transformer.ts`: convierte parseo + validacion en records exportables
5. `src/application/use-cases/process-xml-batch.use-case.ts`: coordina todo el lote

### Excel y logging

1. `src/infrastructure/excel/excel-report.writer.ts`: escribe el archivo `.xlsx`
2. `src/infrastructure/logging/process-logger.ts`: arma la estructura de logs por XML
3. `src/assets/templates/plantilla_XML_volumetricos.xlsx`: plantilla base con encabezados y estilos

## 3. Regla general para cualquier cambio

Siempre que cambies un dato visible en Excel, sigue este orden:

1. Cambia el tipo o interface en `types.ts`
2. Llena o calcula el dato en parser, transformer o use case
3. Escribe el dato en `excel-report.writer.ts`
4. Ajusta la plantilla `.xlsx`
5. Actualiza la descripcion funcional del reporte en `README.md` si cambian columnas o significado de datos
6. Compila con `npm run build`
7. Prueba con XML reales

## 4. Como agregar o quitar columnas en Excel

## 4.1 Agregar una columna en Facturas

### Paso 1. Agregar propiedad en `types.ts`

Ejemplo:

```ts
export interface FacturaRecord {
  archivoXML: string;
  uuid: string;
  fecha: string;
  serie: string;
  folio: string;
  rfcEmisor: string;
  formaPago: string;
  metodoPago: string;
  moneda: string;
  version: string;
  estatus: ValidationSeverity;
  subTotal: number;
  total: number;
}
```

### Paso 2. Llenar ese valor

Dependiendo del origen:

1. Si viene del XML, extraelo en `cfdi-xml.parser.ts`
2. Si depende de reglas de negocio, calculalo en `cfdi-transformer.ts` o `process-xml-batch.use-case.ts`

### Paso 3. Escribir la columna en Excel

Archivo:

1. `src/infrastructure/excel/excel-report.writer.ts`

Metodo a editar:

1. `fillFacturasRows`

Ejemplo:

```ts
this.writeRow(sheet, rowIndex, [
  row.archivoXML,
  row.uuid,
  row.fecha,
  row.serie,
  row.folio,
  row.rfcEmisor,
  row.formaPago,
  row.metodoPago,
  row.moneda,
  row.version,
  row.estatus,
  row.subTotal,
  row.total,
]);
```

### Paso 4. Ajustar plantilla

Agrega el encabezado en la hoja correcta del archivo `plantilla_XML_volumetricos.xlsx` y verifica que el orden coincida con `writeRow(...)`.

## 4.2 Agregar una columna en Conceptos

Archivos tipicos a tocar:

1. `src/shared/types.ts`
2. `src/application/services/cfdi-transformer.ts`
3. `src/infrastructure/excel/excel-report.writer.ts`
4. plantilla Excel

Regla:

El orden del arreglo pasado a `writeRow(...)` define el orden de columnas real en la hoja.

## 4.3 Quitar una columna

1. Elimina la propiedad del tipo correspondiente
2. Elimina su calculo o llenado
3. Elimina su posicion del `writeRow(...)`
4. Ajusta el encabezado en la plantilla

## 5. Como cambiar celdas fijas, filas de inicio y hojas

Archivo principal:

1. `src/shared/constants.ts`

### 5.1 Cambiar una celda fija de resumen

Ejemplo actual:

```ts
export const CELL_MAP = {
  FECHA_GENERACION: 'A4',
  TOTAL_XML_PROCESADOS: 'C4',
  TOTAL_XML_ERROR: 'E4',
  ...
};
```

Si quieres mover `TOTAL_XML_ERROR` de `E4` a `F4`, cambia solo la constante:

```ts
TOTAL_XML_ERROR: 'F4'
```

### 5.2 Cambiar fila inicial de una hoja

Tambien en `CELL_MAP`:

```ts
FACTURAS_START_ROW: 2,
CONCEPTOS_START_ROW: 2,
LOGS_START_ROW: 2,
```

Si la plantilla ahora deja encabezado hasta la fila 3, ajusta el valor correspondiente.

### 5.3 Cambiar nombre de una hoja

En `SHEETS`:

```ts
export const SHEETS = {
  RESUMEN: 'Resumen_General',
  FACTURAS: 'Facturas',
  CONCEPTOS: 'Conceptos',
  LOGS: 'Logs',
} as const;
```

Si cambias el nombre en la plantilla, debes cambiarlo tambien aqui o el writer fallara.

## 6. Como extraer nuevos valores desde el XML

Archivo principal:

1. `src/infrastructure/xml/cfdi-xml.parser.ts`

### Helpers importantes

1. `getString(value)`: convierte a string limpio
2. `getOptionalNumber(value)`: intenta convertir a numero y devuelve `null` si falta o es invalido

### Regla actual

No convertir faltantes a `0` automaticamente si eso oculta un error de datos. Si el numero puede faltar y eso debe validarse despues, usa `getOptionalNumber(...)`.

### Ejemplo para agregar un dato de factura

Si quieres extraer RFC del emisor:

```ts
const emisor = comprobante.Emisor as CfdiNode | undefined;

const factura: ParsedFacturaRaw = {
  ...,
  rfcEmisor: this.getString(emisor?.Rfc),
};
```

Luego deberas reflejarlo en el tipo y en el transformer si ese valor va a Excel.

### Ejemplo para agregar un dato de concepto

```ts
return {
  ...,
  noIdentificacion: this.getString(concepto.NoIdentificacion),
};
```

Despues:

1. agregar propiedad al tipo crudo
2. decidir si se valida
3. pasarlo al `ConceptoRecord`
4. escribirlo en Excel

## 7. Como agregar, quitar o cambiar validaciones

Archivo principal:

1. `src/domain/services/cfdi-validator.ts`

## 7.1 Estructura de una validacion

El validador produce `ValidationIssue` con:

1. `code`
2. `severity`
3. `scope`
4. `message`
5. `field`
6. `conceptIndex`

### Ejemplo: agregar nueva validacion de factura

```ts
if (!factura.formaPago) {
  issues.push(
    this.issue(
      'FORMA_PAGO_MISSING',
      'WARNING',
      'FACTURA',
      'FormaPago vacia.',
      'FormaPago',
    ),
  );
}
```

### Ejemplo: agregar nueva validacion de concepto

```ts
if (!concepto.unidad) {
  issues.push(
    this.issue(
      'UNIDAD_MISSING',
      'WARNING',
      'CONCEPTO',
      'Unidad vacia.',
      'Unidad',
      conceptIndex,
    ),
  );
}
```

### Si quieres quitar una validacion

Elimina o comenta el bloque correspondiente en `validateFactura(...)` o `validateConcepto(...)`.

### Si quieres cambiar severidad

Solo cambia el segundo parametro de `this.issue(...)`:

```ts
'WARNING' -> 'ERROR'
```

## 7.2 Como se define el estatus final

Regla actual:

1. Si existe al menos una incidencia `ERROR`, el estatus es `ERROR`
2. Si no hay `ERROR` pero si `WARNING`, el estatus es `WARNING`
3. Si no hay incidencias, el estatus es `OK`

Esto aplica tanto para conceptos como para XML.

## 8. Como se define la exclusion de conceptos

Archivo principal:

1. `src/application/services/cfdi-transformer.ts`

Regla actual:

1. Se evalua `normalizeProduct(descripcion, claveProdServ)`
2. Si devuelve un hidrocarburo reconocido, el concepto se exporta
3. Si devuelve `null`, el concepto no entra a la hoja `Conceptos`

Esto significa que la exclusión hoy no depende directamente de `WARNING` o `ERROR`, sino de la clasificacion hidrocarburo.

## 8.1 Como funciona `Participa en Totales`

Archivo principal:

1. `src/application/services/cfdi-transformer.ts`

La bandera `participaEnTotales` es una decision logica para el resumen. No borra la fila ni modifica valores del XML.

Regla actual:

1. Solo aplica a conceptos hidrocarburo que si fueron exportados
2. Es `false` si falta alguno de estos datos: `cantidad`, `valorUnitario`, `importe`, `IVA`, `total`
3. Es `false` si el concepto tiene al menos una incidencia `ERROR`
4. Es `false` si tiene alguno de estos `WARNING` criticos:
  `IVA_REQUIRED_OBJETO_IMP_02`, `IVA_MISSING`, `IVA_NEGATIVE`, `CONCEPT_TOTAL_INCONSISTENT`
5. En cualquier otro caso es `true`

El resumen consolidado en `process-xml-batch.use-case.ts` solo suma conceptos con `participaEnTotales = true`.

### Si quieres cambiar esta politica

Toca este bloque:

```ts
const productoNormalizado = normalizeProduct(concepto.descripcion, concepto.claveProdServ);

if (!productoNormalizado) {
  return;
}
```

Opciones tipicas:

1. Exportar todos los conceptos, incluyendo no hidrocarburos
2. Exportar no hidrocarburos con `estatus = WARNING`
3. Mantener el comportamiento actual

## 9. Como cambiar reglas de clasificacion de hidrocarburos

Archivo principal:

1. `src/domain/services/hydrocarbon-classifier.ts`

Puedes modificar:

1. claves SAT aceptadas
2. palabras clave
3. normalizacion final del producto

Tambien puedes cambiar listas base en:

1. `src/shared/constants.ts`

Constantes actuales:

1. `HIDROCARBON_KEYWORDS`
2. `HIDROCARBON_KEYS`

## 10. Como cambiar colores del Excel

Archivo principal:

1. `src/shared/constants.ts`

Constante actual:

```ts
export const EXCEL_STATUS_FILL_COLORS = {
  OK: null,
  WARNING: 'FFFFE082',
  ERROR: 'FFFFCDD2',
} as const;
```

Reglas:

1. `OK` sin color especial
2. `WARNING` color amarillo
3. `ERROR` color rojo

El writer solo lee esta configuracion. No cambies colores directamente en `excel-report.writer.ts` salvo que tambien cambie la mecanica de pintado.

## 11. Como cambiar el resumen consolidado

Archivo principal:

1. `src/application/use-cases/process-xml-batch.use-case.ts`

Metodo clave:

1. `buildResumen(...)`

Actualmente el resumen:

1. Usa solo conceptos exportados en la lista final
2. Omite conceptos con datos numericos `null`
3. Agrupa por `claveProdServ`, producto y `valorUnitario`

### Si quieres cambiar agrupacion

Edita la construccion de la llave:

```ts
const key = `${concepto.claveProdServ}|${productoResumen}|${concepto.valorUnitario.toFixed(6)}`;
```

### Si quieres agregar nuevas metricas

1. agrega el campo a `ResumenRecord`
2. calcula acumulacion en `buildResumen(...)`
3. escribelo en `fillResumenRows(...)`
4. agrega la columna en la plantilla

## 12. Como cambiar logs y observaciones

Archivos principales:

1. `src/infrastructure/logging/process-logger.ts`
2. `src/application/use-cases/process-xml-batch.use-case.ts`
3. `src/infrastructure/excel/excel-report.writer.ts`

Si quieres agregar nuevos campos al log:

1. agrega propiedad a `ProcessLog` en `types.ts`
2. llenala en `ProcessLogger.add(...)`
3. envia el dato desde el use case
4. escribelo en `fillLogsRows(...)`
5. agrega encabezado en la plantilla

## 13. Como editar la plantilla Excel sin romper el sistema

Checklist:

1. No cambies nombres de hojas sin actualizar `SHEETS`
2. Si mueves celdas fijas, actualiza `CELL_MAP`
3. Si agregas columnas, ajusta encabezado y formato en la plantilla
4. Si cambias filas de inicio, actualiza `*_START_ROW`
5. Verifica que las columnas del encabezado coincidan exactamente con el orden de `writeRow(...)`

## 14. Errores comunes

### "La plantilla no contiene todas las hojas requeridas"

Verifica nombres exactos de hoja entre plantilla y `SHEETS`.

### Columnas corridas o datos en columnas equivocadas

La plantilla no coincide con el orden del arreglo enviado a `writeRow(...)`.

### Campo siempre vacio en Excel

1. No se parseo en `cfdi-xml.parser.ts`
2. No se transfirio en `cfdi-transformer.ts`
3. No se escribio en el writer

### Build TypeScript falla tras un cambio

Normalmente falto actualizar algun tipo o alguna asignacion intermedia.

## 15. Flujo recomendado para cambios seguros

1. Haz un cambio pequeño a la vez
2. Compila con `npm run build`
3. Ejecuta con `npm run dev`
4. Prueba con XML validos y XML problematicos
5. Verifica el Excel final y especialmente las hojas `Conceptos` y `Logs`

## 16. Casos de prueba sugeridos tras mantenimiento

1. XML valido con hidrocarburos
2. XML valido con conceptos no hidrocarburo
3. XML sin UUID
4. XML sin timbre fiscal
5. XML con moneda USD
6. XML CFDI 3.3
7. XML con cantidad faltante
8. XML con importe faltante
9. XML con IVA faltante
10. XML con total inconsistente
11. XML corrupto o no parseable

## 17. Comandos utiles

```bash
npm run build
npm run dev
```

Usa `npm run build` despues de cualquier cambio en tipos, validaciones, writer o parser.