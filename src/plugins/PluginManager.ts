/**
 * PluginManager.ts - Manages plugins for extending Memory Server functionality
 */

import { EnrichedRequest, OllamaResponse, Memory } from '../types.js';
import winston from 'winston';
import path from 'path';
import { promises as fs } from 'fs';

export interface Plugin {
  name: string;
  version: string;
  description: string;
  
  // Lifecycle hooks
  onInitialize?(): Promise<void>;
  onShutdown?(): Promise<void>;
  
  // Request/Response hooks
  beforeEnrichment?(request: OllamaRequest): Promise<OllamaRequest>;
  afterEnrichment?(request: EnrichedRequest): Promise<EnrichedRequest>;
  beforeOllama?(request: EnrichedRequest): Promise<EnrichedRequest>;
  afterOllama?(request: EnrichedRequest, response: OllamaResponse): Promise<OllamaResponse>;
  
  // Memory hooks
  beforeMemorySearch?(query: string): Promise<string>;
  afterMemorySearch?(query: string, results: Memory[]): Promise<Memory[]>;
  beforeMemoryStore?(memory: Memory): Promise<Memory>;
  
  // Custom endpoints
  endpoints?: Array<{
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    path: string;
    handler: (req: any, res: any) => Promise<void>;
  }>;
}

export class PluginManager {
  private plugins: Map<string, Plugin>;
  private logger: winston.Logger;
  private pluginDir: string;
  
  constructor(pluginDir: string, logger: winston.Logger) {
    this.plugins = new Map();
    this.logger = logger;
    this.pluginDir = pluginDir;
  }
  
  /**
   * Load all plugins from directory
   */
  async loadPlugins(): Promise<void> {
    try {
      // Ensure plugin directory exists
      await fs.mkdir(this.pluginDir, { recursive: true });
      
      // Read all files in plugin directory
      const files = await fs.readdir(this.pluginDir);
      const pluginFiles = files.filter(f => f.endsWith('.js') || f.endsWith('.ts'));
      
      for (const file of pluginFiles) {
        try {
          await this.loadPlugin(path.join(this.pluginDir, file));
        } catch (error) {
          this.logger.error(`Failed to load plugin ${file}:`, error);
        }
      }
      
      this.logger.info(`Loaded ${this.plugins.size} plugins`);
    } catch (error) {
      this.logger.error('Failed to load plugins:', error);
    }
  }
  
  /**
   * Load a single plugin
   */
  async loadPlugin(filePath: string): Promise<void> {
    const plugin = await import(filePath);
    
    if (!plugin.default || !plugin.default.name) {
      throw new Error('Invalid plugin format');
    }
    
    const pluginInstance = plugin.default as Plugin;
    
    // Initialize plugin
    if (pluginInstance.onInitialize) {
      await pluginInstance.onInitialize();
    }
    
    this.plugins.set(pluginInstance.name, pluginInstance);
    this.logger.info(`Loaded plugin: ${pluginInstance.name} v${pluginInstance.version}`);
  }
  
  /**
   * Execute hook for all plugins
   */
  async executeHook<T>(hookName: keyof Plugin, ...args: any[]): Promise<T[]> {
    const results: T[] = [];
    
    for (const [name, plugin] of this.plugins) {
      const hook = plugin[hookName] as Function;
      if (hook && typeof hook === 'function') {
        try {
          const result = await hook.apply(plugin, args);
          results.push(result);
        } catch (error) {
          this.logger.error(`Plugin ${name} hook ${hookName} failed:`, error);
        }
      }
    }
    
    return results;
  }
  
  /**
   * Execute hook pipeline (each plugin modifies the result)
   */
  async executePipeline<T>(hookName: keyof Plugin, initialValue: T, ...additionalArgs: any[]): Promise<T> {
    let value = initialValue;
    
    for (const [name, plugin] of this.plugins) {
      const hook = plugin[hookName] as Function;
      if (hook && typeof hook === 'function') {
        try {
          value = await hook.apply(plugin, [value, ...additionalArgs]);
        } catch (error) {
          this.logger.error(`Plugin ${name} pipeline ${hookName} failed:`, error);
        }
      }
    }
    
    return value;
  }
  
  /**
   * Get all custom endpoints from plugins
   */
  getCustomEndpoints() {
    const endpoints: Array<{
      plugin: string;
      method: string;
      path: string;
      handler: Function;
    }> = [];
    
    for (const [name, plugin] of this.plugins) {
      if (plugin.endpoints) {
        for (const endpoint of plugin.endpoints) {
          endpoints.push({
            plugin: name,
            ...endpoint
          });
        }
      }
    }
    
    return endpoints;
  }
  
  /**
   * Shutdown all plugins
   */
  async shutdown(): Promise<void> {
    for (const [name, plugin] of this.plugins) {
      if (plugin.onShutdown) {
        try {
          await plugin.onShutdown();
          this.logger.info(`Shutdown plugin: ${name}`);
        } catch (error) {
          this.logger.error(`Failed to shutdown plugin ${name}:`, error);
        }
      }
    }
    
    this.plugins.clear();
  }
  
  /**
   * Get plugin by name
   */
  getPlugin(name: string): Plugin | undefined {
    return this.plugins.get(name);
  }
  
  /**
   * List all loaded plugins
   */
  listPlugins() {
    return Array.from(this.plugins.values()).map(plugin => ({
      name: plugin.name,
      version: plugin.version,
      description: plugin.description
    }));
  }
}

/**
 * Example plugin template
 */
export const ExamplePlugin: Plugin = {
  name: 'example-plugin',
  version: '1.0.0',
  description: 'Example plugin showing all available hooks',
  
  async onInitialize() {
    console.log('Example plugin initialized');
  },
  
  async beforeEnrichment(request) {
    // Modify request before enrichment
    return request;
  },
  
  async afterEnrichment(request) {
    // Modify enriched request
    return request;
  },
  
  endpoints: [
    {
      method: 'GET',
      path: '/api/plugin/example',
      handler: async (req, res) => {
        res.json({ message: 'Hello from example plugin!' });
      }
    }
  ]
};
