<script lang="ts">
    import { onMount } from "svelte";
    import browser from "webextension-polyfill";
    import {
        STORAGE_KEYS,
        REPLY_STYLES as DEFAULT_STYLES,
        BRAND_TONES as DEFAULT_BRAND_TONES,
    } from "../lib/constants";

    // --- State Variables ---
    let apiKey = ""; // Gemini API Key
    let loading = false;
    let message = "";
    let messageType: "success" | "error" = "success";

    // Multi-model API Keys
    let openaiApiKey = "";
    let claudeApiKey = "";
    let openrouterApiKey = "";
    let apiKeysLoading = false;

    // Model Selection
    let selectedModel = "x-ai/grok-code-fast-1"; // Default
    let modelSaving = false;

    // UI Preferences
    let showViralUI = false;
    let uiPreferencesSaving = false;

    // Available Models Configuration
    // Available Models Configuration
    const AVAILABLE_MODELS = [
        {
            id: "x-ai/grok-code-fast-1",
            name: "Grok Code Fast 1",
            provider: "OpenRouter",
            badge: "Fastest",
            badgeColor: "bg-teal-100 text-teal-800",
            description:
                "Optimized for coding and logical tasks. Rank #1 Speed.",
        },
        {
            id: "google/gemini-2.5-flash",
            name: "Gemini 2.5 Flash",
            provider: "OpenRouter",
            badge: "New",
            badgeColor: "bg-green-100 text-green-800",
            description: "Google's next-gen flash model. 440B tokens context.",
        },
        {
            id: "anthropic/claude-sonnet-4.5",
            name: "Claude Sonnet 4.5",
            provider: "OpenRouter",
            badge: "SOTA",
            badgeColor: "bg-amber-100 text-amber-800",
            description:
                "Anthropic's most intelligent model. Unmatched nuance.",
        },
        {
            id: "openai/gpt-oss-120b",
            name: "GPT-OSS 120B",
            provider: "OpenRouter",
            badge: "Open",
            badgeColor: "bg-purple-100 text-purple-800",
            description: "OpenAI's powerful open-source model.",
        },
    ];

    // Style Management State
    let customStyles: any[] = [];
    let modifiedDefaultStyles: any[] = [];
    let hiddenStyles: string[] = [];
    let currentEditingStyle: any = null;
    let showAddForm = false;
    let activeTab = "default"; // 'default' | 'custom'
    let showHiddenStyles = false;

    // Brand Tone Management State
    let customBrandTones: any[] = [];
    let modifiedDefaultBrandTones: any[] = [];
    let hiddenBrandTones: string[] = [];
    let currentEditingBrandTone: any = null;
    let showAddBrandToneForm = false;
    let activeBrandToneTab = "default"; // 'default' | 'custom'
    let showHiddenBrandTones = false;

    // Forms
    let editForm = { name: "", description: "", prompt: "" };
    let brandToneEditForm = { name: "", description: "", prompt: "" };

    // Style Cloning State
    let customStyleExamples = "";
    let examplesSaving = false;

    // --- Lifecycle ---
    onMount(async () => {
        await loadApiKeys();
        await loadSelectedModel();
        await loadShowViralUI();
        await loadStyles();
        await loadBrandTones();
        await loadCustomStyleExamples();
    });

    async function loadCustomStyleExamples() {
        try {
            const result = await browser.storage.local.get(
                STORAGE_KEYS.CUSTOM_STYLE_EXAMPLES,
            );
            customStyleExamples =
                result[STORAGE_KEYS.CUSTOM_STYLE_EXAMPLES] || "";
        } catch (error) {
            console.error("Failed to load custom style examples:", error);
        }
    }

    async function saveCustomStyleExamples() {
        examplesSaving = true;
        try {
            await browser.storage.local.set({
                [STORAGE_KEYS.CUSTOM_STYLE_EXAMPLES]:
                    customStyleExamples.trim(),
            });
            showMessage("風格 DNA 已儲存！", "success");
        } catch (error) {
            showMessage("儲存失敗", "error");
        }
        examplesSaving = false;
    }

    // --- Loaders ---
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
            console.error("Failed to load API Keys:", error);
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
            showViralUI =
                result[STORAGE_KEYS.SHOW_VIRAL_UI] !== undefined
                    ? result[STORAGE_KEYS.SHOW_VIRAL_UI]
                    : true;
        } catch (error) {
            console.error("Failed to load UI preferences:", error);
        }
    }

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
            console.error("Failed to load styles:", error);
        }
    }

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
            console.error("Failed to load brand tones:", error);
        }
    }

    // --- Actions: General ---
    function showMessage(text: string, type: "success" | "error") {
        message = text;
        messageType = type;
        setTimeout(() => {
            message = "";
        }, 3000);
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
            showMessage("儲存失敗", "error");
        }
        modelSaving = false;
    }

    // --- Actions: API Keys ---
    async function saveApiKey() {
        if (!apiKey.trim()) return showMessage("請輸入 API Key", "error");
        loading = true;
        try {
            await browser.storage.local.set({
                [STORAGE_KEYS.GEMINI_API_KEY]: apiKey.trim(),
            });
            showMessage("Gemini API Key 儲存成功！", "success");
        } catch (error) {
            showMessage("儲存失敗", "error");
        }
        loading = false;
    }

    async function clearApiKey() {
        loading = true;
        try {
            await browser.storage.local.remove(STORAGE_KEYS.GEMINI_API_KEY);
            apiKey = "";
            showMessage("已清除", "success");
        } catch (error) {
            showMessage("清除失敗", "error");
        }
        loading = false;
    }

    // ... (OpenAI, Claude, OpenRouter specific save/clear functions omitted for brevity, logic is same as standard pattern. I will implement generic handler or specific ones)
    // Implementing specific ones to ensure compatibility with existing code structure
    async function saveOpenAIKey() {
        if (!openaiApiKey.trim() || !openaiApiKey.startsWith("sk-"))
            return showMessage("無效的 OpenAI Key", "error");
        apiKeysLoading = true;
        try {
            await browser.storage.local.set({
                [STORAGE_KEYS.OPENAI_API_KEY]: openaiApiKey.trim(),
            });
            showMessage("OpenAI API Key 儲存成功", "success");
        } catch (e) {
            showMessage("儲存失敗", "error");
        }
        apiKeysLoading = false;
    }
    async function clearOpenAIKey() {
        apiKeysLoading = true;
        try {
            await browser.storage.local.remove(STORAGE_KEYS.OPENAI_API_KEY);
            openaiApiKey = "";
            showMessage("已清除", "success");
        } catch (e) {
            showMessage("失敗", "error");
        }
        apiKeysLoading = false;
    }

    async function saveClaudeKey() {
        if (!claudeApiKey.trim() || !claudeApiKey.startsWith("sk-ant-"))
            return showMessage("無效的 Claude Key", "error");
        apiKeysLoading = true;
        try {
            await browser.storage.local.set({
                [STORAGE_KEYS.CLAUDE_API_KEY]: claudeApiKey.trim(),
            });
            showMessage("Claude API Key 儲存成功", "success");
        } catch (e) {
            showMessage("儲存失敗", "error");
        }
        apiKeysLoading = false;
    }
    async function clearClaudeKey() {
        apiKeysLoading = true;
        try {
            await browser.storage.local.remove(STORAGE_KEYS.CLAUDE_API_KEY);
            claudeApiKey = "";
            showMessage("已清除", "success");
        } catch (e) {
            showMessage("失敗", "error");
        }
        apiKeysLoading = false;
    }

    async function saveOpenRouterKey() {
        if (!openrouterApiKey.trim() || !openrouterApiKey.startsWith("sk-or-"))
            return showMessage("無效的 OpenRouter Key", "error");
        apiKeysLoading = true;
        try {
            await browser.storage.local.set({
                [STORAGE_KEYS.OPENROUTER_API_KEY]: openrouterApiKey.trim(),
            });
            showMessage("OpenRouter API Key 儲存成功", "success");
        } catch (e) {
            showMessage("儲存失敗", "error");
        }
        apiKeysLoading = false;
    }
    async function clearOpenRouterKey() {
        apiKeysLoading = true;
        try {
            await browser.storage.local.remove(STORAGE_KEYS.OPENROUTER_API_KEY);
            openrouterApiKey = "";
            showMessage("已清除", "success");
        } catch (e) {
            showMessage("失敗", "error");
        }
        apiKeysLoading = false;
    }

    // --- Helpers: External Links ---
    function openUrl(url: string) {
        browser.tabs.create({ url });
    }

    // --- Helpers: Styles & Tones Logic (Getters) ---
    function getEffectiveDefaultStyles() {
        const all = DEFAULT_STYLES.map(
            (d) => modifiedDefaultStyles.find((m) => m.id === d.id) || d,
        );
        return showHiddenStyles
            ? all
            : all.filter((s) => !hiddenStyles.includes(s.id));
    }
    function getFilteredCustomStyles() {
        return showHiddenStyles
            ? customStyles
            : customStyles.filter((s) => !hiddenStyles.includes(s.id));
    }
    function getEffectiveDefaultBrandTones() {
        const all = DEFAULT_BRAND_TONES.map(
            (d) => modifiedDefaultBrandTones.find((m) => m.id === d.id) || d,
        );
        return showHiddenBrandTones
            ? all
            : all.filter((s) => !hiddenBrandTones.includes(s.id));
    }
    function getFilteredCustomBrandTones() {
        return showHiddenBrandTones
            ? customBrandTones
            : customBrandTones.filter((s) => !hiddenBrandTones.includes(s.id));
    }
    function isStyleModified(id: string) {
        return modifiedDefaultStyles.some((s) => s.id === id);
    }
    function isStyleHidden(id: string) {
        return hiddenStyles.includes(id);
    }
    function isBrandToneModified(id: string) {
        return modifiedDefaultBrandTones.some((s) => s.id === id);
    }
    function isBrandToneHidden(id: string) {
        return hiddenBrandTones.includes(id);
    }

    function notifyStylesUpdated() {
        browser.tabs
            .query({})
            .then((tabs) =>
                tabs.forEach(
                    (t) =>
                        t.id &&
                        browser.tabs
                            .sendMessage(t.id, { type: "STYLES_UPDATED" })
                            .catch(() => {}),
                ),
            );
    }
    function notifyBrandTonesUpdated() {
        browser.tabs
            .query({})
            .then((tabs) =>
                tabs.forEach(
                    (t) =>
                        t.id &&
                        browser.tabs
                            .sendMessage(t.id, { type: "BRAND_TONES_UPDATED" })
                            .catch(() => {}),
                ),
            );
    }

    // --- Actions: Styles CRUD ---
    // (Consolidated logic for brevity but fully functional)
    function startEditStyle(style: any, isDefault = false) {
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
        editForm = { name: "", description: "", prompt: "" };
        showAddForm = true;
        activeTab = "custom";
    }
    function cancelEdit() {
        currentEditingStyle = null;
        showAddForm = false;
        editForm = { name: "", description: "", prompt: "" };
    }

    async function saveStyle() {
        if (!editForm.name.trim() || !editForm.prompt.trim())
            return showMessage("請填寫必要欄位", "error");
        try {
            if (currentEditingStyle?.isDefault) {
                const updated = {
                    ...currentEditingStyle,
                    ...editForm,
                    isCustom: false,
                };
                const idx = modifiedDefaultStyles.findIndex(
                    (s) => s.id === currentEditingStyle.id,
                );
                if (idx >= 0) modifiedDefaultStyles[idx] = updated;
                else
                    modifiedDefaultStyles = [...modifiedDefaultStyles, updated];
                await browser.storage.local.set({ modifiedDefaultStyles });
            } else if (currentEditingStyle) {
                const updated = { ...currentEditingStyle, ...editForm };
                const idx = customStyles.findIndex(
                    (s) => s.id === currentEditingStyle.id,
                );
                customStyles[idx] = updated;
                await browser.storage.local.set({ customStyles });
            } else {
                const newStyle = {
                    id: `custom_${Date.now()}`,
                    ...editForm,
                    isCustom: true,
                };
                customStyles = [...customStyles, newStyle];
                await browser.storage.local.set({ customStyles });
            }
            notifyStylesUpdated();
            cancelEdit();
            showMessage("儲存成功", "success");
        } catch (e) {
            showMessage("儲存失敗", "error");
        }
    }

    async function deleteCustomStyle(id: string) {
        if (!confirm("確認刪除？")) return;
        customStyles = customStyles.filter((s) => s.id !== id);
        await browser.storage.local.set({ customStyles });
        notifyStylesUpdated();
    }
    async function resetDefaultStyle(id: string) {
        if (!confirm("確認重置？")) return;
        modifiedDefaultStyles = modifiedDefaultStyles.filter(
            (s) => s.id !== id,
        );
        await browser.storage.local.set({ modifiedDefaultStyles });
        notifyStylesUpdated();
    }
    async function resetAllDefaultStyles() {
        if (!confirm("確認全部重置？")) return;
        modifiedDefaultStyles = [];
        await browser.storage.local.set({ modifiedDefaultStyles });
        notifyStylesUpdated();
    }
    async function toggleStyleVisibility(id: string) {
        if (hiddenStyles.includes(id))
            hiddenStyles = hiddenStyles.filter((s) => s !== id);
        else hiddenStyles = [...hiddenStyles, id];
        await browser.storage.local.set({ hiddenStyles });
        notifyStylesUpdated();
    }

    // --- Actions: Brand Tones CRUD ---
    // (Similar to Styles, consolidated)
    function startEditBrandTone(tone: any, isDefault = false) {
        currentEditingBrandTone = { ...tone, isDefault };
        brandToneEditForm = {
            name: tone.name,
            description: tone.description,
            prompt: tone.prompt,
        };
        showAddBrandToneForm = false;
    }
    function startAddCustomBrandTone() {
        currentEditingBrandTone = null;
        brandToneEditForm = { name: "", description: "", prompt: "" };
        showAddBrandToneForm = true;
        activeBrandToneTab = "custom";
    }
    function cancelBrandToneEdit() {
        currentEditingBrandTone = null;
        showAddBrandToneForm = false;
        brandToneEditForm = { name: "", description: "", prompt: "" };
    }

    async function saveBrandTone() {
        if (!brandToneEditForm.name.trim() || !brandToneEditForm.prompt.trim())
            return showMessage("請填寫必要欄位", "error");
        try {
            if (currentEditingBrandTone?.isDefault) {
                const updated = {
                    ...currentEditingBrandTone,
                    ...brandToneEditForm,
                    isCustom: false,
                };
                const idx = modifiedDefaultBrandTones.findIndex(
                    (s) => s.id === currentEditingBrandTone.id,
                );
                if (idx >= 0) modifiedDefaultBrandTones[idx] = updated;
                else
                    modifiedDefaultBrandTones = [
                        ...modifiedDefaultBrandTones,
                        updated,
                    ];
                await browser.storage.local.set({ modifiedDefaultBrandTones });
            } else if (currentEditingBrandTone) {
                const updated = {
                    ...currentEditingBrandTone,
                    ...brandToneEditForm,
                };
                const idx = customBrandTones.findIndex(
                    (s) => s.id === currentEditingBrandTone.id,
                );
                customBrandTones[idx] = updated;
                await browser.storage.local.set({ customBrandTones });
            } else {
                const newTone = {
                    id: `custom_${Date.now()}`,
                    ...brandToneEditForm,
                    isCustom: true,
                };
                customBrandTones = [...customBrandTones, newTone];
                await browser.storage.local.set({ customBrandTones });
            }
            notifyBrandTonesUpdated();
            cancelBrandToneEdit();
            showMessage("儲存成功", "success");
        } catch (e) {
            showMessage("儲存失敗", "error");
        }
    }

    async function deleteCustomBrandTone(id: string) {
        if (!confirm("確認刪除？")) return;
        customBrandTones = customBrandTones.filter((s) => s.id !== id);
        await browser.storage.local.set({ customBrandTones });
        notifyBrandTonesUpdated();
    }
    async function resetDefaultBrandTone(id: string) {
        if (!confirm("確認重置？")) return;
        modifiedDefaultBrandTones = modifiedDefaultBrandTones.filter(
            (s) => s.id !== id,
        );
        await browser.storage.local.set({ modifiedDefaultBrandTones });
        notifyBrandTonesUpdated();
    }
    async function resetAllDefaultBrandTones() {
        if (!confirm("確認全部重置？")) return;
        modifiedDefaultBrandTones = [];
        await browser.storage.local.set({ modifiedDefaultBrandTones });
        notifyBrandTonesUpdated();
    }
    async function toggleBrandToneVisibility(id: string) {
        if (hiddenBrandTones.includes(id))
            hiddenBrandTones = hiddenBrandTones.filter((s) => s !== id);
        else hiddenBrandTones = [...hiddenBrandTones, id];
        await browser.storage.local.set({ hiddenBrandTones });
        notifyBrandTonesUpdated();
    }
