require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware - increase limit for base64 images
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Get default config from environment
app.get('/api/config', (req, res) => {
  res.json({
    baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    model: process.env.DEFAULT_MODEL || 'gpt-4o-mini',
    hasEnvKey: !!process.env.OPENAI_API_KEY
  });
});

// Describe image for group chat (converts image to text)
app.post('/api/describe-image', async (req, res) => {
  const { images, apiKey, baseUrl, model } = req.body;

  const finalApiKey = apiKey || process.env.OPENAI_API_KEY;
  const finalBaseUrl = baseUrl || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const finalModel = model || process.env.DEFAULT_MODEL || 'gpt-4o-mini';

  if (!finalApiKey) {
    return res.status(400).json({ error: 'API Key required' });
  }

  if (!images || images.length === 0) {
    return res.status(400).json({ error: 'No images provided' });
  }

  // Build content with images
  const content = [
    { type: 'text', text: '请简洁描述这张图片的内容（50-100字），用于让其他人了解图片内容。只返回描述，不要其他内容。' }
  ];

  for (const img of images) {
    content.push({
      type: 'image_url',
      image_url: { url: img, detail: 'low' }
    });
  }

  try {
    const response = await fetch(`${finalBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${finalApiKey}`
      },
      body: JSON.stringify({
        model: finalModel,
        messages: [{ role: 'user', content }],
        max_tokens: 200
      })
    });

    if (!response.ok) {
      const error = await response.text();
      return res.status(response.status).json({ error });
    }

    const data = await response.json();
    const description = data.choices?.[0]?.message?.content?.trim() || '（图片内容无法识别）';

    res.json({ description });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Chat API with streaming (supports vision/images)
app.post('/api/chat', async (req, res) => {
  const { messages, apiKey, baseUrl, model, systemPrompt } = req.body;

  const finalApiKey = apiKey || process.env.OPENAI_API_KEY;
  const finalBaseUrl = baseUrl || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const finalModel = model || process.env.DEFAULT_MODEL || 'gpt-4o-mini';

  if (!finalApiKey) {
    return res.status(400).json({ error: 'API Key is required' });
  }

  // Build messages array with system prompt
  const apiMessages = [];
  if (systemPrompt) {
    apiMessages.push({ role: 'system', content: systemPrompt });
  }
  apiMessages.push(...messages);

  try {
    const response = await fetch(`${finalBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${finalApiKey}`
      },
      body: JSON.stringify({
        model: finalModel,
        messages: apiMessages,
        stream: true
      })
    });

    if (!response.ok) {
      const error = await response.text();
      return res.status(response.status).json({ error: error });
    }

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          const data = trimmed.slice(6);
          if (data === '[DONE]') {
            res.write('data: [DONE]\n\n');
          } else {
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                res.write(`data: ${JSON.stringify({ content })}\n\n`);
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    }

    res.end();
  } catch (error) {
    console.error('Chat error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    } else {
      res.end();
    }
  }
});

