import { toPng, toSvg } from 'html-to-image';
import type { NirnayADR } from '../core/types.js';

export async function exportToPng(element: HTMLElement, width: number, height: number): Promise<void> {
  const dataUrl = await toPng(element, {
    backgroundColor: '#05070B',
    width: width,
    height: height,
    pixelRatio: 2,
    style: {
      transform: 'translate(0, 0) scale(1)',
    },
    filter: (node) => {
      // Filter out UI overlays
      if (node.classList?.contains('react-flow__controls')) return false;
      if (node.classList?.contains('react-flow__minimap')) return false;
      return true;
    }
  });

  downloadDataUrl(dataUrl, `nirnay-dag-${Date.now()}.png`);
}

export async function exportToSvg(element: HTMLElement, width: number, height: number): Promise<void> {
  const dataUrl = await toSvg(element, {
    backgroundColor: '#05070B',
    width: width,
    height: height,
    style: {
      transform: 'translate(0, 0) scale(1)',
    },
    filter: (node) => {
      if (node.classList?.contains('react-flow__controls')) return false;
      if (node.classList?.contains('react-flow__minimap')) return false;
      return true;
    }
  });

  downloadDataUrl(dataUrl, `nirnay-dag-${Date.now()}.svg`);
}

export function exportToJson(adrs: NirnayADR[]): void {
  const data = JSON.stringify(adrs, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  downloadDataUrl(url, `nirnay-dag-${Date.now()}.json`);
  URL.revokeObjectURL(url);
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a');
  a.setAttribute('download', filename);
  a.setAttribute('href', dataUrl);
  a.click();
}
