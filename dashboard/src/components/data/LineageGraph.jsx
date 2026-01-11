/**
 * MONOLITH OS - Data Lineage Graph
 * Task 7.3.3.4 - Interactive data flow visualization
 * 
 * Shows data flow: Sources → Transformations → Destinations
 * Features clickable nodes with detail popups
 */

import { useState, useCallback, useMemo } from 'react';

// Mock data for lineage visualization
const MOCK_NODES = [
    // Data Sources
  { id: 'src-1', type: 'source', name: 'User Database', description: 'Primary user data store', x: 50, y: 100 },
  { id: 'src-2', type: 'source', name: 'Event Stream', description: 'Real-time event ingestion', x: 50, y: 220 },
  { id: 'src-3', type: 'source', name: 'API Gateway', description: 'External API data', x: 50, y: 340 },

    // Transformations
  { id: 'trans-1', type: 'transform', name: 'Data Enrichment', description: 'Adds demographic data', x: 300, y: 160 },
  { id: 'trans-2', type: 'transform', name: 'Aggregation', description: 'Computes daily metrics', x: 300, y: 280 },

    // Destinations
  { id: 'dest-1', type: 'destination', name: 'Analytics DW', description: 'Data warehouse for reporting', x: 550, y: 100 },
  { id: 'dest-2', type: 'destination', name: 'ML Pipeline', description: 'Model training data', x: 550, y: 220 },
  { id: 'dest-3', type: 'destination', name: 'Export API', description: 'External data exports', x: 550, y: 340 },
  ];

const MOCK_EDGES = [
  { from: 'src-1', to: 'trans-1' },
  { from: 'src-2', to: 'trans-1' },
  { from: 'src-2', to: 'trans-2' },
  { from: 'src-3', to: 'trans-2' },
  { from: 'trans-1', to: 'dest-1' },
  { from: 'trans-1', to: 'dest-2' },
  { from: 'trans-2', to: 'dest-2' },
  { from: 'trans-2', to: 'dest-3' },
  ];

const NODE_COLORS = {
    source: { bg: 'bg-blue-500', border: 'border-blue-400', fill: '#3b82f6' },
    transform: { bg: 'bg-amber-500', border: 'border-amber-400', fill: '#f59e0b' },
    destination: { bg: 'bg-emerald-500', border: 'border-emerald-400', fill: '#10b981' },
};

const NODE_LABELS = {
    source: 'Data Source',
    transform: 'Transformation',
    destination: 'Destination',
};

