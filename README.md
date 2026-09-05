# Open Roleplay Chat (ORC) 🤖🎭

> **The easiest way to chat, roleplay, and build AI agents on your own server. Clean, fast, and simple.**

ORC is a lightweight, beautiful web application for personal roleplaying and chatting with AI. You can create custom characters, give them unique personalities, and even let them write files or generate images for you.

For developers and advanced users, check the technical guide: **[Technical Documentation & Settings (DOCS.md)](DOCS.md)**.

---

## ✨ Features (Explained Simply)

- **🧠 Long-Term Memory**: Characters actually remember facts about you and the story. No more "forgetting" what you discussed 10 messages ago!
- **📚 Lorebooks (World Info)**: Attach deep background lore, faction details, or locations dynamically injected via keyword triggers (fully compatible with SillyTavern / Chub JSON formats).
- **💬 Real-Time Chat**: Messages stream in word-by-word, just like talking to a real person.
- **🎭 Visual Character Catalog**: Easily add, edit, or delete characters directly from your browser. Upload custom avatars, write scenarios, and customize behavior without editing code.
- **🎨 AI Image Generator**: Ask the AI to paint a picture, or generate images manually with direct aspect ratio controls.
- **🛠️ AI Tools (Agents)**: Give characters the ability to create text files or paint pictures in a safe sandbox folder.
- **📱 Telegram Bot Support**: Talk to Natalia or your custom assistants right inside Telegram (optional setup).

---

## 🚀 Quick Start (For Everyone)

Setting up Open Roleplay Chat takes less than 5 minutes. Just follow these steps:

### **1. Download and Install**
1. Download this project folder to your computer.
2. Open your terminal/command prompt in the project folder and run:
   ```bash
   npm install
   ```

### **2. Launch the App**
Start the local server by running:
   ```bash
   npm run dev
   ```

### **3. Setup in Your Browser**
1. Open your browser and go to: **`http://localhost:3000`**
2. **Step 1 (Settings)**: Enter your OpenRouter API key (you can get one at [openrouter.ai](https://openrouter.ai/)).
3. **Step 2 (Database Initialization)**: Click the **"INITIALIZE DATABASE"** button. This will automatically structure the application and create your characters.
4. **Log In**: Click **"GO TO LOGIN"** and log in using the default credentials:
   - **Email**: `admin@example.com`
   - **Password**: `12345678`

*Note: You can easily change this email and password in your Profile Settings once you log in!*

---

## 📸 Screenshots

<img width="1272" height="897" alt="Chat Interface" src="https://github.com/user-attachments/assets/7a397f6e-2ded-4652-a829-5cf3f42288b8" />

<img width="1271" height="898" alt="Characters Management" src="https://github.com/user-attachments/assets/f680bd62-7cdf-4513-80db-673113c58928" />

<img width="1267" height="898" alt="Image Generation Panel" src="https://github.com/user-attachments/assets/1f68cccc-1da8-42bc-a010-d04c8cff174b" />

---

## 🛠️ Advanced Settings & Development

Need to set up the Telegram webhook, edit environment variables, check the SQLite database schema, or contribute to code?

👉 Refer to **[DOCS.md](DOCS.md)** for complete technical details.

---

## ⭐ Support & Licensing

- Open Roleplay Chat is licensed under the permissive **MIT License**.
- If you run into issues, please report them on [GitHub Issues](https://github.com/nordevelopment/OpenRoleplayChat/issues).
- **If you enjoy using ORC, please give this repository a star! ⭐**
