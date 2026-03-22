window.APP_CONFIG = {
    // If the project is in a subfolder, specify it here, for example '/aichatdev'
    // If it's in the root, leave the line empty ''
    appPrefix: '',

    // Path to API (calculated automatically)
    get apiBase() {
        return this.appPrefix + '/api';
    }
};
