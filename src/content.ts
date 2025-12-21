import browser from "webextension-polyfill";
import { type LikeThreshold, DEFAULT_THRESHOLDS } from "./types";
import { REPLY_STYLES, BRAND_TONES, STORAGE_KEYS } from './lib/constants';
import type { ReplyStyle, BrandTone } from './lib/types';

class ThreadsHelper {
  private thresholds: LikeThreshold[] = DEFAULT_THRESHOLDS;
  private observer: MutationObserver | null = null;
  private logoElement: HTMLElement | null = null;
  private modalElement: HTMLElement | null = null;


  constructor() {
    this.init();
  }

  private async init() {
    await this.loadSettings();
    await this.loadSettings();
    const showViralUI = await this.shouldShowViralUI();
    if (showViralUI) {
      this.processExistingPosts();
      this.createObserver();
      await this.checkPaymentStatus();
      this.createLogo();
    }

  }

  private async shouldShowViralUI(): Promise<boolean> {
    try {
      const result = await browser.storage.local.get(STORAGE_KEYS.SHOW_VIRAL_UI);
      return result[STORAGE_KEYS.SHOW_VIRAL_UI] !== undefined ? result[STORAGE_KEYS.SHOW_VIRAL_UI] : true; // Default to true
    } catch (error) {
      console.error("Failed to check Viral UI setting:", error);
      return true; // Default to true on error
    }
  }

  private async loadSettings() {
    try {
      const result = await browser.storage.sync.get(["thresholds"]);
      if (result.thresholds) {
        this.thresholds = result.thresholds;
      }
    } catch (error) {
      console.error("Failed to load settings:", error);
    }
  }

  private async checkPaymentStatus() {
    try {
      const result = await browser.storage.local.get([
        "isPaidUser",
        "logoRemoved",
      ]);
      // 如果已經是付費用戶或者Logo被移除了，就不創建Logo
      if (result.isPaidUser || result.logoRemoved) {
        return;
      }
    } catch (error) {
      console.error("Failed to check payment status:", error);
    }
  }

