# XML Volumetricos

Aplicacion de escritorio en Electron + Node.js + TypeScript para procesar CFDI XML de combustibles, validar su consistencia y generar un reporte Excel auditable para control administrativo y volumetrico.

El sistema esta orientado a gasolineras y escenarios donde no basta con extraer datos: tambien es necesario identificar XML parseables pero inconsistentes, mostrar incidencias y mantener trazabilidad completa por archivo.

## Objetivo del sistema

La aplicacion toma una carpeta con XML CFDI, procesa cada archivo y genera un Excel con estas hojas:

1. `Resumen_General`
2. `Facturas`
3. `Conceptos`
4. `Logs`

El resultado busca cubrir dos necesidades al mismo tiempo:

1. Reporte operativo de hidrocarburos
2. Auditoria tecnica y fiscal de los XML procesados

## Comportamiento funcional actual

### Que hace

1. Lee todos los archivos `.xml` de una carpeta.
2. Parsea el nodo `Comprobante` y sus `Conceptos`.
3. Valida factura y conceptos con severidades `OK`, `WARNING` y `ERROR`.
4. Conserva las facturas parseables aunque tengan incidencias.
5. En la hoja `Conceptos`, solo exporta conceptos reconocidos como hidrocarburos.
6. Marca cada concepto exportado con `estatus` y `observaciones`.
7. Calcula una bandera logica `Participa en Totales` para decidir si ese concepto entra o no al resumen.
8. Colorea las filas de `Conceptos` segun severidad.
9. Genera un log por XML con contador de conceptos detectados, exportados y excluidos.

### Que se excluye hoy

#### Se excluye completamente del archivo final

1. XML que no puede parsearse
2. XML sin estructura minima para construir `Comprobante`

#### Se excluye de la hoja `Conceptos`

1. Conceptos que no sean hidrocarburos segun `normalizeProduct`

#### Se mantiene visible en el Excel aunque tenga incidencias

1. Facturas parseables con `WARNING` o `ERROR`
2. Conceptos hidrocarburo con `WARNING` o `ERROR`

### Regla importante de negocio

La hoja `Conceptos` no es una copia total de todos los conceptos del CFDI. Es un listado de conceptos hidrocarburo reconocidos por el clasificador del sistema.

Si `normalizeProduct` no reconoce el concepto como hidrocarburo, ese concepto no entra a la lista de `Conceptos`, aunque el XML siga apareciendo en `Facturas` y `Logs`.

## Severidades

El sistema usa tres severidades:

1. `OK`: no se detectaron incidencias
2. `WARNING`: el XML o concepto pudo procesarse, pero presenta datos sospechosos o no ideales
3. `ERROR`: existe una inconsistencia fuerte o un dato requerido faltante/invalido

## Validaciones implementadas

## Validaciones a nivel XML / Factura

Se ejecutan en `CfdiValidator`.

### `ERROR`

1. No hay conceptos en el XML
2. `SubTotal` faltante o invalido
3. `SubTotal` negativo
4. `Total` faltante o invalido
5. `Total` negativo

### `WARNING`

1. UUID vacio
2. UUID duplicado dentro del lote
3. XML sin timbre fiscal
4. Version CFDI distinta de `4.0`
5. Moneda distinta de `MXN`
6. Total inconsistente contra suma de importes + IVA con tolerancia decimal

## Validaciones a nivel Concepto

Tambien se ejecutan en `CfdiValidator`.

### `ERROR`

1. `ClaveProdServ` faltante
2. `Cantidad` faltante o invalida
3. `Cantidad <= 0`
4. `ValorUnitario` faltante o invalido
5. `ValorUnitario <= 0`
6. `Importe` faltante o invalido
7. `Importe` negativo

### `WARNING`

1. `ClaveProdServ` sospechosa si no tiene 8 digitos
2. `Descripcion` vacia
3. `ObjetoImp = 02` sin traslado de IVA
4. IVA faltante cuando existe traslado
5. IVA negativo
6. Tasa IVA distinta de `0.160000`
7. `Importe` inconsistente contra `Cantidad x ValorUnitario`
8. Producto no reconocido por `normalizeProduct`

## Regla de exclusion de conceptos

Actualmente la exclusion de la hoja `Conceptos` se define por clasificacion de hidrocarburo:

1. Si `normalizeProduct` devuelve `MAGNA`, `PREMIUM` o `DIESEL`, el concepto se exporta.
2. Si `normalizeProduct` no reconoce el concepto, no se exporta en la hoja `Conceptos`.

