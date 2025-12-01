import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  LinearProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { initEmailJs, registerUser, sendVerificationEmail } from '../../api/auth';
import { useNavigate } from 'react-router-dom';

const generateToken = () => {
  const bytes = new Uint8Array(32);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
};

export const RegisterPage = () => {
  const [passwordStrength, setPasswordStrength] = useState(0);
  const navigate = useNavigate();
  const [form, setForm] = useState({
    username: '',
    email: '',
    phone: '',
    password: '',
    confirm: '',
    adminAccessCode: '',
  });
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    initEmailJs().catch((err) => console.warn('Failed to initialize EmailJS:', err));
  }, []);

  const evaluateStrength = (value: string) => {
    let score = 0;
    if (value.length >= 8) score += 25;
    if (/[A-Z]/.test(value)) score += 25;
    if (/[0-9]/.test(value)) score += 25;
    if (/[^A-Za-z0-9]/.test(value)) score += 25;
    setPasswordStrength(score);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (form.password !== form.confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    setError(null);
    setStatus('Sending verification email…');
    const token = generateToken();
    try {
      await sendVerificationEmail({ email: form.email, username: form.username, token });
      setStatus('Verification email sent. Creating account…');
      await registerUser({
        username: form.username,
        email: form.email,
        phone_number: form.phone,
        password: form.password,
        adminAccessCode: form.adminAccessCode || undefined,
        verificationToken: token,
        captchaToken: 'dev',
      });
      setStatus('Registration successful! Check your email to verify your account.');
    } catch (err: any) {
      const message = err.response?.data?.error || err.message || 'Unable to register';
      setError(message);
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 520, mx: 'auto', mt: 4 }}>
      <Card component="form" onSubmit={handleSubmit}>
        <CardContent>
          <Typography variant="h4" gutterBottom>
            Create Account
          </Typography>
          <Stack spacing={2}>
            <TextField label="Full Name" value={form.username} onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))} fullWidth required />
            <TextField label="Email" type="email" value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} fullWidth required />
            <TextField label="Phone Number" value={form.phone} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} fullWidth />
            <TextField
              label="Password"
              type="password"
              value={form.password}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, password: e.target.value }));
                evaluateStrength(e.target.value);
              }}
              fullWidth
              required
            />
            <LinearProgress variant="determinate" value={passwordStrength} />
            <Stack spacing={0.5}>
              <Typography variant="subtitle2">Requirements</Typography>
              <Typography variant="body2">✓ Minimum 8 characters</Typography>
              <Typography variant="body2">✓ One uppercase letter</Typography>
              <Typography variant="body2">✓ One number</Typography>
              <Typography variant="body2">✓ One special character</Typography>
            </Stack>
            <TextField
              label="Confirm Password"
              type="password"
              value={form.confirm}
              onChange={(e) => setForm((prev) => ({ ...prev, confirm: e.target.value }))}
              fullWidth
              required
            />
            <TextField
              label="Admin Access Code (optional)"
              type="password"
              value={form.adminAccessCode}
              onChange={(e) => setForm((prev) => ({ ...prev, adminAccessCode: e.target.value }))}
              fullWidth
            />
            <Box sx={{ border: '1px dashed #cbd5f5', p: 2, borderRadius: 2, textAlign: 'center' }}>
              <Typography variant="body2">reCAPTCHA enabled on production</Typography>
            </Box>
            <Button variant="contained" size="large" type="submit" disabled={loading}>
              {loading ? 'Submitting…' : 'Register'}
            </Button>
            <Button variant="text" size="small" onClick={() => navigate('/login')}>
              Login
            </Button>
            {status && <Alert severity="info">{status}</Alert>}
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
};