  private createObserver() {
    this.observer = new MutationObserver((mutations) => {
      let shouldProcess = false;

      mutations.forEach((mutation) => {
        if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element;
              if (
                element.querySelector?.('div[data-pressable-container="true"]')
              ) {
                shouldProcess = true;
              }
            }
          });
        }
      });

      if (shouldProcess) {
        setTimeout(() => this.processExistingPosts(), 100);
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }



  private getPostTime(post: HTMLElement): Date | null {
    const timeElement = post.querySelector("time");
    if (timeElement) {
      const datetime = timeElement.getAttribute("datetime");
      return datetime ? new Date(datetime) : null;
    }
    return null;
  }

  private calculateHourlyGrowth(post: HTMLElement): number | string | null {
    const likeCount = this.getLikeCount(post);
    const postTime = this.getPostTime(post);

    if (!postTime || likeCount === 0) return null;

    const now = new Date();
    const hoursElapsed =
      (now.getTime() - postTime.getTime()) / (1000 * 60 * 60);

    // 如果文章太新（少於30分鐘），不顯示增長率
    if (hoursElapsed < 0.5) return null;

    // 如果超過24小時，顯示 "大於一天"
    if (hoursElapsed > 24) return ">1天";

    return Math.round(likeCount / hoursElapsed);
  }

  private processExistingPosts() {
    const posts = document.querySelectorAll(
      'div[data-pressable-container="true"]'
    );
    posts.forEach((post) => this.processPost(post as HTMLElement));
  }

  private processPost(post: HTMLElement) {
    if (post.dataset.threadsHelperProcessed) {
      return;
    }

    if (!this.isRootPost(post)) {
      return;
    }

    const likeCount = this.getLikeCount(post);
    const threshold = this.getThresholdForLikes(likeCount);
    const viralPrediction = this.checkViralPotential(post);

    if (threshold || viralPrediction) {
      this.addBookmarkButton(post, viralPrediction);
    }

    post.dataset.threadsHelperProcessed = "true";
  }

  private isRootPost(post: HTMLElement): boolean {
    return !!post.querySelector(
      'svg[aria-label="轉發"], svg[aria-label="Repost"], svg[aria-label="Share"], svg[aria-label="分享"]'
    );
  }

  private getLikeCount(post: HTMLElement): number {
    const labels = ["讚", "Like"];
    for (const label of labels) {
      const selectors = [
        `svg[aria-label="${label}"]`,
        `svg[aria-label="收回${label}"]`,
        `svg[aria-label="Un${label}"]`,
        `svg[aria-label="取消${label}"]`,
      ];

      const svg = post.querySelector(selectors.join(", "));
      if (svg) {
        const span = svg
          .closest('div[role="button"]')
          ?.querySelector("span span, span");
        if (span) {
          const text = span.textContent || "0";
          return parseInt(text.replace(/\D/g, ""), 10) || 0;
        }
      }
    }
    return 0;
  }

  private getThresholdForLikes(likeCount: number): LikeThreshold | null {
    for (const threshold of this.thresholds) {
      if (likeCount >= threshold.min && likeCount <= threshold.max) {
        return threshold;
      }
    }
    return null;
  }

  private checkViralPotential(post: HTMLElement): boolean {
    const likeCount = this.getLikeCount(post);
    const postTime = this.getPostTime(post);

    if (!postTime || likeCount >= 100) return false;

    const now = new Date();
    const minutesElapsed = (now.getTime() - postTime.getTime()) / (1000 * 60);

    // 檢查發文時間是否在 3 分鐘到 1 小時之間
    if (minutesElapsed < 3 || minutesElapsed > 60) return false;

    const hoursElapsed = minutesElapsed / 60;
    const hourlyGrowthRate = likeCount / hoursElapsed;

    // 每小時讚數增長率超過 60
    return hourlyGrowthRate >= 60;
  }

  private isDarkMode(): boolean {
    return document.documentElement.classList.contains("__fb-dark-mode");
  }



  private addBookmarkButton(
    post: HTMLElement,
    // threshold parameter removed
    isViralPrediction: boolean = false
  ) {
    const existing = post.querySelector(".threads-helper-bookmark");
    if (existing) {
      existing.remove();
    }

    const hourlyGrowth = this.calculateHourlyGrowth(post);
    if (!hourlyGrowth && !isViralPrediction) return; // Don't show if no interesting data

    // Design System Configuration
    let config = {
      icon: "📈",
      gradient: "linear-gradient(135deg, rgba(16, 185, 129, 0.9), rgba(5, 150, 105, 0.9))", // Emerald
      text: "Growth",
      label: `每小時 +${hourlyGrowth} 讚`,
      glowColor: "rgba(16, 185, 129, 0.4)"
    };

    if (isViralPrediction) {
      config = {
        icon: "⚡",
        gradient: "linear-gradient(135deg, rgba(139, 92, 246, 0.9), rgba(59, 130, 246, 0.9))", // Violet -> Blue
        text: "Trending",
        label: "爆文預警：近期急速竄升",
        glowColor: "rgba(139, 92, 246, 0.5)"
      };
    } else if (typeof hourlyGrowth === 'number' && hourlyGrowth >= 100) {
      config = {
        icon: "🔥",
        gradient: "linear-gradient(135deg, rgba(245, 158, 11, 0.9), rgba(239, 68, 68, 0.9))", // Orange -> Red
        text: "Hot",
        label: `火熱討論：每小時 +${hourlyGrowth} 讚`,
        glowColor: "rgba(245, 158, 11, 0.5)"
      };
    }

    const bookmarkBtn = document.createElement("div");
    bookmarkBtn.className = "threads-helper-bookmark";

    // Glassmorphism Container Style
    bookmarkBtn.style.cssText = `
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      background: ${config.gradient};
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 9999px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255,255,255,0.1) inset;
      cursor: pointer;
      z-index: 100;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      opacity: 0.95;
      margin-right: 16px; 
      height: 28px;
      flex-shrink: 0;
      white-space: nowrap;
    `;

    // Content HTML
    const growthText = typeof hourlyGrowth === 'number' || typeof hourlyGrowth === 'string' ? `+${hourlyGrowth}/h` : '';
    bookmarkBtn.innerHTML = `
      <span style="font-size: 14px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));">${config.icon}</span>
      <div style="display: flex; flex-direction: column; line-height: 1;">
        <span style="font-size: 11px; font-weight: 700; color: white; letter-spacing: 0.3px; text-shadow: 0 1px 2px rgba(0,0,0,0.1);">${config.text}</span>
        <span style="font-size: 9px; font-weight: 500; color: rgba(255,255,255,0.9); margin-top: 1px;">${growthText}</span>
      </div>
      
      <!-- Tooltip -->
      <div class="helper-tooltip" style="
        position: absolute;
        bottom: 100%;
        left: 50%;
        transform: translateX(-50%) translateY(-8px);
        background: rgba(0, 0, 0, 0.85);
        color: white;
        padding: 6px 10px;
        border-radius: 8px;
        font-size: 11px;
        white-space: nowrap;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.2s, transform 0.2s;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        backdrop-filter: blur(4px);
        margin-bottom: 6px;
        font-weight: 500;
        z-index: 110;
      ">
        ${config.label}
        <div style="
          position: absolute;
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          border-width: 5px;
          border-style: solid;
          border-color: rgba(0, 0, 0, 0.85) transparent transparent transparent;
        "></div>
      </div>
    `;

    // Interactions
    bookmarkBtn.onmouseenter = () => {
      bookmarkBtn.style.transform = "translateY(-2px) scale(1.02)";
      bookmarkBtn.style.boxShadow = `0 8px 20px ${config.glowColor}, 0 0 0 1px rgba(255,255,255,0.2) inset`;
      const tooltip = bookmarkBtn.querySelector('.helper-tooltip') as HTMLElement;
      if (tooltip) {
        tooltip.style.opacity = '1';
        tooltip.style.transform = 'translateX(-50%) translateY(-8px)';
      }
    };

    bookmarkBtn.onmouseleave = () => {
      bookmarkBtn.style.transform = "translateY(0) scale(1)";
      bookmarkBtn.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255,255,255,0.1) inset";
      const tooltip = bookmarkBtn.querySelector('.helper-tooltip') as HTMLElement;
      if (tooltip) {
        tooltip.style.opacity = '0';
        tooltip.style.transform = 'translateX(-50%) translateY(-4px)';
      }
    };

    // Add styles if not present
    if (!document.querySelector("#threads-helper-new-style")) {
      const style = document.createElement("style");
      style.id = "threads-helper-new-style";
      style.textContent = `
        @keyframes subtle-pulse {
          0% { box-shadow: 0 0 0 0 ${config.glowColor}; }
          70% { box-shadow: 0 0 0 6px rgba(0,0,0,0); }
          100% { box-shadow: 0 0 0 0 rgba(0,0,0,0); }
        }
      `;
      document.head.appendChild(style);
    }

    // Viral specific animation
    if (isViralPrediction) {
      bookmarkBtn.style.animation = "subtle-pulse 3s infinite";
    }

    // Find 'More' button to insert before
    // Force Absolute Position to avoid clipping/layout issues in small containers
    bookmarkBtn.style.position = 'absolute';
    bookmarkBtn.style.top = '10px'; // Move it up slightly to clear text
    bookmarkBtn.style.right = '56px';
    bookmarkBtn.style.marginRight = '0';
    // Add stronger glassmorphism to let text show through if overlapped
    bookmarkBtn.style.background = config.gradient.replace('0.9', '0.7').replace('0.9', '0.7');
    bookmarkBtn.style.backdropFilter = "blur(4px)"; // Reduce blur to see text behind slightly better or keep it high? kept high for glass effect, but transparency helps.


    // Ensure parent has positioning context
    const computedStyle = window.getComputedStyle(post);
    if (computedStyle.position === 'static') {
      post.style.position = 'relative';
    }

    post.appendChild(bookmarkBtn);
  }

  private async createLogo() {
    if (this.logoElement) return;

    // Inject refined styles
    if (!document.querySelector("#sonar-floating-styles")) {
      const style = document.createElement("style");
      style.id = "sonar-floating-styles";
      style.textContent = `
        .sonar-floating-logo {
          position: fixed;
          top: 24px;
          right: 24px;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 16px 8px 8px;
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.4);
          border-radius: 99px;
          box-shadow: 
            0 4px 6px -1px rgba(0, 0, 0, 0.05),
            0 10px 15px -3px rgba(0, 0, 0, 0.05),
            0 0 0 1px rgba(255, 255, 255, 0.3) inset;
          cursor: pointer;
          z-index: 10000;
          font-family: 'Inter', -apple-system, sans-serif;
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          user-select: none;
          transform: translateZ(0);
        }

        .__fb-dark-mode .sonar-floating-logo {
          background: rgba(30, 41, 59, 0.85); /* Slate-800 */
          border-color: rgba(255, 255, 255, 0.1);
          box-shadow: 
            0 4px 6px -1px rgba(0, 0, 0, 0.2),
            0 10px 15px -3px rgba(0, 0, 0, 0.2),
            0 0 0 1px rgba(255, 255, 255, 0.05) inset;
        }

        .sonar-floating-logo:hover {
          transform: translateY(-2px) scale(1.02);
          box-shadow: 
            0 10px 25px -5px rgba(14, 165, 233, 0.25), /* Sky-500 glow */
            0 0 0 1px rgba(255, 255, 255, 0.5) inset;
        }
        
        .sonar-logo-icon {
          width: 32px;
          height: 32px;
          border-radius: 10px;
          overflow: hidden;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .sonar-logo-text {
          font-size: 14px;
          font-weight: 700;
          color: #0f172a; /* Slate-900 */
          letter-spacing: -0.01em;
        }
        
        .__fb-dark-mode .sonar-logo-text {
          color: #f8fafc; /* Slate-50 */
        }
      `;
      document.head.appendChild(style);
    }

    const logo = document.createElement("div");
    logo.className = "sonar-floating-logo";
    logo.innerHTML = `
      <div class="sonar-logo-icon">
        <img src="${browser.runtime.getURL('sonar-icon.png')}" style="width: 100%; height: 100%; object-fit: cover;" alt="Sonar">
      </div>
      <span class="sonar-logo-text">SonarAgent</span>
    `;

    logo.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.showSponsorModal();
    });

    document.body.appendChild(logo);
    this.logoElement = logo;
  }

  private showSponsorModal() {
    if (this.modalElement) {
      this.modalElement.remove();
      this.modalElement = null;
    }

    // Inject Modal Styles
    if (!document.querySelector("#sonar-modal-styles")) {
      const style = document.createElement("style");
      style.id = "sonar-modal-styles";
      style.textContent = `
        .sonar-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.6); /* Slate-900/60 */
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10001;
          animation: sonar-fade-in 0.3s ease-out;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        }

        .sonar-modal-card {
          background: rgba(255, 255, 255, 0.9);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(255, 255, 255, 0.5);
          border-radius: 24px;
          padding: 40px;
          width: 90%;
          max-width: 420px;
          max-height: 85vh;
          overflow-y: auto;
          box-shadow: 
            0 20px 25px -5px rgba(0, 0, 0, 0.1), 
            0 8px 10px -6px rgba(0, 0, 0, 0.1),
            0 0 0 1px rgba(255, 255, 255, 0.5) inset;
          animation: sonar-slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          color: #0f172a; /* Slate-900 */
        }

        /* Dark Mode Support */
        .__fb-dark-mode .sonar-modal-card {
          background: rgba(30, 41, 59, 0.9); /* Slate-800 */
          border-color: rgba(255, 255, 255, 0.1);
          color: #f8fafc; /* Slate-50 */
          box-shadow: 
            0 20px 25px -5px rgba(0, 0, 0, 0.3), 
            0 0 0 1px rgba(255, 255, 255, 0.05) inset;
        }

        .sonar-modal-header {
          text-align: center;
          margin-bottom: 32px;
        }

        .sonar-modal-icon {
          width: 64px;
          height: 64px;
          margin: 0 auto 16px;
          border-radius: 18px;
          background: linear-gradient(135deg, #0ea5e9, #6366f1); /* Sky to Indigo */
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 32px;
          box-shadow: 0 10px 20px -5px rgba(99, 102, 241, 0.3);
        }

        .sonar-modal-title {
          font-size: 24px;
          font-weight: 800;
          margin: 0 0 8px;
          background: linear-gradient(135deg, #0284c7, #4f46e5);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .__fb-dark-mode .sonar-modal-title {
          background: linear-gradient(135deg, #38bdf8, #818cf8);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .sonar-modal-desc {
          font-size: 15px;
          color: #64748b; /* Slate-500 */
          line-height: 1.5;
          margin: 0;
        }

        .__fb-dark-mode .sonar-modal-desc {
          color: #94a3b8; /* Slate-400 */
        }

        .sonar-section {
          background: rgba(241, 245, 249, 0.5); /* Slate-100/50 */
          border: 1px solid rgba(203, 213, 225, 0.5);
          border-radius: 16px;
          padding: 20px;
          margin-bottom: 24px;
          transition: transform 0.2s;
        }

        .__fb-dark-mode .sonar-section {
          background: rgba(255, 255, 255, 0.03);
          border-color: rgba(255, 255, 255, 0.05);
        }

        .sonar-section:hover {
          transform: translateY(-2px);
        }

        .sonar-section-title {
          font-size: 16px;
          font-weight: 600;
          margin: 0 0 12px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .sonar-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          padding: 12px;
          border-radius: 12px;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
          text-decoration: none;
          gap: 8px;
        }

        .sonar-btn-primary {
          background: #0f172a;
          color: white;
        }

        .__fb-dark-mode .sonar-btn-primary {
          background: #f8fafc;
          color: #0f172a;
        }

        .sonar-btn-primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 10px 20px -5px rgba(0,0,0,0.1);
        }
        
        @keyframes sonar-fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes sonar-slide-up { 
          from { opacity: 0; transform: translateY(20px) scale(0.96); } 
          to { opacity: 1; transform: translateY(0) scale(1); } 
        }
      `;
      document.head.appendChild(style);
    }

    const modal = document.createElement("div");
    modal.className = "sonar-modal-overlay";

    // Check Dark Mode for initial class
    if (this.isDarkMode()) {
      modal.classList.add("__fb-dark-mode");
    }

    modal.innerHTML = `
      <div class="sonar-modal-card" style="padding: 0; overflow: hidden; max-width: 360px; border-radius: 20px;">
        
        <!-- Status Bar -->
        <div style="padding: 12px 24px; display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.8); backdrop-filter: blur(12px); border-bottom: 1px solid rgba(0,0,0,0.05);">
             <div style="display: flex; align-items: center; gap: 8px;">
                 <div style="width: 10px; height: 10px; background: #10b981; border-radius: 50%; box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2);"></div>
                 <span style="font-size: 12px; font-weight: 600; color: #059669;">AI 服務運作中</span>
             </div>
             <a href="#" class="sonar-link-text settings-link" style="font-size: 12px; color: #4f46e5; text-decoration: none; font-weight: 500;">前往設定</a>
        </div>

        <div style="padding: 24px;">
            <!-- Hero -->
            <div style="text-align: center; margin-bottom: 32px;">
                <div style="position: relative; width: 80px; height: 80px; margin: 0 auto 16px;">
                    <div style="position: absolute; inset: 0; background: linear-gradient(135deg, #38bdf8, #6366f1); filter: blur(20px); opacity: 0.3; border-radius: 24px;"></div>
                    <img src="${browser.runtime.getURL('sonar-icon.png')}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 20px; box-shadow: 0 10px 20px rgba(0,0,0,0.1); position: relative; z-index: 1;" alt="Sonar">
                </div>
                <h2 style="font-size: 24px; font-weight: 900; color: #0f172a; margin: 0; letter-spacing: -0.5px;">
                    Sonar<span style="background: linear-gradient(to right, #0ea5e9, #4f46e5); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Agent</span>
                </h2>
                <p style="font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #64748b; font-weight: 600; margin-top: 4px;">Command Center</p>
            </div>

            <!-- Toggle Card -->
            <div style="background: white; border: 1px solid #f1f5f9; border-radius: 16px; padding: 12px; margin-bottom: 24px; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 2px 5px rgba(0,0,0,0.03);">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="width: 36px; height: 36px; background: #e0e7ff; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 18px; color: #4f46e5;">
                        🔥
                    </div>
                    <div>
                        <div style="font-size: 14px; font-weight: 700; color: #1e293b;">爆文分析 UI</div>
                        <div style="font-size: 10px; color: #94a3b8;">顯示貼文情感與指標</div>
                    </div>
                </div>
                <!-- Fake Toggle (Visual Only for now, logic handled in Popup) -->
                 <div style="width: 44px; height: 24px; background: #6366f1; border-radius: 99px; position: relative; cursor: pointer;">
                    <div style="width: 20px; height: 20px; background: white; border-radius: 50%; position: absolute; top: 2px; right: 2px; box-shadow: 0 1px 3px rgba(0,0,0,0.2);"></div>
                 </div>
            </div>
            
            <!-- Main Button -->
             <button class="settings-btn" style="
                width: 100%;
                background: #0f172a;
                color: white;
                border: none;
                padding: 16px;
                border-radius: 14px;
                font-size: 15px;
                font-weight: 700;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                cursor: pointer;
                box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.3);
                transition: transform 0.2s;
             ">
                <span>開放設定與模型</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color: #a5b4fc;"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>
             </button>

        </div>
        
        <!-- Footer -->
        <div style="background: #f8fafc; padding: 16px; text-align: center; border-top: 1px solid #f1f5f9;">
             <a href="https://www.threads.net/@choyeh5" target="_blank" style="display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: #64748b; text-decoration: none; padding: 6px 16px; background: white; border-radius: 99px; border: 1px solid #e2e8f0;">
                <span>🤝</span> 追蹤開發者 @choyeh5
             </a>
        </div>

      </div>

    `;

    // Click Outside Close
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.remove();
        this.modalElement = null;
      }
    });

    // Link Actions
    const settingsLinks = modal.querySelectorAll('.settings-link, .settings-btn');
    settingsLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        browser.runtime.sendMessage({ type: 'OPEN_OPTIONS' });
        modal.remove();
        this.modalElement = null;
      });
    });

    document.body.appendChild(modal);
    this.modalElement = modal;
  }


  public async updateThresholds(newThresholds: LikeThreshold[]) {
    this.thresholds = newThresholds;
    const posts = document.querySelectorAll(
      'div[data-pressable-container="true"]'
    );
    posts.forEach((post) => {
      const existing = (post as HTMLElement).querySelector(
        ".threads-helper-bookmark"
      );
      if (existing) {
        existing.remove();
        (post as HTMLElement).dataset.threadsHelperProcessed = "";
      }
    });
    this.processExistingPosts();
  }

  public cleanup() {
    if (this.observer) {
      this.observer.disconnect();
    }
    if (this.logoElement) {
      this.logoElement.remove();
      this.logoElement = null;
    }
    if (this.modalElement) {
      this.modalElement.remove();
      this.modalElement = null;
    }
  }
}

