document.addEventListener('alpine:init', () => {
    Alpine.data('loginForm', () => ({
        email: '',
        password: '',
        errorMessage: '',
        loading: false,

        async submit() {
            this.loading = true;
            this.errorMessage = '';
            try {
                const apiBase = window.APP_CONFIG?.apiBase || '/api';
                const response = await fetch(`${apiBase}/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: this.email, password: this.password })
                });
                const data = await response.json();
                if (data.success) {
                    localStorage.setItem('user', JSON.stringify(data.user));
                    const appPrefix = window.APP_CONFIG?.appPrefix || '';
                    window.location.href = appPrefix + '/chat';
                } else {
                    this.errorMessage = data.error || 'Login failed';
                }
            } catch (err) {
                this.errorMessage = 'Network error';
            } finally {
                this.loading = false;
            }
        },

        async init() {
            if (localStorage.getItem('user')) {
                const apiBase = window.APP_CONFIG?.apiBase || '/api';
                try {
                    const res = await fetch(`${apiBase}/me`);
                    if (res.ok) {
                        const appPrefix = window.APP_CONFIG?.appPrefix || '';
                        window.location.href = appPrefix + '/chat';
                    } else {
                        localStorage.removeItem('user');
                    }
                } catch (e) {
                    // Ignore errors, let user try to login manually
                }
            }
        }
    }));
});