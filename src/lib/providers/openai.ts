
import { AIModelProvider, AIModelConfig, GenerateReplyRequest, GenerateReplyResponse } from './base';

interface OpenAIMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

interface OpenAIRequest {
    model: string;
    messages: OpenAIMessage[];
    max_tokens: number;
    temperature: number;
    top_p: number;
    frequency_penalty: number;
    presence_penalty: number;
}

interface OpenAIResponse {
    choices?: Array<{
        message?: {
            content?: string;
        };
        finish_reason?: string;
    }>;
    error?: {
        message: string;
        type: string;
        code?: string;
    };
    usage?: {
        total_tokens: number;
    };
}

export class OpenAIProvider extends AIModelProvider {
    readonly config: AIModelConfig = {
        id: 'gpt-4o',
        name: 'OpenAI GPT-4o',
        description: '最新的 GPT-4 模型，智能程度高，適合複雜對話',
        provider: 'OpenAI',
        isFree: false,
        requiresApiKey: true
    };

    private readonly apiUrl = 'https://api.openai.com/v1/chat/completions';

    async generateReply(request: GenerateReplyRequest): Promise<GenerateReplyResponse> {
        console.log('🚀 開始 OpenAI 回覆生成請求');

        try {
            // 驗證 API Key
            if (!request.apiKey || !request.apiKey.startsWith('sk-') || request.apiKey.length < 20) {
                console.log('❌ OpenAI API Key 格式不正確');
                return {
                    success: false,
                    error: 'OpenAI API Key 格式不正確，請檢查設定'
                };
            }

            // 測試網路連接
            const networkTest = await this.testNetworkConnection();
            if (!networkTest.success) {
                console.log('❌ 網路連接測試失敗:', networkTest.error);
                return {
                    success: false,
                    error: `網路連接問題: ${networkTest.error}`
                };
            }

            const reply = await this.callOpenAIAPI(request.postText, request.stylePrompt, request.apiKey);
            console.log('✅ OpenAI 回覆生成成功');
            return {
                success: true,
                reply
            };

        } catch (error) {
            console.error('❌ OpenAI 生成回覆錯誤:', error);
            return this.handleError(error);
        }
    }

