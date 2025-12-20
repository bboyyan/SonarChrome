
import type { LikeThreshold } from '../types';

export interface ReplyStyle {
    id: string;
    name: string;
    description: string;
    prompt: string;
}

export interface BrandTone {
    id: string;
    name: string;
    description: string;
    prompt: string;
    isCustom?: boolean;
}

export interface GeminiRequest {
    contents: {
        parts: {
            text: string;
        }[];
    }[];
    generationConfig?: {
        temperature?: number;
        topK?: number;
        topP?: number;
        maxOutputTokens?: number;
    };
}

export interface GeminiResponse {
    candidates: {
        content: {
            parts: {
                text: string;
            }[];
        };
    }[];
}

export interface ApiKeyStorage {
    geminiApiKey?: string;
    openaiApiKey?: string;
    claudeApiKey?: string;
    openrouterApiKey?: string;
}

export type MessageType =
    | 'GENERATE_REPLY'
    | 'API_KEY_STATUS'
    | 'OPEN_OPTIONS'
    | 'SHOW_ERROR';

export interface Message {
    type: MessageType;
    data?: any;
}
