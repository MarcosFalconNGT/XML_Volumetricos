import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const files = [
  ['src/renderer/index.html', 'dist/renderer/index.html'],
  ['src/renderer/styles.css', 'dist/renderer/styles.css'],
  ['src/assets/templates/plantilla_XML_volumetricos.xlsx', 'dist/assets/templates/plantilla_XML_volumetricos.xlsx'],
];

for (const [sourceRelative, targetRelative] of files) {
  const source = path.join(root, sourceRelative);
  const target = path.join(root, targetRelative);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.copyFile(source, target);
}
