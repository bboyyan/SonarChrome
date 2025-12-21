<script lang="ts">
  import browser from "webextension-polyfill";
  import { onMount } from "svelte";
  import { STORAGE_KEYS } from "./lib/constants";

  let isAiReady = false;
  let showViralUI = true;
  let loading = true;

  onMount(async () => {
    try {
      const data = await browser.storage.local.get([
        STORAGE_KEYS.GEMINI_API_KEY,
        STORAGE_KEYS.OPENAI_API_KEY,
        STORAGE_KEYS.CLAUDE_API_KEY,
        STORAGE_KEYS.OPENROUTER_API_KEY,
        STORAGE_KEYS.SHOW_VIRAL_UI,
      ]);

      // Check if any API key is present
      isAiReady = !!(
        data[STORAGE_KEYS.GEMINI_API_KEY] ||
        data[STORAGE_KEYS.OPENAI_API_KEY] ||
        data[STORAGE_KEYS.CLAUDE_API_KEY] ||
        data[STORAGE_KEYS.OPENROUTER_API_KEY]
      );

      showViralUI = data[STORAGE_KEYS.SHOW_VIRAL_UI] ?? true;
    } catch (e) {
      console.error("Failed to load settings:", e);
    } finally {
      loading = false;
    }
  });

  async function toggleViralUI() {
    showViralUI = !showViralUI;
    await browser.storage.local.set({
      [STORAGE_KEYS.SHOW_VIRAL_UI]: showViralUI,
    });
  }

  async function openOptions() {
    try {
      await browser.runtime.openOptionsPage();
    } catch (e) {
      // Fallback
      const optionsUrl = browser.runtime.getURL("src/options/options.html");
      await browser.tabs.create({ url: optionsUrl });
    }
  }
</script>

<div
  class="w-[360px] min-h-[420px] bg-slate-50 flex flex-col font-sans transition-colors duration-300"
>
  <!-- Status Bar -->
  <div
    class="px-6 py-3 flex items-center justify-between border-b border-slate-100 bg-white/80 backdrop-blur-md sticky top-0 z-10"
  >
    <div class="flex items-center gap-2">
      <div class="relative flex h-2.5 w-2.5">
        {#if isAiReady}
          <span
            class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"
          ></span>
          <span
            class="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"
          ></span>
        {:else}
          <span
            class="relative inline-flex rounded-full h-2.5 w-2.5 bg-slate-300"
          ></span>
        {/if}
      </div>
      <span
        class="text-xs font-semibold {isAiReady
          ? 'text-emerald-700'
          : 'text-slate-500'}"
      >
        {isAiReady ? "AI 服務運作中" : "未設定 API Key"}
      </span>
    </div>

    {#if !loading && !isAiReady}
      <button
        on:click={openOptions}
        class="text-xs text-primary-600 hover:text-primary-700 font-medium underline underline-offset-2"
      >
        前往設定
      </button>
    {/if}
  </div>

  <main class="flex-1 p-6 flex flex-col items-center w-full">
    <!-- Hero Branding -->
    <div class="mb-8 text-center group">
      <div class="mb-4 relative inline-block">
        <div
          class="absolute inset-0 bg-gradient-to-tr from-sky-400 to-indigo-500 rounded-2xl blur-lg opacity-20 group-hover:opacity-40 transition-opacity duration-500"
        ></div>
        <img
          src="/icon/icon-128x128.png"
          alt="Sonar"
          class="relative w-20 h-20 rounded-2xl shadow-xl transform group-hover:scale-105 transition-transform duration-300"
        />
      </div>
      <h1 class="text-2xl font-black text-slate-900 tracking-tight mb-1">
        Sonar<span
          class="text-transparent bg-clip-text bg-gradient-to-r from-sky-500 to-indigo-600"
          >Agent</span
        >
      </h1>
      <p class="text-xs font-medium text-slate-500 uppercase tracking-widest">
        Command Center
      </p>
    </div>

    <!-- Quick Actions Card -->
    <div
      class="w-full bg-white rounded-2xl p-1 shadow-sm border border-slate-100 mb-6"
    >
      <label
        class="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors group/item"
      >
        <div class="flex items-center gap-3">
          <div
            class="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-lg shadow-sm group-hover/item:scale-110 transition-transform"
          >
            🔥
          </div>
          <div class="flex flex-col">
            <span class="text-sm font-bold text-slate-700">爆文分析 UI</span>
            <span class="text-[10px] text-slate-400 leading-tight"
              >顯示貼文情感與指標</span
            >
          </div>
        </div>

        <!-- Toggle Switch -->
        <button
          on:click|preventDefault={toggleViralUI}
          class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none {showViralUI
            ? 'bg-indigo-500'
            : 'bg-slate-200'}"
        >
          <span class="sr-only">Toggle Viral UI</span>
          <span
            class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out {showViralUI
              ? 'translate-x-5'
              : 'translate-x-0'}"
          ></span>
        </button>
      </label>
    </div>

    <!-- Primary Action: Open Dashbord -->
    <button
      on:click={openOptions}
      class="w-full group relative overflow-hidden rounded-xl bg-slate-900 p-4 shadow-lg transition-all hover:shadow-2xl hover:-translate-y-0.5"
    >
      <div
        class="absolute inset-0 bg-gradient-to-r from-sky-600 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
      ></div>
      <div class="relative flex items-center justify-center gap-3">
        <span class="text-white font-bold text-base tracking-wide"
          >開啟設定與模型</span
        >
        <svg
          class="w-5 h-5 text-indigo-300 group-hover:text-white transition-colors"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M13 7l5 5m0 0l-5 5m5-5H6"
          />
        </svg>
      </div>
    </button>
  </main>

  <!-- Footer -->
  <footer
    class="p-4 flex justify-center border-t border-slate-100 bg-slate-50/50"
  >
    <a
      href="https://www.threads.net/@choyeh5"
      target="_blank"
      class="flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors py-2 px-4 rounded-full hover:bg-white hover:shadow-sm"
    >
      <span>🤝</span>
      <span>追蹤開發者 @choyeh5</span>
    </a>
  </footer>
</div>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    font-family:
      "Inter",
      system-ui,
      -apple-system,
      sans-serif;
    -webkit-font-smoothing: antialiased;
  }
</style>
