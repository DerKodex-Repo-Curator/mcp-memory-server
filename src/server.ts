/**
 * server.ts - Enhanced MCP Memory Server with all features
 */

import express, { Express, Request, Response } from 'express';
import { 
  MemoryServerConfig, 
  OllamaRequest, 
  OllamaResponse,
  EnrichedRequest,
  TaskMemory,
  LearningOutcome
} from './types.js';
import { MemoryManager } from './MemoryManager.js';
import { ContextEnricher } from './ContextEnricher.js';
import { BrainClient } from './clients/BrainClient.js';
import { OllamaClient } from './clients/OllamaClient.js';
import { LearningEngine } from './LearningEngine.js';
import { EmbeddingManager } from './embeddings/EmbeddingManager.js';
import { PerformanceOptimizer } from './performance/PerformanceOptimizer.js';
import { SecurityManager } from './security/SecurityManager.js';
import { PluginManager } from './plugins/PluginManager.js';
import winston from 'winston';
import { v4 as uuidv4 } from 'crypto';

export class MemoryServer {
  private app: Express;
  private config: MemoryServerConfig;
  private brainClient: BrainClient;
  private ollamaClient: OllamaClient;
  private memoryManager: MemoryManager;
  private contextEnricher: ContextEnricher;
  private learningEngine: LearningEngine;
  private embeddingManager: EmbeddingManager;
  private performanceOptimizer: PerformanceOptimizer;
  private securityManager: SecurityManager;
  private pluginManager: PluginManager;
  private logger: winston.Logger;
  
