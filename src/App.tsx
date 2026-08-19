import { useState } from 'react';
import { NirnayCanvas } from './components/NirnayCanvas';
import { TopNavHUD } from './components/TopNavHUD';
import { DecisionDrawer } from './components/DecisionDrawer';
import { BlastRadiusOverlay } from './components/BlastRadiusOverlay';
import { sampleAdrs } from './mocks/sampleAdrs';

function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSimulating, setIsSimulating] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [impactedCount, setImpactedCount] = useState(0);

  const selectedNode = selectedNodeId ? sampleAdrs.find(n => n.id === selectedNodeId) || null : null;

  return (
    <div className="relative w-full h-screen overflow-hidden bg-obsidian bg-dot-matrix bg-dot">
      <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white/[0.03] via-transparent to-transparent pointer-events-none" />

      <TopNavHUD
        onSearch={setSearchQuery}
        isSimulating={isSimulating}
        onSimulateToggle={() => setIsSimulating(prev => !prev)}
        onExport={() => alert('Exporting graph...')}
      />

      <div className="absolute inset-0 z-10">
        <NirnayCanvas
          data={sampleAdrs}
          searchQuery={searchQuery}
          isSimulating={isSimulating}
          selectedNodeId={selectedNodeId}
          onNodeSelect={setSelectedNodeId}
          onImpactComputed={setImpactedCount}
        />
      </div>

      <DecisionDrawer
        isOpen={!!selectedNode}
        node={selectedNode}
        onClose={() => setSelectedNodeId(null)}
        onNavigateToNode={setSelectedNodeId}
      />

      {isSimulating && selectedNodeId && (
        <BlastRadiusOverlay impactedCount={impactedCount} />
      )}
    </div>
  );
}

export default App;
