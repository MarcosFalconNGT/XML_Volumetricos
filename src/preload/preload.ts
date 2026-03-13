import { contextBridge, ipcRenderer } from 'electron';
import { ProcessProgress, ProcessResult } from '../shared/types';

contextBridge.exposeInMainWorld('electronAPI', {
  selectInputDirectory: () => ipcRenderer.invoke('dialog:select-input-directory') as Promise<string | null>,
  selectOutputDirectory: () => ipcRenderer.invoke('dialog:select-output-directory') as Promise<string | null>,
  getDefaultOutputDirectory: () => ipcRenderer.invoke('app:get-default-output-directory') as Promise<string>,
  startProcess: (payload: { inputDir: string; outputDir: string }) =>
    ipcRenderer.invoke('process:start', payload) as Promise<ProcessResult>,
  onProgress: (callback: (progress: ProcessProgress) => void) => {
    const handler = (_event: unknown, progress: ProcessProgress) => callback(progress);
    ipcRenderer.on('process:progress', handler);
    return () => ipcRenderer.removeListener('process:progress', handler);
  },
});

declare global {
  interface Window {
    electronAPI: {
      selectInputDirectory: () => Promise<string | null>;
      selectOutputDirectory: () => Promise<string | null>;
      getDefaultOutputDirectory: () => Promise<string>;
      startProcess: (payload: { inputDir: string; outputDir: string }) => Promise<ProcessResult>;
      onProgress: (callback: (progress: ProcessProgress) => void) => () => void;
    };
  }
}