Esto significa que un concepto puede tener `WARNING` o `ERROR` y aun asi aparecer en `Conceptos`, siempre que siga siendo un hidrocarburo reconocido.

Adicionalmente, cada concepto exportado lleva una bandera logica llamada `Participa en Totales`. Esa bandera no elimina la fila ni altera los valores del XML; solo determina si JavaScript lo toma en cuenta para el resumen consolidado.

## Arquitectura actual

El proyecto esta organizado por capas con responsabilidades separadas.

```text
renderer                -> Interfaz de usuario
main / preload          -> Integracion Electron + IPC
application             -> Orquestacion del proceso por lote
domain                  -> Reglas de negocio y validacion
infrastructure          -> XML, Excel, logging, filesystem
shared                  -> Tipos y constantes compartidas
```

## Componentes principales

### `src/infrastructure/xml/cfdi-xml.parser.ts`

Responsabilidad:

1. Leer el XML
2. Parsearlo con `fast-xml-parser`
3. Extraer datos crudos de factura y conceptos
4. Mantener numeros opcionales como `null` en vez de forzarlos a `0`

Nota:

El parser ya no decide exclusiones de negocio. Solo construye datos parseados.

### `src/domain/services/cfdi-validator.ts`

Responsabilidad:

1. Validar factura
2. Validar conceptos
3. Generar incidencias estructuradas
4. Asignar severidad final

### `src/domain/services/hydrocarbon-classifier.ts`

Responsabilidad:

1. Reconocer hidrocarburos por descripcion y/o clave SAT
2. Normalizar a `MAGNA`, `PREMIUM` o `DIESEL`

Si no reconoce el concepto, ese concepto no entra a la hoja `Conceptos`.

### `src/application/services/cfdi-transformer.ts`

Responsabilidad:

1. Convertir datos parseados en records de exportacion
2. Construir `observaciones`
3. Definir `estatus` de cada concepto exportado
4. Excluir del listado de `Conceptos` lo que no sea hidrocarburo

### `src/application/use-cases/process-xml-batch.use-case.ts`

Responsabilidad:

1. Procesar todos los XML de una carpeta
2. Detectar UUID duplicados en el lote
3. Coordinar parseo, validacion, transformacion y exportacion
4. Construir el resumen consolidado
5. Generar logs por archivo

### `src/infrastructure/excel/excel-report.writer.ts`

Responsabilidad:

1. Abrir la plantilla `.xlsx`
2. Limpiar filas dinamicas
3. Escribir `Resumen_General`, `Facturas`, `Conceptos` y `Logs`
4. Pintar filas de `Conceptos` segun severidad

### `src/infrastructure/logging/process-logger.ts`

Responsabilidad:

1. Acumular logs estructurados en memoria
2. Guardar metadatos utiles por XML
3. Entregar esos logs al Excel y a la UI

### `src/shared/types.ts`

Contiene los contratos principales:

1. `ValidationSeverity`
2. `ValidationIssue`
3. `ParsedFacturaRaw`
4. `ParsedConceptoRaw`
5. `FacturaRecord`
6. `ConceptoRecord`
7. `ProcessLog`
8. `ProcessResult`

### `src/shared/constants.ts`

Centraliza constantes como:

1. Nombres de hojas de Excel
2. Mapeo de celdas fijas de la plantilla
3. Paleta de colores de severidad para Excel
4. Palabras clave y claves SAT de hidrocarburos

## Flujo de procesamiento

```text
Seleccion de carpeta de entrada/salida
   ↓
Listado de XML
   ↓
Parseo archivo por archivo
   ↓
Deteccion de UUID duplicados
   ↓
Validacion de factura y conceptos
   ↓
Transformacion a records de exportacion
   ↓
Filtro de conceptos hidrocarburo
   ↓
Construccion de resumen y logs
   ↓
Generacion de Excel desde plantilla
```

## Resumen_General

La hoja `Resumen_General` se calcula en memoria antes de exportar.

Representa el consolidado oficial del reporte volumetrico. Su objetivo es mostrar cantidades y montos acumulados por producto hidrocarburo reconocido.

Se agrupa por:

1. `claveProdServ`
2. producto normalizado o descripcion fallback
3. `valorUnitario`

Solo se incluyen conceptos exportados en la hoja `Conceptos` y con estos datos numericos presentes:

1. `cantidad`
2. `valorUnitario`
3. `importe`
4. `IVA`
5. `total`

Si un concepto hidrocarburo tiene campos numericos `null`, puede aparecer en la hoja `Conceptos`, pero no participa en el consolidado del resumen.

