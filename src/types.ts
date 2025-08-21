/**
 * types.ts - Core types for MCP Memory Server
 */

export interface MemoryServerConfig {
  /** Port to run the server on */
  port: number;
  
  /** Ollama API endpoint */
  ollamaUrl: string;
  
  /** MCP server endpoint for tools */
  mcpUrl?: string;
  
  /** Memory configuration */
  memory: {
    /** Maximum context tokens to inject */
    maxContextTokens: number;
    
    /** How many similar memories to retrieve */
    similarityLimit: number;
    
    /** Minimum relevance score (0-1) */
    relevanceThreshold: number;
    
    /** Enable auto-enrichment */
    autoEnrich: boolean;
  };
  
  /** Brain integration settings */
  brain: {
    /** Brain data directory */
    dataDir: string;
    
    /** Enable Brain integration */
    enabled: boolean;
  };
  
  /** Caching settings */
  cache: {
    /** TTL for memory cache in seconds */
    ttl: number;
    
    /** Maximum cache size */
    maxSize: number;
  };
}

export interface EnrichmentContext {
  /** Relevant memories from Brain */
  memories: Memory[];
  
  /** Similar past tasks and their outcomes */
  similarTasks: TaskMemory[];
  
  /** Model-specific context and tips */
  modelContext: ModelContext;
  
  /** Recent insights and learnings */
  recentInsights: Insight[];
  
  /** Domain knowledge */
  domainKnowledge?: DomainContext;
}

export interface Memory {
  key: string;
  value: any;
  type: string;
  relevance: number;
  created: string;
  metadata?: Record<string, any>;
}

export interface TaskMemory {
  taskId: string;
  title: string;
  prompt: string;
  response: string;
  model: string;
  duration: number;
  quality: number;
  approach: string;
  timestamp: string;
}

export interface ModelContext {
  model: string;
  strengths: string[];
  weaknesses: string[];
  bestPractices: string[];
  avgResponseTime: number;
  successRate: number;
  tips: string[];
}

export interface Insight {
  id: string;
  content: string;
  source: string;
  confidence: number;
  timestamp: string;
  tags: string[];
}

export interface DomainContext {
  domain: string;
  concepts: string[];
  terminology: Record<string, string>;
  examples: string[];
}

export interface OllamaRequest {
  model: string;
  prompt: string;
  system?: string;
  template?: string;
  context?: number[];
  stream?: boolean;
  raw?: boolean;
  format?: string;
  options?: {
    seed?: number;
    temperature?: number;
    top_k?: number;
    top_p?: number;
    num_predict?: number;
  };
}

export interface OllamaResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

export interface EnrichedRequest extends OllamaRequest {
  /** Original prompt before enrichment */
  originalPrompt: string;
  
  /** Enrichment context used */
  enrichmentContext: EnrichmentContext;
  
  /** Request ID for tracking */
  requestId: string;
  
  /** Timestamp */
  timestamp: string;
}

export interface LearningOutcome {
  requestId: string;
  model: string;
  duration: number;
  quality: number;
  insights: string[];
  approach: string;
  toolsUsed: string[];
  errors?: string[];
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: any;
}

export interface MCPToolResponse {
  content: Array<{
    type: string;
    text?: string;
    data?: any;
  }>;
}
