#!/usr/bin/env node

/**
 * memory-cli.js - CLI tool for MCP Memory Server management
 */

const { program } = require('commander');
const axios = require('axios');
const chalk = require('chalk');
const Table = require('cli-table3');

const API_BASE = process.env.MEMORY_SERVER_URL || 'http://localhost:8090';

// Helper function to handle API errors
async function apiCall(method, endpoint, data = null) {
  try {
    const config = {
      method,
      url: `${API_BASE}${endpoint}`,
      headers: { 'Content-Type': 'application/json' }
    };
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error(chalk.red(`API Error: ${error.response.status} - ${error.response.statusText}`));
    } else if (error.request) {
      console.error(chalk.red('Error: Cannot connect to Memory Server'));
      console.error(chalk.yellow(`Make sure the server is running at ${API_BASE}`));
    } else {
      console.error(chalk.red(`Error: ${error.message}`));
    }
    process.exit(1);
  }
}

// Command: status
async function showStatus() {
  console.log(chalk.cyan('🧠 Memory Server Status\n'));
  
  // Check health
  const health = await apiCall('GET', '/health');
  console.log(chalk.green('✓ Server Status:'), 'Healthy');
  console.log(chalk.gray('  Timestamp:'), health.timestamp);
  
  // Get stats
  const stats = await apiCall('GET', '/api/memory/stats');
  console.log(chalk.green('\n✓ Statistics:'));
  console.log('  Total Memories:', stats.totalMemories || 0);
  console.log('  Recent Tasks:', stats.recentTasks || 0);
  
  // Model stats table
  if (stats.modelStats && stats.modelStats.length > 0) {
    console.log(chalk.cyan('\n📊 Model Performance:\n'));
    
    const table = new Table({
      head: ['Model', 'Success Rate', 'Avg Time', 'Strengths'],
      colWidths: [15, 15, 12, 40]
    });
    
    stats.modelStats.forEach(([model, modelStats]) => {
      table.push([
        model,
        `${Math.round(modelStats.successRate * 100)}%`,
        `${Math.round(modelStats.avgResponseTime / 60000)}m`,
        modelStats.strengths.slice(0, 2).join(', ')
      ]);
    });
    
    console.log(table.toString());
  }
}

// Command: search
async function searchMemories(query, options) {
  console.log(chalk.cyan(`🔍 Searching for: "${query}"\n`));
  
  const result = await apiCall('POST', '/api/memory/search', {
    query,
    limit: parseInt(options.limit) || 10
  });
  
  if (result.memories.length === 0) {
    console.log(chalk.yellow('No memories found'));
    return;
  }
  
  console.log(chalk.green(`Found ${result.memories.length} memories:\n`));
  
  result.memories.forEach((memory, index) => {
    console.log(chalk.cyan(`${index + 1}. ${memory.key}`));
    console.log(chalk.gray(`   Relevance: ${Math.round(memory.relevance * 100)}%`));
    console.log(`   Value: ${JSON.stringify(memory.value).substring(0, 100)}...`);
    console.log();
  });
}

// Command: insights
async function showInsights(options) {
  console.log(chalk.cyan('💡 Recent Insights\n'));
  
  const result = await apiCall('GET', `/api/memory/insights?limit=${options.limit || 10}`);
  
  if (result.insights.length === 0) {
    console.log(chalk.yellow('No insights available yet'));
    return;
  }
  
  result.insights.forEach((insight, index) => {
    console.log(chalk.cyan(`${index + 1}. ${insight.content}`));
    console.log(chalk.gray(`   Confidence: ${Math.round(insight.confidence * 100)}%`));
    console.log(chalk.gray(`   Tags: ${insight.tags.join(', ')}`));
    console.log(chalk.gray(`   Time: ${new Date(insight.timestamp).toLocaleString()}`));
    console.log();
  });
}

// Command: test
async function testEnrichment(prompt, model) {
  console.log(chalk.cyan('🧪 Testing Prompt Enrichment\n'));
  console.log(chalk.gray('Original prompt:'), prompt);
  console.log(chalk.gray('Model:'), model);
  console.log();
  
  // Make a dry-run request to see enrichment
  console.log(chalk.yellow('Enriching prompt...'));
  
  const startTime = Date.now();
  const result = await apiCall('POST', '/api/generate', {
    model: model || 'llama3.2',
    prompt,
    stream: false,
    options: {
      num_predict: 1  // Just get one token to see enrichment
    }
  });
  
  const duration = Date.now() - startTime;
  
  console.log(chalk.green(`\n✓ Enrichment completed in ${duration}ms`));
  console.log('\nNote: Full enriched prompt is sent to Ollama but not returned in API response.');
  console.log('Check server logs for detailed enrichment information.');
}

// Command: feedback
async function submitFeedback(taskId, quality, feedback) {
  console.log(chalk.cyan('📮 Submitting Feedback\n'));
  
  await apiCall('POST', '/api/learning/feedback', {
    taskId,
    quality: parseFloat(quality),
    feedback
  });
  
  console.log(chalk.green('✓ Feedback submitted successfully'));
  console.log(chalk.gray(`  Task ID: ${taskId}`));
  console.log(chalk.gray(`  Quality: ${quality}/1.0`));
  console.log(chalk.gray(`  Feedback: ${feedback}`));
}

// Command: model-stats
async function showModelStats(model) {
  console.log(chalk.cyan(`📈 Stats for model: ${model}\n`));
  
  const stats = await apiCall('GET', `/api/learning/model-stats/${model}`);
  
  console.log(chalk.green('Performance Metrics:'));
  console.log(`  Success Rate: ${Math.round(stats.successRate * 100)}%`);
  console.log(`  Avg Response Time: ${Math.round(stats.avgResponseTime / 60000)} minutes`);
  
  console.log(chalk.green('\nStrengths:'));
  stats.strengths.forEach(s => console.log(`  • ${s}`));
  
  console.log(chalk.green('\nWeaknesses:'));
  stats.weaknesses.forEach(w => console.log(`  • ${w}`));
  
  console.log(chalk.green('\nBest Practices:'));
  stats.bestPractices.forEach(bp => console.log(`  • ${bp}`));
  
  if (stats.tips.length > 0) {
    console.log(chalk.green('\nTips:'));
    stats.tips.forEach(tip => console.log(`  • ${tip}`));
  }
}

// Set up CLI
program
  .name('memory-cli')
  .description('CLI tool for MCP Memory Server management')
  .version('1.0.0');

program
  .command('status')
  .description('Show server status and statistics')
  .action(showStatus);

program
  .command('search <query>')
  .description('Search memories')
  .option('-l, --limit <number>', 'Maximum results', '10')
  .action(searchMemories);

program
  .command('insights')
  .description('Show recent insights')
  .option('-l, --limit <number>', 'Maximum results', '10')
  .action(showInsights);

program
  .command('test <prompt> [model]')
  .description('Test prompt enrichment')
  .action(testEnrichment);

program
  .command('feedback <taskId> <quality> <feedback>')
  .description('Submit feedback for a task (quality: 0-1)')
  .action(submitFeedback);

program
  .command('model-stats <model>')
  .description('Show statistics for a specific model')
  .action(showModelStats);

// Parse arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
