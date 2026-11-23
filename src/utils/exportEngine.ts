import { toPng, toSvg } from 'html-to-image';
import type { ParsedADR, BlastRadiusMap } from '../core/types.js';

function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function downloadDataUrl(filename: string, dataUrl: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function exportGraphAsJSON(
  adrs: ParsedADR[],
  blastRadiusMap: BlastRadiusMap,
  topologicalOrder: string[]
): void {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const data = {
      schemaVersion: '1.0.0',
      timestamp: new Date().toISOString(),
      totalDecisions: adrs.length,
      adrs,
      topologicalOrder,
      blastRadiusMap,
    };
    
    const jsonString = JSON.stringify(data, null, 2);
    downloadFile(`nirnay-dag-${timestamp}.json`, jsonString, 'application/json');
  } catch (err: any) {
    console.error('Failed to export JSON:', err);
    throw new Error('Failed to export JSON graph schema.');
  }
}

export async function exportCanvasToPNG(): Promise<void> {
  try {
    const element = document.querySelector('.react-flow__viewport') as HTMLElement;
    if (!element) {
      throw new Error('Canvas element (.react-flow__viewport) not found.');
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    const dataUrl = await toPng(element, {
      pixelRatio: 2,
      backgroundColor: '#07090e',
      style: {
        background: '#07090e',
      }
    });
    
    downloadDataUrl(`nirnay-architecture-dag-${timestamp}.png`, dataUrl);
  } catch (err: any) {
    console.error('Failed to export PNG:', err);
    throw new Error(err.message || 'Failed to export high-DPI PNG.');
  }
}

export async function exportCanvasToSVG(): Promise<void> {
  try {
    const element = document.querySelector('.react-flow') as HTMLElement;
    if (!element) {
      throw new Error('React Flow container not found.');
    }

    const filter = (node: HTMLElement) => {
      const exclusionClasses = [
        'react-flow__minimap',
        'react-flow__controls',
        'react-flow__panel',
        // Common UI overlays to exclude
        'fixed',
        'absolute z-40',
        'absolute z-50'
      ];
      
      if (node.classList && typeof node.classList.contains === 'function') {
        const hasExcludedClass = exclusionClasses.some(className => {
          // Some classes have multiple parts, just check if node has all parts
          const parts = className.split(' ');
          return parts.every(part => node.classList.contains(part));
        });
        if (hasExcludedClass) return false;
      }
      return true;
    };

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dataUrl = await toSvg(element, {
      filter: filter as any,
      backgroundColor: '#07090e',
      style: {
        background: '#07090e',
      }
    });
    
    downloadDataUrl(`nirnay-architecture-dag-${timestamp}.svg`, dataUrl);
  } catch (err: any) {
    console.error('Failed to export SVG:', err);
    throw new Error(err.message || 'Failed to export vector SVG.');
  }
}
