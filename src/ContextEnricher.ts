/**
 * ContextEnricher.ts - Enriches prompts with relevant context
 */

import { 
  EnrichmentContext, 
  Memory, 
  TaskMemory, 
  ModelContext, 
  Insight,
  MemoryServerConfig 
} from './types.js';
import { MemoryManager } from './MemoryManager.js';

export class ContextEnricher {
  private memoryManager: MemoryManager;
  private config: MemoryServerConfig['memory'];
  
  constructor(memoryManager: MemoryManager, config: MemoryServerConfig['memory']) {
    this.memoryManager = memoryManager;
    this.config = config;
  }
  
  /**
   * Enrich a prompt with relevant context
   */
  async enrichPrompt(prompt: string, model: string): Promise<{
    enrichedPrompt: string;
    context: EnrichmentContext;
  }> {
    if (!this.config.autoEnrich) {
      return { enrichedPrompt: prompt, context: this.createEmptyContext() };
    }
    
    // Gather all context
    const context = await this.gatherContext(prompt, model);
    
    // Build enriched prompt
    const enrichedPrompt = this.buildEnrichedPrompt(prompt, context);
    
    return { enrichedPrompt, context };
  }
  
  /**
   * Gather all relevant context
   */
  private async gatherContext(prompt: string, model: string): Promise<EnrichmentContext> {
    // Run all context gathering in parallel
    const [memories, similarTasks, modelContext, recentInsights] = await Promise.all([
      this.memoryManager.searchMemories(prompt, this.config.similarityLimit),
      this.memoryManager.findSimilarTasks(prompt, model, 5),
      Promise.resolve(this.memoryManager.getModelContext(model)),
      this.memoryManager.getRecentInsights(5)
    ]);
    
    // Filter by relevance threshold
    const relevantMemories = memories.filter(m => m.relevance >= this.config.relevanceThreshold);
    
    return {
      memories: relevantMemories,
      similarTasks,
      modelContext,
      recentInsights
    };
  }
  
  /**
   * Build the enriched prompt
   */
  private buildEnrichedPrompt(originalPrompt: string, context: EnrichmentContext): string {
    const sections: string[] = [];
    
    // Add model-specific tips
    if (context.modelContext.tips.length > 0) {
      sections.push(this.formatModelTips(context.modelContext));
    }
    
    // Add relevant memories
    if (context.memories.length > 0) {
      sections.push(this.formatMemories(context.memories));
    }
    
    // Add similar task learnings
    if (context.similarTasks.length > 0) {
      sections.push(this.formatSimilarTasks(context.similarTasks));
    }
    
    // Add recent insights
    if (context.recentInsights.length > 0) {
      sections.push(this.formatInsights(context.recentInsights));
    }
    
    // Add original prompt
    sections.push('=== CURRENT TASK ===');
    sections.push(originalPrompt);
    
    // Calculate token usage and trim if needed
    const enrichedPrompt = sections.join('\n\n');
    return this.trimToTokenLimit(enrichedPrompt, originalPrompt);
  }
  
  /**
   * Format model tips section
   */
  private formatModelTips(modelContext: ModelContext): string {
    const lines = ['=== MODEL GUIDANCE ==='];
    lines.push(`You are ${modelContext.model}, with these strengths:`);
    lines.push(...modelContext.strengths.map(s => `- ${s}`));
    
    if (modelContext.tips.length > 0) {
      lines.push('\nTips for best results:');
      lines.push(...modelContext.tips.map(t => `- ${t}`));
    }
    
    return lines.join('\n');
  }
  
  /**
   * Format memories section
   */
  private formatMemories(memories: Memory[]): string {
    const lines = ['=== RELEVANT CONTEXT ==='];
    
    memories.slice(0, 5).forEach((memory, index) => {
      lines.push(`\nContext ${index + 1} (relevance: ${Math.round(memory.relevance * 100)}%):`);
      
      if (typeof memory.value === 'string') {
        lines.push(this.truncateText(memory.value, 200));
      } else {
        lines.push(this.truncateText(JSON.stringify(memory.value, null, 2), 200));
      }
    });
    
    return lines.join('\n');
  }
  
  /**
   * Format similar tasks section
   */
  private formatSimilarTasks(tasks: TaskMemory[]): string {
    const lines = ['=== SIMILAR PAST TASKS ==='];
    
    tasks.slice(0, 3).forEach((task, index) => {
      lines.push(`\nTask ${index + 1}: ${task.title}`);
      lines.push(`Approach: ${task.approach}`);
      lines.push(`Quality: ${Math.round(task.quality * 100)}%`);
      lines.push(`Duration: ${Math.round(task.duration / 60000)} minutes`);
      
      // Include key learnings from response
      const learnings = this.extractKeyLearnings(task.response);
      if (learnings) {
        lines.push(`Key learning: ${learnings}`);
      }
    });
    
    return lines.join('\n');
  }
  
  /**
   * Format insights section
   */
  private formatInsights(insights: Insight[]): string {
    const lines = ['=== RECENT INSIGHTS ==='];
    
    insights.forEach((insight, index) => {
      lines.push(`${index + 1}. ${insight.content}`);
    });
    
    return lines.join('\n');
  }
  
  /**
   * Truncate text to length
   */
  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }
  
  /**
   * Extract key learnings from task response
   */
  private extractKeyLearnings(response: string): string {
    // Simple extraction - look for conclusion/summary patterns
    const patterns = [
      /conclusion:?\s*(.+?)(?:\n|$)/i,
      /summary:?\s*(.+?)(?:\n|$)/i,
      /key finding:?\s*(.+?)(?:\n|$)/i,
      /the main.+?is\s+(.+?)(?:\.|$)/i
    ];
    
    for (const pattern of patterns) {
      const match = response.match(pattern);
      if (match) {
        return this.truncateText(match[1].trim(), 100);
      }
    }
    
    return '';
  }
  
  /**
   * Trim prompt to token limit
   */
  private trimToTokenLimit(enrichedPrompt: string, originalPrompt: string): string {
    // Simple approximation: 1 token ≈ 4 characters
    const estimatedTokens = enrichedPrompt.length / 4;
    
    if (estimatedTokens <= this.config.maxContextTokens) {
      return enrichedPrompt;
    }
    
    // If over limit, progressively remove sections
    const sections = enrichedPrompt.split('=== CURRENT TASK ===');
    const contextSection = sections[0];
    const taskSection = '=== CURRENT TASK ===\n' + sections[1];
    
    // Calculate how much context we can include
    const taskTokens = taskSection.length / 4;
    const availableContextTokens = this.config.maxContextTokens - taskTokens - 100; // buffer
    
    if (availableContextTokens <= 0) {
      // If task itself is too large, just return it
      return originalPrompt;
    }
    
    // Trim context to fit
    const trimmedContext = contextSection.substring(0, availableContextTokens * 4);
    
    return trimmedContext + '\n\n' + taskSection;
  }
  
  /**
   * Create empty context
   */
  private createEmptyContext(): EnrichmentContext {
    return {
      memories: [],
      similarTasks: [],
      modelContext: {
        model: '',
        strengths: [],
        weaknesses: [],
        bestPractices: [],
        avgResponseTime: 0,
        successRate: 0,
        tips: []
      },
      recentInsights: []
    };
  }
}
