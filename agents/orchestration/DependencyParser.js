/**
 * MONOLITH OS - Dependency Parser
 * Phase 7: Task Orchestration Engine
 *
 * Parses task notes and content to extract dependency references.
 * Identifies dependencies based on natural language patterns and task ID references.
 *
 * Supported dependency patterns:
 * - "Dependent on X"
 * - "Requires X"
 * - "After X completes"
 * - "Blocked by X"
 * - "Needs X first"
 * - Task ID references (e.g., "ceo-001", "cto-003")
 * - Workflow references (e.g., "after Business Number registration")
 */

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Regular expressions for detecting dependency patterns in task text
 */
const DEPENDENCY_PATTERNS = [
  // Direct dependency phrases
  { pattern: /(?:dependent\s+on|depends\s+on)\s+["""]?([^""",.]+)["""]?/gi, type: 'depends_on' },
  { pattern: /requires?\s+["""]?([^""",.]+)["""]?(?:\s+(?:to\s+be\s+)?(?:complete|done|finished))?/gi, type: 'requires' },
  { pattern: /after\s+["""]?([^""",.]+)["""]?\s+(?:completes?|is\s+(?:done|complete|finished))/gi, type: 'after_completion' },
  { pattern: /blocked\s+by\s+["""]?([^""",.]+)["""]?/gi, type: 'blocked_by' },
  { pattern: /needs?\s+["""]?([^""",.]+)["""]?\s+first/gi, type: 'needs_first' },
  { pattern: /waiting\s+(?:for|on)\s+["""]?([^""",.]+)["""]?/gi, type: 'waiting_for' },
  { pattern: /(?:once|when)\s+["""]?([^""",.]+)["""]?\s+(?:is\s+)?(?:done|complete|finished)/gi, type: 'when_complete' },
  { pattern: /cannot\s+(?:start|begin|proceed)\s+(?:until|without)\s+["""]?([^""",.]+)["""]?/gi, type: 'cannot_start_until' },
  { pattern: /prerequisite:\s*["""]?([^""",.]+)["""]?/gi, type: 'prerequisite' },
];

/**
 * Pattern for matching task IDs (e.g., ceo-001, cto-003, task-2024-0117-001)
 */
const TASK_ID_PATTERNS = [
  // Role-based IDs: ceo-001, cto-003, chro-001
  /\b([a-z]{2,4})-(\d{3})\b/gi,
  // Full task IDs: TASK-2024-0117-001
  /\b(TASK-\d{4}-\d{4}-\d{3})\b/gi,
  // UUID-style references
  /\btask[_-]?id:\s*([a-f0-9-]{36})\b/gi,
];

/**
 * Mapping of common business phrases to likely agent roles
 * Used to infer which team/agent a dependency might relate to
 */
const PHRASE_TO_ROLE_MAPPING = {
  // CEO Tasks
  'business number': 'ceo',
  'bn registration': 'ceo',
  'corporate registration': 'ceo',
  'business registration': 'ceo',
  'company incorporation': 'ceo',
  'strategic plan': 'ceo',
  'board approval': 'ceo',
  'investor': 'ceo',
  'funding': 'ceo',
  'partnership': 'ceo',

  // CFO Tasks
  'budget': 'cfo',
  'financial': 'cfo',
  'accounting': 'cfo',
  'expense': 'cfo',
  'revenue': 'cfo',
  'forecast': 'cfo',
  'tax': 'cfo',
  'audit': 'cfo',
  'bank account': 'cfo',
  'payment processing': 'cfo',

  // CTO Tasks
  'hosting': 'cto',
  'infrastructure': 'cto',
  'architecture': 'cto',
  'tech stack': 'cto',
  'technology': 'cto',
  'system design': 'cto',
  'database': 'cto',
  'server': 'cto',
  'cloud': 'cto',
  'aws': 'cto',
  'railway': 'cto',
  'vercel': 'cto',

  // CHRO/HR Tasks
  'cra payroll': 'chro',
  'payroll': 'chro',
  'hiring': 'chro',
  'recruitment': 'chro',
  'employee': 'chro',
  'benefits': 'chro',
  'hr policy': 'chro',
  'onboarding': 'chro',
  'workforce': 'chro',

  // COO Tasks
  'operations': 'coo',
  'process': 'coo',
  'workflow': 'coo',
  'sop': 'coo',
  'vendor': 'coo',
  'supplier': 'coo',
  'logistics': 'coo',

  // CMO Tasks
  'marketing': 'cmo',
  'campaign': 'cmo',
  'brand': 'cmo',
  'content': 'cmo',
  'social media': 'cmo',
  'advertising': 'cmo',
  'pr': 'cmo',
  'public relations': 'cmo',

  // CPO Tasks
  'product': 'cpo',
  'feature': 'cpo',
  'roadmap': 'cpo',
  'requirements': 'cpo',
  'user research': 'cpo',
  'ux': 'cpo',
  'user experience': 'cpo',

  // DevOps Tasks
  'deploy': 'devops',
  'ci/cd': 'devops',
  'pipeline': 'devops',
  'docker': 'devops',
  'kubernetes': 'devops',
  'monitoring': 'devops',
  'alerting': 'devops',

  // QA Tasks
  'testing': 'qa',
  'test': 'qa',
  'quality': 'qa',
  'bug': 'qa',
  'regression': 'qa',

  // Security Tasks
  'security': 'security',
  'compliance': 'security',
  'gdpr': 'security',
  'privacy': 'security',
  'access control': 'security',
  'authentication': 'security',

  // Chief of Staff Tasks
  'coordination': 'cos',
  'document': 'cos',
  'communication': 'cos',
  'meeting': 'cos',
  'schedule': 'cos',
};

/**
 * Workflow names that commonly appear in dependencies
 */
const KNOWN_WORKFLOWS = [
  'business number registration',
  'cra payroll registration',
  'company incorporation',
  'bank account setup',
  'payment gateway setup',
  'hosting setup',
  'domain registration',
  'email setup',
  'team onboarding',
  'product launch',
  'security audit',
  'compliance review',
  'budget approval',
  'contract signing',
];

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

/**
 * Parse a task's notes and content to extract dependency hints
 *
 * @param {Object} task - The task object to parse
 * @param {string} task.id - Task ID
 * @param {string} task.title - Task title
 * @param {string} task.description - Task description
 * @param {string} task.notes - Additional notes
 * @param {string} task.content - Task content (alternative to description)
 * @param {Object} task.metadata - Task metadata
 * @returns {Array<Object>} Array of dependency hints
 *
 * @example
 * const task = {
 *   id: 'cto-001',
 *   title: 'Setup AWS hosting',
 *   description: 'Requires Business Number registration to complete first'
 * };
 * const deps = parseDependencies(task);
 * // Returns: [{ type: 'requires', rawMatch: 'Business Number registration', ...}]
 */
function parseDependencies(task) {
  if (!task) {
    return [];
  }

  const dependencies = [];

  // Combine all text sources from the task
  const textSources = [
    task.title || '',
    task.description || '',
    task.notes || '',
    task.content || '',
    task.metadata?.notes || '',
    task.metadata?.dependency_notes || '',
  ].filter(Boolean);

  const fullText = textSources.join(' ');

  if (!fullText.trim()) {
    return [];
  }

  // Extract dependencies from natural language patterns
  for (const { pattern, type } of DEPENDENCY_PATTERNS) {
    // Reset regex lastIndex for global patterns
    pattern.lastIndex = 0;

    let match;
    while ((match = pattern.exec(fullText)) !== null) {
      const rawMatch = match[1]?.trim();
      if (rawMatch && rawMatch.length > 2) {
        const dependency = createDependencyHint(rawMatch, type, task.id);
        // Avoid duplicates
        if (!dependencies.some(d => d.rawMatch.toLowerCase() === dependency.rawMatch.toLowerCase())) {
          dependencies.push(dependency);
        }
      }
    }
  }

  // Extract task ID references
  for (const pattern of TASK_ID_PATTERNS) {
    pattern.lastIndex = 0;

    let match;
    while ((match = pattern.exec(fullText)) !== null) {
      const taskIdMatch = match[0];
      // Don't add self-references
      if (taskIdMatch.toLowerCase() !== task.id?.toLowerCase()) {
        const dependency = createDependencyHint(taskIdMatch, 'task_id_reference', task.id);
        dependency.isExplicitTaskId = true;
        if (!dependencies.some(d => d.rawMatch.toLowerCase() === dependency.rawMatch.toLowerCase())) {
          dependencies.push(dependency);
        }
      }
    }
  }

  // Check for workflow references
  for (const workflow of KNOWN_WORKFLOWS) {
    if (fullText.toLowerCase().includes(workflow.toLowerCase())) {
      // Only add if not already captured by other patterns
      if (!dependencies.some(d => d.rawMatch.toLowerCase().includes(workflow.toLowerCase()))) {
        const dependency = createDependencyHint(workflow, 'workflow_reference', task.id);
        dependency.isWorkflowReference = true;
        dependencies.push(dependency);
      }
    }
  }

  return dependencies;
}

/**
 * Create a structured dependency hint object
 *
 * @param {string} rawMatch - The raw text matched
 * @param {string} type - Type of dependency pattern
 * @param {string} sourceTaskId - ID of the task this dependency was found in
 * @returns {Object} Dependency hint object
 */
function createDependencyHint(rawMatch, type, sourceTaskId) {
  const hint = {
    rawMatch,
    type,
    sourceTaskId,
    normalizedText: normalizeText(rawMatch),
    inferredRole: inferRoleFromText(rawMatch),
    confidence: calculateConfidence(rawMatch, type),
    keywords: extractKeywords(rawMatch),
    isExplicitTaskId: false,
    isWorkflowReference: false,
    createdAt: new Date().toISOString(),
  };

  return hint;
}

/**
 * Find tasks that match a dependency description
 *
 * @param {Object} dependencyHint - A dependency hint from parseDependencies
 * @param {Array<Object>} allTasks - All available tasks to search through
 * @param {Object} options - Search options
 * @param {number} options.minScore - Minimum match score (0-1, default: 0.3)
 * @param {number} options.maxResults - Maximum results to return (default: 5)
 * @returns {Array<Object>} Matching tasks with scores
 *
 * @example
 * const hint = { rawMatch: 'Business Number registration', inferredRole: 'ceo' };
 * const matches = findMatchingTasks(hint, allTasks);
 * // Returns: [{ task: {...}, score: 0.85, matchReasons: [...] }]
 */
function findMatchingTasks(dependencyHint, allTasks, options = {}) {
  const { minScore = 0.3, maxResults = 5 } = options;

  if (!dependencyHint || !allTasks || !Array.isArray(allTasks)) {
    return [];
  }

  const matches = [];

  for (const task of allTasks) {
    // Skip the source task
    if (task.id === dependencyHint.sourceTaskId) {
      continue;
    }

    const matchResult = calculateTaskMatch(dependencyHint, task);

    if (matchResult.score >= minScore) {
      matches.push({
        task,
        score: matchResult.score,
        matchReasons: matchResult.reasons,
      });
    }
  }

  // Sort by score descending and limit results
  return matches
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);
}

/**
 * Calculate how well a task matches a dependency hint
 *
 * @param {Object} dependencyHint - The dependency hint
 * @param {Object} task - The task to match against
 * @returns {Object} Match result with score and reasons
 */
function calculateTaskMatch(dependencyHint, task) {
  const reasons = [];
  let score = 0;

  // Exact task ID match (highest priority)
  if (dependencyHint.isExplicitTaskId) {
    const taskIdLower = dependencyHint.rawMatch.toLowerCase();
    if (task.id?.toLowerCase() === taskIdLower ||
        task.external_id?.toLowerCase() === taskIdLower) {
      return { score: 1.0, reasons: ['exact_task_id_match'] };
    }
  }

  // Get task searchable text
  const taskText = getTaskSearchText(task).toLowerCase();
  const hintText = dependencyHint.normalizedText.toLowerCase();

  // Check for role match
  if (dependencyHint.inferredRole) {
    const taskRole = task.assigned_to?.toLowerCase() || task.assigned_role?.toLowerCase();
    if (taskRole === dependencyHint.inferredRole) {
      score += 0.2;
      reasons.push('role_match');
    }
  }

  // Check for keyword matches
  const keywords = dependencyHint.keywords || [];
  let keywordMatches = 0;
  for (const keyword of keywords) {
    if (taskText.includes(keyword.toLowerCase())) {
      keywordMatches++;
    }
  }
  if (keywords.length > 0) {
    const keywordScore = (keywordMatches / keywords.length) * 0.4;
    score += keywordScore;
    if (keywordMatches > 0) {
      reasons.push(`keyword_match_${keywordMatches}/${keywords.length}`);
    }
  }

  // Check for substring match
  if (taskText.includes(hintText) || hintText.includes(taskText)) {
    score += 0.3;
    reasons.push('substring_match');
  }

  // Check for workflow match
  if (dependencyHint.isWorkflowReference) {
    const workflowName = dependencyHint.rawMatch.toLowerCase();
    if (task.workflow?.toLowerCase().includes(workflowName) ||
        taskText.includes(workflowName)) {
      score += 0.25;
      reasons.push('workflow_match');
    }
  }

  // Fuzzy text similarity (Jaccard-like)
  const hintWords = new Set(hintText.split(/\s+/).filter(w => w.length > 2));
  const taskWords = new Set(taskText.split(/\s+/).filter(w => w.length > 2));
  const intersection = new Set([...hintWords].filter(x => taskWords.has(x)));
  const union = new Set([...hintWords, ...taskWords]);

  if (union.size > 0) {
    const similarity = intersection.size / union.size;
    score += similarity * 0.2;
    if (similarity > 0.1) {
      reasons.push(`text_similarity_${Math.round(similarity * 100)}%`);
    }
  }

  // Cap score at 1.0
  return { score: Math.min(score, 1.0), reasons };
}

/**
 * Build a dependency graph from all tasks
 *
 * @param {Array<Object>} tasks - Array of all tasks
 * @param {Object} options - Options for graph building
 * @param {number} options.minConfidence - Minimum confidence for dependencies (default: 0.5)
 * @returns {Object} Dependency graph structure
 *
 * @example
 * const graph = buildDependencyGraph(tasks);
 * // Returns: {
 * //   nodes: Map of task IDs to task objects,
 * //   edges: Array of { from, to, type, confidence },
 * //   roots: Array of tasks with no dependencies,
 * //   leaves: Array of tasks nothing depends on,
 * //   cycles: Array of detected cycles
 * // }
 */
function buildDependencyGraph(tasks, options = {}) {
  const { minConfidence = 0.5 } = options;

  if (!tasks || !Array.isArray(tasks)) {
    return {
      nodes: new Map(),
      edges: [],
      roots: [],
      leaves: [],
      cycles: [],
      stats: { totalNodes: 0, totalEdges: 0 },
    };
  }

  // Initialize graph structures
  const nodes = new Map();
  const edges = [];
  const incomingEdges = new Map(); // task -> count of incoming edges
  const outgoingEdges = new Map(); // task -> count of outgoing edges

  // Add all tasks as nodes
  for (const task of tasks) {
    const taskId = task.id || task.external_id;
    if (taskId) {
      nodes.set(taskId, task);
      incomingEdges.set(taskId, 0);
      outgoingEdges.set(taskId, 0);
    }
  }

  // Parse dependencies and build edges
  for (const task of tasks) {
    const taskId = task.id || task.external_id;
    if (!taskId) continue;

    const dependencies = parseDependencies(task);

    for (const dep of dependencies) {
      if (dep.confidence < minConfidence) continue;

      // Find matching tasks for this dependency
      const matches = findMatchingTasks(dep, tasks, { minScore: 0.4, maxResults: 3 });

      for (const match of matches) {
        const dependsOnId = match.task.id || match.task.external_id;
        if (!dependsOnId || dependsOnId === taskId) continue;

        // Create edge: taskId depends on dependsOnId
        edges.push({
          from: dependsOnId,
          to: taskId,
          type: dep.type,
          confidence: dep.confidence * match.score,
          rawMatch: dep.rawMatch,
          matchScore: match.score,
          matchReasons: match.matchReasons,
        });

        // Update edge counts
        incomingEdges.set(taskId, (incomingEdges.get(taskId) || 0) + 1);
        outgoingEdges.set(dependsOnId, (outgoingEdges.get(dependsOnId) || 0) + 1);
      }
    }
  }

  // Find roots (tasks with no dependencies)
  const roots = [];
  for (const [taskId, task] of nodes) {
    if ((incomingEdges.get(taskId) || 0) === 0) {
      roots.push(task);
    }
  }

  // Find leaves (tasks nothing depends on)
  const leaves = [];
  for (const [taskId, task] of nodes) {
    if ((outgoingEdges.get(taskId) || 0) === 0) {
      leaves.push(task);
    }
  }

  // Detect cycles using DFS
  const cycles = detectCycles(nodes, edges);

  return {
    nodes,
    edges,
    roots,
    leaves,
    cycles,
    stats: {
      totalNodes: nodes.size,
      totalEdges: edges.length,
      rootCount: roots.length,
      leafCount: leaves.length,
      cycleCount: cycles.length,
    },
  };
}

/**
 * Detect cycles in the dependency graph using DFS
 *
 * @param {Map} nodes - Map of task IDs to tasks
 * @param {Array} edges - Array of edges
 * @returns {Array} Array of detected cycles
 */
function detectCycles(nodes, edges) {
  const cycles = [];
  const visited = new Set();
  const recursionStack = new Set();
  const parent = new Map();

  // Build adjacency list
  const adjacency = new Map();
  for (const [taskId] of nodes) {
    adjacency.set(taskId, []);
  }
  for (const edge of edges) {
    const neighbors = adjacency.get(edge.from) || [];
    neighbors.push(edge.to);
    adjacency.set(edge.from, neighbors);
  }

  function dfs(node, path) {
    visited.add(node);
    recursionStack.add(node);
    path.push(node);

    const neighbors = adjacency.get(node) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        parent.set(neighbor, node);
        dfs(neighbor, [...path]);
      } else if (recursionStack.has(neighbor)) {
        // Found a cycle
        const cycleStart = path.indexOf(neighbor);
        const cycle = path.slice(cycleStart);
        cycle.push(neighbor); // Complete the cycle
        cycles.push(cycle);
      }
    }

    recursionStack.delete(node);
  }

  // Run DFS from each unvisited node
  for (const [taskId] of nodes) {
    if (!visited.has(taskId)) {
      dfs(taskId, []);
    }
  }

  return cycles;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Normalize text for comparison
 *
 * @param {string} text - Text to normalize
 * @returns {string} Normalized text
 */
function normalizeText(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[""']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Infer the most likely agent role from dependency text
 *
 * @param {string} text - Dependency text
 * @returns {string|null} Inferred role or null
 */
function inferRoleFromText(text) {
  if (!text) return null;

  const lowerText = text.toLowerCase();

  // Check against phrase-to-role mappings
  for (const [phrase, role] of Object.entries(PHRASE_TO_ROLE_MAPPING)) {
    if (lowerText.includes(phrase)) {
      return role;
    }
  }

  // Check if text contains a role prefix (e.g., "ceo", "cto")
  const roleMatch = lowerText.match(/\b(ceo|cfo|cto|coo|cmo|cpo|chro|clo|cco|cro|devops|qa|security|cos)\b/);
  if (roleMatch) {
    return roleMatch[1];
  }

  return null;
}

/**
 * Calculate confidence score for a dependency hint
 *
 * @param {string} rawMatch - Raw matched text
 * @param {string} type - Dependency type
 * @returns {number} Confidence score (0-1)
 */
function calculateConfidence(rawMatch, type) {
  let confidence = 0.5; // Base confidence

  // Boost for explicit dependency types
  if (['blocked_by', 'depends_on', 'requires'].includes(type)) {
    confidence += 0.2;
  }

  // Boost for task ID references
  if (type === 'task_id_reference') {
    confidence = 0.95;
  }

  // Boost for workflow references
  if (type === 'workflow_reference') {
    confidence += 0.15;
  }

  // Boost for known phrases
  if (inferRoleFromText(rawMatch)) {
    confidence += 0.1;
  }

  // Penalize very short matches
  if (rawMatch.length < 5) {
    confidence -= 0.2;
  }

  // Penalize very long matches (might be noise)
  if (rawMatch.length > 100) {
    confidence -= 0.1;
  }

  return Math.max(0, Math.min(1, confidence));
}

/**
 * Extract meaningful keywords from text
 *
 * @param {string} text - Text to extract keywords from
 * @returns {Array<string>} Array of keywords
 */
function extractKeywords(text) {
  if (!text) return [];

  // Common stop words to filter out
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
    'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'this',
    'that', 'these', 'those', 'it', 'its', 'first', 'complete', 'done',
    'finished', 'task', 'need', 'needs', 'require', 'requires',
  ]);

  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word))
    .slice(0, 10); // Limit to 10 keywords
}

/**
 * Get searchable text from a task
 *
 * @param {Object} task - Task object
 * @returns {string} Combined searchable text
 */
function getTaskSearchText(task) {
  const parts = [
    task.id || '',
    task.external_id || '',
    task.title || '',
    task.description || '',
    task.content || '',
    task.notes || '',
    task.workflow || '',
    ...(task.tags || []),
    ...(task.keywords || []),
  ];
  return parts.join(' ');
}

/**
 * Get execution order for tasks based on dependencies
 *
 * @param {Object} graph - Dependency graph from buildDependencyGraph
 * @returns {Array<Object>} Tasks in execution order (topological sort)
 */
function getExecutionOrder(graph) {
  if (!graph || !graph.nodes || graph.nodes.size === 0) {
    return [];
  }

  if (graph.cycles && graph.cycles.length > 0) {
    console.warn('[DEPENDENCY-PARSER] Graph contains cycles, execution order may be incomplete');
  }

  // Build adjacency list and in-degree counts
  const inDegree = new Map();
  const adjacency = new Map();

  for (const [taskId] of graph.nodes) {
    inDegree.set(taskId, 0);
    adjacency.set(taskId, []);
  }

  for (const edge of graph.edges) {
    const neighbors = adjacency.get(edge.from) || [];
    neighbors.push(edge.to);
    adjacency.set(edge.from, neighbors);
    inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
  }

  // Kahn's algorithm for topological sort
  const queue = [];
  const result = [];

  // Start with nodes that have no dependencies
  for (const [taskId, degree] of inDegree) {
    if (degree === 0) {
      queue.push(taskId);
    }
  }

  while (queue.length > 0) {
    const current = queue.shift();
    const task = graph.nodes.get(current);
    if (task) {
      result.push(task);
    }

    const neighbors = adjacency.get(current) || [];
    for (const neighbor of neighbors) {
      const newDegree = (inDegree.get(neighbor) || 0) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) {
        queue.push(neighbor);
      }
    }
  }

  return result;
}

/**
 * Get all tasks that a given task depends on (direct and transitive)
 *
 * @param {string} taskId - The task ID to get dependencies for
 * @param {Object} graph - Dependency graph from buildDependencyGraph
 * @returns {Array<Object>} Array of dependency tasks
 */
function getAllDependenciesFor(taskId, graph) {
  if (!graph || !taskId) return [];

  const dependencies = new Set();
  const visited = new Set();

  // Build reverse adjacency (from "to" back to "from")
  const reverseAdj = new Map();
  for (const [id] of graph.nodes) {
    reverseAdj.set(id, []);
  }
  for (const edge of graph.edges) {
    const deps = reverseAdj.get(edge.to) || [];
    deps.push(edge.from);
    reverseAdj.set(edge.to, deps);
  }

  function traverse(current) {
    if (visited.has(current)) return;
    visited.add(current);

    const deps = reverseAdj.get(current) || [];
    for (const dep of deps) {
      dependencies.add(dep);
      traverse(dep);
    }
  }

  traverse(taskId);

  return Array.from(dependencies)
    .map(id => graph.nodes.get(id))
    .filter(Boolean);
}

/**
 * Get all tasks that depend on a given task (direct and transitive)
 *
 * @param {string} taskId - The task ID to get dependents for
 * @param {Object} graph - Dependency graph from buildDependencyGraph
 * @returns {Array<Object>} Array of dependent tasks
 */
function getAllDependentsOf(taskId, graph) {
  if (!graph || !taskId) return [];

  const dependents = new Set();
  const visited = new Set();

  // Build adjacency list
  const adjacency = new Map();
  for (const [id] of graph.nodes) {
    adjacency.set(id, []);
  }
  for (const edge of graph.edges) {
    const neighbors = adjacency.get(edge.from) || [];
    neighbors.push(edge.to);
    adjacency.set(edge.from, neighbors);
  }

  function traverse(current) {
    if (visited.has(current)) return;
    visited.add(current);

    const deps = adjacency.get(current) || [];
    for (const dep of deps) {
      dependents.add(dep);
      traverse(dep);
    }
  }

  traverse(taskId);

  return Array.from(dependents)
    .map(id => graph.nodes.get(id))
    .filter(Boolean);
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  // Main functions
  parseDependencies,
  findMatchingTasks,
  buildDependencyGraph,

  // Graph utilities
  getExecutionOrder,
  getAllDependenciesFor,
  getAllDependentsOf,
  detectCycles,

  // Helper functions
  normalizeText,
  inferRoleFromText,
  calculateConfidence,
  extractKeywords,
  getTaskSearchText,

  // Constants (for extensibility)
  DEPENDENCY_PATTERNS,
  TASK_ID_PATTERNS,
  PHRASE_TO_ROLE_MAPPING,
  KNOWN_WORKFLOWS,
};

export default {
  parseDependencies,
  findMatchingTasks,
  buildDependencyGraph,
  getExecutionOrder,
  getAllDependenciesFor,
  getAllDependentsOf,
};
