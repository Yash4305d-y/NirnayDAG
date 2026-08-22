import React from 'react';
import { getBezierPath, EdgeProps } from '@xyflow/react';

export const EnergyFlowEdge: React.FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  animated,
  style
}) => {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const isCascade = style?.stroke === 'var(--glow-tyakta)';
  const glowColor = isCascade ? 'var(--glow-tyakta)' : (selected ? 'var(--glow-active)' : '#38bdf8');

  return (
    <g className="group">
      <path
        id={`${id}-base`}
        d={edgePath}
        fill="none"
        stroke="#ffffff"
        strokeWidth={1.5}
        strokeOpacity={0.15}
        className="transition-colors duration-300"
      />

      <path
        id={`${id}-glow`}
        d={edgePath}
        fill="none"
        stroke={glowColor}
        strokeWidth={selected ? 4 : 2}
        strokeOpacity={selected ? 0.8 : 0.4}
        className="transition-all duration-300"
        style={{
          filter: `drop-shadow(0 0 6px ${glowColor})`,
        }}
      />

      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke={glowColor}
        strokeWidth={selected ? 2.5 : 1.5}
        strokeOpacity={isCascade ? 1 : (animated ? 0.9 : 0.2)}
        className={isCascade ? "animate-[flicker_1s_infinite]" : (animated ? "animate-[dash_1s_linear_infinite]" : "transition-colors")}
        style={isCascade ? { strokeDasharray: '4, 4' } : (animated ? { strokeDasharray: '10, 20' } : {})}
      />

      <style>{`
        @keyframes dash {
          to {
            stroke-dashoffset: -30;
          }
        }
        @keyframes flicker {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </g>
  );
};
