export const maskEmail = (email: string): string => {
  const [user, domain] = email.split('@');
  const maskedUser = user.length > 2 ? `${user[0]}***${user.slice(-1)}` : `${user[0]}*`;
  return `${maskedUser}@${domain}`;
};

