import fs from 'node:fs/promises';
import path from 'node:path';

export class FileSystemService {
  public async listXmlFiles(inputDir: string): Promise<string[]> {
    const entries = await fs.readdir(inputDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.xml'))
      .map((entry) => path.join(inputDir, entry.name))
      .sort((a, b) => a.localeCompare(b));
  }

  public async ensureDirectory(dirPath: string): Promise<void> {
    await fs.mkdir(dirPath, { recursive: true });
  }

  public async exists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
