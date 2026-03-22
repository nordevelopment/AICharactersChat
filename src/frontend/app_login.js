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
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: this.email, password: this.password })
                });
                const data = await response.json();
                if (data.success) {
                    localStorage.setItem('user', JSON.stringify(data.user));
                    window.location.href = '/chat';
                } else {
                    this.errorMessage = data.error || 'Login failed';
                }
            } catch (err) {
                this.errorMessage = 'Network error';
            } finally {
                this.loading = false;
            }
        },

        init() {
            if (localStorage.getItem('user')) {
                window.location.href = '/chat';
            }
        }
    }));
});