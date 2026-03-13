# XML Volumétricos - Electron + TypeScript

## Estructura de carpetas

```text
xml-volumetricos-electron/
├─ package.json
├─ tsconfig.json
├─ README.md
└─ src/
   ├─ assets/
   │  └─ templates/
   │     └─ plantilla_XML_volumetricos.xlsx
   ├─ main/
   │  └─ main.ts
   ├─ preload/
   │  └─ preload.ts
   ├─ renderer/
   │  ├─ index.html
   │  ├─ styles.css
   │  └─ renderer.ts
   ├─ application/
   │  └─ use-cases/
   │     └─ process-xml-batch.use-case.ts
   ├─ domain/
   │  ├─ entities/
   │  │  └─ cfdi.ts
   │  └─ services/
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
   └─ shared/
      ├─ constants.ts
      └─ types.ts
```

## Dónde va la plantilla

Debes dejar la plantilla en:

```text
src/assets/templates/plantilla_XML_volumetricos.xlsx
```

## Instalación

```bash
npm install
npm run build
npm start
```

## Notas importantes

- La plantilla se toma fija desde el proyecto.
- La salida se guarda como `XML_Volumetricos_DDMMYYHHMMSS.xlsx`.
- La detección de hidrocarburos se hace por `Descripcion` y `ClaveProdServ`.
- Se consideran `MAGNA`, `PREMIUM` y `DIESEL`.
- La hoja `Resumen_General` usa:
  - `A4` para `FECHA_GENERACION`
  - `D4` para `TOTAL_XML_PROCESADOS`
  - `F4` para `TOTAL_XML_ERROR`

## Recomendación

Tu plantilla actualmente solo trae definido el named range `FECHA_GENERACION`. Si quieres que el proyecto quede más consistente, conviene agregar también:

- `TOTAL_XML_PROCESADOS`
- `TOTAL_XML_ERROR`

Aunque el código actual ya llena esos valores usando celdas fijas.
