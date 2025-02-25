// content.js
(function() {
    // Constants
    const CHAT_WIDTH = '300px';
    const MAX_INPUT_HEIGHT = 200;
  
    // Markdown Parser
    const MarkdownParser = {
      escapeHTML(str) {
        const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
        return str.replace(/[&<>"']/g, match => entities[match]);
      },
  
      parseCodeBlock(text) {
        const codeBlockRegex = /```(?:(\w+)\n)?([\s\S]*?)```/g;
        const inlineCodeRegex = /`([^`\n]+)`/g;
        const codeBlocks = [];
        const inlineCodes = [];
  
        text = text.replace(codeBlockRegex, (match, language, code) => {
          const lang = (language && window.Prism?.languages?.[language.toLowerCase()]) 
            ? language.toLowerCase() 
            : 'text';
          const rawCode = code.trim();
          const highlighted = window.Prism?.highlight 
            ? window.Prism.highlight(rawCode, window.Prism.languages[lang], lang) 
            : this.escapeHTML(rawCode);
          
          const block = `
            <div class="code-block">
              <div class="code-header">
                <span class="code-language">${lang}</span>
                <button class="copy-button" data-code="${this.escapeHTML(rawCode).replace(/"/g, '&quot;')}">
                  <i class="fas fa-copy"></i> Copy
                </button>
              </div>
              <pre class="language-${lang}"><code class="language-${lang}">${highlighted}</code></pre>
            </div>
          `;
          codeBlocks.push(block);
          return `__CODEBLOCK_${codeBlocks.length - 1}__`;
        });
  
        text = text.replace(inlineCodeRegex, (match, code) => {
          const content = this.escapeHTML(code);
          inlineCodes.push(`<code class="inline-code">${content}</code>`);
          return `__INLINECODE_${inlineCodes.length - 1}__`;
        });
  
        return { text, codeBlocks, inlineCodes };
      },
  
      parseMarkdown(text) {
        const { text: parsedText, codeBlocks, inlineCodes } = this.parseCodeBlock(text);
        let result = this.escapeHTML(parsedText);
  
        result = result
          .replace(/^### (.*$)/gm, '<h3>$1</h3>')
          .replace(/^## (.*$)/gm, '<h2>$1</h2>')
          .replace(/^# (.*$)/gm, '<h1>$1</h1>')
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.*?)\*/g, '<em>$1</em>')
          .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
          .replace(/^\s*-\s*(.*?)$/gm, '<li>$1</li>')
          .replace(/(<li>.*?<\/li>\s*)+/gs, '<ul>$&</ul>')
          .replace(/\n/g, '<br>');
  
        codeBlocks.forEach((block, i) => result = result.replace(`__CODEBLOCK_${i}__`, block));
        inlineCodes.forEach((inline, i) => result = result.replace(`__INLINECODE_${i}__`, inline));
  
        return result;
      }
    };
  
    // DOM Utilities
    const $ = (selector, context = document) => context.querySelector(selector);
    const $$ = (selector, context = document) => context.querySelectorAll(selector);
  
    // Message Handler
    const MessageHandler = {
      messagesDiv: null,
      init(chatContainerId) {
        this.messagesDiv = $(chatContainerId);
      },
      createMessageElement(role) {
        const div = document.createElement('div');
        div.className = `message ${role}`;
        div.innerHTML = `
          <div class="message-content">
            <strong>${role === 'user' ? 'You' : 'Assistant'}:</strong>
            <div class="message-text"></div>
          </div>
        `;
        return div;
      },
      updateMessageContent(element, content) {
        $('.message-text', element).innerHTML = MarkdownParser.parseMarkdown(content);
      },
      displayMessage(role, content) {
        const element = this.createMessageElement(role);
        this.updateMessageContent(element, content);
        this.messagesDiv.appendChild(element);
        this.messagesDiv.scrollTop = this.messagesDiv.scrollHeight;
        return element;
      }
    };
  
    // API Client
    async function* streamFromOpenAI(messages, tools) {
      const { apiKey, apiEndpoint, model } = await chrome.storage.local.get(['apiKey', 'apiEndpoint', 'model']);
      if (!apiKey || !apiEndpoint || !model) throw new Error('API configuration missing');
  
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.7,
          stream: true,
          tools,
          tool_choice: "auto"
        })
      });
  
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'API request failed');
      }
  
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let accumulatedToolCall = null;
  
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            if (accumulatedToolCall?.function?.name) {
              const args = accumulatedToolCall.function.arguments ? JSON.parse(accumulatedToolCall.function.arguments) : {};
              const lastMessage = messages.filter(m => m.role === 'user').pop()?.content || '';
              
              if (accumulatedToolCall.function.name === "fetchPubMedCitation") {
                const title = args.title || lastMessage.match(/```latex\n"([^"]+)"```/)?.[1] || lastMessage;
                if (title) yield await fetchPubMedCitation(title);
                else yield "Error: No article title provided.";
              } else if (accumulatedToolCall.function.name === "fetchPubMedAbstract") {
                const citationKeyOrTitle = args.citationKeyOrTitle || lastMessage;
                if (citationKeyOrTitle) yield await fetchPubMedAbstract(citationKeyOrTitle);
                else yield "Error: No citation key or title provided.";
              }
            }
            return;
          }
  
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
  
          for (const line of lines) {
            if (line.startsWith('data: ') && line.slice(6).trim() !== '[DONE]') {
              try {
                const parsed = JSON.parse(line.slice(6));
                const content = parsed.choices[0]?.delta?.content;
                const toolCalls = parsed.choices[0]?.delta?.tool_calls;
  
                if (content) yield content;
                else if (toolCalls) {
                  for (const toolCall of toolCalls) {
                    if (toolCall.index === 0) {
                      accumulatedToolCall = accumulatedToolCall || { function: { name: '', arguments: '' } };
                      if (toolCall.function?.name) accumulatedToolCall.function.name = toolCall.function.name;
                      if (toolCall.function?.arguments) accumulatedToolCall.function.arguments += toolCall.function.arguments;
                    }
                  }
                }
              } catch (e) {
                console.error('Error parsing stream data:', e);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    }
  
    // PubMed Tools
    const pubMedTool = {
      type: "function",
      function: {
        name: "fetchPubMedCitation",
        description: "Search PubMed for an article by title and return a BibTeX citation in LaTeX format.",
        parameters: { type: "object", properties: { title: { type: "string" } }, required: ["title"] }
      }
    };
  
    const pubMedAbstractTool = {
      type: "function",
      function: {
        name: "fetchPubMedAbstract",
        description: "Fetch the abstract of a PubMed article given its citation key or title.",
        parameters: { type: "object", properties: { citationKeyOrTitle: { type: "string" } }, required: ["citationKeyOrTitle"] }
      }
    };
  
    async function fetchPubMedCitation(title) {
      try {
        const searchResponse = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(title)}&retmode=json&retmax=1`);
        const searchData = await searchResponse.json();
        const pmid = searchData.esearchresult?.idlist?.[0];
        if (!pmid) return "No articles found on PubMed for this title.";
  
        const fetchResponse = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${pmid}&retmode=json`);
        const fetchData = await fetchResponse.json();
        const article = fetchData.result[pmid];
        if (!article) return "Failed to retrieve article details.";
  
        const authors = article.authors.map(author => author.name).join(', ');
        const pubYear = article.pubdate.split(' ')[0];
        const citeKey = `${article.authors[0].name.split(' ')[0].toLowerCase()}${pubYear}`;
  
        return `\`\`\`latex
  @article{${citeKey},
      author = {${authors}},
      title = {${article.title}},
      journal = {${article.source}},
      year = {${pubYear}},
      volume = {${article.volume || ''}},${article.issue ? `    number = {(${article.issue})},\n` : ''}
      pages = {${article.pages || ''}}
  }
  \`\`\`
  [View on PubMed](https://pubmed.ncbi.nlm.nih.gov/${pmid}/)`;
      } catch (error) {
        return `Error: ${error.message}`;
      }
    }
  
    async function fetchPubMedAbstract(citationKeyOrTitle) {
      try {
        const title = chatHistory
          .filter(m => m.role === 'assistant' && m.content.includes(citationKeyOrTitle))
          .pop()?.content?.match(/title = {([^}]+)}/)?.[1] || citationKeyOrTitle;
  
        const searchResponse = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(title)}&retmode=json&retmax=1`);
        const searchData = await searchResponse.json();
        const pmid = searchData.esearchresult?.idlist?.[0];
        if (!pmid) return "No articles found on PubMed for this title or citation key.";
  
        const fetchResponse = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${pmid}&retmode=xml`);
        const xmlText = await fetchResponse.text();
        const xmlDoc = new DOMParser().parseFromString(xmlText, "text/xml");
        const abstractText = xmlDoc.querySelector("AbstractText")?.textContent;
  
        return abstractText ? `${abstractText}\n[View on PubMed](https://pubmed.ncbi.nlm.nih.gov/${pmid}/)` : "No abstract available.";
      } catch (error) {
        return `Error: ${error.message}`;
      }
    }
  
    // Chat UI
    const ChatUI = {
      chatHistory: [{ role: 'system', content: 'You are a LaTeX expert.' }],
      tools: [pubMedTool, pubMedAbstractTool],
  
      createChat() {
        let aside = $('.ai-chat');
        if (aside) {
          this.toggleChat(aside);
          this.ensureToolbarButton();
          return;
        }
  
        aside = document.createElement('aside');
        aside.className = 'ai-chat';
        aside.innerHTML = `
          <div class="resize-handle"></div>
          <div id="chatbot-panel">
            <div id="chatbot-header">
              <div class="header-content">
                <span class="header-text">LaTeX Assistant</span>
                <div class="header-buttons">
                  <button id="chatbot-clear" title="Clear Chat"><i class="fas fa-trash"></i></button>
                  <button id="chatbot-close">×</button>
                </div>
              </div>
            </div>
            <div id="chatbot-messages"></div>
            <div id="chatbot-input-area">
              <textarea id="chatbot-input" rows="1" placeholder="Ask about LaTeX..." style="resize: none; overflow-y: hidden;"></textarea>
              <button id="chatbot-send">Send</button>
            </div>
          </div>
        `;
        document.body.appendChild(aside);
        MessageHandler.init('#chatbot-messages');
  
        this.setupResize(aside);
        this.setupEventListeners(aside);
        this.ensureToolbarButton();
      },
  
      setupResize(aside) {
        const resizeHandle = $('.resize-handle', aside);
        let isResizing = false, startX, startWidth;
  
        resizeHandle.addEventListener('mousedown', (e) => {
          isResizing = true;
          startX = e.pageX;
          startWidth = aside.offsetWidth;
          document.body.style.cursor = 'col-resize';
          document.body.style.userSelect = 'none';
        });
  
        document.addEventListener('mousemove', (e) => {
          if (isResizing) {
            const dx = startX - e.pageX;
            aside.style.width = `${Math.max(200, Math.min(startWidth + dx, window.innerWidth - 200))}px`;
          }
        });
  
        document.addEventListener('mouseup', () => {
          if (isResizing) {
            isResizing = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
          }
        });
  
        resizeHandle.addEventListener('selectstart', (e) => e.preventDefault());
      },
  
      setupEventListeners(aside) {
        const input = $('#chatbot-input', aside);
        const sendButton = $('#chatbot-send', aside);
        let lastSelectedText = '';
  
        input.addEventListener('focus', () => {
          lastSelectedText = this.getSelectedTextWithNewlines();
          input.placeholder = lastSelectedText 
            ? `Selected: "${lastSelectedText.replace(/\n/g, '\\n')}" (press Send or type your question)` 
            : 'Ask about LaTeX...';
        });
  
        input.addEventListener('input', () => {
          input.style.height = 'auto';
          input.style.height = `${Math.min(input.scrollHeight, MAX_INPUT_HEIGHT)}px`;
          input.placeholder = 'Ask about LaTeX...';
        });
  
        sendButton.addEventListener('click', () => this.handleUserInput(input.value, lastSelectedText));
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.handleUserInput(input.value, lastSelectedText);
          }
        });
  
        $('#chatbot-clear', aside).addEventListener('click', () => {
          $('#chatbot-messages', aside).innerHTML = '';
          this.chatHistory = [{ role: 'system', content: 'You are a LaTeX expert.' }];
        });
  
        aside.addEventListener('click', async (e) => {
          const button = e.target.closest('.copy-button');
          if (button) {
            try {
              await navigator.clipboard.writeText(button.dataset.code);
              button.innerHTML = '<i class="fas fa-check"></i> Copied!';
              setTimeout(() => button.innerHTML = '<i class="fas fa-copy"></i> Copy', 2000);
            } catch (err) {
              button.textContent = 'Failed';
              setTimeout(() => button.innerHTML = '<i class="fas fa-copy"></i> Copy', 2000);
            }
          }
        });
  
        $('#chatbot-close', aside).addEventListener('click', () => this.toggleChat(aside));
      },
  
      getSelectedTextWithNewlines() {
        const selection = window.getSelection();
        if (selection.rangeCount === 0) return '';
  
        const range = selection.getRangeAt(0);
        const editor = $('.cm-editor');
        if (!editor || !range.intersectsNode(editor)) return '';
  
        const fragment = range.cloneContents();
        const tempDiv = document.createElement('div');
        tempDiv.appendChild(fragment);
  
        let text = '';
        const processNode = (node) => {
          if (node.nodeType === Node.TEXT_NODE) text += node.textContent;
          else if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.tagName === 'BR') text += '\n';
            else if (['P', 'DIV'].includes(node.tagName)) {
              if (text && !text.endsWith('\n')) text += '\n';
              node.childNodes.forEach(processNode);
              if (!text.endsWith('\n')) text += '\n';
            } else node.childNodes.forEach(processNode);
          }
        };
  
        tempDiv.childNodes.forEach(processNode);
        return text.trim();
      },
  
      async handleUserInput(message, selectedText) {
        if (!message.trim() && !selectedText) return;
  
        const input = $('#chatbot-input');
        const sendButton = $('#chatbot-send');
        input.disabled = sendButton.disabled = true;
  
        const fullMessage = !message.trim() && selectedText 
          ? selectedText 
          : selectedText 
            ? `Context:\n\`\`\`latex\n"${selectedText}"\`\`\`\n\nMessage:\n${message.trim()}`
            : message.trim();
  
        if (!fullMessage) return;
  
        MessageHandler.displayMessage('user', fullMessage);
        this.chatHistory.push({ role: 'user', content: fullMessage });
        input.value = '';
        input.style.height = 'auto';
  
        try {
          const messageElement = MessageHandler.createMessageElement('assistant');
          MessageHandler.messagesDiv.appendChild(messageElement);
          let response = '';
          for await (const chunk of streamFromOpenAI(this.chatHistory, this.tools)) {
            response += chunk;
            MessageHandler.updateMessageContent(messageElement, response);
            MessageHandler.messagesDiv.scrollTop = MessageHandler.messagesDiv.scrollHeight;
          }
          this.chatHistory.push({ role: 'assistant', content: response });
        } catch (error) {
          MessageHandler.displayMessage('system', `Error: ${error.message}`);
          console.error('Chat error:', error);
        } finally {
          input.disabled = sendButton.disabled = false;
          input.focus();
        }
      },
  
      toggleChat(element) {
        element.classList.toggle('open');
        element.style.visibility = element.classList.contains('open') ? 'visible' : 'hidden';
        if (element.classList.contains('open')) $('#chatbot-input', element)?.focus();
      },
  
      ensureToolbarButton() {
        const toolbarRight = $('.toolbar-right');
        if (!toolbarRight) return;
  
        const chatItem = Array.from($$('.toolbar-item', toolbarRight))
          .find(item => $('.toolbar-label', item)?.textContent.trim() === 'Chat');
  
        if (chatItem && !Array.from($$('.toolbar-item', toolbarRight))
          .some(item => $('.toolbar-label', item)?.textContent.trim() === 'LaTeX Assistant')) {
          const aiChatItem = document.createElement('div');
          aiChatItem.className = 'toolbar-item';
          aiChatItem.innerHTML = `
            <button class="btn btn-full-height btn-full-height-no-border" title="Open LaTeX Assistant">
              <i class="fa fa-commenting fa-fw" aria-hidden="true"></i>
              <p class="toolbar-label">LaTeX Assistant</p>
            </button>
          `;
          chatItem.insertAdjacentElement('afterend', aiChatItem);
          $('button', aiChatItem).addEventListener('click', () => this.toggleChat($('.ai-chat')));
        }
      }
    };
  
    // Initialization
    function initialize() {
      const fontAwesomeLink = document.createElement('link');
      fontAwesomeLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css';
      fontAwesomeLink.rel = 'stylesheet';
      document.head.appendChild(fontAwesomeLink);
  
      const observer = new MutationObserver(() => {
        if ($('.cm-editor') && $('.toolbar-header') && !$('.ai-chat')) {
          ChatUI.createChat();
          observer.disconnect();
        }
      });
  
      observer.observe(document.body, { childList: true, subtree: true });
      if ($('.cm-editor') && $('.toolbar-header')) ChatUI.createChat();
    }
  
    initialize();
  })();