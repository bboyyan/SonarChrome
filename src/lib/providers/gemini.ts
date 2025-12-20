
import { AIModelProvider, AIModelConfig, GenerateReplyRequest, GenerateReplyResponse } from './base';

interface GeminiRequest {
    contents: Array<{
        parts: Array<{ text: string }>;
    }>;
    generationConfig: {
        temperature: number;
        topK: number;
        topP: number;
        maxOutputTokens: number;
    };
}

interface GeminiResponse {
    candidates?: Array<{
        content?: {
            parts?: Array<{ text?: string }>;
        };
        finishReason?: string;
    }>;
    error?: {
        message: string;
    };
    promptFeedback?: {
        blockReason?: string;
    };
}

export class GeminiProvider extends AIModelProvider {
    readonly config: AIModelConfig = {
        id: 'gemini-1.5-flash',
        name: 'Google Gemini 1.5 Flash',
        description: '免費額度大，響應快速，適合日常使用',
        provider: 'Google',
        isFree: true,
        requiresApiKey: true
    };

    private readonly apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

    async generateReply(request: GenerateReplyRequest): Promise<GenerateReplyResponse> {
        console.log('🚀 開始 Gemini 回覆生成請求');

        try {
            // 驗證 API Key
            if (!request.apiKey || !request.apiKey.startsWith('AIza') || request.apiKey.length < 30) {
                console.log('❌ Gemini API Key 格式不正確');
                return {
                    success: false,
                    error: 'Gemini API Key 格式不正確，請檢查設定'
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

            const reply = await this.callGeminiAPI(request.postText, request.stylePrompt, request.apiKey);
            console.log('✅ Gemini 回覆生成成功');
            return {
                success: true,
                reply
            };

        } catch (error) {
            console.error('❌ Gemini 生成回覆錯誤:', error);
            return this.handleError(error);
        }
    }

    private async callGeminiAPI(postText: string, stylePrompt: string, apiKey: string): Promise<string> {
        const prompt = this.formatPrompt(postText, stylePrompt);

        const requestBody: GeminiRequest = {
            contents: [{
                parts: [{ text: prompt }]
            }],
            generationConfig: {
                temperature: 0.7,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 200
            }
        };

        console.log('📡 發送 Gemini API 請求');

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

                const response = await fetch(`${this.apiUrl}?key=${apiKey}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'User-Agent': 'ThreadsAI/1.0',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(requestBody),
                    signal: controller.signal
                });

                clearTimeout(timeoutId);
                console.log('📨 收到 Gemini 回應，狀態碼:', response.status);

                if (!response.ok) {
                    let errorText = '';
                    try {
                        errorText = await response.text();
                        console.log('❌ Gemini API 錯誤回應:', errorText);
                    } catch {
                        console.log('❌ 無法讀取錯誤回應內容');
                    }
                    throw this.createHttpError(response.status, errorText);
                }

                const data: GeminiResponse = await response.json();
                console.log('📄 解析 Gemini JSON 回應');

                if (data.error) {
                    console.log('❌ Gemini API 返回錯誤:', data.error);
                    throw new Error(`Gemini API 錯誤: ${data.error.message}`);
                }

                return this.extractReplyFromResponse(data);

            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                console.log(`❌ 第 ${attempt} 次嘗試失敗:`, lastError.message);

                // 如果是 API Key 或配額問題，不重試
                if (lastError.message.includes('API_KEY_INVALID') ||
                    lastError.message.includes('QUOTA_EXCEEDED')) {
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

    private extractReplyFromResponse(data: GeminiResponse): string {
        if (!data.candidates || data.candidates.length === 0) {
            console.log('❌ 沒有候選回應');
            if (data.promptFeedback) {
                console.log('📝 Prompt 反饋:', data.promptFeedback);
                throw new Error(`內容被過濾: ${data.promptFeedback.blockReason || '未知原因'}`);
            }
            throw new Error('沒有收到有效的回覆，請嘗試修改貼文內容');
        }

        const candidate = data.candidates[0];
        console.log('📄 候選回應:', JSON.stringify(candidate, null, 2));

        if (candidate.finishReason && candidate.finishReason !== 'STOP') {
            console.log('⚠️ 回應被阻止:', candidate.finishReason);
            if (candidate.finishReason === 'SAFETY') {
                throw new Error('內容被安全過濾器阻止，請嘗試修改貼文內容');
            }
            if (candidate.finishReason === 'MAX_TOKENS') {
                throw new Error('回覆過長被截斷，請嘗試簡化貼文內容');
            }
        }

        // 提取文字內容
        const text = candidate.content?.parts?.[0]?.text;
        if (text && typeof text === 'string' && text.trim()) {
            console.log('✅ 成功獲取生成文字:', text.substring(0, 100) + '...');
            return this.cleanupReply(text);
        }

        console.log('❌ 回覆格式異常 - 完整候選回應:', JSON.stringify(candidate, null, 2));
        throw new Error('未知的回覆格式，請聯繫開發者');
    }

    private createHttpError(status: number, errorText: string): Error {
        switch (status) {
            case 400:
                if (errorText.includes('API_KEY_INVALID') || errorText.includes('invalid')) {
                    return new Error('API_KEY_INVALID');
                }
                return new Error(`請求參數錯誤 (400): ${errorText}`);
            case 401:
            case 403:
                if (errorText.includes('quota') || errorText.includes('limit')) {
                    return new Error('QUOTA_EXCEEDED');
                }
                return new Error('API_KEY_INVALID');
            case 404:
                return new Error('模型不可用 (404): gemini-1.5-flash');
            case 429:
                return new Error('QUOTA_EXCEEDED');
            default:
                if (status >= 500) {
                    return new Error(`NETWORK_ERROR: Google API 伺服器錯誤 (${status})`);
                }
                return new Error(`API 請求失敗: ${status}`);
        }
    }

    private handleError(error: unknown): GenerateReplyResponse {
        let errorMessage = '生成回覆時發生錯誤';
        let debugInfo = '';

        if (error instanceof Error) {
            console.log('錯誤詳情:', error.message);
            debugInfo = error.message;

            if (error.message.includes('API_KEY_INVALID')) {
                errorMessage = 'Gemini API Key 無效，請前往設定頁面檢查';
            } else if (error.message.includes('QUOTA_EXCEEDED')) {
                errorMessage = 'Gemini API 使用額度已超限，請稍後再試';
            } else if (error.message.includes('NETWORK_ERROR')) {
                errorMessage = '網路連接錯誤，請檢查網路連線';
            } else if (error.message.includes('Failed to fetch')) {
                errorMessage = '無法連接到 Google API，請檢查網路連線';
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
            console.log('🌐 測試 Gemini 網路連接...');
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);

            const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
                method: 'GET',
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            console.log('🌐 Gemini 網路測試回應狀態:', response.status);

            if (response.status >= 200 && response.status < 500) {
                console.log('✅ Gemini 網路連接正常');
                return { success: true };
            } else {
                console.log('⚠️ 收到意外的回應狀態:', response.status);
                return { success: false, error: `伺服器回應異常 (${response.status})` };
            }
        } catch (error) {
            console.log('❌ Gemini 網路連接測試失敗:', error);

            if (error instanceof Error) {
                if (error.name === 'AbortError') {
                    return { success: false, error: '連接超時，請檢查網路速度' };
                }
                if (error.message.includes('Failed to fetch')) {
                    return { success: false, error: '無法連接到 Google API，請檢查網路設定' };
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
