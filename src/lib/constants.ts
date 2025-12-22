import type { ReplyStyle, BrandTone } from './types';

export const REPLY_STYLES: ReplyStyle[] = [
    {
        id: 'connection',
        name: '建立連結',
        description: '高度共鳴，表達「我懂你」',
        prompt: 'High Resonance'
    },
    {
        id: 'value',
        name: '隨性見解',
        description: '分享經驗但不說教',
        prompt: 'Casual Insight'
    },
    {
        id: 'chill',
        name: '圈內搭話',
        description: '輕鬆互動，微羨慕或假抱怨',
        prompt: 'Chill / Circle Talk'
    },
    {
        id: 'hype',
        name: '純粹應援',
        description: '像朋友一樣幫你打氣',
        prompt: 'Pure Hype'
    },
    {
        id: 'spicy',
        name: '辛辣觀點',
        description: '大膽、稍微逆風的觀點',
        prompt: 'Spicy Take'
    },
    {
        id: 'story',
        name: '極短編',
        description: '分享極短的個人故事',
        prompt: 'Mini Story'
    },
    {
        id: 'question',
        name: '好奇提問',
        description: '真誠追問，引發對話',
        prompt: 'Curious Question'
    },
    {
        id: 'flex',
        name: '微炫耀',
        description: '低調展示實力',
        prompt: 'Subtle Flex'
    },
    {
        id: 'hook',
        name: '埋鉤子',
        description: '話只說一半，引發好奇',
        prompt: 'Cliffhanger Hook'
    },
    {
        id: 'collab',
        name: '隨性邀約',
        description: '拋出合作橄欖枝',
        prompt: 'Collab Hint'
    },
    {
        id: 'lust',
        name: '引流鉤子',
        description: '製造好奇缺口，引導看主頁',
        prompt: 'Profile Lure'
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
