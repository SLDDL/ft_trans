'use strict'

const OAuthService = require('../services/oauth');
const UserService = require('../services/user');
const jwt = require('jsonwebtoken');

// Define consistent cookie options
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true, // Always true since we're behind HTTPS nginx proxy
  sameSite: 'lax',
  path: '/'
};

module.exports = async function (fastify, opts) {
  const userService = new UserService();
  const oauthService = new OAuthService(userService);

  fastify.get('/auth/healthcheck', async function (request, reply) {
    return { status: 'ok' }
  })

  // Email/Password Registration
  fastify.post('/auth/register', async function (request, reply) {
    const { email, password, username } = request.body;

    if (!email || !password || !username) {
      return reply.code(400).send({ error: 'Email, password, and username are required' });
    }

    // Basic validation
    if (password.length < 8) {
      return reply.code(400).send({ error: 'Password must be at least 8 characters long' });
    }

    if (!email.includes('@')) {
      return reply.code(400).send({ error: 'Invalid email format' });
    }

    try {
      const user = await userService.createUser({ email, password, username });
      const token = userService.generateJWT(user);
      
      return { 
        user: user,
        token: token,
        message: 'User registered successfully'
      };
    } catch (error) {
      return reply.code(400).send({ error: error.message });
    }
  })

  // Email/Password Login
  fastify.post('/auth/login', async function (request, reply) {
    const { email, password, twoFactorCode } = request.body;

    if (!email || !password) {
      return reply.code(400).send({ error: 'Email and password are required' });
    }

    try {
      const user = await userService.authenticateUser(email, password);
      
      // Check if user has 2FA enabled
      if (userService.requires2FA(user)) {
        if (!twoFactorCode) {
          // Send temporary token that requires 2FA verification
          const tempToken = userService.generateTempJWT(user);
          return reply.code(200).send({ 
            requiresTwoFactor: true,
            tempToken: tempToken,
            message: 'Please provide your 2FA code'
          });
        }

        // Verify 2FA code
        try {
          await userService.verify2FA(user.id, twoFactorCode);
        } catch (error) {
          return reply.code(401).send({ error: '2FA verification failed: ' + error.message });
        }
      }

      const token = userService.generateJWT(user, true);
      
      return { 
        user: user,
        token: token,
        message: 'Login successful'
      };
    } catch (error) {
      return reply.code(401).send({ error: error.message });
    }
  })

  // OAuth initiation - redirects to provider
  fastify.get('/auth/oauth/:provider', async function (request, reply) {
    const { provider } = request.params;
    
    try {
      const state = oauthService.generateState();
      
      // Check if user is authenticated for linking
      const authHeader = request.headers.authorization;
      const tokenParam = request.query.token; // Fallback for frontend
      let isAuthenticated = false;
      let userId = null;
      
      // Try header first, then query parameter
      let token = null;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      } else if (tokenParam) {
        token = tokenParam;
      }
      
      if (token) {
        try {
          const userData = userService.verifyJWT(token);
          isAuthenticated = true;
          userId = userData.id;
        } catch (error) {
          // Token invalid, proceed as guest
        }
      }
      
      // ONLY allow OAuth if user is authenticated (for linking) OR if user is unauthenticated but provider exists
      if (!isAuthenticated) {
        // For unauthenticated users, we'll handle this in the callback
        // but we need to set up the state properly
      }
      
      const authUrl = oauthService.buildAuthUrl(provider, state);
      
      // Store state for verification
      reply.setCookie('oauth_state', state, { 
        ...COOKIE_OPTIONS,
        maxAge: 600000 // 10 minutes
      });
      
      // Store if this is for linking (authenticated user)
      if (isAuthenticated) {
        reply.setCookie('oauth_link_user', userId, {
          ...COOKIE_OPTIONS,
          maxAge: 600000 // 10 minutes
        });
      }
      
      return reply.redirect(authUrl);
    } catch (error) {
      return reply.code(400).send({ error: error.message });
    }
  })

  // OAuth callback - handles provider response
  fastify.get('/auth/oauth/:provider/callback', async function (request, reply) {
    const { provider } = request.params;
    const { code, state, error } = request.query;
    
    console.log('=== OAuth callback received ===');
    console.log('Provider:', provider);
    console.log('Has code:', !!code);
    console.log('Has state:', !!state);
    console.log('Error:', error);
    
    // Check if there was an OAuth error
    if (error) {
      return reply.redirect(`${process.env.OAUTH_CALLBACK_URL || 'https://localhost:8443'}/?error=${error}`);
    }
    
    // Verify state parameter
    const storedState = request.cookies.oauth_state;
    reply.clearCookie('oauth_state', COOKIE_OPTIONS);
    if (!storedState || storedState !== state) {
      console.log('State mismatch:', { stored: storedState, received: state });
      return reply.redirect(`${process.env.OAUTH_CALLBACK_URL || 'https://localhost:8443'}/?error=invalid_state`);
    }

    try {
      // Exchange code for access token
      const tokens = await oauthService.exchangeCodeForTokens(provider, code);
      console.log('Token exchange successful');
      
      // Get user info from provider
      const userInfo = await oauthService.getUserInfo(provider, tokens.access_token);
      console.log('User info:', { providerId: userInfo.providerId, username: userInfo.username });
      
      // Check if this provider account is linked to ANY user
      const existingUser = oauthService.getUserByProvider(provider, userInfo.providerId);
      console.log('Existing user found:', !!existingUser);
      
      // Check if this is a LINKING request (user provided a link token)
      const linkUserId = request.cookies.oauth_link_user;
      console.log('Link user ID from cookie:', linkUserId);
      reply.clearCookie('oauth_link_user', COOKIE_OPTIONS);
      if (linkUserId) {
        console.log('=== LINKING FLOW ===');
        // Verify the link user actually exists
        const linkUser = userService.getUserById(linkUserId);
        if (!linkUser) {
          console.log('Link user not found, clearing cookie and treating as login');
          // Fall through to login logic
        } else {
          console.log('Valid link user found:', linkUser.id);
          
          // Check if provider is already linked to THIS user
          const userProviders = userService.getLinkedProviders(linkUser.id);
          const alreadyLinkedToThisUser = userProviders.some(p => p.provider === provider);
          
          if (alreadyLinkedToThisUser) {
            console.log('Provider already linked to this user');
            return reply.redirect(`${process.env.OAUTH_CALLBACK_URL || 'https://localhost:8443'}/?error=provider_already_linked_to_you`);
          }
          
          // Check if provider is linked to a DIFFERENT user
          if (existingUser && existingUser.id !== linkUser.id) {
            console.log('Provider linked to different user');
            return reply.redirect(`${process.env.OAUTH_CALLBACK_URL || 'https://localhost:8443'}/?error=provider_linked_to_different_user`);
          }
          
          // Link the provider to the user
          console.log('Linking provider to user');
          const updatedUser = oauthService.linkProviderToUser(linkUser.id, userInfo);
          oauthService.storeUserTokens(linkUser.id, provider, tokens);
          
          // Check if user has 2FA enabled for linking flow
          if (userService.requires2FA(updatedUser)) {
            // Generate temporary token and redirect to 2FA verification page
            const tempToken = userService.generateTempJWT(updatedUser);
            return reply.redirect(`${process.env.OAUTH_CALLBACK_URL || 'https://localhost:8443'}/?requiresTwoFactor=true&tempToken=${tempToken}&linked=${provider}`);
          }
          
          const authToken = userService.generateJWT(updatedUser, true);
          
          return reply.redirect(`${process.env.OAUTH_CALLBACK_URL || 'https://localhost:8443'}/?token=${authToken}&linked=${provider}`);
        }
      }
      
      console.log('=== LOGIN FLOW ===');
      
      if (existingUser) {
        console.log('Provider is linked to user, logging in:', existingUser.id);
        // LOGIN: Provider is linked to a user
        oauthService.storeUserTokens(existingUser.id, provider, tokens);
        
        // Check if user has 2FA enabled
        if (userService.requires2FA(existingUser)) {
          // Generate temporary token and redirect to 2FA verification page
          const tempToken = userService.generateTempJWT(existingUser);
          return reply.redirect(`${process.env.OAUTH_CALLBACK_URL || 'https://localhost:8443'}/?requiresTwoFactor=true&tempToken=${tempToken}`);
        }
        
        const authToken = userService.generateJWT(existingUser, true);
        return reply.redirect(`${process.env.OAUTH_CALLBACK_URL || 'https://localhost:8443'}/?token=${authToken}`);
      } else {
        console.log('Provider not linked to any user, rejecting login');
        // REJECT: Provider not linked to any user
        return reply.redirect(`${process.env.OAUTH_CALLBACK_URL || 'https://localhost:8443'}/?error=account_not_found`);
      }

    } catch (error) {
      console.error('OAuth callback error:', error);
      reply.clearCookie('oauth_state', COOKIE_OPTIONS);
      reply.clearCookie('oauth_link_user', COOKIE_OPTIONS);
      return reply.redirect(`${process.env.OAUTH_CALLBACK_URL || 'https://localhost:8443'}/?error=oauth_error`);
    }
  })

  // Link provider to existing user account
  fastify.post('/auth/link-provider', async function (request, reply) {
    const { linkToken, email, password } = request.body;

    if (!linkToken || !email || !password) {
      return reply.code(400).send({ error: 'Link token, email, and password are required' });
    }

    try {
      // Verify link token
      const linkData = jwt.verify(linkToken, process.env.JWT_SECRET);
      
      if (linkData.type !== 'link_token') {
        return reply.code(400).send({ error: 'Invalid link token' });
      }

      // Authenticate user with email/password
      const user = await userService.authenticateUser(email, password);
      
      // Check if provider is already linked to another user
      if (oauthService.isProviderLinked(linkData.provider, linkData.providerData.providerId)) {
        return reply.code(400).send({ error: 'This provider account is already linked to another user' });
      }

      // Link the provider to the authenticated user
      const updatedUser = oauthService.linkProviderToUser(user.id, linkData.providerData);
      
      // Store OAuth tokens
      oauthService.storeUserTokens(user.id, linkData.provider, linkData.tokens);
      
      // Generate new JWT with updated user info
      const authToken = userService.generateJWT(updatedUser);
      
      return { 
        user: updatedUser,
        token: authToken,
        message: `${linkData.provider} account linked successfully`
      };
    } catch (error) {
      if (error.message === 'Invalid token' || error.name === 'TokenExpiredError') {
        return reply.code(400).send({ error: 'Link token has expired or is invalid' });
      }
      return reply.code(400).send({ error: error.message });
    }
  })

  // Get link token info (for frontend to display provider info)
  fastify.post('/auth/link-info', async function (request, reply) {
    const { linkToken } = request.body;

    if (!linkToken) {
      return reply.code(400).send({ error: 'Link token is required' });
    }

    try {
      const linkData = jwt.verify(linkToken, process.env.JWT_SECRET);
      
      if (linkData.type !== 'link_token') {
        return reply.code(400).send({ error: 'Invalid link token' });
      }

      return {
        provider: linkData.provider,
        username: linkData.providerData.username,
        email: linkData.providerData.email,
        avatar: linkData.providerData.avatar
      };
    } catch (error) {
      if (error.message === 'Invalid token' || error.name === 'TokenExpiredError') {
        return reply.code(400).send({ error: 'Link token has expired or is invalid' });
      }
      return reply.code(400).send({ error: 'Invalid link token' });
    }
  })

  // Unlink provider from user account
  fastify.post('/auth/unlink-provider', async function (request, reply) {
    const authHeader = request.headers.authorization;
    const { provider } = request.body;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'No token provided' });
    }

    if (!provider) {
      return reply.code(400).send({ error: 'Provider is required' });
    }
    
    const token = authHeader.substring(7);
    
    try {
      const userData = userService.verifyJWT(token);
      const updatedUser = userService.unlinkProvider(userData.id, provider);
      
      return { 
        user: updatedUser,
        message: `${provider} account unlinked successfully`
      };
    } catch (error) {
      return reply.code(400).send({ error: error.message });
    }
  })

  // Get user's linked providers
  fastify.get('/auth/linked-providers', async function (request, reply) {
    const authHeader = request.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'No token provided' });
    }
    
    const token = authHeader.substring(7);
    
    try {
      const userData = userService.verifyJWT(token);
      const providers = userService.getLinkedProviders(userData.id);
      
      return { providers };
    } catch (error) {
      return reply.code(401).send({ error: 'Invalid token' });
    }
  })

  // Token validation endpoint
  fastify.get('/auth/validate', async function (request, reply) {
    const authHeader = request.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'No token provided' });
    }
    
    const token = authHeader.substring(7);
    
    try {
      const decoded = userService.verifyJWT(token);
      return { valid: true, user: decoded };
    } catch (error) {
      return reply.code(401).send({ error: 'Invalid token' });
    }
  })

  // Get current user info
  fastify.get('/auth/me', async function (request, reply) {
    const authHeader = request.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'No token provided' });
    }
    
    const token = authHeader.substring(7);
    
    try {
      const userData = userService.verifyJWT(token);
      const user = userService.getUserById(userData.id);
      
      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }
      
      return { user };
    } catch (error) {
      return reply.code(401).send({ error: 'Invalid token' });
    }
  })

  // ===== 2FA ENDPOINTS =====

  // Setup 2FA - Generate QR code and secret
  fastify.post('/auth/2fa/setup', async function (request, reply) {
    const authHeader = request.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'No token provided' });
    }
    
    const token = authHeader.substring(7);
    
    try {
      const userData = userService.verifyJWT(token);
      const setupData = await userService.setup2FA(userData.id);
      
      return setupData;
    } catch (error) {
      return reply.code(400).send({ error: error.message });
    }
  })

  // Verify 2FA setup and enable it
  fastify.post('/auth/2fa/verify-setup', async function (request, reply) {
    const authHeader = request.headers.authorization;
    const { token: twoFactorCode } = request.body;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'No token provided' });
    }

    if (!twoFactorCode) {
      return reply.code(400).send({ error: '2FA code is required' });
    }
    
    const token = authHeader.substring(7);
    
    try {
      const userData = userService.verifyJWT(token);
      const result = await userService.verify2FASetup(userData.id, twoFactorCode);
      
      return {
        ...result,
        message: '2FA enabled successfully. Save these backup codes in a secure location.'
      };
    } catch (error) {
      return reply.code(400).send({ error: error.message });
    }
  })

  // Verify 2FA for temporary token (complete login)
  fastify.post('/auth/2fa/verify', async function (request, reply) {
    const { tempToken, twoFactorCode } = request.body;
    
    if (!tempToken || !twoFactorCode) {
      return reply.code(400).send({ error: 'Temporary token and 2FA code are required' });
    }
    
    try {
      const userData = userService.verifyJWT(tempToken);
      
      if (!userData.temp2FA) {
        return reply.code(400).send({ error: 'Invalid temporary token' });
      }
      
      // Verify 2FA code
      await userService.verify2FA(userData.id, twoFactorCode);
      
      // Get fresh user data
      const user = userService.getUserById(userData.id);
      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }
      
      // Generate full access token
      const authToken = userService.generateJWT(user, true);
      
      return {
        user: user,
        token: authToken,
        message: 'Login successful'
      };
    } catch (error) {
      return reply.code(401).send({ error: error.message });
    }
  })

  // Get 2FA status
  fastify.get('/auth/2fa/status', async function (request, reply) {
    const authHeader = request.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'No token provided' });
    }
    
    const token = authHeader.substring(7);
    
    try {
      const userData = userService.verifyJWT(token);
      const status = userService.get2FAStatus(userData.id);
      
      return status;
    } catch (error) {
      return reply.code(401).send({ error: 'Invalid token' });
    }
  })

  // Disable 2FA
  fastify.post('/auth/2fa/disable', async function (request, reply) {
    const authHeader = request.headers.authorization;
    const { currentPassword, twoFactorCode } = request.body;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'No token provided' });
    }

    if (!currentPassword || !twoFactorCode) {
      return reply.code(400).send({ error: 'Current password and 2FA code are required' });
    }
    
    const token = authHeader.substring(7);
    
    try {
      const userData = userService.verifyJWT(token);
      await userService.disable2FA(userData.id, currentPassword, twoFactorCode);
      
      return { message: '2FA disabled successfully' };
    } catch (error) {
      return reply.code(400).send({ error: error.message });
    }
  })

  // Regenerate backup codes
  fastify.post('/auth/2fa/regenerate-backup-codes', async function (request, reply) {
    const authHeader = request.headers.authorization;
    const { currentPassword, twoFactorCode } = request.body;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'No token provided' });
    }

    if (!currentPassword || !twoFactorCode) {
      return reply.code(400).send({ error: 'Current password and 2FA code are required' });
    }
    
    const token = authHeader.substring(7);
    
    try {
      const userData = userService.verifyJWT(token);
      const result = await userService.regenerateBackupCodes(userData.id, currentPassword, twoFactorCode);
      
      return {
        ...result,
        message: 'Backup codes regenerated successfully. Save these new codes in a secure location.'
      };
    } catch (error) {
      return reply.code(400).send({ error: error.message });
    }
  })

  // ===== END 2FA ENDPOINTS =====

  // Logout endpoint
  fastify.post('/auth/logout', async function (request, reply) {
    const authHeader = request.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      try {
        // Verify and decode the JWT to get user info
        const userData = userService.verifyJWT(token);
        
        // Revoke OAuth tokens with the provider
        const revocationResult = await oauthService.revokeTokens(userData.id);
        
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
  fastify.post('/auth/revoke', async function (request, reply) {
    const authHeader = request.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'No token provided' });
    }
    
    const token = authHeader.substring(7);
    
    try {
      const userData = userService.verifyJWT(token);
      const revocationResult = await oauthService.revokeTokens(userData.id);
      
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

  // Update user profile
  fastify.put('/auth/profile', async function (request, reply) {
    const authHeader = request.headers.authorization;
    const { username, email } = request.body;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'No token provided' });
    }
    
    const token = authHeader.substring(7);
    
    try {
      const userData = userService.verifyJWT(token);
      const updates = {};
      
      if (username !== undefined) updates.username = username;
      if (email !== undefined) updates.email = email;
      
      const updatedUser = await userService.updateUser(userData.id, updates);
      
      return { 
        user: updatedUser,
        message: 'Profile updated successfully'
      };
    } catch (error) {
      return reply.code(400).send({ error: error.message });
    }
  })

  // Change password
  fastify.put('/auth/password', async function (request, reply) {
    const authHeader = request.headers.authorization;
    const { currentPassword, newPassword } = request.body;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'No token provided' });
    }

    if (!currentPassword || !newPassword) {
      return reply.code(400).send({ error: 'Current password and new password are required' });
    }

    if (newPassword.length < 8) {
      return reply.code(400).send({ error: 'New password must be at least 8 characters long' });
    }
    
    const token = authHeader.substring(7);
    
    try {
      const userData = userService.verifyJWT(token);
      await userService.changePassword(userData.id, currentPassword, newPassword);
      
      return { message: 'Password changed successfully' };
    } catch (error) {
      return reply.code(400).send({ error: error.message });
    }
  })
}
