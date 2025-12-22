import browser from "webextension-polyfill";
import { StorageManager } from './lib/storage';
import { PromptBuilder } from './lib/prompt-builder';
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
    this.providers.clear();

    // 2025 Model Initialization via OpenRouter
    const grokProvider = new OpenRouterProvider('x-ai/grok-code-fast-1', 'Grok Code Fast 1');
    const geminiProvider = new OpenRouterProvider('google/gemini-2.5-flash', 'Gemini 2.5 Flash');
    const openaiProvider = new OpenRouterProvider('openai/gpt-oss-120b', 'GPT-OSS 120B');
    const claudeProvider = new OpenRouterProvider('anthropic/claude-sonnet-4.5', 'Claude Sonnet 4.5');

    // Register Providers ensuring exact ID matches
    this.providers.set('x-ai/grok-code-fast-1', grokProvider);
    this.providers.set('google/gemini-2.5-flash', geminiProvider);
    this.providers.set('openai/gpt-oss-120b', openaiProvider);
    this.providers.set('anthropic/claude-sonnet-4.5', claudeProvider);

    console.log('🤖 AI Providers Initialized:', Array.from(this.providers.keys()));
  }

  private ensureProviders() {
    if (this.providers.size === 0) {
      console.warn('⚠️ Providers map empty, re-initializing...');
      this.initializeProviders();
    }
  }

  public async handleGenerateReply(
    data: {
      postText: string;
      style: string;
      prompt: string;
      model?: string;
      tone?: any;
      strategy?: string;
      customExamples?: string;
      images?: string[];
      options?: { useKaomoji?: boolean; isSelfPost?: boolean };
    }
  ): Promise<any> {
    try {
      this.ensureProviders();

      // 使用指定的模型，如果沒有指定則默認使用 Gemini
      let modelId = data.model;
      if (!modelId) {
        modelId = await StorageManager.getSelectedModel();
      }

      let targetModelId = modelId;

      // Vision Support Logic for Non-Vision Models (Grok Fallback)
      if (modelId === 'x-ai/grok-code-fast-1' && data.images && data.images.length > 0) {
        console.log(`[Vision] Grok does not support vision. Switching to Gemini 2.5 Flash.`);
        targetModelId = 'google/gemini-2.5-flash';
      }

      const provider = this.providers.get(targetModelId);
      var activeProvider = provider;

      if (!activeProvider) {
        console.error('❌ 未找到模型提供者:', targetModelId, 'Available:', Array.from(this.providers.keys()));
        // Fallback to Grok if specific target not found, or any first available
        const fallback = this.providers.get('x-ai/grok-code-fast-1') || this.providers.values().next().value;
        if (fallback) {
          console.warn('⚠️ Falling back to default provider:', fallback.config.id);
          activeProvider = fallback;
        } else {
          return {
            success: false,
            error: `不支持的 AI 模型 (ID: ${targetModelId})`,
            debugInfo: `Available: ${Array.from(this.providers.keys()).join(', ')}`
          };
        }
      }

      console.log('🤖 使用 AI 模型:', activeProvider.config.name);

      // 獲取對應支出的 API Key (使用原始 modelId 來查找 Key，或者 targetModelId?)
      // Should use targetModelId's key if we switched providers?
      // Actually usually OpenRouter key covers all.
      // But getApiKeyForModel might check specific legacy keys.
      // Let's use targetModelId for key lookup to be safe.
      const apiKey = await this.getApiKeyForModel(activeProvider.config.id);

      if (!apiKey) {
        const modelName = activeProvider.config.name;
        return {
          success: false,
          error: `請先設定 ${modelName} 的 API Key`,
          debugInfo: `模型 ${modelName} 需要 API Key，請前往設定頁面配置`
        };
      }

      // Use PromptBuilder to construct the sophisticated prompt
      const finalPrompt = PromptBuilder.buildReplyPrompt(
        data.postText,
        data.tone || null,
        data.style,
        {
          useKaomoji: data.options?.useKaomoji || false,
          isSelfPost: data.options?.isSelfPost || false,
          strategy: data.strategy || undefined,
          customExamples: data.customExamples || undefined
        }
      );

      console.log('📝 Prompt Constructed:', finalPrompt.substring(0, 100) + '...');

      // 使用提供者生成回覆
      const result = await activeProvider.generateReply({
        // postText is included in stylePrompt by PromptBuilder
        stylePrompt: finalPrompt,
        postText: "",
        apiKey: apiKey,
        images: data.images
      });

      if (result.success) {
        console.log('✅ 回覆生成成功，模型:', activeProvider.config.name);

        // **Control Token & Hallucination Cleaning**
        let rawReply = result.reply || '';

        // 1. Remove LLM internal control tokens & HTML comments
        let cleanReply = rawReply.replace(/<\|.*?\|>/g, '')
          .replace(/<!--[\s\S]*?-->/g, '');

        // 2. Remove Hallucinated Multilingual Garbage (Cyrillic, Arabic, etc.)
        // Grok sometimes spits out random Russian/Persian/English noise at the end.
        // We aggressively strip characters that shouldn't be in a Traditional Chinese/English/Kaomoji reply.
        // Stripping Cyrillic (Russian) and Arabic script ranges.
        cleanReply = cleanReply.replace(/[\u0400-\u04FF\u0600-\u06FF]+/g, '');

        // 3. Trim whitespace
        cleanReply = cleanReply.trim();

        return { success: true, reply: cleanReply };
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

  /**
   * Handles the ANALYZE_POST request.
   * Calls the AI to determine the best reply style for the given post.
   * Returns the raw analysis text (STYLE: ..., REASON: ...).
   */
  async handleAnalyzePost(data: { postText: string; stylesList: string; model?: string }): Promise<any> {
    try {
      this.ensureProviders();

      let modelId = data.model;
      if (!modelId) {
        modelId = await StorageManager.getSelectedModel();
      }
      const provider = this.providers.get(modelId);

      if (!provider) {
        console.error('❌ (Analyze) 未找到模型提供者:', modelId);
        return { success: false, error: `不支持的 AI 模型: ${modelId} (Analyze)` };
      }

      const apiKey = await this.getApiKeyForModel(modelId);
      if (!apiKey) {
        return { success: false, error: `請先設定 ${provider.config.name} 的 API Key` };
      }

      // Analysis-only prompt
      const analysisPrompt = `你是 Threads 社群專家。請閱讀以下貼文，並從「可用風格列表」中選擇 **最適合** 的一種回覆風格。

【貼文內容】：
${data.postText}

【可用風格列表】：
${data.stylesList}

【輸出格式（嚴格遵守）】：
STYLE: [風格名稱]
STRATEGY: [一句話回覆策略，例如：先同理對方的困擾，再提出具體的建議]
REASON: [選擇此風格的簡短理由，10字以內]

**只輸出上述三行，不要輸出其他任何內容。**`;

      console.log('🔍 Analysis Prompt Constructed');

      const result = await provider.generateReply({
        stylePrompt: analysisPrompt,
        postText: "",
        apiKey: apiKey
      });

      if (result.success) {
        console.log('✅ 分析成功');
        return { success: true, analysis: result.reply?.trim() || '' };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('❌ 分析貼文時發生錯誤:', error);
      return { success: false, error: '分析貼文時發生錯誤' };
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

  if (request.type === 'ANALYZE_POST') {
    return backgroundService.handleAnalyzePost(request.data);
  }

  return undefined;
});