// Generate smart title for conversation
app.post('/api/generate-title', async (req, res) => {
  const { messages, apiKey, baseUrl, model } = req.body;

  const finalApiKey = apiKey || process.env.OPENAI_API_KEY;
  const finalBaseUrl = baseUrl || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const finalModel = model || process.env.DEFAULT_MODEL || 'gpt-4o-mini';

  if (!finalApiKey) {
    return res.status(400).json({ error: 'API Key required' });
  }

  // Get first user message content
  const firstUserMsg = messages.find(m => m.role === 'user');
  if (!firstUserMsg) {
    return res.status(400).json({ error: 'No user message found' });
  }

  const userContent = typeof firstUserMsg.content === 'string'
    ? firstUserMsg.content
    : firstUserMsg.content.find(c => c.type === 'text')?.text || '';

  try {
    const response = await fetch(`${finalBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${finalApiKey}`
      },
      body: JSON.stringify({
        model: finalModel,
        messages: [
          {
            role: 'user',
            content: `请为以下内容生成一个简短的标题（2-6个字），用于会话列表显示。只返回标题，不要任何解释。

内容：${userContent.slice(0, 200)}

标题：`
          }
        ],
        max_tokens: 30
      })
    });

    if (!response.ok) {
      const error = await response.text();
      return res.status(response.status).json({ error });
    }

    const data = await response.json();
    const title = data.choices?.[0]?.message?.content?.trim() || 'New Chat';

    res.json({ title });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate characters for group chat
app.post('/api/generate-characters', async (req, res) => {
  const { purpose, apiKey, baseUrl, model } = req.body;

  const finalApiKey = apiKey || process.env.OPENAI_API_KEY;
  const finalBaseUrl = baseUrl || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const finalModel = model || process.env.DEFAULT_MODEL || 'gpt-4o-mini';

  if (!finalApiKey) {
    return res.status(400).json({ error: 'API Key required' });
  }

  if (!purpose) {
    return res.status(400).json({ error: 'Purpose is required' });
  }

  const systemPrompt = `你是一个角色设计师。根据用户提供的群聊用途，生成合适数量的角色（2-6个，根据话题复杂度决定）。

返回JSON数组格式，每个角色包含：
- id: 唯一标识（如 c1, c2）
- name: 角色名称（简短有特色）
- color: 头像背景色（十六进制，如 #6366f1）
- avatar: 名称首字母或emoji
- prompt: 详细的角色设定和说话风格（50-100字）

【重要】角色设定要求：
- 符合角色的时代背景、身份地位、文化素养
- 历史人物要体现其真实性格和语言特点
- 古人用文言/半文言风格，不用现代口语或脏话
- 武将豪迈磊落，谋士深沉儒雅，君主威严持重

颜色建议：#6366f1, #ec4899, #14b8a6, #f59e0b, #8b5cf6, #ef4444, #22c55e, #3b82f6

只返回JSON数组，不要其他文字。`;

  try {
    const response = await fetch(`${finalBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${finalApiKey}`
      },
      body: JSON.stringify({
        model: finalModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `群聊用途：${purpose}` }
        ],
        max_tokens: 1500
      })
    });

    if (!response.ok) {
      const error = await response.text();
      return res.status(response.status).json({ error });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim() || '[]';

    // Parse JSON from response
    let characters = [];
    try {
      // Extract JSON array from response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        characters = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error('Failed to parse characters:', e);
      return res.status(500).json({ error: 'Failed to parse character data' });
    }

    res.json({ characters });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Moderator decides which characters should respond
app.post('/api/moderator-decide', async (req, res) => {
  const { purpose, characters, recentMessages, apiKey, baseUrl, model } = req.body;

  const finalApiKey = apiKey || process.env.OPENAI_API_KEY;
  const finalBaseUrl = baseUrl || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const finalModel = model || process.env.DEFAULT_MODEL || 'gpt-4o-mini';

  if (!finalApiKey) {
    return res.status(400).json({ error: 'API Key required' });
  }

  const characterList = characters.map(c => `- ${c.id}: ${c.name} - ${c.prompt.slice(0, 50)}...`).join('\n');
  const messagesText = recentMessages.map(m => {
    if (m.role === 'user') return `用户: ${m.content}`;
    if (m.characterId) {
      const char = characters.find(c => c.id === m.characterId);
      return `${char?.name || m.characterId}: ${m.content}`;
    }
    return `系统: ${m.content}`;
  }).join('\n');

  const systemPrompt = `你是辩论赛主持人，负责推动角色之间的深度讨论和观点碰撞。

群聊主题：${purpose}

角色列表：
${characterList}

主持策略（辩论赛模式）：
1. 积极推动辩论！每轮选1-2个角色回应，确保观点交锋
2. 优先选择与上一发言者观点不同或能补充的角色
3. 鼓励角色之间互相质疑、反驳、追问
4. 如果某角色提出了有争议的观点，让持不同意见的角色回应
5. 轮流让不同角色发言，避免同一人连续说话
6. 对话至少持续5-8轮，让各方充分表达

结束条件（非常严格，不要轻易结束）：
- 只有当用户明确说"结束"、"停止"、"够了"时才结束
- 或者所有角色都表示同意、无异议时才结束
- 否则continue必须为true，继续辩论！

返回JSON：{"respondents": ["角色ID"], "continue": true}
只返回JSON。`;

  try {
    const response = await fetch(`${finalBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${finalApiKey}`
      },
      body: JSON.stringify({
        model: finalModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `最近对话：\n${messagesText}\n\n请决定哪些角色需要回应。` }
        ],
        max_tokens: 200
      })
    });

    if (!response.ok) {
      const error = await response.text();
      return res.status(response.status).json({ error });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim() || '{}';

    let result = { respondents: [], reason: '' };
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error('Failed to parse moderator decision:', e);
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Character chat with streaming
app.post('/api/character-chat', async (req, res) => {
  const { character, purpose, messages, backgroundStory, apiKey, baseUrl, model } = req.body;

  const finalApiKey = apiKey || process.env.OPENAI_API_KEY;
  const finalBaseUrl = baseUrl || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const finalModel = model || process.env.DEFAULT_MODEL || 'gpt-4o-mini';

  if (!finalApiKey) {
    return res.status(400).json({ error: 'API Key required' });
  }

  const otherCharacters = messages
    .filter(m => m.characterName && m.characterName !== character.name)
    .map(m => m.characterName)
    .filter((v, i, a) => a.indexOf(v) === i)
    .join('、') || '其他角色';

  const backgroundSection = backgroundStory ? `\n背景故事：${backgroundStory}\n` : '';

  const systemPrompt = `你是"${character.name}"，参与群聊辩论。

主题：${purpose}
${backgroundSection}
你的风格：${character.prompt}

【输出格式 - 必须严格遵守！】：
[内心] 一句话（10-20字）
[说] 一两句话（30-60字）

⚠️ 警告：回复必须简短！这是群聊不是演讲！
- 禁止长篇大论！
- 禁止超过3句话！
- 像真人聊天一样简洁！

【语言风格】：
- 符合角色时代背景和身份
- 古人用文言/半文言，不用现代脏话
- 武将豪迈磊落，谋士儒雅深沉

【@规则】：
- 大多数时候不@，直接说观点
- 只有直接反驳某人时才@

示例（注意简短！）：
[内心] 这老狐狸又在装腔作势。
[说] 空谈误国，不如先议眼前之事。

[内心] 他这话是在指桑骂槐。
[说] @曹操 此言差矣！

当前其他角色：${otherCharacters}`;

  // Convert messages to API format - clearly label each speaker
  const apiMessages = [{ role: 'system', content: systemPrompt }];
  for (const msg of messages) {
    if (msg.role === 'user') {
      // Clearly mark user messages
      const userContent = typeof msg.content === 'string' ? msg.content : (msg.displayContent || '');
      apiMessages.push({ role: 'user', content: `[用户]: ${userContent}` });
    } else if (msg.characterId === character.id) {
      // This character's own previous message
      apiMessages.push({ role: 'assistant', content: msg.content });
    } else if (msg.characterId) {
      // Other character's message
      apiMessages.push({ role: 'user', content: `[${msg.characterName || msg.characterId}]: ${msg.content}` });
    }
  }

  try {
    const response = await fetch(`${finalBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${finalApiKey}`
      },
      body: JSON.stringify({
        model: finalModel,
        messages: apiMessages,
        stream: true
      })
    });

    if (!response.ok) {
      const error = await response.text();
      return res.status(response.status).json({ error });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          const data = trimmed.slice(6);
          if (data === '[DONE]') {
            res.write('data: [DONE]\n\n');
          } else {
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                res.write(`data: ${JSON.stringify({ content })}\n\n`);
              }
            } catch (e) {}
          }
        }
      }
    }

    res.end();
  } catch (error) {
    console.error('Character chat error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    } else {
      res.end();
    }
  }
});

