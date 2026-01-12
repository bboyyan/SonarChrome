import type { ReplyStyle, BrandTone } from './types';

export const REPLY_STYLES: ReplyStyle[] = [
    // --- Core 6 (Primary) ---
    {
        id: 'relatable',
        name: '共鳴',
        description: '我也這樣覺得！(Relatable)',
        prompt: 'Genuinely Relatable'
    },
    {
        id: 'witty',
        name: '接梗',
        description: '笑死 + 吐槽 (Witty)',
        prompt: 'Witty Banter'
    },
    {
        id: 'insight',
        name: '見解',
        description: '其實還可以這樣... (Insight)',
        prompt: 'Thoughtful Insight'
    },
    {
        id: 'question',
        name: '提問',
        description: '那如果是...？ (Curious)',
        prompt: 'Curious Spark'
    },
    {
        id: 'support',
        name: '應援',
        description: '加油！辛苦了 (Support)',
        prompt: 'Warm Support'
    },
    {
        id: 'direct',
        name: '直球',
        description: '選A比較好 (Direct)',
        prompt: 'Direct Answer'
    },

    // --- Extended 5 (Pro / Pastel) ---
    {
        id: 'story',
        name: '微故事',
        description: '這讓我想起... (Story)',
        prompt: 'Mini Story'
    },
    {
        id: 'spicy',
        name: '逆風局',
        description: '雖然大家都不愛聽... (Spicy)',
        prompt: 'Spicy Take'
    },
    {
        id: 'analogy',
        name: '神比喻',
        description: '這就像是... (Analogy)',
        prompt: 'Creative Analogy'
    },
    {
        id: 'philosophical',
        name: '深度文',
        description: '其實這反映了... (Deep)',
        prompt: 'Deep Thought'
    },
    {
        id: 'logic',
        name: '邏輯控',
        description: '分成三點來看... (Logic)',
        prompt: 'Logic Analysis'
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
    SHOW_VIRAL_UI: 'showViralUI',
    CUSTOM_STYLE_EXAMPLES: 'customStyleExamples'
} as const;
