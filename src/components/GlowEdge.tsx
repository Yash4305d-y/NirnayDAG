import type { EdgeProps } from '@xyflow/react';
import { getBezierPath } from '@xyflow/react';

export const GlowEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
}: EdgeProps) => {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <g className="group">
      {/* Background Soft Glow Path */}
      <path
        id={`${id}-glow`}
        d={edgePath}
        fill="none"
        stroke={selected ? '#06b6d4' : '#38bdf8'}
        strokeWidth={selected ? 5 : 3}
        strokeOpacity={selected ? 0.6 : 0.2}
        className="transition-all duration-300 filter blur-sm"
      />

      {/* Core Sharp Stroke */}
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke={selected ? '#22d3ee' : '#64748b'}
        strokeWidth={selected ? 2 : 1.5}
        strokeOpacity={selected ? 1 : 0.6}
        className="transition-colors duration-300"
      />

      {/* Directed Pulse Animation Particle */}
      <circle r="3" fill="#38bdf8" filter="drop-shadow(0 0 6px #38bdf8)">
        <animateMotion dur="2.4s" repeatCount="indefinite" path={edgePath} />
      </circle>
    </g>
  );
};
