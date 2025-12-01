import emailjs from '@emailjs/browser';
import api from '../lib/api';
import { authStore } from '../store/authStore';

type EmailJsConfig = {
  serviceId?: string;
  templateId?: string;
  publicKey?: string;
};

declare global {
  interface Window {
    __APP_CONFIG__?: {
      emailJs?: EmailJsConfig;
      appUrl?: string;
    };
  }
}

let cachedConfig: { emailJs: EmailJsConfig; appUrl?: string } | null = null;

const getAppConfig = async (): Promise<{ emailJs: EmailJsConfig; appUrl?: string }> => {
  if (cachedConfig) return cachedConfig;

  if (window.__APP_CONFIG__) {
    console.log('[Config] Using window.__APP_CONFIG__ from inline script:', {
      hasEmailJs: !!window.__APP_CONFIG__.emailJs,
      hasAppUrl: !!window.__APP_CONFIG__.appUrl,
    });
    cachedConfig = {
      emailJs: window.__APP_CONFIG__.emailJs || {},
      appUrl: window.__APP_CONFIG__.appUrl,
    };
    return cachedConfig;
  }

  try {
    console.log('[Config] Fetching /config.js from backend...');
    const response = await fetch('/config.js');
    if (!response.ok) {
      throw new Error(`Failed to fetch config.js (status ${response.status})`);
    }
    const text = await response.text();
    console.log('[Config] /config.js response first 120 chars:', text.slice(0, 120));
    if (text.trim().startsWith('<')) {
      throw new Error('config.js response is not JavaScript');
    }
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    new Function(text)();
    const appConfig = window.__APP_CONFIG__ as { emailJs?: EmailJsConfig; appUrl?: string } | undefined;
    if (appConfig) {
      const config: { emailJs: EmailJsConfig; appUrl?: string } = {
        emailJs: appConfig.emailJs || {},
        appUrl: appConfig.appUrl,
      };
      console.log('[Config] Parsed __APP_CONFIG__ from /config.js:', {
        hasEmailJs: !!config.emailJs,
        hasServiceId: !!config.emailJs.serviceId,
        hasTemplateId: !!config.emailJs.templateId,
        hasPublicKey: !!config.emailJs.publicKey,
        appUrl: config.appUrl,
      });
      cachedConfig = config;
      return config;
    }
  } catch (err) {
    console.warn('Failed to load config.js:', err);
  }
  
  const defaultConfig: { emailJs: EmailJsConfig; appUrl?: string } = { emailJs: {}, appUrl: undefined };
  cachedConfig = defaultConfig;
  return defaultConfig;
};

export const initEmailJs = async () => {
  const { emailJs } = await getAppConfig();
  if (emailJs.publicKey) {
    console.log('[EmailJS] Initializing with publicKey (length only):', emailJs.publicKey.length);
    emailjs.init(emailJs.publicKey);
  } else {
    console.warn('EmailJS publicKey not found in config');
  }
};

export const sendVerificationEmail = async (params: { email: string; username: string; token: string }) => {
  const { emailJs, appUrl } = await getAppConfig();
  console.log('[EmailJS] sendVerificationEmail called with config:', {
    hasServiceId: !!emailJs.serviceId,
    hasTemplateId: !!emailJs.templateId,
    hasPublicKey: !!emailJs.publicKey,
    appUrl: appUrl || window.location.origin,
  });
  const verifyUrl = `${appUrl || window.location.origin}/verify?token=${params.token}`;
  if (!emailJs.serviceId || !emailJs.templateId || !emailJs.publicKey) {
    // Graceful degradation: log a warning but don't block registration
    console.warn('EmailJS is not configured. Skipping verification email.');
    return verifyUrl;
  }
  await emailjs.send(emailJs.serviceId, emailJs.templateId, {
    email: params.email,
    username: params.username,
    verifyUrl,
    subject: 'Verify your email',
    message: `Click here to verify your email: ${verifyUrl}. Link expires in 1 hour.`,
  });
  return verifyUrl;
};

export const registerUser = (payload: {
  username: string;
  email: string;
  phone_number?: string;
  password: string;
  adminAccessCode?: string;
  verificationToken: string;
  captchaToken?: string;
}) => api.post('/auth/register', payload);

export const loginUser = async (payload: { email: string; password: string; otp?: string }) => {
  const { data } = await api.post('/auth/login', payload);
  authStore.getState().setTokens(data.accessToken, data.refreshToken);
  authStore.getState().setUser(data.user);
  return data;
};

export const fetchProfile = async () => {
  const { data } = await api.get('/auth/me');
  authStore.getState().setUser({
    id: data.id,
    email: data.email,
    username: data.username,
    roles: data.roles,
    security_level: data.security_level,
    mfa_enabled: data.mfa_enabled,
    phone_number: data.phone_number,
  });
  return data;
};

export const updateProfile = (payload: Record<string, string | undefined>) => api.post('/auth/profile', payload);

export const changePassword = (payload: { currentPassword: string; newPassword: string }) =>
  api.post('/auth/password/change', payload);

export const setupMfa = () => api.post('/auth/mfa/setup');

export const enableMfa = (payload: { token: string }) => api.post('/auth/mfa/enable', payload);

export const fetchSessions = async () => {
  const { data } = await api.get<{ sessions: any[] }>('/auth/sessions');
  return data.sessions;
};

export const revokeSession = (id: number) => api.delete(`/auth/sessions/${id}`);

export const logoutOtherSessions = (keepSessionId?: number) => api.post('/auth/sessions/logout-others', { keepSessionId });

export const logoutUser = () => api.post('/auth/logout');

export const submitRoleRequest = (payload: { role: string; justification: string }) =>
  api.post('/auth/role-request', payload);

export const verifyEmail = (token: string) => api.get(`/auth/verify?token=${encodeURIComponent(token)}`);

