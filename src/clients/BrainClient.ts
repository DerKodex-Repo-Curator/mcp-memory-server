/**
 * BrainClient.ts - Client for interacting with Brain memory system
 */

import axios, { AxiosInstance } from 'axios';
import { Memory } from '../types.js';

export interface BrainMemory {
  key: string;
  value: any;
  type?: string;
  created?: string;
  metadata?: Record<string, any>;
}

export class BrainClient {
  private axios: AxiosInstance;
  private mcpUrl: string;
  
  constructor(mcpUrl: string = 'http://localhost:3000') {
    this.mcpUrl = mcpUrl;
    this.axios = axios.create({
      baseURL: mcpUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
  
  /**
   * Recall memories matching a query
   */
  async recall(query: string, limit: number = 10): Promise<Memory[]> {
    try {
      const response = await this.axios.post('/tools/brain_recall', {
        query,
        limit
      });
      
      const memories = response.data.memories || [];
      
      return memories.map((m: any) => ({
        key: m.key,
        value: m.value,
        type: m.type || 'general',
        relevance: 0.5, // Will be calculated by MemoryManager
        created: m.created || new Date().toISOString(),
        metadata: m.metadata || {}
      }));
    } catch (error) {
      console.error('Error recalling memories:', error);
      return [];
    }
  }
  
  /**
   * Store a new memory
   */
  async remember(key: string, value: any, type: string = 'general'): Promise<void> {
    try {
      await this.axios.post('/tools/brain_remember', {
        key,
        value,
        type
      });
    } catch (error) {
      console.error('Error storing memory:', error);
    }
  }
  
  /**
   * Get a specific memory by key
   */
  async get(key: string): Promise<Memory | null> {
    try {
      const response = await this.axios.post('/tools/brain_get', { key });
      
      if (!response.data || !response.data.memory) {
        return null;
      }
      
      const m = response.data.memory;
      return {
        key: m.key,
        value: m.value,
        type: m.type || 'general',
        relevance: 0.5,
        created: m.created || new Date().toISOString(),
        metadata: m.metadata || {}
      };
    } catch (error) {
      console.error('Error getting memory:', error);
      return null;
    }
  }
  
  /**
   * Check if Brain is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      await this.axios.get('/health');
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Create a mock Brain client for testing
 */
export function createMockBrainClient(): BrainClient {
  const memories = new Map<string, Memory>();
  
  return {
    async recall(query: string, limit: number = 10): Promise<Memory[]> {
      const results: Memory[] = [];
      
      // Simple search through memories
      for (const [key, memory] of memories.entries()) {
        const text = JSON.stringify(memory.value).toLowerCase();
        if (text.includes(query.toLowerCase()) || key.includes(query.toLowerCase())) {
          results.push(memory);
        }
      }
      
      return results.slice(0, limit);
    },
    
    async remember(key: string, value: any, type: string = 'general'): Promise<void> {
      memories.set(key, {
        key,
        value,
        type,
        relevance: 0.5,
        created: new Date().toISOString(),
        metadata: {}
      });
    },
    
    async get(key: string): Promise<Memory | null> {
      return memories.get(key) || null;
    },
    
    async isAvailable(): Promise<boolean> {
      return true;
    }
  } as BrainClient;
}
