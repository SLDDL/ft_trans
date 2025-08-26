const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

class UserService {
  constructor() {
    this.users = new Map(); // userId -> user object
    this.usersByEmail = new Map(); // email -> userId
    this.providerLinks = new Map(); // provider_providerUserId -> userId
    this.saltRounds = 12;
  }

  isUsernameTaken(username) {
    for (const user of this.users.values()) {
      if (user.username === username) {
        return true;
      }
    }
    return false;
  }

  // Generate a unique user ID
  generateUserId() {
    let userId;
    do {
      userId = crypto.randomUUID();
    } while (this.users.has(userId));
    return userId;
  }

  // Hash password
  async hashPassword(password) {
    return bcrypt.hash(password, this.saltRounds);
  }

  // Verify password
  async verifyPassword(password, hashedPassword) {
    return bcrypt.compare(password, hashedPassword);
  }

  // Create a new user with email/password
  async createUser(userData) {
    const { email, password, username } = userData;

    // Check if email already exists
    if (this.usersByEmail.has(email.toLowerCase())) {
      throw new Error('Email already registered');
    }

    if (username && this.isUsernameTaken(username)) {
      throw new Error('Username already taken');
    }

    if (!username) {
      throw new Error('Username is required');
    }

    if (!password) {
      throw new Error('Password is required');
    }

    if (!email) {
      throw new Error('Email is required');
    }

    // Hash the password
    const hashedPassword = await this.hashPassword(password);

    // Generate user ID
    const userId = this.generateUserId();

    // Create user object
    const user = {
      id: userId,
      email: email.toLowerCase(),
      username: username,
      password: hashedPassword,
      providers: new Map(), // provider -> { providerId, username, avatar, linkedAt }
      twoFactor: {
        enabled: false,
        secret: null,
        backupCodes: [],
        lastUsedBackupCode: null
      },
      createdAt: new Date(),
      lastLogin: new Date(),
      isActive: true
    };

    // Store user
    this.users.set(userId, user);
    this.usersByEmail.set(email.toLowerCase(), userId);

    // Return user without password
    return this.sanitizeUser(user);
  }

  // Authenticate user with email/password
  async authenticateUser(email, password) {
    const userId = this.usersByEmail.get(email.toLowerCase());
    if (!userId) {
      throw new Error('Invalid credentials');
    }

    const user = this.users.get(userId);
    if (!user || !user.isActive) {
      throw new Error('Invalid credentials');
    }

    const isValidPassword = await this.verifyPassword(password, user.password);
    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    // Update last login
    user.lastLogin = new Date();

    return this.sanitizeUser(user);
  }

  // Get user by ID
  getUserById(userId) {
    const user = this.users.get(userId);
    return user ? this.sanitizeUser(user) : null;
  }

  // Get user by email
  getUserByEmail(email) {
    const userId = this.usersByEmail.get(email.toLowerCase());
    return userId ? this.getUserById(userId) : null;
  }

  // Check if provider is already linked to any user
  isProviderLinked(provider, providerId) {
    const linkKey = `${provider}_${providerId}`;
    return this.providerLinks.has(linkKey);
  }

  // Get user by provider
  getUserByProvider(provider, providerId) {
    const linkKey = `${provider}_${providerId}`;
    const userId = this.providerLinks.get(linkKey);
    return userId ? this.getUserById(userId) : null;
  }

  // Link OAuth provider to existing user
  linkProvider(userId, providerData) {
    const { provider, providerId, username, email, avatar } = providerData;
    const linkKey = `${provider}_${providerId}`;

    // Check if provider is already linked to another user
    if (this.providerLinks.has(linkKey)) {
      const existingUserId = this.providerLinks.get(linkKey);
      if (existingUserId !== userId) {
        throw new Error('This provider account is already linked to another user');
      }
      // Already linked to this user, update the info
    }

    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Add provider link
    user.providers.set(provider, {
      providerId: providerId,
      username: username,
      email: email,
      avatar: avatar,
      linkedAt: new Date()
    });

    // Store reverse mapping
    this.providerLinks.set(linkKey, userId);

    return this.sanitizeUser(user);
  }

  // Unlink OAuth provider from user
  unlinkProvider(userId, provider) {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const providerData = user.providers.get(provider);
    if (!providerData) {
      throw new Error('Provider not linked to this user');
    }

    // Remove provider from user
    user.providers.delete(provider);

    // Remove reverse mapping
    const linkKey = `${provider}_${providerData.providerId}`;
    this.providerLinks.delete(linkKey);

    return this.sanitizeUser(user);
  }

