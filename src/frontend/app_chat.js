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
            renderer.link = function(data) {
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
                    this.selectCharacter(this.characters[0]);
                }
            } catch (err) {
                console.error("Failed to load characters:", err);
            }
        },

        async selectCharacter(char) {
            if (this.currentCharacter?.id === char.id) return;
            this.currentCharacter = char;
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

                while (true) {
                    const { value, done } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value);
                    const lines = chunk.split('\n');
                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            try {
                                const data = JSON.parse(line.substring(6));
                                if (data.done) {
                                    this.messages.push({ role: 'assistant', content: fullReply });
                                    this.isTyping = false;
                                    this.typingMessage = '';
                                    this.scrollToBottom();
                                    return;
                                }
                                if (data.reply) {
                                    fullReply += data.reply;
                                    this.typingMessage = fullReply;
                                    this.scrollToBottom();
                                }
                            } catch (e) { }
                        }
                    }
                }
            } catch (err) {
                console.error("Stream failed:", err);
                this.isTyping = false;
                this.messages.push({ role: 'assistant', content: 'Error: Could not get response.' });
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

