const fastify = require('fastify')({ 
  logger: true 
});

// Register static files
fastify.register(require('@fastify/static'), {
  root: require('path').join(__dirname, 'public'),
  prefix: '/public/',
});

// Register CSS files from /tmp/css (for Docker development)
fastify.register(require('@fastify/static'), {
  root: '/tmp/css',
  prefix: '/public/css/',
  decorateReply: false
});

// Simple Pong game route
fastify.get('/', async (request, reply) => {
  return reply.sendFile('pong.html');
});

// Start the server
const start = async () => {
  try {
    const port = process.env.PORT || 3000;
    const host = process.env.HOST || '0.0.0.0';
    
    await fastify.listen({ port, host });
    console.log(`🚀 Server running at http://localhost:${port}`);
    console.log(`🎮 Pong game available at http://localhost:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
