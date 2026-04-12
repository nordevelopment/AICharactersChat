import { FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';
import { User } from '../models/User';

export async function userRoutes(server: FastifyInstance) {
    server.get('/api/me', { preHandler: [server.authenticate] }, async (request, reply) => {
        return { user: request.session.user };
    });

    server.post('/api/profile', { preHandler: [server.authenticate] }, async (request, reply) => {
        try {
            const { email, display_name, about, password } = request.body as any;
            const userId = request.session.user!.id;

            const updateData: any = {};
            if (email) {
                // Проверяем, что email не занят другим пользователем
                const existingUser = User.findByEmail(email);
                if (existingUser && existingUser.id !== userId) {
                    return reply.code(400).send({ error: 'Email already exists' });
                }
                updateData.email = email;
            }
            if (display_name) updateData.display_name = display_name;
            if (about !== undefined) updateData.about = about;
            if (password) {
                updateData.password = await bcrypt.hash(password, 10);
            }

            const updatedUser = User.update(userId, updateData);

            if (!updatedUser) {
                return reply.code(404).send({ error: 'User not found' });
            }

            // Обновляем сессию
            const userData = {
                id: updatedUser.id,
                email: updatedUser.email,
                display_name: updatedUser.display_name,
                about: updatedUser.about
            };
            request.session.user = userData;
            await request.session.save();

            return { success: true, user: userData };
        } catch (err) {
            server.log.error(err, 'Profile update error');
            return reply.code(500).send({ error: 'Internal server error' });
        }
    });
}
