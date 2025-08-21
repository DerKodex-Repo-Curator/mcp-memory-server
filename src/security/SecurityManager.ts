/**
 * SecurityManager.ts - Manages security and safety checks
 */

import { OllamaRequest, EnrichedRequest } from '../types.js';
import winston from 'winston';

export interface SecurityPolicy {
  maxPromptLength: number;
  maxResponseTokens: number;
  blockedPatterns: RegExp[];
  allowedModels: string[];
  rateLimits: {
    requestsPerMinute: number;
    requestsPerHour: number;
  };
  sanitization: {
    removePersonalInfo: boolean;
    removeSensitiveData: boolean;
  };
}

export class SecurityManager {
  private policy: SecurityPolicy;
  private logger: winston.Logger;
  private requestCounts: Map<string, { minute: number[]; hour: number[] }>;
  
  constructor(policy: Partial<SecurityPolicy>, logger: winston.Logger) {
    // Default security policy
    this.policy = {
      maxPromptLength: 10000,
      maxResponseTokens: 4096,
      blockedPatterns: [
        /api[_\s-]?key/gi,
        /password\s*[:=]/gi,
        /secret\s*[:=]/gi,
        /token\s*[:=]/gi,
        /credit[_\s-]?card/gi,
        /ssn|social[_\s-]?security/gi
      ],
      allowedModels: ['llama3.2', 'deepseek-r1', 'mistral', 'codellama'],
      rateLimits: {
        requestsPerMinute: 30,
        requestsPerHour: 500
      },
      sanitization: {
        removePersonalInfo: true,
        removeSensitiveData: true
      },
      ...policy
    };
    
    this.logger = logger;
    this.requestCounts = new Map();
    
    // Clean up old request counts periodically
    setInterval(() => this.cleanupRequestCounts(), 60000);
  }
  
  /**
   * Validate and sanitize a request
   */
  async validateRequest(request: OllamaRequest, clientId: string = 'default'): Promise<{
    valid: boolean;
    sanitized?: OllamaRequest;
    reason?: string;
  }> {
    // Check rate limits
    if (!this.checkRateLimit(clientId)) {
      return {
        valid: false,
        reason: 'Rate limit exceeded'
      };
    }
    
    // Check prompt length
    if (request.prompt.length > this.policy.maxPromptLength) {
      return {
        valid: false,
        reason: `Prompt too long: ${request.prompt.length} > ${this.policy.maxPromptLength}`
      };
    }
    
    // Check allowed models
    if (!this.policy.allowedModels.includes(request.model)) {
      return {
        valid: false,
        reason: `Model not allowed: ${request.model}`
      };
    }
    
    // Check for blocked patterns
    const blockedPattern = this.findBlockedPattern(request.prompt);
    if (blockedPattern) {
      this.logger.warn('Blocked pattern detected', {
        pattern: blockedPattern.source,
        clientId
      });
      
      // Sanitize instead of blocking
      const sanitized = this.sanitizePrompt(request.prompt);
      return {
        valid: true,
        sanitized: {
          ...request,
          prompt: sanitized
        }
      };
    }
    
    // Check token limits
    if (request.options?.num_predict && request.options.num_predict > this.policy.maxResponseTokens) {
      return {
        valid: true,
        sanitized: {
          ...request,
          options: {
            ...request.options,
            num_predict: this.policy.maxResponseTokens
          }
        }
      };
    }
    
    return { valid: true };
  }
  
  /**
   * Sanitize enriched content
   */
  sanitizeEnrichedContent(content: string): string {
    let sanitized = content;
    
    // Remove sensitive patterns
    for (const pattern of this.policy.blockedPatterns) {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    }
    
    // Remove potential PII
    if (this.policy.sanitization.removePersonalInfo) {
      // Email addresses
      sanitized = sanitized.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]');
      
      // Phone numbers
      sanitized = sanitized.replace(/(\+?\d{1,3}[-.\s]?)?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g, '[PHONE]');
      
      // IP addresses
      sanitized = sanitized.replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[IP]');
    }
    
