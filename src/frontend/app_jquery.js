$(document).ready(function () {
    // Проверка авторизации
    const userData = localStorage.getItem('user');
    if (!userData) {
        window.location.href = '/';
        return;
    }
    const user = JSON.parse(userData);
    $('#user-display-name').text(user.display_name);

    window.logout = function () {
        localStorage.removeItem('user');
        window.location.href = '/';
    };

    // Sidebar Toggle for Mobile
    $('#sidebar-toggle').click(function () {
        $('#sidebar').toggleClass('active');
    });

    // Close sidebar when clicking outside on mobile
    $(document).click(function (e) {
        if ($(window).width() <= 768) {
            if (!$(e.target).closest('#sidebar, #sidebar-toggle').length) {
                $('#sidebar').removeClass('active');
            }
        }
    });

    const chatWindow = $('#chat-window');
    const messageInput = $('#message-input');
    const sendButton = $('#send-button');
    const characterList = $('#character-list');
    const characterNameHeader = $('#character-name');
    const characterAvatar = $('#character-avatar');

    // Новые элементы для изображений
    const imageInput = $('#image-input');
    const imagePreviewContainer = $('#image-preview-container');
    const imagePreview = $('#image-preview');

    let currentCharacterId = null;
    let selectedImageBase64 = null;

    // Настройка marked с подсветкой синтаксиса
    marked.setOptions({
        highlight: function (code, lang) {
            if (lang && hljs.getLanguage(lang)) {
                return hljs.highlight(code, { language: lang }).value;
            }
            return hljs.highlightAuto(code).value;
        },
        breaks: true
    });

    function toggleInput(disabled) {
        const isInputDisabled = disabled || !currentCharacterId;
        messageInput.prop('disabled', isInputDisabled);
        sendButton.prop('disabled', isInputDisabled);
        imageInput.prop('disabled', isInputDisabled);
        if (!isInputDisabled) {
            messageInput.focus();
        }
    }

    function appendMessage(role, content, isHtml = false, image = null) {
        const messageClass = role === 'user' ? 'user-message' : 'ai-message';
        let contentHtml = '';

        if (image) {
            contentHtml += `<div class="mb-2 chat-img"><img src="${image}"></div>`;
        }

        if (content) {
            if (isHtml) {
                contentHtml += content;
            } else {
                console.log(content);
                console.log(marked.parse(content));
                contentHtml += DOMPurify.sanitize(marked.parse(content));
            }
        }

        chatWindow.append(`<div class="message ${messageClass}">${contentHtml}</div>`);
        chatWindow.scrollTop(chatWindow[0].scrollHeight);
    }

    // Обработка выбора изображения
    imageInput.on('change', function (e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (event) {
                selectedImageBase64 = event.target.result;
                imagePreview.attr('src', selectedImageBase64);
                imagePreviewContainer.show();
                chatWindow.scrollTop(chatWindow[0].scrollHeight);
            };
            reader.readAsDataURL(file);
        }
    });

    window.clearImageSelection = function () {
        selectedImageBase64 = null;
        imageInput.val('');
        imagePreviewContainer.hide();
    };

    async function loadCharacters() {
        try {
            const response = await fetch('/api/characters');
            const characters = await response.json();

            characterList.empty();
            characters.forEach(char => {
                const avatarContent = char.avatar
                    ? `<img src="${char.avatar}" style="width:30px; height:30px; border-radius:50%; margin-right:10px; object-fit:cover;">`
                    : `<div class="avatar-icon">${char.name[0]}</div>`;

                const charItem = $(`
                    <div class="character-item" data-id="${char.id}">
                        <div class="d-flex align-items-center">
                            ${avatarContent}
                            <div style="flex-grow:1; overflow:hidden;">
                                <span class="character-name">${char.name}</span>            
                            </div>
                        </div>
                    </div>
                `);

                charItem.click(() => selectCharacter(char));
                characterList.append(charItem);
            });

            if (characters.length > 0 && !currentCharacterId) {
                selectCharacter(characters[0]);
            }
        } catch (err) {
            console.error("Failed to load characters:", err);
        }
    }

    async function selectCharacter(character) {
        if (currentCharacterId === character.id) return;

        currentCharacterId = character.id;
        clearImageSelection();

        $('.character-item').removeClass('active');
        $(`.character-item[data-id="${character.id}"]`).addClass('active');
        characterNameHeader.text(character.name);

        if (character.avatar) {
            characterAvatar.attr('src', character.avatar);
            characterAvatar.show();
        } else {
            // Если аватарки нет, используем заглушку с первой буквой
            const svgAvatar = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%2300f2ff'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='central' text-anchor='middle' font-family='Outfit' font-size='50' fill='%2305070a'%3E${character.name[0].toUpperCase()}%3C/text%3E%3C/svg%3E`;
            characterAvatar.attr('src', svgAvatar);
        }

        // Hide sidebar on mobile after selection
        if ($(window).width() <= 768) {
            $('#sidebar').removeClass('active');
        }

        chatWindow.empty();
        toggleInput(true);

        try {
            const response = await fetch(`/api/history?character_id=${character.id}`);
            const history = await response.json();

            if (history.length === 0) {
                if (character.first_message) {
                    appendMessage('ai', character.first_message);
                }
            } else {
                history.forEach(msg => {
                    appendMessage(msg.role, msg.content);
                });
            }
        } catch (err) {
            console.error("Failed to load history:", err);
            appendMessage('ai', 'Error loading history.');
        } finally {
            toggleInput(false);
        }
    }

    async function streamResponse(message, imageBase64) {
        let aiMessageContent = "";
        let aiMessageElement = null;
        let charQueue = [];
        let isTyping = false;

        function processQueue() {
            if (charQueue.length > 0) {
                isTyping = true;

                // Обработка пачкой если очередь большая, чтобы сократить число перерендеров
                const batchSize = Math.max(1, Math.floor(charQueue.length / 5));
                const nextChars = charQueue.splice(0, batchSize).join('');
                aiMessageContent += nextChars;

                const cleanHtml = DOMPurify.sanitize(marked.parse(aiMessageContent));
                aiMessageElement.html(cleanHtml);

                // Убрал scrollTop на каждом символе, делаем только если нужно
                const isAtBottom = chatWindow[0].scrollHeight - chatWindow.scrollTop() <= chatWindow.outerHeight() + 100;
                if (isAtBottom) {
                    chatWindow.scrollTop(chatWindow[0].scrollHeight);
                }

                const delay = charQueue.length > 50 ? 2 : 15;
                setTimeout(processQueue, delay);
            } else {
                isTyping = false;
            }
        }

        try {
            const url = `/api/chat`;
            const payload = {
                message: message,
                character_id: currentCharacterId,
                image: imageBase64
            };

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error('Network response was not ok');

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.substring(6));

                            if (data.done) {
                                toggleInput(false);
                                return;
                            }

                            if (data.reply) {
                                $('.typing-indicator').remove();

                                if (aiMessageElement === null) {
                                    chatWindow.append(`<div class="message ai-message"><div class="content"></div></div>`);
                                    aiMessageElement = chatWindow.children().last().find('.content');
                                }

                                charQueue.push(...data.reply.split(''));
                                if (!isTyping) processQueue();
                            }

                            if (data.error) throw new Error(data.error);
                        } catch (e) { }
                    }
                }
            }
        } catch (err) {
            console.error("Stream failed:", err);
            $('.typing-indicator').remove();
            toggleInput(false);
            if (aiMessageContent === "") {
                appendMessage('ai', 'Error: Could not get a response from AI.', false);
            }
        }
    }

    sendButton.click(function () {
        const message = messageInput.val().trim();
        const imageToUpload = selectedImageBase64;

        if ((message || imageToUpload) && currentCharacterId) {
            appendMessage('user', message, false, imageToUpload);
            messageInput.val('').css('height', '40px'); // Сброс высоты
            clearImageSelection();
            toggleInput(true);

            chatWindow.append('<div class="message ai-message typing-indicator">Typing...</div>');
            chatWindow.scrollTop(chatWindow[0].scrollHeight);

            streamResponse(message, imageToUpload);
        }
    });

    // Обработка клавиш: Enter для отправки, Shift/Ctrl+Enter для новой строки
    messageInput.on('keydown', function (e) {
        if (e.which === 13 && !e.shiftKey && !e.ctrlKey) {
            e.preventDefault();
            sendButton.click();
        }
    });

    // Авто-изменение высоты textarea
    messageInput.on('input', function () {
        this.style.height = '40px';
        const newHeight = Math.min(this.scrollHeight, 200);
        this.style.height = newHeight + 'px';
    });

    $('#clear-history').click(function () {
        if (currentCharacterId && confirm('Clear history for this character?')) {
            $.ajax({
                url: `/api/history/${currentCharacterId}`,
                method: 'DELETE',
                success: function () {
                    chatWindow.empty();
                    loadCharacters();
                }
            });
        }
    });

    loadCharacters();
});
