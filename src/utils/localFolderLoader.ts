export const isFileSystemAccessSupported = (): boolean => {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
};

export async function readFilesFromInput(fileList: FileList | File[]): Promise<Array<{ name: string; content: string }>> {
  const files: Array<{ name: string; content: string }> = [];
  const fileArray = Array.from(fileList);
  
  const mdFiles = fileArray.filter(f => 
    f.name.toLowerCase().endsWith('.md') || f.name.toLowerCase().endsWith('.markdown')
  );
  
  await Promise.all(mdFiles.map(async (file) => {
    try {
      const content = await file.text();
      files.push({ name: file.name, content });
    } catch (err: any) {
      console.warn(`Failed to read file ${file.name}: ${err.message}`);
    }
  }));

  return files;
}

export async function loadFromDirectoryPicker(): Promise<{ files: Array<{ name: string; content: string }>; errors: string[] }> {
  const errors: string[] = [];
  const files: Array<{ name: string; content: string }> = [];

  if (!('showDirectoryPicker' in window)) {
    errors.push('Your browser does not support the File System Access API. Please use the fallback method.');
    return { files, errors };
  }

  try {
    const dirHandle = await window.showDirectoryPicker({ mode: 'read' });
    
    async function traverse(handle: FileSystemDirectoryHandle) {
      for await (const entry of handle.values()) {
        if (entry.kind === 'file') {
          if (entry.name.toLowerCase().endsWith('.md') || entry.name.toLowerCase().endsWith('.markdown')) {
            try {
              const file = await entry.getFile();
              const content = await file.text();
              files.push({ name: entry.name, content });
            } catch (err: any) {
              errors.push(`Failed to read file ${entry.name}: ${err.message}`);
            }
          }
        } else if (entry.kind === 'directory') {
          if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
            await traverse(entry);
          }
        }
      }
    }

    await traverse(dirHandle);

  } catch (err: any) {
    if (err.name === 'AbortError') {
      // User aborted selection, not an error
      console.log('User aborted directory selection.');
    } else {
      errors.push(`Directory selection failed: ${err.message}`);
    }
  }

  return { files, errors };
}

export async function loadFromFileInput(inputFiles: FileList | File[]): Promise<{ files: Array<{ name: string; content: string }>; errors: string[] }> {
  const errors: string[] = [];
  const files: Array<{ name: string; content: string }> = [];

  const fileArray = Array.from(inputFiles);
  
  const mdFiles = fileArray.filter(f => 
    f.name.toLowerCase().endsWith('.md') || f.name.toLowerCase().endsWith('.markdown')
  );
  
  await Promise.all(mdFiles.map(async (file) => {
    try {
      const content = await file.text();
      files.push({ name: file.name, content });
    } catch (err: any) {
      errors.push(`Failed to read file ${file.name}: ${err.message}`);
    }
  }));

  return { files, errors };
}

// Keep existing names exported for backward compatibility if needed by other files, or just alias them.
export const loadViaDirectoryPicker = loadFromDirectoryPicker;
export const loadViaFileInput = loadFromFileInput;
