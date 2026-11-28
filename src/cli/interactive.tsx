/* oxlint-disable react/only-export-components, react/set-state-in-effect */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { render, Text, Box, useInput, useApp } from 'ink';
import TextInput from 'ink-text-input';
import chokidar from 'chokidar';
import path from 'path';
import chalk from 'chalk';
import fs from 'fs-extra';
import { parseBatchADRs } from '../core/adrParser.js';
import { loadDecisionFileInputs } from '../core/decisionLoader.js';
import { validateAndComputeDAG } from '../core/dagEngine.js';
import { calculateGraphRisk } from '../core/risk.js';

// Shared utility function for loading ADRs
export async function loadGraph(dir: string) {
  const fullPath = path.resolve(process.cwd(), dir);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Directory not found: ${fullPath}`);
  }
  const { files: fileData } = await loadDecisionFileInputs(fullPath);
  if (fileData.length === 0) {
    throw new Error(`No ADR files found in ${fullPath}`);
  }
  const parsedADRs = parseBatchADRs(fileData, { baseDir: fullPath });
  const { validationResult, engine, mappedAdrs } = validateAndComputeDAG(parsedADRs);
  return { parsedADRs, validationResult, engine, mappedAdrs, fullPath };
}

// Mini components
const HomeView = ({ data, onSelect, validationResult }: any) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filtered = useMemo(() => {
    if (!query) return data.mappedAdrs;
    return data.mappedAdrs.filter((a: any) => 
      a.id.toLowerCase().includes(query.toLowerCase()) || 
      a.title.toLowerCase().includes(query.toLowerCase())
    );
  }, [query, data.mappedAdrs]);

  useInput((_input, key) => {
    if (key.upArrow) {
      setSelectedIndex(Math.max(0, selectedIndex - 1));
    }
    if (key.downArrow) {
      setSelectedIndex(Math.min(filtered.length - 1, selectedIndex + 1));
    }
    if (key.return) {
      if (filtered[selectedIndex]) {
        onSelect(filtered[selectedIndex].id);
      }
    }
  });

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color="cyan" bold>NirnayDAG Interactive Session</Text>
      </Box>
      <Box marginBottom={1}>
        <Text>Search: </Text>
        <TextInput value={query} onChange={(q) => { setQuery(q); setSelectedIndex(0); }} />
      </Box>
      <Box flexDirection="column" borderStyle="single" padding={1}>
        {filtered.slice(0, 10).map((adr: any, idx: number) => {
          const isSelected = idx === selectedIndex;
          const isInCycle = validationResult.hasCycle && validationResult.cyclePath?.includes(adr.id);
          const cycleBadge = isInCycle ? chalk.bgRed.white(' CYCLE ') : '';
          return (
            <Text key={adr.id} color={isSelected ? 'green' : undefined} bold={isSelected}>
              {isSelected ? '> ' : '  '}
              {adr.id}: {adr.title} ({adr.dependencies.length} deps) {cycleBadge}
            </Text>
          );
        })}
        {filtered.length > 10 && <Text color="gray">  ...and {filtered.length - 10} more</Text>}
      </Box>
      <Text color="gray">Arrows to navigate, Enter to select, 'q' to quit, 'v' to validate</Text>
    </Box>
  );
};

const DetailView = ({ adr, onBack, onBlast, engine }: any) => {
  useInput((input, key) => {
    if (input === 'b') onBlast();
    if (key.escape || input === 'h') onBack();
  });

  const dependents = engine.adjacencyList?.get(adr.id) || [];

  return (
    <Box flexDirection="column">
      <Box marginBottom={1} borderStyle="single" padding={1} flexDirection="column">
        <Text color="cyan" bold>{adr.id}: {adr.title}</Text>
        <Text color="gray">Status: {adr.status}</Text>
        <Text color="gray">Date: {adr.timestamp || 'Unknown'}</Text>
      </Box>
      
      <Box marginBottom={1}>
        <Text bold>Neighborhood Graph:</Text>
      </Box>
      <Box flexDirection="column" paddingLeft={2} marginBottom={1}>
        {adr.dependencies.length > 0 ? (
          adr.dependencies.map((dep: string) => <Text key={dep} color="magenta">↑ {dep}</Text>)
        ) : (
          <Text color="gray">(No dependencies)</Text>
        )}
        <Text color="green" bold>  {adr.id}</Text>
        {dependents.length > 0 ? (
          dependents.map((dep: string) => <Text key={dep} color="yellow">↓ {dep}</Text>)
        ) : (
          <Text color="gray">(No dependents)</Text>
        )}
      </Box>

      <Text color="gray">Press 'b' for Blast Radius, 'Esc' or 'h' to go back</Text>
    </Box>
  );
};

const BlastRadiusView = ({ adr, engine, onBack }: any) => {
  useInput((input, key) => {
    if (key.escape || input === 'h' || input === 'b') onBack();
  });

  const downstreamIds = engine.getBlastRadius(adr.id);
  const direct = engine.getDirectDependents(adr.id);
  const depth = engine.getDepth(adr.id);
  const risk = calculateGraphRisk(engine, adr.id);

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color="redBright" bold>Blast Radius: {adr.id}</Text>
      </Box>
      <Box borderStyle="single" padding={1} flexDirection="column">
        <Text>Risk Score: {risk.score > 60 ? chalk.red(risk.score) : risk.score > 30 ? chalk.yellow(risk.score) : chalk.green(risk.score)}/100 ({risk.level})</Text>
        <Text>Direct Dependents: {direct.length}</Text>
        <Text>Total Cascading Impacts: {downstreamIds.length}</Text>
        <Text>Max Depth: {depth}</Text>
      </Box>
      {downstreamIds.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>Impacted ADRs:</Text>
          {downstreamIds.slice(0, 15).map((id: string) => <Text key={id} color="yellow"> - {id}</Text>)}
          {downstreamIds.length > 15 && <Text color="gray"> ...and {downstreamIds.length - 15} more</Text>}
        </Box>
      )}
      <Box marginTop={1}>
        <Text color="gray">Press 'Esc' or 'b' to go back</Text>
      </Box>
    </Box>
  );
};

const App = ({ targetDir }: { targetDir: string }) => {
  const { exit } = useApp();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [graphData, setGraphData] = useState<any>(null);
  const [view, setView] = useState<'home' | 'detail' | 'blast'>('home');
  const [selectedAdrId, setSelectedAdrId] = useState<string | null>(null);
  const [cmdMode, setCmdMode] = useState(false);
  const [cmdQuery, setCmdQuery] = useState('');

  const reloadGraph = useCallback(async () => {
    try {
      const data = await loadGraph(targetDir);
      setGraphData(data);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [targetDir]);

  useEffect(() => {
    void reloadGraph();
    const watcher = chokidar.watch(targetDir, { ignoreInitial: true });
    watcher.on('all', () => {
      void reloadGraph();
    });
    return () => {
      void watcher.close();
    };
  }, [targetDir, reloadGraph]);

  useInput((input, key) => {
    if (cmdMode) {
      if (key.escape) setCmdMode(false);
      if (key.return) {
        // Simple command execution
        if (cmdQuery === 'q') exit();
        else if (cmdQuery === 'v') setView('home');
        setCmdMode(false);
        setCmdQuery('');
      }
      return; // Skip normal shortcuts while in cmd mode
    }

    if (input === 'q') exit();
    if (input === ':') setCmdMode(true);
    if (input === 'v') {
      reloadGraph();
      setView('home'); // ensures we see validation state
    }
  });

  if (loading) return <Text>Loading graph from {targetDir}...</Text>;
  if (error) return <Text color="red">Error: {error}</Text>;

  const selectedAdr = selectedAdrId ? graphData.mappedAdrs.find((a: any) => a.id === selectedAdrId) : null;

  return (
    <Box flexDirection="column" minHeight={20}>
      {view === 'home' && (
        <HomeView 
          data={graphData} 
          validationResult={graphData.validationResult}
          onSelect={(id: string) => { setSelectedAdrId(id); setView('detail'); }} 
        />
      )}
      {view === 'detail' && selectedAdr && (
        <DetailView 
          adr={selectedAdr} 
          engine={graphData.engine}
          onBack={() => setView('home')} 
          onBlast={() => setView('blast')} 
        />
      )}
      {view === 'blast' && selectedAdr && (
        <BlastRadiusView 
          adr={selectedAdr} 
          engine={graphData.engine}
          onBack={() => setView('detail')} 
        />
      )}

      {cmdMode && (
        <Box marginTop={1}>
          <Text color="cyan">:</Text>
          <TextInput value={cmdQuery} onChange={setCmdQuery} />
        </Box>
      )}

      {graphData.validationResult && !graphData.validationResult.isValid && view === 'home' && !cmdMode && (
        <Box marginTop={1}>
          <Text color="red" bold>Validation failed! Cycle detected. Check red badges.</Text>
        </Box>
      )}
    </Box>
  );
};

export async function runInteractiveSession(targetDir: string) {
  render(<App targetDir={targetDir} />);
}