La decision final del resumen usa `Participa en Totales = Si`.

### Columnas del detalle en `Resumen_General`

1. `claveProdServ`: clave SAT del producto consolidado.
2. `producto`: nombre normalizado del hidrocarburo, normalmente `MAGNA`, `PREMIUM` o `DIESEL`.
3. `cantidad`: suma de cantidades de los conceptos que participan en totales.
4. `valorUnitario`: precio unitario del grupo consolidado.
5. `importe`: suma de importes antes de IVA.
6. `iva`: suma del IVA de los conceptos incluidos.
7. `total`: suma total facturada del grupo (`importe + iva`).
8. `registros`: numero de conceptos que participaron en ese grupo.

## Hoja Facturas

La hoja `Facturas` representa una vista por XML procesado. Cada fila corresponde a un comprobante parseable, incluso si contiene advertencias o errores de validacion.

Columnas actuales esperadas en la plantilla:

1. `archivoXML`
2. `uuid`
3. `fecha`
4. `serie`
5. `folio`
6. `formaPago`
7. `metodoPago`
8. `moneda`
9. `version`
10. `estatus`
11. `subTotal`
12. `total`

### Que representa cada columna de `Facturas`

1. `archivoXML`: nombre del archivo procesado.
2. `uuid`: UUID del timbre fiscal digital.
3. `fecha`: fecha del comprobante.
4. `serie`: serie del CFDI.
5. `folio`: folio del CFDI.
6. `formaPago`: clave SAT de forma de pago.
7. `metodoPago`: clave SAT del metodo de pago.
8. `moneda`: moneda del comprobante, por ejemplo `MXN`.
9. `version`: version del CFDI detectada en el XML.
10. `estatus`: severidad final del XML (`OK`, `WARNING`, `ERROR`).
11. `subTotal`: subtotal del comprobante.
12. `total`: total del comprobante.

## Hoja Conceptos

La hoja `Conceptos` representa el detalle operativo del reporte. Solo contiene conceptos reconocidos como hidrocarburos por la logica del sistema. La fila puede aparecer aunque tenga incidencias; las incidencias se reflejan en `estatus`, `observaciones` y `Participa en Totales`.

Columnas actuales esperadas en la plantilla:

1. `uuid`
2. `serie`
3. `folio`
4. `fecha`
5. `claveProdServ`
6. `descripcion`
7. `claveUnidad`
8. `unidad`
9. `cantidad`
10. `valorUnitario`
11. `importe`
12. `baseIVA`
13. `tasaIVA`
14. `IVA`
15. `total`
16. `estatus`
17. `observaciones`
18. `participaEnTotales`

Solo se exportan conceptos hidrocarburo.

### Que representa cada columna de `Conceptos`

1. `uuid`: UUID del XML al que pertenece el concepto.
2. `serie`: serie del CFDI origen.
3. `folio`: folio del CFDI origen.
4. `fecha`: fecha del comprobante origen.
5. `claveProdServ`: clave SAT reportada en el concepto.
6. `descripcion`: descripcion original del concepto en el XML.
7. `claveUnidad`: clave SAT de unidad.
8. `unidad`: descripcion de la unidad reportada.
9. `cantidad`: cantidad del concepto. Puede venir vacia si el XML esta incompleto.
10. `valorUnitario`: valor unitario del concepto.
11. `importe`: importe base del concepto.
12. `baseIVA`: base usada para el traslado de IVA, cuando exista.
13. `tasaIVA`: tasa de IVA detectada en el traslado.
14. `IVA`: importe de IVA del concepto.
15. `total`: total calculado por JavaScript para el concepto (`importe + IVA`) cuando es posible.
16. `estatus`: severidad final del concepto (`OK`, `WARNING`, `ERROR`).
17. `observaciones`: listado de incidencias detectadas para ese concepto.
18. `participaEnTotales`: bandera logica `Si/No`. No elimina la fila ni cambia el XML; solo decide si JavaScript lo toma en cuenta para el resumen.

## Hoja Logs

La hoja `Logs` representa la bitacora de procesamiento. Cada fila resume el resultado de un XML o del proceso global.

Columnas actuales esperadas en la plantilla:

1. `archivoXML`
2. `estatus`
3. `mensajePrincipal`
4. `totalConceptos`
5. `conceptosIncluidosTotales`
6. `conceptosExcluidosTotales`
7. `observacionesGenerales`
8. `uuid`
9. `serie`
10. `folio`
11. `fecha`

