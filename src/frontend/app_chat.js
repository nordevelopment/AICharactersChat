document.addEventListener('alpine:init', () => {
    Alpine.data('chatApp', () => ({
        characters: [],
        currentCharacter: null,
        messages: [],
        newMessage: '',
        selectedImage: null,
        sidebarActive: false,
        isTyping: false,
        typingMessage: '',
        typingReasoning: '',

        async init() {
            // Check auth first (this will be handled by userProfileApp if combined,
            // but for now we keep it simple or rely on the combined state)
            if (typeof this.checkAuth === 'function') {
                if (!(await this.checkAuth())) return;
            }

            await this.loadCharacters();

            // Setup marked options
            const renderer = new marked.Renderer();
            const origLink = renderer.link.bind(renderer);
            renderer.link = function (data) {
                const html = origLink(data);
                return html.replace('<a ', '<a target="_blank" rel="noopener noreferrer" ');
            };

            marked.setOptions({
                renderer,
                highlight: (code, lang) => {
                    if (lang && hljs.getLanguage(lang)) {
                        return hljs.highlight(code, { language: lang }).value;
                    }
                    return hljs.highlightAuto(code).value;
                },
                breaks: true
            });
        },

        async loadCharacters() {
            try {
                const apiBase = window.APP_CONFIG?.apiBase || '/api';
                const response = await fetch(`${apiBase}/characters`);
                if (response.status === 401) {
                    if (typeof this.logout === 'function') this.logout();
                    return;
                }
                this.characters = await response.json();
                if (this.characters.length > 0 && !this.currentCharacter) {
                    const lastId = localStorage.getItem('lastCharacterId');
                    const savedChar = lastId ? this.characters.find(c => c.id == lastId) : null;
                    this.selectCharacter(savedChar || this.characters[0]);
                }
            } catch (err) {
                console.error("Failed to load characters:", err);
            }
        },

        async selectCharacter(char) {
            if (this.currentCharacter?.id === char.id) return;
            this.currentCharacter = char;
            localStorage.setItem('lastCharacterId', char.id);
            this.messages = [];
            this.sidebarActive = false;
            this.clearImage();

            try {
                const apiBase = window.APP_CONFIG?.apiBase || '/api';
                const response = await fetch(`${apiBase}/history?character_id=${char.id}`);
                const history = await response.json();
                if (history.length === 0 && char.first_message) {
                    this.messages = [{ role: 'assistant', content: char.first_message }];
                } else {
                    this.messages = history;
                }
                this.scrollToBottom();
            } catch (err) {
                console.error("Failed to load history:", err);
            }
        },

        async sendMessage() {
            const text = this.newMessage.trim();
            const img = this.selectedImage;
            if ((!text && !img) || !this.currentCharacter || this.isTyping) return;

            // Add user message locally
            const userMsg = { role: 'user', content: text, image: img };
            this.messages.push(userMsg);
            this.newMessage = '';
            this.clearImage();
            this.scrollToBottom();

            this.isTyping = true;
            this.typingMessage = '';
            this.typingReasoning = '';
            let assistantReplyCommitted = false;

            const pushAssistantMessage = (replyText, reasoningText = '') => {
                if (assistantReplyCommitted) return;
                let msgContent = replyText;
                if (reasoningText) {
                    msgContent = `<details class="reasoning-details mb-2"><summary class="text-muted small" style="cursor:pointer">Thought Process</summary>\n<div class="content text-muted small mt-1" style="border-left: 2px solid #555; padding-left: 8px;">\n${reasoningText}\n</div>\n</details>\n\n` + msgContent;
                }
                this.messages.push({ role: 'assistant', content: msgContent });
                assistantReplyCommitted = true;
                this.scrollToBottom();
            };

            try {
                const apiBase = window.APP_CONFIG?.apiBase || '/api';
                const response = await fetch(`${apiBase}/chat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message: text,
                        character_id: this.currentCharacter.id,
                        image: img
                    })
                });

                if (!response.ok) throw new Error('Network error');

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let fullReply = '';
                let buffer = '';

                while (true) {
                    const { value, done } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    
                    // Last line may be incomplete, leave it in buffer
                    buffer = lines.pop();

                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed || !trimmed.startsWith('data: ')) continue;

                        try {
                            const data = JSON.parse(trimmed.substring(6));
                            if (data.done) {
                                pushAssistantMessage(fullReply, this.typingReasoning);
                                return;
                            }
                            if (data.reply) {
                                fullReply += data.reply;
                                this.typingMessage = fullReply;
                                this.scrollToBottom();
                            }
                            if (data.reasoning) {
                                this.typingReasoning += data.reasoning;
                                this.scrollToBottom();
                            }
                            if (data.imageFilePath) {
                                // Update the last user message with the file path
                                const lastUserMsg = this.messages.slice().reverse().find(m => m.role === 'user');
                                if (lastUserMsg) {
                                    lastUserMsg.imageFilePath = data.imageFilePath;
                                }
                            }
                        } catch (e) {
                            console.warn("Failed to parse SSE line:", trimmed, e);
                        }
                    }
                }

                // Stream ended without done event: save partial response
                if (fullReply.trim()) {
                    pushAssistantMessage(fullReply, this.typingReasoning);
                    this.messages.push({
                        role: 'assistant',
                        content: '⚠️ Error: Stream ended unexpectedly.'
                    });
                } else {
                    this.messages.push({ role: 'assistant', content: 'Error: Stream ended unexpectedly.' });
                }
            } catch (err) {
                console.error("Stream failed:", err);
                if (fullReply.trim()) {
                    pushAssistantMessage(fullReply, this.typingReasoning);
                    this.messages.push({
                        role: 'assistant',
                        content: '⚠️ Error: Could not get response.'
                    });
                } else {
                    this.messages.push({ role: 'assistant', content: 'Error: Could not get response.' });
                }
            } finally {
                this.isTyping = false;
                this.typingMessage = '';
                this.typingReasoning = '';
            }
        },

        handleImage(e) {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                this.selectedImage = event.target.result;
            };
            reader.readAsDataURL(file);
        },

        clearImage() {
            this.selectedImage = null;
            if (this.$refs.imageInput) this.$refs.imageInput.value = '';
        },

        async clearHistory() {
            if (!this.currentCharacter || !confirm('Clear history for this character?')) return;
            try {
                const apiBase = window.APP_CONFIG?.apiBase || '/api';
                await fetch(`${apiBase}/history/${this.currentCharacter.id}`, { method: 'DELETE' });
                this.messages = this.currentCharacter.first_message
                    ? [{ role: 'assistant', content: this.currentCharacter.first_message }]
                    : [];
            } catch (err) {
                console.error("Clear history failed:", err);
            }
        },

        async clearMemory() {
            if (!this.currentCharacter || !confirm('Clear memory for this character? This cannot be undone.')) return;
            try {
                const apiBase = window.APP_CONFIG?.apiBase || '/api';
                await fetch(`${apiBase}/memory/${this.currentCharacter.id}`, { method: 'DELETE' });
            } catch (err) {
                console.error("Clear memory failed:", err);
            }
        },

        renderMarkdown(content) {
            return DOMPurify.sanitize(marked.parse(content), { ADD_ATTR: ['target'] });
        },

        scrollToBottom() {
            this.$nextTick(() => {
                const win = this.$refs.chatWindow;
                if (win) win.scrollTop = win.scrollHeight;
            });
        },

        getAvatar(char) {
            if (char.avatar) return char.avatar;
            return null;
        }
    }));
});


