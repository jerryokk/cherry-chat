// Markdown renderer with code highlighting
const MarkdownRenderer = {
  init() {
    marked.setOptions({
      highlight: function(code, lang) {
        if (lang && hljs.getLanguage(lang)) {
          try {
            return hljs.highlight(code, { language: lang }).value;
          } catch (e) {}
        }
        return hljs.highlightAuto(code).value;
      },
      breaks: true,
      gfm: true
    });
  },

  render(text) {
    if (!text) return '';

    try {
      // Check for role-play format with [内心], [动作], [说] tags
      if (this.hasRolePlayTags(text)) {
        return this.renderRolePlay(text);
      }

      return this.renderContent(text);
    } catch (e) {
      console.error('Markdown parse error:', e);
      return this.escapeHtml(text);
    }
  },

  hasRolePlayTags(text) {
    return /\[(内心|动作|说)\]/.test(text);
  },

  // Extract thought content separately (for placing icon next to character name)
  extractThought(text) {
    if (!this.hasRolePlayTags(text)) {
      return { thought: null, rest: text };
    }

    const tagPattern = /\[(内心|动作|说)\]\s*/g;
    const tags = [];
    let match;

    while ((match = tagPattern.exec(text)) !== null) {
      tags.push({ type: match[1], index: match.index, endIndex: tagPattern.lastIndex });
    }

    let thought = null;
    let restParts = [];

    for (let i = 0; i < tags.length; i++) {
      const tag = tags[i];
      const nextTag = tags[i + 1];
      const contentEnd = nextTag ? nextTag.index : text.length;
      const content = text.slice(tag.endIndex, contentEnd).trim();

      if (content) {
        if (tag.type === '内心') {
          thought = content;
        } else {
          restParts.push({ type: tag.type, content });
        }
      }
    }

    // Rebuild rest text
    let rest = restParts.map(p => `[${p.type}] ${p.content}`).join(' ');
    return { thought, rest: rest || text };
  },

  renderRolePlay(text) {
    // Parse sections: [内心] xxx [动作] xxx [说] xxx
    const tagPattern = /\[(内心|动作|说)\]\s*/g;
    const parts = [];
    let match;

    // Find all tag positions
    const tags = [];
    while ((match = tagPattern.exec(text)) !== null) {
      tags.push({ type: match[1], index: match.index, endIndex: tagPattern.lastIndex });
    }

    // Extract content for each tag
    for (let i = 0; i < tags.length; i++) {
      const tag = tags[i];
      const nextTag = tags[i + 1];
      const contentEnd = nextTag ? nextTag.index : text.length;
      const content = text.slice(tag.endIndex, contentEnd).trim();

      if (content) {
        parts.push({ type: tag.type, content });
      }
    }

    // If no tags found, return as-is
    if (parts.length === 0) {
      return this.renderContent(text);
    }

    // Render each part - skip 内心 as it's handled separately
    let mainHtml = '';

    for (const part of parts) {
      switch (part.type) {
        case '内心':
          // Skip - handled by extractThought and placed next to character name
          break;
        case '动作':
          // Inline action - italic and muted, wrapped in parentheses
          mainHtml += `<span class="rp-action">（${this.escapeHtml(part.content)}）</span> `;
          break;
        case '说':
          // Normal speech - use renderContent to handle @mentions
          mainHtml += `<span class="rp-speech">${this.renderContent(part.content)}</span>`;
          break;
      }
    }

    return mainHtml;
  },

  renderContent(text) {
    let html = marked.parse(text);

    // Add code header with language label and copy button
    html = html.replace(/<pre><code class="language-(\w+)">/g, (match, lang) => {
      return `<div class="code-header"><span class="lang">${lang}</span><button class="copy-code-btn" onclick="MarkdownRenderer.copyCode(this)">Copy</button></div><pre><code class="language-${lang}">`;
    });

    // Handle code blocks without language
    html = html.replace(/<pre><code>(?!class)/g,
      '<div class="code-header"><span class="lang">code</span><button class="copy-code-btn" onclick="MarkdownRenderer.copyCode(this)">Copy</button></div><pre><code>');

    // Highlight @mentions (but not inside code blocks) - supports names with dots like @A.b
    html = html.replace(/(@[\u4e00-\u9fa5\w.]+)/g, '<span class="mention">$1</span>');

    return html;
  },

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  copyCode(btn) {
    const header = btn.parentElement;
    const pre = header.nextElementSibling;
    const code = pre?.querySelector('code') || pre;
    const text = code?.textContent || '';

    const showSuccess = () => {
      const originalText = btn.textContent;
      btn.textContent = 'Copied!';
      btn.style.color = 'var(--success)';
      setTimeout(() => {
        btn.textContent = originalText;
        btn.style.color = '';
      }, 2000);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(showSuccess).catch(() => {
        this.fallbackCopy(text, showSuccess);
      });
    } else {
      this.fallbackCopy(text, showSuccess);
    }
  },

  fallbackCopy(text, onSuccess) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      if (onSuccess) onSuccess();
    } catch (e) {
      console.error('Copy failed:', e);
    }
    document.body.removeChild(textarea);
  }
};

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  MarkdownRenderer.init();
});
