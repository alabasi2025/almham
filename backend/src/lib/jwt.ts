import jwt from 'jsonwebtoken';
import { randomBytes } from 'node:crypto';

const SECRET = process.env['JWT_SECRET'];
if (!SECRET) {
  throw new Error('JWT_SECRET is not set in environment');
}

const EXPIRES_IN = process.env['JWT_EXPIRES_IN'] ?? '12h';

export interface TokenPayload {
  sub: string;       // userId
  tid: string;       // tokenId (for session revocation)
  role: string;
  username: string;
}

export function generateTokenId(): string {
  return randomBytes(24).toString('hex');
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, SECRET as string, { expiresIn: EXPIRES_IN } as jwt.SignOptions);
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, SECRET as string) as TokenPayload;
}
