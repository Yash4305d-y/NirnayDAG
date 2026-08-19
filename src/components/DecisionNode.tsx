import { Handle, Position } from '@xyflow/react';
import type { Node, NodeProps } from '@xyflow/react';
import type { NirnayNode } from '../core/types';
import { clsx } from 'clsx';
import { CheckCircle2, Clock, XCircle, AlertCircle } from 'lucide-react';

export type DecisionNodeType = Node<NirnayNode & { isDimmed?: boolean; isImpacted?: boolean }, 'decision'>;

export function DecisionNode({ data, selected }: NodeProps<DecisionNodeType>) {
  const isAccepted = data.status === 'accepted';
  const isProposed = data.status === 'proposed';
  const isSuperseded = data.status === 'superseded';
  const isDeprecated = data.status === 'deprecated';
  
  const isDimmed = data.isDimmed;
  const isImpacted = data.isImpacted;

  return (
    <div
      className={clsx(
        'relative w-72 rounded-xl border p-4 backdrop-blur-xl transition-all duration-300',
        selected ? 'scale-105 shadow-2xl z-50' : 'hover:scale-102 hover:shadow-xl z-0',
        isDimmed ? 'opacity-20 grayscale' : 'opacity-100',
        isImpacted && !selected ? 'ring-2 ring-tyakta shadow-[0_0_20px_rgba(244,63,94,0.3)]' : '',
        {
          'bg-panel border-siddha-emerald/30': isAccepted && !selected,
          'bg-panel border-siddha-emerald': isAccepted && selected,
          'bg-panel border-vichar/30': isProposed && !selected,
          'bg-panel border-vichar': isProposed && selected,
          'bg-panel border-parivartan/30': isSuperseded && !selected,
          'bg-panel border-parivartan': isSuperseded && selected,
          'bg-panel border-tyakta/30': isDeprecated && !selected,
          'bg-panel border-tyakta': isDeprecated && selected,
        }
      )}
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-500 !w-3 !h-3 !border-2 !border-obsidian" />

      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center space-x-2">
          {isAccepted && <CheckCircle2 className="w-4 h-4 text-siddha-emerald" />}
          {isProposed && <Clock className="w-4 h-4 text-vichar" />}
          {isSuperseded && <AlertCircle className="w-4 h-4 text-parivartan" />}
          {isDeprecated && <XCircle className="w-4 h-4 text-tyakta" />}
          
          <span className={clsx(
            'text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border',
            {
              'bg-siddha-emerald/10 text-siddha-emerald border-siddha-emerald/20': isAccepted,
              'bg-vichar/10 text-vichar border-vichar/20': isProposed,
              'bg-parivartan/10 text-parivartan border-parivartan/20': isSuperseded,
              'bg-tyakta/10 text-tyakta border-tyakta/20': isDeprecated,
            }
          )}>
            {data.status}
          </span>
        </div>
        
        <span className="text-[10px] font-mono text-gray-400 bg-white/[0.05] px-2 py-0.5 rounded border border-white/[0.1]">
          {data.id}
        </span>
      </div>

      <h3 className="text-sm font-semibold text-gray-100 leading-tight mb-2">
        {data.title}
      </h3>
      
      <p className="text-xs text-gray-400 line-clamp-2">
        {data.context}
      </p>

      <Handle type="source" position={Position.Bottom} className="!bg-gray-500 !w-3 !h-3 !border-2 !border-obsidian" />
    </div>
  );
}
