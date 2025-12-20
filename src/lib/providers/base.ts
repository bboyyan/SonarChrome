// AI 模型提供者基類

export interface AIModelConfig {
    id: string;
    name: string;
    description: string;
    provider: string;
    isFree: boolean;
    requiresApiKey: boolean;
}

export interface GenerateReplyRequest {
    postText: string;
    stylePrompt: string;
    apiKey: string;
}

export interface GenerateReplyResponse {
    success: boolean;
    reply?: string;
    error?: string;
    debugInfo?: string;
}

export abstract class AIModelProvider {
    abstract readonly config: AIModelConfig;

    abstract generateReply(request: GenerateReplyRequest): Promise<GenerateReplyResponse>;

    protected formatPrompt(postText: string, stylePrompt: string): string {
        return `${stylePrompt}

貼文內容：「${postText}」

請根據以上指示生成一個合適的回覆。回覆應該：
1. 簡潔有力（1-2句話）
2. 與貼文內容相關
3. 符合指定的風格
4. 使用繁體中文
5. 避免過度使用表情符號

請直接提供回覆內容，不需要額外說明：`;
    }

    protected cleanupReply(reply: string): string {
        return reply
            .trim()
            .replace(/^["「『]|["」』]$/g, '') // 移除引號
            .replace(/\n+/g, ' ') // 換行轉空格
            .replace(/\s+/g, ' ') // 多空格轉單空格
            .trim();
    }
}
