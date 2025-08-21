/**
 * OllamaClient.ts - Client for interacting with Ollama API
 */

import axios, { AxiosInstance } from 'axios';
import { OllamaRequest, OllamaResponse } from '../types.js';

export class OllamaClient {
  private axios: AxiosInstance;
  private baseUrl: string;
  
  constructor(baseUrl: string = 'http://localhost:11434') {
    this.baseUrl = baseUrl;
    this.axios = axios.create({
      baseURL: baseUrl,
      timeout: 300000, // 5 minutes timeout for long responses
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
  
  /**
   * Generate a response from Ollama
   */
  async generate(request: OllamaRequest): Promise<OllamaResponse> {
    try {
      const response = await this.axios.post('/api/generate', request);
      return response.data;
    } catch (error) {
      console.error('Error calling Ollama:', error);
      throw error;
    }
  }
  
  /**
   * Stream a response from Ollama
   */
  async *generateStream(request: OllamaRequest): AsyncGenerator<OllamaResponse> {
    try {
      const response = await this.axios.post('/api/generate', {
        ...request,
        stream: true
      }, {
        responseType: 'stream'
      });
      
      for await (const chunk of response.data) {
        const line = chunk.toString();
        try {
          const parsed = JSON.parse(line);
          yield parsed;
        } catch (e) {
          // Skip invalid JSON lines
        }
      }
    } catch (error) {
      console.error('Error streaming from Ollama:', error);
      throw error;
    }
  }
  
  /**
   * List available models
   */
  async listModels(): Promise<string[]> {
    try {
      const response = await this.axios.get('/api/tags');
      return response.data.models?.map((m: any) => m.name) || [];
    } catch (error) {
      console.error('Error listing models:', error);
      return [];
    }
  }
  
  /**
   * Check if Ollama is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      await this.axios.get('/');
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Pull a model
   */
  async pullModel(model: string): Promise<void> {
    try {
      await this.axios.post('/api/pull', { name: model });
    } catch (error) {
      console.error('Error pulling model:', error);
      throw error;
    }
  }
}
