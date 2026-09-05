document.addEventListener('alpine:init', () => {
    Alpine.data('lorebookApp', () => ({
        lorebooks: [],
        activeLorebook: null,

        showLorebookModal: false,
        lorebookForm: {
            id: null,
            name: '',
            description: ''
        },

        showEntryModal: false,
        entryForm: {
            id: null,
            comment: '',
            keysInput: '',
            content: '',
            is_active: true
        },

        showImportModal: false,
        importLoading: false,

        async init() {
            if (typeof this.checkAuth === 'function') {
                if (!(await this.checkAuth())) return;
            }
            await this.loadLorebooks();
        },

        async loadLorebooks() {
            const apiBase = window.APP_CONFIG?.apiBase || '/api';
            try {
                const res = await fetch(`${apiBase}/lorebooks`);
                if (res.ok) {
                    this.lorebooks = await res.json();
                    if (this.activeLorebook) {
                        const updated = this.lorebooks.find(l => l.id === this.activeLorebook.id);
                        if (updated) {
                            await this.selectLorebook(updated);
                        } else {
                            this.activeLorebook = null;
                        }
                    } else if (this.lorebooks.length > 0) {
                        await this.selectLorebook(this.lorebooks[0]);
                    }
                }
            } catch (err) {
                console.error('[LOREBOOK APP] Failed to load lorebooks:', err);
            }
        },

        async selectLorebook(lb) {
            const apiBase = window.APP_CONFIG?.apiBase || '/api';
            try {
                const res = await fetch(`${apiBase}/lorebooks/${lb.id}`);
                if (res.ok) {
                    this.activeLorebook = await res.json();
                }
            } catch (err) {
                console.error('[LOREBOOK APP] Failed to select lorebook:', err);
            }
        },

        openCreateLorebookModal() {
            this.lorebookForm = { id: null, name: '', description: '' };
            this.showLorebookModal = true;
        },

        openEditLorebookModal(lb) {
            this.lorebookForm = { id: lb.id, name: lb.name, description: lb.description || '' };
            this.showLorebookModal = true;
        },

        async saveLorebook() {
            if (!this.lorebookForm.name || !this.lorebookForm.name.trim()) return;

            const apiBase = window.APP_CONFIG?.apiBase || '/api';
            const isEdit = Boolean(this.lorebookForm.id);
            const url = isEdit ? `${apiBase}/lorebooks/${this.lorebookForm.id}` : `${apiBase}/lorebooks`;
            const method = isEdit ? 'PUT' : 'POST';

            try {
                const res = await fetch(url, {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: this.lorebookForm.name.trim(),
                        description: this.lorebookForm.description ? this.lorebookForm.description.trim() : ''
                    })
                });

                if (res.ok) {
                    const savedLb = await res.json();
                    this.showLorebookModal = false;
                    await this.loadLorebooks();
                    if (savedLb && savedLb.id) {
                        await this.selectLorebook(savedLb);
                    }
                } else {
                    const err = await res.json();
                    alert('Error: ' + (err.error || 'Failed to save lorebook'));
                }
            } catch (err) {
                console.error('[LOREBOOK APP] Save lorebook error:', err);
                alert('Failed to save lorebook');
            }
        },

        async deleteLorebook(id) {
            if (!confirm('Are you sure you want to delete this lorebook and all its entries?')) return;

            const apiBase = window.APP_CONFIG?.apiBase || '/api';
            try {
                const res = await fetch(`${apiBase}/lorebooks/${id}`, { method: 'DELETE' });
                if (res.ok) {
                    if (this.activeLorebook?.id === id) {
                        this.activeLorebook = null;
                    }
                    await this.loadLorebooks();
                } else {
                    const err = await res.json();
                    alert('Error: ' + (err.error || 'Failed to delete lorebook'));
                }
            } catch (err) {
                alert('Failed to delete lorebook');
            }
        },

        openCreateEntryModal() {
            if (!this.activeLorebook) return;
            this.entryForm = {
                id: null,
                comment: '',
                keysInput: '',
                content: '',
                is_active: true
            };
            this.showEntryModal = true;
        },

        openEditEntryModal(entry) {
            this.entryForm = {
                id: entry.id,
                comment: entry.comment || '',
                keysInput: Array.isArray(entry.keys) ? entry.keys.join(', ') : '',
                content: entry.content || '',
                is_active: Boolean(entry.is_active)
            };
            this.showEntryModal = true;
        },

        async saveEntry() {
            if (!this.activeLorebook) return;
            if (!this.entryForm.keysInput || !this.entryForm.content) return;

            const apiBase = window.APP_CONFIG?.apiBase || '/api';
            const isEdit = Boolean(this.entryForm.id);
            const url = isEdit
                ? `${apiBase}/lorebooks/entries/${this.entryForm.id}`
                : `${apiBase}/lorebooks/${this.activeLorebook.id}/entries`;
            const method = isEdit ? 'PUT' : 'POST';

            try {
                const res = await fetch(url, {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        comment: this.entryForm.comment ? this.entryForm.comment.trim() : '',
                        keys: this.entryForm.keysInput,
                        content: this.entryForm.content.trim(),
                        is_active: this.entryForm.is_active
                    })
                });

                if (res.ok) {
                    this.showEntryModal = false;
                    await this.selectLorebook(this.activeLorebook);
                    await this.loadLorebooks();
                } else {
                    const err = await res.json();
                    alert('Error: ' + (err.error || 'Failed to save entry'));
                }
            } catch (err) {
                console.error('[LOREBOOK APP] Save entry error:', err);
                alert('Failed to save entry');
            }
        },

        async deleteEntry(entryId) {
            if (!confirm('Are you sure you want to delete this entry?')) return;

            const apiBase = window.APP_CONFIG?.apiBase || '/api';
            try {
                const res = await fetch(`${apiBase}/lorebooks/entries/${entryId}`, { method: 'DELETE' });
                if (res.ok) {
                    await this.selectLorebook(this.activeLorebook);
                    await this.loadLorebooks();
                } else {
                    const err = await res.json();
                    alert('Error: ' + (err.error || 'Failed to delete entry'));
                }
            } catch (err) {
                alert('Failed to delete entry');
            }
        },

        exportLorebook(id) {
            const apiBase = window.APP_CONFIG?.apiBase || '/api';
            window.location.href = `${apiBase}/lorebooks/${id}/export`;
        },

        openImportModal() {
            this.showImportModal = true;
        },

        async importLorebookFile() {
            const fileInput = document.getElementById('importJsonFileInput');
            if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
                alert('Please select a JSON file to import');
                return;
            }

            const file = fileInput.files[0];
            const formData = new FormData();
            formData.append('file', file);

            this.importLoading = true;
            const apiBase = window.APP_CONFIG?.apiBase || '/api';

            try {
                const res = await fetch(`${apiBase}/lorebooks/import`, {
                    method: 'POST',
                    body: formData
                });

                if (res.ok) {
                    const importedLb = await res.json();
                    this.showImportModal = false;
                    await this.loadLorebooks();
                    if (importedLb && importedLb.id) {
                        await this.selectLorebook(importedLb);
                    }
                } else {
                    const err = await res.json();
                    alert('Error: ' + (err.error || 'Import failed'));
                }
            } catch (err) {
                console.error('[LOREBOOK APP] Import error:', err);
                alert('Failed to import lorebook JSON file');
            } finally {
                this.importLoading = false;
            }
        }
    }));
});
