import browser from "webextension-polyfill";
import { StorageManager } from './lib/storage';

import { OpenRouterProvider } from './lib/providers/openrouter';
import type { AIModelProvider } from './lib/providers/base';

console.log("Hello from the background!");

// 硬編碼驗證碼 (在實際部署時可以通過其他方式配置)
// 硬編碼驗證碼 (已移除驗證功能)
// const VERIFICATION_CODE = "250912";

browser.runtime.onInstalled.addListener((details) => {
  console.log("Extension installed:", details);
  if (details.reason === 'install') {
    browser.runtime.openOptionsPage();
  }
});

class BackgroundService {
  private providers: Map<string, AIModelProvider> = new Map();

  constructor() {
    this.initializeProviders();
  }

  private initializeProviders() {
    // 2025 Model Initialization via OpenRouter
    const grokProvider = new OpenRouterProvider('x-ai/grok-code-fast-1', 'Grok Code Fast 1');
    const geminiProvider = new OpenRouterProvider('google/gemini-3-flash', 'Google Gemini 3 Flash');
    const openaiProvider = new OpenRouterProvider('openai/gpt-5.2', 'OpenAI GPT-5.2');
    const claudeProvider = new OpenRouterProvider('anthropic/claude-sonnet-4.5', 'Claude Sonnet 4.5');

    // Register Providers
    this.providers.set(grokProvider.config.id, grokProvider);
    this.providers.set(geminiProvider.config.id, geminiProvider);
    this.providers.set(openaiProvider.config.id, openaiProvider);
    this.providers.set(claudeProvider.config.id, claudeProvider);

    console.log('🤖 AI 模型提供者已更新 (2025):', Array.from(this.providers.keys()));
  }

  public async handleGenerateReply(
    data: { postText: string; style: string; prompt: string; model?: string; tonePrompt?: string }
  ): Promise<any> {
    try {
      // 使用指定的模型，如果沒有指定則默認使用 Gemini
      let modelId = data.model;
      if (!modelId) {
        modelId = await StorageManager.getSelectedModel();
      }

      const provider = this.providers.get(modelId);

      if (!provider) {
        console.error('❌ 未找到模型提供者:', modelId);
        return {
          success: false,
          error: `不支持的 AI 模型: ${modelId}`,
          debugInfo: `可用模型: ${Array.from(this.providers.keys()).join(', ')}`
        };
      }

      console.log('🤖 使用 AI 模型:', provider.config.name);

      // 獲取對應的 API Key
      const apiKey = await this.getApiKeyForModel(modelId);

      if (!apiKey) {
        const modelName = provider.config.name;
        return {
          success: false,
          error: `請先設定 ${modelName} 的 API Key`,
          debugInfo: `模型 ${modelName} 需要 API Key，請前往設定頁面配置`
        };
      }

      // Combine Style and Tone Prompts
      let finalPrompt = data.prompt;
      if (data.tonePrompt) {
        finalPrompt = `${data.tonePrompt}\n\n${finalPrompt}`;
      }

      // 使用提供者生成回覆
      const result = await provider.generateReply({
        postText: data.postText,
        stylePrompt: finalPrompt,
        apiKey: apiKey
      });

      if (result.success) {
        console.log('✅ 回覆生成成功，模型:', provider.config.name);
        return { success: true, reply: result.reply };
      } else {
        console.error('❌ 回覆生成失敗:', result.error);
        return {
          success: false,
          error: result.error,
          debugInfo: result.debugInfo
        };
      }

    } catch (error) {
      console.error('❌ 處理生成回覆請求時發生錯誤:', error);
      let errorMessage = '生成回覆時發生錯誤';
      let debugInfo = '';

      if (error instanceof Error) {
        debugInfo = error.message;

        if (error.message.includes('API_KEY_INVALID') || error.message.includes('invalid_api_key')) {
          errorMessage = 'API Key 無效，請檢查設定';
        } else if (error.message.includes('QUOTA_EXCEEDED') || error.message.includes('insufficient_quota')) {
          errorMessage = 'API 使用額度已超限';
        } else if (error.message.includes('NETWORK_ERROR')) {
          errorMessage = '網路連接錯誤，請稍後再試';
        } else if (error.message.includes('rate_limit_exceeded')) {
          errorMessage = 'API 請求頻率超限，請稍後再試';
        }
      }

      return {
        success: false,
        error: errorMessage,
        debugInfo: debugInfo
      };
    }
  }

  public async getApiKeyForModel(modelId: string): Promise<string | null> {
    const keys = await StorageManager.getApiKeys();
    try {
      // Legacy Check (Optional: keep if you want strict separation, but simplified for 2025 update)
      if (modelId === 'gemini-1.5-flash') return keys.geminiApiKey || null;
      if (modelId === 'gpt-4o') return keys.openaiApiKey || null;
      if (modelId === 'claude-3-haiku') return keys.claudeApiKey || null;

      // Default: All other models (including new 2025 ones) go through OpenRouter
      return keys.openrouterApiKey || null;
    } catch (error) {
      console.error('❌ 獲取 API Key 失敗:', error);
      return null;
    }
  }

  public async handleApiKeyStatus(): Promise<any> {
    try {
      const keys = await StorageManager.getApiKeys();
      const hasGemini = !!keys.geminiApiKey;

      return {
        hasApiKey: hasGemini, // 保持向後兼容
        apiKeys: {
          gemini: hasGemini,
          openai: !!keys.openaiApiKey,
          claude: !!keys.claudeApiKey,
          openrouter: !!keys.openrouterApiKey
        }
      };
    } catch (error) {
      console.error('❌ 檢查 API Key 狀態失敗:', error);
      return {
        hasApiKey: false,
        apiKeys: {
          gemini: false,
          openai: false,
          claude: false,
          openrouter: false
        }
      };
    }
  }
}

const backgroundService = new BackgroundService();

// 處理來自 content script 的訊息
browser.runtime.onMessage.addListener((request: any, _sender, _sendResponse) => {
  // Handle existing verification logic
  if (request.action === 'verifyCode') {
    return Promise.resolve({ success: false }); // Deprecated
  }


  // Handle AI logic
  if (request.type === 'GENERATE_REPLY') {
    return backgroundService.handleGenerateReply(request.data);
  }

  if (request.type === 'API_KEY_STATUS') {
    return backgroundService.handleApiKeyStatus();
  }

  if (request.type === 'OPEN_OPTIONS') {
    browser.runtime.openOptionsPage();
    return Promise.resolve();
  }

  return undefined;
});
