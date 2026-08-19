import { parseADRMarkdown } from '../parser/adrParser.js';
import type { NirnayADR } from '../core/types.js';

export interface FolderLoadResult {
  adrs: NirnayADR[];
  errors: Array<{ file: string; message: string }>;
  count: number;
}

export async function loadViaDirectoryPicker(): Promise<FolderLoadResult> {
  const result: FolderLoadResult = { adrs: [], errors: [], count: 0 };
  
  try {
    if (!('showDirectoryPicker' in window)) {
      throw new Error("Directory picker not supported");
    }

    // @ts-ignore
    const dirHandle = await window.showDirectoryPicker();
    
    // @ts-ignore
    async function walkDirectory(dirHandle: any, path: string = '') {
      for await (const entry of dirHandle.values()) {
        if (entry.kind === 'file' && (entry.name.endsWith('.md') || entry.name.endsWith('.markdown'))) {
          const file = await entry.getFile();
          const content = await file.text();
          try {
            result.adrs.push(parseADRMarkdown(content, entry.name));
            result.count++;
          } catch (e: any) {
            result.errors.push({ file: `${path}${entry.name}`, message: e.message });
          }
        } else if (entry.kind === 'directory') {
          await walkDirectory(entry, `${path}${entry.name}/`);
        }
      }
    }
    
    await walkDirectory(dirHandle);
    
  } catch (e: any) {
    if (e.name !== 'AbortError') {
      console.error("Folder access failed", e);
      result.errors.push({ file: 'System', message: `Access Error: ${e.message}` });
    }
  }
  
  return result;
}

export async function loadViaFileInput(fileList: FileList): Promise<FolderLoadResult> {
  const result: FolderLoadResult = { adrs: [], errors: [], count: 0 };
  
  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];
    if (file.name.endsWith('.md') || file.name.endsWith('.markdown')) {
      const content = await file.text();
      try {
        result.adrs.push(parseADRMarkdown(content, file.name));
        result.count++;
      } catch (err: any) {
        result.errors.push({ file: file.webkitRelativePath || file.name, message: err.message });
      }
    }
  }
  
  return result;
}
