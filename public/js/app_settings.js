document.addEventListener('alpine:init', () => {
    Alpine.data('systemSettingsApp', () => ({
        loading: false,
        message: null,
        hasApiKey: true,
        
        form: {
            apiUrl: 'https://openrouter.ai/api/v1/chat/completions',
            aiDefaultModel: 'qwen/qwen3.5-flash-02-23',
            apiKey: '',
            
            togetherApiKey: '',
            togetherImageModel: 'black-forest-labs/FLUX.2-dev',
            xaiApiKey: '',
            
            telegramBotToken: '',
            telegramWebhookUrl: '',
            telegramWebhookSecret: '',
            telegramAdminUsers: '',
            telegramAllowedUsers: '',
            telegramEnableImages: false,
            telegramEnableVoice: false,
            telegramDefaultCharacterId: 1,
            telegramRateLimitPerUser: 30,
            telegramRateLimitWindow: 60,
            
            port: 3000,
            host: '0.0.0.0',
            jwtSecret: '',
            loggingDebug: false,
            debugRequests: false,
            debugAi: false,
        },
        
        placeholders: {
            apiKey: 'Enter API Key',
            togetherApiKey: 'Enter Together AI API Key',
            xaiApiKey: 'Enter X.AI API Key',
            telegramBotToken: 'Enter Bot Token',
            telegramWebhookSecret: 'Enter Webhook Secret',
            jwtSecret: 'Enter Session Secret',
        },

        async initSettings() {
            this.loading = true;
            this.message = null;
            try {
                const apiBase = window.APP_CONFIG?.apiBase || '/api';
                const res = await fetch(`${apiBase}/settings`);
                if (res.ok) {
                    const data = await res.json();
                    
                    this.hasApiKey = data.hasApiKey;
                    
                    // Values
                    this.form.apiUrl = data.apiUrl;
                    this.form.aiDefaultModel = data.aiDefaultModel;
                    this.form.togetherImageModel = data.togetherImageModel;
                    this.form.telegramWebhookUrl = data.telegramWebhookUrl;
                    this.form.telegramAdminUsers = data.telegramAdminUsers;
                    this.form.telegramAllowedUsers = data.telegramAllowedUsers;
                    this.form.telegramEnableImages = data.telegramEnableImages;
                    this.form.telegramEnableVoice = data.telegramEnableVoice;
                    this.form.telegramDefaultCharacterId = data.telegramDefaultCharacterId;
                    this.form.telegramRateLimitPerUser = data.telegramRateLimitPerUser;
                    this.form.telegramRateLimitWindow = data.telegramRateLimitWindow;
                    this.form.port = data.port;
                    this.form.host = data.host;
                    this.form.loggingDebug = data.loggingDebug;
                    this.form.debugRequests = data.debugRequests;
                    this.form.debugAi = data.debugAi;
                    
                    // Clear keys input, and show placeholders if configured
                    this.form.apiKey = '';
                    this.placeholders.apiKey = data.hasApiKey ? '****** (configured)' : 'Enter OpenRouter API Key';
                    
                    this.form.togetherApiKey = '';
                    this.placeholders.togetherApiKey = data.hasTogetherApiKey ? '****** (configured)' : 'Enter Together AI API Key';
                    
                    this.form.xaiApiKey = '';
                    this.placeholders.xaiApiKey = data.hasXaiApiKey ? '****** (configured)' : 'Enter X.AI API Key';
                    
                    this.form.telegramBotToken = '';
                    this.placeholders.telegramBotToken = data.hasTelegramBotToken ? '****** (configured)' : 'Enter Bot Token';
                    
                    this.form.telegramWebhookSecret = '';
                    this.placeholders.telegramWebhookSecret = data.hasTelegramWebhookSecret ? '****** (configured)' : 'Enter Webhook Secret';
                    
                    this.form.jwtSecret = '';
                    this.placeholders.jwtSecret = data.hasJwtSecret ? '****** (configured)' : 'Enter Session Secret';
                } else {
                    this.message = { type: 'error', text: 'Failed to fetch settings from server.' };
                }
            } catch (err) {
                console.error('Error fetching settings:', err);
                this.message = { type: 'error', text: 'Network error occurred while fetching settings.' };
            } finally {
                this.loading = false;
            }
        },

        async saveSettings() {
            this.loading = true;
            this.message = null;
            
            const payload = {};
            const clean = (val) => {
                if (typeof val === 'string') {
                    const trimmed = val.trim();
                    return trimmed === '' ? undefined : trimmed;
                }
                return val;
            };

            // Only add fields to payload if they are changed or not masked secrets
            const addSecret = (payloadKey, formVal) => {
                const val = clean(formVal);
                if (val !== undefined) {
                    payload[payloadKey] = val;
                }
            };

            const addField = (payloadKey, formVal) => {
                payload[payloadKey] = formVal;
            };

            addSecret('apiKey', this.form.apiKey);
            addField('apiUrl', this.form.apiUrl);
            addField('aiDefaultModel', this.form.aiDefaultModel);
            
            addSecret('togetherApiKey', this.form.togetherApiKey);
            addField('togetherImageModel', this.form.togetherImageModel);
            addSecret('xaiApiKey', this.form.xaiApiKey);
            
            addSecret('telegramBotToken', this.form.telegramBotToken);
            addField('telegramWebhookUrl', this.form.telegramWebhookUrl);
            addSecret('telegramWebhookSecret', this.form.telegramWebhookSecret);
            addField('telegramAdminUsers', this.form.telegramAdminUsers);
            addField('telegramAllowedUsers', this.form.telegramAllowedUsers);
            addField('telegramEnableImages', this.form.telegramEnableImages);
            addField('telegramEnableVoice', this.form.telegramEnableVoice);


            try {
                const apiBase = window.APP_CONFIG?.apiBase || '/api';
                const response = await fetch(`${apiBase}/settings`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                const result = await response.json();
                if (result.success) {
                    this.message = { type: 'success', text: 'Configuration saved successfully!' };
                    setTimeout(() => {
                        const appPrefix = window.APP_CONFIG?.appPrefix || '';
                        window.location.href = appPrefix + '/';
                    }, 1000);
                } else {
                    this.message = { type: 'error', text: result.error || 'Failed to save settings' };
                }
            } catch (err) {
                console.error('Error saving settings:', err);
                this.message = { type: 'error', text: 'Network error occurred while saving settings.' };
            } finally {
                this.loading = false;
            }
        }
    }));
});
