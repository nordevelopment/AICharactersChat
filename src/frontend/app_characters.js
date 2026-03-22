document.addEventListener('alpine:init', () => {
    Alpine.data('characterManager', () => ({
        user: JSON.parse(localStorage.getItem('user') || '{}'),
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
            avatar_prompt: ''
        },
        formInvalid: false,
        bsModal: null,

        init() {
            if (!this.user.display_name) window.location.href = '/';
            this.bsModal = new bootstrap.Modal(this.$refs.charModal);
            this.loadCharacters();
        },

        async loadCharacters() {
            const res = await fetch('/api/characters');
            this.characters = await res.json();
        },

        prepareAdd() {
            this.form = { slug: null, name: '', avatar: '', system_prompt: '', scenario: '', first_message: '', temperature: 0.8, max_tokens: 200, avatar_prompt: '' };
            this.formInvalid = false;
            this.bsModal.show();
        },

        prepareEdit(char) {
            this.form = { ...char };
            this.formInvalid = false;
            this.bsModal.show();
        },

        async saveCharacter() {
            const formEl = document.getElementById('characterForm');
            if (!formEl.checkValidity()) {
                this.formInvalid = true;
                return;
            }

            const url = this.form.slug ? `/api/characters/${this.form.slug}` : '/api/characters';
            const method = this.form.slug ? 'PUT' : 'POST';

            try {
                const res = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(this.form)
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
            await fetch(`/api/characters/${slug}`, { method: 'DELETE' });
            await fetch(`/api/history/${slug}`, { method: 'DELETE' });
            this.loadCharacters();
        },

        async clearAllHistory() {
            if (!confirm('DANGER: Clear ALL chat history?')) return;
            await fetch('/api/history/all', { method: 'DELETE' });
            alert('History cleared');
        },

        logout() {
            localStorage.removeItem('user');
            window.location.href = '/';
        }
    }));
});