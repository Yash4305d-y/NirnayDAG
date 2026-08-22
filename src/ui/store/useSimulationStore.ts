import { create } from 'zustand';
import type { NirnayADR } from '../../core/types.js';

export interface SimulationState {
  isSimulationMode: boolean;
  simulatedOverrides: Record<string, Partial<NirnayADR>>;
  virtualNodes: NirnayADR[];
  virtualEdges: { source: string; target: string }[];
  fragilityScore: number;
  
  toggleSimulationMode: () => void;
  setOverride: (nodeId: string, override: Partial<NirnayADR>) => void;
  addVirtualNode: (node: NirnayADR) => void;
  addVirtualEdge: (source: string, target: string) => void;
  resetSimulation: () => void;
  setFragilityScore: (score: number) => void;
}

export const useSimulationStore = create<SimulationState>((set) => ({
  isSimulationMode: false,
  simulatedOverrides: {},
  virtualNodes: [],
  virtualEdges: [],
  fragilityScore: 0,

  toggleSimulationMode: () =>
    set((state) => ({ isSimulationMode: !state.isSimulationMode })),
  
  setOverride: (nodeId, override) =>
    set((state) => ({
      simulatedOverrides: {
        ...state.simulatedOverrides,
        [nodeId]: { ...state.simulatedOverrides[nodeId], ...override },
      },
    })),

  addVirtualNode: (node) =>
    set((state) => ({
      virtualNodes: [...state.virtualNodes, node],
    })),

  addVirtualEdge: (source, target) =>
    set((state) => ({
      virtualEdges: [...state.virtualEdges, { source, target }],
    })),

  resetSimulation: () =>
    set({
      simulatedOverrides: {},
      virtualNodes: [],
      virtualEdges: [],
      fragilityScore: 0,
    }),

  setFragilityScore: (score) => set({ fragilityScore: score }),
}));
