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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Paper,
} from '@mui/material';
import { ContentCopy, Check } from '@mui/icons-material';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  changePassword,
  enableMfa,
  disableMfa,
  fetchProfile,
  fetchSessions,
  logoutOtherSessions,
  regenerateBackupCodes,
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
  const [mfaSetup, setMfaSetup] = useState<{ secret: string; qrCode: string; backupCodes: string[] } | null>(null);
  const [mfaToken, setMfaToken] = useState('');
  const [mfaMessage, setMfaMessage] = useState<string | null>(null);
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);
  const [roleRequest, setRoleRequest] = useState({ role: '', justification: '' });
  const [roleRequestMessage, setRoleRequestMessage] = useState<string | null>(null);
  const [roleRequestError, setRoleRequestError] = useState<string | null>(null);
  const [disableDialogOpen, setDisableDialogOpen] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableToken, setDisableToken] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

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
      setMfaMessage('Scan the QR code with your authenticator app and save your backup codes.');
    },
  });

  const enableMutation = useMutation({
    mutationFn: (payload: { token: string; backupCodes: string[] }) => enableMfa(payload),
    onSuccess: () => {
      setMfaMessage('MFA enabled successfully!');
      setMfaSetup(null);
      setMfaToken('');
      profileQuery.refetch();
    },
    onError: (err: any) => {
      setMfaMessage(err.response?.data?.error || 'Invalid MFA code');
    },
  });

  const disableMutation = useMutation({
    mutationFn: (payload: { password: string; token: string }) => disableMfa(payload),
    onSuccess: () => {
      setMfaMessage('MFA disabled successfully.');
      setDisableDialogOpen(false);
      setDisablePassword('');
      setDisableToken('');
      profileQuery.refetch();
    },
    onError: (err: any) => {
      setMfaMessage(err.response?.data?.error || 'Unable to disable MFA');
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: (payload: { token: string }) => regenerateBackupCodes(payload),
    onSuccess: (response) => {
      const codes = response.data.backupCodes;
      setMfaSetup({ secret: '', qrCode: '', backupCodes: codes });
      setMfaMessage('New backup codes generated. Save them securely!');
    },
    onError: (err: any) => {
      setMfaMessage(err.response?.data?.error || 'Unable to regenerate backup codes');
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

  const handleEnableMfa = () => {
    if (mfaSetup?.backupCodes) {
      enableMutation.mutate({ token: mfaToken, backupCodes: mfaSetup.backupCodes });
    }
  };

  const handleDisableMfa = () => {
    disableMutation.mutate({ password: disablePassword, token: disableToken });
  };

  const handleCopyCode = (code: string, index: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const getAvailableSecurityLevels = () => {
    if (!user?.security_level) return [];
    const levels = ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL'];
    const currentIndex = levels.indexOf(user.security_level);
    return levels.slice(currentIndex + 1);
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
                <Typography variant="h6">Two-Factor Authentication</Typography>
                <Chip label={user?.mfa_enabled ? 'Enabled' : 'Disabled'} color={user?.mfa_enabled ? 'success' : 'default'} />
              </Stack>
              <Stack spacing={2}>
                {user?.mfa_enabled ? (
                  <>
                    <Alert severity="success">
                      MFA is currently enabled for your account. Your account is protected with two-factor authentication.
                    </Alert>
                    <Stack direction="row" spacing={2}>
                      <Button
                        variant="outlined"
                        onClick={() => {
                          const token = prompt('Enter your current 6-digit MFA code to regenerate backup codes:');
                          if (token) regenerateMutation.mutate({ token });
                        }}
                        disabled={regenerateMutation.isPending}
                      >
                        Regenerate Backup Codes
                      </Button>
                      <Button
                        variant="outlined"
                        color="error"
                        onClick={() => setDisableDialogOpen(true)}
                      >
                        Disable MFA
                      </Button>
                    </Stack>
                  </>
                ) : (
                  <>
                    {!mfaSetup ? (
                      <>
                        <Typography variant="body2" color="text.secondary">
                          Add an extra layer of security to your account by enabling two-factor authentication.
                        </Typography>
                        <Button variant="contained" onClick={() => setupMutation.mutate()}>
                          Enable Two-Factor Authentication
                        </Button>
                      </>
                    ) : (
                      <>
                        <Alert severity="info">
                          Follow these steps to enable 2FA:
                        </Alert>
                        <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                          <Typography variant="subtitle2" gutterBottom>
                            Step 1: Scan QR Code
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            Open your authenticator app (Google Authenticator, Authy, Microsoft Authenticator, etc.) and scan this QR code:
                          </Typography>
                          {mfaSetup.qrCode && (
                            <Box sx={{ textAlign: 'center', my: 2 }}>
                              <Box
                                sx={{
                                  maxWidth: 250,
                                  width: '100%',
                                  border: '2px solid',
                                  borderColor: 'divider',
                                  borderRadius: 1,
                                  p: 1,
                                  bgcolor: 'white',
                                  display: 'inline-block'
                                }}
                              >
                                <img
                                  src={mfaSetup.qrCode}
                                  alt="MFA QR Code"
                                  style={{ width: '100%', display: 'block' }}
                                />
                              </Box>
                            </Box>
                          )}
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                            Or manually enter this secret: <strong>{mfaSetup.secret}</strong>
                          </Typography>
                        </Paper>

                        {mfaSetup.backupCodes && mfaSetup.backupCodes.length > 0 && (
                          <Paper sx={{ p: 2, bgcolor: 'warning.light' }}>
                            <Typography variant="subtitle2" gutterBottom color="warning.dark">
                              Step 2: Save Your Backup Codes
                            </Typography>
                            <Alert severity="warning" sx={{ mb: 2 }}>
                              Save these backup codes in a secure place. You can use them to access your account if you lose your authenticator device.
                            </Alert>
                            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                              {mfaSetup.backupCodes.map((code, index) => (
                                <Paper
                                  key={index}
                                  sx={{
                                    p: 1,
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    bgcolor: 'background.paper'
                                  }}
                                >
                                  <Typography variant="body2" fontFamily="monospace">
                                    {code}
                                  </Typography>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleCopyCode(code, index)}
                                    color={copiedIndex === index ? 'success' : 'default'}
                                  >
                                    {copiedIndex === index ? <Check fontSize="small" /> : <ContentCopy fontSize="small" />}
                                  </IconButton>
                                </Paper>
                              ))}
                            </Box>
                          </Paper>
                        )}

                        <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                          <Typography variant="subtitle2" gutterBottom>
                            Step 3: Verify Setup
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            Enter the 6-digit code from your authenticator app to complete setup:
                          </Typography>
                          <TextField
                            label="6-Digit Code"
                            value={mfaToken}
                            onChange={(e) => setMfaToken(e.target.value)}
                            fullWidth
                            placeholder="000000"
                            inputProps={{ maxLength: 6 }}
                          />
                        </Paper>
                        <Button
                          variant="contained"
                          onClick={handleEnableMfa}
                          disabled={enableMutation.isPending || mfaToken.length !== 6}
                        >
                          {enableMutation.isPending ? 'Verifying...' : 'Complete Setup'}
                        </Button>
                        <Button
                          variant="text"
                          onClick={() => {
                            setMfaSetup(null);
                            setMfaToken('');
                            setMfaMessage(null);
                          }}
                        >
                          Cancel
                        </Button>
                      </>
                    )}
                    {mfaMessage && <Alert severity={mfaMessage.includes('success') ? 'success' : 'info'}>{mfaMessage}</Alert>}
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

      {/* Disable MFA Dialog */}
      <Dialog open={disableDialogOpen} onClose={() => setDisableDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Disable Two-Factor Authentication</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Disabling 2FA will make your account less secure. You'll need to enter your password and a verification code to proceed.
          </Alert>
          <Stack spacing={2}>
            <TextField
              label="Current Password"
              type="password"
              value={disablePassword}
              onChange={(e) => setDisablePassword(e.target.value)}
              fullWidth
              autoFocus
            />
            <TextField
              label="6-Digit MFA Code or Backup Code"
              value={disableToken}
              onChange={(e) => setDisableToken(e.target.value)}
              fullWidth
              placeholder="Enter OTP or backup code"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDisableDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleDisableMfa}
            color="error"
            variant="contained"
            disabled={disableMutation.isPending || !disablePassword || !disableToken}
          >
            {disableMutation.isPending ? 'Disabling...' : 'Disable MFA'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

