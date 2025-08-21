/**
 * MemoryManager.ts - Manages memory storage and retrieval
 */

import { Memory, TaskMemory, ModelContext, Insight } from './types.js';
import { BrainClient } from './clients/BrainClient.js';
import NodeCache from 'node-cache';

export class MemoryManager {
  private brain: BrainClient;
  private cache: NodeCache;
  private taskMemories: Map<string, TaskMemory>;
  private modelStats: Map<string, ModelContext>;
  
  constructor(brainClient: BrainClient, cacheTTL: number = 3600) {
    this.brain = brainClient;
    this.cache = new NodeCache({ stdTTL: cacheTTL });
    this.taskMemories = new Map();
    this.modelStats = new Map();
    
    // Initialize with default model contexts
    this.initializeModelContexts();
  }
  
  /**
   * Search for relevant memories based on prompt
   */
  async searchMemories(prompt: string, limit: number = 10): Promise<Memory[]> {
    // Check cache first
    const cacheKey = `memories:${this.hashPrompt(prompt)}`;
    const cached = this.cache.get<Memory[]>(cacheKey);
    if (cached) return cached;
    
    // Extract keywords and concepts
    const keywords = this.extractKeywords(prompt);
    
    // Search Brain for relevant memories
    const memories = await this.brain.recall(keywords.join(' '), limit * 2);
    
    // Calculate relevance scores
    const scoredMemories = memories.map(memory => ({
      ...memory,
      relevance: this.calculateRelevance(memory, prompt, keywords)
    }));
    
    // Sort by relevance and take top results
    const topMemories = scoredMemories
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, limit);
    
    // Cache results
    this.cache.set(cacheKey, topMemories);
    
