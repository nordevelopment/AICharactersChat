import { FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';
import { User } from '../models/User';

export async function authRoutes(server: FastifyInstance) {
  server.post('/api/login', async (request, reply) => {
    try {
      const { email, password } = request.body as any;

      if (!email || !password) {
        return reply.code(400).send({ error: 'Email and password are required' });
      }

      const user = User.findByEmail(email);

      if (!user) {
        return reply.code(401).send({ error: 'Invalid email or password' });
      }

      const isMatch = await bcrypt.compare(password, user.password!);

      if (!isMatch) {
        return reply.code(401).send({ error: 'Invalid email or password' });
      }

      request.session.user = {
        id: user.id,
        email: user.email,
        display_name: user.display_name
      };

      await request.session.save();

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
}

