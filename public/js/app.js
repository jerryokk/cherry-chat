// Main application logic
const App = {
  elements: {},
  serverConfig: {},
  pendingImages: [],

  async init() {
    this.cacheElements();
    this.bindEvents();
    this.setupImageHandlers();
    await this.loadServerConfig();
    this.loadTheme();
    this.loadModels();
    this.loadSessions();
    this.loadCurrentSession();
    this.updateSystemPromptBtn();
  },

  cacheElements() {
    this.elements = {
      sidebar: document.getElementById('sidebar'),
      sidebarOverlay: document.getElementById('sidebarOverlay'),
      sessionsList: document.getElementById('sessionsList'),
      messagesContainer: document.getElementById('messagesContainer'),
      messageInput: document.getElementById('messageInput'),
      sendBtn: document.getElementById('sendBtn'),
      newChatBtn: document.getElementById('newChatBtn'),
      settingsBtn: document.getElementById('settingsBtn'),
      themeBtn: document.getElementById('themeBtn'),
      menuBtn: document.getElementById('menuBtn'),
      settingsModal: document.getElementById('settingsModal'),
      closeSettings: document.getElementById('closeSettings'),
      cancelSettings: document.getElementById('cancelSettings'),
      saveSettings: document.getElementById('saveSettings'),
      apiKey: document.getElementById('apiKey'),
      baseUrl: document.getElementById('baseUrl'),
      defaultModelInput: document.getElementById('defaultModelInput'),
      envKeyHint: document.getElementById('envKeyHint'),
      contextRounds: document.getElementById('contextRounds'),
      sessionTitle: document.getElementById('sessionTitle'),
      welcomeMessage: document.getElementById('welcomeMessage'),
      modelSelector: document.getElementById('modelSelector'),
      refreshModelsBtn: document.getElementById('refreshModelsBtn'),
      systemPromptBtn: document.getElementById('systemPromptBtn'),
      systemPromptModal: document.getElementById('systemPromptModal'),
      closeSystemPrompt: document.getElementById('closeSystemPrompt'),
      systemPrompt: document.getElementById('systemPrompt'),
      saveSystemPrompt: document.getElementById('saveSystemPrompt'),
      clearSystemPrompt: document.getElementById('clearSystemPrompt'),
      imagePreviewArea: document.getElementById('imagePreviewArea'),
      attachBtn: document.getElementById('attachBtn'),
      fileInput: document.getElementById('fileInput'),
      stopBtn: document.getElementById('stopBtn'),
      scrollBottomBtn: document.getElementById('scrollBottomBtn'),
      toastContainer: document.getElementById('toastContainer'),
      clearChatBtn: document.getElementById('clearChatBtn'),
      confirmModal: document.getElementById('confirmModal'),
      confirmTitle: document.getElementById('confirmTitle'),
      confirmMessage: document.getElementById('confirmMessage'),
      confirmOk: document.getElementById('confirmOk'),
      confirmCancel: document.getElementById('confirmCancel'),
      closeConfirm: document.getElementById('closeConfirm'),
      editMessageModal: document.getElementById('editMessageModal'),
      editMessageInput: document.getElementById('editMessageInput'),
      saveEditMessage: document.getElementById('saveEditMessage'),
      cancelEditMessage: document.getElementById('cancelEditMessage'),
      closeEditMessage: document.getElementById('closeEditMessage'),
      // Group chat elements
      newGroupBtn: document.getElementById('newGroupBtn'),
      createGroupModal: document.getElementById('createGroupModal'),
      closeCreateGroup: document.getElementById('closeCreateGroup'),
      cancelCreateGroup: document.getElementById('cancelCreateGroup'),
      groupPurpose: document.getElementById('groupPurpose'),
      charactersSection: document.getElementById('charactersSection'),
      charactersList: document.getElementById('charactersList'),
      generateCharactersBtn: document.getElementById('generateCharactersBtn'),
      startGroupBtn: document.getElementById('startGroupBtn'),
      // Group info modal
      groupInfoBtn: document.getElementById('groupInfoBtn'),
      groupInfoModal: document.getElementById('groupInfoModal'),
      closeGroupInfo: document.getElementById('closeGroupInfo'),
      closeGroupInfoBtn: document.getElementById('closeGroupInfoBtn'),
      groupInfoTitle: document.getElementById('groupInfoTitle'),
      groupInfoPurpose: document.getElementById('groupInfoPurpose'),
      groupInfoCharacters: document.getElementById('groupInfoCharacters'),
      // System prompt extended elements
      systemPromptTitle: document.getElementById('systemPromptTitle'),
      systemPromptLabel: document.getElementById('systemPromptLabel'),
      generateBackgroundBtn: document.getElementById('generateBackgroundBtn')
    };

    this.confirmCallback = null;
    this.editingMessageIndex = null;
    this.generatedCharacters = [];
  },

  bindEvents() {
    // New chat
    this.elements.newChatBtn.addEventListener('click', () => this.createNewSession());

    // Mobile menu
    this.elements.menuBtn.addEventListener('click', () => {
      this.toggleSidebar();
    });

    // Sidebar overlay click to close
    this.elements.sidebarOverlay.addEventListener('click', () => {
      this.closeSidebar();
    });

    // Send message
    this.elements.sendBtn.addEventListener('click', () => this.handleSend());
    this.elements.messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSend();
      }
    });

    // Auto-resize textarea
    this.elements.messageInput.addEventListener('input', () => {
      this.elements.messageInput.style.height = 'auto';
      this.elements.messageInput.style.height = Math.min(this.elements.messageInput.scrollHeight, 200) + 'px';
    });

    // Settings modal
    this.elements.settingsBtn.addEventListener('click', () => this.openSettings());
    this.elements.closeSettings.addEventListener('click', () => this.closeSettings());
    this.elements.cancelSettings.addEventListener('click', () => this.closeSettings());
    this.elements.saveSettings.addEventListener('click', () => this.saveSettingsHandler());
    this.elements.settingsModal.addEventListener('click', (e) => {
      if (e.target === this.elements.settingsModal) this.closeSettings();
    });

    // System Prompt modal
    this.elements.systemPromptBtn.addEventListener('click', () => this.openSystemPrompt());
    this.elements.closeSystemPrompt.addEventListener('click', () => this.closeSystemPromptModal());
    this.elements.saveSystemPrompt.addEventListener('click', () => this.saveSystemPromptHandler());
    this.elements.clearSystemPrompt.addEventListener('click', () => {
      this.elements.systemPrompt.value = '';
    });
    this.elements.systemPromptModal.addEventListener('click', (e) => {
      if (e.target === this.elements.systemPromptModal) this.closeSystemPromptModal();
    });
    this.elements.generateBackgroundBtn.addEventListener('click', () => this.generateBackgroundStory());

    // Model selector
    this.elements.modelSelector.addEventListener('change', (e) => {
      const settings = Storage.getSettings();
      settings.model = e.target.value;
      Storage.saveSettings(settings);
    });

    this.elements.refreshModelsBtn.addEventListener('click', () => this.refreshModels());

    // Theme toggle
    this.elements.themeBtn.addEventListener('click', () => {
      Storage.toggleTheme();
    });

    // File attach
    this.elements.attachBtn.addEventListener('click', () => {
      this.elements.fileInput.click();
    });

    this.elements.fileInput.addEventListener('change', (e) => {
      this.handleFiles(e.target.files);
      e.target.value = '';
    });

    // Stop button
    this.elements.stopBtn.addEventListener('click', () => {
      Chat.abort();
      GroupChat.abort();
      this.setStreaming(false);
    });

    // Scroll to bottom button
    this.elements.scrollBottomBtn.addEventListener('click', () => {
      this.scrollToBottom(true);
    });

    // Show/hide scroll button based on scroll position
    this.elements.messagesContainer.addEventListener('scroll', () => {
      const { scrollTop, scrollHeight, clientHeight } = this.elements.messagesContainer;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      this.elements.scrollBottomBtn.style.display = isNearBottom ? 'none' : 'flex';
    });

    // Clear chat
    this.elements.clearChatBtn.addEventListener('click', () => {
      this.showConfirm('Clear Chat', 'Clear all messages in this conversation?', () => {
        this.clearCurrentChat();
      });
    });

    // Confirm modal
    this.elements.confirmOk.addEventListener('click', () => {
      if (this.confirmCallback) this.confirmCallback();
      this.closeConfirmModal();
    });
    this.elements.confirmCancel.addEventListener('click', () => this.closeConfirmModal());
    this.elements.closeConfirm.addEventListener('click', () => this.closeConfirmModal());
    this.elements.confirmModal.addEventListener('click', (e) => {
      if (e.target === this.elements.confirmModal) this.closeConfirmModal();
    });

    // Edit message modal
    this.elements.saveEditMessage.addEventListener('click', () => this.saveEditedMessage());
    this.elements.cancelEditMessage.addEventListener('click', () => this.closeEditMessageModal());
    this.elements.closeEditMessage.addEventListener('click', () => this.closeEditMessageModal());
    this.elements.editMessageModal.addEventListener('click', (e) => {
      if (e.target === this.elements.editMessageModal) this.closeEditMessageModal();
    });

    // Group chat modal (no click-outside-to-close to prevent accidental dismissal)
    this.elements.newGroupBtn.addEventListener('click', () => this.openCreateGroupModal());
    this.elements.closeCreateGroup.addEventListener('click', () => this.closeCreateGroupModal());
    this.elements.cancelCreateGroup.addEventListener('click', () => this.closeCreateGroupModal());
    this.elements.generateCharactersBtn.addEventListener('click', () => this.handleGenerateCharacters());
    this.elements.startGroupBtn.addEventListener('click', () => this.handleStartGroup());

    // Group info modal
    this.elements.groupInfoBtn.addEventListener('click', () => this.openGroupInfoModal());
    this.elements.closeGroupInfo.addEventListener('click', () => this.closeGroupInfoModal());
    this.elements.closeGroupInfoBtn.addEventListener('click', () => this.closeGroupInfoModal());
    this.elements.groupInfoModal.addEventListener('click', (e) => {
      if (e.target === this.elements.groupInfoModal) this.closeGroupInfoModal();
    });
  },

  setupImageHandlers() {
    // Paste handler
    document.addEventListener('paste', (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) this.handleFiles([file]);
        }
      }
    });

    // Drag and drop
    const dropZone = document.body;
    let dragCounter = 0;

    // Create drag overlay
    const overlay = document.createElement('div');
    overlay.className = 'drag-overlay';
    overlay.innerHTML = '<span>Drop images here</span>';
    document.body.appendChild(overlay);

    dropZone.addEventListener('dragenter', (e) => {
      e.preventDefault();
      dragCounter++;
      if (e.dataTransfer?.types.includes('Files')) {
        overlay.classList.add('active');
      }
    });

    dropZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dragCounter--;
      if (dragCounter === 0) {
        overlay.classList.remove('active');
      }
    });

    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dragCounter = 0;
      overlay.classList.remove('active');

      const files = Array.from(e.dataTransfer?.files || []).filter(f => f.type.startsWith('image/'));
      if (files.length > 0) {
        this.handleFiles(files);
      }
    });
  },

  handleFiles(files) {
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;

      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target.result;
        this.pendingImages.push(base64);
        this.renderImagePreviews();
      };
      reader.readAsDataURL(file);
    }
  },

  renderImagePreviews() {
    this.elements.imagePreviewArea.innerHTML = this.pendingImages.map((img, i) => `
      <div class="image-preview-item">
        <img src="${img}" alt="Preview">
        <button class="remove-btn" data-index="${i}">&times;</button>
      </div>
    `).join('');

    // Bind remove buttons
    this.elements.imagePreviewArea.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.dataset.index);
        this.pendingImages.splice(index, 1);
        this.renderImagePreviews();
      });
    });
  },

  async loadServerConfig() {
    try {
      const response = await fetch('/api/config');
      this.serverConfig = await response.json();
    } catch (e) {
      console.error('Failed to load server config:', e);
    }
  },

  loadTheme() {
    const theme = Storage.getTheme();
    Storage.setTheme(theme);
  },

  loadModels() {
    const models = Storage.getModels();
    const settings = Storage.getSettings();
    const currentModel = settings.model || this.serverConfig.model || '';

    this.elements.modelSelector.innerHTML = '<option value="">Select Model</option>';

    if (models.length > 0) {
      models.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        if (m === currentModel) opt.selected = true;
        this.elements.modelSelector.appendChild(opt);
      });
    }

    // Add current model if not in list
    if (currentModel && !models.includes(currentModel)) {
      const opt = document.createElement('option');
      opt.value = currentModel;
      opt.textContent = currentModel;
      opt.selected = true;
      this.elements.modelSelector.appendChild(opt);
    }
  },

  async refreshModels() {
    this.elements.refreshModelsBtn.classList.add('loading');

    try {
      const models = await Chat.fetchModels();
      this.loadModels();
    } catch (error) {
      alert('Failed to fetch models: ' + error.message);
    } finally {
      this.elements.refreshModelsBtn.classList.remove('loading');
    }
  },

  loadSessions() {
    const sessions = Storage.getSessions();
    const currentId = Storage.getCurrentSessionId();

    this.elements.sessionsList.innerHTML = sessions.map(session => {
      const isGroup = session.type === 'group';
      const classes = ['session-item'];
      if (session.id === currentId) classes.push('active');
      if (isGroup) classes.push('group');
      return `
        <div class="${classes.join(' ')}" data-id="${session.id}">
          <span class="title">${this.escapeHtml(session.title)}</span>
          <button class="delete-btn" data-id="${session.id}">&times;</button>
        </div>
      `;
    }).join('');

    // Bind session click events
    this.elements.sessionsList.querySelectorAll('.session-item').forEach(item => {
      const titleSpan = item.querySelector('.title');

      // Single click to switch session
      item.addEventListener('click', (e) => {
        if (!e.target.classList.contains('delete-btn') && !e.target.classList.contains('rename-input')) {
          this.switchSession(item.dataset.id);
          this.closeSidebar();
        }
      });

      // Double click to rename
      titleSpan.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        this.startRenameSession(item, titleSpan);
      });
    });

    // Bind delete events
    this.elements.sessionsList.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteSession(btn.dataset.id);
      });
    });
  },

  startRenameSession(item, titleSpan) {
    const sessionId = item.dataset.id;
    const currentTitle = titleSpan.textContent;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'rename-input';
    input.value = currentTitle;

    titleSpan.style.display = 'none';
    item.insertBefore(input, titleSpan);
    input.focus();
    input.select();

    const finishRename = () => {
      const newTitle = input.value.trim() || currentTitle;
      this.renameSession(sessionId, newTitle);
    };

    input.addEventListener('blur', finishRename);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        input.blur();
      } else if (e.key === 'Escape') {
        input.value = currentTitle;
        input.blur();
      }
    });
  },

  loadCurrentSession() {
    let sessionId = Storage.getCurrentSessionId();
    let session = sessionId ? Storage.getSession(sessionId) : null;

    if (!session) {
      const sessions = Storage.getSessions();
      if (sessions.length > 0) {
        session = sessions[0];
        Storage.setCurrentSessionId(session.id);
      }
    }

    if (session) {
      if (session.type === 'group') {
        this.renderGroupMessages(session);
      } else {
        this.renderMessages(session);
      }
      this.elements.sessionTitle.textContent = session.title;
      this.updateGroupInfoBtn();
    } else {
      this.elements.messagesContainer.innerHTML = `
        <div class="welcome-message">
          <div class="welcome-icon">
            <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
          </div>
          <h2>Welcome to Cherry Chat</h2>
          <p>Configure your API in Settings, then start chatting!</p>
        </div>
      `;
      this.updateGroupInfoBtn();
    }
  },

  renderMessages(session) {
    if (!session.messages || session.messages.length === 0) {
      this.elements.messagesContainer.innerHTML = `
        <div class="welcome-message">
          <div class="welcome-icon">
            <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
          </div>
          <h2>Start a conversation</h2>
          <p>Type a message to begin</p>
        </div>
      `;
      return;
    }

    this.elements.messagesContainer.innerHTML = session.messages.map((msg, index) =>
      this.createMessageHtml(msg, index)
    ).join('');

    this.scrollToBottom(true);
  },

  createMessageHtml(message, index) {
    const isUser = message.role === 'user';
    const displayContent = message.displayContent || (typeof message.content === 'string' ? message.content : '');
    const content = isUser ? this.escapeHtml(displayContent) : MarkdownRenderer.render(displayContent);
    const images = message.images || [];
    const time = this.formatTime(message.timestamp || Date.now());

    let imagesHtml = '';
    if (images.length > 0) {
      imagesHtml = `<div class="message-images">${images.map(img => `<img src="${img}" alt="Image">`).join('')}</div>`;
    }

    return `
      <div class="message ${message.role}" data-index="${index}">
        <div class="message-avatar">${isUser ? 'U' : 'AI'}</div>
        <div class="message-content">
          ${imagesHtml}
          ${content}
          <div class="message-time">${time}</div>
          <div class="message-actions">
            <button onclick="App.regenerateHandler(${index})">Regen</button>
            <button onclick="App.copyMessage(${index})">Copy</button>
          </div>
        </div>
      </div>
    `;
  },

  toggleSidebar() {
    const isOpen = this.elements.sidebar.classList.toggle('open');
    this.elements.sidebarOverlay.classList.toggle('active', isOpen);
    document.body.style.overflow = isOpen ? 'hidden' : '';
  },

  closeSidebar() {
    this.elements.sidebar.classList.remove('open');
    this.elements.sidebarOverlay.classList.remove('active');
    document.body.style.overflow = '';
  },

  createNewSession() {
    // Stop any ongoing streaming
    Chat.abort();
    GroupChat.abort();
    this.setStreaming(false);

    const session = Storage.createSession();
    this.loadSessions();
    this.renderMessages(session);
    this.elements.sessionTitle.textContent = session.title;
    this.updateGroupInfoBtn();
    this.updateSystemPromptBtn();
    this.elements.messageInput.focus();
    this.closeSidebar();
  },

  switchSession(sessionId) {
    // Stop any ongoing streaming
    Chat.abort();
    GroupChat.abort();
    this.setStreaming(false);

    Storage.setCurrentSessionId(sessionId);
    const session = Storage.getSession(sessionId);
    if (session) {
      this.loadSessions();
      if (session.type === 'group') {
        this.renderGroupMessages(session);
      } else {
        this.renderMessages(session);
      }
      this.elements.sessionTitle.textContent = session.title;
      this.updateGroupInfoBtn();
      this.updateSystemPromptBtn();
    }
  },

  deleteSession(sessionId) {
    this.showConfirm('Delete Session', 'Delete this conversation?', () => {
      Storage.deleteSession(sessionId);
      this.loadSessions();
      this.loadCurrentSession();
      this.showToast('Session deleted');
    });
  },

  showConfirm(title, message, callback) {
    this.elements.confirmTitle.textContent = title;
    this.elements.confirmMessage.textContent = message;
    this.confirmCallback = callback;
    this.elements.confirmModal.classList.add('active');
  },

  closeConfirmModal() {
    this.elements.confirmModal.classList.remove('active');
    this.confirmCallback = null;
  },

  clearCurrentChat() {
    const sessionId = Storage.getCurrentSessionId();
    const session = Storage.getSession(sessionId);
    if (session) {
      session.messages = [];
      Storage.updateSession(sessionId, { messages: [] });

      if (session.type === 'group') {
        this.renderGroupMessages(session);
      } else {
        this.renderMessages(session);
      }

      this.loadSessions();
      this.showToast('Chat cleared');
    }
  },

  openEditMessageModal(index) {
    const sessionId = Storage.getCurrentSessionId();
    const session = Storage.getSession(sessionId);
    if (!session) return;

    const message = session.messages[index];
    if (!message || message.role !== 'user') return;

    const displayContent = message.displayContent || (typeof message.content === 'string' ? message.content : '');
    this.elements.editMessageInput.value = displayContent;
    this.editingMessageIndex = index;
    this.elements.editMessageModal.classList.add('active');
    this.elements.editMessageInput.focus();
  },

  closeEditMessageModal() {
    this.elements.editMessageModal.classList.remove('active');
    this.editingMessageIndex = null;
  },

  async saveEditedMessage() {
    const index = this.editingMessageIndex;
    const newContent = this.elements.editMessageInput.value.trim();

    if (index === null || !newContent) {
      this.closeEditMessageModal();
      return;
    }

    const sessionId = Storage.getCurrentSessionId();

    // Edit message and truncate to just include the edited message
    Chat.editMessage(sessionId, index, newContent);
    this.closeEditMessageModal();
    this.loadCurrentSession();

    // Get the edited message for regeneration
    const session = Storage.getSession(sessionId);
    const userMsg = session.messages[index];
    const userImages = userMsg.images || [];

    // Regenerate AI response directly without adding new user message
    this.setStreaming(true);

    const div = document.createElement('div');
    div.className = 'message assistant';
    div.innerHTML = `
      <div class="message-avatar">AI</div>
      <div class="message-content">
        <div class="typing-indicator"><span></span><span></span><span></span></div>
      </div>
    `;
    this.elements.messagesContainer.appendChild(div);
    this.scrollToBottom();
    const contentDiv = div.querySelector('.message-content');

    await Chat.sendMessageDirect(
      newContent,
      userImages,
      (chunk, fullContent) => {
        contentDiv.innerHTML = MarkdownRenderer.render(fullContent);
        this.scrollToBottom();
      },
      async (fullContent) => {
        this.setStreaming(false);
        this.loadSessions();
        if (fullContent) {
          const time = this.formatTime(Date.now());
          const msgIndex = Storage.getSession(sessionId).messages.length - 1;
          contentDiv.innerHTML = MarkdownRenderer.render(fullContent) + `
            <div class="message-time">${time}</div>
            <div class="message-actions">
              <button onclick="App.regenerateHandler(${msgIndex})">Regen</button>
              <button onclick="App.copyMessage(${msgIndex})">Copy</button>
            </div>
          `;
        }
      },
      (error) => {
        this.setStreaming(false);
        contentDiv.innerHTML = `<span style="color: var(--error)">Error: ${this.escapeHtml(error)}</span>`;
      }
    );
  },

  renameSession(sessionId, newTitle) {
    const session = Storage.getSession(sessionId);
    if (session && newTitle.trim()) {
      Storage.updateSession(sessionId, { title: newTitle.trim() });
      this.loadSessions();
      if (sessionId === Storage.getCurrentSessionId()) {
        this.elements.sessionTitle.textContent = newTitle.trim();
      }
    }
  },

  async generateSmartTitle(sessionId) {
    const title = await Chat.generateSmartTitle(sessionId);
    if (title) {
      Storage.updateSession(sessionId, { title });
      this.loadSessions();
      if (sessionId === Storage.getCurrentSessionId()) {
        this.elements.sessionTitle.textContent = title;
      }
    }
  },

  async handleSend() {
    const content = this.elements.messageInput.value.trim();
    const images = [...this.pendingImages];

    if (!content && images.length === 0) return;

    let sessionId = Storage.getCurrentSessionId();

    // Check if current session is a group chat
    const currentSession = sessionId ? Storage.getSession(sessionId) : null;
    if (currentSession && currentSession.type === 'group') {
      return this.handleGroupSend();
    }

    if (!sessionId) {
      const session = Storage.createSession();
      sessionId = session.id;
      this.loadSessions();
    }

    this.elements.messageInput.value = '';
    this.elements.messageInput.style.height = 'auto';
    this.pendingImages = [];
    this.renderImagePreviews();

    // Add user message to UI
    this.addMessageToUI({ role: 'user', displayContent: content, images });

    // Create assistant message placeholder
    const assistantDiv = this.addMessageToUI({ role: 'assistant', displayContent: '' }, true);
    const contentDiv = assistantDiv.querySelector('.message-content');

    this.setStreaming(true);

    await Chat.sendMessage(
      content,
      images,
      // onChunk
      (chunk, fullContent) => {
        contentDiv.innerHTML = MarkdownRenderer.render(fullContent);
        this.scrollToBottom();
      },
      // onComplete
      async (fullContent) => {
        this.setStreaming(false);
        this.loadSessions();
        if (fullContent) {
          const session = Storage.getSession(sessionId);
          const index = session.messages.length - 1;
          const time = this.formatTime(Date.now());
          contentDiv.innerHTML = MarkdownRenderer.render(fullContent) + `
            <div class="message-time">${time}</div>
            <div class="message-actions">
              <button onclick="App.regenerateHandler(${index})">Regen</button>
              <button onclick="App.copyMessage(${index})">Copy</button>
            </div>
          `;

          // Generate smart title after first exchange
          if (session.messages.length === 2) {
            this.generateSmartTitle(sessionId);
          }
        }
      },
      // onError
      (error) => {
        this.setStreaming(false);
        contentDiv.innerHTML = `<span style="color: var(--error)">Error: ${this.escapeHtml(error)}</span>`;
        this.showToast(error, 'error');
      }
    );
  },

  addMessageToUI(message, isStreaming = false) {
    // Remove welcome message
    const welcome = this.elements.messagesContainer.querySelector('.welcome-message');
    if (welcome) welcome.remove();

    const session = Storage.getSession(Storage.getCurrentSessionId());
    const index = session ? session.messages.length - 1 : 0;

    const div = document.createElement('div');
    div.className = `message ${message.role}`;
    div.dataset.index = index;

    const isUser = message.role === 'user';
    const displayContent = message.displayContent || '';
    const content = isUser ? this.escapeHtml(displayContent) : (displayContent ? MarkdownRenderer.render(displayContent) : '<div class="typing-indicator"><span></span><span></span><span></span></div>');
    const images = message.images || [];
    const time = this.formatTime(message.timestamp || Date.now());

    let imagesHtml = '';
    if (images.length > 0) {
      imagesHtml = `<div class="message-images">${images.map(img => `<img src="${img}" alt="Image">`).join('')}</div>`;
    }

    div.innerHTML = `
      <div class="message-avatar">${isUser ? 'U' : 'AI'}</div>
      <div class="message-content">
        ${imagesHtml}
        ${content}
        <div class="message-time">${time}</div>
        ${!isStreaming ? `
        <div class="message-actions">
          <button onclick="App.regenerateHandler(${index})">Regen</button>
          <button onclick="App.copyMessage(${index})">Copy</button>
        </div>
        ` : ''}
      </div>
    `;

    this.elements.messagesContainer.appendChild(div);
    // Force scroll for user messages, smart scroll for AI responses
    this.scrollToBottom(message.role === 'user');
    return div;
  },

  editMessageHandler(index) {
    this.openEditMessageModal(index);
  },

  async regenerateHandler(index) {
    const sessionId = Storage.getCurrentSessionId();
    const session = Storage.getSession(sessionId);
    if (!session) return;

    let userMessageIndex = index;
    if (session.messages[index].role === 'assistant') {
      userMessageIndex = index - 1;
    }

    if (userMessageIndex < 0 || session.messages[userMessageIndex].role !== 'user') return;

    const userMsg = session.messages[userMessageIndex];
    const userContent = userMsg.displayContent || (typeof userMsg.content === 'string' ? userMsg.content : '');
    const userImages = userMsg.images || [];

    Chat.regenerateFromMessage(sessionId, userMessageIndex);
    this.loadCurrentSession();

    this.elements.messageInput.value = userContent;
    this.pendingImages = [...userImages];
    this.renderImagePreviews();
    await this.handleSend();
  },

  copyMessage(index) {
    const sessionId = Storage.getCurrentSessionId();
    const session = Storage.getSession(sessionId);
    if (!session || !session.messages[index]) return;

    const msg = session.messages[index];
    const content = msg.displayContent || (typeof msg.content === 'string' ? msg.content : '');
    this.copyToClipboard(content);
  },

  copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        this.showToast('Copied to clipboard');
      }).catch(() => {
        this.fallbackCopy(text);
      });
    } else {
      this.fallbackCopy(text);
    }
  },

  fallbackCopy(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      this.showToast('Copied to clipboard');
    } catch (e) {
      this.showToast('Copy failed', 'error');
    }
    document.body.removeChild(textarea);
  },

  openSettings() {
    const settings = Storage.getSettings();
    this.elements.apiKey.value = settings.apiKey || '';
    this.elements.baseUrl.value = settings.baseUrl || this.serverConfig.baseUrl || '';
    this.elements.defaultModelInput.value = settings.model || this.serverConfig.model || '';
    this.elements.contextRounds.value = settings.contextRounds || 30;

    if (this.serverConfig.hasEnvKey && !settings.apiKey) {
      this.elements.envKeyHint.style.display = 'block';
    } else {
      this.elements.envKeyHint.style.display = 'none';
    }

    this.elements.settingsModal.classList.add('active');
  },

  closeSettings() {
    this.elements.settingsModal.classList.remove('active');
  },

  saveSettingsHandler() {
    const settings = {
      apiKey: this.elements.apiKey.value.trim(),
      baseUrl: this.elements.baseUrl.value.trim(),
      model: this.elements.defaultModelInput.value.trim(),
      contextRounds: parseInt(this.elements.contextRounds.value) || 30
    };

    Storage.saveSettings(settings);
    this.loadModels();
    this.closeSettings();
  },

  openSystemPrompt() {
    const sessionId = Storage.getCurrentSessionId();
    const session = sessionId ? Storage.getSession(sessionId) : null;
    const isGroup = session && session.type === 'group';

    if (isGroup) {
      // Group chat mode - show background story
      this.elements.systemPromptTitle.textContent = '背景故事';
      this.elements.systemPromptLabel.textContent = '设置群聊的背景故事，所有角色都会了解这个背景';
      this.elements.systemPrompt.placeholder = '例如：众人相聚于黄枫谷议事殿，讨论近日发现的上古遗迹...';
      this.elements.systemPrompt.value = session.backgroundStory || '';
      this.elements.generateBackgroundBtn.style.display = 'inline-flex';
    } else {
      // Normal chat mode
      this.elements.systemPromptTitle.textContent = 'System Prompt';
      this.elements.systemPromptLabel.textContent = 'Set instructions for the AI assistant';
      this.elements.systemPrompt.placeholder = 'You are a helpful assistant...';
      this.elements.systemPrompt.value = Storage.getSystemPrompt();
      this.elements.generateBackgroundBtn.style.display = 'none';
    }

    this.elements.systemPromptModal.classList.add('active');
  },

  closeSystemPromptModal() {
    this.elements.systemPromptModal.classList.remove('active');
  },

  saveSystemPromptHandler() {
    const sessionId = Storage.getCurrentSessionId();
    const session = sessionId ? Storage.getSession(sessionId) : null;
    const isGroup = session && session.type === 'group';

    if (isGroup) {
      // Save to group session
      Storage.updateSession(sessionId, { backgroundStory: this.elements.systemPrompt.value.trim() });
    } else {
      // Save to global system prompt
      Storage.saveSystemPrompt(this.elements.systemPrompt.value.trim());
    }

    this.updateSystemPromptBtn();
    this.closeSystemPromptModal();
  },

  updateSystemPromptBtn() {
    const sessionId = Storage.getCurrentSessionId();
    const session = sessionId ? Storage.getSession(sessionId) : null;
    const isGroup = session && session.type === 'group';

    let hasContent = false;
    if (isGroup) {
      hasContent = !!session.backgroundStory;
    } else {
      hasContent = !!Storage.getSystemPrompt();
    }

    if (hasContent) {
      this.elements.systemPromptBtn.classList.add('active');
    } else {
      this.elements.systemPromptBtn.classList.remove('active');
    }
  },

  scrollToBottom(force = false) {
    const container = this.elements.messagesContainer;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
    // Only auto-scroll if user is near bottom or force is true
    if (force || isNearBottom) {
      container.scrollTop = container.scrollHeight;
    }
  },

  setStreaming(isStreaming) {
    if (isStreaming) {
      this.elements.sendBtn.style.display = 'none';
      this.elements.stopBtn.style.display = 'flex';
    } else {
      this.elements.sendBtn.style.display = 'flex';
      this.elements.stopBtn.style.display = 'none';
    }
    this.elements.sendBtn.disabled = isStreaming;
  },

  showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    this.elements.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 2000);
  },

  formatTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  },

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  // ========== Group Chat Methods ==========

  openCreateGroupModal() {
    this.elements.groupPurpose.value = '';
    this.elements.charactersSection.style.display = 'none';
    this.elements.charactersList.innerHTML = '';
    this.elements.generateCharactersBtn.style.display = 'inline-flex';
    this.elements.startGroupBtn.style.display = 'none';
    this.generatedCharacters = [];
    this.elements.createGroupModal.classList.add('active');
    this.elements.groupPurpose.focus();
  },

  closeCreateGroupModal() {
    this.elements.createGroupModal.classList.remove('active');
  },

  openGroupInfoModal() {
    const sessionId = Storage.getCurrentSessionId();
    const session = Storage.getSession(sessionId);
    if (!session || session.type !== 'group') return;

    this.elements.groupInfoTitle.textContent = session.title;
    this.elements.groupInfoPurpose.textContent = session.purpose;
    this.elements.groupInfoCharacters.innerHTML = session.characters.map(char => `
      <div class="character-card">
        <div class="character-avatar" style="background: ${char.color}">${char.avatar}</div>
        <div class="character-info">
          <div class="character-name">${this.escapeHtml(char.name)}</div>
          <div class="character-prompt">${this.escapeHtml(char.prompt)}</div>
        </div>
      </div>
    `).join('');
    this.elements.groupInfoModal.classList.add('active');
  },

  closeGroupInfoModal() {
    this.elements.groupInfoModal.classList.remove('active');
  },

  updateGroupInfoBtn() {
    const sessionId = Storage.getCurrentSessionId();
    const session = sessionId ? Storage.getSession(sessionId) : null;
    const isGroup = session && session.type === 'group';
    this.elements.groupInfoBtn.style.display = isGroup ? 'flex' : 'none';
  },

  async handleGenerateCharacters() {
    const purpose = this.elements.groupPurpose.value.trim();
    if (!purpose) {
      this.showToast('Please enter the group purpose', 'error');
      return;
    }

    this.elements.generateCharactersBtn.classList.add('btn-loading');
    this.elements.generateCharactersBtn.disabled = true;

    try {
      const characters = await GroupChat.generateCharacters(purpose);
      this.generatedCharacters = characters;
      this.renderCharactersList(characters);

      this.elements.charactersSection.style.display = 'block';
      this.elements.generateCharactersBtn.style.display = 'none';
      this.elements.startGroupBtn.style.display = 'inline-flex';
    } catch (error) {
      this.showToast('Failed to generate characters: ' + error.message, 'error');
    } finally {
      this.elements.generateCharactersBtn.classList.remove('btn-loading');
      this.elements.generateCharactersBtn.disabled = false;
    }
  },

  renderCharactersList(characters) {
    this.elements.charactersList.innerHTML = characters.map(char => `
      <div class="character-card">
        <div class="character-avatar" style="background: ${char.color}">${char.avatar}</div>
        <div class="character-info">
          <div class="character-name">${this.escapeHtml(char.name)}</div>
          <div class="character-prompt">${this.escapeHtml(char.prompt)}</div>
        </div>
      </div>
    `).join('');
  },

  handleStartGroup() {
    const purpose = this.elements.groupPurpose.value.trim();
    if (!purpose || this.generatedCharacters.length === 0) {
      this.showToast('Please generate characters first', 'error');
      return;
    }

    // Create group session
    const session = Storage.createGroupSession(purpose, this.generatedCharacters);
    this.closeCreateGroupModal();
    this.loadSessions();
    this.renderGroupMessages(session);
    this.elements.sessionTitle.textContent = session.title;
    this.closeSidebar();
    this.updateGroupInfoBtn();
    this.updateSystemPromptBtn();

    // Auto-open background story modal
    setTimeout(() => {
      this.openSystemPrompt();
    }, 300);
  },

  async generateBackgroundStory() {
    const sessionId = Storage.getCurrentSessionId();
    const session = Storage.getSession(sessionId);
    if (!session || session.type !== 'group') return;

    this.elements.generateBackgroundBtn.disabled = true;
    this.elements.generateBackgroundBtn.textContent = '生成中...';

    try {
      const settings = Storage.getSettings();
      const response = await fetch('/api/generate-background', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purpose: session.purpose,
          characters: session.characters,
          apiKey: settings.apiKey || undefined,
          baseUrl: settings.baseUrl || undefined,
          model: settings.model || undefined
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate background');
      }

      const data = await response.json();
      this.elements.systemPrompt.value = data.background || '';
    } catch (error) {
      this.showToast('生成失败: ' + error.message, 'error');
    } finally {
      this.elements.generateBackgroundBtn.disabled = false;
      this.elements.generateBackgroundBtn.textContent = 'AI 生成';
    }
  },

  renderGroupMessages(session) {
    if (!session.messages || session.messages.length === 0) {
      // Show group welcome with character cards
      const charactersHtml = session.characters.map(char => `
        <div class="character-card">
          <div class="character-avatar" style="background: ${char.color}">${char.avatar}</div>
          <div class="character-info">
            <div class="character-name">${this.escapeHtml(char.name)}</div>
            <div class="character-prompt">${this.escapeHtml(char.prompt)}</div>
          </div>
        </div>
      `).join('');

      this.elements.messagesContainer.innerHTML = `
        <div class="welcome-message">
          <div class="welcome-icon">
            <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          </div>
          <h2>Group Chat: ${this.escapeHtml(session.purpose)}</h2>
          <p>Start chatting with ${session.characters.length} characters!</p>
          <div class="characters-list" style="margin-top: 16px; max-width: 400px;">
            ${charactersHtml}
          </div>
        </div>
      `;
      return;
    }

    this.elements.messagesContainer.innerHTML = session.messages.map((msg, index) =>
      this.createGroupMessageHtml(msg, index, session.characters)
    ).join('');

    this.scrollToBottom(true);
  },

  createGroupMessageHtml(message, index, characters) {
    const time = this.formatTime(message.timestamp || Date.now());

    if (message.role === 'user') {
      const content = this.escapeHtml(message.displayContent || '');
      const images = message.images || [];
      const interpretation = message.interpretation;

      let imagesHtml = '';
      if (images.length > 0) {
        imagesHtml = `<div class="message-images">${images.map(img => `<img src="${img}" alt="Image">`).join('')}</div>`;
      }

      let interpretHtml = '';
      if (interpretation) {
        interpretHtml = `
          <div class="interpret-area">
            <details class="interpret-details">
              <summary>AI 图片解读</summary>
              <div class="interpret-content">${this.escapeHtml(interpretation).replace(/\n/g, '<br>')}</div>
            </details>
          </div>
        `;
      }

      return `
        <div class="message user" data-index="${index}">
          <div class="message-avatar">U</div>
          <div class="message-content">
            ${imagesHtml}
            ${content}
            ${interpretHtml}
            <div class="message-time">${time}</div>
          </div>
        </div>
      `;
    }

    // Character message
    const char = characters.find(c => c.id === message.characterId) || {
      name: message.characterName || 'Unknown',
      color: message.characterColor || '#666',
      avatar: '?'
    };
    const content = MarkdownRenderer.render(message.displayContent || message.content);

    return `
      <div class="message character" data-index="${index}">
        <div class="message-avatar" style="background: ${char.color}">${char.avatar}</div>
        <div class="message-content">
          <div class="character-label" style="color: ${char.color}">${this.escapeHtml(char.name)}</div>
          ${content}
          <div class="message-time">${time}</div>
        </div>
      </div>
    `;
  },

  async handleGroupSend() {
    const content = this.elements.messageInput.value.trim();
    const images = [...this.pendingImages];

    if (!content && images.length === 0) return;

    const sessionId = Storage.getCurrentSessionId();
    const session = Storage.getSession(sessionId);
    if (!session || session.type !== 'group') return;

    this.elements.messageInput.value = '';
    this.elements.messageInput.style.height = 'auto';
    this.pendingImages = [];
    this.renderImagePreviews();

    this.setStreaming(true);

    const callbacks = {
      onUserMessage: (msg) => {
        return this.addGroupMessageToUI(msg, session.characters);
      },
      onInterpretStart: (element) => {
        if (!element) return;
        const contentDiv = element.querySelector('.message-content');
        if (!contentDiv) return;
        // Add loading indicator for interpretation
        let interpretArea = contentDiv.querySelector('.interpret-area');
        if (!interpretArea) {
          interpretArea = document.createElement('div');
          interpretArea.className = 'interpret-area';
          contentDiv.insertBefore(interpretArea, contentDiv.querySelector('.message-time'));
        }
        interpretArea.innerHTML = `
          <div class="interpret-loading">
            <span>正在解读图片</span>
            <div class="typing-indicator"><span></span><span></span><span></span></div>
          </div>
        `;
      },
      onInterpretComplete: (element, interpretation) => {
        if (!element) return;
        const contentDiv = element.querySelector('.message-content');
        if (!contentDiv) return;
        let interpretArea = contentDiv.querySelector('.interpret-area');
        if (!interpretArea) {
          interpretArea = document.createElement('div');
          interpretArea.className = 'interpret-area';
          contentDiv.insertBefore(interpretArea, contentDiv.querySelector('.message-time'));
        }
        interpretArea.innerHTML = `
          <details class="interpret-details">
            <summary>AI 图片解读</summary>
            <div class="interpret-content">${this.escapeHtml(interpretation).replace(/\n/g, '<br>')}</div>
          </details>
        `;
      },
      onModeratorThinking: () => {
        this.showModeratorIndicator();
      },
      onCharacterStart: (character) => {
        return this.addCharacterPlaceholder(character);
      },
      onCharacterChunk: (character, chunk, fullContent, placeholder) => {
        if (!placeholder || !placeholder.querySelector) {
          console.error('Invalid placeholder for:', character.name);
          return;
        }
        const contentDiv = placeholder.querySelector('.message-content');
        if (!contentDiv) {
          console.error('No content div for:', character.name);
          return;
        }
        contentDiv.innerHTML = `
          <div class="character-label" style="color: ${character.color}">${this.escapeHtml(character.name)}</div>
          ${MarkdownRenderer.render(fullContent)}
        `;
        this.scrollToBottom();
      },
      onCharacterComplete: (character, fullContent, placeholder) => {
        if (!placeholder || !placeholder.querySelector) return;
        const contentDiv = placeholder.querySelector('.message-content');
        if (!contentDiv) return;
        const time = this.formatTime(Date.now());
        contentDiv.innerHTML = `
          <div class="character-label" style="color: ${character.color}">${this.escapeHtml(character.name)}</div>
          ${MarkdownRenderer.render(fullContent)}
          <div class="message-time">${time}</div>
        `;
      },
      onCharacterError: (character, error, placeholder) => {
        if (!placeholder || !placeholder.querySelector) return;
        const contentDiv = placeholder.querySelector('.message-content');
        if (!contentDiv) return;
        contentDiv.innerHTML = `
          <div class="character-label" style="color: ${character.color}">${this.escapeHtml(character.name)}</div>
          <span style="color: var(--error)">Error: ${this.escapeHtml(error)}</span>
        `;
      },
      onRoundComplete: (round, reason) => {
        this.hideModeratorIndicator();
      },
      onLoopComplete: () => {
        this.hideModeratorIndicator();
        this.setStreaming(false);
        this.loadSessions();
      }
    };

    await GroupChat.sendGroupMessage(sessionId, content, images, callbacks);
  },

  addGroupMessageToUI(message, characters) {
    const welcome = this.elements.messagesContainer.querySelector('.welcome-message');
    if (welcome) welcome.remove();

    const session = Storage.getSession(Storage.getCurrentSessionId());
    const index = session ? session.messages.length - 1 : 0;
    const html = this.createGroupMessageHtml(message, index, characters);

    const temp = document.createElement('div');
    temp.innerHTML = html;
    const element = temp.firstElementChild;
    this.elements.messagesContainer.appendChild(element);
    // Force scroll for user messages
    this.scrollToBottom(message.role === 'user');
    return element;
  },

  addCharacterPlaceholder(character) {
    const welcome = this.elements.messagesContainer.querySelector('.welcome-message');
    if (welcome) welcome.remove();

    const div = document.createElement('div');
    div.className = 'message character';
    div.innerHTML = `
      <div class="message-avatar" style="background: ${character.color}">${character.avatar}</div>
      <div class="message-content">
        <div class="character-label" style="color: ${character.color}">${this.escapeHtml(character.name)}</div>
        <div class="typing-indicator"><span></span><span></span><span></span></div>
      </div>
    `;
    this.elements.messagesContainer.appendChild(div);
    this.scrollToBottom();
    return div;
  },

  showModeratorIndicator() {
    this.hideModeratorIndicator();
    const indicator = document.createElement('div');
    indicator.className = 'moderator-indicator';
    indicator.id = 'moderatorIndicator';
    indicator.innerHTML = `
      <span>Moderator deciding...</span>
      <div class="typing-indicator"><span></span><span></span><span></span></div>
    `;
    this.elements.messagesContainer.appendChild(indicator);
    this.scrollToBottom();
  },

  hideModeratorIndicator() {
    const indicator = document.getElementById('moderatorIndicator');
    if (indicator) indicator.remove();
  },

  // Group info modal methods
  openGroupInfoModal() {
    const sessionId = Storage.getCurrentSessionId();
    const session = Storage.getSession(sessionId);
    if (!session || session.type !== 'group') return;

    this.elements.groupInfoTitle.textContent = session.title || 'Group Chat';
    this.elements.groupInfoPurpose.textContent = session.purpose;

    this.elements.groupInfoCharacters.innerHTML = session.characters.map(char => `
      <div class="character-card">
        <div class="character-avatar" style="background: ${char.color}">${char.avatar}</div>
        <div class="character-info">
          <div class="character-name">${this.escapeHtml(char.name)}</div>
          <div class="character-prompt">${this.escapeHtml(char.prompt)}</div>
        </div>
      </div>
    `).join('');

    this.elements.groupInfoModal.classList.add('active');
  },

  closeGroupInfoModal() {
    this.elements.groupInfoModal.classList.remove('active');
  },

  updateGroupInfoBtn() {
    const sessionId = Storage.getCurrentSessionId();
    const session = Storage.getSession(sessionId);
    const isGroup = session && session.type === 'group';
    this.elements.groupInfoBtn.style.display = isGroup ? 'flex' : 'none';
  }
};

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
