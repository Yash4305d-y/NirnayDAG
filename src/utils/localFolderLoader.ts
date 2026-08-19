import { parseADRMarkdown } from '../parser/adrParser.js';
import type { NirnayADR } from '../core/types.js';

export async function loadLocalADRs(): Promise<NirnayADR[] | null> {
  try {
    if ('showDirectoryPicker' in window) {
      // @ts-ignore
      const dirHandle = await window.showDirectoryPicker();
      const adrs: NirnayADR[] = [];
      
      // @ts-ignore
      for await (const entry of dirHandle.values()) {
        if (entry.kind === 'file' && entry.name.endsWith('.md')) {
          const file = await entry.getFile();
          const content = await file.text();
          try {
            adrs.push(parseADRMarkdown(content));
          } catch (e) {
            console.warn(`Failed to parse ${entry.name}:`, e);
          }
        }
      }
      return adrs.length > 0 ? adrs : null;
    } else {
      return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        // @ts-ignore
        input.webkitdirectory = true;
        input.onchange = async (e) => {
          const files = (e.target as HTMLInputElement).files;
          if (!files) return resolve(null);
          const adrs: NirnayADR[] = [];
          for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file.name.endsWith('.md')) {
              const content = await file.text();
              try {
                adrs.push(parseADRMarkdown(content));
              } catch (err) {
                console.warn(`Failed to parse ${file.name}:`, err);
              }
            }
          }
          resolve(adrs.length > 0 ? adrs : null);
        };
        input.click();
      });
    }
  } catch (e) {
    console.error("User cancelled or API not supported", e);
    return null;
  }
}
