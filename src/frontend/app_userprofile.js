document.addEventListener('alpine:init', () => {
    Alpine.data('userProfileApp', () => ({
        sidebarActive: false,
        user: JSON.parse(localStorage.getItem('user') || '{}'),
        profileForm: { email: '', display_name: '', about: '', password: '' },
        profileMessage: null,
        profileLoading: false,

        async checkAuth() {
            if (!this.user.display_name) {
                this.logout();
                return false;
            }

            const apiBase = window.APP_CONFIG?.apiBase || '/api';
            try {
                const res = await fetch(`${apiBase}/me`);
                if (!res.ok) {
                    this.logout();
                    return false;
                }
                const data = await res.json();
                this.user = data.user;
                localStorage.setItem('user', JSON.stringify(this.user));
            } catch (e) {
                console.error("Auth check failed", e);
            }
            return true;
        },

        loadProfile() {
            this.profileForm.email = this.user.email || '';
            this.profileForm.display_name = this.user.display_name || '';
            this.profileForm.about = this.user.about || '';
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
