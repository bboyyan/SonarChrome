# Legacy Reply Styles Backup
Date: 2026-01-13
Source: src/lib/constants.ts & src/lib/prompt-builder.ts

## Style Definitions (constants.ts)

| ID | Name | Description | Prompt Key |
|---|---|---|---|
| connection | 建立連結 | 高度共鳴，表達「我懂你」 | High Resonance |
| value | 隨性見解 | 分享經驗但不說教 | Casual Insight |
| chill | 圈內搭話 | 輕鬆互動，微羨慕或假抱怨 | Chill / Circle Talk |
| hype | 純粹應援 | 像朋友一樣幫你打氣 | Pure Hype |
| spicy | 辛辣觀點 | 大膽、稍微逆風的觀點 | Spicy Take |
| story | 極短編 | 分享極短的個人故事 | Mini Story |
| question | 好奇提問 | 真誠追問，引發對話 | Curious Question |
| flex | 微炫耀 | 低調展示實力 | Subtle Flex |
| hook | 埋鉤子 | 話只說一半，引發好奇 | Cliffhanger Hook |
| collab | 隨性邀約 | 拋出合作橄欖枝 | Collab Hint |
| lust | 引流鉤子 | 製造好奇缺口，引導看主頁 | Profile Lure |

## Prompt Strategies (prompt-builder.ts)

```typescript
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
}
```
