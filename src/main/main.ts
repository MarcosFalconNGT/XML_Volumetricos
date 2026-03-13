import path from 'node:path';
import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { DEFAULT_OUTPUT_DIR, TEMPLATE_RELATIVE_PATH } from '../shared/constants';
import { FileSystemService } from '../infrastructure/fs/file-system.service';
import { CfdiXmlParser } from '../infrastructure/xml/cfdi-xml.parser';
import { ExcelReportWriter } from '../infrastructure/excel/excel-report.writer';
import { ProcessXmlBatchUseCase } from '../application/use-cases/process-xml-batch.use-case';

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 980,
    height: 760,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('dialog:select-input-directory', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0];
});

ipcMain.handle('dialog:select-output-directory', async () => {
  const result = await dialog.showOpenDialog({
    defaultPath: DEFAULT_OUTPUT_DIR,
    properties: ['openDirectory', 'createDirectory'],
  });
  return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0];
});

ipcMain.handle('app:get-default-output-directory', async () => DEFAULT_OUTPUT_DIR);

ipcMain.handle('process:start', async (_event, payload: { inputDir: string; outputDir: string }) => {
  if (!mainWindow) throw new Error('La ventana principal no está disponible.');

  const templatePath = path.join(app.getAppPath(), 'dist', TEMPLATE_RELATIVE_PATH);
  const fsService = new FileSystemService();
  const parser = new CfdiXmlParser();
  const excelWriter = new ExcelReportWriter();
  const useCase = new ProcessXmlBatchUseCase(fsService, parser, excelWriter);

  const result = await useCase.execute({
    inputDir: payload.inputDir,
    outputDir: payload.outputDir,
    templatePath,
    onProgress: (progress) => {
      mainWindow?.webContents.send('process:progress', progress);
    },
  });

  return result;
});
