# Cherry Chat

轻量级 AI 聊天应用，支持单聊和多角色群聊。

## 功能特性

### 单聊模式
- 与 AI 进行一对一对话
- 支持图片发送和识别
- 支持 Markdown 渲染和代码高亮
- 可自定义 System Prompt
- 消息重新生成

### 群聊模式
- AI 自动生成多个角色参与讨论
- 主持人 AI 控制对话节奏和发言顺序
- 角色具有独立性格和观点
- 支持背景故事设定
- 图片自动转换为文字描述供角色理解
- 角色内心活动与发言分离显示

### 通用功能
- 多会话管理
- 深色/浅色主题切换
- 流式响应输出
- 智能标题生成
- 移动端适配

## 安装

```bash
npm install
```

## 配置

创建 `.env` 文件：

```env
OPENAI_API_KEY=your-api-key
OPENAI_BASE_URL=https://api.openai.com/v1
DEFAULT_MODEL=gpt-4o
PORT=3000
```

也可以在应用内设置中配置 API Key 和 Base URL。

## 运行

```bash
npm start
```

访问 http://localhost:3000

## 技术栈

- **后端**: Node.js + Express
- **前端**: 原生 JavaScript
- **样式**: CSS 变量 + 响应式设计
- **存储**: LocalStorage
- **API**: OpenAI 兼容接口

## 项目结构

```
cherry-chat/
├── server.js          # 后端服务
├── public/
│   ├── index.html     # 主页面
│   ├── css/
│   │   └── style.css  # 样式
│   └── js/
│       ├── app.js     # 主应用逻辑
│       ├── chat.js    # 单聊功能
│       ├── group-chat.js  # 群聊功能
│       ├── storage.js # 本地存储
│       └── markdown.js # Markdown 渲染
├── package.json
└── README.md
```

## License

MIT
