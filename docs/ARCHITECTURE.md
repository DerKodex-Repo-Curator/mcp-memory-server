# MCP Memory Server Architecture

## Overview

The MCP Memory Server is a sophisticated middleware layer that sits between AI applications (like ELVIS) and Ollama, adding memory, learning, and intelligence capabilities to stateless LLM interactions.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Applications                       │
│                    (ELVIS, API Clients, etc.)                    │
└─────────────────────────────┬───────────────────────────────────┘
                              │ HTTP/HTTPS
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      MCP Memory Server                           │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Express Server                         │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │   │
│  │  │   Routes    │  │  Middleware  │  │  Plugin API   │  │   │
│  │  └─────────────┘  └──────────────┘  └───────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   Core Components                         │   │
│  │  ┌──────────────┐  ┌─────────────┐  ┌───────────────┐  │   │
│  │  │Context       │  │  Memory     │  │   Learning    │  │   │
│  │  │Enricher      │  │  Manager    │  │   Engine      │  │   │
│  │  └──────────────┘  └─────────────┘  └───────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                 Advanced Components                       │   │
│  │  ┌──────────────┐  ┌─────────────┐  ┌───────────────┐  │   │
│  │  │ Embedding    │  │Performance  │  │   Security    │  │   │
│  │  │ Manager      │  │ Optimizer   │  │   Manager     │  │   │
│  │  └──────────────┘  └─────────────┘  └───────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    External Clients                       │   │
│  │  ┌──────────────┐  ┌─────────────┐  ┌───────────────┐  │   │
│  │  │Brain Client  │  │Ollama Client│  │Plugin Manager │  │   │
│  │  └──────────────┘  └─────────────┘  └───────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────┬───────────────────────────────────┘
                              │
           ┌──────────────────┼──────────────────┐
           │                  │                  │
           ▼                  ▼                  ▼
    ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
    │    Brain    │   │   Ollama    │   │   Plugins   │
    │   Memory    │   │   Models    │   │  (Custom)   │
    └─────────────┘   └─────────────┘   └─────────────┘
```

## Component Details

### 1. Express Server Layer

**Purpose**: Handle HTTP requests and route them to appropriate handlers.

**Key Features**:
- Ollama-compatible API endpoints
- Additional memory management endpoints
- Plugin endpoint registration
- Request/response logging
- CORS and security headers

**Code Location**: `src/server.ts`

### 2. Context Enricher

**Purpose**: Automatically enhance prompts with relevant context before sending to Ollama.

**Process Flow**:
1. Extract keywords from prompt
2. Search for relevant memories
3. Find similar past tasks
4. Add model-specific guidance
5. Include recent insights
6. Respect token limits

**Key Algorithms**:
- TF-IDF-like keyword extraction
- Cosine similarity for relevance scoring
- Adaptive token management

**Code Location**: `src/ContextEnricher.ts`

### 3. Memory Manager

**Purpose**: Store, retrieve, and manage all forms of memory.

**Memory Types**:
- **Task Memories**: Complete records of past interactions
- **Model Context**: Performance statistics and best practices
- **Insights**: Learned patterns and successful approaches
- **Domain Knowledge**: Subject-specific information

**Storage**:
- In-memory cache with TTL
- Brain system for persistence
- Embeddings for semantic search

**Code Location**: `src/MemoryManager.ts`

### 4. Learning Engine

**Purpose**: Extract insights and learn from every interaction.

**Learning Process**:
1. Assess response quality
2. Identify approach used
3. Extract patterns
4. Update model statistics
5. Store insights

**Quality Metrics**:
- Response completeness
- Structure indicators
- Speed vs. expectations
- Pattern matching

**Code Location**: `src/LearningEngine.ts`

### 5. Embedding Manager

**Purpose**: Enable semantic search through vector embeddings.

**Features**:
- Generate embeddings via Ollama
- Vector similarity search
- Fallback to hash-based embeddings
- Batch operations

**Code Location**: `src/embeddings/EmbeddingManager.ts`

### 6. Performance Optimizer

**Purpose**: Dynamically optimize server performance.

**Adaptive Features**:
- Adjust context limits based on response times
- Monitor memory usage
- Track cache efficiency
- Provide recommendations

**Metrics Tracked**:
- Enrichment time
- Ollama response time
- Memory search time
- Cache hit rate

**Code Location**: `src/performance/PerformanceOptimizer.ts`

### 7. Security Manager

**Purpose**: Ensure safe and secure operation.

**Security Features**:
- Rate limiting per client
- Prompt length validation
- Pattern blocking (API keys, passwords)
- Model whitelisting
- Request sanitization

**Code Location**: `src/security/SecurityManager.ts`

### 8. Plugin Manager

**Purpose**: Enable extensibility through plugins.

**Plugin Capabilities**:
- Hook into request/response pipeline
- Add custom endpoints
- Modify enrichment process
- Access to all server components

**Available Hooks**:
- `beforeEnrichment`
- `afterEnrichment`
- `beforeOllama`
- `afterOllama`
- `beforeMemorySearch`
- `afterMemorySearch`

**Code Location**: `src/plugins/PluginManager.ts`

## Data Flow

### Request Processing Pipeline

```
1. Client Request
   ↓
