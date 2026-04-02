document.addEventListener('alpine:init', () => {
    Alpine.data('characterManager', () => ({
        characters: [],
        form: {
            slug: null,
            name: '',
            avatar: '',
            system_prompt: '',
            scenario: '',
            first_message: '',
            temperature: 0.8,
            max_tokens: 200,
            tools: 0,
        },
        formInvalid: false,
        bsModal: null,

        async init() {
            if (typeof this.checkAuth === 'function') {
                if (!(await this.checkAuth())) return;
            }

            this.bsModal = new bootstrap.Modal(this.$refs.charModal);
            this.loadCharacters();
        },

        async loadCharacters() {
            const apiBase = window.APP_CONFIG?.apiBase || '/api';
            const res = await fetch(`${apiBase}/characters`);
            if (res.status === 401) {
                if (typeof this.logout === 'function') this.logout();
                return;
            }
            this.characters = await res.json();
        },

        prepareAdd() {
            this.form = { slug: null, name: '', avatar: '', system_prompt: '', scenario: '', first_message: '', temperature: 0.8, max_tokens: 200, tools: 0 };
            this.formInvalid = false;
            this.bsModal.show();
        },

        prepareEdit(char) {
            this.form = { ...char };
            // Конвертируем tools из числа в boolean для checkbox
            this.form.tools = char.tools === 1;
            this.formInvalid = false;
            this.bsModal.show();
        },

        async saveCharacter() {
            const formEl = document.getElementById('characterForm');
            if (!formEl.checkValidity()) {
                this.formInvalid = true;
                return;
            }

            const apiBase = window.APP_CONFIG?.apiBase || '/api';
            const url = this.form.slug ? `${apiBase}/characters/${this.form.slug}` : `${apiBase}/characters`;
            const method = this.form.slug ? 'PUT' : 'POST';

            try {
                // Преобразуем tools в число для SQLite
                const formData = { ...this.form };
                if (typeof formData.tools === 'boolean') {
                    formData.tools = formData.tools ? 1 : 0;
                }

                const res = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });
                if (res.ok) {
                    this.bsModal.hide();
                    this.loadCharacters();
                } else {
                    const data = await res.json();
                    alert('Error: ' + data.error);
                }
            } catch (err) {
                alert('Error saving character');
            }
        },

        async deleteCharacter(slug) {
            if (!confirm('Delete this character and all their history?')) return;
            const apiBase = window.APP_CONFIG?.apiBase || '/api';
            await fetch(`${apiBase}/characters/${slug}`, { method: 'DELETE' });
            await fetch(`${apiBase}/history/${slug}`, { method: 'DELETE' });
            this.loadCharacters();
        },

        async clearAllHistory() {
            if (!confirm('DANGER: Clear ALL chat history?')) return;
            const apiBase = window.APP_CONFIG?.apiBase || '/api';
            await fetch(`${apiBase}/history/all`, { method: 'DELETE' });
            alert('History cleared');
        }
    }));
});
