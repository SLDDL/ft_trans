'use strict'

const OAuthService = require('../services/oauth');

module.exports = async function (fastify, opts) {
  const oauthService = new OAuthService();

  fastify.get('/healthcheck', async function (request, reply) {
    return { status: 'ok' }
  })

  // OAuth initiation - redirects to provider
  fastify.get('/oauth/:provider', async function (request, reply) {
    const { provider } = request.params;
    
    try {
      const state = oauthService.generateState();
      const authUrl = oauthService.buildAuthUrl(provider, state);
      
      // Store state in session/cookie for verification (simplified for demo)
      reply.setCookie('oauth_state', state, { 
        httpOnly: true, 
        secure: false, // Set to true in production with HTTPS
        maxAge: 600000 // 10 minutes
      });
      
      return reply.redirect(authUrl);
    } catch (error) {
      return reply.code(400).send({ error: error.message });
    }
  })

  // OAuth callback - handles provider response
  fastify.get('/oauth/:provider/callback', async function (request, reply) {
    const { provider } = request.params;
    const { code, state, error } = request.query;
    
    // Check if there was an OAuth error
    if (error) {
      return reply.redirect(`${process.env.FRONTEND_URL}/?error=${error}`);
    }
    
    // Verify state parameter (simplified for demo)
    const storedState = request.cookies.oauth_state;
    if (!storedState || storedState !== state) {
      return reply.redirect(`${process.env.FRONTEND_URL}/?error=invalid_state`);
    }

    try {
      // Exchange code for access token
      const tokens = await oauthService.exchangeCodeForTokens(provider, code);
      console.log('Tokens received:', { access_token: tokens.access_token ? 'present' : 'missing' });
      
      // Get user info from provider
      const userInfo = await oauthService.getUserInfo(provider, tokens.access_token);
      console.log('User info received:', { username: userInfo.username, email: userInfo.email });
      
      // Create or update user
      const user = oauthService.createOrUpdateUser(userInfo);
      
      // Store tokens for potential revocation
      oauthService.storeUserTokens(user.id, provider, tokens);
      
      // Generate JWT token
      const authToken = oauthService.generateJWT(user);
      
      // Clear OAuth state cookie
      reply.clearCookie('oauth_state');
      
      // Redirect to frontend with token
      return reply.redirect(`${process.env.FRONTEND_URL}/?token=${authToken}`);
    } catch (error) {
      console.error('OAuth callback error:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        provider: provider,
        hasCode: !!code,
        hasState: !!state
      });
      return reply.redirect(`${process.env.FRONTEND_URL}/?error=oauth_failed`);
    }
  })

  // Token validation endpoint
  fastify.get('/validate', async function (request, reply) {
    const authHeader = request.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'No token provided' });
    }
    
    const token = authHeader.substring(7);
    
    try {
      const decoded = oauthService.verifyJWT(token);
      return { valid: true, user: decoded };
    } catch (error) {
      return reply.code(401).send({ error: 'Invalid token' });
    }
  })

  // Get current user info
  fastify.get('/me', async function (request, reply) {
    const authHeader = request.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'No token provided' });
    }
    
    const token = authHeader.substring(7);
    
    try {
      const user = oauthService.verifyJWT(token);
      return { user };
    } catch (error) {
      return reply.code(401).send({ error: 'Invalid token' });
    }
  })

  // Logout endpoint
  fastify.post('/logout', async function (request, reply) {
    const authHeader = request.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      try {
        // Verify and decode the JWT to get user info
        const user = oauthService.verifyJWT(token);
        
        // Revoke OAuth tokens with the provider
        const revocationResult = await oauthService.revokeTokens(user.id);
        
        if (revocationResult.success) {
          return { 
            message: 'Logged out successfully and tokens revoked',
            revoked: true 
          };
        } else {
          return { 
            message: 'Logged out successfully but token revocation failed',
            revoked: false,
            reason: revocationResult.reason
          };
        }
      } catch (error) {
        console.error('Logout error:', error);
        return { 
          message: 'Logged out successfully but token cleanup failed',
          revoked: false 
        };
      }
    }
    
    // No token provided, just confirm logout
    return { message: 'Logged out successfully' };
  })

  // Manual token revocation endpoint
  fastify.post('/revoke', async function (request, reply) {
    const authHeader = request.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'No token provided' });
    }
    
    const token = authHeader.substring(7);
    
    try {
      const user = oauthService.verifyJWT(token);
      const revocationResult = await oauthService.revokeTokens(user.id);
      
      return {
        success: revocationResult.success,
        message: revocationResult.success 
          ? 'Tokens revoked successfully' 
          : `Token revocation failed: ${revocationResult.reason}`
      };
    } catch (error) {
      return reply.code(401).send({ error: 'Invalid token' });
    }
  })
}