function LineageGraph() {
    const [selectedNode, setSelectedNode] = useState(null);

  const handleNodeClick = useCallback((node) => {
        setSelectedNode(selectedNode?.id === node.id ? null : node);
  }, [selectedNode]);

  const closePopup = useCallback(() => {
        setSelectedNode(null);
  }, []);

  // Calculate edge positions
  const edges = useMemo(() => {
        return MOCK_EDGES.map((edge) => {
                const fromNode = MOCK_NODES.find(n => n.id === edge.from);
                const toNode = MOCK_NODES.find(n => n.id === edge.to);
                if (!fromNode || !toNode) return null;

                                    return {
                                              ...edge,
                                              x1: fromNode.x + 100,
                                              y1: fromNode.y + 30,
                                              x2: toNode.x,
                                              y2: toNode.y + 30,
                                    };
        }).filter(Boolean);
  }, []);

  return (
        <div className="bg-monolith-dark rounded-lg border border-monolith-gray/30 p-6">
          {/* Header */}
              <div className="mb-6">
                      <h2 className="text-2xl font-bold text-white mb-2">Data Lineage</h2>h2>
                      <p className="text-gray-400">
                                Interactive visualization showing data flow from sources through transformations to destinations.
                      </p>p>
              </div>div>
        
          {/* Legend */}
              <div className="flex items-center gap-6 mb-6 p-4 bg-monolith-gray/10 rounded-lg">
                      <span className="text-sm text-gray-400 font-medium">Legend:</span>span>
                {Object.entries(NODE_LABELS).map(([type, label]) => (
                    <div key={type} className="flex items-center gap-2">
                                <div className={`w-4 h-4 rounded ${NODE_COLORS[type].bg}`} />
                                <span className="text-sm text-gray-300">{label}</span>span>
                    </div>div>
                  ))}
              </div>div>
        
          {/* Graph Container */}
              <div className="relative bg-monolith-darker rounded-lg border border-monolith-gray/20 overflow-hidden">
                      <svg 
                                  width="700" 
                        height="450" 
                        className="w-full"
                                  viewBox="0 0 700 450"
                                >
                        {/* Draw edges/connections */}
                                <defs>
                                            <marker
                                                            id="arrowhead"
                                                            markerWidth="10"
                                                            markerHeight="7"
                                                            refX="9"
                                                            refY="3.5"
                                                            orient="auto"
                                                          >
                                                          <polygon points="0 0, 10 3.5, 0 7" fill="#6b7280" />
                                            </marker>marker>
                                </defs>defs>
                                
                        {edges.map((edge, index) => (
                                              <path
                                                              key={index}
                                                              d={`M ${edge.x1} ${edge.y1} C ${edge.x1 + 50} ${edge.y1}, ${edge.x2 - 50} ${edge.y2}, ${edge.x2} ${edge.y2}`}
                                                              fill="none"
                                                              stroke="#4b5563"
                                                              strokeWidth="2"
                                                              markerEnd="url(#arrowhead)"
                                                              className="transition-all duration-200 hover:stroke-gray-400"
                                                            />
                                            ))}
                      
                        {/* Draw nodes */}
                        {MOCK_NODES.map((node) => (
                                              <g 
                                                              key={node.id}
                                                              className="cursor-pointer"
                                                              onClick={() => handleNodeClick(node)}
                                                            >
                                                            <rect
                                                                              x={node.x}
                                                                              y={node.y}
                                                                              width="100"
                                                                              height="60"
                                                                              rx="8"
                                                                              fill={NODE_COLORS[node.type].fill}
                                                                              className={`transition-all duration-200 ${
                                                                                                  selectedNode?.id === node.id ? 'opacity-100' : 'opacity-80 hover:opacity-100'
                                                                              }`}
                                                                              stroke={selectedNode?.id === node.id ? '#fff' : 'transparent'}
                                                                              strokeWidth="2"
                                                                            />
                                                            <text
                                                                              x={node.x + 50}
                                                                              y={node.y + 25}
                                                                              textAnchor="middle"
                                                                              fill="white"
                                                                              fontSize="11"
                                                                              fontWeight="600"
                                                                              className="pointer-events-none"
                                                                            >
                                                              {node.name.length > 14 ? node.name.substring(0, 12) + '...' : node.name}
                                                            </text>text>
                                                            <text
                                                                              x={node.x + 50}
                                                                              y={node.y + 42}
                                                                              textAnchor="middle"
                                                                              fill="rgba(255,255,255,0.7)"
                                                                              fontSize="9"
                                                                              className="pointer-events-none"
                                                                            >
                                                              {NODE_LABELS[node.type]}
                                                            </text>text>
                                              </g>g>
                                            ))}
                      </svg>svg>
              
                {/* Detail Popup */}
                {selectedNode && (
                    <div 
                                  className="absolute bg-monolith-dark border border-monolith-gray/50 rounded-lg shadow-xl p-4 min-w-[250px]"
                                  style={{
                                                  left: Math.min(selectedNode.x + 110, 420),
                                                  top: Math.max(selectedNode.y - 20, 10),
                                  }}
                                >
                                <div className="flex items-start justify-between mb-3">
                                              <div>
                                                              <h3 className="text-lg font-bold text-white">{selectedNode.name}</h3>h3>
                                                              <span className={`text-xs px-2 py-0.5 rounded ${NODE_COLORS[selectedNode.type].bg} text-white`}>
                                                                {NODE_LABELS[selectedNode.type]}
                                                              </span>span>
                                              </div>div>
                                              <button
                                                                onClick={closePopup}
                                                                className="text-gray-400 hover:text-white transition-colors"
                                                              >
                                                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                                              </svg>svg>
                                              </button>button>
                                </div>div>
                                
                                <p className="text-gray-400 text-sm mb-4">{selectedNode.description}</p>p>
                                
                                <div className="space-y-2 text-sm">
                                              <div className="flex justify-between">
                                                              <span className="text-gray-500">Node ID:</span>span>
                                                              <span className="text-gray-300 font-mono">{selectedNode.id}</span>span>
                                              </div>div>
                                              <div className="flex justify-between">
                                                              <span className="text-gray-500">Position:</span>span>
                                                              <span className="text-gray-300">({selectedNode.x}, {selectedNode.y})</span>span>
                                              </div>div>
                                              <div className="flex justify-between">
                                                              <span className="text-gray-500">Connections:</span>span>
                                                              <span className="text-gray-300">
                                                                {MOCK_EDGES.filter(e => e.from === selectedNode.id || e.to === selectedNode.id).length}
                                                              </span>span>
                                              </div>div>
                                </div>div>
                    </div>div>
                      )}
              </div>div>
        
          {/* Instructions */}
              <div className="mt-4 text-sm text-gray-500">
                      <p>Click on any node to view details. Connections show data flow direction.</p>p>
              </div>div>
        </div>div>
      );
}

export default LineageGraph;</div>
