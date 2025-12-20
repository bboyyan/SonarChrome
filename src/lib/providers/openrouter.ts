import { AIModelProvider, type AIModelConfig, type GenerateReplyRequest, type GenerateReplyResponse } from './base';

export class OpenRouterProvider extends AIModelProvider {
    readonly config: AIModelConfig;

    constructor(modelId: string = 'google/gemini-2.0-flash-exp:free', name: string = 'OpenRouter (Gemini 2.0 Flash)') {
        super();
        this.config = {
            id: modelId,
            name: name,
            description: `透過 OpenRouter 使用 ${name}`,
            provider: 'openrouter',
            isFree: modelId.includes(':free'),
            requiresApiKey: true
        };
    }

    private readonly API_URL = 'https://openrouter.ai/api/v1/chat/completions';

    async generateReply(request: GenerateReplyRequest): Promise<GenerateReplyResponse> {
        try {
            const prompt = this.formatPrompt(request.postText, request.stylePrompt);

            const response = await fetch(this.API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${request.apiKey}`,
                    'HTTP-Referer': 'https://github.com/SR0725/threads-helper', // 替換為實際的專案 URL
                    'X-Title': 'Threads Viral Detector'
                },
                body: JSON.stringify({
                    model: this.config.id,
                    messages: [
                        {
                            role: 'user',
                            content: prompt
                        }
                    ]
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('OpenRouter API error:', response.status, errorData);

                let errorMessage = `API 請求失敗 (${response.status})`;
                if (response.status === 401) errorMessage = 'API Key 無效';
                if (response.status === 402) errorMessage = '餘額不足';
                if (errorData.error?.message) errorMessage += `: ${errorData.error.message}`;

                return {
                    success: false,
                    error: errorMessage,
                    debugInfo: JSON.stringify(errorData)
                };
            }

            const data = await response.json();

            if (data.choices && data.choices.length > 0 && data.choices[0].message) {
                const reply = this.cleanupReply(data.choices[0].message.content);
                return {
                    success: true,
                    reply
                };
            } else {
                return {
                    success: false,
                    error: 'API 回傳格式錯誤',
                    debugInfo: JSON.stringify(data)
                };
            }

        } catch (error) {
            console.error('OpenRouter request failed:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : '網路請求失敗',
                debugInfo: String(error)
            };
        }
    }
}
