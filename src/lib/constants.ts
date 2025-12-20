import type { ReplyStyle, BrandTone } from './types';

export const REPLY_STYLES: ReplyStyle[] = [
    {
        id: 'supportive',
        name: '附和贊同',
        description: '表達支持和認同',
        prompt: '請以贊同和支持的語氣回覆這則貼文，表達正面的認同感。回覆應該簡潔、真誠，並且符合繁體中文的表達習慣。不要使用表情符號，除非原文有使用。'
    },
    {
        id: 'humorous',
        name: '幽默風趣',
        description: '輕鬆幽默的回應',
        prompt: '請以幽默風趣的語氣回覆這則貼文，可以使用輕鬆的玩笑或有趣的觀點。回覆應該正面、不冒犯，並且符合繁體中文的幽默表達。避免過度使用表情符號。'
    },
    {
        id: 'questioning',
        name: '提出疑問',
        description: '好奇詢問更多細節',
        prompt: '請以好奇和詢問的語氣回覆這則貼文，提出相關的問題來了解更多細節或不同觀點。問題應該有建設性且真誠。使用繁體中文表達。'
    },
    {
        id: 'professional',
        name: '專業分析',
        description: '提供專業見解',
        prompt: '請以專業和分析的語氣回覆這則貼文，提供有見地的觀點或相關的專業知識。回覆應該客觀、資訊豐富，並使用繁體中文表達。'
    },
    {
        id: 'encouraging',
        name: '暖心鼓勵',
        description: '給予溫暖的鼓勵',
        prompt: '請以溫暖和鼓勵的語氣回覆這則貼文，給予正面的支持和動力。回覆應該真誠、溫馨，並使用繁體中文表達關懷。'
    },
    {
        id: 'sharing',
        name: '分享經驗',
        description: '分享相關的個人經驗',
        prompt: '請以分享經驗的語氣回覆這則貼文，可以提及類似的經歷或相關的個人體會。回覆應該真實、有關聯性，並使用繁體中文自然表達。'
    },
    {
        id: 'thoughtful',
        name: '深度思考',
        description: '提供深入的思考和見解',
        prompt: '請以深度思考的語氣回覆這則貼文，提供更深層的見解或不同角度的思考。回覆應該有深度、發人深省，並使用繁體中文表達。'
    }
];

export const BRAND_TONES: BrandTone[] = [
    {
        id: 'friendly',
        name: '友好親近',
        description: '溫暖友善，拉近距離',
        prompt: '請使用友好親近的語調，就像和朋友對話一樣自然溫暖，讓對方感受到真誠的關懷。',
        isCustom: false
    },
    {
        id: 'formal',
        name: '正式專業',
        description: '商務場合，正式語氣',
        prompt: '請使用正式專業的語調，保持禮貌得體，適合商務或正式場合的溝通風格。',
        isCustom: false
    },
    {
        id: 'concise',
        name: '簡潔直接',
        description: '言簡意賅，直擊重點',
        prompt: '請使用簡潔直接的語調，言簡意賅地表達重點，避免冗長的修飾詞。',
        isCustom: false
    },
    {
        id: 'enthusiastic',
        name: '熱情活潑',
        description: '充滿活力，感染力強',
        prompt: '請使用熱情活潑的語調，展現積極正面的能量，讓回覆充滿活力和感染力。',
        isCustom: false
    },
    {
        id: 'humble',
        name: '謙虛內斂',
        description: '低調謙遜，不張揚',
        prompt: '請使用謙虛內斂的語調，保持低調謙遜的態度，避免過於張揚或自信的表達。',
        isCustom: false
    },
    {
        id: 'innovative',
        name: '創新前衛',
        description: '思維新穎，具前瞻性',
        prompt: '請使用創新前衛的語調，展現新穎的思維和前瞻性觀點，勇於提出不同的見解。',
        isCustom: false
    }
];

export const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';

export const STORAGE_KEYS = {
    GEMINI_API_KEY: 'geminiApiKey',
    OPENAI_API_KEY: 'openaiApiKey',
    CLAUDE_API_KEY: 'claudeApiKey',
    OPENROUTER_API_KEY: 'openrouterApiKey',
    CUSTOM_BRAND_TONES: 'customBrandTones',
    MODIFIED_DEFAULT_BRAND_TONES: 'modifiedDefaultBrandTones',
    HIDDEN_BRAND_TONES: 'hiddenBrandTones',
    SELECTED_MODEL: 'selectedModel', // Add this for model selection
    SHOW_VIRAL_UI: 'showViralUI'
} as const;
