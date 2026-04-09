function imageGenerator() {
    return {
        form: {
            prompt: '',
            aspect_ratio: '2:3',
            steps: 25,
            guidance: 4,
            provider: 'xai'  // xai или together
        },
        availableProviders: [],
        currentProviderInfo: null,
        loading: false,
        message: { text: '', type: '' },
        currentResult: null,
        history: [],
        showHistory: false,  // Toggle state

        init() {
            this.loadHistory();
            this.loadProviders();
            this.loadSettings();
            this.setupKeyboardShortcuts();
        },

        loadSettings() {
            const saved = localStorage.getItem('imageGenSettings');
            if (saved) {
                try {
                    const settings = JSON.parse(saved);
                    this.form.provider = settings.provider || 'xai';
                    this.form.aspect_ratio = settings.aspect_ratio || '2:3';
                    this.form.steps = settings.steps || 25;
                    this.form.guidance = settings.guidance || 4;
                } catch (e) {
                    console.error('Failed to load settings:', e);
                }
            }
        },

        saveSettings() {
            localStorage.setItem('imageGenSettings', JSON.stringify({
                provider: this.form.provider,
                aspect_ratio: this.form.aspect_ratio,
                steps: this.form.steps,
                guidance: this.form.guidance
            }));
        },

        setupKeyboardShortcuts() {
            document.addEventListener('keydown', (e) => {
                if (e.ctrlKey && e.key === 'Enter') {
                    e.preventDefault();
                    this.generateImage();
                }
                if (e.key === 'Escape') {
                    this.currentResult = null;
                }
            });
        },

        updatePromptPreview() {
            // This method is called by the @input event
            // The preview is automatically updated via x-text binding
        },

        clearHistory() {
            if (!confirm('Are you sure you want to clear all history?')) return;
            
            // Clear all images from server
            if (confirm('This will delete ALL generated images. Continue?')) {
                // For now just refresh - actual deletion would need bulk delete API
                this.loadHistory();
                this.message = { text: 'History refreshed.', type: 'success' };
                setTimeout(() => this.message.text = '', 3000);
            }
        },

        async loadProviders() {
            try {
                const url = (window.APP_CONFIG?.appPrefix || '') + '/api/images/providers';
                const response = await fetch(url);
                const data = await response.json();

                if (data.success) {
                    this.availableProviders = data.providers;
                    this.currentProviderInfo = {
                        providers: data.providers,
                        currentDefault: data.currentDefault
                    };
                }
            } catch (err) {
                console.error('Failed to load providers:', err);
                // Fallback to default providers
                this.availableProviders = ['xai', 'together'];
            }
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
                    this.saveSettings(); // Save settings after successful generation
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

        async loadHistory() {
            // Always load fresh from server
            try {
                const url = (window.APP_CONFIG?.appPrefix || '') + '/api/images/list';
                const response = await fetch(url);
                const data = await response.json();
                
                if (data.success && data.images) {
                    this.history = data.images.map(image => ({
                        image_url: `/storage/generated/${image.filename}`,
                        filename: image.filename,
                        prompt: image.prompt || 'Generated image',
                        created_at: image.created_at
                    }));
                } else {
                    this.history = [];
                }
            } catch (err) {
                console.error('Failed to load images:', err);
                this.history = [];
            }
        },

        addToHistory(result) {
            // Just reload from server to get fresh data
            this.loadHistory();
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
                    // Reload from server to get fresh data
                    this.loadHistory();

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
