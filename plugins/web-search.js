/**
 * WebSearchPlugin.js - Plugin that adds web search context to prompts
 */

import axios from 'axios';

const WebSearchPlugin = {
  name: 'web-search-plugin',
  version: '1.0.0',
  description: 'Automatically searches the web for relevant context',
  
  searchCache: new Map(),
  
  async onInitialize() {
    console.log('Web Search Plugin initialized');
  },
  
  async beforeEnrichment(request) {
    // Extract key terms from prompt
    const keywords = this.extractKeywords(request.prompt);
    
    // Check if prompt seems to need current information
    if (this.needsWebSearch(request.prompt)) {
      console.log(`Web search triggered for: ${keywords.join(', ')}`);
      
      try {
        const searchResults = await this.performSearch(keywords.join(' '));
        
        // Add search context to prompt
        if (searchResults.length > 0) {
          const context = this.formatSearchResults(searchResults);
          request.prompt = `${context}\n\n${request.prompt}`;
        }
      } catch (error) {
        console.error('Web search failed:', error);
      }
    }
    
    return request;
  },
  
  extractKeywords(text) {
    // Simple keyword extraction
    const words = text.toLowerCase().split(/\W+/);
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'as', 'is', 'was', 'are', 'were']);
    
    return words
      .filter(word => word.length > 3 && !stopWords.has(word))
      .slice(0, 5);
  },
  
  needsWebSearch(prompt) {
    const currentInfoPatterns = [
      /current|latest|recent|today|now/i,
      /news|update|announcement/i,
      /price|cost|rate/i,
      /weather|forecast/i,
      /\d{4}/ // Year references
    ];
    
    return currentInfoPatterns.some(pattern => pattern.test(prompt));
  },
  
  async performSearch(query) {
    // Check cache first
    if (this.searchCache.has(query)) {
      const cached = this.searchCache.get(query);
      if (Date.now() - cached.timestamp < 3600000) { // 1 hour cache
        return cached.results;
      }
    }
    
    // Simulate web search (replace with actual search API)
    // In production, this would call a real search API
    const mockResults = [
      {
        title: 'Latest developments in ' + query,
        snippet: 'Recent updates show significant progress in this area...',
        url: 'https://example.com/article1'
      },
      {
        title: 'Expert analysis: ' + query,
        snippet: 'According to industry experts, the current state indicates...',
        url: 'https://example.com/article2'
      }
    ];
    
    // Cache results
    this.searchCache.set(query, {
      results: mockResults,
      timestamp: Date.now()
    });
    
    return mockResults;
  },
  
  formatSearchResults(results) {
    const lines = ['=== WEB SEARCH CONTEXT ==='];
    lines.push('Recent web information that may be relevant:\n');
    
    results.forEach((result, index) => {
      lines.push(`${index + 1}. ${result.title}`);
      lines.push(`   ${result.snippet}`);
      lines.push(`   Source: ${result.url}\n`);
    });
    
    lines.push('Note: Web search results provide current context but should be verified.');
    
    return lines.join('\n');
  },
  
  endpoints: [
    {
      method: 'POST',
      path: '/api/plugin/web-search',
      handler: async (req, res) => {
        const { query } = req.body;
        
        try {
          const results = await this.performSearch(query);
          res.json({ results });
        } catch (error) {
          res.status(500).json({ error: 'Search failed' });
        }
      }
    },
    {
      method: 'GET',
      path: '/api/plugin/web-search/cache',
      handler: async (req, res) => {
        const cacheStats = {
          size: this.searchCache.size,
          entries: Array.from(this.searchCache.keys())
        };
        res.json(cacheStats);
      }
    }
  ]
};

export default WebSearchPlugin;
