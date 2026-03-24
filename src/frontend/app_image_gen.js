function imageGenerator() {
    return {
        form: {
            prompt: '',
            aspect_ratio: '2:3',
            steps: 25,
            guidance: 4
        },
        loading: false,
        message: { text: '', type: '' },
        currentResult: null,
        history: [],

        init() {
            this.loadHistory();
        },

        async generateImage() {
            if (!this.form.prompt.trim()) return;

            this.loading = true;
            this.message = { text: '', type: '' };

            try {
                const url = (window.APP_CONFIG?.appPrefix || '') + '/api/images/generate';
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(this.form)
                });

                const data = await response.json();

                if (data.success) {
                    this.currentResult = {
                        image_url: data.image_url,
                        prompt: data.prompt
                    };

                    this.addToHistory(this.currentResult);
                    this.message = { text: 'Image generated successfully!', type: 'success' };
                } else {
                    this.message = { text: data.error || 'Failed to generate image', type: 'error' };
                }
            } catch (err) {
                console.error(err);
                this.message = { text: 'Network error occurred while generating.', type: 'error' };
            } finally {
                this.loading = false;
            }
        },

        copyPrompt(prompt) {
            navigator.clipboard.writeText(prompt);
            const originalText = this.message.text;
            const originalType = this.message.type;

            this.message = { text: 'Prompt copied to clipboard!', type: 'success' };

            setTimeout(() => {
                this.message = { text: originalText, type: originalType };
            }, 2000);
        },

        loadHistory() {
            const saved = localStorage.getItem('imageGenHistory');
            if (saved) {
                try {
                    this.history = JSON.parse(saved);
                } catch (e) { }
            }
        },

        addToHistory(result) {
            this.history.unshift(result);
            if (this.history.length > 10) {
                this.history.pop();
            }
            localStorage.setItem('imageGenHistory', JSON.stringify(this.history));
        },

        viewHistoryItem(item) {
            this.currentResult = item;
            this.form.prompt = item.prompt;
        },

        async deleteHistoryItem(item, index) {
            if (!confirm('Are you sure you want to delete this image?')) return;

            try {
                const url = (window.APP_CONFIG?.appPrefix || '') + '/api/images/' + item.filename;
                const response = await fetch(url, {
                    method: 'DELETE'
                });

                const data = await response.json();

                if (data.success || data.error === 'File not found') {
                    // Remove from UI and LocalStorage
                    this.history.splice(index, 1);
                    localStorage.setItem('imageGenHistory', JSON.stringify(this.history));

                    // If current preview is the deleted item, clear it
                    if (this.currentResult && this.currentResult.filename === item.filename) {
                        this.currentResult = null;
                        this.form.prompt = '';
                    }

                    this.message = { text: 'Image deleted successfully.', type: 'success' };
                    setTimeout(() => this.message.text = '', 3000);
                } else {
                    alert('Error deleting image: ' + data.error);
                }
            } catch (err) {
                console.error(err);
                alert('Network error while deleting image.');
            }
        },

        logout() {
            fetch((window.APP_CONFIG?.appPrefix || '') + '/api/auth/logout', { method: 'POST' })
                .then(() => window.location.href = (window.APP_CONFIG?.appPrefix || '') + '/');
        }
    };
}