class ThreadsAIAssistant {
  private observer: MutationObserver | null = null;
  private isInjected = false;
  private selectedTone: BrandTone | null = null;
  private useKaomoji: boolean = false;
  private isHostMode: boolean = false; // Manual toggle for "Host Mode"
  private localStorageKey = 'threads-ai-settings';

  constructor() {
    this.init();
    console.log('🤖 Threads AI Assistant 已載入');
  }

  private init() {
    if (this.isInjected) return;
    this.isInjected = true;

    this.loadSettings(); // Load cached settings
    this.injectButtons();
    this.startObserver();
    this.setupMessageListener();
  }

  private loadSettings() {
    try {
      const stored = localStorage.getItem(this.localStorageKey);
      if (stored) {
        const settings = JSON.parse(stored);
        // this.useEmoji removed
        this.useKaomoji = settings.useKaomoji ?? false;
      }
    } catch (e) {
      console.error('Failed to load local settings', e);
    }
  }

  private saveSettings() {
    try {
      localStorage.setItem(this.localStorageKey, JSON.stringify({
        // useEmoji removed
        useKaomoji: this.useKaomoji
      }));
    } catch (e) {
      console.error('Failed to save settings', e);
    }
  }

  private injectButtons() {
    const posts = this.findPosts();
    // console.log(`🔍 找到 ${posts.length} 個貼文`);
    posts.forEach((post) => {
      this.addButtonToPost(post);
    });
  }

