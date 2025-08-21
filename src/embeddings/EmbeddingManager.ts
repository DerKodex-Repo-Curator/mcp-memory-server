/**
 * EmbeddingManager.ts - Manages embeddings for semantic search
 */

import axios from 'axios';
import { Memory } from '../types.js';

export interface Embedding {
  id: string;
  vector: number[];
  metadata: {
    text: string;
    type: string;
    created: string;
  };
}

export class EmbeddingManager {
  private embeddings: Map<string, Embedding>;
  private ollamaUrl: string;
  private embeddingModel: string;
  
  constructor(ollamaUrl: string, embeddingModel: string = 'nomic-embed-text') {
    this.embeddings = new Map();
    this.ollamaUrl = ollamaUrl;
    this.embeddingModel = embeddingModel;
  }
  
  /**
   * Generate embedding for text using Ollama
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await axios.post(`${this.ollamaUrl}/api/embeddings`, {
        model: this.embeddingModel,
        prompt: text
      });
      
      return response.data.embedding;
    } catch (error) {
      console.error('Failed to generate embedding:', error);
      // Fallback to simple hash-based embedding
      return this.generateSimpleEmbedding(text);
    }
  }
  
  /**
   * Add a memory with its embedding
   */
  async addMemory(id: string, text: string, type: string = 'general'): Promise<void> {
    const vector = await this.generateEmbedding(text);
    
    this.embeddings.set(id, {
      id,
      vector,
      metadata: {
        text,
        type,
        created: new Date().toISOString()
      }
    });
  }
  
  /**
   * Search for similar memories using cosine similarity
   */
  async searchSimilar(query: string, limit: number = 10): Promise<Array<{
    id: string;
    similarity: number;
    metadata: any;
  }>> {
    const queryVector = await this.generateEmbedding(query);
    
    const results: Array<{
      id: string;
      similarity: number;
      metadata: any;
    }> = [];
    
    // Calculate similarity with all embeddings
    for (const [id, embedding] of this.embeddings.entries()) {
      const similarity = this.cosineSimilarity(queryVector, embedding.vector);
      results.push({
        id,
        similarity,
        metadata: embedding.metadata
      });
    }
    
    // Sort by similarity and return top results
    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }
  
  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);
    
    if (normA === 0 || normB === 0) return 0;
    
    return dotProduct / (normA * normB);
  }
  
  /**
   * Simple embedding generation fallback
   */
  private generateSimpleEmbedding(text: string): number[] {
    // Create a 384-dimensional vector based on character frequencies
    const vector = new Array(384).fill(0);
    const words = text.toLowerCase().split(/\W+/);
    
    words.forEach((word, wordIndex) => {
      for (let i = 0; i < word.length; i++) {
        const charCode = word.charCodeAt(i);
        const index = (charCode + wordIndex) % 384;
        vector[index] += 1 / (i + 1);
      }
    });
    
    // Normalize
    const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (norm > 0) {
      for (let i = 0; i < vector.length; i++) {
        vector[i] /= norm;
      }
    }
    
    return vector;
  }
  
  /**
   * Batch add memories
   */
  async addBatch(memories: Array<{ id: string; text: string; type?: string }>): Promise<void> {
    const promises = memories.map(m => this.addMemory(m.id, m.text, m.type));
    await Promise.all(promises);
  }
  
  /**
   * Get embedding statistics
   */
  getStats() {
    return {
      totalEmbeddings: this.embeddings.size,
      memoryTypes: Array.from(this.embeddings.values())
        .reduce((acc, emb) => {
          acc[emb.metadata.type] = (acc[emb.metadata.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
    };
  }
  
  /**
   * Export embeddings for backup
   */
  exportEmbeddings(): Array<Embedding> {
    return Array.from(this.embeddings.values());
  }
  
  /**
   * Import embeddings from backup
   */
  importEmbeddings(embeddings: Array<Embedding>): void {
    embeddings.forEach(emb => {
      this.embeddings.set(emb.id, emb);
    });
  }
  
  /**
   * Clear all embeddings
   */
  clear(): void {
    this.embeddings.clear();
  }
}
