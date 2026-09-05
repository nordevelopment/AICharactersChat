import type { FastifyInstance } from 'fastify';
import { config } from '../config/config.js';
import { isDatabaseInitialized } from '../database/sqlite.js';

export async function viewsRoutes(server: FastifyInstance) {
    // Login / Index page
    server.get('/', async (request, reply) => {
        if (request.session.user) {
            return reply.redirect('/characters');
        }
        return reply.view('index.ejs');
    });

    // Chat page
    server.get('/chat', async (request, reply) => {
        if (!request.session.user) {
            return reply.redirect('/');
        }
        return reply.view('chat.ejs');
    });

    // Characters catalog page
    server.get('/characters', async (request, reply) => {
        if (!request.session.user) {
            return reply.redirect('/');
        }
        return reply.view('characters.ejs');
    });

    // Add character page
    server.get('/characters/add', async (request, reply) => {
        if (!request.session.user) {
            return reply.redirect('/');
        }
        return reply.view('character-form.ejs', { editSlug: null });
    });

    // Edit character page
    server.get('/characters/edit/:slug', async (request, reply) => {
        if (!request.session.user) {
            return reply.redirect('/');
        }
        const { slug } = request.params as { slug: string };
        return reply.view('character-form.ejs', { editSlug: slug });
    });

    // Image generation page
    server.get('/image-gen', async (request, reply) => {
        if (!request.session.user) {
            return reply.redirect('/');
        }
        return reply.view('image-gen.ejs');
    });

    // User profile settings page
    server.get('/profile', async (request, reply) => {
        if (!request.session.user) {
            return reply.redirect('/');
        }
        return reply.view('profile.ejs');
    });

    // Lorebooks management page
    server.get('/lorebooks', async (request, reply) => {
        if (!request.session.user) {
            return reply.redirect('/');
        }
        return reply.view('lorebooks.ejs');
    });

    // System configuration settings page
    server.get('/settings', async (request, reply) => {
        if (config.apiKey && !request.session.user) {
            return reply.redirect('/');
        }
        return reply.view('settings.ejs', {
            isAuthenticated: !!request.session.user,
            hasApiKey: !!config.apiKey
        });
    });

    // Database Setup page
    server.get('/setup-db', async (request, reply) => {
        // If already initialized and not logged in, redirect to login
        if (isDatabaseInitialized() && !request.session.user) {
            return reply.redirect('/');
        }
        return reply.view('setup-db.ejs', {
            isAuthenticated: !!request.session.user,
            isInitialized: isDatabaseInitialized()
        });
    });
}