2. Security Validation
   ↓
3. Plugin: beforeEnrichment
   ↓
4. Context Enrichment
   ├─ Memory Search
   ├─ Similar Tasks
   ├─ Model Context
   └─ Recent Insights
   ↓
5. Plugin: afterEnrichment
   ↓
6. Plugin: beforeOllama
   ↓
7. Ollama Processing
   ↓
8. Plugin: afterOllama
   ↓
9. Learning & Storage
   ├─ Quality Assessment
   ├─ Pattern Extraction
   ├─ Memory Storage
   └─ Embedding Generation
   ↓
10. Response to Client
```

## Memory Architecture

### Storage Layers

1. **Hot Cache** (NodeCache)
   - TTL-based eviction
   - Sub-millisecond access
   - Limited size

2. **Warm Storage** (In-memory Maps)
   - Task memories
   - Model statistics
   - Active embeddings

3. **Cold Storage** (Brain/Disk)
   - Persistent memories
   - Historical data
   - Backup embeddings

### Memory Types

```typescript
interface MemoryHierarchy {
  immediate: {
    cache: "Current request context",
    active: "Recent interactions"
  },
  short_term: {
    tasks: "Recent task outcomes",
    insights: "Fresh learnings"
  },
  long_term: {
    patterns: "Established patterns",
    knowledge: "Domain expertise"
  }
}
```

## Performance Characteristics

### Latency Breakdown

- Security check: ~1ms
- Memory search: 10-50ms (depending on cache)
- Context enrichment: 20-100ms
- Ollama call: 1-60s (model dependent)
- Learning: 10-30ms
- Total overhead: 50-200ms

### Scalability

- **Vertical**: Memory limited by heap size
- **Horizontal**: Stateless design enables clustering
- **Caching**: Reduces repeated computations
- **Adaptive**: Auto-adjusts based on load

## Security Model

### Defense Layers

1. **Rate Limiting**: Prevent abuse
2. **Input Validation**: Block malicious content
3. **Sanitization**: Remove sensitive data
4. **Authentication**: Plugin-based auth
5. **Logging**: Audit trail

### Threat Mitigation

- **Prompt Injection**: Pattern detection
- **Data Exfiltration**: Output filtering
- **DoS Attacks**: Rate limiting
- **Memory Exhaustion**: Size limits

## Extension Points

### Plugin Development

```javascript
export default {
  name: 'my-plugin',
  version: '1.0.0',
  
  async beforeEnrichment(request) {
    // Modify request
    return request;
  },
  
  endpoints: [{
    method: 'GET',
    path: '/api/my-endpoint',
    handler: async (req, res) => {
      // Custom logic
    }
  }]
}
```

### Custom Memory Providers

Implement the `MemoryProvider` interface:
- `search(query: string): Promise<Memory[]>`
- `store(memory: Memory): Promise<void>`
- `get(key: string): Promise<Memory>`

### Alternative Embeddings

Replace `EmbeddingManager` with:
- OpenAI embeddings
- Sentence transformers
- Custom models

## Best Practices

### Deployment

1. Use PM2 for process management
2. Enable clustering for high load
3. Configure Nginx for SSL/load balancing
4. Monitor with Prometheus/Grafana

### Configuration

1. Start with conservative limits
2. Enable adaptive optimization
3. Configure appropriate cache TTLs
4. Set security policies

### Development

1. Write plugins for custom logic
2. Use TypeScript for type safety
3. Add comprehensive logging
4. Write tests for critical paths

## Future Enhancements

### Planned Features

1. **Vector Database Integration**
   - Pinecone/Weaviate support
   - Improved semantic search
   - Scalable storage

2. **Multi-User Support**
   - User isolation
   - Personalized memories
   - Access control

3. **Advanced Learning**
   - Reinforcement learning
   - A/B testing
   - Automatic optimization

4. **Distributed Architecture**
   - Redis for shared state
   - Kafka for event streaming
   - Kubernetes deployment

### Research Areas

1. **Optimal Context Selection**
   - Information theory approaches
   - Attention mechanisms
   - Dynamic weighting

2. **Memory Consolidation**
   - Hierarchical summarization
   - Knowledge graphs
   - Temporal decay

3. **Cross-Model Learning**
   - Transfer learning
   - Model-agnostic patterns
   - Performance prediction

## Conclusion

The MCP Memory Server represents a new paradigm in AI system architecture - a stateful, learning middleware layer that makes AI models smarter over time. By separating memory and learning from the models themselves, we achieve:

1. **Portability**: Works with any Ollama-compatible model
2. **Persistence**: Memories survive model changes
3. **Performance**: Adaptive optimization
4. **Extensibility**: Plugin architecture
5. **Security**: Centralized control

This architecture serves as a blueprint for building intelligent middleware for any stateless system, not just LLMs.
