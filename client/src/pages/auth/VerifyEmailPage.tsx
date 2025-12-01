import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Stack,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import { verifyEmail } from '../../api/auth';

export const VerifyEmailPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setMessage('Invalid verification link. No token provided.');
      return;
    }

    const verify = async () => {
      try {
        const response = await verifyEmail(token);
        setStatus('success');
        setMessage(response.data?.message || 'Email verified successfully! You can now log in.');
      } catch (error: any) {
        setStatus('error');
        setMessage(
          error.response?.data?.error ||
          'Verification failed. The link may be expired or invalid.'
        );
      }
    };

    verify();
  }, [searchParams]);

  const handleLogin = () => {
    navigate('/login');
  };

  const handleResend = () => {
    navigate('/register');
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        p: 2,
      }}
    >
      <Card sx={{ maxWidth: 500, width: '100%', boxShadow: 3 }}>
        <CardContent sx={{ p: 4 }}>
          <Stack spacing={3} alignItems="center">
            {status === 'loading' && (
              <>
                <CircularProgress size={64} />
                <Typography variant="h5" align="center">
                  Verifying your email...
                </Typography>
                <Typography variant="body2" color="text.secondary" align="center">
                  Please wait while we verify your email address.
                </Typography>
              </>
            )}

            {status === 'success' && (
              <>
                <CheckCircleIcon sx={{ fontSize: 64, color: 'success.main' }} />
                <Typography variant="h5" align="center" color="success.main">
                  Email Verified!
                </Typography>
                <Typography variant="body1" align="center">
                  {message}
                </Typography>
                <Button
                  variant="contained"
                  size="large"
                  onClick={handleLogin}
                  sx={{ mt: 2 }}
                >
                  Go to Login
                </Button>
              </>
            )}

            {status === 'error' && (
              <>
                <ErrorIcon sx={{ fontSize: 64, color: 'error.main' }} />
                <Typography variant="h5" align="center" color="error.main">
                  Verification Failed
                </Typography>
                <Alert severity="error" sx={{ width: '100%' }}>
                  {message}
                </Alert>
                <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                  <Button variant="outlined" onClick={handleResend}>
                    Register Again
                  </Button>
                  <Button variant="contained" onClick={handleLogin}>
                    Go to Login
                  </Button>
                </Stack>
              </>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
};
