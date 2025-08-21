# MCP Memory Server

An intelligent middleware server that adds memory and learning capabilities to Ollama by implementing the MCP (Model Context Protocol) pattern.

## Overview

MCP Memory Server acts as a smart proxy between your applications (like ELVIS) and Ollama, automatically enriching prompts with relevant context and learning from every interaction.

### Key Features

- **Automatic Context Enrichment**: Searches Brain memory and adds relevant context to prompts
- **Learning from Experience**: Tracks what works and improves over time
- **Model-Specific Optimization**: Learns each model's strengths and best practices
- **Similar Task Recognition**: Finds and applies lessons from similar past tasks
- **Drop-in Ollama Replacement**: Compatible with existing Ollama API clients
- **MCP Tool Integration**: Access to Brain, filesystem, and other MCP tools

## Architecture

```
Your App (ELVIS) → MCP Memory Server → Ollama
                          ↓
                    Brain Memory System
                    Learning Engine
                    Context Enricher
```

## Installation

```bash
# Clone the repository
git clone [repository-url]
cd mcp-memory-server

# Install dependencies
npm install

# Build the TypeScript code
npm run build

# Copy environment template
cp .env.example .env

# Edit .env with your settings
```

## Configuration

Create a `.env` file with:

```env
# Server Configuration
PORT=8090                          # Port for Memory Server
OLLAMA_URL=http://localhost:11434  # Ollama API endpoint
MCP_URL=http://localhost:3000      # MCP tools endpoint (optional)

# Memory Configuration
MAX_CONTEXT_TOKENS=2000            # Max tokens to add as context
SIMILARITY_LIMIT=10                # How many similar memories to search
RELEVANCE_THRESHOLD=0.3            # Min relevance score (0-1)
AUTO_ENRICH=true                   # Enable automatic enrichment

# Brain Integration
BRAIN_ENABLED=true                 # Enable Brain memory system
BRAIN_DATA_DIR=~/.brain           # Brain data directory

# Cache Configuration
CACHE_TTL=3600                     # Cache TTL in seconds
CACHE_MAX_SIZE=1000               # Max cache entries
```

## Usage

### Starting the Server

```bash
# Start the server
npm start

# Or with custom settings
PORT=9000 OLLAMA_URL=http://remote:11434 npm start
```

### Using with ELVIS

Simply point ELVIS to the Memory Server instead of Ollama:

```typescript
// Before (direct to Ollama)
const elvis = new ELVIS({
  ollamaUrl: 'http://localhost:11434'
});

// After (through Memory Server)
const elvis = new ELVIS({
  ollamaUrl: 'http://localhost:8090'  // Memory Server port
});
```

### API Endpoints

The server provides Ollama-compatible endpoints plus additional memory endpoints:

#### Ollama-Compatible Endpoints
- `POST /api/generate` - Generate text (with automatic enrichment)
- `POST /api/generate/stream` - Streaming generation
- `GET /api/tags` - List available models

#### Memory Management Endpoints
- `GET /api/memory/stats` - Get memory statistics
- `POST /api/memory/search` - Search memories
- `GET /api/memory/insights` - Get recent insights

#### Learning Endpoints
- `POST /api/learning/feedback` - Provide feedback on responses
- `GET /api/learning/model-stats/:model` - Get model performance stats

## How It Works

### 1. Context Enrichment

When a request comes in, the server:
1. Extracts keywords from the prompt
2. Searches Brain for relevant memories
3. Finds similar past tasks
4. Adds model-specific tips
5. Includes recent insights
6. Builds an enriched prompt with all context

### 2. Learning Process

After each response, the server:
1. Assesses response quality
2. Identifies the approach used
3. Extracts insights and patterns
4. Stores successful patterns
5. Updates model performance metrics

### 3. Memory Types

The server tracks several types of memory:
- **Task Memories**: Complete record of past tasks and outcomes
- **Model Context**: Performance stats and best practices per model
- **Insights**: Learned patterns and successful approaches
- **Domain Knowledge**: Subject-specific information

## Example Enrichment

Original prompt:
```
Analyze the performance bottlenecks in our Brain memory system
```

Enriched prompt (automatically generated):
```
=== MODEL GUIDANCE ===
You are deepseek-r1, with these strengths:
- deep analysis
- complex reasoning
- step-by-step thinking

Tips for best results:
- Use "think step by step" in prompts
- Excellent for mathematical proofs

=== RELEVANT CONTEXT ===
Context 1 (relevance: 89%):
Previous Brain performance analysis showed query optimization...

Context 2 (relevance: 76%):
Memory indexing strategies that improved recall speed by 40%...

=== SIMILAR PAST TASKS ===
Task 1: Analyze todo-manager performance issues
Approach: Profiling-driven analysis
Quality: 92%
Duration: 38 minutes
Key learning: Identifying hotspots first saved significant time

=== RECENT INSIGHTS ===
1. Using profiler data improves analysis accuracy
2. Database queries are often the bottleneck
3. Caching strategies significantly impact performance

=== CURRENT TASK ===
Analyze the performance bottlenecks in our Brain memory system
```

## Development

### Project Structure
```
src/
├── types.ts              # TypeScript interfaces
├── server.ts             # Express server setup
├── MemoryManager.ts      # Memory storage and retrieval
├── ContextEnricher.ts    # Prompt enrichment logic
├── LearningEngine.ts     # Learning from interactions
├── clients/
│   ├── BrainClient.ts    # Brain memory integration
│   └── OllamaClient.ts   # Ollama API client
└── index.ts              # Entry point
```

### Running Tests
```bash
npm test                    # Run all tests
npm run test:watch         # Watch mode
npm run test:coverage      # With coverage
```

### Building
```bash
npm run build              # Build TypeScript
npm run dev               # Watch mode
```

## Advanced Usage

### Custom Memory Sources

You can extend the memory system by implementing custom memory providers:

```typescript
class CustomMemoryProvider {
  async search(query: string): Promise<Memory[]> {
    // Your custom search logic
  }
}
```

### Model-Specific Configurations

Add model-specific configurations in the code:

```typescript
modelStats.set('your-model', {
  strengths: ['domain expertise'],
  avgResponseTime: 20 * 60 * 1000,
  tips: ['Works best with examples']
});
```

### Monitoring and Metrics

The server logs all interactions for analysis:
- Request/response times
- Memory hit rates
- Model performance trends
- Quality assessments

## Troubleshooting

### Common Issues

1. **Ollama Connection Failed**
   - Ensure Ollama is running: `curl http://localhost:11434`
   - Check OLLAMA_URL in .env

2. **Brain Not Available**
   - Server works without Brain but with limited memory
   - Check MCP_URL configuration

3. **High Memory Usage**
   - Adjust CACHE_MAX_SIZE
   - Implement cache cleanup

4. **Slow Enrichment**
   - Reduce SIMILARITY_LIMIT
   - Increase RELEVANCE_THRESHOLD

## Future Enhancements

- [ ] Vector database integration for semantic search
- [ ] Web UI for memory management
- [ ] Multi-user support with isolated memories
- [ ] Plugin system for custom enrichers
- [ ] Metrics dashboard
- [ ] Memory export/import
- [ ] A/B testing for enrichment strategies

## Contributing

This is a proof-of-concept for the MCP middleware pattern. Contributions welcome!

Key areas for contribution:
1. Better learning algorithms
2. More sophisticated context selection
3. Additional memory providers
4. Performance optimizations
5. Testing infrastructure

## License

MIT

---

Built with curiosity by MikeyBeez & Claude 🧠✨
