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
        },
        formInvalid: false,
        profileForm: { display_name: '', password: '' },
        profileMessage: null,
        profileLoading: false,
        bsModal: null,

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
            this.bsModal = new bootstrap.Modal(this.$refs.charModal);
            this.loadCharacters();
        },

        async loadCharacters() {
            const apiBase = window.APP_CONFIG?.apiBase || '/api';
            const res = await fetch(`${apiBase}/characters`);
            if (res.status === 401) {
                this.logout();
                return;
            }
            this.characters = await res.json();
        },

        prepareAdd() {
            this.form = { slug: null, name: '', avatar: '', system_prompt: '', scenario: '', first_message: '', temperature: 0.8, max_tokens: 200 };
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

            const apiBase = window.APP_CONFIG?.apiBase || '/api';
            const url = this.form.slug ? `${apiBase}/characters/${this.form.slug}` : `${apiBase}/characters`;
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
                    this.profileMessage = { type: 'success', text: 'Profile updated' };
                    setTimeout(() => {
                        const modal = bootstrap.Modal.getInstance(document.getElementById('profileModal'));
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

        async logout() {
            try {
                const apiBase = window.APP_CONFIG?.apiBase || '/api';
                await fetch(`${apiBase}/logout`, { method: 'POST' });
            } catch (e) { }
            localStorage.removeItem('user');
            const appPrefix = window.APP_CONFIG?.appPrefix || '';
            window.location.href = appPrefix + '/';
        }
    }));
});