  private findPosts(): Element[] {
    // 多種選擇器來匹配 Threads 的不同貼文結構
    const selectors = [
      '[data-pressable-container="true"]',
      'article',
      '[role="article"]',
      'div[style*="border"]',
      'div[data-testid*="post"]',
      'div[data-testid*="thread"]',
      // 針對 Activity 頁面的額外選擇器
      'div[role="button"]:has(span[dir="auto"])',
      'div[role="link"]:has(span[dir="auto"])'
    ];

    let posts: Element[] = [];

    for (const selector of selectors) {
      try {
        const elements = document.querySelectorAll(selector);
        posts = posts.concat(Array.from(elements));
      } catch (e) {
        // Ignore invalid selectors if any
      }
    }

    // 去重並過濾有效貼文
    const uniquePosts = posts.filter((post, index, arr) =>
      arr.indexOf(post) === index
    );

    return uniquePosts.filter(post => {
      // 排除 Sonar 自己的 UI 元素
      if (post.closest('.sonar-modal-overlay') || post.closest('.sonar-floating-logo')) return false;

      // 排除太小的元素 (可能是按鈕本身)
      if (post.getBoundingClientRect().height < 50) return false;

      // 檢查是否包含文字內容
      const hasText = post.querySelector('[dir="auto"]') ||
        post.querySelector('p') ||
        post.querySelector('span') ||
        (post.textContent && post.textContent.trim().length > 5); // 放寬文字長度限制

      // 檢查是否有互動按鈕（讚、回覆等）
      // 在 Activity 頁面，可能沒有明確的角色為 button 的互動區，但會有文字和結構
      // 所以我們放寬對 Actions 的檢查，只要看起來像貼文即可
      const hasActions = post.querySelector('[role="button"]') ||
        post.querySelector('button') ||
        post.querySelector('[aria-label*="like"]') ||
        post.querySelector('[aria-label*="reply"]') ||
        post.querySelector('[aria-label*="讚"]') ||
        post.querySelector('[aria-label*="回覆"]');

      // 或者它是 Activity 頁面的一個項目 (通常有時間戳)
      const hasTime = post.querySelector('time');

      // 確保還沒有添加我們的按鈕
      const alreadyHasButton = post.querySelector('.threads-ai-button');

      return hasText && (hasActions || hasTime) && !alreadyHasButton;
    });
  }

  private addButtonToPost(post: Element) {
    if (post.querySelector('.threads-ai-button')) {
      return;
    }

    const aiButton = this.createAIButton(post);

    // 優先尋找分享按鈕
    const shareButton = post.querySelector('div[role="button"][aria-label="分享"], div[role="button"][aria-label="Share"], svg[aria-label="分享"], svg[aria-label="Share"]')?.closest('div[role="button"]');

    if (shareButton) {
      shareButton.after(aiButton);
    } else {
      // 嘗試多種方式找到動作按鈕容器 (Fallback)
      let actionsContainer = post.querySelector('[style*="flex-direction: row"]') ||
        post.querySelector('[style*="display: flex"]') ||
        post.querySelector('div[role="group"]') ||
        post.querySelector('div:has(> button)') ||
        post.querySelector('div:has([role="button"])');

      // 如果找不到容器，嘗試找到任何按鈕並取其父元素
      if (!actionsContainer) {
        const anyButton = post.querySelector('button') || post.querySelector('[role="button"]');
        if (anyButton) {
          actionsContainer = anyButton.parentElement;
        }
      }

      const container = actionsContainer as HTMLElement;
      if (container) {
        container.appendChild(aiButton);
      }
    }
  }

