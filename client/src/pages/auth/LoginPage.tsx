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
import { useNavigate } from 'react-router-dom';
import { loginUser, fetchProfile } from '../../api/auth';

export const LoginPage = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', otp: '', backupCode: '' });
  const [rememberMe, setRememberMe] = useState(false);
  const [requiresMfa, setRequiresMfa] = useState(false);
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const payload: any = { email: form.email, password: form.password };
      if (requiresMfa) {
        if (useBackupCode) {
          payload.backupCode = form.backupCode;
        } else {
          payload.otp = form.otp;
        }
      }
      await loginUser(payload);
      const profile = await fetchProfile();
      if (!rememberMe) {
        sessionStorage.setItem('auth', 'true');
      }
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
              <>
                {useBackupCode ? (
                  <>
                    <TextField
                      label="Backup Code"
                      value={form.backupCode}
                      onChange={(e) => setForm((prev) => ({ ...prev, backupCode: e.target.value }))}
                      fullWidth
                      placeholder="Enter 8-digit backup code"
                    />
                    <Button
                      variant="text"
                      size="small"
                      onClick={() => setUseBackupCode(false)}
                      sx={{ alignSelf: 'flex-start' }}
                    >
                      Use authenticator app instead
                    </Button>
                  </>
                ) : (
                  <>
                    <TextField
                      label="MFA Code"
                      value={form.otp}
                      onChange={(e) => setForm((prev) => ({ ...prev, otp: e.target.value }))}
                      fullWidth
                      placeholder="Enter 6-digit code"
                    />
                    <Button
                      variant="text"
                      size="small"
                      onClick={() => setUseBackupCode(true)}
                      sx={{ alignSelf: 'flex-start' }}
                    >
                      Use backup code instead
                    </Button>
                  </>
                )}
              </>
            )}
            <FormControlLabel
              control={<Checkbox checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />}
              label="Remember me"
            />
            <Button variant="contained" size="large" type="submit" disabled={loading}>
              {loading ? 'Signing in…' : 'Login'}
            </Button>
            <Button variant="text" size="small" onClick={() => navigate('/register')}>
              Register
            </Button>
            {error && <Alert severity="error">{error}</Alert>}
            {requiresMfa && <Alert severity="info">MFA enabled. Enter your {useBackupCode ? 'backup code' : '6-digit code'} to continue.</Alert>}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
};


