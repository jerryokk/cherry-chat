// Chat functionality with streaming and vision support
const Chat = {
  isStreaming: false,
  abortController: null,

  async sendMessage(content, images, onChunk, onComplete, onError) {
    if (this.isStreaming) {
      this.abort();
      return;
    }

    const settings = Storage.getSettings();
    const sessionId = Storage.getCurrentSessionId();
    const session = Storage.getSession(sessionId);
    const systemPrompt = Storage.getSystemPrompt();

    if (!session) {
      onError('No active session');
      return;
    }

    // Build message content (text + images for vision)
    let messageContent;
    if (images && images.length > 0) {
      // OpenAI Vision API format
      messageContent = [];

      // Add text first if present
      if (content) {
        messageContent.push({ type: 'text', text: content });
      }

      // Add images - ensure proper data URL format
      for (const img of images) {
        // img should already be data:image/xxx;base64,... from FileReader
        messageContent.push({
          type: 'image_url',
          image_url: {
            url: img,
            detail: 'auto'  // can be 'low', 'high', or 'auto'
          }
        });
      }
    } else {
      messageContent = content;
    }

    // Add user message
    const userMessage = {
      role: 'user',
      content: messageContent,
      displayContent: content,
      images: images || [],
      timestamp: Date.now()
    };
    session.messages.push(userMessage);

    // Update session title from first message
    if (session.messages.length === 1) {
      session.title = content.slice(0, 30) + (content.length > 30 ? '...' : '');
    }

    Storage.updateSession(sessionId, { messages: session.messages, title: session.title });

    // Prepare messages for API (limit by contextRounds)
    const contextRounds = settings.contextRounds || 30;
    const maxMessages = contextRounds * 2; // Each round = 1 user + 1 assistant
    const recentMessages = session.messages.slice(-maxMessages);
    const apiMessages = recentMessages.map(m => ({
      role: m.role,
      content: m.content
    }));

    this.isStreaming = true;
    this.abortController = new AbortController();

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: apiMessages,
          apiKey: settings.apiKey || undefined,
          baseUrl: settings.baseUrl || undefined,
          model: settings.model || undefined,
          systemPrompt: systemPrompt || undefined
        }),
        signal: this.abortController.signal
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Request failed');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';
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
              // Stream complete
            } else {
              try {
                const parsed = JSON.parse(data);
                if (parsed.content) {
                  assistantContent += parsed.content;
                  onChunk(parsed.content, assistantContent);
                }
              } catch (e) {
                // Skip invalid JSON
              }
            }
          }
        }
      }

      // Save assistant message
      if (assistantContent) {
        session.messages.push({
          role: 'assistant',
          content: assistantContent,
          displayContent: assistantContent,
          timestamp: Date.now()
        });
        Storage.updateSession(sessionId, { messages: session.messages });
      }

      onComplete(assistantContent);
    } catch (error) {
      if (error.name === 'AbortError') {
        onComplete('');
      } else {
        onError(error.message);
      }
    } finally {
      this.isStreaming = false;
      this.abortController = null;
    }
  },

  abort() {
    if (this.abortController) {
      this.abortController.abort();
    }
  },

  // Send message using existing session messages (for edit/regenerate)
  async sendMessageDirect(content, images, onChunk, onComplete, onError) {
    if (this.isStreaming) {
      this.abort();
      return;
    }

    const settings = Storage.getSettings();
    const sessionId = Storage.getCurrentSessionId();
    const session = Storage.getSession(sessionId);
    const systemPrompt = Storage.getSystemPrompt();

    if (!session) {
      onError('No active session');
      return;
    }

    this.isStreaming = true;
    this.abortController = new AbortController();

    try {
      const contextRounds = settings.contextRounds || 30;
      const contextMessages = session.messages.slice(-contextRounds * 2);

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: contextMessages,
          systemPrompt,
          apiKey: settings.apiKey || undefined,
          baseUrl: settings.baseUrl || undefined,
          model: settings.model || undefined
        }),
        signal: this.abortController.signal
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Request failed with status ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';
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
              // Stream complete
            } else {
              try {
                const parsed = JSON.parse(data);
                if (parsed.content) {
                  assistantContent += parsed.content;
                  onChunk(parsed.content, assistantContent);
                }
              } catch (e) {}
            }
          }
        }
      }

      // Save assistant message
      if (assistantContent) {
        session.messages.push({
          role: 'assistant',
          content: assistantContent,
          displayContent: assistantContent,
          timestamp: Date.now()
        });
        Storage.updateSession(sessionId, { messages: session.messages });
      }

      onComplete(assistantContent);
    } catch (error) {
      if (error.name === 'AbortError') {
        onComplete('');
      } else {
        onError(error.message);
      }
    } finally {
      this.isStreaming = false;
      this.abortController = null;
    }
  },

  editMessage(sessionId, messageIndex, newContent) {
    const session = Storage.getSession(sessionId);
    if (!session || messageIndex < 0 || messageIndex >= session.messages.length) {
      return null;
    }

    session.messages[messageIndex].content = newContent;
    session.messages[messageIndex].displayContent = newContent;
    session.messages = session.messages.slice(0, messageIndex + 1);

    Storage.updateSession(sessionId, { messages: session.messages });
    return session;
  },

  regenerateFromMessage(sessionId, messageIndex) {
    const session = Storage.getSession(sessionId);
    if (!session || messageIndex < 0) {
      return null;
    }

    session.messages = session.messages.slice(0, messageIndex);
    Storage.updateSession(sessionId, { messages: session.messages });
    return session;
  },

  async fetchModels() {
    const settings = Storage.getSettings();

    try {
      const response = await fetch('/api/models', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          apiKey: settings.apiKey || undefined,
          baseUrl: settings.baseUrl || undefined
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch models');
      }

      const data = await response.json();
      const models = data.models || [];
      Storage.saveModels(models);
      return models;
    } catch (error) {
      console.error('Fetch models error:', error);
      throw error;
    }
  },

  async generateSmartTitle(sessionId) {
    const settings = Storage.getSettings();
    const session = Storage.getSession(sessionId);

    if (!session || session.messages.length < 2) return null;

    try {
      const response = await fetch('/api/generate-title', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: session.messages.map(m => ({
            role: m.role,
            content: m.content
          })),
          apiKey: settings.apiKey || undefined,
          baseUrl: settings.baseUrl || undefined,
          model: settings.model || undefined
        })
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return data.title || null;
    } catch (error) {
      console.error('Generate title error:', error);
      return null;
    }
  }
};
