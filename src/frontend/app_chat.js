document.addEventListener('alpine:init', () => {
    Alpine.data('chatApp', () => ({
        user: JSON.parse(localStorage.getItem('user') || '{}'),
        characters: [],
        currentCharacter: null,
        messages: [],
        newMessage: '',
        selectedImage: null,
        sidebarActive: false,
        isTyping: false,
        typingMessage: '',
        profileForm: { display_name: '', password: '' },
        profileMessage: null,
        profileLoading: false,

        async init() {
            if (!this.user.display_name) {
                this.logout();
                return;
            }

            const apiBase = window.APP_CONFIG?.apiBase || '/api';
            // Проверка жива ли сессия на бэке
            try {
                const res = await fetch(`${apiBase}/me`);
                if (!res.ok) {
                    this.logout();
                    return;
                }
            } catch (e) {
                console.error("Auth check failed", e);
            }

            this.loadProfile();
            await this.loadCharacters();

            // Setup marked options
            marked.setOptions({
                highlight: (code, lang) => {
                    if (lang && hljs.getLanguage(lang)) {
                        return hljs.highlight(code, { language: lang }).value;
                    }
                    return hljs.highlightAuto(code).value;
                },
                breaks: true
            });
        },

        loadProfile() {
            this.profileForm.display_name = this.user.display_name || '';
            this.profileForm.password = '';
        },

        openProfileModal() {
            this.loadProfile();
            this.profileMessage = null;
            const modal = new bootstrap.Modal(document.getElementById('profileModal'));
            modal.show();
        },

        async updateProfile() {
            this.profileLoading = true;
            this.profileMessage = null;
            try {
                const apiBase = window.APP_CONFIG?.apiBase || '/api';
                const response = await fetch(`${apiBase}/profile`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(this.profileForm)
                });
                const result = await response.json();
                if (result.success) {
                    this.user = result.user;
                    localStorage.setItem('user', JSON.stringify(result.user));
                    this.profileMessage = { type: 'success', text: 'Profile updated!' };
                    setTimeout(() => {
                        const modalEl = document.getElementById('profileModal');
                        const modal = bootstrap.Modal.getInstance(modalEl);
                        if (modal) modal.hide();
                    }, 1000);
                } else {
                    this.profileMessage = { type: 'error', text: result.error || 'Update failed' };
                }
            } catch (err) {
                this.profileMessage = { type: 'error', text: 'Network error' };
            } finally {
                this.profileLoading = false;
            }
        },

        async loadCharacters() {
            try {
                const apiBase = window.APP_CONFIG?.apiBase || '/api';
                const response = await fetch(`${apiBase}/characters`);
                if (response.status === 401) {
                    this.logout();
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

        async logout() {
            try {
                const apiBase = window.APP_CONFIG?.apiBase || '/api';
                await fetch(`${apiBase}/logout`, { method: 'POST' });
            } catch (e) { }
            localStorage.removeItem('user');
            const appPrefix = window.APP_CONFIG?.appPrefix || '';
            window.location.href = appPrefix + '/';
        },

        renderMarkdown(content) {
            return DOMPurify.sanitize(marked.parse(content));
        },

        scrollToBottom() {
            this.$nextTick(() => {
                const win = this.$refs.chatWindow;
                if (win) win.scrollTop = win.scrollHeight;
            });
        },

        getAvatar(char) {
            if (char.avatar) return char.avatar;
            return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%2300f2ff'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='central' text-anchor='middle' font-family='Outfit' font-size='50' fill='%2305070a'%3E${char.name[0].toUpperCase()}%3C/text%3E%3C/svg%3E`;
        }
    }));
});
