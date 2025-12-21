<script lang="ts">
    import { onMount } from "svelte";
    import browser from "webextension-polyfill";
    import {
        STORAGE_KEYS,
        REPLY_STYLES as DEFAULT_STYLES,
        BRAND_TONES as DEFAULT_BRAND_TONES,
    } from "../lib/constants";

    let apiKey = ""; // Gemini API Key
    let loading = false;
    let message = "";
    let messageType: "success" | "error" = "success";

    // 多模型 API Keys 管理
    let openaiApiKey = "";
    let claudeApiKey = "";
    let openrouterApiKey = "";
    let apiKeysLoading = false;

    // Model Selection
    let selectedModel = "x-ai/grok-code-fast-1";
    let modelSaving = false;

    // UI Preferences
    let showViralUI = false;
    let uiPreferencesSaving = false;

    const AVAILABLE_MODELS = [
        {
            id: "gemini-1.5-flash",
            name: "Google Gemini 1.5 Flash (Free)",
            provider: "Google",
        },
        { id: "gpt-4o", name: "OpenAI GPT-4o", provider: "OpenAI" },
        { id: "claude-3-haiku", name: "Claude 3 Haiku", provider: "Anthropic" },
        {
            id: "google/gemini-2.0-flash-exp:free",
            name: "Gemini 2.0 Flash (OpenRouter Free)",
            provider: "OpenRouter",
        },
        {
            id: "x-ai/grok-code-fast-1",
            name: "Grok Code Fast (OpenRouter)",
            provider: "OpenRouter",
        },
    ];

    // 風格管理
    let customStyles: any[] = [];
    let modifiedDefaultStyles: any[] = [];
    let hiddenStyles: string[] = []; // 隱藏的風格 ID 列表
    let currentEditingStyle: any = null;
    let showAddForm = false;
    let activeTab = "default"; // 'default' | 'custom'
    let showHiddenStyles = false; // 是否顯示隱藏的風格

    // 品牌語調管理
    let customBrandTones: any[] = [];
    let modifiedDefaultBrandTones: any[] = [];
    let hiddenBrandTones: string[] = []; // 隱藏的語調 ID 列表
    let currentEditingBrandTone: any = null;
    let showAddBrandToneForm = false;
    let activeBrandToneTab = "default"; // 'default' | 'custom'
    let showHiddenBrandTones = false; // 是否顯示隱藏的語調

    // 表單資料
    let editForm = {
        name: "",
        description: "",
        prompt: "",
    };

    // 品牌語調表單資料
    let brandToneEditForm = {
        name: "",
        description: "",
        prompt: "",
    };

    onMount(async () => {
        await loadApiKeys();
        await loadSelectedModel();
        await loadShowViralUI();
        await loadStyles();
        await loadBrandTones();
    });

    async function loadApiKeys() {
        try {
            const result = await browser.storage.local.get([
                STORAGE_KEYS.GEMINI_API_KEY,
                STORAGE_KEYS.OPENAI_API_KEY,
                STORAGE_KEYS.CLAUDE_API_KEY,
                STORAGE_KEYS.OPENROUTER_API_KEY,
            ]);
            apiKey = result[STORAGE_KEYS.GEMINI_API_KEY] || "";
            openaiApiKey = result[STORAGE_KEYS.OPENAI_API_KEY] || "";
            claudeApiKey = result[STORAGE_KEYS.CLAUDE_API_KEY] || "";
            openrouterApiKey = result[STORAGE_KEYS.OPENROUTER_API_KEY] || "";
        } catch (error) {
            console.error("載入 API Keys 失敗:", error);
        }
    }

    async function loadSelectedModel() {
        try {
            const result = await browser.storage.local.get(
                STORAGE_KEYS.SELECTED_MODEL,
            );
            selectedModel =
                result[STORAGE_KEYS.SELECTED_MODEL] || "x-ai/grok-code-fast-1";
        } catch (error) {
            console.error("Failed to load selected model:", error);
        }
    }

    async function loadShowViralUI() {
        try {
            const result = await browser.storage.local.get(
                STORAGE_KEYS.SHOW_VIRAL_UI,
            );
            // Default to true now as per user request to show it by default
            showViralUI =
                result[STORAGE_KEYS.SHOW_VIRAL_UI] !== undefined
                    ? result[STORAGE_KEYS.SHOW_VIRAL_UI]
                    : true;
        } catch (error) {
            console.error("Failed to load UI preferences:", error);
        }
    }

    async function saveShowViralUI() {
        uiPreferencesSaving = true;
        try {
            await browser.storage.local.set({
                [STORAGE_KEYS.SHOW_VIRAL_UI]: showViralUI,
            });
            showMessage(
                `爆文偵測介面已${showViralUI ? "開啟" : "關閉"}`,
                "success",
            );
        } catch (error) {
            showMessage("設定儲存失敗", "error");
        }
        uiPreferencesSaving = false;
    }

    async function saveSelectedModel() {
        modelSaving = true;
        try {
            await browser.storage.local.set({
                [STORAGE_KEYS.SELECTED_MODEL]: selectedModel,
            });
            showMessage("預設模型已儲存！", "success");
        } catch (error) {
            showMessage("儲存失敗，請稍後再試", "error");
        }
        modelSaving = false;
    }

    async function saveApiKey() {
        if (!apiKey.trim()) {
            showMessage("請輸入 API Key", "error");
            return;
        }

        loading = true;
        try {
            await browser.storage.local.set({
                [STORAGE_KEYS.GEMINI_API_KEY]: apiKey.trim(),
            });
            showMessage("Gemini API Key 儲存成功！", "success");
        } catch (error) {
            showMessage("儲存失敗，請稍後再試", "error");
        }
        loading = false;
    }

    async function clearApiKey() {
        loading = true;
        try {
            await browser.storage.local.remove(STORAGE_KEYS.GEMINI_API_KEY);
            apiKey = "";
            showMessage("Gemini API Key 已清除", "success");
        } catch (error) {
            showMessage("清除失敗，請稍後再試", "error");
        }
        loading = false;
    }

    function showMessage(text: string, type: "success" | "error") {
        message = text;
        messageType = type;
        setTimeout(() => {
            message = "";
        }, 3000);
    }

    function openGoogleAI() {
        browser.tabs.create({
            url: "https://makersuite.google.com/app/apikey",
        });
    }

    async function saveOpenAIKey() {
        if (!openaiApiKey.trim()) {
            showMessage("請輸入 OpenAI API Key", "error");
            return;
        }

        if (!openaiApiKey.startsWith("sk-")) {
            showMessage("OpenAI API Key 格式不正確（應以 sk- 開頭）", "error");
            return;
        }

        apiKeysLoading = true;
        try {
            await browser.storage.local.set({
                [STORAGE_KEYS.OPENAI_API_KEY]: openaiApiKey.trim(),
            });
            showMessage("OpenAI API Key 儲存成功！", "success");
        } catch (error) {
            showMessage("儲存失敗，請稍後再試", "error");
        }
        apiKeysLoading = false;
    }

    async function saveClaudeKey() {
        if (!claudeApiKey.trim()) {
            showMessage("請輸入 Claude API Key", "error");
            return;
        }

        if (!claudeApiKey.startsWith("sk-ant-")) {
            showMessage(
                "Claude API Key 格式不正確（應以 sk-ant- 開頭）",
                "error",
            );
            return;
        }

        apiKeysLoading = true;
        try {
            await browser.storage.local.set({
                [STORAGE_KEYS.CLAUDE_API_KEY]: claudeApiKey.trim(),
            });
            showMessage("Claude API Key 儲存成功！", "success");
        } catch (error) {
            showMessage("儲存失敗，請稍後再試", "error");
        }
        apiKeysLoading = false;
    }

    async function clearOpenAIKey() {
        apiKeysLoading = true;
        try {
            await browser.storage.local.remove(STORAGE_KEYS.OPENAI_API_KEY);
            openaiApiKey = "";
            showMessage("OpenAI API Key 已清除", "success");
        } catch (error) {
            showMessage("清除失敗，請稍後再試", "error");
        }
        apiKeysLoading = false;
    }

    async function clearClaudeKey() {
        apiKeysLoading = true;
        try {
            await browser.storage.local.remove(STORAGE_KEYS.CLAUDE_API_KEY);
            claudeApiKey = "";
            showMessage("Claude API Key 已清除", "success");
        } catch (error) {
            showMessage("清除失敗，請稍後再試", "error");
        }
        apiKeysLoading = false;
    }

    function openOpenAIDocs() {
        browser.tabs.create({ url: "https://platform.openai.com/api-keys" });
    }

    function openClaudeDocs() {
        browser.tabs.create({ url: "https://console.anthropic.com/" });
    }

    async function saveOpenRouterKey() {
        if (!openrouterApiKey.trim()) {
            showMessage("請輸入 OpenRouter API Key", "error");
            return;
        }

        if (!openrouterApiKey.startsWith("sk-or-")) {
            showMessage(
                "OpenRouter API Key 格式不正確（應以 sk-or- 開頭）",
                "error",
            );
            return;
        }

        apiKeysLoading = true;
        try {
            await browser.storage.local.set({
                [STORAGE_KEYS.OPENROUTER_API_KEY]: openrouterApiKey.trim(),
            });
            showMessage("OpenRouter API Key 儲存成功！", "success");
        } catch (error) {
            showMessage("儲存失敗，請稍後再試", "error");
        }
        apiKeysLoading = false;
    }

    async function clearOpenRouterKey() {
        apiKeysLoading = true;
        try {
            await browser.storage.local.remove(STORAGE_KEYS.OPENROUTER_API_KEY);
            openrouterApiKey = "";
            showMessage("OpenRouter API Key 已清除", "success");
        } catch (error) {
            showMessage("清除失敗，請稍後再試", "error");
        }
        apiKeysLoading = false;
    }

    function openOpenRouterDocs() {
        browser.tabs.create({ url: "https://openrouter.ai/keys" });
    }

    // 風格管理函數
    async function loadStyles() {
        try {
            const result = await browser.storage.local.get([
                "customStyles",
                "modifiedDefaultStyles",
                "hiddenStyles",
            ]);
            customStyles = result.customStyles || [];
            modifiedDefaultStyles = result.modifiedDefaultStyles || [];
            hiddenStyles = result.hiddenStyles || [];
        } catch (error) {
            console.error("載入風格失敗:", error);
            customStyles = [];
            modifiedDefaultStyles = [];
            hiddenStyles = [];
        }
    }

    function getEffectiveDefaultStyles() {
        const allStyles = DEFAULT_STYLES.map((defaultStyle) => {
            const modified = modifiedDefaultStyles.find(
                (m) => m.id === defaultStyle.id,
            );
            return modified || defaultStyle;
        });

        // 根據 showHiddenStyles 的狀態過濾風格
        if (showHiddenStyles) {
            return allStyles; // 顯示所有風格
        } else {
            return allStyles.filter(
                (style) => !hiddenStyles.includes(style.id),
            ); // 過濾隱藏的風格
        }
    }

    function getFilteredCustomStyles() {
        if (showHiddenStyles) {
            return customStyles; // 顯示所有風格
        } else {
            return customStyles.filter(
                (style) => !hiddenStyles.includes(style.id),
            ); // 過濾隱藏的風格
        }
    }

    function startEditStyle(style: any, isDefault: boolean = false) {
        currentEditingStyle = { ...style, isDefault };
        editForm = {
            name: style.name,
            description: style.description,
            prompt: style.prompt,
        };
        showAddForm = false;
    }

    function startAddCustomStyle() {
        currentEditingStyle = null;
        editForm = {
            name: "",
            description: "",
            prompt: "",
        };
        showAddForm = true;
        activeTab = "custom";
    }

    function cancelEdit() {
        currentEditingStyle = null;
        showAddForm = false;
        editForm = { name: "", description: "", prompt: "" };
    }

    async function saveStyle() {
        if (
            !editForm.name.trim() ||
            !editForm.description.trim() ||
            !editForm.prompt.trim()
        ) {
            showMessage("請填寫所有欄位", "error");
            return;
        }

        try {
            if (currentEditingStyle && currentEditingStyle.isDefault) {
                // 編輯預設風格
                const updatedStyle = {
                    id: currentEditingStyle.id,
                    name: editForm.name.trim(),
                    description: editForm.description.trim(),
                    prompt: editForm.prompt.trim(),
                    isCustom: false,
                };

                const existingIndex = modifiedDefaultStyles.findIndex(
                    (s) => s.id === currentEditingStyle.id,
                );
                if (existingIndex >= 0) {
                    modifiedDefaultStyles[existingIndex] = updatedStyle;
                } else {
                    modifiedDefaultStyles = [
                        ...modifiedDefaultStyles,
                        updatedStyle,
                    ];
                }

                await browser.storage.local.set({ modifiedDefaultStyles });
                showMessage("預設風格已更新！", "success");
            } else if (currentEditingStyle && !currentEditingStyle.isDefault) {
                // 編輯自訂風格
                const updatedStyle = {
                    ...currentEditingStyle,
                    name: editForm.name.trim(),
                    description: editForm.description.trim(),
                    prompt: editForm.prompt.trim(),
                };

                const index = customStyles.findIndex(
                    (s) => s.id === currentEditingStyle.id,
                );
                customStyles[index] = updatedStyle;

                await browser.storage.local.set({ customStyles });
                showMessage("自訂風格已更新！", "success");
            } else {
                // 新增自訂風格
                const newStyle = {
                    id: `custom_${Date.now()}`,
                    name: editForm.name.trim(),
                    description: editForm.description.trim(),
                    prompt: editForm.prompt.trim(),
                    isCustom: true,
                };

                customStyles = [...customStyles, newStyle];
                await browser.storage.local.set({ customStyles });
                showMessage("自訂風格已新增！", "success");
            }

            // 通知 content script 更新風格
            notifyStylesUpdated();

            // 重置表單
            cancelEdit();
        } catch (error) {
            showMessage("儲存失敗，請稍後再試", "error");
        }
    }

    async function deleteCustomStyle(styleId: string) {
        if (!confirm("確定要刪除這個自訂風格嗎？")) {
            return;
        }

        customStyles = customStyles.filter((style) => style.id !== styleId);

        try {
            await browser.storage.local.set({ customStyles });
            notifyStylesUpdated();
            showMessage("自訂風格已刪除", "success");
        } catch (error) {
            showMessage("刪除失敗，請稍後再試", "error");
        }
    }

    async function resetDefaultStyle(styleId: string) {
        if (!confirm("確定要恢復這個風格的預設設定嗎？")) {
            return;
        }

        modifiedDefaultStyles = modifiedDefaultStyles.filter(
            (s) => s.id !== styleId,
        );

        try {
            await browser.storage.local.set({ modifiedDefaultStyles });
            notifyStylesUpdated();
            showMessage("已恢復預設設定", "success");
        } catch (error) {
            showMessage("恢復失敗，請稍後再試", "error");
        }
    }

    async function resetAllDefaultStyles() {
        if (
            !confirm("確定要將所有預設風格恢復為原始設定嗎？此操作無法復原。")
        ) {
            return;
        }

        modifiedDefaultStyles = [];

        try {
            await browser.storage.local.set({ modifiedDefaultStyles });
            notifyStylesUpdated();
            showMessage("所有預設風格已恢復原始設定", "success");
        } catch (error) {
            showMessage("恢復失敗，請稍後再試", "error");
        }
    }

    function notifyStylesUpdated() {
        browser.tabs.query({}).then((tabs) => {
            tabs.forEach((tab) => {
                if (tab.id) {
                    browser.tabs
                        .sendMessage(tab.id, { type: "STYLES_UPDATED" })
                        .catch(() => {
                            // 忽略錯誤（可能是非 Threads 頁面）
                        });
                }
            });
        });
    }

    function isStyleModified(styleId: string): boolean {
        return modifiedDefaultStyles.some((s) => s.id === styleId);
    }

    function isStyleHidden(styleId: string): boolean {
        return hiddenStyles.includes(styleId);
    }

    async function toggleStyleVisibility(styleId: string) {
        const wasHidden = hiddenStyles.includes(styleId);

        if (wasHidden) {
            // 顯示風格
            hiddenStyles = hiddenStyles.filter((id) => id !== styleId);
        } else {
            // 隱藏風格
            hiddenStyles = [...hiddenStyles, styleId];
        }

        try {
            await browser.storage.local.set({ hiddenStyles });
            notifyStylesUpdated();
            showMessage(wasHidden ? "風格已顯示" : "風格已隱藏", "success");
        } catch (error) {
            showMessage("操作失敗，請稍後再試", "error");
        }
    }

    // 品牌語調管理函數
    async function loadBrandTones() {
        try {
            const result = await browser.storage.local.get([
                "customBrandTones",
                "modifiedDefaultBrandTones",
                "hiddenBrandTones",
            ]);
            customBrandTones = result.customBrandTones || [];
            modifiedDefaultBrandTones = result.modifiedDefaultBrandTones || [];
            hiddenBrandTones = result.hiddenBrandTones || [];
        } catch (error) {
            console.error("載入品牌語調失敗:", error);
            customBrandTones = [];
            modifiedDefaultBrandTones = [];
            hiddenBrandTones = [];
        }
    }

    function getEffectiveDefaultBrandTones() {
        const allBrandTones = DEFAULT_BRAND_TONES.map((defaultBrandTone) => {
            const modified = modifiedDefaultBrandTones.find(
                (m) => m.id === defaultBrandTone.id,
            );
            return modified || defaultBrandTone;
        });

        // 根據 showHiddenBrandTones 的狀態過濾語調
        if (showHiddenBrandTones) {
            return allBrandTones; // 顯示所有語調
        } else {
            return allBrandTones.filter(
                (brandTone) => !hiddenBrandTones.includes(brandTone.id),
            ); // 過濾隱藏的語調
        }
    }

    function getFilteredCustomBrandTones() {
        if (showHiddenBrandTones) {
            return customBrandTones; // 顯示所有語調
        } else {
            return customBrandTones.filter(
                (brandTone) => !hiddenBrandTones.includes(brandTone.id),
            ); // 過濾隱藏的語調
        }
    }

    function startEditBrandTone(brandTone: any, isDefault: boolean = false) {
        currentEditingBrandTone = { ...brandTone, isDefault };
        brandToneEditForm = {
            name: brandTone.name,
            description: brandTone.description,
            prompt: brandTone.prompt,
        };
        showAddBrandToneForm = false;
    }

    function startAddCustomBrandTone() {
        currentEditingBrandTone = null;
        brandToneEditForm = {
            name: "",
            description: "",
            prompt: "",
        };
        showAddBrandToneForm = true;
        activeBrandToneTab = "custom";
    }

    function cancelBrandToneEdit() {
        currentEditingBrandTone = null;
        showAddBrandToneForm = false;
        brandToneEditForm = { name: "", description: "", prompt: "" };
    }

    async function saveBrandTone() {
        if (
            !brandToneEditForm.name.trim() ||
            !brandToneEditForm.description.trim() ||
            !brandToneEditForm.prompt.trim()
        ) {
            showMessage("請填寫所有欄位", "error");
            return;
        }

        try {
            if (currentEditingBrandTone) {
                if (currentEditingBrandTone.isDefault) {
                    // 編輯預設語調
                    const existingIndex = modifiedDefaultBrandTones.findIndex(
                        (s) => s.id === currentEditingBrandTone.id,
                    );
                    const updatedBrandTone = {
                        id: currentEditingBrandTone.id,
                        name: brandToneEditForm.name,
                        description: brandToneEditForm.description,
                        prompt: brandToneEditForm.prompt,
                        isCustom: false,
                    };

                    if (existingIndex >= 0) {
                        modifiedDefaultBrandTones[existingIndex] =
                            updatedBrandTone;
                    } else {
                        modifiedDefaultBrandTones = [
                            ...modifiedDefaultBrandTones,
                            updatedBrandTone,
                        ];
                    }

                    await browser.storage.local.set({
                        modifiedDefaultBrandTones,
                    });
                    showMessage("預設語調已修改！", "success");
                } else {
                    // 編輯自訂語調
                    const index = customBrandTones.findIndex(
                        (s) => s.id === currentEditingBrandTone.id,
                    );
                    if (index >= 0) {
                        customBrandTones[index] = {
                            ...currentEditingBrandTone,
                            name: brandToneEditForm.name,
                            description: brandToneEditForm.description,
                            prompt: brandToneEditForm.prompt,
                        };
                        await browser.storage.local.set({ customBrandTones });
                        showMessage("自訂語調已修改！", "success");
                    }
                }
            } else {
                // 新增自訂語調
                const newBrandTone = {
                    id: "custom_" + Date.now(),
                    name: brandToneEditForm.name,
                    description: brandToneEditForm.description,
                    prompt: brandToneEditForm.prompt,
                    isCustom: true,
                };
                customBrandTones = [...customBrandTones, newBrandTone];
                await browser.storage.local.set({ customBrandTones });
                showMessage("自訂語調已新增！", "success");
            }

            // 通知 content script 更新語調
            notifyBrandTonesUpdated();

            // 重置表單
            cancelBrandToneEdit();
        } catch (error) {
            showMessage("儲存失敗，請稍後再試", "error");
        }
    }

    async function deleteCustomBrandTone(brandToneId: string) {
        if (!confirm("確定要刪除這個自訂語調嗎？")) {
            return;
        }

        customBrandTones = customBrandTones.filter(
            (brandTone) => brandTone.id !== brandToneId,
        );

        try {
            await browser.storage.local.set({ customBrandTones });
            notifyBrandTonesUpdated();
            showMessage("自訂語調已刪除", "success");
        } catch (error) {
            showMessage("刪除失敗，請稍後再試", "error");
        }
    }

    async function resetDefaultBrandTone(brandToneId: string) {
        if (!confirm("確定要恢復這個語調的預設設定嗎？")) {
            return;
        }
        modifiedDefaultBrandTones = modifiedDefaultBrandTones.filter(
            (s) => s.id !== brandToneId,
        );

        try {
            await browser.storage.local.set({ modifiedDefaultBrandTones });
            notifyBrandTonesUpdated();
            showMessage("已恢復預設設定", "success");
        } catch (error) {
            showMessage("恢復失敗，請稍後再試", "error");
        }
    }

    async function resetAllDefaultBrandTones() {
        if (
            !confirm("確定要將所有預設語調恢復為原始設定嗎？此操作無法復原。")
        ) {
            return;
        }
        modifiedDefaultBrandTones = [];

        try {
            await browser.storage.local.set({ modifiedDefaultBrandTones });
            notifyBrandTonesUpdated();
            showMessage("所有預設語調已恢復原始設定", "success");
        } catch (error) {
            showMessage("恢復失敗，請稍後再試", "error");
        }
    }

    function notifyBrandTonesUpdated() {
        browser.tabs.query({}).then((tabs) => {
            tabs.forEach((tab) => {
                if (tab.id) {
                    browser.tabs
                        .sendMessage(tab.id, { type: "BRAND_TONES_UPDATED" })
                        .catch(() => {
                            // 忽略錯誤（可能是非 Threads 頁面）
                        });
                }
            });
        });
    }

    function isBrandToneModified(brandToneId: string): boolean {
        return modifiedDefaultBrandTones.some((s) => s.id === brandToneId);
    }

    function isBrandToneHidden(brandToneId: string): boolean {
        return hiddenBrandTones.includes(brandToneId);
    }

    async function toggleBrandToneVisibility(brandToneId: string) {
        const wasHidden = hiddenBrandTones.includes(brandToneId);

        if (wasHidden) {
            // 顯示語調
            hiddenBrandTones = hiddenBrandTones.filter(
                (id) => id !== brandToneId,
            );
        } else {
            // 隱藏語調
            hiddenBrandTones = [...hiddenBrandTones, brandToneId];
        }

        try {
            await browser.storage.local.set({ hiddenBrandTones });
            notifyBrandTonesUpdated();
            showMessage(wasHidden ? "語調已顯示" : "語調已隱藏", "success");
        } catch (error) {
            showMessage("操作失敗，請稍後再試", "error");
        }
    }
