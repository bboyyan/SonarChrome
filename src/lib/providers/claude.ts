
import { AIModelProvider, AIModelConfig, GenerateReplyRequest, GenerateReplyResponse } from './base';

interface ClaudeMessage {
    role: 'user' | 'assistant';
    content: string;
}

interface ClaudeRequest {
    model: string;
    max_tokens: number;
    temperature: number;
    top_p: number;
    messages: ClaudeMessage[];
    system?: string;
}

interface ClaudeResponse {
    content?: Array<{
        type: 'text';
        text: string;
    }>;
    stop_reason?: string;
    usage?: {
        input_tokens: number;
        output_tokens: number;
    };
    error?: {
        type: string;
        message: string;
    };
}

export class ClaudeProvider extends AIModelProvider {
    readonly config: AIModelConfig = {
        id: 'claude-3-haiku',
        name: 'Anthropic Claude 3 Haiku',
        description: '快速且經濟的 Claude 模型，適合日常對話',
        provider: 'Anthropic',
        isFree: false,
        requiresApiKey: true
    };

    private readonly apiUrl = 'https://api.anthropic.com/v1/messages';

    async generateReply(request: GenerateReplyRequest): Promise<GenerateReplyResponse> {
        console.log('🚀 開始 Claude 回覆生成請求');

        try {
            // 驗證 API Key
            if (!request.apiKey || !request.apiKey.startsWith('sk-ant-') || request.apiKey.length < 30) {
                console.log('❌ Claude API Key 格式不正確');
                return {
                    success: false,
                    error: 'Claude API Key 格式不正確，請檢查設定'
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

            const reply = await this.callClaudeAPI(request.postText, request.stylePrompt, request.apiKey);
            console.log('✅ Claude 回覆生成成功');
            return {
                success: true,
                reply
            };

        } catch (error) {
            console.error('❌ Claude 生成回覆錯誤:', error);
            return this.handleError(error);
        }
    }

    private async callClaudeAPI(postText: string, stylePrompt: string, apiKey: string): Promise<string> {
        const prompt = this.formatPrompt(postText, stylePrompt);

        const requestBody: ClaudeRequest = {
            model: 'claude-3-haiku-20240307',
            max_tokens: 200,
            temperature: 0.7,
            top_p: 0.95,
            system: '你是一個專業的社群媒體回覆助手，專門為 Threads 平台生成合適的回覆。請根據用戶提供的風格指示和貼文內容，生成一個簡潔、相關且符合指定風格的回覆。',
            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ]
        };

        console.log('📡 發送 Claude API 請求');

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
                        'anthropic-version': '2023-06-01',
                        'User-Agent': 'ThreadsAI/1.0'
                    },
                    body: JSON.stringify(requestBody),
                    signal: controller.signal
                });

                clearTimeout(timeoutId);
                console.log('📨 收到 Claude 回應，狀態碼:', response.status);

                if (!response.ok) {
                    let errorText = '';
                    try {
                        errorText = await response.text();
                        console.log('❌ Claude API 錯誤回應:', errorText);
                    } catch {
                        console.log('❌ 無法讀取錯誤回應內容');
                    }
                    throw this.createHttpError(response.status, errorText);
                }

                const data: ClaudeResponse = await response.json();
                console.log('📄 解析 Claude JSON 回應');

                if (data.error) {
                    console.log('❌ Claude API 返回錯誤:', data.error);
                    throw new Error(`Claude API 錯誤: ${data.error.message}`);
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

    private extractReplyFromResponse(data: ClaudeResponse): string {
        if (!data.content || data.content.length === 0) {
            console.log('❌ 沒有內容回應');
            throw new Error('沒有收到有效的回覆，請嘗試修改貼文內容');
        }

        const textContent = data.content.find(item => item.type === 'text');
        if (!textContent) {
            console.log('❌ 沒有找到文字內容');
            throw new Error('回覆格式異常，沒有找到文字內容');
        }

        console.log('📄 回應內容:', JSON.stringify(data, null, 2));

        if (data.stop_reason && data.stop_reason !== 'end_turn') {
            console.log('⚠️ 回應被阻止:', data.stop_reason);
            if (data.stop_reason === 'max_tokens') {
                throw new Error('回覆過長被截斷，請嘗試簡化貼文內容');
            }
            if (data.stop_reason === 'stop_sequence') {
                // 這通常是正常的結束，繼續處理
            }
        }

        // 提取文字內容
        const text = textContent.text;
        if (text && typeof text === 'string' && text.trim()) {
            console.log('✅ 成功獲取生成文字:', text.substring(0, 100) + '...');
            return this.cleanupReply(text);
        }

        console.log('❌ 回覆格式異常 - 完整回應:', JSON.stringify(data, null, 2));
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
                return new Error(`NETWORK_ERROR: Claude API 伺服器錯誤 (${status})`);
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
                errorMessage = 'Claude API Key 無效，請前往設定頁面檢查';
            } else if (error.message.includes('insufficient_quota')) {
                errorMessage = 'Claude API 使用額度不足，請檢查帳戶餘額';
            } else if (error.message.includes('rate_limit_exceeded')) {
                errorMessage = 'Claude API 請求頻率超限，請稍後再試';
            } else if (error.message.includes('NETWORK_ERROR')) {
                errorMessage = '網路連接錯誤，請檢查網路連線';
            } else if (error.message.includes('Failed to fetch')) {
                errorMessage = '無法連接到 Claude API，請檢查網路連線';
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
            console.log('🌐 測試 Claude 網路連接...');
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);

            // 簡單的網路連接測試 - Claude API 沒有公開的測試端點
            // 所以我們測試到主域名的連接
            const response = await fetch('https://api.anthropic.com', {
                method: 'GET',
                headers: {
                    'User-Agent': 'ThreadsAI/1.0'
                },
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            console.log('🌐 Claude 網路測試回應狀態:', response.status);

            // Anthropic API 的根路徑可能返回 404，這是正常的
            if (response.status >= 200 && response.status < 500) {
                console.log('✅ Claude 網路連接正常');
                return { success: true };
            } else {
                console.log('⚠️ 收到意外的回應狀態:', response.status);
                return { success: false, error: `伺服器回應異常 (${response.status})` };
            }
        } catch (error) {
            console.log('❌ Claude 網路連接測試失敗:', error);

            if (error instanceof Error) {
                if (error.name === 'AbortError') {
                    return { success: false, error: '連接超時，請檢查網路速度' };
                }
                if (error.message.includes('Failed to fetch')) {
                    return { success: false, error: '無法連接到 Claude API，請檢查網路設定' };
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