  private createAIButton(post: Element): HTMLElement {
    const button = document.createElement('button');
    button.className = 'threads-ai-button';
    button.style.cssText = `
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      border: none;
      background: transparent;
      border-radius: 50%;
      cursor: pointer;
      margin-left: 8px;
      transition: all 0.2s ease;
      font-size: 18px;
      color: #65676b;
    `;

    button.innerHTML = '✨';
    button.title = 'AI 智慧回覆';

    button.addEventListener('mouseenter', () => {
      button.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
      button.style.transform = 'scale(1.1)';
    });

    button.addEventListener('mouseleave', () => {
      button.style.backgroundColor = 'transparent';
      button.style.transform = 'scale(1)';
    });

    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.showStyleSelector(post, button);
    });

    return button;
  }

  private showStyleSelector(post: Element, button: HTMLElement) {
    this.hideExistingSelectors();

    const selector = this.createStyleSelector(post);

    // Initial hidden state for calculation
    selector.style.visibility = 'hidden';
    selector.style.position = 'fixed';
    selector.style.top = '0';
    selector.style.left = '0';
    // Add max-height/width constraints to prevent it from being huge
    selector.style.maxHeight = '60vh';
    selector.style.maxWidth = '90vw';
    selector.style.overflowY = 'auto';

    document.body.appendChild(selector);

    const buttonRect = button.getBoundingClientRect();
    const selectorRect = selector.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const padding = 16;

    // Default: Below
    let top = buttonRect.bottom + 8;
    let left = buttonRect.left;

    // 1. Vertical Logic
    // If not enough space below
    if (top + selectorRect.height > viewportHeight - padding) {
      const spaceAbove = buttonRect.top - padding;
      const spaceBelow = viewportHeight - top - padding;

      // If fits above, go above
      if (spaceAbove > selectorRect.height) {
        top = buttonRect.top - selectorRect.height - 8;
      } else {
        // If neither fits perfectly, pick the larger side and cap the height
        if (spaceAbove > spaceBelow) {
          // Pin to top margin, set max-height to fit between top and button
          top = padding; // actually logic: go as high as needed but max at padding
          // BETTER SCRIPT: Position above button, but cap height
          // Logic: "Above" means top = buttonRect.top - height - 8.
          // If height is too big, we need to shrink it? 
          // Let's just pin to top padding if huge.
          // Or simply:
          top = Math.max(padding, buttonRect.top - selectorRect.height - 8);
          // Force max-height if needed? selector.style.maxHeight is already 60vh.
          // If 60vh fits, great. If not, it will scroll.

          // If current top + height > button top? No, logic is:
          // We want to be above. 
          // If we pin to padding, are we overlapping button?
          // If padding + height > button.top, we overlap.

          // Let's simplify:
          // If fits above? yes -> go above.
          // If not fits above (and not below)?
          // Check which space is bigger.
          // If space above is bigger:
          //   top = padding;
          //   maxHeight = spaceAbove;
          // If space below is bigger:
          //   top = buttonRect.bottom + 8;
          //   maxHeight = spaceBelow;
        } else {
          // Below is bigger (but still not full fit?), pin to where it is.
          // top is already buttonRect.bottom + 8
          // We might need to restrict max-height to fit in viewport
          // selector.style.maxHeight = `${spaceBelow}px`; // dynamic adjustment
        }
      }
    }

    // Re-check Vertical with simpler logic
    // Calculate space below and above
    const spaceBelow = viewportHeight - (buttonRect.bottom + 8) - padding;
    const spaceAbove = buttonRect.top - padding - 8;

    // Prefer below if it fits, or if it has more space than above
    const fitsBelow = spaceBelow >= selectorRect.height;
    const fitsAbove = spaceAbove >= selectorRect.height;

    if (fitsBelow || spaceBelow >= spaceAbove) {
      top = buttonRect.bottom + 8;
      // Cap height if strictly needed?
      if (!fitsBelow) {
        selector.style.maxHeight = `${spaceBelow}px`;
      }
    } else {
      // Go Above
      top = buttonRect.top - selectorRect.height - 8;
      if (!fitsAbove) {
        // If doesn't fit above, pin to top padding and size down
        top = padding;
        selector.style.maxHeight = `${spaceAbove + 8}px`; // roughly available space
      }
    }

    // 2. Horizontal Logic
    if (left + selectorRect.width > viewportWidth - padding) {
      left = viewportWidth - selectorRect.width - padding;
    }
    if (left < padding) left = padding;

    // Apply Final
    selector.style.top = `${top}px`;
    selector.style.left = `${left}px`;
    selector.style.visibility = 'visible';

    // Ensure styles applied
    selector.style.zIndex = '10000';

    setTimeout(() => {
      const handleClickOutside = (e: Event) => {
        if (!selector.contains(e.target as Node) && !button.contains(e.target as Node)) {
          selector.remove();
          document.removeEventListener('click', handleClickOutside);
        }
      };
      document.addEventListener('click', handleClickOutside);
    }, 100);
  }

  private createStyleSelector(post: Element): HTMLElement {
    const selector = document.createElement('div');
    selector.className = 'threads-ai-selector';
    selector.style.cssText = `
      background: white;
      border: 1px solid #ddd;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      padding: 12px;
      min-width: 340px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      overflow-y: auto;
      max-height: 480px;
    `;



    // --- Header Actions (Random, Kaomoji) ---
    const headerContainer = document.createElement('div');
    headerContainer.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
      padding-bottom: 12px;
      border-bottom: 1px solid #f0f0f0;
      gap: 8px;
    `;

    // Random Button
    const randomBtn = document.createElement('button');
    randomBtn.innerHTML = '🎲 隨機風格';
    randomBtn.style.cssText = `
      background: #f0f2f5;
      border: 1px solid #ddd;
      border-radius: 6px;
      padding: 4px 10px;
      font-size: 12px;
      cursor: pointer;
      color: #1c1e21;
      font-weight: 600;
      white-space: nowrap;
    `;
    randomBtn.onclick = () => {
      const randomStyle = REPLY_STYLES[Math.floor(Math.random() * REPLY_STYLES.length)];
      // Pass 'true' to indicate this is a random selection, so we should show the style name
      this.generateReply(post, randomStyle, true);
      selector.remove();
    };

    // Toggles Container
    const togglesGroup = document.createElement('div');
    togglesGroup.style.display = 'flex';
    togglesGroup.style.gap = '8px';

    // Helper to create toggles
    const createToggle = (label: string, initialState: boolean, onChange: (val: boolean) => void) => {
      const labelEl = document.createElement('label');
      labelEl.style.cssText = `
            display: flex;
            align-items: center;
            gap: 4px;
            font-size: 12px;
            cursor: pointer;
            user-select: none;
            color: #65676b;
        `;
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = initialState;
      input.onchange = (e) => {
        const checked = (e.target as HTMLInputElement).checked;
        onChange(checked);
        this.saveSettings(); // Save immediately
      };
      labelEl.appendChild(input);
      labelEl.appendChild(document.createTextNode(label));
      return labelEl;
    };

    togglesGroup.appendChild(createToggle('(O_O)', this.useKaomoji, (v) => this.useKaomoji = v));
    // Host Mode Toggle
    togglesGroup.appendChild(createToggle('我是樓主', this.isHostMode, (v) => this.isHostMode = v));

    // Smart Select Button
    const smartBtn = document.createElement('button');
    smartBtn.textContent = '🧠 智能搭配';
    smartBtn.className = 'threads-ai-random-btn';
    smartBtn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'; // Elegant Purple-Blue
    smartBtn.style.border = 'none';
    smartBtn.style.color = 'white';
    smartBtn.title = 'AI 自動分析情境並選擇適合語氣';

    smartBtn.onclick = async (e) => {
      e.stopPropagation();
      this.hideExistingSelectors();

      // --- Step 1: Analyze ---
      this.showLoadingState('🧠 AI 正在分析情境...');

      const postTextElement = post.querySelector('[class*="html-div"][dir="auto"]');
      const postText = postTextElement?.textContent?.trim() || '';

      const stylesList = REPLY_STYLES
        .map(s => `- ${s.name}: ${s.description || ''}`)
        .join('\n');

      let analysisResponse;
      try {
        analysisResponse = await browser.runtime.sendMessage({
          type: 'ANALYZE_POST',
          data: { postText, stylesList }
        });
      } catch (error) {
        this.hideLoadingState();
        this.showError('分析失敗，請稍後再試');
        return;
      }

      if (!analysisResponse || !analysisResponse.success) {
        this.hideLoadingState();
        this.showError(analysisResponse?.error || '分析失敗');
        return;
      }

      // Parse analysis response
      const analysisText = analysisResponse.analysis || '';
      const styleMatch = analysisText.match(/STYLE:\s*(.+)/i);
      const reasonMatch = analysisText.match(/REASON:\s*(.+)/i);

      const styleName = styleMatch ? styleMatch[1].trim() : null;
      const reasonText = reasonMatch ? reasonMatch[1].trim() : '情境適配';

      // Find matching style from REPLY_STYLES
      let matchedStyle = REPLY_STYLES.find(s => s.name === styleName);
      if (!matchedStyle) {
        // Fallback: random style
        matchedStyle = REPLY_STYLES[Math.floor(Math.random() * REPLY_STYLES.length)];
      }

      // --- Show Analysis Result ---
      this.hideLoadingState();
      this.showSuccessMessage(`✨ 風格：${matchedStyle.name}\n💬 理由：${reasonText}`);

      // --- Step 2: Generate Reply ---
      // Wait 1.5s for user to read the analysis
      await new Promise(resolve => setTimeout(resolve, 1500));

      this.generateReply(post, matchedStyle, false); // Use the matched style, not 'auto'
    };

    headerContainer.appendChild(smartBtn);
    headerContainer.appendChild(randomBtn);
    headerContainer.appendChild(togglesGroup);
    selector.appendChild(headerContainer);

    // 1. Brand Tone Section
    const toneTitle = document.createElement('div');
    toneTitle.style.cssText = `
      font - weight: 600;
      font - size: 13px;
      color: #65676b;
      margin - bottom: 8px;
      `;
    toneTitle.textContent = '語調 (選填)';
    selector.appendChild(toneTitle);

    const toneContainer = document.createElement('div');
    toneContainer.style.cssText = `
      display: flex;
      flex - wrap: wrap;
      gap: 6px;
      margin - bottom: 16px;
      padding - bottom: 16px;
      border - bottom: 1px solid #f0f0f0;
      `;

    BRAND_TONES.forEach(tone => {
      const toneChip = document.createElement('div');
      toneChip.textContent = tone.name;
      const isSelected = this.selectedTone?.id === tone.id;

      toneChip.style.cssText = `
        padding: 4px 10px;
        border-radius: 99px;
        font-size: 12px;
        cursor: pointer;
        border: 1px solid ${isSelected ? '#1877f2' : '#ddd'};
        background: ${isSelected ? '#1877f2' : 'white'};
        color: ${isSelected ? 'white' : '#1c1e21'};
        transition: all 0.2s;
      `;

      toneChip.addEventListener('click', (e) => {
        e.stopPropagation();
        // Toggle selection
        if (this.selectedTone?.id === tone.id) {
          this.selectedTone = null;
          toneChip.style.background = 'white';
          toneChip.style.color = '#1c1e21';
          toneChip.style.border = '1px solid #ddd';
        } else {
          // Deselect others
          // (Simplification: just re-render or manually update styles via loops if needed. 
          // Re-rendering selector might be cleaner but for now let's just update styles)
          Array.from(toneContainer.children).forEach((child: any) => {
            child.style.background = 'white';
            child.style.color = '#1c1e21';
            child.style.border = '1px solid #ddd';
          });

          this.selectedTone = tone;
          toneChip.style.background = '#1877f2';
          toneChip.style.color = 'white';
          toneChip.style.border = '1px solid #1877f2';
        }
      });

      toneContainer.appendChild(toneChip);
    });
    selector.appendChild(toneContainer);

    // 2. Reply Style Section
    const styleTitle = document.createElement('div');
    styleTitle.style.cssText = `
      font-weight: 600;
      font-size: 13px;
      color: #65676b;
      margin-bottom: 8px;
    `;
    styleTitle.textContent = '回覆風格 (點擊生成)';
    selector.appendChild(styleTitle);

    REPLY_STYLES.forEach(style => {
      const option = this.createStyleOption(style, post);
      selector.appendChild(option);
    });

    return selector;
  }

  private createStyleOption(style: ReplyStyle, post: Element): HTMLElement {
    const option = document.createElement('div');
    option.style.cssText = `
      padding: 12px 16px;
      cursor: pointer;
      border-radius: 8px;
      margin: 2px 0;
      transition: background-color 0.2s ease;
    `;

    option.innerHTML = `
      <div style="font-weight: 500; font-size: 14px; color: #1c1e21; margin-bottom: 2px;">
        ${style.name}
      </div>
      <div style="font-size: 12px; color: #65676b;">
        ${style.description}
      </div>
    `;

    option.addEventListener('mouseenter', () => {
      option.style.backgroundColor = '#f2f3f5';
    });

    option.addEventListener('mouseleave', () => {
      option.style.backgroundColor = 'transparent';
    });

    option.addEventListener('click', () => {
      this.generateReply(post, style);
      this.hideExistingSelectors();
    });

    return option;
  }

  private showLoadingState(message: string = 'AI 正在思考中...', contextSnippet: string | null = null) {
    // Fix Race Condition: Always remove existing toast to cancel any pending fade-out timers
    const existing = document.getElementById('threads-ai-toast');
    if (existing) existing.remove();

    let toast = document.createElement('div');
    toast.id = 'threads-ai-toast';
    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      left: 50 %;
      transform: translateX(-50 %);
      background: #1c1e21;
      color: white;
      padding: 12px 20px;
      border - radius: 12px;
      box - shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
      font - size: 14px;
      display: flex;
      flex - direction: column;
      align - items: flex - start;
      gap: 6px;
      z - index: 10001;
      opacity: 0;
      transition: opacity 0.3s ease;
      max - width: 90vw;
      `;
    document.body.appendChild(toast);

    let html = `<div style="display:flex; align-items:center; gap:8px;"><span class="spinner"></span><span style="font-weight: 500;">${message}</span></div>`;

    if (contextSnippet) {
      // Truncate if too long (although caller should probably truncate)
      const safeSnippet = contextSnippet.length > 20 ? contextSnippet.substring(0, 20) + '...' : contextSnippet;
      html += `<div style="font-size: 12px; color: #b0b3b8; padding-left: 24px;">📄 已連結主文：「${safeSnippet}」</div>`;
    }

    toast.innerHTML = html;

    // Add spinner style if needed
    const style = document.createElement('style');
    style.textContent = `
      .spinner {
        width: 14px;
        height: 14px;
        border: 2px solid white;
        border-top: 2px solid transparent;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        flex-shrink: 0;
      }
      @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    `;
    if (!document.head.querySelector('#threads-ai-spinner-style')) {
      style.id = 'threads-ai-spinner-style';
      document.head.appendChild(style);
    }

    // Show
    requestAnimationFrame(() => {
      if (toast) toast.style.opacity = '1';
    });
  }

  private async generateReply(post: Element, style: ReplyStyle, showStyleName: boolean = false) {
    // 1. Extract Target Text (The comment user clicked Reply on)
    let targetText = this.extractPostText(post);
    if (!targetText) {
      this.showError('無法讀取貼文內容');
      return;
    }

    // 2. Try to find "Root Context" (The main post this comment belongs to)
    let contextText = '';
    try {
      let rootPost: Element | null = null;

      // Strategy A: Detail View (URL contains /post/ or /t/)
      // In detail view, the first post in the main container is ALWAYS the root.
      if (location.pathname.includes('/post/') || location.pathname.includes('/t/')) {
        // Locate the first pressable container in the main scroll area
        // We can just query `[data-pressable-container="true"]` globally because the first one in DOM layout 
        // inside the main feed area is the root.
        // Adjust: Be precise to avoid picking up nav items. Scoped to `main` role if possible.
        const mainRole = document.querySelector('main');
        if (mainRole) {
          rootPost = mainRole.querySelector('[data-pressable-container="true"]');
        }
      }

      // Strategy B: Feed View (Sibling Grouping)
      // If we didn't find it (or not in detail view), look for the "First Sibling" in the current cluster.
      if (!rootPost) {
        let currentLevel = post.parentElement;
        // Traverse up to 6 levels to find the cluster wrapper
        // Threads DOM structure is deep. A thread unit usually groups the main post and replies.
        for (let i = 0; i < 6; i++) {
          if (!currentLevel || currentLevel.tagName === 'BODY' || currentLevel.tagName === 'MAIN') break;

          // Look for all pressable containers (posts) in this level
          // scope:scope is not needed, just querySelectorAll
          const candidates = currentLevel.querySelectorAll('[data-pressable-container="true"]');

          // If we found multiple posts in this container, the first one is likely the Root Context.
          if (candidates.length > 1) {
            const first = candidates[0];
            // Ensure the first one is visually before the current one (it acts as header)
            // And ensure it's not the current post itself
            if (first !== post && first.compareDocumentPosition(post) & Node.DOCUMENT_POSITION_FOLLOWING) {
              rootPost = first;
              break;
            }
          }
          currentLevel = currentLevel.parentElement;
        }
      }

      // If we found a root post, and it IS NOT the current post (meaning current post is a reply)
      if (rootPost && rootPost !== post) {
        const rootText = this.extractPostText(rootPost);
        if (rootText && rootText !== targetText) {
          contextText = rootText;
        }
      }
    } catch (e) {
      console.warn('Failed to extract context, proceeding with target only', e);
    }

    // 3. Construct Final Post Text for AI
    let finalPostText = targetText;
    if (contextText) {
      // Structured format for PromptBuilder
      finalPostText = `【主文 Context (The Main Topic)】:\n${contextText}\n\n【回覆對象 Target (The Specific Comment)】:\n${targetText}`;
      console.log('🔗 Context Linked:', { context: contextText.substring(0, 20), target: targetText.substring(0, 20) });
    } else {
      console.log('🔗 No Context Linked (Replying to Root or Standalone)');
    }


    let replyInput = await this.findReplyInput(post);

    // Auto-open Reply Modal if not found
    if (!replyInput) {
      const opened = await this.openReplyModal(post);
      if (opened) {
        // Wait for animation and focus (handled inside findReplyInput mostly, but wait here too)
        replyInput = await this.findReplyInput(post);
      }
    }

    if (!replyInput) {
      this.showError('找不到回覆輸入框，請先點擊回覆按鈕');
      return;
    }

    const loadingMessage = showStyleName
      ? `正在使用「${style.name}」風格生成...`
      : 'AI 正在思考中...';

    // Pass captured context snippet if available (Clean newlines for display)
    const contextSnippet = contextText ? contextText.replace(/\s+/g, ' ').substring(0, 20) : null;
    this.showLoadingState(loadingMessage, contextSnippet);

    try {
      // Use Manual Host Mode Toggle
      const isSelfPost = this.isHostMode;

      const response = await browser.runtime.sendMessage({
        type: 'GENERATE_REPLY',
        data: {
          postText: finalPostText,
          style: style.id,
          prompt: style.prompt,
          tone: this.selectedTone,
          options: {
            useKaomoji: this.useKaomoji,
            isSelfPost: isSelfPost
          }
        }
      });

      if (response && response.success) {
        let finalReply = response.reply;
        let analysisInfo: string | undefined = undefined;

        // 1. Line-Based Parsing (Stronger than XML for LLMs)
        const styleMatch = finalReply.match(/STYLE:\s*(.+)$/im);
        const reasonMatch = finalReply.match(/REASON:\s*(.+)$/im);

        if (styleMatch || reasonMatch) {
          // Remove the specific lines from the reply so they don't appear in the textbox
          if (styleMatch) finalReply = finalReply.replace(styleMatch[0], '');
          if (reasonMatch) finalReply = finalReply.replace(reasonMatch[0], '');

          finalReply = finalReply.trim();
          // Clean up potentially leftover markdown code blocks
          finalReply = finalReply.replace(/^```\w*\s*/, '').replace(/\s*```$/, '');

          const styleName = styleMatch ? styleMatch[1].trim() : '智能推薦';
          const reasonText = reasonMatch ? reasonMatch[1].trim() : '根據上下文自動選擇';

          analysisInfo = `✨ 風格：${styleName}\n💬 理由：${reasonText}`;
        } else if (style.id === 'auto') {
          // Fallback for Smart Mode if parsing completely failed
          analysisInfo = `✨ 風格：智能搭配 (自動)\n💬 理由：AI 自動分析情境`;
        }

        // UX Improvement: Show Analysis Toast FIRST, then fill text
        if (analysisInfo && style.id === 'auto') {
          this.showSuccessMessage(analysisInfo);
          // Delay filling the input to simulate "Analyze -> Generate" flow
          setTimeout(() => {
            this.fillReplyInput(replyInput as HTMLInputElement, finalReply, undefined); // Pass undefined to avoid showing toast 2nd time
          }, 1500);
        } else {
          // Normal flow for manually selected styles
          this.fillReplyInput(replyInput as HTMLInputElement, finalReply, analysisInfo);
        }
      } else {
        if (response && response.error && (response.error.includes('Key') || response.error === 'NO_API_KEY')) {
          this.showApiKeyPrompt();
        } else {
          this.showError(response?.error || '生成回覆時發生錯誤');
        }
      }
    } catch (error) {
      console.error('Error generating reply:', error);
      this.showError('連接服務時發生錯誤');
    } finally {
      this.hideLoadingState();
    }
  }

  private async openReplyModal(post: Element): Promise<boolean> {
    // Common selectors for the reply button
    const replyBtnSelectors = [
      'div[role="button"][aria-label="回覆"]',
      'div[role="button"][aria-label="Reply"]',
      'svg[aria-label="回覆"]',
      'svg[aria-label="Reply"]'
    ];

    for (const selector of replyBtnSelectors) {
      const btn = post.querySelector(selector);
      if (btn) {
        // Click the button (or closest clickable parent)
        const clickable = btn.closest('[role="button"]') || btn.parentElement;
        if (clickable instanceof HTMLElement) {
          clickable.click();
          return true;
        }
      }
    }
    return false;
  }

  private extractPostText(post: Element): string {
    // Attempt to identify the author to exclude their name from context
    let author = '';
    const authorLink = post.querySelector('a[href^="/@"]');
    if (authorLink) author = authorLink.textContent?.trim() || '';

    const textElements = post.querySelectorAll('[dir="auto"]');

    // Regex for timestamps commonly found in Threads headers (e.g., 12小時, 3m, 5d)
    const timeRegex = /^\d+\s*(小時|分鐘|分|秒|天|週|年|m|h|d|w|y|s)$/;

    const texts = Array.from(textElements)
      .map(el => el.textContent?.trim() || '')
      .filter(text => {
        if (!text) return false;

        // Exclude Author Name (likely header metadata)
        if (author && text === author) return false;

        // Exclude Timestamps (likely header metadata)
        if (timeRegex.test(text)) return false;

        // Exclude common UI labels that might be captured
        if (['翻譯年糕', 'Translate', 'View insights', '查看洞察報告'].includes(text)) return false;

        return true;
      });

    return texts.join(' ').slice(0, 1000);
  }

  private async findReplyInput(post: Element): Promise<Element | null> {
    // Strategy 1: Active Focus (The most accurate)
    // When we clicked 'Reply', the focus likely shifted to the new input.
    // We check this first.
    let attempts = 0;
    while (attempts < 5) {
      const active = document.activeElement;
      if (active && (
        (active.tagName === 'TEXTAREA' && (active as HTMLElement).getAttribute('placeholder')?.includes('回覆')) ||
        active.getAttribute('contenteditable') === 'true'
      )) {
        // Verify this active element is seemingly related (optional, but good for safety)
        // For now, assume focus behavior is reliable as user interaction drives it.
        return active;
      }
      await new Promise(r => setTimeout(r, 100)); // Wait for focus shift
      attempts++;
    }

    // Strategy 2: Scoped Search (Parent/Sibling Context)
    // Go up to the container of the post to find the discussion block
    const pressableContainer = post.closest('div[data-pressable-container="true"]');
    if (pressableContainer) {
      // Try finding input inside this container (comments sometimes expand inline)
      let internalInput = pressableContainer.querySelector('div[contenteditable="true"], textarea');
      if (internalInput) return internalInput;

      // Try next sibling (often the reply block is inserted after the post block)
      let sibling = pressableContainer.nextElementSibling;
      if (sibling) {
        let siblingInput = sibling.querySelector('div[contenteditable="true"], textarea');
        if (siblingInput) return siblingInput;
      }
    }

    // Strategy 3: Modal Fallback (Strict)
    // Only if we detect we are likely in a modal overlay context
    const modal = document.querySelector('div[role="dialog"][aria-modal="true"]');
    if (modal) {
      // If a modal is open, search strictly INSIDE the modal
      return modal.querySelector('div[contenteditable="true"], textarea');
    }

    return null;
  }

  // Duplicate removed

  private hideLoadingState() {
    const toast = document.getElementById('threads-ai-toast');
    if (toast) {
      toast.style.opacity = '0';
      setTimeout(() => {
        if (toast) toast.remove();
      }, 300);
    }
    // Cleanup old ID just in case
    const oldLoading = document.getElementById('threads-ai-loading');
    if (oldLoading) oldLoading.remove();
  }

  private fillReplyInput(input: HTMLInputElement | HTMLTextAreaElement, text: string, analysisInfo?: string) {
    // 聚焦輸入框
    input.focus();

    // 模擬用戶輸入
    if (input.tagName === 'TEXTAREA') {
      (input as HTMLTextAreaElement).value = text;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (input.hasAttribute('contenteditable')) {
      input.textContent = text;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // 嘗試使用 document.execCommand 作為後備方案
    try {
      document.execCommand('insertText', false, text);
    } catch (e) {
      // 忽略錯誤
    }

    this.showSuccessMessage(analysisInfo);
  }

  private showSuccessMessage(analysisInfo?: string) {
    const message = document.createElement('div');

    // Style update for clearer analysis display
    const contentHtml = analysisInfo
      ? `<div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
           <span style="font-size:16px;">✨</span>
           <span style="font-weight:600; font-size:13px; color:#4ade80;">AI 智能搭配完成</span>
         </div>
         <div style="font-size:13px; line-height:1.5; color:#e4e6eb; white-space: pre-wrap;">${analysisInfo}</div>`
      : `<div style="display:flex; align-items:center; gap:8px;">
           <span style="color:#4ade80;">✅</span>
           <span>回覆已生成</span>
         </div>`;

    message.style.cssText = `
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: #242526;
      border: 1px solid #3e4042;
      color: white;
      padding: 12px 16px;
      border-radius: 12px;
      font-size: 14px;
      z-index: 10001;
      animation: slideUpFade 0.3s ease;
      max-width: 90vw;
      width: max-content;
      min-width: 200px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.4);
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      backdrop-filter: blur(8px);
    `;
    message.innerHTML = contentHtml;

    document.body.appendChild(message);
    setTimeout(() => message.remove(), analysisInfo ? 8000 : 3000); // Give users more time to read analysis
  }

  private showError(errorMessage: string) {
    const message = document.createElement('div');
    message.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #e74c3c;
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 14px;
      z-index: 10001;
    `;
    message.textContent = `❌ ${errorMessage}`;

    document.body.appendChild(message);
    setTimeout(() => message.remove(), 5000);
  }

  private showApiKeyPrompt() {
    const prompt = document.createElement('div');
    prompt.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      border: 1px solid #ddd;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      z-index: 10001;
      text-align: center;
      max-width: 400px;
    `;

    prompt.innerHTML = `
      <div style="font-size: 18px; margin-bottom: 16px;">🔑</div>
      <div style="font-weight: 600; margin-bottom: 8px; color: #1c1e21;">
        需要設定 API Key
      </div>
      <div style="color: #65676b; margin-bottom: 20px; font-size: 14px;">
        請先前往設定頁面輸入您的 Gemini/OpenAI/Claude API Key
      </div>
      <div style="display: flex; gap: 12px; justify-content: center;">
        <button id="open-settings" style="
          background: #1877f2;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
        ">前往設定</button>
        <button id="close-prompt" style="
          background: #e4e6ea;
          color: #1c1e21;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
        ">稍後</button>
      </div>
    `;

    document.body.appendChild(prompt);

    prompt.querySelector('#open-settings')?.addEventListener('click', () => {
      browser.runtime.sendMessage({ type: 'OPEN_OPTIONS' });
      prompt.remove();
    });

    prompt.querySelector('#close-prompt')?.addEventListener('click', () => {
      prompt.remove();
    });
  }

  private hideExistingSelectors() {
    const existing = document.querySelectorAll('.threads-ai-selector');
    existing.forEach(el => el.remove());
  }

  private startObserver() {
    this.observer = new MutationObserver((mutations) => {
      let shouldUpdate = false;

      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          shouldUpdate = true;
        }
      });

      if (shouldUpdate) {
        setTimeout(() => this.injectButtons(), 500);
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  private setupMessageListener() {
    browser.runtime.onMessage.addListener((message: any, _sender, _sendResponse) => {
      if (message.type === 'SHOW_ERROR') {
        this.showError(message.data);
      }
    });
  }



  // Helper to extract author from specific post
  private getPostAuthor(post: Element): string | null {
    // The author link is usually at the top of the post.
    // It typically has style "font-weight: 600" or is the first link with /@username
    // To be safer, we look for the link that is inside the header part (usually first flex row)
    // A simple heuristic: The first link starting with /@ inside the post container is 99% the author.
    const authorLink = post.querySelector('a[href^="/@"][role="link"]');
    if (authorLink) {
      return authorLink.getAttribute('href')?.replace('/@', '').replace(/\/$/, '') || null;
    }
    return null;
  }
}

// 全域實例引用
let threadsHelperInstance: ThreadsHelper;


if (typeof window !== "undefined") {
  threadsHelperInstance = new ThreadsHelper();

  browser.runtime.onMessage.addListener((request, _sender, _sendResponse) => {
    if (request.action === "updateThresholds") {
      threadsHelperInstance.updateThresholds(request.thresholds);
    }
  });

  // 頁面卸載時清理
  window.addEventListener("beforeunload", () => {
    threadsHelperInstance.cleanup();
  });

  // Initialize AI Assistant
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      new ThreadsAIAssistant();
    });
  } else {
    new ThreadsAIAssistant();
  }
}


export { ThreadsHelper, ThreadsAIAssistant };