    return sanitized;
  }
  
  /**
   * Check rate limits
   */
  private checkRateLimit(clientId: string): boolean {
    const now = Date.now();
    const minuteAgo = now - 60000;
    const hourAgo = now - 3600000;
    
    // Initialize client counts if needed
    if (!this.requestCounts.has(clientId)) {
      this.requestCounts.set(clientId, { minute: [], hour: [] });
    }
    
    const counts = this.requestCounts.get(clientId)!;
    
    // Filter old timestamps
    counts.minute = counts.minute.filter(t => t > minuteAgo);
    counts.hour = counts.hour.filter(t => t > hourAgo);
    
    // Check limits
    if (counts.minute.length >= this.policy.rateLimits.requestsPerMinute) {
      this.logger.warn('Rate limit exceeded (per minute)', {
        clientId,
        count: counts.minute.length,
        limit: this.policy.rateLimits.requestsPerMinute
      });
      return false;
    }
    
    if (counts.hour.length >= this.policy.rateLimits.requestsPerHour) {
      this.logger.warn('Rate limit exceeded (per hour)', {
        clientId,
        count: counts.hour.length,
        limit: this.policy.rateLimits.requestsPerHour
      });
      return false;
    }
    
    // Add current request
    counts.minute.push(now);
    counts.hour.push(now);
    
    return true;
  }
  
  /**
   * Find blocked pattern in text
   */
  private findBlockedPattern(text: string): RegExp | null {
    for (const pattern of this.policy.blockedPatterns) {
      if (pattern.test(text)) {
        return pattern;
      }
    }
    return null;
  }
  
  /**
   * Sanitize prompt
   */
  private sanitizePrompt(prompt: string): string {
    let sanitized = prompt;
    
    // Replace blocked patterns
    for (const pattern of this.policy.blockedPatterns) {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    }
    
    return sanitized;
  }
  
  /**
   * Clean up old request counts
   */
  private cleanupRequestCounts(): void {
    const hourAgo = Date.now() - 3600000;
    
    for (const [clientId, counts] of this.requestCounts.entries()) {
      counts.hour = counts.hour.filter(t => t > hourAgo);
      
      // Remove client if no recent requests
      if (counts.hour.length === 0) {
        this.requestCounts.delete(clientId);
      }
    }
  }
  
  /**
   * Get security report
   */
  getSecurityReport() {
    const clientStats = Array.from(this.requestCounts.entries()).map(([clientId, counts]) => ({
      clientId,
      requestsLastMinute: counts.minute.length,
      requestsLastHour: counts.hour.length
    }));
    
    return {
      policy: {
        maxPromptLength: this.policy.maxPromptLength,
        maxResponseTokens: this.policy.maxResponseTokens,
        allowedModels: this.policy.allowedModels,
        rateLimits: this.policy.rateLimits
      },
      activeClients: clientStats.length,
      clientStats,
      blockedPatternsCount: this.policy.blockedPatterns.length
    };
  }
  
  /**
   * Update security policy
   */
  updatePolicy(updates: Partial<SecurityPolicy>): void {
    this.policy = {
      ...this.policy,
      ...updates
    };
    
    this.logger.info('Security policy updated', updates);
  }
  
  /**
   * Add blocked pattern
   */
  addBlockedPattern(pattern: RegExp): void {
    this.policy.blockedPatterns.push(pattern);
    this.logger.info('Added blocked pattern', { pattern: pattern.source });
  }
  
  /**
   * Remove blocked pattern
   */
  removeBlockedPattern(patternSource: string): boolean {
    const index = this.policy.blockedPatterns.findIndex(p => p.source === patternSource);
    if (index !== -1) {
      this.policy.blockedPatterns.splice(index, 1);
      this.logger.info('Removed blocked pattern', { pattern: patternSource });
      return true;
    }
    return false;
  }
}
