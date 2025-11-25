import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Link, useNavigate } from 'react-router-dom';
import { loginUser, fetchProfile } from '../../api/auth';

export const LoginPage = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', otp: '' });
  const [rememberMe, setRememberMe] = useState(false);
  const [requiresMfa, setRequiresMfa] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await loginUser({ email: form.email, password: form.password, otp: requiresMfa ? form.otp : undefined });
      const profile = await fetchProfile();
      if (!rememberMe) {
        sessionStorage.setItem('auth', 'true');
      }
      // Redirect based on user role
      const isAdmin = profile.roles?.includes('Admin') || false;
      navigate(isAdmin ? '/admin/users' : '/documents');
    } catch (err: any) {
      const data = err.response?.data;
      if (data?.requiresMfa) {
        setRequiresMfa(true);
        setError('MFA code required. Please enter the code from your authenticator app.');
      } else {
        setError(data?.error || 'Unable to login');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 420, mx: 'auto', mt: 8 }}>
      <Card component="form" onSubmit={handleSubmit}>
        <CardContent>
          <Typography variant="h4" gutterBottom>
            Login
          </Typography>
          <Stack spacing={2}>
            <TextField
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              fullWidth
              required
            />
            <TextField
              label="Password"
              type="password"
              value={form.password}
              onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
              fullWidth
              required
            />
            {requiresMfa && (
              <TextField
                label="MFA Code"
                value={form.otp}
                onChange={(e) => setForm((prev) => ({ ...prev, otp: e.target.value }))}
                fullWidth
              />
            )}
            <FormControlLabel
              control={<Checkbox checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />}
              label="Remember me"
            />
            <Button variant="contained" size="large" type="submit" disabled={loading}>
              {loading ? 'Signing in…' : 'Login'}
            </Button>
            <Typography variant="body2" textAlign="center">
              <Link to="/forgot-password">Forgot Password?</Link>
            </Typography>
            {error && <Alert severity="error">{error}</Alert>}
            {requiresMfa && <Alert severity="info">MFA enabled. Enter your 6-digit code to continue.</Alert>}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
};