Interpretacion actual de contadores:

1. `totalConceptos`: cantidad total de conceptos parseados desde el XML
2. `conceptosIncluidosTotales`: cantidad de conceptos hidrocarburo exportados
3. `conceptosExcluidosTotales`: cantidad de conceptos no hidrocarburo o no exportados al listado final

### Que representa cada columna de `Logs`

1. `archivoXML`: nombre del archivo asociado al log, o `GLOBAL` para el resumen final.
2. `estatus`: severidad final del XML o del evento registrado.
3. `mensajePrincipal`: mensaje corto del resultado del procesamiento.
4. `totalConceptos`: cantidad total de conceptos detectados en el XML.
5. `conceptosIncluidosTotales`: cantidad de conceptos que finalmente participaron en el reporte de hidrocarburos y en los totales.
6. `conceptosExcluidosTotales`: cantidad de conceptos detectados que no participaron en el reporte o en totales.
7. `observacionesGenerales`: detalle general de advertencias o errores del XML.
8. `uuid`: UUID del XML, si existe.
9. `serie`: serie del CFDI.
10. `folio`: folio del CFDI.
11. `fecha`: fecha y hora del registro de log.

## Colores en Excel

La fila de `Conceptos` se pinta segun `estatus`.

La paleta se define en:

1. `src/shared/constants.ts` mediante `EXCEL_STATUS_FILL_COLORS`

Valores actuales:

1. `OK`: sin color especial
2. `WARNING`: amarillo mas oscuro suave
3. `ERROR`: rojo suave

El `writer` solo consume estas constantes; no debe volver a hardcodear colores.

## Estructura de carpetas

```text
.
├─ MANUAL_MANTENIMIENTO.md
├─ README.md
├─ package.json
├─ tsconfig.json
├─ scripts/
│  └─ copy-assets.mjs
└─ src/
   ├─ application/
   │  ├─ services/
   │  │  └─ cfdi-transformer.ts
   │  └─ use-cases/
   │     └─ process-xml-batch.use-case.ts
   ├─ assets/
   │  └─ templates/
   ├─ domain/
   │  ├─ entities/
   │  │  └─ cfdi.ts
   │  └─ services/
   │     ├─ cfdi-validator.ts
   │     └─ hydrocarbon-classifier.ts
   ├─ infrastructure/
   │  ├─ excel/
   │  │  └─ excel-report.writer.ts
   │  ├─ fs/
   │  │  └─ file-system.service.ts
   │  ├─ logging/
   │  │  └─ process-logger.ts
   │  └─ xml/
   │     └─ cfdi-xml.parser.ts
   ├─ main/
   │  └─ main.ts
   ├─ preload/
   │  └─ preload.ts
   ├─ renderer/
   │  ├─ index.html
   │  ├─ renderer.ts
   │  └─ styles.css
   └─ shared/
      ├─ constants.ts
      └─ types.ts
```

## Instalacion y ejecucion

### Requisitos

1. Node.js 18+
2. npm 9+

### Comandos

```bash
npm install
npm run build
npm run dev
```

Scripts disponibles:

1. `npm run build`: compila TypeScript y copia assets a `dist`
2. `npm run dev`: compila y abre Electron
3. `npm start`: equivalente de arranque para ejecucion normal

## Plantilla Excel

La plantilla base debe existir en:

```text
src/assets/templates/plantilla_XML_volumetricos.xlsx
```

Debe contener exactamente estas hojas:

1. `Resumen_General`
2. `Facturas`
3. `Conceptos`
4. `Logs`

Celdas fijas usadas actualmente en `Resumen_General`:

1. `A4`: fecha de generacion
2. `C4`: total de XML procesados
3. `E4`: total de XML con error

Las filas de detalle se escriben desde estas posiciones:

1. `Resumen_General`: fila `9`
2. `Facturas`: fila `2`
3. `Conceptos`: fila `2`
4. `Logs`: fila `2`

## Notas operativas importantes

1. La plantilla original no se sobrescribe; el sistema genera un archivo nuevo.
2. La aplicacion continua procesando aunque un XML falle.
3. La hoja `Conceptos` no es un volcado total del CFDI; es un subconjunto de hidrocarburos.
4. Un concepto hidrocarburo con errores puede seguir siendo visible en el Excel.
5. El resumen consolidado puede omitir conceptos visibles si les faltan valores numericos requeridos.

## Recomendacion de uso

Para cambios funcionales, revisar tambien:

1. `MANUAL_MANTENIMIENTO.md`
