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
      // Check for [内心]...[说]... format
      const thoughtMatch = text.match(/\[内心\]\s*([\s\S]*?)\[说\]\s*([\s\S]*)/);
      if (thoughtMatch) {
        const thought = thoughtMatch[1].trim();
        const speech = thoughtMatch[2].trim();

        const thoughtHtml = `<details class="thought-bubble"><summary>内心</summary><p>${this.escapeHtml(thought)}</p></details>`;
        const speechHtml = this.renderContent(speech);

        return thoughtHtml + speechHtml;
      }

      return this.renderContent(text);
    } catch (e) {
      console.error('Markdown parse error:', e);
      return this.escapeHtml(text);
    }
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

    // Highlight @mentions (but not inside code blocks)
    html = html.replace(/(@[\u4e00-\u9fa5\w]+)/g, '<span class="mention">$1</span>');

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
