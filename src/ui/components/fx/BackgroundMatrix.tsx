import React, { useEffect, useState } from 'react';
import { useSimulationStore } from '../../store/useSimulationStore.js';

export const BackgroundMatrix: React.FC = () => {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const { isSimulationMode } = useSimulationStore();

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const spotColor = isSimulationMode ? 'rgba(245, 158, 11, 0.08)' : 'rgba(6, 182, 212, 0.06)';

  return (
    <div 
      className="absolute inset-0 pointer-events-none z-0 overflow-hidden"
      style={{
        background: `radial-gradient(800px circle at ${mousePos.x}px ${mousePos.y}px, ${spotColor}, transparent 80%)`,
      }}
    >
      <div 
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1px)',
          backgroundSize: '32px 32px'
        }}
      />
    </div>
  );
};
