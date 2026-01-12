import browser from "webextension-polyfill";
import "./styles/sidebar.css";
import { type LikeThreshold, DEFAULT_THRESHOLDS } from "./types";
import { REPLY_STYLES, STORAGE_KEYS } from './lib/constants';
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
    // Design System Configuration
    let config = {
      icon: "📈",
      gradient: "#10b981", // Emerald
      text: "Growth",
      label: `每小時 +${hourlyGrowth} 讚`,
      glowColor: "rgba(16, 185, 129, 0.4)"
    };

    if (isViralPrediction) {
      config = {
        icon: "⚡",
        gradient: "#8b5cf6", // Violet
        text: "Trending",
        label: "爆文預警：近期急速竄升",
        glowColor: "rgba(139, 92, 246, 0.5)"
      };
    } else if (typeof hourlyGrowth === 'number' && hourlyGrowth >= 100) {
      config = {
        icon: "🔥",
        gradient: "#ff5252", // Red
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
          background: #0095f6;
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
          color: #0095f6;
        }

        .__fb-dark-mode .sonar-modal-title {
          color: #38bdf8;
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
                    <div style="position: absolute; inset: 0; background: #e0f2fe; filter: blur(20px); opacity: 0.3; border-radius: 24px;"></div>
                    <img src="${browser.runtime.getURL('sonar-icon.png')}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 20px; box-shadow: 0 10px 20px rgba(0,0,0,0.1); position: relative; z-index: 1;" alt="Sonar">
                </div>
                <h2 style="font-size: 24px; font-weight: 900; color: #0f172a; margin: 0; letter-spacing: -0.5px;">
                    Sonar<span style="color: #0095f6;">Agent</span>
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
            
            <!-- Batch Mode Toggle -->
            <div id="sonar-batch-toggle-row" style="
                display: flex; 
                align-items: center; 
                padding: 12px; 
                background: rgba(255,255,255,0.5); 
                border-radius: 12px; 
                margin-bottom: 24px;
                cursor: pointer;
                transition: background 0.2s;
            ">
                <div style="
                    width: 40px; 
                    height: 40px; 
                    background: #e0f2fe; 
                    border-radius: 10px; 
                    display: flex; 
                    align-items: center; 
                    justify-content: center; 
                    color: #0284c7; 
                    font-size: 20px;
                    margin-right: 12px;
                ">📚</div>
                <div style="flex: 1;">
                    <div style="font-size: 14px; font-weight: 700; color: #1e293b;">批次模式</div>
                    <div style="font-size: 10px; color: #94a3b8;">多選留言並自動填入回覆</div>
                </div>
                <!-- Toggle Switch -->
                 <div id="sonar-batch-toggle-switch" style="width: 44px; height: 24px; background: #cbd5e1; border-radius: 99px; position: relative; transition: background 0.2s;">
                    <div style="width: 20px; height: 20px; background: white; border-radius: 50%; position: absolute; top: 2px; left: 2px; transition: transform 0.2s; box-shadow: 0 1px 3px rgba(0,0,0,0.2);"></div>
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
  private isHostMode: boolean = false;
  private useVision: boolean = false; // Manual toggle for "Host Mode"

  // Batch Mode State
  private isBatchMode: boolean = false;
  private selectedComments: Set<Element> = new Set();
  private batchBar: HTMLElement | null = null;
  private localStorageKey = 'threads-ai-settings';

  private openSidebar(post: Element) {
    this.currentPost = post;
    this.toggleSidebar(true);

    // Update Context Text
    const contextEl = this.sidebar?.querySelector('#sonar-context-text');
    const contextArea = this.sidebar?.querySelector('#sonar-context-area') as HTMLElement;
    if (contextEl && contextArea) {
      const text = this.extractFullContext(post) || '';
      contextEl.textContent = text.substring(0, 80) + (text.length > 80 ? '...' : '');
      contextArea.style.display = 'block';
    }

    this.updateSidebarUI();
  }

  private renderSidebar() {
    if (this.sidebar) return;

    // Clean up existing DOM if any (prevents duplicates on re-injection)
    const existing = document.getElementById('sonar-sidebar');
    if (existing) existing.remove();

    this.sidebar = document.createElement('div');
    this.sidebar.id = 'sonar-sidebar';
    this.sidebar.className = 'collapsed';
    this.sidebar.innerHTML = `
    <div id="sonar-sidebar-handle">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="15 18 9 12 15 6"></polyline>
      </svg>
    </div>
    <div class="sonar-header">
      <div class="sonar-logo">Sonar AI</div>

    </div>
    <div class="sonar-body">
      <div id="sonar-context-area" class="sonar-context" style="display:none;">
        <div class="sonar-context-label">當前文脈 (Active Context)</div>
        <div id="sonar-context-text"></div>
      </div>

      <div class="sonar-section">
        <div class="sonar-batch-row" id="sonar-sidebar-batch-toggle" style="cursor:pointer; padding:16px; display:flex; justify-content:space-between; align-items:center; border:none; background:transparent;">
          <div style="display:flex;align-items:center;gap:12px;">
            <div>
              <div style="font-weight:600; font-size:14px;">自動批次模式</div>
              <div style="font-size:11px; color:#94a3b8;">Auto Batch Queue</div>
            </div>
          </div>
          <div class="toggle-switch" id="sonar-sidebar-batch-switch" style="width:40px; height:22px; background:#e2e8f0; border-radius:99px; position:relative; transition:background 0.2s;">
            <div style="width:18px; height:18px; background:white; border-radius:50%; position:absolute; top:2px; left:2px; transition:0.2s; box-shadow:0 1px 2px rgba(0,0,0,0.1);"></div>
          </div>
        </div>
        
        <!-- Preferences Section -->
        <div style="padding: 0 16px 16px 16px; margin-top: -4px;">
            <label style="display:flex; align-items:center; justify-content:space-between; cursor:pointer; margin-bottom:12px; padding: 8px; border-radius: 8px; background: #f8fafc;">
                <span style="font-size:13px; font-weight:600; color: #334155;">( ≧Д≦) 顏文字</span>
                <input type="checkbox" id="sonar-opt-kaomoji" style="accent-color:#0095f6; transform: scale(1.2);">
            </label>
            <label style="display:flex; align-items:center; justify-content:space-between; cursor:pointer; padding: 8px; border-radius: 8px; background: #f8fafc;">
                <span style="font-size:13px; font-weight:600; color: #334155;">我是樓主 (Host Mode)</span>
                <input type="checkbox" id="sonar-opt-host" style="accent-color:#0095f6; transform: scale(1.2);">
            </label>
        </div>
      </div>

      <div id="sonar-tools-area" style="margin-top:24px;">
        <div class="sonar-section-title">AI 工具箱 (AI Tools)</div>
        <div class="sonar-grid" id="sonar-style-grid"></div>
      </div>
    </div>

    <div class="sonar-footer">
      <button id="sonar-sidebar-settings" class="sonar-btn">
        設定與模型
      </button>
    </div>
    `;

    document.body.appendChild(this.sidebar);

    // Bind Events
    this.sidebar.querySelector('#sonar-sidebar-handle')?.addEventListener('click', () => this.toggleSidebar());


    this.sidebar.querySelector('#sonar-sidebar-batch-toggle')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleBatchMode();
      this.updateSidebarUI();
    });

    this.sidebar.querySelector('#sonar-sidebar-settings')?.addEventListener('click', () => {
      browser.runtime.sendMessage({ type: 'OPEN_OPTIONS' });
    });

    // Option Toggles
    const kaoToggle = this.sidebar.querySelector('#sonar-opt-kaomoji') as HTMLInputElement;
    if (kaoToggle) {
      kaoToggle.checked = this.useKaomoji;
      kaoToggle.addEventListener('change', () => {
        this.useKaomoji = kaoToggle.checked;
        this.saveSettings();
      });
    }

    const hostToggle = this.sidebar.querySelector('#sonar-opt-host') as HTMLInputElement;
    if (hostToggle) {
      hostToggle.checked = this.isHostMode;
      hostToggle.addEventListener('change', () => {
        this.isHostMode = hostToggle.checked;
        // Host mode is transient usually, but strict users might want it saved? 
        // For now, let's keep it transient or save it if requested. 
        // The original logic didn't seem to save isHostMode, but let's stick to existing pattern.
      });
    }

    this.renderSidebarStyles();
    this.updateSidebarUI();
  }

  private toggleSidebar(forceOpen: boolean = false) {
    if (!this.sidebar) this.renderSidebar();

    if (forceOpen) {
      this.isSidebarCollapsed = false;
    } else {
      this.isSidebarCollapsed = !this.isSidebarCollapsed;
    }

    if (this.sidebar) {
      if (this.isSidebarCollapsed) this.sidebar.classList.add('collapsed');
      else this.sidebar.classList.remove('collapsed');
    }
  }

  private updateSidebarUI() {
    if (!this.sidebar) return;

    // Update Batch Switch
    const switchEl = this.sidebar.querySelector('#sonar-sidebar-batch-switch') as HTMLElement;
    const knob = switchEl.querySelector('div') as HTMLElement;

    if (this.isBatchMode) {
      switchEl.style.background = '#0095f6';
      knob.style.transform = 'translateX(18px)'; // Adjusted for 40px width
    } else {
      switchEl.style.background = '#e2e8f0';
      knob.style.transform = 'translateX(0)';
    }

    // Update Tools Area
    const toolsArea = this.sidebar.querySelector('#sonar-tools-area');
    if (toolsArea) {
      if (this.isBatchMode) {
        toolsArea.innerHTML = `
          <div class="sonar-section-title">批次佇列 (${this.batchQueue.length > 0 ? '執行中' : '待命'})</div>
          <div style="margin-bottom:12px; display: flex; gap: 8px;">
             <input type="number" id="batch-count-input" min="1" max="20" value="5" class="sonar-input" style="width: 80px; text-align: center;">
             <div style="display:flex; flex-direction:column; justify-content:center;">
                <span style="font-size:13px; font-weight:600;">處理數量</span>
                <span style="font-size:11px; color:#94a3b8;">Max 20</span>
             </div>
          </div>
          <div style="margin-bottom:12px;">
            <input type="text" id="batch-fixed-input" placeholder="輸入固定回覆內容..." style="width:100%; padding:12px; border-radius:8px; border:1px solid rgba(0,0,0,0.1); background:#fff; color:#333; font-size:13px; outline:none; transition:border 0.2s;">
            <div style="font-size:11px; color:#94a3b8; margin-top:4px;">* 將自動搜尋接下來的 N 則貼文進行回覆</div>
          </div>
          <div class="sonar-grid">
            <button class="sonar-btn primary" id="batch-action-fixed" style="background:#0095f6; border-color:#0095f6; color:white;">填入固定內容</button>
            <button class="sonar-btn" id="batch-action-random" style="border:1px solid #dbdbdb; color:#333;">AI 隨機風格</button>
            <button class="sonar-btn" id="batch-action-cancel" style="grid-column: span 2; background:#f1f5f9; color:#333;">關閉批次模式</button>
          </div>
        `;

        toolsArea.querySelector('#batch-action-fixed')?.addEventListener('click', () => {
          const countInput = toolsArea.querySelector('#batch-count-input') as HTMLInputElement;
          const count = parseInt(countInput.value, 10) || 5;
          const val = (toolsArea.querySelector('#batch-fixed-input') as HTMLInputElement).value;
          this.handleAutoBatch(count, 'fixed', val);
        });
        toolsArea.querySelector('#batch-action-random')?.addEventListener('click', () => {
          const countInput = toolsArea.querySelector('#batch-count-input') as HTMLInputElement;
          const count = parseInt(countInput.value, 10) || 5;
          this.handleAutoBatch(count, 'random');
        });
        toolsArea.querySelector('#batch-action-cancel')?.addEventListener('click', () => {
          this.toggleBatchMode();
          this.updateSidebarUI();
        });

      } else {
        // Normal Mode
        toolsArea.innerHTML = `<div class="sonar-section-title">快速操作 (Quick Actions)</div><div class="sonar-grid" id="sonar-style-grid"></div>`;
        this.renderSidebarStyles();
      }
    }
  }

  private renderSidebarStyles() {
    const grid = this.sidebar?.querySelector('#sonar-style-grid');
    if (!grid) return;
    grid.innerHTML = '';

    // Smart Auto
    const smartBtn = document.createElement('button');
    smartBtn.className = 'sonar-btn';
    smartBtn.style.background = '#0095f6';
    smartBtn.style.border = 'none';
    smartBtn.style.color = 'white';
    smartBtn.textContent = '智能分析回覆';
    smartBtn.onclick = () => {
      if (this.currentPost) this.handleSmartAuto(this.currentPost);
      else this.showError('請先選擇貼文');
    };
    grid.appendChild(smartBtn);

    REPLY_STYLES.forEach(style => {
      if (style.id === 'auto') return;
      const btn = document.createElement('button');
      btn.className = 'sonar-btn';
      btn.textContent = style.name;
      btn.onclick = () => {
        if (this.currentPost) {
          this.generateReply(this.currentPost, style);
        } else {
          this.showError('請先選擇貼文');
        }
      };
      grid.appendChild(btn);
    });
  }

  private handleAutoBatch(count: number, mode: 'fixed' | 'random', fixedText: string = '') {
    if (!this.currentPost) {
      this.showLoadingState('Please select a starting post first (click AI icon on a post)', null);
      setTimeout(() => this.hideLoadingState(), 2000);
      return;
    }

    // Logic: Find siblings of currentPost or all posts below it?
    // Threads structure is complex. Usually repeated structures in a list.
    // We look for logic used in 'findPosts'.
    // We want to find the Index of currentPost in the list of All Posts, then take next N.

    const allPosts = this.findPosts();
    const currentIndex = allPosts.indexOf(this.currentPost);

    if (currentIndex === -1) {
      this.showError('Current post context lost. Reselect.');
      return;
    }

    // Select next N posts
    // Filter those that already have a reply? (Hard to detect user reply without more DOM logic).
    // For now, simple "Next N" regardless.
    const targets = allPosts.slice(currentIndex + 1, currentIndex + 1 + count);

    if (targets.length === 0) {
      this.showError('No more posts below this one.');
      return;
    }

    this.showLoadingState(`Batch Processing ${targets.length} items...`);

    targets.forEach((post, i) => {
      // Delay to prevent freezing?
      setTimeout(() => {
        this.processBatchItem(post, mode, fixedText);
      }, i * 300);
    });

    setTimeout(() => {
      this.hideLoadingState();
      this.showSuccessMessage(`Filled ${targets.length} replies.`);
    }, targets.length * 300 + 500);
  }

  private processBatchItem(post: Element, mode: 'fixed' | 'random', fixedText: string) {
    if (!post) return;
    post.scrollIntoView({ behavior: 'smooth', block: 'center' });

    const replyBtn = post.querySelector('[aria-label*="Reply"], [aria-label*="回覆"], div[role="button"]:has(svg[aria-label="Reply"])') as HTMLElement;

    if (replyBtn) {
      replyBtn.click();

      setTimeout(() => {
        // Try to find the new modal textarea
        const textarea = document.querySelector('div[role="dialog"] [contenteditable="true"]') as HTMLElement || document.querySelector('[contenteditable="true"]');

        if (textarea) {
          if (mode === 'fixed') {
            // Simple fill for fixed text
            textarea.innerText = fixedText;
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
          } else {
            // Random AI Style
            // Pick a random style that effectively varies the tone
            const styles = REPLY_STYLES.filter(s => s.id !== 'auto');
            const randomStyle = styles[Math.floor(Math.random() * styles.length)];
            this.generateReply(post, randomStyle);
          }
        }
      }, 1500); // 1.5s delay for modal slide-in
    }
  }
  private sidebar: HTMLElement | null = null;
  private isSidebarCollapsed: boolean = true;
  private currentPost: Element | null = null;
  private batchQueue: Element[] = [];


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
        useKaomoji: this.useKaomoji
      }));
    } catch (e) {
      console.error('Failed to save settings', e);
    }
  }

  private injectButtons() {
    const posts = this.findPosts();
    // console.log(`🔍 找到 ${ posts.length } 個貼文`);
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
display: inline - flex;
align - items: center;
justify - content: center;
width: 40px;
height: 40px;
border: none;
background: transparent;
border - radius: 50 %;
cursor: pointer;
margin - left: 8px;
transition: all 0.2s ease;
font - size: 18px;
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
      this.openSidebar(post);
    });

    return button;
  }

  // --- Modern Toast System ---

  private getToastContainer(): HTMLElement {
    let container = document.getElementById('sonar-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'sonar-toast-container';
      container.style.cssText = `
        position: fixed;
        bottom: 24px;
        left: 24px;
        z-index: 10001;
        display: flex;
        flex-direction: column;
        gap: 12px;
        pointer-events: none; /* Let clicks pass through gaps */
      `;
      document.body.appendChild(container);

      // Inject Styles for Toast
      const style = document.createElement('style');
      style.textContent = `
        .sonar-toast {
          background: rgba(26, 26, 26, 0.9);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: white;
          padding: 16px 20px;
          border-radius: 16px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          font-size: 14px;
          line-height: 1.5;
          max-width: 360px;
          min-width: 280px;
          pointer-events: auto;
          animation: sonarSlideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          display: flex;
          align-items: flex-start;
          gap: 12px;
          transition: all 0.3s ease;
          opacity: 0; 
          transform: translateX(-20px);
        }
        .sonar-toast.visible {
          opacity: 1;
          transform: translateX(0);
        }
        .sonar-toast.removing {
          opacity: 0;
          transform: translateY(10px);
        }
        .sonar-toast-icon {
          font-size: 20px;
          flex-shrink: 0;
          padding-top: 2px;
        }
        .sonar-toast-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .sonar-toast-title {
          font-weight: 600;
          font-size: 15px;
          color: #fff;
        }
        .sonar-toast-body {
          color: #a3a3a3;
          font-size: 13px;
        }
        .sonar-toast-context {
          margin-top: 6px;
          padding-top: 6px;
          border-top: 1px solid rgba(255,255,255,0.1);
          font-size: 12px;
          color: #737373;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        @keyframes sonarSlideIn {
          from { opacity: 0; transform: translateX(-30px) scale(0.95); }
          to { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .sonar-spinner {
          width: 18px;
          height: 18px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top: 2px solid white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        .sonar-toast-close {
          background: transparent;
          border: none;
          color: rgba(255,255,255,0.5);
          cursor: pointer;
          font-size: 20px;
          line-height: 1;
          padding: 0 0 0 10px;
          margin-left: auto;
          align-self: flex-start;
          transition: color 0.2s;
        }
        .sonar-toast-close:hover {
          color: white;
        }
      `;
      document.head.appendChild(style);
    }
    return container;
  }

  private showToast(options: {
    type: 'loading' | 'success' | 'error' | 'info',
    title?: string,
    message: string,
    duration?: number,
    contextSnippet?: string | null
  }): HTMLElement {
    const container = this.getToastContainer();
    const toast = document.createElement('div');
    toast.className = 'sonar-toast';

    // Icon Logic
    let icon = '';
    if (options.type === 'loading') icon = '<div class="sonar-spinner"></div>';
    else if (options.type === 'success') icon = '✨';
    else if (options.type === 'error') icon = '❌';
    else icon = 'ℹ️';

    // Context HTML
    let contextHtml = '';
    if (options.contextSnippet) {
      const safeSnippet = options.contextSnippet.length > 25 ? options.contextSnippet.substring(0, 25) + '...' : options.contextSnippet;
      contextHtml = `<div class="sonar-toast-context">📄 已連結: ${safeSnippet}</div>`;
    }

    // Close Button logic
    const closeBtn = document.createElement('button');
    closeBtn.className = 'sonar-toast-close';
    closeBtn.innerHTML = '×';
    closeBtn.onclick = (e) => {
      e.stopPropagation();
      this.removeToast(toast);
    };

    toast.innerHTML = `
      <div class="sonar-toast-icon">${icon}</div>
      <div class="sonar-toast-content">
        ${options.title ? `<div class="sonar-toast-title">${options.title}</div>` : ''}
        <div class="sonar-toast-body">${options.message.replace(/\n/g, '<br>')}</div>
        ${contextHtml}
      </div>
    `;
    toast.appendChild(closeBtn);

    container.appendChild(toast);

    // Trigger Animation
    requestAnimationFrame(() => toast.classList.add('visible'));

    // Auto Remove
    if (options.duration !== 0) {
      const duration = options.duration || (options.type === 'error' ? 5000 : 4000);
      setTimeout(() => this.removeToast(toast), duration);
    }

    return toast;
  }

  private removeToast(toast: HTMLElement) {
    if (toast.classList.contains('removing')) return;
    toast.classList.add('removing');
    toast.addEventListener('transitionend', () => {
      toast.remove();
    });
    // Fallback if transition event fails
    setTimeout(() => toast.remove(), 500);
  }

  private updateToast(toast: HTMLElement, options: {
    type: 'loading' | 'success' | 'error' | 'info',
    title?: string,
    message: string,
    contextSnippet?: string | null
  }) {
    // Icon Logic
    let icon = '';
    if (options.type === 'loading') icon = '<div class="sonar-spinner"></div>';
    else if (options.type === 'success') icon = '✨';
    else if (options.type === 'error') icon = '❌';
    else icon = 'ℹ️';

    // Context HTML
    let contextHtml = '';
    if (options.contextSnippet) {
      const safeSnippet = options.contextSnippet.length > 25 ? options.contextSnippet.substring(0, 25) + '...' : options.contextSnippet;
      contextHtml = `<div class="sonar-toast-context">📄 已連結: ${safeSnippet}</div>`;
    }

    const iconEl = toast.querySelector('.sonar-toast-icon');
    const contentEl = toast.querySelector('.sonar-toast-content');

    if (iconEl) iconEl.innerHTML = icon;
    if (contentEl) {
      contentEl.innerHTML = `
        ${options.title ? `<div class="sonar-toast-title">${options.title}</div>` : ''}
        <div class="sonar-toast-body">${options.message.replace(/\n/g, '<br>')}</div>
        ${contextHtml}
      `;
    }
  }

  // --- Wrapper Methods for Backward Compatibility ---

  private loadingToast: HTMLElement | null = null;

  private showLoadingState(message: string = 'AI 正在思考中...', contextSnippet: string | null = null) {
    // Remove existing loading toast if any (to prevent duplicates if stuck)
    this.hideLoadingState();
    this.loadingToast = this.showToast({
      type: 'loading',
      title: '處理中',
      message: message,
      duration: 0, // Persistent
      contextSnippet: contextSnippet
    });
  }


  private hideLoadingState() {
    if (this.loadingToast) {
      this.removeToast(this.loadingToast);
      this.loadingToast = null;
    }
  }

  private showSuccessMessage(message?: string, duration: number = 4000): HTMLElement {
    const displayMsg = message || '回覆已生成';
    // Determine if it's the Analysis Result
    // Determine if it's the Analysis Result
    if (displayMsg.includes('策略：')) {
      let toast: HTMLElement;

      // Smooth Transition: If loading toast exists, update it instead of creating new
      if (this.loadingToast) {
        toast = this.loadingToast;
        this.updateToast(toast, {
          type: 'success',
          title: '智能分析完成',
          message: displayMsg
        });
        // Clear loading reference so it's not removed as "loading" anymore
        this.loadingToast = null;

        // Handle duration manually since we bypassed showToast's timer
        const actualDuration = duration === 4000 ? 8000 : duration;
        if (actualDuration !== 0) {
          setTimeout(() => this.removeToast(toast), actualDuration);
        }
      } else {
        // Fallback to creating new
        toast = this.showToast({
          type: 'success',
          title: '智能分析完成',
          message: displayMsg,
          duration: duration === 4000 ? 8000 : duration
        });
      }
      return toast;
    } else {
      const toast = this.showToast({
        type: 'success',
        message: displayMsg,
        duration: duration
      });
      // If this is a final generation success (no '策略'), and we are in smart auto mode (handled by caller pushing to list)
      // We need to return it.
      return toast;
    }
  }

  private showError(message: string) {
    console.error(message);
    this.showToast({
      type: 'error',
      title: '發生錯誤',
      message: message,
      duration: 5000
    });
  }

  /**
   * Retrieves the full context text including Root Post (if any) and Target Post.
   */
  private extractFullContext(post: Element): string | null {
    // 1. Extract Target Text (The comment user clicked Reply on)
    let targetText = this.extractPostText(post);
    if (!targetText) {
      return null;
    }

    // 2. Try to find "Root Context" (The main post this comment belongs to)
    let contextText = '';
    try {
      let rootPost: Element | null = null;

      // Strategy A: Detail View (URL contains /post/ or /t/)
      if (location.pathname.includes('/post/') || location.pathname.includes('/t/')) {
        const mainRole = document.querySelector('main');
        if (mainRole) {
          rootPost = mainRole.querySelector('[data-pressable-container="true"]');
        }
      }

      // Strategy B: Feed View (Sibling Grouping) - DISABLED
      // Reason: In main feed, this incorrectly identifies previous posts as "Root" for independent posts.
      // if (!rootPost) { ... }

      // If we found a root post, and it IS NOT the current post
      if (rootPost && rootPost !== post) {
        const rootText = this.extractPostText(rootPost);
        if (rootText && rootText !== targetText) {
          contextText = rootText;
        }
      }
    } catch (e) {
      console.warn('Failed to extract context, proceeding with target only', e);
    }

    // 3. Construct Final Post Text
    let finalPostText = targetText;
    if (contextText) {
      finalPostText = `【主文 Context (The Main Topic)】:\n${contextText}\n\n【回覆對象 Target (The Specific Comment)】:\n${targetText}`;
      console.log('🔗 Context Linked:', { context: contextText.substring(0, 20), target: targetText.substring(0, 20) });
    } else {
      console.log('🔗 No Context Linked (Replying to Root or Standalone)');
    }

    return finalPostText;
  }

  private async handleSmartAuto(post: Element) {
    const finalPostText = this.extractFullContext(post);
    if (!finalPostText) {
      this.showError('無法讀取貼文內容');
      return;
    }

    this.showLoadingState('AI 正在分析貼文情境與擬定策略...', finalPostText);

    try {
      // 1. Get Styles List
      const stylesList = REPLY_STYLES.filter(s => s.id !== 'auto').map(s => s.name).join(', ');

      // 2. Call Analyze
      const response = await browser.runtime.sendMessage({
        type: 'ANALYZE_POST',
        data: { postText: finalPostText, stylesList }
      });

      if (!response || !response.success) {
        throw new Error(response?.error || '分析失敗');
      }

      // 3. Parse Result
      const analysis = response.analysis || '';
      // Use non-greedy matching across multiple lines if needed, but standard format is line-based.
      // We'll use a safer approach: split by specific keys.

      const styleMatch = analysis.match(/STYLE:\s*(.+?)(?=\nSTRATEGY:|\nREASON:|$)/i);
      const strategyMatch = analysis.match(/STRATEGY:\s*(.+?)(?=\nREASON:|$)/i);
      const reasonMatch = analysis.match(/REASON:\s*(.+?)(?=$)/i);

      const chosenStyleName = styleMatch ? styleMatch[1].trim() : 'Casual Insight'; // Fallback
      const strategy = strategyMatch ? strategyMatch[1].trim() : '直接回應';
      const reason = reasonMatch ? reasonMatch[1].trim() : '符合上下文語氣';

      // map Name Back to ID (Matching by Chinese Name now)
      let targetStyle: ReplyStyle | undefined;

      // Check for Custom Style
      if (chosenStyleName.startsWith('Custom:')) {
        const customName = chosenStyleName.replace('Custom:', '').trim();
        targetStyle = {
          id: 'dynamic',
          name: customName,
          description: 'AI 自動生成的客製化風格',
          prompt: 'Dynamic Style' // Placeholder, won't be used directly by PromptBuilder for dynamic
        };
      } else {
        targetStyle = REPLY_STYLES.find(s => s.name === chosenStyleName)
          || REPLY_STYLES.find(s => chosenStyleName.includes(s.name))
          || REPLY_STYLES.find(s => s.id !== 'auto'); // Fallback
      }

      // Clean up reason text (remove potential "REASON:" prefix included by loose regex)
      const cleanReason = reason.replace(/^REASON[:：]\s*/i, '').trim();

      // 4. Show Analysis Toast (Persistent)
      // Format:
      // ✨ 風格：[Style Name]
      // 🎯 策略：[Strategy]
      // 💬 理由：[Reason]
      const analysisToast = this.showSuccessMessage(`✨ 風格：${targetStyle?.name || chosenStyleName}\n🎯 策略：${strategy}\n💬 理由：${cleanReason}`, 0); // 0 = Persistent
      this.activeSmartToasts.push(analysisToast);

      // 5. Generate Content immediately (user sees toast while generating)
      if (targetStyle) {
        // await generation so we can control the final cleanup
        await this.generateReply(post, targetStyle, strategy, true); // true = isSmartAutoMode
      }

      // 6. Unified Cleanup after 10 seconds
      setTimeout(() => {
        this.activeSmartToasts.forEach(t => this.removeToast(t));
        this.activeSmartToasts = [];
      }, 10000);

    } catch (e: any) {
      console.error('Smart Auto Error:', e);
      this.showError(e.message);
      this.hideLoadingState();
    }
  }

  private activeSmartToasts: HTMLElement[] = [];

  private async generateReply(post: Element, style: ReplyStyle, strategy: string = '', isSmartAutoMode: boolean = false) {
    const finalPostText = this.extractFullContext(post);
    if (!finalPostText) {
      this.showError('無法讀取貼文內容');
      return;
    }


    let replyInput = await this.findReplyInput(post);

    // Auto-open Reply Modal if not found
    if (!replyInput) {
      const opened = await this.openReplyModal(post);
      if (opened) {
        // Wait for animation and focus
        replyInput = await this.findReplyInput(post);
      }
    }

    if (!replyInput) {
      this.showError('找不到回覆輸入框，請先點擊回覆按鈕');
      return;
    }

    // Capture images if Vision is enabled
    let images: string[] = [];
    if (this.useVision) {
      const imgElements = post.querySelectorAll('img[src*="fbcdn"], img[src*="cdninstagram"]');
      // Take up to 2 images
      imgElements.forEach((img, index) => {
        if (index < 2 && img instanceof HTMLImageElement && img.src) {
          images.push(img.src);
        }
      });
    }

    // Extract a short snippet of the context to display
    const contextSnippet = finalPostText.replace(/\s+/g, ' ').substring(0, 30) + '...';

    // --- SMART ANALYSIS ORCHESTRATION ---
    if (style.id === 'auto') {
      const contextSnippet = finalPostText.replace(/\s+/g, ' ').substring(0, 30) + '...';
      this.showLoadingState('🔍 正在分析貼文情境與語意...', contextSnippet);

      const stylesList = REPLY_STYLES
        .filter(s => s.id !== 'auto')
        .map(s => `- ${s.name}: ${s.description}`)
        .join('\n');

      try {
        const analysisResult = await browser.runtime.sendMessage({
          type: 'ANALYZE_POST',
          data: {
            postText: finalPostText,
            stylesList: stylesList
          }
        });

        if (analysisResult && analysisResult.success) {
          const analysisText = analysisResult.analysis;
          const getValue = (key: string) => {
            const match = analysisText.match(new RegExp(`${key}:\\s*(.+)`, 'i'));
            return match ? match[1].trim() : null;
          };
          const styleName = getValue('STYLE');
          const strategyText = getValue('STRATEGY');
          const reason = getValue('REASON');

          const matched = REPLY_STYLES.find(s => s.name === styleName);
          if (matched) {
            style = matched; // Update style for generation!
            strategy = strategyText || '';
            this.showLoadingState(`🧠 策略：${style.name}`, `思路：${reason}`);
            await new Promise(r => setTimeout(r, 1200));
          } else {
            this.showLoadingState('⚠️ 分析模糊，使用預設風格...');
            style = REPLY_STYLES.find(s => s.id === 'connection')!;
          }
        } else {
          console.warn('Analysis failed or returned empty');
        }
      } catch (e) {
        console.warn('Analysis failed', e);
      }
    } else {
      // Normal Simulation for specific styles
      // Skip if Smart Auto Mode (legacy logic might affect this, but handleSmartAuto calls with specific style)
      if (!isSmartAutoMode) {
        this.showLoadingState(`🧠 正在構思「${style.name}」風格回覆...`, contextSnippet);
        await new Promise(r => setTimeout(r, 600));
      }
    }

    // Vision Check (Visual Analysis Toast)
    // Only show separate loading step if NOT in Smart Auto mode (to preserve Analysis Toast)
    if (!isSmartAutoMode && images.length > 0) {
      this.showLoadingState('👁️ 正在視覺辨識圖片內容...', contextSnippet);
      await new Promise(r => setTimeout(r, 1000));
    }

    if (!isSmartAutoMode) {
      this.showLoadingState(`✨ 正在生成內容...`, contextSnippet);
    }

    try {
      const storageResult = await browser.storage.local.get(STORAGE_KEYS.CUSTOM_STYLE_EXAMPLES);
      const customExamples = storageResult[STORAGE_KEYS.CUSTOM_STYLE_EXAMPLES];

      const response = await browser.runtime.sendMessage({
        type: 'GENERATE_REPLY',
        data: {
          postText: finalPostText,
          style: style.id, // Fix: Pass ID string
          strategy: strategy,
          tone: this.selectedTone,
          customExamples: customExamples,
          images: images,
          options: {
            useKaomoji: this.useKaomoji,
            isSelfPost: this.isHostMode,
            dynamicStyleName: style.id === 'dynamic' ? style.name : undefined
          }
        }
      });

      if (response && response.success) {
        let finalReply = response.reply;
        let analysisInfo: string | undefined = undefined;

        // 1. Line-Based Parsing (Stronger than XML for LLMs)
        const styleMatch = finalReply.match(/STYLE:\s*(.+)$/im);
        const reasonMatch = finalReply.match(/REASON:\s*(.+)$/im);

        // Always clean up the reply first if these tags exist
        if (styleMatch) finalReply = finalReply.replace(styleMatch[0], '');
        if (reasonMatch) finalReply = finalReply.replace(reasonMatch[0], '');
        finalReply = finalReply.trim();
        finalReply = finalReply.replace(/^```\w*\s*/, '').replace(/\s*```$/, '');

        if (isSmartAutoMode) {
          // In Smart Auto, we already showed a detailed Analysis toast.
          // The second toast should be simple to avoid clutter.
          analysisInfo = undefined;
        } else if (styleMatch || reasonMatch) {
          const styleName = styleMatch ? styleMatch[1].trim() : '智能推薦';
          const reasonText = reasonMatch ? reasonMatch[1].trim() : '根據上下文自動選擇';

          analysisInfo = `✨ 風格：${styleName}\n💬 理由：${reasonText}`;
        } else if (style.id === 'auto') {
          // Fallback for Smart Mode if parsing completely failed
          analysisInfo = `✨ 風格：智能搭配 (自動)\n💬 理由：AI 自動分析情境`;
        }

        // Fill the input and capture the toast if smart auto mode
        const toast = this.fillReplyInput(replyInput as HTMLInputElement, finalReply, analysisInfo);

        if (isSmartAutoMode && toast) {
          this.activeSmartToasts.push(toast);
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

        // Exclude Stock/Crypto Tickers (e.g. [BABA +1.67%], $BTC) - Likely User Bio/Header garbage
        if (/\[[A-Z]{2,6}\s*[+\-]?\d+(\.\d+)?%\]/.test(text)) return false;
        if (/^\$[A-Z]{2,6}/.test(text)) return false; // $BTC starting line

        // Exclude pure number lines (e.g. "24 2" -> Likes/Comments count)
        if (/^[\d\s,.]+$/.test(text)) return false;

        // Exclude raw handles if captured as separate lines (e.g. u_username)
        // Adjust regex to be safe, only exclude if it looks *exactly* like a handle and nothing else
        if (/^u_[a-zA-Z0-9_.]+$/.test(text)) return false;

        return true;
      });

    return texts.join('\n\n').trim();
  }

  // --- Batch Mode Implementation ---

  private toggleBatchMode() {
    this.isBatchMode = !this.isBatchMode;

    if (this.isBatchMode) {
      this.renderBatchActionBar();
      this.injectBatchCheckboxes();
      // Start a faster interval to keep injecting checkboxes as user scrolls
      if (!this.batchObserverInterval) {
        this.batchObserverInterval = window.setInterval(() => this.injectBatchCheckboxes(), 1000);
      }
    } else {
      // Cleanup
      this.selectedComments.clear();
      if (this.batchBar) {
        this.batchBar.remove();
        this.batchBar = null;
      }
      if (this.batchObserverInterval) {
        clearInterval(this.batchObserverInterval);
        this.batchObserverInterval = null;
      }
      // Remove all checkboxes
      document.querySelectorAll('.sonar-batch-checkbox').forEach(el => el.remove());
    }
  }

  private batchObserverInterval: number | null = null;

  private injectBatchCheckboxes() {
    if (!this.isBatchMode) return;

    // Select targets: Use the reply div as a reference
    // Standard reply button selector
    const replySelectors = [
      'div[role="button"][aria-label="回覆"]',
      'div[role="button"][aria-label="Reply"]',
      'svg[aria-label="回覆"]',
      'svg[aria-label="Reply"]'
    ];

    // Find all potential comment containers
    // Strategy: Find reply buttons, then inject checkbox next to them if not present
    for (const selector of replySelectors) {
      const buttons = document.querySelectorAll(selector);
      buttons.forEach(btn => {
        // Find a stable container to inject into. usually the parent or grandparent.
        // We want it visible next to the reply icon.
        const clickable = btn.closest('[role="button"]') || btn.parentElement;

        if (clickable && clickable instanceof HTMLElement) {
          // Check if already injected
          const parent = clickable.parentElement;
          if (parent && !parent.querySelector('.sonar-batch-checkbox')) {
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'sonar-batch-checkbox';

            // Identify the "post" container associated with this button
            // usually traverse up to find 'data-pressable-container' or similar
            // or just store the 'clickable' as the target to open context from.
            const postContainer = clickable.closest('[data-pressable-container="true"]') || clickable.closest('div[style*="border-bottom"]');

            checkbox.onclick = (e) => {
              e.stopPropagation(); // Prevent opening reply modal
              if (checkbox.checked) {
                if (postContainer) this.selectedComments.add(postContainer);
              } else {
                if (postContainer) this.selectedComments.delete(postContainer);
              }
              this.updateBatchActionBar();
            };

            // Inject before the reply button container
            parent.prepend(checkbox);
            // Apply some flex style to parent if needed to align
            parent.style.display = 'flex';
            parent.style.alignItems = 'center';
          }
        }
      });
    }
  }

  private renderBatchActionBar() {
    if (this.batchBar) return;

    this.batchBar = document.createElement('div');
    this.batchBar.className = 'sonar-batch-bar';
    this.batchBar.innerHTML = `
          <span class="sonar-batch-count">已選 0 則</span>
          <input type="text" class="fixed-input" placeholder="輸入固定回覆內容..." id="sonar-batch-fixed-input">
          <button class="sonar-batch-btn-fixed" id="sonar-batch-btn-fixed">⚡️ 填入固定內容</button>
          <button class="sonar-batch-btn-random" id="sonar-batch-btn-random">🎲 隨機 AI 生成</button>
          <button class="sonar-batch-btn-cancel" id="sonar-batch-btn-cancel">取消</button>
      `;

    document.body.appendChild(this.batchBar);

    // Bind Events
    this.batchBar.querySelector('#sonar-batch-btn-fixed')?.addEventListener('click', () => {
      const input = this.batchBar?.querySelector('#sonar-batch-fixed-input') as HTMLInputElement;
      if (input && input.value) {
        this.handleBatchFill('fixed', input.value);
      } else {
        this.showError('請輸入固定內容');
      }
    });

    this.batchBar.querySelector('#sonar-batch-btn-random')?.addEventListener('click', () => {
      this.handleBatchFill('random');
    });

    this.batchBar.querySelector('#sonar-batch-btn-cancel')?.addEventListener('click', () => {
      this.toggleBatchMode(); // Toggle off
    });
  }

  private updateBatchActionBar() {
    if (!this.batchBar) return;
    const countSpan = this.batchBar.querySelector('.sonar-batch-count');
    if (countSpan) countSpan.textContent = `已選 ${this.selectedComments.size} 則`;
  }

  private async handleBatchFill(mode: 'fixed' | 'random', fixedText: string = '') {
    if (this.selectedComments.size === 0) {
      this.showError('請先勾選留言');
      return;
    }

    this.showLoadingState(`正在批次處理 ${this.selectedComments.size} 則留言...`);

    const targets = Array.from(this.selectedComments);
    let successCount = 0;

    // Process in parallel for speed (since we are just filling text)
    const tasks = targets.map(async (post) => {
      try {
        // 1. Ensure input is open
        let input = await this.findReplyInput(post);
        if (!input) {
          await this.openReplyModal(post);
          // Small wait for UI
          await new Promise(r => setTimeout(r, 500));
          input = await this.findReplyInput(post);
        }

        if (!input) return; // Skip if failed to open

        let replyText = fixedText;

        if (mode === 'random') {
          // Generate AI content
          const styles = REPLY_STYLES.filter(s => s.id !== 'auto' && s.id !== 'lust'); // Exclude auto/lust
          const randomStyle = styles[Math.floor(Math.random() * styles.length)];
          const context = this.extractFullContext(post);

          // Reuse generate logic logic but direct call
          // We can use runtime message directly
          // Batch mode - skip custom examples for simplicity

          const response = await browser.runtime.sendMessage({
            type: 'GENERATE_REPLY',
            data: {
              postText: context,
              style: randomStyle,
              strategy: 'Batch Random Reply',
              tone: 'friendly',
              images: [], // Batch ignore images for speed? Or check? Let's ignore for speed.
              options: { isSelfPost: this.isHostMode }
            }
          });

          if (response && response.success) {
            replyText = response.reply;
            // Clean up meta
            replyText = replyText.replace(/STYLE:.*$/im, '').replace(/REASON:.*$/im, '').trim();
          } else {
            replyText = '(AI 生成失敗)';
          }
        }

        // Fill input
        this.fillReplyInput(input as HTMLInputElement, replyText, undefined);
        successCount++;

      } catch (e) {
        console.error('Batch error for item:', e);
      }
    });

    await Promise.all(tasks);

    this.hideLoadingState();
    this.showSuccessMessage(`已完成！成功填入 ${successCount} 則留言。\n請手動檢查並發送此批留言。`);

    // Optional: Clear selection after done?
    // this.selectedComments.clear();
    // this.updateBatchActionBar();
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

    // Pass isSmartAutoMode flag logic implicitly via optional param or analyze caller?
    // Determine duration: if we are in Smart Auto Mode (passed implicitly?), actually we want 
    // the caller (handleSmartAuto) to control the duration if possible.
    // BUT, since we don't pass isSmartAuto flag here easily without breaking legacy signatures...
    // Let's just return the toast.
    return this.showSuccessMessage(analysisInfo, 4000);
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

  // hideExistingSelectors removed (unused)

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
  // getPostAuthor removed (unused)
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