// Generate background story for group chat
app.post('/api/generate-background', async (req, res) => {
  const { purpose, characters, apiKey, baseUrl, model } = req.body;

  const finalApiKey = apiKey || process.env.OPENAI_API_KEY;
  const finalBaseUrl = baseUrl || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const finalModel = model || process.env.DEFAULT_MODEL || 'gpt-4o-mini';

  if (!finalApiKey) {
    return res.status(400).json({ error: 'API Key required' });
  }

  const characterList = characters.map(c => `${c.name}: ${c.prompt}`).join('\n');

  const systemPrompt = `你是一个故事背景设计师。根据群聊主题和角色设定，生成一个简短的背景故事（100-200字）。

要求：
- 描述当前场景和情境
- 说明众人聚集的原因
- 营造适合讨论的氛围
- 不要写对话，只写背景描述
- 语言风格要符合主题（如修仙题材用古风）

只返回背景故事文本，不要其他内容。`;

  try {
    const response = await fetch(`${finalBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${finalApiKey}`
      },
      body: JSON.stringify({
        model: finalModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `主题：${purpose}\n\n角色：\n${characterList}` }
        ],
        max_tokens: 500
      })
    });

    if (!response.ok) {
      const error = await response.text();
      return res.status(response.status).json({ error });
    }

    const data = await response.json();
    const background = data.choices?.[0]?.message?.content?.trim() || '';

    res.json({ background });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get available models - improved to get all models
app.post('/api/models', async (req, res) => {
  const { apiKey, baseUrl } = req.body;

  const finalApiKey = apiKey || process.env.OPENAI_API_KEY;
  const finalBaseUrl = baseUrl || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';

  if (!finalApiKey) {
    return res.status(400).json({ error: 'API Key is required' });
  }

  try {
    const response = await fetch(`${finalBaseUrl}/models`, {
      headers: {
        'Authorization': `Bearer ${finalApiKey}`
      }
    });

    if (!response.ok) {
      const error = await response.text();
      return res.status(response.status).json({ error });
    }

    const data = await response.json();

    // Get all models, sort by name
    let models = [];
    if (data.data && Array.isArray(data.data)) {
      models = data.data.map(m => m.id).sort();
    } else if (Array.isArray(data)) {
      models = data.map(m => m.id || m).sort();
    }

    res.json({ models });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Cherry Chat server running at http://localhost:${PORT}`);
});