  constructor(config: MemoryServerConfig) {
    this.config = config;
    this.app = express();
    
    // Initialize logger
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        }),
        new winston.transports.File({ filename: 'memory-server.log' })
      ]
    });
    
    // Initialize clients
    this.brainClient = new BrainClient(config.mcpUrl);
    this.ollamaClient = new OllamaClient(config.ollamaUrl);
    
    // Initialize core components
    this.memoryManager = new MemoryManager(this.brainClient, config.cache.ttl);
    this.contextEnricher = new ContextEnricher(this.memoryManager, config.memory);
    this.learningEngine = new LearningEngine(this.memoryManager);
    
    // Initialize advanced components
    this.embeddingManager = new EmbeddingManager(config.ollamaUrl);
    this.performanceOptimizer = new PerformanceOptimizer(config, this.logger);
    this.securityManager = new SecurityManager({}, this.logger);
    this.pluginManager = new PluginManager('./plugins', this.logger);
    
    // Setup middleware
    this.setupMiddleware();
    
    // Setup routes
    this.setupRoutes();
  }
  
  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));
    
    // Request logging
    this.app.use((req, res, next) => {
      const startTime = Date.now();
      
      // Log request
      this.logger.info('Request', {
        method: req.method,
        path: req.path,
        ip: req.ip
      });
      
      // Track response time
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        this.logger.info('Response', {
          method: req.method,
          path: req.path,
          status: res.statusCode,
          duration
        });
      });
      
      next();
    });
    
    // CORS headers
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      next();
    });
  }
  
  /**
   * Setup server routes
   */
  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        features: {
          embeddings: true,
          security: true,
          plugins: true,
          performance: true
        }
      });
    });
    
    // Main Ollama-compatible endpoint
    this.app.post('/api/generate', this.handleGenerate.bind(this));
    
    // Stream endpoint
    this.app.post('/api/generate/stream', this.handleGenerateStream.bind(this));
    
    // Model listing (proxy to Ollama)
    this.app.get('/api/tags', this.handleListModels.bind(this));
    
    // Memory management endpoints
    this.app.get('/api/memory/stats', this.handleMemoryStats.bind(this));
    this.app.post('/api/memory/search', this.handleMemorySearch.bind(this));
    this.app.get('/api/memory/insights', this.handleGetInsights.bind(this));
    
    // Learning endpoints
    this.app.post('/api/learning/feedback', this.handleFeedback.bind(this));
    this.app.get('/api/learning/model-stats/:model', this.handleModelStats.bind(this));
    
    // Performance endpoints
    this.app.get('/api/performance/report', this.handlePerformanceReport.bind(this));
    
    // Security endpoints
    this.app.get('/api/security/report', this.handleSecurityReport.bind(this));
    
    // Plugin endpoints
    this.app.get('/api/plugins', this.handleListPlugins.bind(this));
  }
  
  /**
   * Handle generate request (main endpoint)
   */
  private async handleGenerate(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    const requestId = uuidv4();
    const clientId = req.ip || 'unknown';
    
    try {
      const ollamaRequest: OllamaRequest = req.body;
      
      // Security validation
      const securityResult = await this.securityManager.validateRequest(ollamaRequest, clientId);
      if (!securityResult.valid) {
        res.status(400).json({ error: securityResult.reason });
        return;
      }
      
      // Use sanitized request if provided
      const safeRequest = securityResult.sanitized || ollamaRequest;
      
      // Plugin hook: beforeEnrichment
      const modifiedRequest = await this.pluginManager.executePipeline(
        'beforeEnrichment',
        safeRequest
      );
      
      // Record start of enrichment
      const enrichStart = Date.now();
      
      // Get adaptive config from performance optimizer
      const adaptiveConfig = this.performanceOptimizer.getAdaptiveConfig();
      
      // Enrich the prompt with adaptive config
      const { enrichedPrompt, context } = await this.contextEnricher.enrichPrompt(
        modifiedRequest.prompt,
        modifiedRequest.model
      );
      
      // Record enrichment time
      this.performanceOptimizer.recordEnrichmentTime(Date.now() - enrichStart);
      
      // Create enriched request
      let enrichedRequest: EnrichedRequest = {
        ...modifiedRequest,
        originalPrompt: modifiedRequest.prompt,
        prompt: enrichedPrompt,
        enrichmentContext: context,
        requestId,
        timestamp: new Date().toISOString()
      };
      
      // Plugin hook: afterEnrichment
      enrichedRequest = await this.pluginManager.executePipeline(
        'afterEnrichment',
        enrichedRequest
      );
      
      // Plugin hook: beforeOllama
      enrichedRequest = await this.pluginManager.executePipeline(
        'beforeOllama',
        enrichedRequest
      );
      
      // Log enrichment
      this.logger.info('Prompt enriched', {
        requestId,
        memoriesAdded: context.memories.length,
        similarTasksFound: context.similarTasks.length,
        contextLength: enrichedPrompt.length
      });
      
      // Record Ollama call start
      const ollamaStart = Date.now();
      
      // Forward to Ollama
      let ollamaResponse = await this.ollamaClient.generate({
        ...modifiedRequest,
        prompt: enrichedRequest.prompt
      });
      
      // Record Ollama time
      this.performanceOptimizer.recordOllamaTime(Date.now() - ollamaStart);
      
      // Plugin hook: afterOllama
      ollamaResponse = await this.pluginManager.executePipeline(
        'afterOllama',
        enrichedRequest,
        ollamaResponse
      );
      
      // Calculate total duration
      const duration = Date.now() - startTime;
      this.performanceOptimizer.recordTotalTime(duration);
      
      // Learn from the interaction
      const learningOutcome = await this.learningEngine.learn(
        enrichedRequest,
        ollamaResponse,
        duration
      );
      
      // Store task memory
      const taskMemory: TaskMemory = {
        taskId: requestId,
        title: this.extractTitle(modifiedRequest.prompt),
        prompt: modifiedRequest.prompt,
        response: ollamaResponse.response,
        model: modifiedRequest.model,
        duration,
        quality: learningOutcome.quality,
        approach: learningOutcome.approach,
        timestamp: new Date().toISOString()
      };
      
      await this.memoryManager.storeTaskOutcome(taskMemory);
      
      // Add to embeddings for semantic search
      await this.embeddingManager.addMemory(
        requestId,
        `${modifiedRequest.prompt} ${ollamaResponse.response}`,
        'task'
      );
      
      // Log completion
      this.logger.info('Generate complete', {
        requestId,
        duration,
        quality: learningOutcome.quality,
        responseLength: ollamaResponse.response.length
      });
      
      // Return response (same format as Ollama)
      res.json(ollamaResponse);
      
    } catch (error) {
      this.logger.error('Generate error', {
        requestId,
        error: error instanceof Error ? error.message : error
      });
      
      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  
  /**
   * Handle streaming generate request
   */
  private async handleGenerateStream(req: Request, res: Response): Promise<void> {
    const requestId = uuidv4();
    const clientId = req.ip || 'unknown';
    
    try {
      const ollamaRequest: OllamaRequest = req.body;
      
      // Security validation
      const securityResult = await this.securityManager.validateRequest(ollamaRequest, clientId);
      if (!securityResult.valid) {
        res.status(400).json({ error: securityResult.reason });
        return;
      }
      
      const safeRequest = securityResult.sanitized || ollamaRequest;
      
      // Enrich the prompt
      const { enrichedPrompt, context } = await this.contextEnricher.enrichPrompt(
        safeRequest.prompt,
        safeRequest.model
      );
      
      // Set headers for streaming
      res.setHeader('Content-Type', 'application/x-ndjson');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      
      // Stream from Ollama
      const stream = this.ollamaClient.generateStream({
        ...safeRequest,
        prompt: enrichedPrompt
      });
      
      let fullResponse = '';
      
      for await (const chunk of stream) {
        // Accumulate response for learning
        if (chunk.response) {
          fullResponse += chunk.response;
        }
        
        // Forward chunk to client
        res.write(JSON.stringify(chunk) + '\n');
        
        // If done, learn from the interaction
        if (chunk.done) {
          const duration = Date.now() - parseInt(requestId.split('-')[0]);
          
          const enrichedRequest: EnrichedRequest = {
            ...safeRequest,
            originalPrompt: safeRequest.prompt,
            prompt: enrichedPrompt,
            enrichmentContext: context,
            requestId,
            timestamp: new Date().toISOString()
          };
          
          await this.learningEngine.learn(
            enrichedRequest,
            { ...chunk, response: fullResponse },
            duration
          );
        }
      }
      
      res.end();
      
    } catch (error) {
      this.logger.error('Stream error', {
        requestId,
        error: error instanceof Error ? error.message : error
      });
      
      res.status(500).json({
        error: 'Stream error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  
  /**
   * Handle list models request (proxy)
   */
  private async handleListModels(req: Request, res: Response): Promise<void> {
    try {
      const models = await this.ollamaClient.listModels();
      res.json({ models: models.map(name => ({ name })) });
    } catch (error) {
      res.status(500).json({ error: 'Failed to list models' });
    }
  }
  
  /**
   * Handle memory stats request
   */
  private async handleMemoryStats(req: Request, res: Response): Promise<void> {
    const embeddingStats = this.embeddingManager.getStats();
    const modelStats = Array.from(this.memoryManager['modelStats'].entries());
    
    res.json({
      totalMemories: embeddingStats.totalEmbeddings,
      memoryTypes: embeddingStats.memoryTypes,
      recentTasks: this.memoryManager['taskMemories'].size,
      modelStats,
      cacheStats: {
        hitRate: this.performanceOptimizer['metrics'].cacheHitRate
      }
    });
  }
  
  /**
   * Handle memory search request
   */
  private async handleMemorySearch(req: Request, res: Response): Promise<void> {
    const { query, limit = 10, useEmbeddings = true } = req.body;
    
    // Record search time
    const searchStart = Date.now();
    
    let memories;
    if (useEmbeddings) {
      // Use semantic search
      const results = await this.embeddingManager.searchSimilar(query, limit);
      memories = results.map(r => ({
        key: r.id,
        value: r.metadata.text,
        relevance: r.similarity,
        type: r.metadata.type,
        created: r.metadata.created
      }));
    } else {
      // Use traditional search
      memories = await this.memoryManager.searchMemories(query, limit);
    }
    
    this.performanceOptimizer.recordMemorySearchTime(Date.now() - searchStart);
    
    res.json({ memories });
  }
  
  /**
   * Handle get insights request
   */
  private async handleGetInsights(req: Request, res: Response): Promise<void> {
    const limit = parseInt(req.query.limit as string) || 10;
    const insights = await this.memoryManager.getRecentInsights(limit);
    res.json({ insights });
  }
  
  /**
   * Handle feedback on task quality
   */
  private async handleFeedback(req: Request, res: Response): Promise<void> {
    const { taskId, quality, feedback } = req.body;
    
    // Store feedback as an insight
    await this.brainClient.remember(`feedback_${taskId}`, {
      taskId,
      quality,
      feedback,
      timestamp: new Date().toISOString()
    }, 'feedback');
    
    res.json({ success: true });
  }
  
  /**
   * Handle model stats request
   */
  private async handleModelStats(req: Request, res: Response): Promise<void> {
    const model = req.params.model;
    const stats = this.memoryManager.getModelContext(model);
    res.json(stats);
  }
  
  /**
   * Handle performance report request
   */
  private async handlePerformanceReport(req: Request, res: Response): Promise<void> {
    const report = this.performanceOptimizer.getReport();
    res.json(report);
  }
  
  /**
   * Handle security report request
   */
  private async handleSecurityReport(req: Request, res: Response): Promise<void> {
    const report = this.securityManager.getSecurityReport();
    res.json(report);
  }
  
  /**
   * Handle list plugins request
   */
  private async handleListPlugins(req: Request, res: Response): Promise<void> {
    const plugins = this.pluginManager.listPlugins();
    res.json({ plugins });
  }
  
  /**
   * Extract title from prompt
   */
  private extractTitle(prompt: string): string {
    // Take first line or first 50 chars
    const firstLine = prompt.split('\n')[0];
    if (firstLine.length <= 50) return firstLine;
    return firstLine.substring(0, 47) + '...';
  }
  
  /**
   * Start the server
   */
  async start(): Promise<void> {
    // Load plugins
    await this.pluginManager.loadPlugins();
    
    // Register plugin endpoints
    const pluginEndpoints = this.pluginManager.getCustomEndpoints();
    for (const endpoint of pluginEndpoints) {
      this.app[endpoint.method.toLowerCase()](endpoint.path, endpoint.handler);
      this.logger.info(`Registered plugin endpoint: ${endpoint.method} ${endpoint.path} (${endpoint.plugin})`);
    }
    
    // Check if required services are available
    const [brainAvailable, ollamaAvailable] = await Promise.all([
      this.brainClient.isAvailable(),
      this.ollamaClient.isAvailable()
    ]);
    
    if (!ollamaAvailable) {
      throw new Error('Ollama is not available at ' + this.config.ollamaUrl);
    }
    
    if (this.config.brain.enabled && !brainAvailable) {
      this.logger.warn('Brain is not available, running without memory persistence');
    }
    
    // Start server
    this.app.listen(this.config.port, () => {
      this.logger.info(`Memory Server started on port ${this.config.port}`);
      this.logger.info(`Proxying to Ollama at ${this.config.ollamaUrl}`);
      if (brainAvailable) {
        this.logger.info('Brain integration enabled');
      }
      this.logger.info(`Loaded ${pluginEndpoints.length} plugin endpoints`);
    });
  }
  
  /**
   * Shutdown the server gracefully
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down Memory Server...');
    
    // Shutdown plugins
    await this.pluginManager.shutdown();
    
    // Save any pending data
    // Could implement data persistence here
    
    this.logger.info('Memory Server shutdown complete');
  }
}

// Export factory function
export function createMemoryServer(config: Partial<MemoryServerConfig>): MemoryServer {
  const defaultConfig: MemoryServerConfig = {
    port: 8090,
    ollamaUrl: 'http://localhost:11434',
    mcpUrl: 'http://localhost:3000',
    memory: {
      maxContextTokens: 2000,
      similarityLimit: 10,
      relevanceThreshold: 0.3,
      autoEnrich: true
    },
    brain: {
      dataDir: process.env.BRAIN_DATA_DIR || '~/.brain',
      enabled: true
    },
    cache: {
      ttl: 3600,
      maxSize: 1000
    }
  };
  
  return new MemoryServer({ ...defaultConfig, ...config });
}
