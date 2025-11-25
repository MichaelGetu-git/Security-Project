export const verifyCaptcha = async (token: string): Promise<boolean> => {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) {
    return true;
  }

  const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      secret,
      response: token,
    }),
  });

  const data = (await response.json()) as { success?: boolean };
  return Boolean(data?.success);
};

