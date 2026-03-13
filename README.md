# XML Volumétricos

Aplicación de escritorio que automatiza el procesamiento masivo de archivos **XML CFDI** (facturas electrónicas del SAT) relacionados con ventas de hidrocarburos. Lee una carpeta completa de XMLs, extrae la información de cada factura, filtra los conceptos correspondientes a MAGNA, PREMIUM y DIESEL, y genera un reporte **Excel** estructurado listo para el control volumétrico.

---

## Índice

1. [¿Qué hace?](#qué-hace)
2. [Tecnologías](#tecnologías)
3. [Arquitectura](#arquitectura)
4. [Estructura de carpetas](#estructura-de-carpetas)
5. [Descripción de cada archivo](#descripción-de-cada-archivo)
6. [Flujo completo](#flujo-completo)
7. [Instalación y ejecución](#instalación-y-ejecución)
8. [Plantilla Excel](#plantilla-excel)
9. [Notas importantes](#notas-importantes)

---

## ¿Qué hace?

1. El usuario abre la aplicación y selecciona:
   - Una **carpeta de entrada** que contiene los archivos XML CFDI.
   - Una **carpeta de salida** donde se guardará el Excel (por defecto el Escritorio).
2. La app procesa cada XML, extrae los datos del comprobante y filtra únicamente los conceptos que correspondan a hidrocarburos (MAGNA, PREMIUM, DIESEL).
3. Al terminar genera un archivo `XML_Volumetricos_DDMMYYHHMMSS.xlsx` con cuatro hojas:

| Hoja | Contenido |
|---|---|
| `Resumen_General` | Totales por producto hidrocarburo (cantidad, valor, importe) |
| `Facturas` | Una fila por cada XML con datos del comprobante (UUID, serie, folio, totales, etc.) |
| `Conceptos` | Una fila por cada concepto de hidrocarburo detectado |
| `Logs` | Registro de éxito o error de cada archivo XML procesado |

---

## Tecnologías

| Tecnología | Versión | Rol |
|---|---|---|
| **Electron** | 35.x | Framework de aplicación de escritorio |
| **TypeScript** | 5.x | Lenguaje principal |
| **fast-xml-parser** | 4.x | Lectura y parseo de archivos XML CFDI |
| **ExcelJS** | 4.x | Escritura del reporte Excel sobre plantilla |
| **date-fns** | 4.x | Formateo de fechas |

---

## Arquitectura

El proyecto sigue una **arquitectura en capas limpia** (Clean Architecture), donde cada capa tiene una responsabilidad única y no depende de las capas externas:

```
┌────────────────────────────────────────────┐
│              renderer (UI)                 │  ← Interfaz de usuario (HTML/CSS/JS)
├────────────────────────────────────────────┤
│                 main / preload             │  ← Electron: ventana, IPC, seguridad
├────────────────────────────────────────────┤
│              application                   │  ← Caso de uso: orquesta el proceso
├────────────────────────────────────────────┤
│                 domain                     │  ← Reglas de negocio puras
├────────────────────────────────────────────┤
│              infrastructure                │  ← Acceso a XML, Excel y sistema de archivos
├────────────────────────────────────────────┤
│                 shared                     │  ← Tipos y constantes compartidas
└────────────────────────────────────────────┘
```

---

## Estructura de carpetas

```text
xml-volumetricos-electron/
├─ package.json                          → Dependencias y scripts del proyecto
├─ tsconfig.json                         → Configuración del compilador TypeScript
├─ README.md                             → Este archivo
├─ scripts/
│  └─ copy-assets.mjs                    → Copia la plantilla Excel al directorio de build
└─ src/
   ├─ assets/
   │  └─ templates/
   │     └─ plantilla_XML_volumetricos.xlsx   → Plantilla base del reporte Excel
   ├─ main/
   │  └─ main.ts                         → Proceso principal de Electron
   ├─ preload/
   │  └─ preload.ts                      → Puente seguro entre UI y sistema
   ├─ renderer/
   │  ├─ index.html                      → Estructura HTML de la interfaz
   │  ├─ styles.css                      → Estilos visuales de la app
   │  └─ renderer.ts                     → Lógica de la interfaz de usuario
   ├─ application/
   │  └─ use-cases/
   │     └─ process-xml-batch.use-case.ts  → Caso de uso: procesamiento por lotes
   ├─ domain/
   │  ├─ entities/
   │  │  └─ cfdi.ts                      → Definición de entidad CFDI parseada
   │  └─ services/
   │     └─ hydrocarbon-classifier.ts    → Clasificador de productos hidrocarburo
   ├─ infrastructure/
   │  ├─ excel/
   │  │  └─ excel-report.writer.ts       → Escritura del reporte Excel
   │  ├─ fs/
   │  │  └─ file-system.service.ts       → Operaciones sobre el sistema de archivos
   │  ├─ logging/
   │  │  └─ process-logger.ts            → Acumulador de logs del proceso
   │  └─ xml/
   │     └─ cfdi-xml.parser.ts           → Parser de archivos XML CFDI
   └─ shared/
      ├─ constants.ts                    → Constantes globales de la aplicación
      └─ types.ts                        → Interfaces y tipos TypeScript compartidos
```

---

## Descripción de cada archivo

### `src/main/main.ts` — Proceso principal
Es el corazón de Electron. Se encarga de:
- Crear y gestionar la ventana principal de la aplicación.
- Exponer los canales IPC que la UI puede invocar:
  - `dialog:select-input-directory` → abre un diálogo para elegir la carpeta de XMLs.
  - `dialog:select-output-directory` → abre un diálogo para elegir la carpeta de salida.
  - `app:get-default-output-directory` → devuelve el Escritorio del usuario como ruta predeterminada.
  - `process:start` → instancia todos los servicios, ejecuta el caso de uso y devuelve el resultado.
- Emitir eventos de progreso en tiempo real hacia la interfaz (`process:progress`).

### `src/preload/preload.ts` — Puente seguro
Actúa como intermediario entre la interfaz web y el proceso de Node.js. Usa `contextBridge` de Electron para exponer únicamente las funciones autorizadas al frontend, sin dar acceso directo al sistema operativo. Esto implementa la práctica de seguridad `contextIsolation` recomendada por Electron.

Funciones expuestas en `window.electronAPI`:
- `selectInputDirectory()` → seleccionar carpeta de entrada
- `selectOutputDirectory()` → seleccionar carpeta de salida
- `getDefaultOutputDirectory()` → obtener ruta de salida predeterminada
- `startProcess(payload)` → iniciar el procesamiento
- `onProgress(callback)` → suscribirse a eventos de progreso

### `src/renderer/index.html` + `renderer.ts` + `styles.css` — Interfaz de usuario
La pantalla visual de la app. Permite al usuario:
1. Seleccionar la carpeta con los XMLs de entrada.
2. Seleccionar la carpeta de salida del Excel.
3. Iniciar el proceso con un botón.
4. Ver la barra de progreso en tiempo real.
5. Ver un log en pantalla con el resultado de cada archivo procesado.

### `src/application/use-cases/process-xml-batch.use-case.ts` — Caso de uso principal
Orquesta todo el flujo de negocio:
1. Lista todos los archivos `.xml` de la carpeta seleccionada.
2. Los procesa uno a uno, notificando el progreso en cada paso.
3. Si un XML falla, lo registra en el log de errores y continúa con el siguiente.
4. Agrupa y consolida los conceptos por producto hidrocarburo para el resumen.
5. Llama al escritor de Excel para generar el archivo final.

### `src/domain/entities/cfdi.ts` — Entidad CFDI
Define la estructura de datos de una factura CFDI ya parseada. El objeto `ParsedCfdi` contiene:
- `factura` (`FacturaRecord`): cabecera del comprobante.
- `conceptos` (`ConceptoRecord[]`): líneas de productos detectados como hidrocarburos.

### `src/domain/services/hydrocarbon-classifier.ts` — Clasificador de hidrocarburos
Contiene la regla de negocio clave: determina si un concepto de factura corresponde a MAGNA, PREMIUM o DIESEL. Lo hace revisando tanto la **descripción** del producto como la **ClaveProdServ** del catálogo del SAT:

| Producto | ClaveProdServ SAT | Palabra clave en descripción |
|---|---|---|
| MAGNA | `15101514` | `MAGNA` |
| PREMIUM | `15101515` | `PREMIUM` |
| DIESEL | `15101505` | `DIESEL` |

Si el concepto no coincide con ningún hidrocarburo reconocido, se descarta y no aparece en el reporte.

### `src/infrastructure/xml/cfdi-xml.parser.ts` — Parser de XML CFDI
Lee físicamente cada archivo XML y lo convierte en objetos TypeScript. Extrae:

**Del comprobante (cabecera):** UUID del timbre fiscal, fecha, serie, folio, forma de pago, método de pago, moneda, subtotal y total.

**De cada concepto:** ClaveProdServ, descripción, clave de unidad, unidad, cantidad, valor unitario e importe.

Ignora automáticamente los namespaces XML para garantizar compatibilidad con distintos emisores de CFDI.

### `src/infrastructure/excel/excel-report.writer.ts` — Escritor de Excel
Toma la plantilla Excel del proyecto, la carga en memoria, limpia el contenido dinámico anterior y escribe los nuevos datos en cuatro hojas:
- **Resumen_General**: fecha de generación (`A4`), total de XMLs procesados (`C4`), total con error (`E4`), y tabla consolidada por producto desde la fila 7.
- **Facturas**: una fila por comprobante desde la fila 2.
- **Conceptos**: una fila por concepto de hidrocarburo desde la fila 2.
- **Logs**: registro de eventos del proceso desde la fila 2.

El archivo de salida se nombra `XML_Volumetricos_DDMMYYHHMMSS.xlsx` y se guarda en la carpeta elegida por el usuario.

### `src/infrastructure/fs/file-system.service.ts` — Servicio de archivos
Encapsula las operaciones sobre el sistema de archivos:
- `listXmlFiles(dir)`: lista y ordena alfabéticamente todos los `.xml` de una carpeta.
- `ensureDirectory(dir)`: crea la carpeta de salida si no existe.
- `exists(path)`: verifica si un archivo o carpeta existe.

### `src/infrastructure/logging/process-logger.ts` — Logger del proceso
Acumula en memoria los registros de log durante la ejecución. Cada entrada guarda:
- Nombre del archivo XML involucrado
- Fecha y hora del evento
- Nivel: `INFO`, `WARNING` o `ERROR`
- Mensaje y detalle

Al finalizar el proceso, los logs se escriben en la hoja "Logs" del Excel.

### `src/shared/types.ts` — Tipos compartidos
Define todas las interfaces TypeScript del proyecto que son usadas por múltiples capas:
- `FacturaRecord`: datos de la cabecera de un comprobante.
- `ConceptoRecord`: datos de una línea de producto.
- `ResumenRecord`: totales agregados por producto hidrocarburo.
- `ProcessLog`: entrada individual del log.
- `ProcessResult`: resultado completo devuelto al finalizar.
- `ProcessProgress`: progreso actual para actualizar la barra en pantalla.

### `src/shared/constants.ts` — Constantes globales
Centraliza todos los valores fijos de la aplicación:
- Nombre de las hojas del Excel (`Resumen_General`, `Facturas`, `Conceptos`, `Logs`).
- Mapeo de celdas de la plantilla (`A4`, `C4`, `E4`, filas de inicio por hoja).
- Carpeta de salida predeterminada (Escritorio del usuario).
- Palabras clave y claves SAT que identifican los hidrocarburos.

### `src/assets/templates/plantilla_XML_volumetricos.xlsx` — Plantilla Excel
Archivo Excel base con el formato, estilos y encabezados ya definidos. La aplicación la carga como punto de partida, escribe los datos sobre ella y guarda el resultado como un archivo nuevo con nombre único (timestamp). **No se sobreescribe la plantilla original.**

### `scripts/copy-assets.mjs` — Script de build
Script auxiliar que se ejecuta después de compilar TypeScript. Copia la plantilla Excel desde `src/assets/` hacia `dist/assets/` para que quede disponible cuando la aplicación Electron se ejecuta desde la carpeta de distribución.

---

## Flujo completo

```
Usuario selecciona carpeta de XMLs y carpeta de salida
                    ↓
     renderer.ts invoca window.electronAPI.startProcess()
                    ↓
     preload.ts reenvía la llamada vía ipcRenderer.invoke()
                    ↓
        main.ts recibe el evento 'process:start'
                    ↓
   ProcessXmlBatchUseCase.execute() orquesta el proceso
                    ↓
     FileSystemService lista todos los .xml de la carpeta
                    ↓
       Por cada XML → CfdiXmlParser.parse() lo lee
                    ↓
  HydrocarbonClassifier filtra solo MAGNA / PREMIUM / DIESEL
                    ↓
     Se acumulan facturas, conceptos, resumen y logs
                    ↓
   ExcelReportWriter.write() genera el .xlsx desde la plantilla
                    ↓
  El archivo queda guardado como XML_Volumetricos_DDMMYYHHMMSS.xlsx
                    ↓
    La interfaz muestra el resumen y el log al usuario
```

---

## Instalación y ejecución

### Requisitos previos
- Node.js 18 o superior
- npm 9 o superior

### Pasos

```bash
# 1. Instalar dependencias
npm install

# 2. Compilar y ejecutar
npm start
```

### Scripts disponibles

| Script | Descripción |
|---|---|
| `npm run build` | Compila TypeScript y copia los assets al directorio `dist/` |
| `npm start` | Compila y lanza la aplicación Electron |
| `npm run dev` | Igual que `start`, útil durante desarrollo |

---

## Plantilla Excel

La plantilla debe estar ubicada en:

```text
src/assets/templates/plantilla_XML_volumetricos.xlsx
```

La plantilla debe contener exactamente las siguientes hojas con estos nombres:

| Nombre de hoja | Descripción |
|---|---|
| `Resumen_General` | Resumen de totales por hidrocarburo |
| `Facturas` | Detalle de comprobantes |
| `Conceptos` | Detalle de conceptos por hidrocarburo |
| `Logs` | Registro del proceso |

Celdas fijas usadas en `Resumen_General`:

| Celda | Valor escrito |
|---|---|
| `A4` | Fecha y hora de generación |
| `C4` | Total de XMLs procesados |
| `E4` | Total de XMLs con error |

---

## Notas importantes

- La aplicación **no modifica** la plantilla original; siempre genera un archivo nuevo.
- Los conceptos que **no sean hidrocarburos** (MAGNA, PREMIUM, DIESEL) son ignorados y no aparecen en el reporte.
- Si un XML no puede parsearse (archivo corrupto, formato incorrecto, etc.), el error se registra en la hoja `Logs` y el proceso **continúa con el siguiente archivo**.
- El archivo de salida se nombra con timestamp (`DDMMYYHHMMSS`) para evitar sobreescrituras accidentales.
- La detección de hidrocarburo se realiza por **descripción** del concepto y/o por **ClaveProdServ** del catálogo del SAT.
