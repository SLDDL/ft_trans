const axios = require('axios');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

class OAuthService {
  constructor() {
    this.providers = {
      discord: {
        authUrl: 'https://discord.com/api/oauth2/authorize',
        tokenUrl: 'https://discord.com/api/oauth2/token',
        revokeUrl: 'https://discord.com/api/oauth2/token/revoke',
        userUrl: 'https://discord.com/api/users/@me',
        scope: 'identify email',
        clientId: process.env.DISCORD_CLIENT_ID,
        clientSecret: process.env.DISCORD_CLIENT_SECRET
      },
      github: {
        authUrl: 'https://github.com/login/oauth/authorize',
        tokenUrl: 'https://github.com/login/oauth/access_token',
        revokeUrl: 'https://api.github.com/applications/{client_id}/grant', // Different for GitHub
        userUrl: 'https://api.github.com/user',
        scope: 'user:email',
        clientId: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET
      }
    };

    // Store tokens for revocation (in production, use a database)
    this.userTokens = new Map(); // userId -> { provider, accessToken, refreshToken }
  }

  generateState() {
    return crypto.randomBytes(32).toString('hex');
  }

  buildAuthUrl(provider, state) {
    const config = this.providers[provider];
    if (!config) {
      throw new Error(`Provider ${provider} not supported`);
    }

    const redirectUri = `${process.env.BACKEND_URL || 'http://localhost:3000'}/auth/oauth/${provider}/callback`;
    
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: redirectUri,
      scope: config.scope,
      state: state,
      response_type: 'code'
    });

    return `${config.authUrl}?${params.toString()}`;
  }

  async exchangeCodeForTokens(provider, code) {
    const config = this.providers[provider];
    if (!config) {
      throw new Error(`Provider ${provider} not supported`);
    }

    const redirectUri = `${process.env.BACKEND_URL || 'http://localhost:3000'}/auth/oauth/${provider}/callback`;
    
    const tokenData = {
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code: code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    };

    try {
      console.log(`Exchanging code for tokens with ${provider}:`, {
        tokenUrl: config.tokenUrl,
        redirectUri: redirectUri,
        hasClientId: !!config.clientId,
        hasClientSecret: !!config.clientSecret,
        hasCode: !!code
      });
      
      const response = await axios.post(config.tokenUrl, tokenData, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      console.log('Token exchange successful:', { hasAccessToken: !!response.data.access_token });
      return response.data;
    } catch (error) {
      console.error('Token exchange error:', {
        provider: provider,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });
      throw new Error(`Failed to exchange code for tokens: ${error.response?.data?.error || error.message}`);
    }
  }

  async getUserInfo(provider, accessToken) {
    const config = this.providers[provider];
    if (!config) {
      throw new Error(`Provider ${provider} not supported`);
    }

    try {
      console.log(`Fetching user info from ${provider} with token`);
      
      const response = await axios.get(config.userUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'User-Agent': 'OAuth-App'
        }
      });

      console.log('User info response received:', {
        hasId: !!response.data.id,
        hasUsername: !!(response.data.login || response.data.username),
        hasEmail: !!response.data.email
      });

      // Normalize user data across providers
      const userData = response.data;
      let normalizedUser = {
        provider: provider,
        providerId: userData.id.toString(),
        username: userData.login || userData.username,
        email: userData.email,
        avatar: userData.avatar_url,
        raw: userData
      };

      // Handle GitHub specific fields and email retrieval
      if (provider === 'github') {
        // GitHub may not return email in the user endpoint, so fetch it separately
        if (!userData.email) {
          try {
            console.log('Fetching GitHub user emails...');
            const emailResponse = await axios.get('https://api.github.com/user/emails', {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'User-Agent': 'OAuth-App'
              }
            });
            
            // Find the primary email or the first verified email
            const emails = emailResponse.data;
            const primaryEmail = emails.find(email => email.primary && email.verified);
            const verifiedEmail = emails.find(email => email.verified);
            
            normalizedUser.email = primaryEmail?.email || verifiedEmail?.email || null;
            console.log('GitHub emails fetched:', { 
              totalEmails: emails.length, 
              foundPrimary: !!primaryEmail,
              foundVerified: !!verifiedEmail,
              selectedEmail: normalizedUser.email
            });
          } catch (emailError) {
            console.error('Failed to fetch GitHub emails:', emailError.response?.data || emailError.message);
          }
        }
      }

      // Handle Discord specific fields
      if (provider === 'discord') {
        normalizedUser.username = userData.username;
        normalizedUser.avatar = userData.avatar 
          ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png`
          : null;
      }

      return normalizedUser;
    } catch (error) {
      console.error('User info error:', {
        provider: provider,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });
      throw new Error(`Failed to get user information: ${error.response?.data?.message || error.message}`);
    }
  }

  generateJWT(user) {
    const payload = {
      id: user.id || `${user.provider}_${user.providerId}`,
      provider: user.provider,
      providerId: user.providerId,
      username: user.username,
      email: user.email,
      avatar: user.avatar
    };

    return jwt.sign(payload, process.env.JWT_SECRET, { 
      expiresIn: '24h',
      issuer: 'auth-server'
    });
  }

  verifyJWT(token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  // Simple in-memory user storage (replace with database in production)
  createOrUpdateUser(userInfo) {
    const userId = `${userInfo.provider}_${userInfo.providerId}`;
    
    // In production, this would be a database operation
    const user = {
      id: userId,
      provider: userInfo.provider,
      providerId: userInfo.providerId,
      username: userInfo.username,
      email: userInfo.email,
      avatar: userInfo.avatar,
      createdAt: new Date(),
      lastLogin: new Date()
    };

    console.log('User created/updated:', user);
    return user;
  }

  // Store tokens for later revocation
  storeUserTokens(userId, provider, tokens) {
    this.userTokens.set(userId, {
      provider: provider,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token
    });
  }

  // Revoke OAuth tokens with the provider
  async revokeTokens(userId) {
    const tokenData = this.userTokens.get(userId);
    if (!tokenData) {
      console.log('No tokens found for user:', userId);
      return { success: false, reason: 'No tokens found' };
    }

    const config = this.providers[tokenData.provider];
    if (!config || !config.revokeUrl) {
      console.log('Token revocation not supported for provider:', tokenData.provider);
      return { success: false, reason: 'Revocation not supported' };
    }

    try {
      if (tokenData.provider === 'discord') {
        await this.revokeDiscordToken(config, tokenData.accessToken);
      } else if (tokenData.provider === 'github') {
        await this.revokeGitHubToken(config, tokenData.accessToken);
      }

      // Remove tokens from storage
      this.userTokens.delete(userId);
      
      console.log('Successfully revoked tokens for user:', userId);
      return { success: true };
    } catch (error) {
      console.error('Failed to revoke tokens:', error);
      return { success: false, reason: error.message };
    }
  }

  async revokeDiscordToken(config, accessToken) {
    const revokeData = {
      client_id: config.clientId,
      client_secret: config.clientSecret,
      token: accessToken
    };

    await axios.post(config.revokeUrl, revokeData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
  }

  async revokeGitHubToken(config, accessToken) {
    // GitHub uses DELETE method with Basic Auth
    const auth = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');
    
    await axios.delete(`https://api.github.com/applications/${config.clientId}/grant`, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/vnd.github.v3+json'
      },
      data: {
        access_token: accessToken
      }
    });
  }
}

module.exports = OAuthService;