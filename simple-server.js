// Simple test server to verify the concept works
import express from 'express';
import axios from 'axios';

const app = express();
app.use(express.json());

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const PORT = process.env.PORT || 8090;

// Simple in-memory storage
const memories = new Map();
const modelStats = new Map();

// Initialize model stats
modelStats.set('llama3.2', { calls: 0, avgTime: 0, successRate: 1.0 });
modelStats.set('deepseek-r1', { calls: 0, avgTime: 0, successRate: 1.0 });

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Main generate endpoint - adds memory to prompts
app.post('/api/generate', async (req, res) => {
  const startTime = Date.now();
  const { model, prompt, ...options } = req.body;
  
  console.log(`📝 Received request for ${model}: ${prompt.substring(0, 50)}...`);
  
  // Search for relevant memories
  const relevantMemories = [];
  for (const [key, memory] of memories.entries()) {
    if (memory.prompt.toLowerCase().includes(prompt.toLowerCase().split(' ')[0])) {
      relevantMemories.push(memory);
    }
  }
  
  // Build enriched prompt
  let enrichedPrompt = '';
  
  if (relevantMemories.length > 0) {
    enrichedPrompt += '=== RELEVANT MEMORIES ===\n';
    relevantMemories.slice(0, 3).forEach((mem, i) => {
      enrichedPrompt += `Memory ${i+1}: ${mem.prompt.substring(0, 100)}...\n`;
      enrichedPrompt += `Response preview: ${mem.response.substring(0, 100)}...\n\n`;
    });
  }
  
  // Add model tips
  enrichedPrompt += '=== MODEL GUIDANCE ===\n';
  if (model.includes('deepseek')) {
    enrichedPrompt += 'You excel at deep analysis and step-by-step reasoning.\n';
  } else if (model.includes('llama')) {
    enrichedPrompt += 'You are efficient at quick analysis and code tasks.\n';
  }
  
  enrichedPrompt += '\n=== CURRENT TASK ===\n' + prompt;
  
  try {
    // Forward to Ollama
    console.log(`🚀 Forwarding to Ollama with ${relevantMemories.length} memories...`);
    const response = await axios.post(`${OLLAMA_URL}/api/generate`, {
      model,
      prompt: enrichedPrompt,
      ...options
    });
    
    const duration = Date.now() - startTime;
    
    // Store this interaction as a memory
    const memoryKey = `memory_${Date.now()}`;
    memories.set(memoryKey, {
      prompt,
      response: response.data.response,
      model,
      duration,
      timestamp: new Date().toISOString()
    });
    
    // Update model stats
    const stats = modelStats.get(model) || { calls: 0, avgTime: 0, successRate: 1.0 };
    stats.calls++;
    stats.avgTime = (stats.avgTime * (stats.calls - 1) + duration) / stats.calls;
    modelStats.set(model, stats);
    
    console.log(`✅ Completed in ${duration}ms. Total memories: ${memories.size}`);
    
    // Return the response in Ollama format
    res.json(response.data);
    
  } catch (error) {
    console.error('❌ Error calling Ollama:', error.message);
    res.status(500).json({ error: 'Failed to generate response' });
  }
});

// List models (proxy to Ollama)
app.get('/api/tags', async (req, res) => {
  try {
    const response = await axios.get(`${OLLAMA_URL}/api/tags`);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to list models' });
  }
});

// Memory stats endpoint
app.get('/api/memory/stats', (req, res) => {
  res.json({
    totalMemories: memories.size,
    modelStats: Array.from(modelStats.entries()).map(([model, stats]) => ({
      model,
      ...stats
    }))
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🧠 Memory Server (Simple) running on port ${PORT}`);
  console.log(`📡 Proxying to Ollama at ${OLLAMA_URL}`);
  console.log(`\n✨ Features:`);
  console.log(`   - Automatic memory of past interactions`);
  console.log(`   - Enriches prompts with relevant context`);
  console.log(`   - Tracks model performance stats`);
  console.log(`\n🔌 To use with ELVIS:`);
  console.log(`   Set ollamaUrl: 'http://localhost:${PORT}'`);
});
