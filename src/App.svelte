<script lang="ts">
  import browser from "webextension-polyfill";
</script>

<div class="popup-container">
  <!-- Header -->
  <header class="header">
    <div class="logo-icon">
      <img
        src="/icon/icon-128x128.png"
        alt="SonarAgent Logo"
        style="width: 100%; height: 100%; object-fit: contain;"
      />
    </div>
    <h1 class="title">SonarAgent</h1>
    <p class="subtitle">感謝使用我們的擴充功能！</p>
  </header>

  <!-- Actions -->
  <section class="card">
    <button
      on:click={() => browser.runtime.openOptionsPage()}
      class="btn btn-primary"
    >
      ⚙️ 開啟設定 (Open Settings)
    </button>
    <p class="card-description mt-4 text-center">
      設定 AI 模型、API Key 與介面偏好
    </p>
  </section>

  <!-- Links -->
  <div class="links">
    <a href="https://www.threads.net/@ray.realms" target="_blank" class="link">
      🧵 追蹤開發者
    </a>
  </div>
</div>

<style>
  .popup-container {
    padding: 32px;
    min-width: 350px;
    max-width: 400px;
    background-color: #ffffff;
    color: #000000;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
      sans-serif;
  }

  /* Header */
  .header {
    margin-bottom: 24px;
    text-align: center;
  }

  .logo-icon {
    width: 60px;
    height: 60px;
    /* background: linear-gradient(45deg, #22c55e, #3b82f6); */
    border-radius: 15px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28px;
    margin: 0 auto 16px;
  }

  .title {
    margin: 0 0 8px 0;
    font-size: 24px;
    font-weight: 700;
    background: linear-gradient(45deg, #22c55e, #3b82f6);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .subtitle {
    margin: 0;
    font-size: 16px;
    opacity: 0.8;
    line-height: 1.5;
  }

  /* Cards */
  .card {
    background: rgba(0, 0, 0, 0.05);
    border-radius: 16px;
    padding: 24px;
    margin-bottom: 24px;
  }

  .card-description {
    margin: 8px 0 0 0;
    font-size: 14px;
    line-height: 1.5;
    opacity: 0.8;
    text-align: center;
  }

  /* Buttons */
  .btn {
    display: block;
    width: 100%;
    padding: 12px;
    text-decoration: none;
    border-radius: 12px;
    text-align: center;
    font-weight: 600;
    border: none;
    cursor: pointer;
    transition: all 0.2s ease;
    box-sizing: border-box;
    font-size: 14px;
  }

  .btn:hover {
    transform: translateY(-2px);
  }

  .btn-primary {
    background: #000000;
    color: #ffffff;
  }

  .btn-primary:hover {
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
  }

  /* Links */
  .links {
    text-align: center;
    margin-top: 16px;
  }

  .link {
    color: #666;
    text-decoration: none;
    font-size: 13px;
    transition: color 0.2s;
  }

  .link:hover {
    color: #000;
    text-decoration: underline;
  }
</style>
