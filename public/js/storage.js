// Storage manager for sessions and settings
const Storage = {
  KEYS: {
    SESSIONS: 'cherry_sessions',
    CURRENT_SESSION: 'cherry_current',
    SETTINGS: 'cherry_settings',
    THEME: 'cherry_theme',
    MODELS: 'cherry_models',
    SYSTEM_PROMPT: 'cherry_system_prompt'
  },

  // Sessions
  getSessions() {
    const data = localStorage.getItem(this.KEYS.SESSIONS);
    return data ? JSON.parse(data) : [];
  },

  saveSessions(sessions) {
    localStorage.setItem(this.KEYS.SESSIONS, JSON.stringify(sessions));
  },

  getSession(id) {
    const sessions = this.getSessions();
    return sessions.find(s => s.id === id);
  },

  createSession(type = 'chat') {
    const sessions = this.getSessions();
    const isGroup = type === 'group';
    const session = {
      id: (isGroup ? 'g_' : 's_') + Date.now(),
      type: type,
      title: isGroup ? 'New Group' : 'New Chat',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    // Group chat specific fields
    if (isGroup) {
      session.purpose = '';
      session.characters = [];
    }

    sessions.unshift(session);
    this.saveSessions(sessions);
    this.setCurrentSessionId(session.id);
    return session;
  },

  createGroupSession(purpose, characters) {
    const sessions = this.getSessions();
    const session = {
      id: 'g_' + Date.now(),
      type: 'group',
      title: purpose.slice(0, 20) + (purpose.length > 20 ? '...' : ''),
      purpose: purpose,
      characters: characters,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    sessions.unshift(session);
    this.saveSessions(sessions);
    this.setCurrentSessionId(session.id);
    return session;
  },

  isGroupSession(id) {
    const session = this.getSession(id);
    return session && session.type === 'group';
  },

  updateSession(id, updates) {
    const sessions = this.getSessions();
    const index = sessions.findIndex(s => s.id === id);
    if (index !== -1) {
      sessions[index] = { ...sessions[index], ...updates, updatedAt: Date.now() };
      this.saveSessions(sessions);
      return sessions[index];
    }
    return null;
  },

  deleteSession(id) {
    let sessions = this.getSessions();
    sessions = sessions.filter(s => s.id !== id);
    this.saveSessions(sessions);

    if (this.getCurrentSessionId() === id) {
      if (sessions.length > 0) {
        this.setCurrentSessionId(sessions[0].id);
      } else {
        localStorage.removeItem(this.KEYS.CURRENT_SESSION);
      }
    }
    return sessions;
  },

  getCurrentSessionId() {
    return localStorage.getItem(this.KEYS.CURRENT_SESSION);
  },

  setCurrentSessionId(id) {
    localStorage.setItem(this.KEYS.CURRENT_SESSION, id);
  },

  // Settings
  getSettings() {
    const data = localStorage.getItem(this.KEYS.SETTINGS);
    return data ? JSON.parse(data) : {
      apiKey: '',
      baseUrl: '',
      model: '',
      contextRounds: 30
    };
  },

  saveSettings(settings) {
    localStorage.setItem(this.KEYS.SETTINGS, JSON.stringify(settings));
  },

  // Models cache
  getModels() {
    const data = localStorage.getItem(this.KEYS.MODELS);
    return data ? JSON.parse(data) : [];
  },

  saveModels(models) {
    localStorage.setItem(this.KEYS.MODELS, JSON.stringify(models));
  },

  // System Prompt
  getSystemPrompt() {
    return localStorage.getItem(this.KEYS.SYSTEM_PROMPT) || '';
  },

  saveSystemPrompt(prompt) {
    localStorage.setItem(this.KEYS.SYSTEM_PROMPT, prompt);
  },

  // Theme
  getTheme() {
    return localStorage.getItem(this.KEYS.THEME) || 'dark';
  },

  setTheme(theme) {
    localStorage.setItem(this.KEYS.THEME, theme);
    document.documentElement.setAttribute('data-theme', theme);

    const hljsLink = document.getElementById('hljs-theme');
    if (hljsLink) {
      hljsLink.href = theme === 'light'
        ? 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css'
        : 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css';
    }
  },

  toggleTheme() {
    const current = this.getTheme();
    const next = current === 'dark' ? 'light' : 'dark';
    this.setTheme(next);
    return next;
  }
};
