import axios from 'axios';
import { config } from '../config/config';
import { getDB } from '../database/sqlite';

export interface MemorySearchResult {
    content: string;
    distance: number;
}

export class MemoryService {
    /**
     * Validate embedding dimensions and migrate if needed
     */
    async validateAndMigrate(logger?: any): Promise<void> {
        if (!config.aiEmbeddingModel) return;
        
        try {
            // Получаем размерность текущей модели
            const testEmbedding = await this.getEmbedding("dimension_check", logger);
            const currentDim = testEmbedding.length;
            
            const db = getDB();
            
            // Получаем размерность таблицы из schema
            const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE name='vec_character_memories'").get() as any;
            let tableDim = 0;
            
            if (tableInfo?.sql) {
                const match = tableInfo.sql.match(/float\[(\d+)\]/);
                if (match) {
                    tableDim = parseInt(match[1], 10);
                }
            }
            
            if (tableDim === 0) {
                // Таблица не существует или не найдена - создаём
                if (logger) {
                    logger.info({ dimension: currentDim }, '[MEMORY SERVICE] Creating vector table');
                } else {
                    console.log(`[MEMORY SERVICE] Creating vector table with dimension ${currentDim}`);
                }
                db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS vec_character_memories USING vec0(embedding float[${currentDim}]);`);
                return;
            }
            
            if (tableDim !== currentDim) {
                // Размерность не совпадает - пересоздаём таблицу и очищаем данные
                const logMsg = `Dimension mismatch: table=${tableDim}, model=${currentDim}. Recreating table.`;
                if (logger) {
                    logger.warn({ tableDim, currentDim }, `[MEMORY SERVICE] ${logMsg}`);
                } else {
                    console.warn(`[MEMORY SERVICE] ⚠️  ${logMsg}`);
                }
                
                // Удаляем старую таблицу и создаём новую
                db.exec('DROP TABLE IF EXISTS vec_character_memories;');
                db.exec(`CREATE VIRTUAL TABLE vec_character_memories USING vec0(embedding float[${currentDim}]);`);
                
                // Очищаем данные из основной таблицы
                db.exec('DELETE FROM character_memories;');
                
                if (logger) {
                    logger.info('[MEMORY SERVICE] Vector table recreated');
                } else {
                    console.log('[MEMORY SERVICE] ✅ Vector table recreated');
                }
            } else if (logger) {
                logger.info({ dimension: currentDim }, '[MEMORY SERVICE] Embedding dimensions verified');
            }
        } catch (error: any) {
            if (logger) {
                logger.error({ error: error.message }, '[MEMORY SERVICE] Validation failed');
            } else {
                console.error('[MEMORY SERVICE] ❌ Validation failed:', error.message);
            }
        }
    }

    /**
     * Get embeddings from OpenRouter
     */
    async getEmbedding(text: string, logger?: any): Promise<number[]> {
        if (!config.aiEmbeddingModel) {
            throw new Error('AI_EMBEDDING_MODEL is not configured. MemoryService is disabled.');
        }
        
        try {
            const response = await axios.post(config.apiUrl.replace('/chat/completions', '/embeddings'), {
                model: config.aiEmbeddingModel,
                input: text,
                encoding_format: 'float'
            }, {
                headers: {
                    'Authorization': `Bearer ${config.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            const embedding = response.data.data?.[0]?.embedding;
            if (!embedding) {
                throw new Error('No embedding returned from API');
            }
            return embedding;
        } catch (error: any) {
            const errorMsg = error.response?.data || error.message;
            if (logger) {
                logger.error({ error: errorMsg, text: text.substring(0, 100) }, '[MEMORY SERVICE] Embedding error');
            } else {
                console.error('[MEMORY SERVICE] Embedding error:', errorMsg);
            }
            throw error;
        }
    }

    /**
     * Add a new memory fact
     */
    async addMemory(userId: number, characterId: number, content: string, logger?: any): Promise<void> {
        const db = getDB();
        try {
            const embedding = await this.getEmbedding(content, logger);

            const transaction = db.transaction(() => {
                // 1. Insert into main table
                const stmt = db.prepare('INSERT INTO character_memories (user_id, character_id, content) VALUES (?, ?, ?)');
                const result = stmt.run(userId, characterId, content);
                const memoryId = result.lastInsertRowid; // better-sqlite3 rowid can be BigInt already

                // 2. Insert into vector table
                const vecStmt = db.prepare('INSERT INTO vec_character_memories (rowid, embedding) VALUES (?, ?)');
                // Явно используем BigInt, так как sqlite-vec v0.1.x требует этого для первичного ключа
                vecStmt.run(BigInt(memoryId as any), new Float32Array(embedding));
                
                return memoryId;
            });

            const memoryId = transaction();
            
            if (logger) {
                logger.info({ characterId, memoryId: Number(memoryId), content: content.substring(0, 50) + '...' }, '[MEMORY SERVICE] Fact saved and vectorized');
            }
        } catch (error: any) {
            if (logger) {
                logger.error({ 
                    message: error.message, 
                    code: error.code, 
                    content 
                }, '[MEMORY SERVICE] Failed to add memory');
            } else {
                console.error(`[MEMORY SERVICE] ❌ Failed to add memory: ${content}`, error);
            }
        }
    }

    /**
     * Delete all memories for user and character
     */
    async deleteMemories(userId: number, characterId: number, logger?: any): Promise<void> {
        const db = getDB();
        try {
            // Get memory IDs to delete from vector table
            const memories = db.prepare('SELECT id FROM character_memories WHERE user_id = ? AND character_id = ?').all(userId, characterId) as any[];
            
            const transaction = db.transaction(() => {
                // Delete from vector table
                for (const m of memories) {
                    db.prepare('DELETE FROM vec_character_memories WHERE rowid = ?').run(BigInt(m.id));
                }
                // Delete from main table
                db.prepare('DELETE FROM character_memories WHERE user_id = ? AND character_id = ?').run(userId, characterId);
            });
            
            transaction();
            
            if (logger) {
                logger.info({ userId, characterId, count: memories.length }, '[MEMORY SERVICE] Memories deleted');
            }
        } catch (error: any) {
            if (logger) {
                logger.error({ error: error.message }, '[MEMORY SERVICE] Delete failed');
            } else {
                console.error('[MEMORY SERVICE] ❌ Delete failed:', error.message);
            }
        }
    }

    /**
     * Search relevant memories
     */
    async searchMemories(userId: number, characterId: number, query: string, limit: number = 5, logger?: any): Promise<MemorySearchResult[]> {
        const db = getDB();
        try {
            const queryEmbedding = await this.getEmbedding(query, logger);
            
            // Оптимизированный запрос для sqlite-vec v0.1.x
            const stmt = db.prepare(`
                SELECT 
                    m.content,
                    v.distance
                FROM (
                    SELECT rowid, distance 
                    FROM vec_character_memories 
                    WHERE embedding MATCH ? 
                    AND k = 20
                ) v
                JOIN character_memories m ON v.rowid = m.id
                WHERE 
                    m.user_id = ? 
                    AND m.character_id = ?
                ORDER BY v.distance ASC
                LIMIT ?
            `);

            // Важно: параметры должны идти в порядке знаков вопроса в SQL
            const results = stmt.all(new Float32Array(queryEmbedding), userId, characterId, limit) as any[];
            
            if (results.length > 0 && logger) {
                logger.info({ query, count: results.length }, '[MEMORY SERVICE] Search results found');
                results.forEach(r => logger.info({ distance: r.distance, content: r.content }, '   - Memory match'));
            }

            return results.map(r => ({
                content: r.content,
                distance: r.distance
            }));
        } catch (error) {
            console.error('[MEMORY SERVICE] Search error:', error);
            return [];
        }
    }
}

export const memoryService = new MemoryService();
