# Manual de Mantenimiento del Sistema

Guía rápida para modificar y mantener la aplicación **XML Volumétricos** sin romper el flujo principal.

---

## 1. Objetivo del sistema

La app procesa XML CFDI y genera un Excel con 4 hojas:
- `Resumen_General`
- `Facturas`
- `Conceptos`
- `Logs`

Flujo general:
1. UI selecciona carpeta de entrada/salida.
2. Caso de uso procesa XML por XML.
3. Se parsean facturas y conceptos.
4. Se clasifican hidrocarburos.
5. Se escribe Excel final usando plantilla.

---

## 2. Estructura que más se modifica

- `src/shared/types.ts`: contratos de datos (qué campos existen).
- `src/infrastructure/xml/cfdi-xml.parser.ts`: extracción de datos del XML.
- `src/application/use-cases/process-xml-batch.use-case.ts`: consolidaciones/reglas del proceso.
- `src/infrastructure/excel/excel-report.writer.ts`: orden y escritura de columnas en Excel.
- `src/assets/templates/plantilla_XML_volumetricos.xlsx`: encabezados/estilo de columnas en la plantilla.
- `src/domain/services/hydrocarbon-classifier.ts`: lógica de clasificación de productos.

---

## 3. Cómo agregar o quitar columnas en Excel

Para cualquier columna nueva o eliminada, sigue este orden:

1. **Definir el campo en tipos** (`types.ts`).
2. **Llenar ese campo desde XML** (`cfdi-xml.parser.ts`) o desde la consolidación (`process-xml-batch.use-case.ts`).
3. **Escribir o quitar la columna en Excel** (`excel-report.writer.ts`) en el arreglo de `writeRow`.
4. **Actualizar la plantilla `.xlsx`** para que el encabezado y formato coincidan.

Regla clave: el orden del arreglo enviado a `writeRow(...)` define el orden de columnas en la hoja.

### 3.1 Ejemplo: agregar una columna en Facturas

#### Paso A: `src/shared/types.ts`
```ts
export interface FacturaRecord {
  archivoXML: string;
  uuid: string;
  rfcEmisor: string; // nuevo campo
  fecha: string;
  serie: string;
  folio: string;
  formaPago: string;
  metodoPago: string;
  moneda: string;
  subTotal: number;
  total: number;
}
```

#### Paso B: `src/infrastructure/xml/cfdi-xml.parser.ts`
Agregar el campo al construir `factura`:
```ts
const factura: FacturaRecord = {
  archivoXML,
  uuid: tfd,
  rfcEmisor: this.getString((comprobante.Emisor as CfdiNode | undefined)?.Rfc),
  fecha,
  serie,
  folio,
  formaPago: this.getString(comprobante.FormaPago),
  metodoPago: this.getString(comprobante.MetodoPago),
  moneda: this.getString(comprobante.Moneda),
  subTotal: this.getNumber(comprobante.SubTotal),
  total: this.getNumber(comprobante.Total),
};
```

#### Paso C: `src/infrastructure/excel/excel-report.writer.ts`
Dentro de `fillFacturasRows`, agregar la columna en el arreglo:
```ts
this.writeRow(sheet, rowIndex, [
  row.archivoXML,
  row.uuid,
  row.rfcEmisor,
  row.fecha,
  row.serie,
  row.folio,
  row.formaPago,
  row.metodoPago,
  row.moneda,
  row.subTotal,
  row.total,
]);
```

#### Paso D: plantilla Excel
En `plantilla_XML_volumetricos.xlsx`, agregar encabezado `RFC Emisor` en la hoja `Facturas` en la misma posición.

### 3.2 Quitar una columna

1. Borra la propiedad de la interface correspondiente en `types.ts`.
2. Elimina su llenado en parser o consolidación.
3. Elimina su posición en el arreglo de `writeRow(...)`.
4. Quita/ajusta el encabezado en la plantilla Excel.

---

## 4. Cambiar reglas de clasificación (MAGNA/PREMIUM/DIESEL)

Archivo: `src/domain/services/hydrocarbon-classifier.ts`

Ahí se decide qué conceptos sí entran al reporte. Si quieres:
- incluir nuevos productos,
- cambiar claves SAT,
- ajustar términos de búsqueda,
modifica esa lógica y valida con XML reales.

---

## 5. Cambiar resumen o cálculos

Archivo: `src/application/use-cases/process-xml-batch.use-case.ts`

Este caso de uso:
- acumula registros,
- maneja errores por archivo,
- construye `resumen`.

Si quieres nuevas métricas (por ejemplo, por moneda, por método de pago, etc.), aquí se agregan y luego se reflejan en el writer de Excel.

---

## 6. Validación recomendada después de cambios

Ejecuta:

```bash
npm run build
npm run dev
```

Checklist mínimo:
1. La app abre sin error.
2. Procesa una carpeta de prueba con XML válidos.
3. El Excel se genera en la ruta de salida.
4. Las hojas tienen columnas correctas y datos alineados.
5. Los logs registran errores esperados en XML defectuosos.

---

## 7. Buenas prácticas de mantenimiento

1. Cambia una cosa a la vez (tipos -> parser -> writer -> plantilla).
2. Mantén consistencia entre nombre de campo en `types.ts` y uso en writer.
3. Evita lógica de negocio en UI (`renderer`): colócala en `application/domain`.
4. Si agregas una columna numérica, valida `number` y formato en Excel.
5. Conserva nombres de hojas definidos en constantes para no romper la escritura.

---

## 8. Errores comunes y solución rápida

- **"La plantilla no contiene todas las hojas requeridas"**
  - Verifica nombres exactos de hojas en la plantilla.

- **Columna vacía en Excel**
  - El campo no se está llenando en parser/consolidación o no se agregó al `writeRow`.

- **Datos corridos (desalineados)**
  - El orden del arreglo en `writeRow` no coincide con el encabezado en plantilla.

- **Compilación TypeScript falla tras agregar campo**
  - Faltó actualizar todas las asignaciones del tipo afectado.

---

## 9. Procedimiento de cambio seguro (resumen)

1. Crear rama de trabajo.
2. Modificar tipos.
3. Modificar extracción/cálculo.
4. Modificar escritura Excel.
5. Ajustar plantilla.
6. Probar con XML reales.
7. Confirmar resultado final en Excel y logs.

Con este flujo puedes personalizar el sistema "a gusto" manteniendo estabilidad.