  // Get linked providers for a user
  getLinkedProviders(userId) {
    const user = this.users.get(userId);
    if (!user) {
      return [];
    }

    return Array.from(user.providers.entries()).map(([provider, data]) => ({
      provider: provider,
      username: data.username,
      avatar: data.avatar,
      linkedAt: data.linkedAt
    }));
  }

  // Update user profile
  async updateUser(userId, updates) {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const allowedUpdates = ['username', 'email'];
    const validUpdates = {};

    for (const key of allowedUpdates) {
      if (updates[key] !== undefined) {
        validUpdates[key] = updates[key];
      }
    }

    // Handle email update
    if (validUpdates.email && validUpdates.email !== user.email) {
      const newEmail = validUpdates.email.toLowerCase();
      
      // Check if new email is already taken
      if (this.usersByEmail.has(newEmail)) {
        throw new Error('Email already in use');
      }

      // Remove old email mapping
      this.usersByEmail.delete(user.email);
      
      // Update email
      user.email = newEmail;
      user.emailVerified = false; // Reset verification status
      
      // Add new email mapping
      this.usersByEmail.set(newEmail, userId);
    }

    // Handle username update
    if (validUpdates.username) {
      user.username = validUpdates.username;
    }

    return this.sanitizeUser(user);
  }

  // Change password
  async changePassword(userId, currentPassword, newPassword) {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Verify current password
    const isValidPassword = await this.verifyPassword(currentPassword, user.password);
    if (!isValidPassword) {
      throw new Error('Current password is incorrect');
    }

    // Hash new password
    user.password = await this.hashPassword(newPassword);

    return { success: true };
  }

  // Generate JWT token
  generateJWT(user, is2FAVerified = false) {
    const payload = {
      id: user.id,
      email: user.email,
      username: user.username,
      providers: user.providers && typeof user.providers === 'object' 
        ? (user.providers instanceof Map 
            ? Array.from(user.providers.keys()) 
            : Object.keys(user.providers))
        : [],
      twoFactorVerified: is2FAVerified
    };

    return jwt.sign(payload, process.env.JWT_SECRET, { 
      expiresIn: '24h',
      issuer: 'auth-server'
    });
  }

  // Generate temporary JWT for 2FA verification
  generateTempJWT(user) {
    const payload = {
      id: user.id,
      email: user.email,
      username: user.username,
      temp2FA: true
    };

    return jwt.sign(payload, process.env.JWT_SECRET, { 
      expiresIn: '10m', // Short-lived for 2FA verification
      issuer: 'auth-server'
    });
  }

  // Verify JWT token
  verifyJWT(token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  // ===== 2FA METHODS =====

  // Setup 2FA for user
  async setup2FA(userId) {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (user.twoFactor.enabled) {
      throw new Error('2FA is already enabled for this user');
    }

    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `${user.email}`,
      issuer: 'Transcendence Auth',
      length: 32
    });

