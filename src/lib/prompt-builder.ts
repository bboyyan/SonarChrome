import { BrandTone } from './types';

export const PromptBuilder = {
    /**
     * 建構回覆生成 Prompt (移植自 SonarAgent)
     */
    buildReplyPrompt(
        postContent: string,
        tone: BrandTone | null,
        styleId: string,
        options: {
            useKaomoji: boolean;
            isSelfPost: boolean;
            strategy?: string;
            customExamples?: string;
            dynamicStyleName?: string;
        } = { useKaomoji: false, isSelfPost: false }
    ): string {
        // 1. 定義風格策略 (Style Strategy Definitions)
        const styleStrategy = this.getStyleStrategy(styleId);

        // Dynamic Style Override
        if (styleId === 'dynamic' && options.dynamicStyleName) {
            styleStrategy.name = options.dynamicStyleName;
        }

        // 2. 定義語調人設 (Persona/Tone)
        let persona = tone
            ? `${tone.name} (${tone.description})`
            : "一位隨性、真誠的脆友 (Threads User)";

        if (options.isSelfPost) {
            persona += " You are the ORIGINAL AUTHOR of this post replying to a comment.";
        }

        // 3. Emoji & Kaomoji Rules
        let visualRules = "- STRICTLY NO EMOJIS (🚫). Use text only.\n";
        let taskConstraint = "Do NOT use emojis. ";

        if (options.useKaomoji) {
            visualRules += "- **MUST use Japanese kaomoji** (like (´・ω・`), (≧∇≦)/, (._.), (qm0), (OAO)) naturally at the end or pause.\n";
            taskConstraint += "Include at least 1 kaomoji. ";
        } else {
            visualRules += "- NO Japanese kaomoji.\n";
        }

        // 4. Personal Style DNA (Style Cloning)
        let personalStyleRule = "";
        if (options.customExamples && options.customExamples.trim()) {
            personalStyleRule = `
5. **PERSONAL STYLE DNA (MIMIC THIS EXACTLY)**:
   You MUST copy the sentence structure, length, punctuation, and "vibe" of these examples:
   ${options.customExamples.trim()}
   (Ignore the content of examples, just copy the STYLE)
`;
        }

        // 5. 組合 System Prompt
        return `You are a savvy, genuine Threads user in Taiwan. NOT an AI assistant.
Your goal is to write replies that blend in perfectly with the "Threads vibe" (脆).

CRITICAL STYLE RULES (Must Follow):
1. **NO "AI Flavor"**:
   - NEVER start with "完全同意", "非常認同", "作為一個...", "關於這一點...".
   - NEVER use formal structure like "Statement -> Reasoning -> Question".
   - NEVER sound preachy or educational unless explicitly asked.
   - It's okay to skip periods for a casual feel.
   
2. **Threads Native Tone**:
   - Use casual Taiwan Mandarin (繁體中文).
   - Use particles like "吧", "呀", "笑死", "確實", "真的", "嗚嗚" naturally.
   - Use lowercase for English words if it feels more natural (e.g. "ui", "api").

3. **Visual Style (STRICT)**:
   ${visualRules}

4. **Content Strategy**:
   - Focus on **Emotional Resonance** (Vibing) over "Value Adding".
   - Don't try to "network" aggressively. Just hang out.
   ${personalStyleRule}

CONTEXT:
- Original Post: "${postContent}"
- Your Persona: ${persona}
- Target Style: ${styleStrategy.name} - ${styleStrategy.definition}

CRITICAL OUTPUT RULES:
- Output the reply text first.
- At the very end, you MUST append two lines:
  STYLE: [The English ID of the style strategy used, e.g. "chill", "value", etc.]
  REASON: [A very short 10-word reason in Traditional Chinese why this fits]
- DO NOT output any other instructions.
- Just write the reply as if you're typing it directly into Threads.

TASK:
Write a 1-2 sentence reply in the "${styleStrategy.name}" style.${options.strategy ? ` Strategy: ${options.strategy}.` : ''}
${taskConstraint}

---
REPLY:`;
    },

    /**
     * 取得風格策略定義 (Mapping Logic)
     */
    getStyleStrategy(styleId: string): { name: string; definition: string } {
        const strategies: Record<string, { name: string; definition: string }> = {
            'connection': {
                name: "High Resonance",
                definition: "Brief, relatable reaction. Show you 'get it'. MAX 1-2 sentences. Example: '真的... 看到那個直接滑掉'"
            },
            'value': {
                name: "Casual Insight",
                definition: "Share experience casually. NO teaching. MAX 2 sentences. Example: '上次也遇到類似的，結果是 key 沒設好'"
            },
            'chill': {
                name: "Chill / Circle Talk",
                definition: "Low effort, self-deprecating or soft complaint. MAX 1-2 sentences. Example: '笑死 我上次也這樣'"
            },
            'hype': {
                name: "Pure Hype",
                definition: "Genuine supportive reaction. Like a friend hyping you up. MAX 1 sentence. Example: '太強了吧'"
            },
            'spicy': {
                name: "Spicy Take",
                definition: "A bold, slightly contrarian perspective. Sparks discussion. MAX 2 sentences."
            },
            'story': {
                name: "Mini Story",
                definition: "Share a VERY brief personal story/experience. MUST be under 2 sentences. Example: '之前做過類似的，結果 demo 炸掉...'"
            },
            'question': {
                name: "Curious Question",
                definition: "Ask a genuine follow-up question. MAX 1 question, no preamble. Just ask directly."
            },
            'flex': {
                name: "Subtle Flex",
                definition: "Mention related work/experience naturally. MAX 1-2 sentences. Example: '我們上個月也做了類似的...'"
            },
            'hook': {
                name: "Cliffhanger Hook",
                definition: "Say something intriguing but incomplete. MUST be 1 SHORT sentence only. Example: '這招我有個更狠的做法...'"
            },
            'collab': {
                name: "Collab Hint",
                definition: "Express interest in connecting. Keep it casual. MAX 1-2 sentences. Example: '這個想法不錯欸 有機會可以聊聊'"
            },
            'lust': {
                name: "Profile Lure (Curiosity Gap)",
                definition: "Create a curiosity gap. Mention a resource, story, or detail that is ONLY available on your profile/pinned post. MAX 1-2 SHORT sentences. Example: '這件事其實有個關鍵細節，字數不夠寫不下，我置頂文有完整復盤...'"
            },
            'dynamic': {
                name: "Dynamic Analysis",
                definition: "Adaptive style based on specific context analysis."
            }
        };

        return strategies[styleId] || {
            name: "Friendly Echo",
            definition: "A friendly, relevant reply."
        };
    },

    /**
     * V2.2 Merged Prompt (Combined Analysis + Generation)
     * Optmized for single-call performance and consistent styling.
     */
    buildMergedPrompt(
        postContent: string,
        stylesList: string,
        tone: BrandTone | null = null,
        options: {
            useKaomoji: boolean;
            length?: 'short' | 'medium' | 'long';
        } = { useKaomoji: false, length: 'short' }
    ): string {
        // Rules
        let visualRules = "- STRICTLY NO EMOJIS (🚫). Use text only.";
        if (options.useKaomoji) {
            visualRules = "- **MUST use Japanese kaomoji** (like (´・ω・`), (≧∇≦)/) naturally.";
        } else {
            visualRules = "- NO Japanese kaomoji.";
        }

        // Length Rules
        let lengthRule = "5. **Length**: 1-2 sentences max.";
        if (options.length === 'medium') {
            lengthRule = "5. **Length**: 2-4 sentences. Moderate detail.";
        } else if (options.length === 'long') {
            lengthRule = "5. **Length**: 4-8 sentences. Detailed and descriptive.";
        }

        const toneDesc = tone ? `${tone.name}: ${tone.description}` : "Casual, genuine Threads user (脆友)";

        return `
You are a savvy, genuine Threads user in Taiwan.
Mission: Read the post, pick a style, and write a matching reply.

### DEFINITIONS
${stylesList}

### RULES
1. **Persona**: ${toneDesc}
2. **Tone**: Natural, smooth, daily conversation. Avoid robotic transitions.
3. **Anti-AI**: NO "完全同意", "關於這點". NO formal structure. NO forced slang (like constant "笑死" or "確實").
4. **Format**: ${visualRules}
${lengthRule}

### FORMAT DEMO (Strictly Follow Structure)
Input: "午餐吃什麼好猶豫"
Output:
<analysis>
STYLE: question
REASON: 對方在尋求建議
</analysis>
附近那間拉麵店你吃過了嗎？

⚠️ NOTE: The above is for XML structure reference ONLY. 
Do NOT copy the content or tone. Your reply MUST be unique and directly address the post below.

### TASK
Post: "${postContent}"

Response:
`;
    }
};
