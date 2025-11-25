export const appConfig = {
  port: parseInt(process.env.PORT || '3000', 10),
  jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this',
  saltRounds: parseInt(process.env.SALT_ROUNDS || '12', 10),
};