</script>

<div
    class="h-screen w-full bg-surface-50 text-slate-900 overflow-y-auto selection:bg-primary-100 font-sans"
>
    <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <!-- Header -->
        <header class="mb-12 text-center animate-fade-in">
            <h1
                class="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-primary-600 to-secondary-600 bg-clip-text text-transparent sm:text-5xl mb-4"
            >
                SonarAgent Settings
            </h1>
            <p class="text-lg text-slate-500 max-w-2xl mx-auto">
                您的 AI 智慧回覆助手控制中心。配置模型，定義風格，打造專屬體驗。
            </p>
        </header>

        <!-- Message Toast (Floating) -->
        {#if message}
            <div class="fixed top-6 right-6 z-50 animate-slide-up">
                <div
                    class="flex items-center gap-3 px-6 py-4 rounded-2xl shadow-lg border backdrop-blur-md
                    {messageType === 'success'
                        ? 'bg-green-50/90 border-green-200 text-green-800'
                        : 'bg-red-50/90 border-red-200 text-red-800'}"
                >
                    <span class="text-2xl"
                        >{messageType === "success" ? "✅" : "⚠️"}</span
                    >
                    <span class="font-medium">{message}</span>
                </div>
            </div>
        {/if}

        <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <!-- Sidebar Navigation (Desktop) / Tabs (Mobile) - Conceptually simplified to stacked sections for now but laid out cleaner -->
            <div class="lg:col-span-12 space-y-8">
                <!-- Section: Interface Settings -->
                <section
                    class="bg-white rounded-3xl shadow-sm border border-surface-200 overflow-hidden transform transition-all hover:shadow-md"
                >
                    <div
                        class="p-8 border-b border-surface-100 bg-surface-50/50"
                    >
                        <div class="flex items-center justify-between">
                            <div>
                                <h2 class="text-2xl font-bold text-slate-900">
                                    介面偏好
                                </h2>
                                <p class="text-slate-500 mt-1">
                                    自訂您的使用體驗
                                </p>
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
                                    class="w-14 h-7 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-primary-500"
                                ></div>
                            </label>
                        </div>
                    </div>
                </section>

                <!-- Section: Models & API Keys -->
                <section
                    class="bg-white rounded-3xl shadow-sm border border-surface-200 overflow-hidden"
                >
                    <div
                        class="p-8 border-b border-surface-100 bg-surface-50/50"
                    >
                        <h2 class="text-2xl font-bold text-slate-900">
                            AI 模型設定
                        </h2>
                        <p class="text-slate-500 mt-1">
                            選擇並配置您的 AI 服務提供者
                        </p>
                    </div>

                    <div class="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                        <!-- Model Selection -->
                        <div class="space-y-4">
                            <h3
                                class="text-lg font-bold text-slate-800 flex items-center gap-2"
                            >
                                <span>🤖</span> 選擇預設模型
                            </h3>
                            <div class="space-y-3">
                                {#each AVAILABLE_MODELS as model}
                                    <label
                                        class="relative flex items-start p-4 rounded-xl border-2 cursor-pointer transition-all duration-200
                                        {selectedModel === model.id
                                            ? 'border-primary-500 bg-primary-50/30'
                                            : 'border-surface-200 hover:border-primary-200 hover:bg-surface-50'}"
                                    >
                                        <div class="flex items-center h-5">
                                            <input
                                                type="radio"
                                                name="model"
                                                value={model.id}
                                                bind:group={selectedModel}
                                                on:change={saveSelectedModel}
                                                disabled={modelSaving}
                                                class="h-5 w-5 text-primary-600 focus:ring-primary-500 border-gray-300"
                                            />
                                        </div>
                                        <div class="ml-4 flex-1">
                                            <div
                                                class="flex items-center justify-between"
                                            >
                                                <span
                                                    class="font-bold text-slate-900"
                                                    >{model.name}</span
                                                >
                                                <span
                                                    class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {model.badgeColor}"
                                                >
                                                    {model.badge}
                                                </span>
                                            </div>
                                            <p
                                                class="text-sm text-slate-500 mt-1"
                                            >
                                                {model.description}
                                            </p>
                                        </div>
                                    </label>
                                {/each}
                            </div>
                        </div>

                        <!-- Right Column: API Keys -->
                        <div class="space-y-6">
                            <!-- OpenRouter (Unified Key) -->
                            <div
                                class="p-5 bg-surface-50 rounded-2xl border border-surface-100"
                            >
                                <label
                                    class="flex justify-between text-sm font-semibold text-slate-700 mb-2"
                                >
                                    <span>OpenRouter API Key (Unified)</span>
                                    <button
                                        on:click={() =>
                                            openUrl(
                                                "https://openrouter.ai/keys",
                                            )}
                                        class="text-primary-600 hover:underline"
                                        >取得 Key ↗</button
                                    >
                                </label>
                                <div class="flex gap-2">
                                    <input
                                        type="password"
                                        bind:value={openrouterApiKey}
                                        placeholder="sk-or-..."
                                        class="flex-1 rounded-xl border-surface-300 focus:ring-primary-500 focus:border-primary-500 text-sm py-2.5"
                                    />
                                    <button
                                        on:click={saveOpenRouterKey}
                                        class="px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-800 transition"
                                        >儲存</button
                                    >
                                </div>
                                <p class="text-xs text-slate-500 mt-2">
                                    * 所有新版模型 (Grok, Gemini 3, GPT-5,
                                    Claude 4.5) 皆透過 OpenRouter
                                    存取，只需設定此 Key。
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                <!-- Section: Personal Style DNA -->
                <section
                    class="bg-white rounded-3xl shadow-sm border border-surface-200 overflow-hidden"
                >
                    <div
                        class="p-8 border-b border-surface-100 bg-surface-50/50"
                    >
                        <h2 class="text-2xl font-bold text-slate-900">
                            🧬 個人風格 DNA (Style Cloning)
                        </h2>
                        <p class="text-slate-500 mt-1">
                            教 AI 學會您的說話方式。請貼上 3-5
                            則您過去滿意的回覆範例。
                        </p>
                    </div>
                    <div class="p-8 space-y-4">
                        <textarea
                            bind:value={customStyleExamples}
                            rows="6"
                            class="w-full rounded-xl border-surface-300 focus:ring-primary-500 focus:border-primary-500 text-sm p-4 font-mono leading-relaxed"
                            placeholder="- 範例 1：笑死 這個真的超有感 🫠&#10;- 範例 2：確實... 上次去的時候也是這樣&#10;- 範例 3：沒事啦 下次會更好 加油 🔥"
                        ></textarea>
                        <div class="flex justify-end">
                            <button
                                on:click={saveCustomStyleExamples}
                                disabled={examplesSaving}
                                class="px-6 py-2.5 bg-gradient-to-r from-primary-600 to-secondary-600 text-white rounded-xl font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-50"
                            >
                                {examplesSaving ? "儲存中..." : "儲存 DNA"}
                            </button>
                        </div>
                    </div>
                </section>

                <!-- Section: Styles & Tones (Merged Concept for better UX) -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <!-- Reply Styles -->
                    <section
                        class="bg-white rounded-3xl shadow-sm border border-surface-200 overflow-hidden flex flex-col h-full"
                    >
                        <div
                            class="p-6 border-b border-surface-100 bg-surface-50/50 flex justify-between items-center"
                        >
                            <div>
                                <h2 class="text-xl font-bold text-slate-900">
                                    🎨 回覆風格
                                </h2>
                                <p class="text-sm text-slate-500">
                                    定義 AI 的回答方式
                                </p>
                            </div>
                            <button
                                on:click={startAddCustomStyle}
                                class="px-3 py-1.5 bg-primary-500 text-white text-xs font-bold rounded-lg hover:bg-primary-600 transition"
                                >＋ 新增</button
                            >
                        </div>

                        <div
                            class="flex-1 p-6 space-y-4 max-h-[600px] overflow-y-auto"
                        >
                            <!-- Tabs for Styles -->
                            <div
                                class="flex gap-2 mb-4 bg-surface-100 p-1 rounded-xl w-fit"
                            >
                                <button
                                    on:click={() => (activeTab = "default")}
                                    class="px-4 py-1.5 rounded-lg text-sm font-medium transition-all {activeTab ===
                                    'default'
                                        ? 'bg-white text-slate-900 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'}"
                                    >預設</button
                                >
                                <button
                                    on:click={() => (activeTab = "custom")}
                                    class="px-4 py-1.5 rounded-lg text-sm font-medium transition-all {activeTab ===
                                    'custom'
                                        ? 'bg-white text-slate-900 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'}"
                                    >自訂</button
                                >
                            </div>

                            <!-- Edit Form Highlight -->
                            {#if currentEditingStyle || showAddForm}
                                <div
                                    class="mb-6 p-5 bg-primary-50 rounded-2xl border border-primary-100 animate-fade-in"
                                >
                                    <h4 class="font-bold text-primary-900 mb-3">
                                        {currentEditingStyle
                                            ? "編輯風格"
                                            : "新增風格"}
                                    </h4>
                                    <div class="space-y-3">
                                        <input
                                            type="text"
                                            bind:value={editForm.name}
                                            placeholder="風格名稱"
                                            class="w-full rounded-xl border-surface-200 text-sm"
                                        />
                                        <textarea
                                            bind:value={editForm.prompt}
                                            rows="3"
                                            placeholder="提示詞 (Prompt)"
                                            class="w-full rounded-xl border-surface-200 text-sm"
                                        ></textarea>
                                        <div class="flex justify-end gap-2">
                                            <button
                                                on:click={cancelEdit}
                                                class="px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-surface-200 rounded-lg"
                                                >取消</button
                                            >
                                            <button
                                                on:click={saveStyle}
                                                class="px-3 py-1.5 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                                                >儲存</button
                                            >
                                        </div>
                                    </div>
                                </div>
                            {/if}

                            <!-- List -->
                            <div class="space-y-3">
                                {#each activeTab === "default" ? getEffectiveDefaultStyles() : getFilteredCustomStyles() as style}
                                    <div
                                        class="group relative p-4 rounded-xl border bg-white transition hover:shadow-md {isStyleModified(
                                            style.id,
                                        )
                                            ? 'border-amber-200 bg-amber-50/20'
                                            : 'border-surface-200'}"
                                    >
                                        <div
                                            class="flex justify-between items-start"
                                        >
                                            <div>
                                                <h4
                                                    class="font-bold text-slate-800 text-sm"
                                                >
                                                    {style.name}
                                                </h4>
                                                <p
                                                    class="text-xs text-slate-500 line-clamp-2 mt-1"
                                                >
                                                    {style.description ||
                                                        style.prompt}
                                                </p>
                                            </div>
                                            <div
                                                class="flex gap-1 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <button
                                                    on:click={() =>
                                                        startEditStyle(
                                                            style,
                                                            activeTab ===
                                                                "default",
                                                        )}
                                                    class="p-1.5 text-slate-400 hover:text-primary-600 rounded-lg hover:bg-primary-50"
                                                    >✎</button
                                                >
                                                {#if activeTab === "custom"}
                                                    <button
                                                        on:click={() =>
                                                            deleteCustomStyle(
                                                                style.id,
                                                            )}
                                                        class="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                                                        >🗑</button
                                                    >
                                                {:else if isStyleModified(style.id)}
                                                    <button
                                                        on:click={() =>
                                                            resetDefaultStyle(
                                                                style.id,
                                                            )}
                                                        class="p-1.5 text-amber-500 hover:text-amber-700 rounded-lg hover:bg-amber-50"
                                                        >↺</button
                                                    >
                                                {/if}
                                            </div>
                                        </div>
                                    </div>
                                {/each}
                            </div>
                        </div>
                    </section>

                    <!-- Brand Tones -->
                    <section
                        class="bg-white rounded-3xl shadow-sm border border-surface-200 overflow-hidden flex flex-col h-full"
                    >
                        <div
                            class="p-6 border-b border-surface-100 bg-surface-50/50 flex justify-between items-center"
                        >
                            <div>
                                <h2 class="text-xl font-bold text-slate-900">
                                    🎵 品牌語調
                                </h2>
                                <p class="text-sm text-slate-500">
                                    定義專屬的說話口氣
                                </p>
                            </div>
                            <button
                                on:click={startAddCustomBrandTone}
                                class="px-3 py-1.5 bg-secondary-500 text-white text-xs font-bold rounded-lg hover:bg-secondary-600 transition"
                                >＋ 新增</button
                            >
                        </div>

                        <div
                            class="flex-1 p-6 space-y-4 max-h-[600px] overflow-y-auto"
                        >
                            <!-- Tabs for Tones -->
                            <div
                                class="flex gap-2 mb-4 bg-surface-100 p-1 rounded-xl w-fit"
                            >
                                <button
                                    on:click={() =>
                                        (activeBrandToneTab = "default")}
                                    class="px-4 py-1.5 rounded-lg text-sm font-medium transition-all {activeBrandToneTab ===
                                    'default'
                                        ? 'bg-white text-slate-900 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'}"
                                    >預設</button
                                >
                                <button
                                    on:click={() =>
                                        (activeBrandToneTab = "custom")}
                                    class="px-4 py-1.5 rounded-lg text-sm font-medium transition-all {activeBrandToneTab ===
                                    'custom'
                                        ? 'bg-white text-slate-900 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'}"
                                    >自訂</button
                                >
                            </div>

                            <!-- Edit Form Highlight -->
                            {#if currentEditingBrandTone || showAddBrandToneForm}
                                <div
                                    class="mb-6 p-5 bg-secondary-50 rounded-2xl border border-secondary-100 animate-fade-in"
                                >
                                    <h4
                                        class="font-bold text-secondary-900 mb-3"
                                    >
                                        {currentEditingBrandTone
                                            ? "編輯語調"
                                            : "新增語調"}
                                    </h4>
                                    <div class="space-y-3">
                                        <input
                                            type="text"
                                            bind:value={brandToneEditForm.name}
                                            placeholder="語調名稱"
                                            class="w-full rounded-xl border-surface-200 text-sm"
                                        />
                                        <textarea
                                            bind:value={
                                                brandToneEditForm.prompt
                                            }
                                            rows="3"
                                            placeholder="提示詞 (Prompt)"
                                            class="w-full rounded-xl border-surface-200 text-sm"
                                        ></textarea>
                                        <div class="flex justify-end gap-2">
                                            <button
                                                on:click={cancelBrandToneEdit}
                                                class="px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-surface-200 rounded-lg"
                                                >取消</button
                                            >
                                            <button
                                                on:click={saveBrandTone}
                                                class="px-3 py-1.5 text-sm font-medium bg-secondary-600 text-white rounded-lg hover:bg-secondary-700"
                                                >儲存</button
                                            >
                                        </div>
                                    </div>
                                </div>
                            {/if}

                            <!-- List -->
                            <div class="space-y-3">
                                {#each activeBrandToneTab === "default" ? getEffectiveDefaultBrandTones() : getFilteredCustomBrandTones() as tone}
                                    <div
                                        class="group relative p-4 rounded-xl border bg-white transition hover:shadow-md {isBrandToneModified(
                                            tone.id,
                                        )
                                            ? 'border-amber-200 bg-amber-50/20'
                                            : 'border-surface-200'}"
                                    >
                                        <div
                                            class="flex justify-between items-start"
                                        >
                                            <div>
                                                <h4
                                                    class="font-bold text-slate-800 text-sm"
                                                >
                                                    {tone.name}
                                                </h4>
                                                <p
                                                    class="text-xs text-slate-500 line-clamp-2 mt-1"
                                                >
                                                    {tone.description ||
                                                        tone.prompt}
                                                </p>
                                            </div>
                                            <div
                                                class="flex gap-1 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <button
                                                    on:click={() =>
                                                        startEditBrandTone(
                                                            tone,
                                                            activeBrandToneTab ===
                                                                "default",
                                                        )}
                                                    class="p-1.5 text-slate-400 hover:text-secondary-600 rounded-lg hover:bg-secondary-50"
                                                    >✎</button
                                                >
                                                {#if activeBrandToneTab === "custom"}
                                                    <button
                                                        on:click={() =>
                                                            deleteCustomBrandTone(
                                                                tone.id,
                                                            )}
                                                        class="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                                                        >🗑</button
                                                    >
                                                {:else if isBrandToneModified(tone.id)}
                                                    <button
                                                        on:click={() =>
                                                            resetDefaultBrandTone(
                                                                tone.id,
                                                            )}
                                                        class="p-1.5 text-amber-500 hover:text-amber-700 rounded-lg hover:bg-amber-50"
                                                        >↺</button
                                                    >
                                                {/if}
                                            </div>
                                        </div>
                                    </div>
                                {/each}
                            </div>
                        </div>
                    </section>
                </div>

                <!-- Footer Utils -->
                <div class="flex justify-center gap-4 text-xs text-slate-400">
                    <button
                        on:click={resetAllDefaultStyles}
                        class="hover:text-red-500 transition"
                        >重置所有風格</button
                    >
                    <span>|</span>
                    <button
                        on:click={resetAllDefaultBrandTones}
                        class="hover:text-red-500 transition"
                        >重置所有語調</button
                    >
                </div>
            </div>
        </div>
    </div>
</div>