    private async callOpenAIAPI(postText: string, stylePrompt: string, apiKey: string): Promise<string> {
        const prompt = this.formatPrompt(postText, stylePrompt);

        const requestBody: OpenAIRequest = {
            model: 'gpt-4o',
            messages: [
                {
                    role: 'system',
                    content: '你是一個專業的社群媒體回覆助手，專門為 Threads 平台生成合適的回覆。請根據用戶提供的風格指示和貼文內容，生成一個簡潔、相關且符合指定風格的回覆。'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            max_tokens: 200,
            temperature: 0.7,
            top_p: 0.95,
            frequency_penalty: 0.0,
            presence_penalty: 0.0
        };

        console.log('📡 發送 OpenAI API 請求');

        // 重試機制
        let lastError: Error | null = null;
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                console.log(`🔄 第 ${attempt} 次嘗試...`);

                const controller = new AbortController();
                const timeoutId = setTimeout(() => {
                    console.log('⚠️ 請求超時，中斷連接');
                    controller.abort();
                }, 30000);

                const response = await fetch(this.apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`,
                        'User-Agent': 'ThreadsAI/1.0'
                    },
                    body: JSON.stringify(requestBody),
                    signal: controller.signal
                });

                clearTimeout(timeoutId);
                console.log('📨 收到 OpenAI 回應，狀態碼:', response.status);

                if (!response.ok) {
                    let errorText = '';
                    try {
                        errorText = await response.text();
                        console.log('❌ OpenAI API 錯誤回應:', errorText);
                    } catch {
                        console.log('❌ 無法讀取錯誤回應內容');
                    }
                    throw this.createHttpError(response.status, errorText);
                }

                const data: OpenAIResponse = await response.json();
                console.log('📄 解析 OpenAI JSON 回應');

                if (data.error) {
                    console.log('❌ OpenAI API 返回錯誤:', data.error);
                    throw new Error(`OpenAI API 錯誤: ${data.error.message}`);
                }

                return this.extractReplyFromResponse(data);

            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                console.log(`❌ 第 ${attempt} 次嘗試失敗:`, lastError.message);

                // 如果是 API Key 或配額問題，不重試
                if (lastError.message.includes('invalid_api_key') ||
                    lastError.message.includes('insufficient_quota') ||
                    lastError.message.includes('rate_limit_exceeded')) {
                    console.log('⛔ API Key 或配額問題，不重試');
                    throw lastError;
                }

                if (attempt < 3) {
                    const delay = attempt * 2000;
                    console.log(`⏳ 等待 ${delay}ms 後重試...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        throw lastError || new Error('未知錯誤');
    }

    private extractReplyFromResponse(data: OpenAIResponse): string {
        if (!data.choices || data.choices.length === 0) {
            console.log('❌ 沒有候選回應');
            throw new Error('沒有收到有效的回覆，請嘗試修改貼文內容');
        }

        const choice = data.choices[0];
        console.log('📄 候選回應:', JSON.stringify(choice, null, 2));

        if (choice.finish_reason && choice.finish_reason !== 'stop') {
            console.log('⚠️ 回應被阻止:', choice.finish_reason);
            if (choice.finish_reason === 'content_filter') {
                throw new Error('內容被安全過濾器阻止，請嘗試修改貼文內容');
            }
            if (choice.finish_reason === 'length') {
                throw new Error('回覆過長被截斷，請嘗試簡化貼文內容');
            }
        }

        // 提取文字內容
        const text = choice.message?.content;
        if (text && typeof text === 'string' && text.trim()) {
            console.log('✅ 成功獲取生成文字:', text.substring(0, 100) + '...');
            return this.cleanupReply(text);
        }

        console.log('❌ 回覆格式異常 - 完整候選回應:', JSON.stringify(choice, null, 2));
        throw new Error('未知的回覆格式，請聯繫開發者');
    }

    private createHttpError(status: number, errorText: string): Error {
        switch (status) {
            case 400:
                if (errorText.includes('invalid_api_key')) {
                    return new Error('invalid_api_key');
                }
                return new Error(`請求參數錯誤 (400): ${errorText}`);
            case 401:
                return new Error('invalid_api_key');
            case 403:
                if (errorText.includes('insufficient_quota')) {
                    return new Error('insufficient_quota');
                }
                return new Error('API 訪問被拒絕，請檢查 API Key 權限');
            case 429:
                return new Error('rate_limit_exceeded');
            case 500:
            case 502:
            case 503:
            case 504:
                return new Error(`NETWORK_ERROR: OpenAI API 伺服器錯誤 (${status})`);
            default:
                return new Error(`API 請求失敗: ${status}`);
        }
    }

    private handleError(error: unknown): GenerateReplyResponse {
        let errorMessage = '生成回覆時發生錯誤';
        let debugInfo = '';

        if (error instanceof Error) {
            console.log('錯誤詳情:', error.message);
            debugInfo = error.message;

            if (error.message.includes('invalid_api_key')) {
                errorMessage = 'OpenAI API Key 無效，請前往設定頁面檢查';
            } else if (error.message.includes('insufficient_quota')) {
                errorMessage = 'OpenAI API 使用額度不足，請檢查帳戶餘額';
            } else if (error.message.includes('rate_limit_exceeded')) {
                errorMessage = 'OpenAI API 請求頻率超限，請稍後再試';
            } else if (error.message.includes('NETWORK_ERROR')) {
                errorMessage = '網路連接錯誤，請檢查網路連線';
            } else if (error.message.includes('Failed to fetch')) {
                errorMessage = '無法連接到 OpenAI API，請檢查網路連線';
            } else if (error.message.includes('請求超時')) {
                errorMessage = 'API 請求超時，請檢查網路速度或稍後再試';
            } else if (error.message.includes('aborted')) {
                errorMessage = '請求被中斷，請稍後再試';
            }
        }

        return {
            success: false,
            error: errorMessage,
            debugInfo
        };
    }

    private async testNetworkConnection(): Promise<{ success: boolean; error?: string }> {
        try {
            console.log('🌐 測試 OpenAI 網路連接...');
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);

            // 使用 OpenAI 的 models endpoint 進行連接測試
            const response = await fetch('https://api.openai.com/v1/models', {
                method: 'GET',
                headers: {
                    'User-Agent': 'ThreadsAI/1.0'
                },
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            console.log('🌐 OpenAI 網路測試回應狀態:', response.status);

            // OpenAI models endpoint 在沒有 API key 時返回 401，這是正常的
            if (response.status >= 200 && response.status < 500) {
                console.log('✅ OpenAI 網路連接正常');
                return { success: true };
            } else {
                console.log('⚠️ 收到意外的回應狀態:', response.status);
                return { success: false, error: `伺服器回應異常 (${response.status})` };
            }
        } catch (error) {
            console.log('❌ OpenAI 網路連接測試失敗:', error);

            if (error instanceof Error) {
                if (error.name === 'AbortError') {
                    return { success: false, error: '連接超時，請檢查網路速度' };
                }
                if (error.message.includes('Failed to fetch')) {
                    return { success: false, error: '無法連接到 OpenAI API，請檢查網路設定' };
                }
                if (error.message.includes('NetworkError')) {
                    return { success: false, error: '網路錯誤，請檢查防火牆設定' };
                }
                return { success: false, error: error.message };
            }

            return { success: false, error: '未知網路錯誤' };
        }
    }
}
