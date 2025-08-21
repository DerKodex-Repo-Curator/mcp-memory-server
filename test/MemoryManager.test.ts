import { MemoryManager } from '../src/MemoryManager';
import { createMockBrainClient } from '../src/clients/BrainClient';

describe('MemoryManager', () => {
  let memoryManager: MemoryManager;
  
  beforeEach(() => {
    const mockBrain = createMockBrainClient();
    memoryManager = new MemoryManager(mockBrain, 60);
  });
  
  it('should search memories', async () => {
    const memories = await memoryManager.searchMemories('test query', 5);
    expect(Array.isArray(memories)).toBe(true);
  });
  
  it('should get model context', () => {
    const context = memoryManager.getModelContext('deepseek-r1');
    assert.strictEqual(context.model, 'deepseek-r1');
    assert.ok(context.strengths.includes('deep analysis'));
  });
  
  it('should find similar tasks', async () => {
    const tasks = await memoryManager.findSimilarTasks('analyze code', 'llama3.2', 3);
    expect(Array.isArray(tasks)).toBe(true);
  });
});
