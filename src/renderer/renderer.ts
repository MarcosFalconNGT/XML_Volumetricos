const inputDir = document.getElementById('inputDir') as HTMLInputElement;
const outputDir = document.getElementById('outputDir') as HTMLInputElement;
const selectInputBtn = document.getElementById('selectInputBtn') as HTMLButtonElement;
const selectOutputBtn = document.getElementById('selectOutputBtn') as HTMLButtonElement;
const startBtn = document.getElementById('startBtn') as HTMLButtonElement;
const progressBar = document.getElementById('progressBar') as HTMLProgressElement;
const progressText = document.getElementById('progressText') as HTMLSpanElement;
const logsPanel = document.getElementById('logsPanel') as HTMLElement;

function appendLog(message: string): void {
  logsPanel.textContent += `${message}\n`;
  logsPanel.scrollTop = logsPanel.scrollHeight;
}

async function bootstrap(): Promise<void> {
  outputDir.value = await window.electronAPI.getDefaultOutputDirectory();
}

selectInputBtn.addEventListener('click', async () => {
  const selected = await window.electronAPI.selectInputDirectory();
  if (selected) inputDir.value = selected;
});

selectOutputBtn.addEventListener('click', async () => {
  const selected = await window.electronAPI.selectOutputDirectory();
  if (selected) outputDir.value = selected;
});

window.electronAPI.onProgress((progress) => {
  const percent = progress.total === 0 ? 0 : Math.round((progress.current / progress.total) * 100);
  progressBar.value = percent;
  progressText.textContent = `${progress.message} (${progress.current}/${progress.total})`;
  appendLog(`[INFO] ${progress.message}`);
});

startBtn.addEventListener('click', async () => {
  logsPanel.textContent = '';

  if (!inputDir.value.trim()) {
    appendLog('[ERROR] Debes seleccionar una carpeta de XML.');
    return;
  }

  if (!outputDir.value.trim()) {
    appendLog('[ERROR] Debes seleccionar una carpeta de salida.');
    return;
  }

  progressBar.value = 0;
  progressText.textContent = 'Iniciando proceso...';
  startBtn.disabled = true;

  try {
    const result = await window.electronAPI.startProcess({
      inputDir: inputDir.value,
      outputDir: outputDir.value,
    });

    progressBar.value = 100;
    progressText.textContent = 'Proceso finalizado';
    appendLog(`[INFO] XML procesados: ${result.totalXmlProcesados}`);
    appendLog(`[INFO] XML con error: ${result.totalXmlError}`);
    appendLog(`[INFO] Facturas: ${result.facturas.length}`);
    appendLog(`[INFO] Conceptos: ${result.conceptos.length}`);
    appendLog(`[INFO] Archivo generado: ${result.outputPath}`);

    for (const log of result.logs) {
      appendLog(`[${log.nivel}] ${log.archivoXML} - ${log.mensaje}${log.detalle ? ` | ${log.detalle}` : ''}`);
    }
  } catch (error) {
    appendLog(`[ERROR] ${error instanceof Error ? error.message : 'Error desconocido'}`);
  } finally {
    startBtn.disabled = false;
  }
});

void bootstrap();