    // Store the secret temporarily (not enabled yet)
    user.twoFactor.secret = secret.base32;

    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    return {
      secret: secret.base32,
      qrCode: qrCodeUrl,
      manualEntryKey: secret.base32
    };
  }

  // Verify 2FA setup and enable it
  async verify2FASetup(userId, token) {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (!user.twoFactor.secret) {
      throw new Error('2FA setup not initiated');
    }

    if (user.twoFactor.enabled) {
      throw new Error('2FA is already enabled');
    }

    // Verify the token
    const verified = speakeasy.totp.verify({
      secret: user.twoFactor.secret,
      encoding: 'base32',
      token: token,
      window: 2 // Allow 2 time steps of variance
    });

    if (!verified) {
      throw new Error('Invalid 2FA code');
    }

    // Generate backup codes
    const backupCodes = this.generateBackupCodes();
    
    // Enable 2FA
    user.twoFactor.enabled = true;
    user.twoFactor.backupCodes = backupCodes.map(code => ({
      code: code,
      used: false,
      usedAt: null
    }));

    return {
      enabled: true,
      backupCodes: backupCodes
    };
  }

  // Generate backup codes
  generateBackupCodes(count = 10) {
    const codes = [];
    for (let i = 0; i < count; i++) {
      // Generate 8-digit backup code
      codes.push(crypto.randomInt(10000000, 99999999).toString());
    }
    return codes;
  }

  // Verify 2FA token
  async verify2FA(userId, token) {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (!user.twoFactor.enabled) {
      throw new Error('2FA is not enabled for this user');
    }

    // Check if it's a backup code
    if (token.length === 8 && !isNaN(token)) {
      return this.verifyBackupCode(userId, token);
    }

    // Verify TOTP token
    const verified = speakeasy.totp.verify({
      secret: user.twoFactor.secret,
      encoding: 'base32',
      token: token,
      window: 2
    });

    if (!verified) {
      throw new Error('Invalid 2FA code');
    }

    return { verified: true, method: 'totp' };
  }

  // Verify backup code
  verifyBackupCode(userId, code) {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const backupCode = user.twoFactor.backupCodes.find(
      bc => bc.code === code && !bc.used
    );

    if (!backupCode) {
      throw new Error('Invalid backup code');
    }

    // Mark backup code as used
    backupCode.used = true;
    backupCode.usedAt = new Date();
    user.twoFactor.lastUsedBackupCode = code;

    return { verified: true, method: 'backup_code' };
  }

  // Disable 2FA
  async disable2FA(userId, currentPassword, token) {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (!user.twoFactor.enabled) {
      throw new Error('2FA is not enabled');
    }

    // Verify current password
    const isValidPassword = await this.verifyPassword(currentPassword, user.password);
    if (!isValidPassword) {
      throw new Error('Invalid password');
    }

    // Verify 2FA token
    await this.verify2FA(userId, token);

    // Disable 2FA
    user.twoFactor = {
      enabled: false,
      secret: null,
      backupCodes: [],
      lastUsedBackupCode: null
    };

    return { disabled: true };
  }

  // Get 2FA status
  get2FAStatus(userId) {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    return {
      enabled: user.twoFactor.enabled,
      backupCodesRemaining: user.twoFactor.backupCodes ? 
        user.twoFactor.backupCodes.filter(bc => !bc.used).length : 0
    };
  }

  // Regenerate backup codes
  async regenerateBackupCodes(userId, currentPassword, token) {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (!user.twoFactor.enabled) {
      throw new Error('2FA is not enabled');
    }

    // Verify current password
    const isValidPassword = await this.verifyPassword(currentPassword, user.password);
    if (!isValidPassword) {
      throw new Error('Invalid password');
    }

    // Verify 2FA token
    await this.verify2FA(userId, token);

    // Generate new backup codes
    const newBackupCodes = this.generateBackupCodes();
    user.twoFactor.backupCodes = newBackupCodes.map(code => ({
      code: code,
      used: false,
      usedAt: null
    }));

    return {
      backupCodes: newBackupCodes
    };
  }

  // Check if user requires 2FA verification
  requires2FA(user) {
    return user.twoFactor && user.twoFactor.enabled;
  }

  // Remove sensitive data from user object
  sanitizeUser(user) {
    if (!user) return null;

    const sanitized = {
      id: user.id,
      email: user.email,
      username: user.username,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
      emailVerified: user.emailVerified,
      isActive: user.isActive,
      twoFactor: {
        enabled: user.twoFactor ? user.twoFactor.enabled : false,
        backupCodesRemaining: user.twoFactor && user.twoFactor.backupCodes ? 
          user.twoFactor.backupCodes.filter(bc => !bc.used).length : 0
      }
    };

    // Convert providers Map to object for JSON serialization
    if (user.providers && user.providers.size > 0) {
      sanitized.providers = {};
      user.providers.forEach((data, provider) => {
        sanitized.providers[provider] = {
          username: data.username,
          avatar: data.avatar,
          linkedAt: data.linkedAt
        };
      });
    } else {
      sanitized.providers = {};
    }

    return sanitized;
  }

  // Development/testing methods
  getAllUsers() {
    return Array.from(this.users.values()).map(user => this.sanitizeUser(user));
  }

  deleteUser(userId) {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Remove email mapping
    this.usersByEmail.delete(user.email);

    // Remove provider links
    user.providers.forEach((data, provider) => {
      const linkKey = `${provider}_${data.providerId}`;
      this.providerLinks.delete(linkKey);
    });

    // Remove user
    this.users.delete(userId);

    return { success: true };
  }
}

module.exports = UserService;