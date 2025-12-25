// Group Chat functionality with multi-character support
const GroupChat = {
  isProcessing: false,
  abortControllers: [],

  // Generate characters based on purpose
  async generateCharacters(purpose) {
    const settings = Storage.getSettings();

    const response = await fetch('/api/generate-characters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        purpose,
        apiKey: settings.apiKey || undefined,
        baseUrl: settings.baseUrl || undefined,
        model: settings.model || undefined
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to generate characters');
    }

    const data = await response.json();
    return data.characters || [];
  },

  // Moderator decides which characters should respond
  async moderatorDecide(sessionId) {
    const settings = Storage.getSettings();
    const session = Storage.getSession(sessionId);

    if (!session || session.type !== 'group') return { respondents: [] };

    // Get recent messages for context
    const recentMessages = session.messages.slice(-10).map(m => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content : m.content,
      characterId: m.characterId,
      characterName: m.characterName
    }));

    // Use abort controller for moderator too
    const controller = new AbortController();
    this.abortControllers.push(controller);

    try {
      const response = await fetch('/api/moderator-decide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purpose: session.purpose,
          characters: session.characters,
          recentMessages,
          speakersPerRound: session.speakersPerRound || 'free',
          hasNarrator: session.hasNarrator !== false,
          apiKey: settings.apiKey || undefined,
          baseUrl: settings.baseUrl || undefined,
          model: settings.model || undefined
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        console.error('Moderator decision failed');
        return { respondents: [] };
      }

      return await response.json();
    } catch (error) {
      if (error.name === 'AbortError') {
        return { respondents: [] };
      }
      throw error;
    }
  },

  // Single character speaks with streaming
  async characterSpeak(sessionId, character, onChunk, onComplete, onError) {
    const settings = Storage.getSettings();
    const session = Storage.getSession(sessionId);

    if (!session) {
      onError('No session');
      return;
    }

    const controller = new AbortController();
    this.abortControllers.push(controller);

    try {
      const response = await fetch('/api/character-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          character,
          purpose: session.purpose,
          backgroundStory: session.backgroundStory || '',
          messages: session.messages.slice(-20).map(m => ({
            role: m.role,
            content: m.content,
            displayContent: m.displayContent,
            characterId: m.characterId,
            characterName: m.characterName
          })),
          showThoughts: session.showThoughts !== false,
          showActions: session.showActions !== false,
          apiKey: settings.apiKey || undefined,
          baseUrl: settings.baseUrl || undefined,
          model: settings.model || undefined
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Character chat failed');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let content = '';
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
              // Done
            } else {
              try {
                const parsed = JSON.parse(data);
                if (parsed.content) {
                  content += parsed.content;
                  onChunk(parsed.content, content);
                }
              } catch (e) {}
            }
          }
        }
      }

      onComplete(content);
      return content;
    } catch (error) {
      if (error.name === 'AbortError') {
        onComplete('');
      } else {
        onError(error.message);
      }
    }
  },

  // Describe a single image using AI
  async describeImage(image) {
    const settings = Storage.getSettings();

    try {
      const response = await fetch('/api/describe-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images: [image],
          apiKey: settings.apiKey || undefined,
          baseUrl: settings.baseUrl || undefined,
          model: settings.model || undefined
        })
      });

      if (!response.ok) {
        return '（图片内容无法识别）';
      }

      const data = await response.json();
      return data.description || '（图片内容无法识别）';
    } catch (error) {
      console.error('Image description error:', error);
      return '（图片内容无法识别）';
    }
  },

  // Narrator speaks - scene descriptions, time progression, etc.
  async narratorSpeak(sessionId, callbacks) {
    const settings = Storage.getSettings();
    const session = Storage.getSession(sessionId);

    if (!session) return;

    const controller = new AbortController();
    this.abortControllers.push(controller);

    // Create narrator "character" for display
    const narrator = {
      id: 'narrator',
      name: '画外音',
      color: '#64748b',
      avatar: '📖'
    };

    const placeholder = callbacks.onCharacterStart(narrator);

    try {
      const response = await fetch('/api/narrator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purpose: session.purpose,
          backgroundStory: session.backgroundStory || '',
          messages: session.messages.slice(-15).map(m => ({
            role: m.role,
            content: m.content,
            characterName: m.characterName
          })),
          apiKey: settings.apiKey || undefined,
          baseUrl: settings.baseUrl || undefined,
          model: settings.model || undefined
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        callbacks.onCharacterError(narrator, 'Narrator failed', placeholder);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let content = '';
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
            if (data !== '[DONE]') {
              try {
                const parsed = JSON.parse(data);
                if (parsed.content) {
                  content += parsed.content;
                  callbacks.onCharacterChunk(narrator, parsed.content, content, placeholder);
                }
              } catch (e) {}
            }
          }
        }
      }

      // Save narrator message
      if (content) {
        const narratorMessage = {
          role: 'narrator',
          characterId: 'narrator',
          characterName: '画外音',
          characterColor: '#64748b',
          content: content,
          displayContent: content,
          timestamp: Date.now()
        };
        session.messages.push(narratorMessage);
        Storage.updateSession(sessionId, { messages: session.messages });
        callbacks.onCharacterComplete(narrator, content, placeholder);
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        callbacks.onCharacterError(narrator, error.message, placeholder);
      }
    }
  },

  // Send user message and trigger group chat loop
  async sendGroupMessage(sessionId, content, images, callbacks, userRole = 'narrator') {
    if (this.isProcessing) {
      this.abort();
      return;
    }

    const session = Storage.getSession(sessionId);
    if (!session || session.type !== 'group') return;

    this.isProcessing = true;
    this.abortControllers = [];

    try {
      let finalContent = content || '';
      let displayContent = content || '';

      // Format content based on user role
      const rolePrefix = userRole === 'narrator' ? '[画外音]' : '[路人甲]';

      if (images && images.length > 0) {
        // Show user message with images, initially with loading state for interpretation
        const userMessage = {
          role: 'user',
          userRole: userRole,
          content: content,
          displayContent: `${rolePrefix} ${content}`,
          images: images,
          interpretation: null, // Will be filled after AI describes
          timestamp: Date.now()
        };
        session.messages.push(userMessage);
        Storage.updateSession(sessionId, { messages: session.messages });
        const messageElement = callbacks.onUserMessage(userMessage);

        // Show interpreting indicator
        callbacks.onInterpretStart && callbacks.onInterpretStart(messageElement);

        // Describe each image separately
        const descriptions = [];
        for (let i = 0; i < images.length; i++) {
          const desc = await this.describeImage(images[i]);
          if (images.length > 1) {
            descriptions.push(`[图${i + 1}] ${desc}`);
          } else {
            descriptions.push(desc);
          }
        }

        const imageText = descriptions.join('\n');
        // Build full context: rolePrefix + user text + image descriptions
        if (content) {
          finalContent = `${rolePrefix} ${content}\n[用户发送了${images.length}张图片]\n${imageText}`;
        } else {
          finalContent = `${rolePrefix} [用户发送了${images.length}张图片]\n${imageText}`;
        }

        // Update user message with interpretation
        const msgIndex = session.messages.length - 1;
        session.messages[msgIndex].interpretation = imageText;
        session.messages[msgIndex].content = finalContent; // Full content for AI context
        Storage.updateSession(sessionId, { messages: session.messages });

        // Update UI with interpretation result
        callbacks.onInterpretComplete && callbacks.onInterpretComplete(messageElement, imageText);
      } else {
        // No images, just add user message
        const userMessage = {
          role: 'user',
          userRole: userRole,
          content: `${rolePrefix} ${finalContent}`,
          displayContent: `${rolePrefix} ${displayContent}`,
          images: [],
          timestamp: Date.now()
        };
        session.messages.push(userMessage);
        Storage.updateSession(sessionId, { messages: session.messages });
        callbacks.onUserMessage(userMessage);
      }

      // Start moderator loop
      await this.runModeratorLoop(sessionId, callbacks);
    } catch (error) {
      console.error('Group message error:', error);
      callbacks.onLoopComplete();
    } finally {
      this.isProcessing = false;
    }
  },

  // Run the moderator decision loop
  async runModeratorLoop(sessionId, callbacks, maxRounds = 20) {
    let round = 0;

    while (round < maxRounds && this.isProcessing) {
      round++;

      try {
        // Moderator decides
        callbacks.onModeratorThinking();
        const decision = await this.moderatorDecide(sessionId);

        // Check if conversation should end
        if (!decision.respondents || decision.respondents.length === 0) {
          callbacks.onRoundComplete(round, 'Conversation ended');
          break;
        }

        // Check continue flag - if false, this is the last round
        const shouldContinue = decision.continue !== false;

        // Get characters that need to respond
        const session = Storage.getSession(sessionId);

        // Check if narrator is in respondents
        const hasNarratorResponse = decision.respondents.includes('narrator');
        const characterIds = decision.respondents.filter(id => id !== 'narrator');

        const respondingCharacters = session.characters.filter(c =>
          characterIds.includes(c.id)
        );

        if (respondingCharacters.length === 0 && !hasNarratorResponse) {
          callbacks.onRoundComplete(round, 'No valid respondents');
          break;
        }

        // Handle narrator first if present
        if (hasNarratorResponse) {
          await this.narratorSpeak(sessionId, callbacks);
        }

        // Characters speak in parallel - collect results first, then save together
        const results = [];
        const promises = respondingCharacters.map(character => {
          return new Promise((resolve) => {
            // Create placeholder for this character
            const placeholder = callbacks.onCharacterStart(character);

            this.characterSpeak(
              sessionId,
              character,
              // onChunk
              (chunk, fullContent) => {
                callbacks.onCharacterChunk(character, chunk, fullContent, placeholder);
              },
              // onComplete
              (fullContent) => {
                if (fullContent) {
                  // Collect result, don't save yet to avoid race condition
                  results.push({
                    role: 'character',
                    characterId: character.id,
                    characterName: character.name,
                    characterColor: character.color,
                    content: fullContent,
                    displayContent: fullContent,
                    timestamp: Date.now()
                  });
                }
                callbacks.onCharacterComplete(character, fullContent, placeholder);
                resolve(fullContent);
              },
              // onError
              (error) => {
                callbacks.onCharacterError(character, error, placeholder);
                resolve('');
              }
            );
          });
        });

        // Wait for all characters to finish
        await Promise.all(promises);

        // Now save all messages together to avoid race condition
        if (results.length > 0) {
          const updatedSession = Storage.getSession(sessionId);
          if (updatedSession && updatedSession.messages) {
            updatedSession.messages.push(...results);
            Storage.updateSession(sessionId, { messages: updatedSession.messages });
          }
        }

        callbacks.onRoundComplete(round, decision.reason);

        // Check if we should continue
        if (!shouldContinue) {
          break;
        }

        // Small delay before next round
        await new Promise(r => setTimeout(r, 300));
      } catch (error) {
        console.error('Round error:', error);
        callbacks.onRoundComplete(round, 'Error occurred');
        break;
      }
    }

    callbacks.onLoopComplete();
  },

  abort() {
    this.isProcessing = false;
    for (const controller of this.abortControllers) {
      controller.abort();
    }
    this.abortControllers = [];
  }
};
