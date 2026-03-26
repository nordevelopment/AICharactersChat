import { FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';
import { dbRepo } from '../database/sqlite';

export async function authRoutes(server: FastifyInstance) {
  server.post('/api/login', async (request, reply) => {
    try {
      const { email, password } = request.body as any;

      if (!email || !password) {
        return reply.code(400).send({ error: 'Email and password are required' });
      }

      // 1. Ищем пользователя в БД
      const user = dbRepo.getUserByEmail(email);

      if (!user) {
        // Даже если пользователя нет, лучше сказать общую ошибку для безопасности (чтобы не чекать емейлы)
        return reply.code(401).send({ error: 'Invalid email or password' });
      }

      // 2. Сравниваем введенный пароль с захешированным в БД
      const isMatch = await bcrypt.compare(password, user.password!);

      if (!isMatch) {
        return reply.code(401).send({ error: 'Invalid email or password' });
      }

      // 3. Сохраняем пользователя в сессию (как в Laravel!)
      request.session.user = {
        id: user.id,
        email: user.email,
        display_name: user.display_name
      };

      // 4. Отдаем успех
      return {
        success: true,
        user: { id: user.id, email: user.email, display_name: user.display_name }
      };
    } catch (err) {
      server.log.error(err, 'Login error');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  server.post('/api/logout', async (request, reply) => {
    await request.session.destroy();
    return { success: true };
  });

  server.get('/api/me', { preHandler: [server.authenticate] }, async (request, reply) => {
    return { user: request.session.user };
  });

  server.post('/api/profile', { preHandler: [server.authenticate] }, async (request, reply) => {
    try {
      const { display_name, password } = request.body as any;
      const userId = request.session.user!.id;

      const updateData: any = {};
      if (display_name) updateData.display_name = display_name;
      if (password) {
        updateData.password = await bcrypt.hash(password, 10);
      }

      const updatedUser = dbRepo.updateUser(userId, updateData);

      if (!updatedUser) {
        return reply.code(404).send({ error: 'User not found' });
      }

      // Обновляем сессию
      const userData = {
        id: updatedUser.id,
        email: updatedUser.email,
        display_name: updatedUser.display_name
      };
      request.session.user = userData;

      return { success: true, user: userData };
    } catch (err) {
      server.log.error(err, 'Profile update error');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}
