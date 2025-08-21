/**
 * elvis-integration.ts - Example of using Memory Server with ELVIS
 */

import { ELVIS } from 'mcp-elvis';
import axios from 'axios';

// Configuration
const MEMORY_SERVER_URL = 'http://localhost:8090';
const OLLAMA_DIRECT_URL = 'http://localhost:11434';

async function demonstrateMemoryServer() {
  console.log('🧠 MCP Memory Server Demo with ELVIS\n');
  
  // First, check if Memory Server is running
  try {
    const health = await axios.get(`${MEMORY_SERVER_URL}/health`);
    console.log('✅ Memory Server is healthy:', health.data);
  } catch (error) {
    console.error('❌ Memory Server is not running. Start it with: npm start');
    return;
  }
  
  // Initialize ELVIS with Memory Server
  const elvis = ELVIS.getInstance({
    ollamaUrl: MEMORY_SERVER_URL, // Point to Memory Server instead of Ollama
    dataDir: './elvis-data'
  });
  
  await elvis.initialize();
  console.log('✅ ELVIS initialized with Memory Server\n');
  
  // Example 1: First task - no memories yet
  console.log('📝 Task 1: Initial analysis (no memories)');
  const task1 = await elvis.delegateTask({
    title: 'Analyze Node.js performance optimization techniques',
    type: 'analysis',
    objective: 'Identify top 5 performance optimization techniques for Node.js applications',
    deliverables: [
      'List of optimization techniques',
      'Brief explanation of each',
      'Example use cases'
    ],
    context: 'Focus on server-side applications handling high traffic',
    priority: 'normal'
  });
  
  console.log(`✅ Task delegated: ${task1}`);
  console.log('⏳ Waiting for completion...\n');
  
  // Simulate checking status
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Example 2: Similar task - should use memories
  console.log('📝 Task 2: Related analysis (should use memories from Task 1)');
  const task2 = await elvis.delegateTask({
    title: 'Analyze Express.js performance best practices',
    type: 'analysis',
    objective: 'Best practices for optimizing Express.js applications',
    deliverables: [
      'Performance best practices',
      'Common pitfalls to avoid',
      'Benchmarking approaches'
    ],
    context: 'Building on Node.js optimization knowledge',
    priority: 'normal'
  });
  
  console.log(`✅ Task delegated: ${task2}`);
  
  // Check memory stats
  console.log('\n📊 Checking Memory Server statistics...');
  try {
    const stats = await axios.get(`${MEMORY_SERVER_URL}/api/memory/stats`);
    console.log('Memory Stats:', JSON.stringify(stats.data, null, 2));
  } catch (error) {
    console.log('Could not fetch stats');
  }
  
  // Search memories directly
  console.log('\n🔍 Searching memories for "performance"...');
  try {
    const searchResult = await axios.post(`${MEMORY_SERVER_URL}/api/memory/search`, {
      query: 'performance optimization',
      limit: 5
    });
    console.log(`Found ${searchResult.data.memories.length} relevant memories`);
    
    searchResult.data.memories.forEach((memory: any, index: number) => {
      console.log(`\nMemory ${index + 1}:`);
      console.log(`  Key: ${memory.key}`);
      console.log(`  Relevance: ${Math.round(memory.relevance * 100)}%`);
      console.log(`  Preview: ${JSON.stringify(memory.value).substring(0, 100)}...`);
    });
  } catch (error) {
    console.log('Could not search memories');
  }
  
  // Get model stats
  console.log('\n📈 Model Performance Stats:');
  try {
    const modelStats = await axios.get(`${MEMORY_SERVER_URL}/api/learning/model-stats/llama3.2`);
    console.log('llama3.2 stats:', JSON.stringify(modelStats.data, null, 2));
  } catch (error) {
    console.log('Could not fetch model stats');
  }
  
  // Get recent insights
  console.log('\n💡 Recent Insights:');
  try {
    const insights = await axios.get(`${MEMORY_SERVER_URL}/api/memory/insights?limit=5`);
    insights.data.insights.forEach((insight: any, index: number) => {
      console.log(`${index + 1}. ${insight.content}`);
      console.log(`   Confidence: ${Math.round(insight.confidence * 100)}%`);
      console.log(`   Tags: ${insight.tags.join(', ')}`);
    });
  } catch (error) {
    console.log('Could not fetch insights');
  }
  
  // Provide feedback on a task
  console.log('\n📮 Providing feedback on task quality...');
  try {
    await axios.post(`${MEMORY_SERVER_URL}/api/learning/feedback`, {
      taskId: task1,
      quality: 0.9,
      feedback: 'Excellent analysis with clear structure and practical examples'
    });
    console.log('✅ Feedback recorded');
  } catch (error) {
    console.log('Could not submit feedback');
  }
  
  // Shutdown
  console.log('\n👋 Demo complete. Shutting down ELVIS...');
  await elvis.shutdown();
}

// Comparison function to show the difference
async function compareWithAndWithoutMemory() {
  console.log('\n🔬 Comparing Ollama with and without Memory Server\n');
  
  const testPrompt = 'Explain the key concepts of functional programming in JavaScript';
  
  // Direct Ollama call
  console.log('1️⃣ Direct Ollama (no memory):');
  console.time('Direct Ollama');
  try {
    const directResponse = await axios.post(`${OLLAMA_DIRECT_URL}/api/generate`, {
      model: 'llama3.2',
      prompt: testPrompt,
      stream: false
    });
    console.log('Response length:', directResponse.data.response.length);
    console.log('Preview:', directResponse.data.response.substring(0, 200) + '...');
  } catch (error) {
    console.log('Direct Ollama failed:', error.message);
  }
  console.timeEnd('Direct Ollama');
  
  // Through Memory Server
  console.log('\n2️⃣ Through Memory Server (with context):');
  console.time('Memory Server');
  try {
    const memoryResponse = await axios.post(`${MEMORY_SERVER_URL}/api/generate`, {
      model: 'llama3.2',
      prompt: testPrompt,
      stream: false
    });
    console.log('Response length:', memoryResponse.data.response.length);
    console.log('Preview:', memoryResponse.data.response.substring(0, 200) + '...');
    
    // The response will be enriched with any relevant memories about functional programming
  } catch (error) {
    console.log('Memory Server failed:', error.message);
  }
  console.timeEnd('Memory Server');
}

// Run the demonstration
async function main() {
  try {
    await demonstrateMemoryServer();
    await compareWithAndWithoutMemory();
  } catch (error) {
    console.error('Demo error:', error);
  }
}

// Execute if run directly
if (require.main === module) {
  main();
}

export { demonstrateMemoryServer, compareWithAndWithoutMemory };
