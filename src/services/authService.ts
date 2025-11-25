import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';
import crypto from 'crypto';
import { JWTPayload, JwtUserPayload } from '../types';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const REFRESH_SECRET = process.env.REFRESH_TOKEN_SECRET || 'refresh-secret';
const SALT_ROUNDS = parseInt(process.env.SALT_ROUNDS || '12', 10);

export class AuthService {
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  static async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  static validatePassword(password: string): { valid: boolean; message?: string } {
    if (password.length < 12) {
      return { valid: false, message: 'Password must be at least 12 characters' };
    }
    if (!/[A-Z]/.test(password)) {
      return { valid: false, message: 'Password must contain uppercase letter' };
    }
    if (!/[a-z]/.test(password)) {
      return { valid: false, message: 'Password must contain lowercase letter' };
    }
    if (!/[0-9]/.test(password)) {
      return { valid: false, message: 'Password must contain number' };
    }
    if (!/[!@#$%^&*]/.test(password)) {
      return { valid: false, message: 'Password must contain special character' };
    }
    return { valid: true };
  }

  static generateAccessToken(payload: JwtUserPayload): string {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
  }

  static verifyAccessToken(token: string): JWTPayload | null {
    try {
      return jwt.verify(token, JWT_SECRET) as JWTPayload;
    } catch (error) {
      return null;
    }
  }

  static generateVerificationToken(): { token: string; hashed: string; expires: Date } {
    const token = crypto.randomBytes(32).toString('hex');
    const hashed = crypto.createHash('sha256').update(token).digest('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000);
    return { token, hashed, expires };
  }

  static generateMFASecret(username: string): { secret: string; qrCode: string } {
    const secret = speakeasy.generateSecret({
      name: `SecurityApp (${username})`,
      length: 32,
    });

    return {
      secret: secret.base32,
      qrCode: secret.otpauth_url || '',
    };
  }

  static verifyMFAToken(secret: string, token: string): boolean {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 2,
    });
  }

  static hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  static decodeRefreshToken(token: string) {
    try {
      return jwt.verify(token, REFRESH_SECRET);
    } catch {
      return null;
    }
  }
}

