import browser from "webextension-polyfill";
import type { ApiKeyStorage } from './types';
import { STORAGE_KEYS } from './constants';

export class StorageManager {
    static async getApiKeys(): Promise<ApiKeyStorage> {
        try {
            const result = await browser.storage.local.get([
                STORAGE_KEYS.GEMINI_API_KEY,
                STORAGE_KEYS.OPENAI_API_KEY,
                STORAGE_KEYS.CLAUDE_API_KEY,
                STORAGE_KEYS.OPENROUTER_API_KEY
            ]);
            return {
                geminiApiKey: result[STORAGE_KEYS.GEMINI_API_KEY],
                openaiApiKey: result[STORAGE_KEYS.OPENAI_API_KEY],
                claudeApiKey: result[STORAGE_KEYS.CLAUDE_API_KEY],
                openrouterApiKey: result[STORAGE_KEYS.OPENROUTER_API_KEY]
            };
        } catch (error) {
            console.error('Failed to get API keys:', error);
            return {};
        }
    }

    static async getSelectedModel(): Promise<string> {
        try {
            const result = await browser.storage.local.get(STORAGE_KEYS.SELECTED_MODEL);
            return result[STORAGE_KEYS.SELECTED_MODEL] || 'x-ai/grok-code-fast-1';
        } catch (error) {
            console.error('Failed to get selected model:', error);
            return 'x-ai/grok-code-fast-1';
        }
    }

    static async setSelectedModel(modelId: string): Promise<boolean> {
        try {
            await browser.storage.local.set({ [STORAGE_KEYS.SELECTED_MODEL]: modelId });
            return true;
        } catch (error) {
            console.error('Failed to set selected model:', error);
            return false;
        }
    }

    // Help method for legacy checking
    static async getApiKey(): Promise<string | undefined> {
        const keys = await this.getApiKeys();
        return keys.geminiApiKey;
    }
}
