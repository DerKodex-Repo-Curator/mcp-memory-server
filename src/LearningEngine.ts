/**
 * LearningEngine.ts - Learns from interactions and improves over time
 */

import { 
  EnrichedRequest, 
  OllamaResponse, 
  LearningOutcome,
  TaskMemory 
} from './types.js';
import { MemoryManager } from './MemoryManager.js';

export class LearningEngine {
  private memoryManager: MemoryManager;
  
  constructor(memoryManager: MemoryManager) {
    this.memoryManager = memoryManager;
  }
  
  /**
   * Learn from an interaction
   */
  async learn(
    request: EnrichedRequest, 
    response: OllamaResponse,
    duration: number
  ): Promise<LearningOutcome> {
    // Extract insights from the interaction
    const insights = this.extractInsights(request, response);
    
    // Assess quality of the response
    const quality = this.assessQuality(request, response, duration);
    
    // Identify the approach used
    const approach = this.identifyApproach(request, response);
    
    // Extract tools that would have been useful
    const toolsUsed = this.extractToolsUsed(response.response);
    
    // Create learning outcome
    const outcome: LearningOutcome = {
      requestId: request.requestId,
      model: request.model,
      duration,
      quality,
      insights,
      approach,
      toolsUsed
    };
    
    // Store insights for future use
    for (const insight of insights) {
      await this.memoryManager['brain'].remember(
        `insight_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        {
          content: insight,
          source: `task_${request.requestId}`,
          model: request.model,
          confidence: quality,
          timestamp: new Date().toISOString(),
          tags: this.extractTags(insight)
        },
        'insight'
      );
    }
    
    return outcome;
  }
  
  /**
   * Extract insights from the interaction
   */
  private extractInsights(request: EnrichedRequest, response: OllamaResponse): string[] {
    const insights: string[] = [];
    
    // Check if enrichment helped
    if (request.enrichmentContext.memories.length > 0) {
      const memoryReferences = this.countMemoryReferences(
        response.response, 
        request.enrichmentContext.memories
      );
      
      if (memoryReferences > 0) {
        insights.push(`Using ${memoryReferences} memory references improved response quality`);
      }
    }
    
    // Check if similar tasks helped
    if (request.enrichmentContext.similarTasks.length > 0) {
      const similarityScore = this.calculateSimilarityScore(
        response.response,
        request.enrichmentContext.similarTasks
      );
      
      if (similarityScore > 0.7) {
        insights.push('Similar task patterns were successfully applied');
      }
    }
    
    // Extract patterns from response
    const patterns = this.extractPatterns(response.response);
    insights.push(...patterns);
    
    return insights;
  }
  
  /**
   * Assess quality of the response
   */
  private assessQuality(
    request: EnrichedRequest, 
    response: OllamaResponse,
    duration: number
  ): number {
    let quality = 0.5; // Base quality
    
    // Response completeness
    if (response.response.length > 100) quality += 0.1;
    if (response.response.length > 500) quality += 0.1;
    
    // Structure indicators
    if (response.response.includes('```')) quality += 0.1; // Code blocks
    if (response.response.match(/\d\./g)) quality += 0.1; // Numbered lists
    if (response.response.match(/^#{1,3}\s/gm)) quality += 0.1; // Headers
    
    // Conclusion indicators
    if (response.response.toLowerCase().includes('conclusion')) quality += 0.1;
    if (response.response.toLowerCase().includes('summary')) quality += 0.1;
    
    // Speed vs expected
    const modelContext = request.enrichmentContext.modelContext;
    if (modelContext.avgResponseTime > 0) {
      const speedRatio = duration / modelContext.avgResponseTime;
      if (speedRatio < 0.8) quality += 0.1; // Faster than average
      if (speedRatio > 1.5) quality -= 0.1; // Much slower than average
    }
    
    return Math.max(0, Math.min(1, quality));
  }
  
  /**
   * Identify the approach used
   */
  private identifyApproach(request: EnrichedRequest, response: OllamaResponse): string {
    const responseText = response.response.toLowerCase();
    
    // Check for common approaches
    if (responseText.includes('step by step') || responseText.includes('step-by-step')) {
      return 'step-by-step analysis';
    }
    
    if (responseText.includes('first') && responseText.includes('second') && responseText.includes('third')) {
      return 'structured enumeration';
    }
    
    if (responseText.includes('pros') && responseText.includes('cons')) {
      return 'pros and cons analysis';
    }
    
    if (responseText.match(/\d+\.\s/g)?.length > 3) {
      return 'numbered list approach';
    }
    
    if (responseText.includes('example')) {
      return 'example-driven explanation';
    }
    
    return 'general analysis';
  }
  
  /**
   * Extract tools that were used or mentioned
   */
  private extractToolsUsed(response: string): string[] {
    const tools: string[] = [];
    
    // Look for tool mentions
    if (response.includes('brain_recall') || response.includes('memory search')) {
      tools.push('brain_recall');
    }
    
    if (response.includes('web_search') || response.includes('search results')) {
      tools.push('web_search');
    }
    
    if (response.includes('read_file') || response.includes('file contents')) {
      tools.push('read_file');
    }
    
    return tools;
  }
  
  /**
   * Count memory references in response
   */
  private countMemoryReferences(response: string, memories: any[]): number {
    let count = 0;
    const responseText = response.toLowerCase();
    
    for (const memory of memories) {
      const memoryText = JSON.stringify(memory.value).toLowerCase();
      const keywords = memoryText.split(/\W+/).filter(w => w.length > 4);
      
      for (const keyword of keywords.slice(0, 5)) {
        if (responseText.includes(keyword)) {
          count++;
          break;
        }
      }
    }
    
    return count;
  }
  
  /**
   * Calculate similarity score with past tasks
   */
  private calculateSimilarityScore(response: string, similarTasks: TaskMemory[]): number {
    if (similarTasks.length === 0) return 0;
    
    let totalSimilarity = 0;
    
    for (const task of similarTasks) {
      const similarity = this.textSimilarity(response, task.response);
      totalSimilarity += similarity;
    }
    
    return totalSimilarity / similarTasks.length;
  }
  
  /**
   * Simple text similarity calculation
   */
  private textSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\W+/));
    const words2 = new Set(text2.toLowerCase().split(/\W+/));
    
    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }
  
  /**
   * Extract patterns from response
   */
  private extractPatterns(response: string): string[] {
    const patterns: string[] = [];
    
    // Check for common successful patterns
    if (response.match(/```[\s\S]+?```/g)) {
      patterns.push('Code examples improve clarity');
    }
    
    if (response.match(/^\d+\.\s+\w+/gm)?.length > 5) {
      patterns.push('Detailed numbered lists provide good structure');
    }
    
    if (response.includes('In conclusion') || response.includes('To summarize')) {
      patterns.push('Explicit conclusions help synthesize information');
    }
    
    return patterns;
  }
  
  /**
   * Extract tags from insight
   */
  private extractTags(insight: string): string[] {
    const tags: string[] = [];
    
    // Extract model names
    const models = ['deepseek-r1', 'llama3.2', 'gpt', 'claude'];
    for (const model of models) {
      if (insight.toLowerCase().includes(model)) {
        tags.push(model);
      }
    }
    
    // Extract technique tags
    if (insight.includes('memory')) tags.push('memory');
    if (insight.includes('pattern')) tags.push('pattern');
    if (insight.includes('approach')) tags.push('approach');
    if (insight.includes('quality')) tags.push('quality');
    
    return tags;
  }
}
