/**
 * index.ts - Main entry point for MCP Memory Server
 */

import { createMemoryServer } from './server.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Create and start server
async function main() {
  const server = createMemoryServer({
    port: parseInt(process.env.PORT || '8090'),
    ollamaUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
    mcpUrl: process.env.MCP_URL || 'http://localhost:3000',
    memory: {
      maxContextTokens: parseInt(process.env.MAX_CONTEXT_TOKENS || '2000'),
      similarityLimit: parseInt(process.env.SIMILARITY_LIMIT || '10'),
      relevanceThreshold: parseFloat(process.env.RELEVANCE_THRESHOLD || '0.3'),
      autoEnrich: process.env.AUTO_ENRICH !== 'false'
    },
    brain: {
      dataDir: process.env.BRAIN_DATA_DIR || '~/.brain',
      enabled: process.env.BRAIN_ENABLED !== 'false'
    },
    cache: {
      ttl: parseInt(process.env.CACHE_TTL || '3600'),
      maxSize: parseInt(process.env.CACHE_MAX_SIZE || '1000')
    }
  });
  
  try {
    await server.start();
    console.log('🧠 MCP Memory Server is running');
    console.log(`📡 Listening on port ${process.env.PORT || 8090}`);
    console.log(`🤖 Proxying to Ollama at ${process.env.OLLAMA_URL || 'http://localhost:11434'}`);
    
    // Handle shutdown
    process.on('SIGINT', () => {
      console.log('\n👋 Shutting down gracefully...');
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Run the server
main();
