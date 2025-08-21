/**
 * PerformanceOptimizer.ts - Optimizes memory server performance
 */

import { MemoryServerConfig } from '../types.js';
import winston from 'winston';

export interface PerformanceMetrics {
  enrichmentTime: number[];
  ollamaResponseTime: number[];
  totalRequestTime: number[];
  memorySearchTime: number[];
  cacheHitRate: number;
  memoryUsage: NodeJS.MemoryUsage;
}

export class PerformanceOptimizer {
  private metrics: PerformanceMetrics;
  private logger: winston.Logger;
  private config: MemoryServerConfig;
  private adaptiveConfig: {
    maxContextTokens: number;
    similarityLimit: number;
    relevanceThreshold: number;
  };
  
  constructor(config: MemoryServerConfig, logger: winston.Logger) {
    this.config = config;
    this.logger = logger;
    this.metrics = {
      enrichmentTime: [],
      ollamaResponseTime: [],
      totalRequestTime: [],
      memorySearchTime: [],
      cacheHitRate: 0,
      memoryUsage: process.memoryUsage()
    };
    
    // Initialize adaptive config
    this.adaptiveConfig = {
      maxContextTokens: config.memory.maxContextTokens,
      similarityLimit: config.memory.similarityLimit,
      relevanceThreshold: config.memory.relevanceThreshold
    };
    
    // Start monitoring
    this.startMonitoring();
  }
  
  /**
   * Record enrichment time
   */
  recordEnrichmentTime(time: number): void {
    this.metrics.enrichmentTime.push(time);
    // Keep only last 100 measurements
    if (this.metrics.enrichmentTime.length > 100) {
      this.metrics.enrichmentTime.shift();
    }
  }
  
  /**
   * Record Ollama response time
   */
  recordOllamaTime(time: number): void {
    this.metrics.ollamaResponseTime.push(time);
    if (this.metrics.ollamaResponseTime.length > 100) {
      this.metrics.ollamaResponseTime.shift();
    }
  }
  
  /**
   * Record total request time
   */
  recordTotalTime(time: number): void {
    this.metrics.totalRequestTime.push(time);
    if (this.metrics.totalRequestTime.length > 100) {
      this.metrics.totalRequestTime.shift();
    }
  }
  
  /**
   * Record memory search time
   */
  recordMemorySearchTime(time: number): void {
    this.metrics.memorySearchTime.push(time);
    if (this.metrics.memorySearchTime.length > 100) {
      this.metrics.memorySearchTime.shift();
    }
  }
  
  /**
   * Update cache hit rate
   */
  updateCacheHitRate(hits: number, total: number): void {
    this.metrics.cacheHitRate = total > 0 ? hits / total : 0;
  }
  
  /**
   * Get current adaptive configuration
   */
  getAdaptiveConfig() {
    return { ...this.adaptiveConfig };
  }
  
  /**
   * Optimize configuration based on metrics
   */
  private optimize(): void {
    const avgEnrichmentTime = this.average(this.metrics.enrichmentTime);
    const avgMemorySearchTime = this.average(this.metrics.memorySearchTime);
    
    // If enrichment is taking too long, reduce limits
    if (avgEnrichmentTime > 1000) { // More than 1 second
      this.adaptiveConfig.similarityLimit = Math.max(3, this.adaptiveConfig.similarityLimit - 1);
      this.adaptiveConfig.maxContextTokens = Math.max(1000, this.adaptiveConfig.maxContextTokens - 200);
      
      this.logger.info('Performance optimization: Reducing context limits', {
        similarityLimit: this.adaptiveConfig.similarityLimit,
        maxContextTokens: this.adaptiveConfig.maxContextTokens
      });
    }
    
    // If we have good performance and low memory usage, increase limits
    const memoryUsagePercent = this.metrics.memoryUsage.heapUsed / this.metrics.memoryUsage.heapTotal;
    if (avgEnrichmentTime < 500 && memoryUsagePercent < 0.7) {
      this.adaptiveConfig.similarityLimit = Math.min(20, this.adaptiveConfig.similarityLimit + 1);
      this.adaptiveConfig.maxContextTokens = Math.min(4000, this.adaptiveConfig.maxContextTokens + 200);
      
      this.logger.info('Performance optimization: Increasing context limits', {
        similarityLimit: this.adaptiveConfig.similarityLimit,
        maxContextTokens: this.adaptiveConfig.maxContextTokens
      });
    }
    
    // Adjust relevance threshold based on search performance
    if (avgMemorySearchTime > 500) {
      this.adaptiveConfig.relevanceThreshold = Math.min(0.7, this.adaptiveConfig.relevanceThreshold + 0.05);
    } else if (avgMemorySearchTime < 100) {
      this.adaptiveConfig.relevanceThreshold = Math.max(0.1, this.adaptiveConfig.relevanceThreshold - 0.05);
    }
  }
  
