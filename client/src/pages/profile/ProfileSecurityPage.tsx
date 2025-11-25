import { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  MenuItem,
  Alert,
  Divider,
} from '@mui/material';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  changePassword,
  enableMfa,
  fetchProfile,
  fetchSessions,
  logoutOtherSessions,
  revokeSession,
  setupMfa,
  submitRoleRequest,
} from '../../api/auth';
import { authStore } from '../../store/authStore';

export const ProfileSecurityPage = () => {
  const user = authStore((state) => state.user);
  const profileQuery = useQuery({ queryKey: ['profile'], queryFn: fetchProfile });
  const sessionsQuery = useQuery({ queryKey: ['sessions'], queryFn: fetchSessions });
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [mfaSetup, setMfaSetup] = useState<{ secret: string; qrCode: string } | null>(null);
  const [mfaToken, setMfaToken] = useState('');
  const [mfaMessage, setMfaMessage] = useState<string | null>(null);
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);
  const [roleRequest, setRoleRequest] = useState({ role: '', justification: '' });
  const [roleRequestMessage, setRoleRequestMessage] = useState<string | null>(null);
  const [roleRequestError, setRoleRequestError] = useState<string | null>(null);

  const passwordMutation = useMutation({
    mutationFn: (payload: { currentPassword: string; newPassword: string }) => changePassword(payload),
    onSuccess: () => {
      setPasswordMessage('Password updated successfully.');
      setPasswords({ current: '', next: '', confirm: '' });
      setPasswordError(null);
    },
    onError: (err: any) => {
      setPasswordError(err.response?.data?.error || 'Unable to change password');
      setPasswordMessage(null);
    },
  });

  const setupMutation = useMutation({
    mutationFn: setupMfa,
    onSuccess: (response) => {
      setMfaSetup(response.data || response);
      setMfaMessage('Scan the QR code with your authenticator app.');
    },
  });

  const enableMutation = useMutation({
    mutationFn: (payload: { token: string }) => enableMfa(payload),
    onSuccess: () => {
      setMfaMessage('MFA enabled!');
      setMfaSetup(null);
      setMfaToken('');
      profileQuery.refetch();
    },
    onError: (err: any) => {
      setMfaMessage(err.response?.data?.error || 'Invalid MFA code');
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (id: number) => revokeSession(id),
    onSuccess: () => {
      setSessionMessage('Session revoked.');
      sessionsQuery.refetch();
    },
  });

  const logoutOthersMutation = useMutation({
    mutationFn: () => logoutOtherSessions(),
    onSuccess: () => {
      setSessionMessage('All sessions terminated.');
      sessionsQuery.refetch();
    },
  });

  const roleRequestMutation = useMutation({
    mutationFn: (payload: { role: string; justification: string }) => submitRoleRequest(payload),
    onSuccess: () => {
      setRoleRequestMessage('Role request submitted successfully. An administrator will review it.');
      setRoleRequest({ role: '', justification: '' });
      setRoleRequestError(null);
    },
    onError: (err: any) => {
      setRoleRequestError(err.response?.data?.error || 'Unable to submit role request');
      setRoleRequestMessage(null);
    },
  });

  const handlePasswordChange = () => {
    if (passwords.next !== passwords.confirm) {
      setPasswordError('New passwords do not match.');
      setPasswordMessage(null);
      return;
    }
    passwordMutation.mutate({ currentPassword: passwords.current, newPassword: passwords.next });
  };

  const handleRoleRequest = () => {
    if (!roleRequest.role || !roleRequest.justification) {
      setRoleRequestError('Please fill in all fields');
      return;
    }
    roleRequestMutation.mutate(roleRequest);
  };

  // Security levels that can be requested (only upgrades)
  const getAvailableSecurityLevels = () => {
    if (!user?.security_level) return [];
    const levels = ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL'];
    const currentIndex = levels.indexOf(user.security_level);
    return levels.slice(currentIndex + 1); // Only show levels higher than current
  };

  const availableLevels = getAvailableSecurityLevels();

  const sessions = sessionsQuery.data || [];

  return (
    <Stack spacing={3}>
      <Typography variant="h2" fontSize="1.8rem">
        Profile Security
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gap: 3,
          gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
        }}
      >
        <Stack spacing={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Password Change
              </Typography>
              <Stack spacing={2}>
                <TextField
                  label='Current Password'
                  type="password"
                  value={passwords.current}
                  onChange={(e) => setPasswords((prev) => ({ ...prev, current: e.target.value }))}
                  fullWidth
                />
                <TextField
                  label='New Password'
                  type="password"
                  value={passwords.next}
                  onChange={(e) => setPasswords((prev) => ({ ...prev, next: e.target.value }))}
                  fullWidth
                />
                <TextField
                  label='Confirm New Password'
                  type="password"
                  value={passwords.confirm}
                  onChange={(e) => setPasswords((prev) => ({ ...prev, confirm: e.target.value }))}
                  fullWidth
                />
                <Button variant="contained" onClick={handlePasswordChange} disabled={passwordMutation.isPending}>
                  {passwordMutation.isPending ? 'Saving…' : 'Change Password'}
                </Button>
                {passwordMessage && <Typography color="success.main">{passwordMessage}</Typography>}
                {passwordError && <Typography color="error.main">{passwordError}</Typography>}
              </Stack>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Typography variant="h6">Multi-Factor Authentication</Typography>
                <Chip label={user?.mfa_enabled ? 'Enabled' : 'Disabled'} color={user?.mfa_enabled ? 'success' : 'default'} />
              </Stack>
              <Stack spacing={2}>
                {user?.mfa_enabled ? (
                  <Typography variant="body2" color="text.secondary">
                    MFA is currently enabled for your account.
                  </Typography>
                ) : (
                  <>
                    {!mfaSetup ? (
                      <Button variant="contained" onClick={() => setupMutation.mutate()}>
                        Generate Secret
                      </Button>
                    ) : (
                      <>
                        <Typography variant="body2" color="text.secondary">
                          Secret: {mfaSetup.secret}
                        </Typography>
                        {mfaSetup.qrCode && (
                          <Box component="img" src={mfaSetup.qrCode} alt="MFA QR" sx={{ maxWidth: 200 }} />
                        )}
                        <TextField
                          label="OTP Code"
                          value={mfaToken}
                          onChange={(e) => setMfaToken(e.target.value)}
                          fullWidth
                        />
                        <Button variant="contained" onClick={() => enableMutation.mutate({ token: mfaToken })}>
                          Enable MFA
                        </Button>
                      </>
                    )}
                    {mfaMessage && <Typography color="info.main">{mfaMessage}</Typography>}
                  </>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Stack>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Active Sessions
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>User Agent</TableCell>
                  <TableCell>IP</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {sessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell>{session.user_agent || 'Unknown client'}</TableCell>
                    <TableCell>{session.ip_address || '—'}</TableCell>
                    <TableCell>{new Date(session.created_at).toLocaleString()}</TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        variant="text"
                        color="error"
                        onClick={() => revokeMutation.mutate(session.id)}
                        disabled={revokeMutation.isPending}
                      >
                        Logout
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!sessions.length && (
                  <TableRow>
                    <TableCell colSpan={4}>
                      <Typography color="text.secondary">No active sessions.</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <Box sx={{ mt: 2, textAlign: 'right' }}>
              <Button color="warning" onClick={() => logoutOthersMutation.mutate()} disabled={logoutOthersMutation.isPending}>
                {logoutOthersMutation.isPending ? 'Logging out…' : 'Logout All Devices'}
              </Button>
            </Box>
            {sessionMessage && <Typography color="info.main">{sessionMessage}</Typography>}
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Security Level Upgrade Request
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Request a security level upgrade to access higher classification documents. Your request will be reviewed by an administrator.
            </Typography>
            <Stack spacing={2}>
              <TextField
                label="Current Security Level"
                value={user?.security_level || 'Unknown'}
                fullWidth
                disabled
                sx={{ '& .MuiInputBase-input': { color: 'text.primary' } }}
              />
              <TextField
                label="Requested Security Level"
                select
                value={roleRequest.role}
                onChange={(e) => setRoleRequest({ ...roleRequest, role: e.target.value })}
                fullWidth
                disabled={roleRequestMutation.isPending || availableLevels.length === 0}
                helperText={
                  availableLevels.length === 0
                    ? 'You already have the highest security level (CONFIDENTIAL)'
                    : 'You can only request upgrades, not downgrades'
                }
              >
                <MenuItem value="">Select a security level</MenuItem>
                {availableLevels.map((level) => (
                  <MenuItem key={level} value={level}>
                    {level}
                    {level === 'INTERNAL' && ' - Access to INTERNAL documents'}
                    {level === 'CONFIDENTIAL' && ' - Access to all documents (PUBLIC, INTERNAL, CONFIDENTIAL)'}
                  </MenuItem>
                ))}
              </TextField>
              {availableLevels.length === 0 && (
                <Alert severity="info">You already have the highest security level (CONFIDENTIAL).</Alert>
              )}
              <TextField
                label="Justification"
                multiline
                rows={4}
                value={roleRequest.justification}
                onChange={(e) => setRoleRequest({ ...roleRequest, justification: e.target.value })}
                fullWidth
                placeholder="Explain why you need this role..."
                disabled={roleRequestMutation.isPending}
              />
              <Button
                variant="contained"
                onClick={handleRoleRequest}
                disabled={roleRequestMutation.isPending || !roleRequest.role || !roleRequest.justification}
              >
                {roleRequestMutation.isPending ? 'Submitting...' : 'Submit Request'}
              </Button>
              {roleRequestMessage && <Alert severity="success">{roleRequestMessage}</Alert>}
              {roleRequestError && <Alert severity="error">{roleRequestError}</Alert>}
            </Stack>
            <Divider sx={{ my: 3 }} />
            <Typography variant="subtitle2" gutterBottom>
              Security Level Information
            </Typography>
            <Stack spacing={1}>
              <Typography variant="body2">
                <strong>Current Level:</strong> {user?.security_level || 'Unknown'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {user?.security_level === 'PUBLIC' && 'You can access and create PUBLIC documents only.'}
                {user?.security_level === 'INTERNAL' && 'You can access and create PUBLIC and INTERNAL documents.'}
                {user?.security_level === 'CONFIDENTIAL' && 'You can access and create all document classifications.'}
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      </Box>
    </Stack>
  );
};