</script>

<div class="min-h-screen bg-gray-50 py-8">
    <div class="max-w-4xl mx-auto px-4">
        <!-- API Key 設定區塊 -->
        <div class="bg-white rounded-lg shadow-sm border p-8 mb-6">
            <div class="text-center mb-8">
                <h1 class="text-3xl font-bold text-gray-900 mb-2">
                    ✨ SonarAgent
                </h1>
                <p class="text-gray-600">設定您的 AI 模型與 API Key</p>
            </div>

            <div class="space-y-6">
                <div>
                    <label
                        for="api-key"
                        class="block text-sm font-medium text-gray-700 mb-2"
                    >
                        Google Gemini API Key
                    </label>
                    <input
                        id="api-key"
                        type="password"
                        bind:value={apiKey}
                        placeholder="貼上您的 Gemini API Key"
                        class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        disabled={loading}
                    />
                </div>

                {#if message}
                    <div
                        class="p-3 rounded-md {messageType === 'success'
                            ? 'bg-green-50 text-green-700 border border-green-200'
                            : 'bg-red-50 text-red-700 border border-red-200'}"
                    >
                        {message}
                    </div>
                {/if}

                <div class="flex gap-3">
                    <button
                        on:click={saveApiKey}
                        disabled={loading}
                        class="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? "儲存中..." : "儲存"}
                    </button>

                    <button
                        on:click={clearApiKey}
                        disabled={loading}
                        class="bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        清除
                    </button>
                </div>

                <div class="bg-blue-50 border border-blue-200 rounded-md p-4">
                    <h3 class="text-sm font-medium text-blue-900 mb-2">
                        🔑 如何獲取 Gemini API Key？
                    </h3>
                    <p class="text-sm text-blue-700 mb-3">
                        您需要從 Google AI Studio 獲取免費的 API Key
                    </p>
                    <button
                        on:click={openGoogleAI}
                        class="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 underline"
                    >
                        前往 Google AI Studio 獲取 API Key →
                    </button>
                </div>
            </div>
        </div>

        <!-- 多模型 API Keys 設定區塊 -->
        <div class="bg-white rounded-lg shadow-sm border p-8 mb-6">
            <div class="text-center mb-8">
                <h2 class="text-2xl font-bold text-gray-900 mb-2">
                    🤖 多模型 API Keys 管理
                </h2>
                <p class="text-gray-600">
                    配置其他 AI 模型的 API Keys，享受多樣化的回覆風格
                </p>
            </div>

            <div class="grid md:grid-cols-2 gap-8">
                <!-- OpenAI API Key -->
                <div class="space-y-4">
                    <div>
                        <label
                            for="openai-key"
                            class="block text-sm font-medium text-gray-700 mb-2"
                        >
                            OpenAI API Key
                        </label>
                        <input
                            id="openai-key"
                            type="password"
                            bind:value={openaiApiKey}
                            placeholder="sk-..."
                            class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                            disabled={apiKeysLoading}
                        />
                    </div>

                    <div class="flex gap-3">
                        <button
                            on:click={saveOpenAIKey}
                            disabled={apiKeysLoading}
                            class="bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {apiKeysLoading ? "儲存中..." : "儲存"}
                        </button>
                        <button
                            on:click={clearOpenAIKey}
                            disabled={apiKeysLoading || !openaiApiKey}
                            class="bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            清除
                        </button>
                    </div>

                    <div
                        class="bg-green-50 border border-green-200 rounded-md p-4"
                    >
                        <h3 class="text-sm font-medium text-green-900 mb-2">
                            🔑 OpenAI API Key
                        </h3>
                        <p class="text-sm text-green-700 mb-3">
                            用於使用 GPT-4o 模型，提供高品質的對話回覆（需付費）
                        </p>
                        <button
                            on:click={openOpenAIDocs}
                            class="inline-flex items-center text-sm text-green-600 hover:text-green-800 underline"
                        >
                            前往 OpenAI Platform 獲取 API Key →
                        </button>
                    </div>
                </div>

                <!-- Claude API Key -->
                <div class="space-y-4">
                    <div>
                        <label
                            for="claude-key"
                            class="block text-sm font-medium text-gray-700 mb-2"
                        >
                            Claude API Key
                        </label>
                        <input
                            id="claude-key"
                            type="password"
                            bind:value={claudeApiKey}
                            placeholder="sk-ant-..."
                            class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                            disabled={apiKeysLoading}
                        />
                    </div>

                    <div class="flex gap-3">
                        <button
                            on:click={saveClaudeKey}
                            disabled={apiKeysLoading}
                            class="bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {apiKeysLoading ? "儲存中..." : "儲存"}
                        </button>
                        <button
                            on:click={clearClaudeKey}
                            disabled={apiKeysLoading || !claudeApiKey}
                            class="bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            清除
                        </button>
                    </div>

                    <div
                        class="bg-purple-50 border border-purple-200 rounded-md p-4"
                    >
                        <h3 class="text-sm font-medium text-purple-900 mb-2">
                            🔑 Claude API Key
                        </h3>
                        <p class="text-sm text-purple-700 mb-3">
                            用於使用 Claude 3 Haiku
                            模型，提供快速且經濟的回覆（需付費）
                        </p>
                        <button
                            on:click={openClaudeDocs}
                            class="inline-flex items-center text-sm text-purple-600 hover:text-purple-800 underline"
                        >
                            前往 Anthropic Console 獲取 API Key →
                        </button>
                    </div>
                </div>

                <!-- OpenRouter API Key -->
                <div class="space-y-4">
                    <div>
                        <label
                            for="openrouter-key"
                            class="block text-sm font-medium text-gray-700 mb-2"
                        >
                            OpenRouter API Key
                        </label>
                        <input
                            id="openrouter-key"
                            type="password"
                            bind:value={openrouterApiKey}
                            placeholder="sk-or-..."
                            class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            disabled={apiKeysLoading}
                        />
                    </div>

                    <div class="flex gap-3">
                        <button
                            on:click={saveOpenRouterKey}
                            disabled={apiKeysLoading}
                            class="bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {apiKeysLoading ? "儲存中..." : "儲存"}
                        </button>
                        <button
                            on:click={clearOpenRouterKey}
                            disabled={apiKeysLoading || !openrouterApiKey}
                            class="bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            清除
                        </button>
                    </div>

                    <div
                        class="bg-indigo-50 border border-indigo-200 rounded-md p-4"
                    >
                        <h3 class="text-sm font-medium text-indigo-900 mb-2">
                            🔑 OpenRouter API Key
                        </h3>
                        <p class="text-sm text-indigo-700 mb-3">
                            支援多種免費模型（如 Gemini 2.0 Flash）與付費模型
                        </p>
                        <button
                            on:click={openOpenRouterDocs}
                            class="inline-flex items-center text-sm text-indigo-600 hover:text-indigo-800 underline"
                        >
                            前往 OpenRouter 獲取 API Key →
                        </button>
                    </div>
                </div>
            </div>

            <!-- Model Selection -->
            <div class="mt-8 bg-white rounded-lg border border-gray-200 p-6">
                <h3 class="text-lg font-medium text-gray-900 mb-4">
                    🤖 預設 AI 模型
                </h3>
                <p class="text-sm text-gray-600 mb-4">
                    選擇用於生成回覆的預設 AI 模型。請確保您已設定所選模型對應的
                    API Key。
                </p>
                <div class="space-y-3">
                    {#each AVAILABLE_MODELS as model}
                        <div class="flex items-center">
                            <input
                                type="radio"
                                id={model.id}
                                name="model"
                                value={model.id}
                                bind:group={selectedModel}
                                on:change={saveSelectedModel}
                                disabled={modelSaving}
                                class="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500 disabled:opacity-50"
                            />
                            <label
                                for={model.id}
                                class="ml-3 block text-sm font-medium text-gray-700 cursor-pointer"
                            >
                                {model.name}
                            </label>
                        </div>
                    {/each}
                </div>
            </div>

            <!-- UI Preferences -->
            <div class="mt-8 bg-white rounded-lg border border-gray-200 p-6">
                <h3 class="text-lg font-medium text-gray-900 mb-4">
                    🛠️ 介面設定
                </h3>
                <div class="flex items-center justify-between">
                    <div>
                        <div class="font-medium text-gray-700">
                            顯示爆文偵測介面
                        </div>
                        <div class="text-sm text-gray-500">
                            在 Threads 頁面上顯示浮動 Logo 和文章爆文分析數據。
                        </div>
                    </div>
                    <label
                        class="relative inline-flex items-center cursor-pointer"
                    >
                        <input
                            type="checkbox"
                            bind:checked={showViralUI}
                            on:change={saveShowViralUI}
                            disabled={uiPreferencesSaving}
                            class="sr-only peer"
                        />
                        <div
                            class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"
                        ></div>
                    </label>
                </div>
            </div>

            <!-- 多模型說明 -->
            <div
                class="mt-8 bg-amber-50 border border-amber-200 rounded-md p-4"
            >
                <h3 class="text-sm font-medium text-amber-900 mb-2">
                    💡 多模型功能說明
                </h3>
                <ul class="text-sm text-amber-700 space-y-1">
                    <li>
                        • <strong>Google Gemini：</strong
                        >免費額度大，響應快速，適合日常使用
                    </li>
                    <li>
                        • <strong>OpenAI GPT-4o：</strong
                        >最新模型，智能程度高，適合複雜對話
                    </li>
                    <li>
                        • <strong>Claude 3 Haiku：</strong
                        >快速且經濟，提供不同的回覆風格
                    </li>
                    <li>
                        • <strong>模型選擇：</strong
                        >點擊智慧回覆按鈕時可選擇使用的 AI 模型
                    </li>
                    <li>
                        • <strong>API Key 安全：</strong>所有 API Keys
                        均儲存在本地瀏覽器中，不會上傳到伺服器
                    </li>
                </ul>
            </div>
        </div>

        <!-- 風格管理區塊 -->
        <div class="bg-white rounded-lg shadow-sm border p-8">
            <div class="text-center mb-6">
                <h2 class="text-2xl font-bold text-gray-900 mb-2">
                    🎨 風格管理系統
                </h2>
                <p class="text-gray-600">
                    管理預設風格和自訂風格，創建您的專屬回覆風格
                </p>
            </div>

            <!-- 頂部功能按鈕 -->
            <div class="flex flex-wrap gap-3 mb-6 p-4 bg-gray-50 rounded-lg">
                <button
                    on:click={startAddCustomStyle}
                    class="bg-blue-600 text-white py-2 px-4 rounded-md text-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    ➕ 新增自訂風格
                </button>
                <button
                    on:click={resetAllDefaultStyles}
                    class="bg-orange-600 text-white py-2 px-4 rounded-md text-sm hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                    🔄 重置所有預設風格
                </button>
                <button
                    on:click={() => (showHiddenStyles = !showHiddenStyles)}
                    class="{showHiddenStyles
                        ? 'bg-gray-600'
                        : 'bg-gray-400'} text-white py-2 px-4 rounded-md text-sm hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                    {showHiddenStyles ? "👁️ 隱藏已隱藏風格" : "👁️ 顯示隱藏風格"}
                    ({hiddenStyles.length})
                </button>
            </div>

            <!-- 標籤頁 -->
            <div class="flex border-b mb-6">
                <button
                    class="py-2 px-4 border-b-2 font-medium text-sm {activeTab ===
                    'default'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'}"
                    on:click={() => (activeTab = "default")}
                >
                    📋 預設風格 ({getEffectiveDefaultStyles()
                        .length}{showHiddenStyles
                        ? "/" + DEFAULT_STYLES.length
                        : ""})
                </button>
                <button
                    class="py-2 px-4 border-b-2 font-medium text-sm {activeTab ===
                    'custom'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'}"
                    on:click={() => (activeTab = "custom")}
                >
                    ✨ 自訂風格 ({getFilteredCustomStyles()
                        .length}{showHiddenStyles
                        ? "/" + customStyles.length
                        : ""})
                </button>
            </div>

            <!-- 編輯表單 -->
            {#if currentEditingStyle || showAddForm}
                <div
                    class="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6"
                >
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="text-lg font-medium text-blue-900">
                            {currentEditingStyle
                                ? currentEditingStyle.isDefault
                                    ? "編輯預設風格"
                                    : "編輯自訂風格"
                                : "新增自訂風格"}
                        </h3>
                        <button
                            on:click={cancelEdit}
                            class="text-gray-400 hover:text-gray-600"
                        >
                            ✕
                        </button>
                    </div>

                    <div class="space-y-4">
                        <div>
                            <label
                                class="block text-sm font-medium text-gray-700 mb-2"
                                >風格名稱</label
                            >
                            <input
                                type="text"
                                bind:value={editForm.name}
                                placeholder="例如：專業技術回覆"
                                class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        <div>
                            <label
                                class="block text-sm font-medium text-gray-700 mb-2"
                                >風格描述</label
                            >
                            <input
                                type="text"
                                bind:value={editForm.description}
                                placeholder="例如：以技術專業的角度分析回覆"
                                class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        <div>
                            <label
                                class="block text-sm font-medium text-gray-700 mb-2"
                                >提示詞 (Prompt)</label
                            >
                            <textarea
                                bind:value={editForm.prompt}
                                placeholder="請以專業技術的角度回覆這則貼文，提供具體的技術見解和建議。回覆應該準確、實用，並使用專業但易懂的語言。"
                                rows="6"
                                class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            ></textarea>
                            <p class="text-xs text-gray-500 mt-1">
                                💡 提示：使用清晰、具體的指令來獲得更好的 AI
                                回覆效果
                            </p>
                        </div>

                        <div class="flex gap-3">
                            <button
                                on:click={saveStyle}
                                class="bg-blue-600 text-white py-2 px-6 rounded-md text-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                💾 儲存
                            </button>
                            <button
                                on:click={cancelEdit}
                                class="bg-gray-300 text-gray-700 py-2 px-6 rounded-md text-sm hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
                            >
                                取消
                            </button>
                        </div>
                    </div>
                </div>
            {/if}

            <!-- 風格列表 -->
            <div class="space-y-4">
                {#if activeTab === "default"}
                    <!-- 預設風格 -->
                    {#each getEffectiveDefaultStyles() as style}
                        <div
                            class="border rounded-lg p-4 {isStyleModified(
                                style.id,
                            )
                                ? 'border-orange-200 bg-orange-50'
                                : 'border-gray-200'}"
                        >
                            <div class="flex justify-between items-start">
                                <div class="flex-1">
                                    <div class="flex items-center gap-2 mb-2">
                                        <h4 class="font-medium text-gray-900">
                                            {style.name}
                                        </h4>
                                        <span
                                            class="bg-blue-600 text-white text-xs px-2 py-1 rounded"
                                            >預設</span
                                        >
                                        {#if isStyleModified(style.id)}
                                            <span
                                                class="bg-orange-600 text-white text-xs px-2 py-1 rounded"
                                                >已修改</span
                                            >
                                        {/if}
                                    </div>
                                    <p class="text-sm text-gray-600 mb-3">
                                        {style.description}
                                    </p>
                                    <details class="text-sm">
                                        <summary
                                            class="cursor-pointer text-gray-500 hover:text-gray-700 mb-2"
                                            >查看提示詞</summary
                                        >
                                        <div
                                            class="bg-white border rounded p-3 font-mono text-xs text-gray-600 max-h-32 overflow-y-auto"
                                        >
                                            {style.prompt}
                                        </div>
                                    </details>
                                </div>
                                <div class="flex gap-2 ml-4">
                                    <button
                                        on:click={() =>
                                            startEditStyle(style, true)}
                                        class="text-blue-600 hover:text-blue-800 text-sm px-2 py-1 rounded border border-blue-200 hover:bg-blue-50"
                                        title="編輯風格"
                                    >
                                        ✏️ 編輯
                                    </button>
                                    {#if isStyleModified(style.id)}
                                        <button
                                            on:click={() =>
                                                resetDefaultStyle(style.id)}
                                            class="text-orange-600 hover:text-orange-800 text-sm px-2 py-1 rounded border border-orange-200 hover:bg-orange-50"
                                            title="恢復預設"
                                        >
                                            🔄 重置
                                        </button>
                                    {/if}
                                    <button
                                        on:click={() =>
                                            toggleStyleVisibility(style.id)}
                                        class="{isStyleHidden(style.id)
                                            ? 'text-gray-600 hover:text-gray-800'
                                            : 'text-purple-600 hover:text-purple-800'} text-sm px-2 py-1 rounded border {isStyleHidden(
                                            style.id,
                                        )
                                            ? 'border-gray-200 hover:bg-gray-50'
                                            : 'border-purple-200 hover:bg-purple-50'}"
                                        title={isStyleHidden(style.id)
                                            ? "顯示風格"
                                            : "隱藏風格"}
                                    >
                                        {isStyleHidden(style.id)
                                            ? "👁️ 顯示"
                                            : "🙈 隱藏"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    {/each}
                {:else}
                    <!-- 自訂風格 -->
                    {#if getFilteredCustomStyles().length > 0}
                        {#each getFilteredCustomStyles() as style}
                            <div
                                class="border border-green-200 bg-green-50 rounded-lg p-4"
                            >
                                <div class="flex justify-between items-start">
                                    <div class="flex-1">
                                        <div
                                            class="flex items-center gap-2 mb-2"
                                        >
                                            <h4
                                                class="font-medium text-gray-900"
                                            >
                                                {style.name}
                                            </h4>
                                            <span
                                                class="bg-green-600 text-white text-xs px-2 py-1 rounded"
                                                >自訂</span
                                            >
                                        </div>
                                        <p class="text-sm text-gray-600 mb-3">
                                            {style.description}
                                        </p>
                                        <details class="text-sm">
                                            <summary
                                                class="cursor-pointer text-gray-500 hover:text-gray-700 mb-2"
                                                >查看提示詞</summary
                                            >
                                            <div
                                                class="bg-white border rounded p-3 font-mono text-xs text-gray-600 max-h-32 overflow-y-auto"
                                            >
                                                {style.prompt}
                                            </div>
                                        </details>
                                    </div>
                                    <div class="flex gap-2 ml-4">
                                        <button
                                            on:click={() =>
                                                startEditStyle(style, false)}
                                            class="text-blue-600 hover:text-blue-800 text-sm px-2 py-1 rounded border border-blue-200 hover:bg-blue-50"
                                            title="編輯風格"
                                        >
                                            ✏️ 編輯
                                        </button>
                                        <button
                                            on:click={() =>
                                                toggleStyleVisibility(style.id)}
                                            class="{isStyleHidden(style.id)
                                                ? 'text-gray-600 hover:text-gray-800'
                                                : 'text-purple-600 hover:text-purple-800'} text-sm px-2 py-1 rounded border {isStyleHidden(
                                                style.id,
                                            )
                                                ? 'border-gray-200 hover:bg-gray-50'
                                                : 'border-purple-200 hover:bg-purple-50'}"
                                            title={isStyleHidden(style.id)
                                                ? "顯示風格"
                                                : "隱藏風格"}
                                        >
                                            {isStyleHidden(style.id)
                                                ? "👁️ 顯示"
                                                : "🙈 隱藏"}
                                        </button>
                                        <button
                                            on:click={() =>
                                                deleteCustomStyle(style.id)}
                                            class="text-red-600 hover:text-red-800 text-sm px-2 py-1 rounded border border-red-200 hover:bg-red-50"
                                            title="刪除風格"
                                        >
                                            🗑️ 刪除
                                        </button>
                                    </div>
                                </div>
                            </div>
                        {/each}
                    {:else}
                        <div class="text-center py-12 text-gray-500">
                            <div class="text-6xl mb-4">📝</div>
                            <h3 class="text-lg font-medium mb-2">
                                還沒有自訂風格
                            </h3>
                            <p class="text-sm mb-4">
                                點擊「新增自訂風格」建立您的專屬回覆風格
                            </p>
                            <button
                                on:click={startAddCustomStyle}
                                class="bg-blue-600 text-white py-2 px-4 rounded-md text-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                ➕ 立即新增
                            </button>
                        </div>
                    {/if}
                {/if}
            </div>

            <!-- 使用說明 -->
            <div
                class="mt-8 bg-yellow-50 border border-yellow-200 rounded-md p-4"
            >
                <h3 class="text-sm font-medium text-yellow-900 mb-2">
                    💡 使用說明
                </h3>
                <ul class="text-sm text-yellow-700 space-y-1">
                    <li>
                        • <strong>預設風格：</strong
                        >可以編輯和恢復，修改後會在所有地方生效
                    </li>
                    <li>
                        • <strong>自訂風格：</strong
                        >完全自由創建，可以刪除和編輯
                    </li>
                    <li>
                        • <strong>隱藏風格：</strong
                        >隱藏不需要的風格，讓選擇介面更簡潔
                    </li>
                    <li>
                        • <strong>批次回覆：</strong
                        >支援隨機選擇風格，讓回覆更自然多樣
                    </li>
                    <li>
                        • <strong>提示詞：</strong>使用清晰具體的指令獲得更好的
                        AI 回覆效果
                    </li>
                </ul>
            </div>
        </div>

        <!-- 品牌語調管理區塊 -->
        <div class="bg-white rounded-lg shadow-sm border p-8">
            <div class="text-center mb-6">
                <h2 class="text-2xl font-bold text-gray-900 mb-2">
                    🎵 品牌語調管理系統
                </h2>
                <p class="text-gray-600">
                    管理預設語調和自訂語調，創建您的專屬品牌聲音
                </p>
            </div>

            <!-- 頂部功能按鈕 -->
            <div class="flex flex-wrap gap-3 mb-6 p-4 bg-gray-50 rounded-lg">
                <button
                    on:click={startAddCustomBrandTone}
                    class="bg-blue-600 text-white py-2 px-4 rounded-md text-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    ➕ 新增自訂語調
                </button>
                <button
                    on:click={resetAllDefaultBrandTones}
                    class="bg-orange-600 text-white py-2 px-4 rounded-md text-sm hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                    🔄 重置所有預設語調
                </button>
                <button
                    on:click={() =>
                        (showHiddenBrandTones = !showHiddenBrandTones)}
                    class="{showHiddenBrandTones
                        ? 'bg-gray-600'
                        : 'bg-gray-400'} text-white py-2 px-4 rounded-md text-sm hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                    {showHiddenBrandTones
                        ? "👁️ 隱藏已隱藏語調"
                        : "👁️‍🗨️ 顯示已隱藏語調"}
                </button>
            </div>

            <!-- 標籤頁 -->
            <div class="flex border-b mb-6">
                <button
                    class="py-2 px-4 border-b-2 font-medium text-sm {activeBrandToneTab ===
                    'default'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'}"
                    on:click={() => (activeBrandToneTab = "default")}
                >
                    📋 預設語調 ({getEffectiveDefaultBrandTones()
                        .length}{showHiddenBrandTones
                        ? "/" + DEFAULT_BRAND_TONES.length
                        : ""})
                </button>
                <button
                    class="py-2 px-4 border-b-2 font-medium text-sm {activeBrandToneTab ===
                    'custom'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'}"
                    on:click={() => (activeBrandToneTab = "custom")}
                >
                    ✨ 自訂語調 ({getFilteredCustomBrandTones()
                        .length}{showHiddenBrandTones
                        ? "/" + customBrandTones.length
                        : ""})
                </button>
            </div>

            <!-- 編輯表單 -->
            {#if currentEditingBrandTone || showAddBrandToneForm}
                <div
                    class="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6"
                >
                    <h3 class="text-lg font-medium text-blue-900 mb-4">
                        {currentEditingBrandTone ? "編輯語調" : "新增自訂語調"}
                    </h3>

                    <div class="space-y-4">
                        <div>
                            <label
                                class="block text-sm font-medium text-gray-700 mb-1"
                                >語調名稱</label
                            >
                            <input
                                type="text"
                                bind:value={brandToneEditForm.name}
                                class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="例如：企業正式風格"
                            />
                        </div>

                        <div>
                            <label
                                class="block text-sm font-medium text-gray-700 mb-1"
                                >語調描述</label
                            >
                            <input
                                type="text"
                                bind:value={brandToneEditForm.description}
                                class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="例如：適合商務場合的正式專業語調"
                            />
                        </div>

                        <div>
                            <label
                                class="block text-sm font-medium text-gray-700 mb-1"
                                >提示詞</label
                            >
                            <textarea
                                bind:value={brandToneEditForm.prompt}
                                rows="4"
                                class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="請詳細描述這個語調的特點和使用場景，這將直接影響 AI 的回覆品質..."
                            ></textarea>
                        </div>
                    </div>

                    <div class="flex gap-3 mt-6">
                        <button
                            on:click={saveBrandTone}
                            class="bg-blue-600 text-white py-2 px-4 rounded-md text-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            💾 儲存
                        </button>
                        <button
                            on:click={cancelBrandToneEdit}
                            class="bg-gray-500 text-white py-2 px-4 rounded-md text-sm hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500"
                        >
                            ❌ 取消
                        </button>
                    </div>
                </div>
            {/if}

            <!-- 語調列表 -->
            <div class="space-y-4">
                {#if activeBrandToneTab === "default"}
                    <!-- 預設語調 -->
                    {#each getEffectiveDefaultBrandTones() as brandTone}
                        <div
                            class="border rounded-lg p-4 {isBrandToneModified(
                                brandTone.id,
                            )
                                ? 'border-orange-200 bg-orange-50'
                                : 'border-gray-200'}"
                        >
                            <div class="flex justify-between items-start">
                                <div class="flex-1">
                                    <div class="flex items-center gap-2 mb-2">
                                        <h3 class="font-medium text-gray-900">
                                            {brandTone.name}
                                        </h3>
                                        {#if isBrandToneModified(brandTone.id)}
                                            <span
                                                class="bg-orange-500 text-white text-xs px-2 py-1 rounded"
                                                >已修改</span
                                            >
                                        {/if}
                                        {#if isBrandToneHidden(brandTone.id)}
                                            <span
                                                class="bg-gray-500 text-white text-xs px-2 py-1 rounded"
                                                >已隱藏</span
                                            >
                                        {/if}
                                    </div>
                                    <p class="text-sm text-gray-600 mb-3">
                                        {brandTone.description}
                                    </p>
                                    <div
                                        class="bg-gray-100 p-3 rounded text-sm text-gray-700 font-mono"
                                    >
                                        {brandTone.prompt}
                                    </div>
                                </div>
                                <div class="flex gap-2 ml-4">
                                    <button
                                        on:click={() =>
                                            startEditBrandTone(brandTone, true)}
                                        class="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600"
                                    >
                                        ✏️ 編輯
                                    </button>
                                    {#if isBrandToneModified(brandTone.id)}
                                        <button
                                            on:click={() =>
                                                resetDefaultBrandTone(
                                                    brandTone.id,
                                                )}
                                            class="bg-orange-500 text-white px-3 py-1 rounded text-sm hover:bg-orange-600"
                                        >
                                            🔄 恢復
                                        </button>
                                    {/if}
                                    <button
                                        on:click={() =>
                                            toggleBrandToneVisibility(
                                                brandTone.id,
                                            )}
                                        class="{isBrandToneHidden(brandTone.id)
                                            ? 'bg-green-500'
                                            : 'bg-gray-500'} text-white px-3 py-1 rounded text-sm hover:opacity-80"
                                    >
                                        {isBrandToneHidden(brandTone.id)
                                            ? "👁️ 顯示"
                                            : "🙈 隱藏"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    {/each}
                {:else}
                    <!-- 自訂語調 -->
                    {#each getFilteredCustomBrandTones() as brandTone}
                        <div
                            class="border border-blue-200 bg-blue-50 rounded-lg p-4"
                        >
                            <div class="flex justify-between items-start">
                                <div class="flex-1">
                                    <div class="flex items-center gap-2 mb-2">
                                        <h3 class="font-medium text-gray-900">
                                            {brandTone.name}
                                        </h3>
                                        <span
                                            class="bg-blue-500 text-white text-xs px-2 py-1 rounded"
                                            >自訂</span
                                        >
                                        {#if isBrandToneHidden(brandTone.id)}
                                            <span
                                                class="bg-gray-500 text-white text-xs px-2 py-1 rounded"
                                                >已隱藏</span
                                            >
                                        {/if}
                                    </div>
                                    <p class="text-sm text-gray-600 mb-3">
                                        {brandTone.description}
                                    </p>
                                    <div
                                        class="bg-white p-3 rounded text-sm text-gray-700 font-mono border"
                                    >
                                        {brandTone.prompt}
                                    </div>
                                </div>
                                <div class="flex gap-2 ml-4">
                                    <button
                                        on:click={() =>
                                            startEditBrandTone(
                                                brandTone,
                                                false,
                                            )}
                                        class="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600"
                                    >
                                        ✏️ 編輯
                                    </button>
                                    <button
                                        on:click={() =>
                                            deleteCustomBrandTone(brandTone.id)}
                                        class="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600"
                                    >
                                        🗑️ 刪除
                                    </button>
                                    <button
                                        on:click={() =>
                                            toggleBrandToneVisibility(
                                                brandTone.id,
                                            )}
                                        class="{isBrandToneHidden(brandTone.id)
                                            ? 'bg-green-500'
                                            : 'bg-gray-500'} text-white px-3 py-1 rounded text-sm hover:opacity-80"
                                    >
                                        {isBrandToneHidden(brandTone.id)
                                            ? "👁️ 顯示"
                                            : "🙈 隱藏"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    {/each}

                    {#if getFilteredCustomBrandTones().length === 0}
                        <div class="text-center py-8 text-gray-500">
                            <div class="text-4xl mb-4">🎵</div>
                            <p class="text-lg font-medium mb-2">
                                還沒有自訂語調
                            </p>
                            <p class="text-sm">
                                點擊上方「新增自訂語調」按鈕來創建第一個自訂語調
                            </p>
                        </div>
                    {/if}
                {/if}
            </div>

            <!-- 使用說明 -->
            <div
                class="mt-8 bg-purple-50 border border-purple-200 rounded-md p-4"
            >
                <h3 class="text-sm font-medium text-purple-900 mb-2">
                    💡 品牌語調使用說明
                </h3>
                <ul class="text-sm text-purple-700 space-y-1">
                    <li>
                        • <strong>語調作用：</strong
                        >語調會與回覆風格結合，形成獨特的回覆特色
                    </li>
                    <li>
                        • <strong>組合效果：</strong>例如「幽默風趣 +
                        正式專業」= 正式場合的適度幽默
                    </li>
                    <li>
                        • <strong>預設語調：</strong
                        >可以編輯和恢復，修改後會在所有地方生效
                    </li>
                    <li>
                        • <strong>自訂語調：</strong
                        >為特定品牌或場景創建專屬的溝通風格
                    </li>
                    <li>
                        • <strong>語調提示：</strong>描述越具體，AI
                        回覆越準確符合預期
                    </li>
                </ul>
            </div>
        </div>
    </div>
</div>
