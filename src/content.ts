import browser from "webextension-polyfill";
import { type LikeThreshold, DEFAULT_THRESHOLDS } from "./types";
import { REPLY_STYLES, STORAGE_KEYS } from './lib/constants';
import type { ReplyStyle } from './lib/types';

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
      this.addBookmarkButton(post, threshold, viralPrediction);
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

  private getThemeAdjustedColor(color: string): string {
    const isDark = this.isDarkMode();

    // 為深色模式調整顏色，使其更亮一些
    if (isDark) {
      const colorMap: { [key: string]: string } = {
        "#22C55E": "#34D399", // 更亮的綠色
        "#EAB308": "#FCD34D", // 更亮的黃色
        "#F97316": "#FB923C", // 更亮的橙色
        "#EF4444": "#F87171", // 更亮的紅色
      };
      return colorMap[color] || color;
    }

    return color;
  }

  private addBookmarkButton(
    post: HTMLElement,
    threshold: LikeThreshold | null,
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

    // 檢查付費狀態
    const result = await browser.storage.local.get([
      "isPaidUser",
      "logoRemoved",
    ]);
    if (result.isPaidUser || result.logoRemoved) {
      return; // 不創建Logo
    }

    const logo = document.createElement("div");
    logo.className = "threads-helper-logo";
    logo.innerHTML = `
      <div style="
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      ">
        <div style="
          width: 24px;
          height: 24px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        "><img src="${browser.runtime.getURL('sonar-icon.png')}" style="width: 100%; height: 100%; object-fit: cover;" alt="Sonar Icon" /></div>
        <span style="
          font-size: 13px;
          font-weight: 600;
          color: inherit;
        ">SonarAgent</span>
      </div>
    `;

    const isDark = this.isDarkMode();
    logo.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${isDark ? "rgba(38, 38, 38, 0.95)" : "rgba(255, 255, 255, 0.95)"
      };
      color: ${isDark ? "#ffffff" : "#000000"};
      border-radius: 12px;
      box-shadow: 0 4px 20px ${isDark ? "rgba(0, 0, 0, 0.3)" : "rgba(0, 0, 0, 0.1)"
      };
      backdrop-filter: blur(10px);
      border: 1px solid ${isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)"
      };
      z-index: 10000;
      cursor: pointer;
      transition: all 0.3s ease;
      user-select: none;
    `;

    // 整個 Logo 點擊就開啟 Modal
    logo.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.showSponsorModal();
    });

    document.body.appendChild(logo);
    this.logoElement = logo;

    // 添加懸停效果
    logo.addEventListener("mouseenter", () => {
      logo.style.transform = "translateY(-2px)";
      logo.style.boxShadow = `0 8px 30px ${isDark ? "rgba(0, 0, 0, 0.4)" : "rgba(0, 0, 0, 0.15)"
        }`;
    });

    logo.addEventListener("mouseleave", () => {
      logo.style.transform = "translateY(0)";
      logo.style.boxShadow = `0 4px 20px ${isDark ? "rgba(0, 0, 0, 0.3)" : "rgba(0, 0, 0, 0.1)"
        }`;
    });
  }

  private showSponsorModal() {
    if (this.modalElement) {
      // 如果 modal 已存在，先移除再重新創建
      this.modalElement.remove();
      this.modalElement = null;
    }

    const modal = document.createElement("div");
    modal.className = "threads-helper-modal";

    const isDark = this.isDarkMode();
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10001;
      backdrop-filter: blur(5px);
      animation: fadeIn 0.3s ease;
    `;

    modal.innerHTML = `
      <div style="
        background: ${isDark ? "#262626" : "#ffffff"};
        color: ${isDark ? "#ffffff" : "#000000"};
        border-radius: 20px;
        padding: 32px;
        max-width: 400px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        animation: slideIn 0.3s ease;
      ">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="
            width: 60px;
            height: 60px;
            background: linear-gradient(45deg, #22C55E, #3B82F6);
            border-radius: 15px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 28px;
            margin: 0 auto 16px;
          ">⚡</div>
          <h2 style="
            margin: 0 0 8px 0;
            font-size: 24px;
            font-weight: 700;
            background: linear-gradient(45deg, #22C55E, #3B82F6);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
          ">SonarAgent</h2>
          <p style="
            margin: 0;
            font-size: 16px;
            opacity: 0.8;
            line-height: 1.5;
          ">感謝使用我們的擴充功能！</p>
        </div>


        <div style="
          background: ${isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)"
      };
          border-radius: 16px;
          padding: 24px;
          margin-bottom: 24px;
        ">
          <h3 style="
            margin: 0 0 16px 0;
            font-size: 18px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 8px;
            color: white;
          ">
            <span style="font-size: 20px;">🧵</span>
            追蹤我的 Threads
          </h3>
          <p style="
            margin: 0 0 16px 0;
            font-size: 14px;
            line-height: 1.5;
            opacity: 0.8;
          ">獲取最新功能更新和開發進度！</p>
          <a href="https://www.threads.net/@choyeh5" target="_blank" class="threads-link" style="
            display: block;
            width: 100%;
            padding: 12px;
            background: ${isDark ? "#ffffff" : "#000000"};
            color: ${isDark ? "#000000" : "#ffffff"};
            text-decoration: none;
            border-radius: 12px;
            text-align: center;
            font-weight: 600;
            transition: all 0.2s ease;
          ">
            🧵 追蹤 @choyeh5
          </a>
        </div>

        <!-- Verification Code Input (hidden by default) -->
        <div class="verification-section" style="
          display: none;
          background: ${isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)"
      };
          border-radius: 16px;
          padding: 24px;
          margin-bottom: 24px;
        ">
          <h3 style="
            margin: 0 0 16px 0;
            font-size: 18px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 8px;
          ">
            <span style="font-size: 20px;">🔐</span>
            驗證付款
          </h3>
          <p style="
            margin: 0 0 16px 0;
            font-size: 14px;
            line-height: 1.5;
            opacity: 0.8;
          ">請輸入付款後獲得的 6 位數字驗證碼：</p>
          
          <div style="display: flex; gap: 8px; margin-bottom: 16px;">
            ${Array.from(
        { length: 6 },
        (_, i) => `
              <input 
                type="text" 
                class="verification-digit" 
                data-index="${i}"
                maxlength="1" 
                style="
                  width: 40px;
                  height: 40px;
                  text-align: center;
                  font-size: 18px;
                  font-weight: 700;
                  border: 2px solid ${isDark ? "rgba(255, 255, 255, 0.2)" : "#e5e5e5"
          };
                  border-radius: 8px;
                  background: ${isDark ? "rgba(255, 255, 255, 0.1)" : "#ffffff"
          };
                  color: inherit;
                  outline: none;
                  transition: all 0.2s ease;
                "
              />
            `
      ).join("")}
          </div>
          
          <div class="verification-status" style="
            padding: 12px;
            border-radius: 8px;
            text-align: center;
            font-size: 14px;
            font-weight: 600;
            display: none;
          "></div>
        </div>

        <div style="display: flex; gap: 12px;">
          <button class="modal-later-btn" style="
            flex: 1;
            padding: 12px;
            background: ${isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)"
      };
            color: inherit;
            border: none;
            border-radius: 12px;
            cursor: pointer;
            font-weight: 600;
            transition: all 0.2s ease;
          ">
            之後再說
          </button>
          <button class="modal-close-btn" style="
            flex: 1;
            padding: 12px;
            background: #EF4444;
            color: #ffffff;
            border: none;
            border-radius: 12px;
            cursor: pointer;
            font-weight: 600;
            transition: all 0.2s ease;
          ">
            移除右上角 Logo
          </button>
        </div>
        
        <div style="text-align: center; margin-top: 16px;">
          <button class="show-verification-btn" style="
            background: none;
            border: none;
            color: ${isDark ? "rgba(255, 255, 255, 0.6)" : "rgba(0, 0, 0, 0.6)"
      };
            cursor: pointer;
            font-size: 12px;
            text-decoration: underline;
            transition: opacity 0.2s ease;
          ">
            已付款？輸入驗證碼
          </button>
        </div>
      </div>
    `;

    // 添加 CSS 動畫
    if (!document.querySelector("#threads-helper-modal-style")) {
      const style = document.createElement("style");
      style.id = "threads-helper-modal-style";
      style.textContent = `
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideIn {
          from { 
            opacity: 0; 
            transform: translateY(-20px) scale(0.95); 
          }
          to { 
            opacity: 1; 
            transform: translateY(0) scale(1); 
          }
        }
      `;
      document.head.appendChild(style);
    }

    // 點擊背景關閉
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.remove();
        this.modalElement = null;
      }
    });

    document.body.appendChild(modal);
    this.modalElement = modal;

    // 添加事件監聽器
    const coffeeLink = modal.querySelector(".coffee-link") as HTMLElement;
    if (coffeeLink) {
      coffeeLink.addEventListener("mouseenter", () => {
        coffeeLink.style.transform = "translateY(-2px)";
        coffeeLink.style.boxShadow = "0 8px 20px rgba(255,221,0,0.3)";
      });
      coffeeLink.addEventListener("mouseleave", () => {
        coffeeLink.style.transform = "translateY(0)";
        coffeeLink.style.boxShadow = "none";
      });
    }

    const threadsLink = modal.querySelector(".threads-link") as HTMLElement;
    if (threadsLink) {
      threadsLink.addEventListener("mouseenter", () => {
        threadsLink.style.transform = "translateY(-2px)";
        threadsLink.style.boxShadow = "0 8px 20px rgba(0,0,0,0.2)";
      });
      threadsLink.addEventListener("mouseleave", () => {
        threadsLink.style.transform = "translateY(0)";
        threadsLink.style.boxShadow = "none";
      });
    }

    const laterBtn = modal.querySelector(".modal-later-btn") as HTMLElement;
    if (laterBtn) {
      laterBtn.addEventListener("click", () => {
        modal.remove();
        this.modalElement = null;
      });
      laterBtn.addEventListener("mouseenter", () => {
        laterBtn.style.background = isDark
          ? "rgba(255, 255, 255, 0.2)"
          : "rgba(0, 0, 0, 0.2)";
      });
      laterBtn.addEventListener("mouseleave", () => {
        laterBtn.style.background = isDark
          ? "rgba(255, 255, 255, 0.1)"
          : "rgba(0, 0, 0, 0.1)";
      });
    }

    const closeBtn = modal.querySelector(".modal-close-btn") as HTMLElement;
    if (closeBtn) {
      closeBtn.addEventListener("click", async () => {
        // 只跳轉到贊助頁面，不刪除 Logo
        window.open("https://buymeacoffee.com/ray948787o/e/456549", "_blank");

        modal.remove();
        this.modalElement = null;
      });
      closeBtn.addEventListener("mouseenter", () => {
        closeBtn.style.background = "#DC2626";
        closeBtn.style.transform = "translateY(-1px)";
      });
      closeBtn.addEventListener("mouseleave", () => {
        closeBtn.style.background = "#EF4444";
        closeBtn.style.transform = "translateY(0)";
      });
    }

    // 顯示驗證碼輸入區域
    const showVerificationBtn = modal.querySelector(".show-verification-btn") as HTMLElement;
    if (showVerificationBtn) {
      showVerificationBtn.addEventListener("click", () => {
        const verificationSection = modal.querySelector(
          ".verification-section"
        ) as HTMLElement;
        if (verificationSection) {
          verificationSection.style.display = "block";
          showVerificationBtn.style.display = "none";
          // 焦點到第一個輸入框
          const firstInput = modal.querySelector(
            ".verification-digit"
          ) as HTMLInputElement;
          if (firstInput) firstInput.focus();
        }
      });
    }

    // 驗證碼輸入邏輯
    const digitInputs = modal.querySelectorAll(
      ".verification-digit"
    ) as NodeListOf<HTMLInputElement>;
    digitInputs.forEach((input, index) => {
      input.addEventListener("input", (e) => {
        const target = e.target as HTMLInputElement;
        const value = target.value.replace(/[^0-9]/g, "");
        target.value = value;

        // 自動跳到下一個輸入框
        if (value && index < digitInputs.length - 1) {
          digitInputs[index + 1].focus();
        }

        // 檢查是否輸入完成
        this.checkVerificationCode(modal, digitInputs);
      });

      input.addEventListener("keydown", (e) => {
        // 退格鍵跳到上一個輸入框
        if (e.key === "Backspace" && !input.value && index > 0) {
          digitInputs[index - 1].focus();
        }
      });

      input.addEventListener("focus", () => {
        input.style.borderColor = "#22C55E";
      });

      input.addEventListener("blur", () => {
        input.style.borderColor = isDark
          ? "rgba(255, 255, 255, 0.2)"
          : "#e5e5e5";
      });
    });
  }

  private async checkVerificationCode(
    modal: HTMLElement,
    inputs: NodeListOf<HTMLInputElement>
  ) {
    const code = Array.from(inputs)
      .map((input) => input.value)
      .join("");
    const statusDiv = modal.querySelector(
      ".verification-status"
    ) as HTMLElement;

    if (code.length === 6) {
      // 向 background script 發送驗證請求
      const response = await browser.runtime.sendMessage({
        action: "verifyCode",
        code: code,
      });

      statusDiv.style.display = "block";

      if (response.success) {
        statusDiv.style.background = "rgba(34, 197, 94, 0.2)";
        statusDiv.style.color = "#22C55E";
        statusDiv.textContent = "✅ 驗證成功！Logo 已永久移除";

        // 移除 Logo 並關閉 Modal
        setTimeout(() => {
          modal.remove();
          this.modalElement = null;
          if (this.logoElement) {
            this.logoElement.remove();
          }
        }, 2000);
      } else {
        statusDiv.style.background = "rgba(239, 68, 68, 0.2)";
        statusDiv.style.color = "#EF4444";
        statusDiv.textContent = "❌ 驗證碼錯誤，請重新輸入";

        // 清空輸入框
        inputs.forEach((input) => {
          input.value = "";
          input.style.borderColor = "#EF4444";
        });
        inputs[0].focus();

        setTimeout(() => {
          statusDiv.style.display = "none";
          inputs.forEach((input) => {
            input.style.borderColor = modal.classList.contains("__fb-dark-mode")
              ? "rgba(255, 255, 255, 0.2)"
              : "#e5e5e5";
          });
        }, 3000);
      }
    } else if (code.length > 0) {
      statusDiv.style.display = "none";
    }
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

  constructor() {
    this.init();
    console.log('🤖 Threads AI Assistant 已載入');
  }

  private init() {
    if (this.isInjected) return;
    this.isInjected = true;

    this.injectButtons();
    this.startObserver();
    this.setupMessageListener();
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
    const rect = button.getBoundingClientRect();

    selector.style.position = 'fixed';
    selector.style.top = `${rect.bottom + 8}px`;
    selector.style.left = `${rect.left}px`;
    selector.style.zIndex = '10000';

    document.body.appendChild(selector);

    setTimeout(() => {
      const handleClickOutside = (e: Event) => {
        if (!selector.contains(e.target as Node)) {
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
      padding: 8px;
      min-width: 280px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    const title = document.createElement('div');
    title.style.cssText = `
      padding: 12px 16px 8px;
      font-weight: 600;
      font-size: 14px;
      color: #1c1e21;
      border-bottom: 1px solid #f0f0f0;
      margin-bottom: 8px;
    `;
    title.textContent = '選擇回覆風格';
    selector.appendChild(title);

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

  private async generateReply(post: Element, style: ReplyStyle) {
    const postText = this.extractPostText(post);
    if (!postText) {
      this.showError('無法讀取貼文內容');
      return;
    }

    const replyInput = this.findReplyInput(post);
    if (!replyInput) {
      this.showError('找不到回覆輸入框，請先點擊回覆按鈕');
      return;
    }

    this.showLoadingState();

    try {
      const response = await browser.runtime.sendMessage({
        type: 'GENERATE_REPLY',
        data: {
          postText,
          style: style.id,
          prompt: style.prompt
        }
      });

      if (response && response.success) {
        this.fillReplyInput(replyInput as HTMLInputElement, response.reply);
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

  private extractPostText(post: Element): string {
    const textElements = post.querySelectorAll('[dir="auto"]');
    const texts = Array.from(textElements)
      .map(el => el.textContent?.trim())
      .filter(text => text && text.length > 0);

    return texts.join(' ').slice(0, 1000);
  }

  private findReplyInput(post: Element): Element | null {
    // 試著找附近的 textarea 或 contenteditable
    let current = post.nextElementSibling;
    let attempts = 0;

    // 向下尋找
    while (current && attempts < 5) {
      const input = current.querySelector('textarea[placeholder*="回覆"], textarea[placeholder*="reply"], [contenteditable="true"]');
      if (input) return input;

      current = current.nextElementSibling;
      attempts++;
    }

    // 全局尋找（當彈出 modal 時）
    return document.querySelector('textarea[placeholder*="回覆"], textarea[placeholder*="reply"], [contenteditable="true"]');
  }

  private showLoadingState() {
    const loadingIndicator = document.createElement('div');
    loadingIndicator.id = 'threads-ai-loading';
    loadingIndicator.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 16px 24px;
      border-radius: 8px;
      font-size: 14px;
      z-index: 10001;
    `;
    loadingIndicator.textContent = '🤖 AI 正在生成回覆...';
    document.body.appendChild(loadingIndicator);
  }

  private hideLoadingState() {
    const loading = document.getElementById('threads-ai-loading');
    if (loading) {
      loading.remove();
    }
  }

  private fillReplyInput(input: HTMLInputElement | HTMLTextAreaElement, text: string) {
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

    this.showSuccessMessage();
  }

  private showSuccessMessage() {
    const message = document.createElement('div');
    message.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #42a645;
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 14px;
      z-index: 10001;
      animation: fadeIn 0.3s ease;
    `;
    message.textContent = '✅ 回覆已生成！';

    document.body.appendChild(message);
    setTimeout(() => message.remove(), 3000);
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
}

// 全域實例引用
let threadsHelperInstance: ThreadsHelper;
let threadsAIAssistantInstance: ThreadsAIAssistant;

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
      threadsAIAssistantInstance = new ThreadsAIAssistant();
    });
  } else {
    threadsAIAssistantInstance = new ThreadsAIAssistant();
  }
}

export { ThreadsHelper, ThreadsAIAssistant };