    return topMemories;
  }
  
  /**
   * Find similar past tasks
   */
  async findSimilarTasks(prompt: string, model: string, limit: number = 5): Promise<TaskMemory[]> {
    const allTasks = Array.from(this.taskMemories.values());
    
    // Calculate similarity scores
    const scoredTasks = allTasks.map(task => ({
      task,
      similarity: this.calculateSimilarity(prompt, task.prompt)
    }));
    
    // Filter by model and sort by similarity
    return scoredTasks
      .filter(({ task }) => task.model === model)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
      .map(({ task }) => task);
  }
  
  /**
   * Get model-specific context
   */
  getModelContext(model: string): ModelContext {
    return this.modelStats.get(model) || this.createDefaultModelContext(model);
  }
  
  /**
   * Get recent insights
   */
  async getRecentInsights(limit: number = 10): Promise<Insight[]> {
    const insights = await this.brain.recall('insight', limit);
    
    return insights.map(memory => ({
      id: memory.key,
      content: memory.value,
      source: memory.metadata?.source || 'unknown',
      confidence: memory.metadata?.confidence || 0.5,
      timestamp: memory.created || new Date().toISOString(),
      tags: memory.metadata?.tags || []
    }));
  }
  
  /**
   * Store task outcome for learning
   */
  async storeTaskOutcome(taskMemory: TaskMemory): Promise<void> {
    // Store in memory
    this.taskMemories.set(taskMemory.taskId, taskMemory);
    
    // Store in Brain for persistence
    await this.brain.remember(`task_${taskMemory.taskId}`, taskMemory, 'task_outcome');
    
    // Update model statistics
    this.updateModelStats(taskMemory);
    
    // Extract and store insights
    const insights = this.extractInsights(taskMemory);
    for (const insight of insights) {
      await this.brain.remember(`insight_${Date.now()}`, insight, 'insight');
    }
  }
  
  /**
   * Extract keywords from prompt
   */
  private extractKeywords(prompt: string): string[] {
    // Simple keyword extraction - could be enhanced with NLP
    const words = prompt.toLowerCase().split(/\W+/);
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for']);
    
    return words
      .filter(word => word.length > 3 && !stopWords.has(word))
      .slice(0, 10);
  }
  
  /**
   * Calculate relevance score
   */
  private calculateRelevance(memory: Memory, prompt: string, keywords: string[]): number {
    let score = 0;
    const memoryText = JSON.stringify(memory.value).toLowerCase();
    const promptLower = prompt.toLowerCase();
    
    // Check for keyword matches
    keywords.forEach(keyword => {
      if (memoryText.includes(keyword)) score += 0.1;
    });
    
    // Check for phrase matches
    const phrases = this.extractPhrases(promptLower);
    phrases.forEach(phrase => {
      if (memoryText.includes(phrase)) score += 0.2;
    });
    
    // Boost recent memories
    const age = Date.now() - new Date(memory.created || 0).getTime();
    const ageDays = age / (1000 * 60 * 60 * 24);
    score += Math.max(0, 1 - ageDays / 30) * 0.1;
    
    return Math.min(1, score);
  }
  
  /**
   * Calculate similarity between prompts
   */
  private calculateSimilarity(prompt1: string, prompt2: string): number {
    const words1 = new Set(prompt1.toLowerCase().split(/\W+/));
    const words2 = new Set(prompt2.toLowerCase().split(/\W+/));
    
    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }
  
  /**
   * Extract phrases from text
   */
  private extractPhrases(text: string): string[] {
    // Extract 2-3 word phrases
    const words = text.split(/\W+/);
    const phrases: string[] = [];
    
    for (let i = 0; i < words.length - 1; i++) {
      phrases.push(`${words[i]} ${words[i + 1]}`);
      if (i < words.length - 2) {
        phrases.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
      }
    }
    
    return phrases;
  }
  
  /**
   * Hash prompt for caching
   */
  private hashPrompt(prompt: string): string {
    // Simple hash for cache key
    return prompt.slice(0, 100).replace(/\W+/g, '_');
  }
  
  /**
   * Initialize default model contexts
   */
  private initializeModelContexts(): void {
    this.modelStats.set('deepseek-r1', {
      model: 'deepseek-r1',
      strengths: ['deep analysis', 'complex reasoning', 'mathematics', 'step-by-step thinking'],
      weaknesses: ['slower response time', 'verbose'],
      bestPractices: [
        'Give it time to think deeply',
        'Ask for step-by-step reasoning',
        'Good for complex analysis tasks'
      ],
      avgResponseTime: 45 * 60 * 1000, // 45 minutes
      successRate: 0.92,
      tips: [
        'Use "think step by step" in prompts',
        'Excellent for mathematical proofs',
        'Can handle very complex logic'
      ]
    });
    
    this.modelStats.set('llama3.2', {
      model: 'llama3.2',
      strengths: ['quick responses', 'code review', 'summaries', 'general tasks'],
      weaknesses: ['less deep reasoning', 'context limitations'],
      bestPractices: [
        'Keep context under 4000 tokens',
        'Good for quick iterations',
        'Excellent for code-related tasks'
      ],
      avgResponseTime: 10 * 60 * 1000, // 10 minutes
      successRate: 0.88,
      tips: [
        'Provide clear examples',
        'Works well with structured outputs',
        'Fast for simple analyses'
      ]
    });
  }
  
  /**
   * Create default model context
   */
  private createDefaultModelContext(model: string): ModelContext {
    return {
      model,
      strengths: ['general purpose'],
      weaknesses: ['unknown'],
      bestPractices: ['provide clear instructions'],
      avgResponseTime: 30 * 60 * 1000, // 30 minutes default
      successRate: 0.8,
      tips: []
    };
  }
  
  /**
   * Update model statistics based on task outcome
   */
  private updateModelStats(task: TaskMemory): void {
    const stats = this.modelStats.get(task.model) || this.createDefaultModelContext(task.model);
    
    // Update average response time
    const alpha = 0.1; // Learning rate
    stats.avgResponseTime = (1 - alpha) * stats.avgResponseTime + alpha * task.duration;
    
    // Update success rate (assuming quality > 0.7 is success)
    const isSuccess = task.quality > 0.7;
    stats.successRate = (1 - alpha) * stats.successRate + alpha * (isSuccess ? 1 : 0);
    
    this.modelStats.set(task.model, stats);
  }
  
  /**
   * Extract insights from task outcome
   */
  private extractInsights(task: TaskMemory): Insight[] {
    const insights: Insight[] = [];
    
    // Extract approach insights
    if (task.quality > 0.8) {
      insights.push({
        id: `insight_approach_${Date.now()}`,
        content: `Successful approach for ${task.model}: ${task.approach}`,
        source: `task_${task.taskId}`,
        confidence: task.quality,
        timestamp: new Date().toISOString(),
        tags: ['approach', task.model, 'success']
      });
    }
    
    // Extract timing insights
    if (task.duration < this.getModelContext(task.model).avgResponseTime * 0.7) {
      insights.push({
        id: `insight_performance_${Date.now()}`,
        content: `Fast completion: ${task.title} completed in ${Math.round(task.duration / 60000)} minutes`,
        source: `task_${task.taskId}`,
        confidence: 0.9,
        timestamp: new Date().toISOString(),
        tags: ['performance', task.model, 'fast']
      });
    }
    
    return insights;
  }
}