  /**
   * Calculate average of array
   */
  private average(arr: number[]): number {
    if (arr.length === 0) return 0;
    return arr.reduce((sum, val) => sum + val, 0) / arr.length;
  }
  
  /**
   * Start performance monitoring
   */
  private startMonitoring(): void {
    // Monitor every 30 seconds
    setInterval(() => {
      this.metrics.memoryUsage = process.memoryUsage();
      
      // Run optimization
      this.optimize();
      
      // Log current metrics
      this.logger.info('Performance metrics', {
        avgEnrichmentTime: this.average(this.metrics.enrichmentTime),
        avgOllamaTime: this.average(this.metrics.ollamaResponseTime),
        avgTotalTime: this.average(this.metrics.totalRequestTime),
        cacheHitRate: this.metrics.cacheHitRate,
        memoryUsageMB: Math.round(this.metrics.memoryUsage.heapUsed / 1024 / 1024),
        adaptiveConfig: this.adaptiveConfig
      });
    }, 30000);
  }
  
  /**
   * Get performance report
   */
  getReport() {
    return {
      averages: {
        enrichmentTime: this.average(this.metrics.enrichmentTime),
        ollamaResponseTime: this.average(this.metrics.ollamaResponseTime),
        totalRequestTime: this.average(this.metrics.totalRequestTime),
        memorySearchTime: this.average(this.metrics.memorySearchTime)
      },
      cacheHitRate: this.metrics.cacheHitRate,
      memoryUsage: {
        heapUsedMB: Math.round(this.metrics.memoryUsage.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(this.metrics.memoryUsage.heapTotal / 1024 / 1024),
        externalMB: Math.round(this.metrics.memoryUsage.external / 1024 / 1024)
      },
      currentConfig: this.adaptiveConfig,
      recommendations: this.getRecommendations()
    };
  }
  
  /**
   * Get performance recommendations
   */
  private getRecommendations(): string[] {
    const recommendations: string[] = [];
    
    const avgEnrichmentTime = this.average(this.metrics.enrichmentTime);
    const avgMemorySearchTime = this.average(this.metrics.memorySearchTime);
    const cacheHitRate = this.metrics.cacheHitRate;
    
    if (avgEnrichmentTime > 2000) {
      recommendations.push('Enrichment is slow. Consider reducing similarity limit or using embeddings.');
    }
    
    if (avgMemorySearchTime > 1000) {
      recommendations.push('Memory search is slow. Consider implementing vector search or indexing.');
    }
    
    if (cacheHitRate < 0.3) {
      recommendations.push('Low cache hit rate. Consider increasing cache TTL or size.');
    }
    
    if (this.metrics.memoryUsage.heapUsed / this.metrics.memoryUsage.heapTotal > 0.8) {
      recommendations.push('High memory usage. Consider implementing memory cleanup or pagination.');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('Performance is optimal.');
    }
    
    return recommendations;
  }
}
