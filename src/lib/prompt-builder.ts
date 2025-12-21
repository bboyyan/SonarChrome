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
        } = { useKaomoji: false, isSelfPost: false }
    ): string {
        // 1. 定義風格策略 (Style Strategy Definitions)
        const styleStrategy = this.getStyleStrategy(styleId);

        // 2. 定義語調人設 (Persona/Tone)
        let persona = tone
            ? `${tone.name} (${tone.description})`
            : "一位隨性、真誠的脆友 (Threads User)";

        if (options.isSelfPost) {
            persona += " You are the ORIGINAL AUTHOR of this post replying to a comment. Be appreciative, welcoming, or clarifying.";
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

        // 4. 組合 System Prompt
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

CONTEXT:
- Original Post: "${postContent}"
- Your Persona: ${persona}
- Target Style: ${styleStrategy.name} - ${styleStrategy.definition}

TASK:
Write a reply in the "${styleStrategy.name}" style.
Constraint: ${taskConstraint}
Keep it concise (under 100 words).
Output only the reply text.`;
    },

    /**
     * 取得風格策略定義 (Mapping Logic)
     */
    getStyleStrategy(styleId: string): { name: string; definition: string } {
        const strategies: Record<string, { name: string; definition: string }> = {
            'connection': {
                name: "High Resonance",
                definition: "Brief, relatable reaction. Show you 'get it'. Example: '真的... 看到那個直接滑掉 🫠'"
            },
            'value': {
                name: "Casual Insight",
                definition: "Share experience casually. NO teaching. Example: '上次也遇到類似的，結果是 key 沒設好'"
            },
            'chill': {
                name: "Chill / Circle Talk",
                definition: "Low effort, maybe a bit self-deprecating or soft complaint. Example: '笑死 我上次也這樣' or '這種好東西怎麼不揪'"
            },
            'hype': {
                name: "Pure Hype",
                definition: "Genuine supportive reaction. Like a friend hyping you up. Example: '太強了吧 🔥'"
            },
            'spicy': {
                name: "Spicy Take",
                definition: "A bold, slightly contrarian or deep perspective. Sparks discussion."
            },
            'story': {
                name: "Mini Story",
                definition: "Share a VERY brief personal story/experience (< 2 sentences). Example: '之前做過類似的，結果 demo 炸掉...'"
            },
            'question': {
                name: "Curious Question",
                definition: "Ask a genuine follow-up question. Make the author want to reply to YOU."
            },
            'flex': {
                name: "Subtle Flex",
                definition: "Mention related work/experience naturally, not bragging. Example: '我們上個月也做了類似的...'"
            },
            'hook': {
                name: "Cliffhanger Hook",
                definition: "Say something intriguing but incomplete. Example: '這招我有個更狠的做法...'"
            },
            'collab': {
                name: "Collab Hint",
                definition: "Express interest in connecting or collaborating casually. Example: '這個想法不錯欸 有機會可以聊聊'"
            }
        };

        return strategies[styleId] || {
            name: "Friendly Echo",
            definition: "A friendly, relevant reply."
        };
    }
};
