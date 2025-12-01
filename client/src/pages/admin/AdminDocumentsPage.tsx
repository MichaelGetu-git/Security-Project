import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ShareIcon from '@mui/icons-material/Share';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  fetchAdminDocuments,
  grantDocumentAccess,
  revokeDocumentAccess,
  createDocument,
  fetchDocumentAccessRequests,
  resolveDocumentAccessRequest,
  type DocumentRecord,
  type DocumentAccessRequest,
} from '../../api/documents';
import { fetchUsers, type DirectoryUser } from '../../api/users';

export const AdminDocumentsPage = () => {
  const documentsQuery = useQuery({ queryKey: ['documents', 'admin'], queryFn: fetchAdminDocuments });
  const accessRequestsQuery = useQuery({
    queryKey: ['documents', 'access-requests'],
    queryFn: () => fetchDocumentAccessRequests(),
  });

  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: () => fetchUsers(),
  });
  const [selectedDoc, setSelectedDoc] = useState<DocumentRecord | null>(null);
  const [shareEmail, setShareEmail] = useState('');
  const [permission, setPermission] = useState('read');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: '', classification: 'PUBLIC', visibility: 'all' as 'all' | 'specific', departments: [] as string[] });
  const [decisionDialog, setDecisionDialog] = useState<{
    open: boolean;
    request: DocumentAccessRequest | null;
    action: 'APPROVE' | 'REJECT';
  }>({ open: false, request: null, action: 'APPROVE' });
  const [decisionNote, setDecisionNote] = useState('');
  const [decisionPermission, setDecisionPermission] = useState('read');
  const [successMessage, setSuccessMessage] = useState<string>('');

  const createMutation = useMutation({
    mutationFn: createDocument,
    onSuccess: () => {
      documentsQuery.refetch();
      setCreateDialogOpen(false);
      setForm({ name: '', classification: 'PUBLIC', visibility: 'all', departments: [] });
    },
  });

  const grantMutation = useMutation({
    mutationFn: (payload: { documentId: number; email?: string; userId?: number; permission: string }) => {
      const apiPayload = payload.email
        ? { email: payload.email, permission: payload.permission }
        : { userId: payload.userId!, permission: payload.permission };
      return grantDocumentAccess(payload.documentId, apiPayload);
    },
    onSuccess: (data, variables) => {
      documentsQuery.refetch();
      accessRequestsQuery.refetch();
      const selectedUser = usersQuery.data?.find(u => u.email === variables.email || u.id === variables.userId);
      setSuccessMessage(`Successfully granted ${variables.permission} access to "${selectedDoc?.name}" for ${selectedUser?.username || 'user'}. The user may need to refresh their documents page to see the changes.`);
    },
  });

  const revokeMutation = useMutation({
    mutationFn: ({ documentId, userId, permission }: { documentId: number; userId: number; permission?: string }) =>
      revokeDocumentAccess(documentId, userId, permission),
    onSuccess: () => {
      documentsQuery.refetch();
      accessRequestsQuery.refetch();
    },
  });

  const resolveRequestMutation = useMutation({
    mutationFn: (payload: { id: number; status: 'APPROVED' | 'REJECTED'; note?: string; permission?: string }) =>
      resolveDocumentAccessRequest(payload.id, {
        status: payload.status,
        note: payload.note,
        permission: payload.permission,
      }),
    onSuccess: () => {
      accessRequestsQuery.refetch();
      documentsQuery.refetch();
      setDecisionDialog({ open: false, request: null, action: 'APPROVE' });
      setDecisionNote('');
      setDecisionPermission('read');
    },
  });

  const handleGrant = async () => {
    if (!selectedDoc || !shareEmail) return;
    try {
      await grantMutation.mutateAsync({ documentId: selectedDoc.id, email: shareEmail, permission });
      setShareEmail('');
      setPermission('read'); // Reset permission
      setSelectedDoc(null); // Close the dialog
    } catch (error) {
      console.error('Grant failed:', error);
      setSuccessMessage(`Failed to grant access: ${error}`);
    }
  };

  const handleCreate = () => {
    if (!form.name.trim()) return;
    createMutation.mutate({
      name: form.name,
      classification: form.classification,
      visibility: form.visibility,
      departments: form.departments,
    });
  };

  const openDecisionDialog = (request: DocumentAccessRequest, action: 'APPROVE' | 'REJECT') => {
    setDecisionDialog({ open: true, request, action });
    setDecisionNote('');
    setDecisionPermission('read');
  };

  const handleResolveRequest = () => {
    if (!decisionDialog.request) return;
    resolveRequestMutation.mutate({
      id: decisionDialog.request.id,
      status: decisionDialog.action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
      note: decisionNote.trim() || undefined,
      permission: decisionDialog.action === 'APPROVE' ? decisionPermission : undefined,
    });
  };

  const requests = accessRequestsQuery.data || [];
  const pendingRequests = requests.filter((req) => req.status === 'PENDING');
  const approvedRequests = requests.filter((req) => req.status === 'APPROVED');

  return (
    <Stack spacing={3}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h2" fontSize="1.8rem">
          Document Management
        </Typography>
        <Button startIcon={<AddIcon />} variant="contained" onClick={() => setCreateDialogOpen(true)}>
          Create Document
        </Button>
      </Stack>
      {documentsQuery.isLoading ? (
        <Stack alignItems="center" py={4}>
          <CircularProgress />
        </Stack>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gap: 3,
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
          }}
        >
          {(documentsQuery.data || []).map((doc) => (
            <Card key={doc.id}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="h6">{doc.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Owner: {doc.owner_name || doc.owner_email}
                    </Typography>
                  </Box>
                  <Chip label={doc.classification} color="primary" variant="outlined" />
                </Stack>
                <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                  <Chip size="small" label={`Dept: ${doc.department || 'N/A'}`} />
                  <Chip size="small" label="MAC" color="warning" variant="outlined" />
                  <Chip size="small" label="ABAC" color="success" variant="outlined" />
                  <Chip size="small" label="DAC" color="info" variant="outlined" />
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Shares: {doc.shares.length}
                </Typography>
              </CardContent>
              <CardActions>
                <Button startIcon={<ShareIcon />} onClick={() => setSelectedDoc(doc)}>
                  Share / Permissions
                </Button>
              </CardActions>
            </Card>
          ))}
        </Box>
      )}

      <Card>
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }}>
            <Typography variant="h6">Access Requests</Typography>
            {accessRequestsQuery.isLoading && <CircularProgress size={24} />}
          </Stack>
          <Stack spacing={3} sx={{ mt: 2 }}>
            <Box>
              <Typography fontWeight={600} gutterBottom>
                Pending ({pendingRequests.length})
              </Typography>
              {!pendingRequests.length ? (
                <Typography variant="body2" color="text.secondary">
                  No pending requests.
                </Typography>
              ) : (
                <Stack spacing={2}>
                  {pendingRequests.map((request) => {
                    const document = documentsQuery.data?.find(doc => doc.id === request.document_id);
                    return (
                      <Card key={request.id} variant="outlined">
                        <CardContent>
                          <Typography fontWeight={600}>{request.document_name || `Document #${request.document_id}`}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            Requested by {request.requester_username || request.user_id} • {new Date(request.created_at).toLocaleString()}
                          </Typography>
                          {request.reason && (
                            <Typography variant="body2" sx={{ mt: 1 }}>
                              Reason: {request.reason}
                            </Typography>
                          )}

                          {/* Show current permissions for this document */}
                          {document?.shares && document.shares.length > 0 && (
                            <Box sx={{ mt: 2, p: 1.5, bgcolor: 'grey.50', borderRadius: 1 }}>
                              <Typography variant="body2" fontWeight={500} gutterBottom>
                                Current Permissions:
                              </Typography>
                              <Stack spacing={0.5}>
                                {document.shares.map((share) => (
                                  <Box key={share.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Typography variant="caption">
                                      {share.email}
                                    </Typography>
                                    <Chip
                                      label={
                                        share.permission_type === '*' ? 'Full' :
                                        share.permission_type === 'edit' ? 'Edit' : 'Read'
                                      }
                                      size="small"
                                      variant="outlined"
                                    />
                                  </Box>
                                ))}
                              </Stack>
                            </Box>
                          )}

                          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 2 }}>
                            <Button variant="contained" onClick={() => openDecisionDialog(request, 'APPROVE')}>
                              Grant Access
                            </Button>
                            <Button variant="outlined" color="inherit" onClick={() => openDecisionDialog(request, 'REJECT')}>
                              Reject
                            </Button>
                          </Stack>
                        </CardContent>
                      </Card>
                    );
                  })}
                </Stack>
              )}
            </Box>
            <Box>
              <Typography fontWeight={600} gutterBottom>
                Approved Access ({approvedRequests.length})
              </Typography>
              {!approvedRequests.length ? (
                <Typography variant="body2" color="text.secondary">
                  No approved requests yet.
                </Typography>
              ) : (
                <Stack spacing={2}>
                  {approvedRequests.map((request) => {
                    const document = documentsQuery.data?.find(doc => doc.id === request.document_id);
                    const userPermission = document?.shares?.find(share => share.user_id === request.user_id);

                    return (
                      <Card key={request.id} variant="outlined" sx={{ opacity: userPermission ? 0.8 : 0.5 }}>
                        <CardContent>
                          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                            <Box>
                              <Typography fontWeight={600}>
                                {request.document_name || `Document #${request.document_id}`}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                Granted to {request.requester_username || request.user_id}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Approved {request.resolved_at ? new Date(request.resolved_at).toLocaleString() : ''}
                              </Typography>
                              {userPermission ? (
                                <Box sx={{ mt: 1 }}>
                                  <Chip
                                    label={
                                      userPermission.permission_type === '*' ? 'Full Access' :
                                      userPermission.permission_type === 'edit' ? 'Edit Access' : 'Read Access'
                                    }
                                    size="small"
                                    color="success"
                                  />
                                </Box>
                              ) : (
                                <Box sx={{ mt: 1 }}>
                                  <Chip
                                    label="Access Revoked"
                                    size="small"
                                    color="warning"
                                    variant="outlined"
                                  />
                                </Box>
                              )}
                            </Box>
                            <Stack direction="row" spacing={1}>
                              {userPermission ? (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  color="error"
                                  onClick={() => {
                                    revokeMutation.mutate({
                                      documentId: document!.id,
                                      userId: request.user_id,
                                      permission: userPermission.permission_type
                                    });
                                  }}
                                  disabled={revokeMutation.isPending}
                                >
                                  Revoke
                                </Button>
                              ) : (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  color="primary"
                                  onClick={() => {
                                    // Re-grant access using user ID from request
                                    grantMutation.mutate({
                                      documentId: document!.id,
                                      userId: request.user_id,
                                      permission: 'read'
                                    });
                                  }}
                                  disabled={grantMutation.isPending}
                                >
                                  Re-grant
                                </Button>
                              )}
                            </Stack>
                          </Stack>
                        </CardContent>
                      </Card>
                    );
                  })}
                </Stack>
              )}
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <Dialog open={!!selectedDoc} onClose={() => setSelectedDoc(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Share "{selectedDoc?.name}"</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <TextField
              select
              label="Select User"
              value={shareEmail}
              onChange={(e) => setShareEmail(e.target.value)}
              fullWidth
              helperText="Choose a user to grant access to"
              disabled={usersQuery.isLoading}
            >
              {(usersQuery.data || []).map((user: DirectoryUser) => (
                <MenuItem key={user.id} value={user.email}>
                  <Box>
                    <Typography variant="body2" fontWeight={500}>
                      {user.username}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {user.email}
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Permission"
              select
              SelectProps={{ native: true }}
              value={permission}
              onChange={(e) => setPermission(e.target.value)}
            >
              <option value="read">Read</option>
              <option value="edit">Edit</option>
              <option value="*">Full</option>
            </TextField>
            <Button variant="contained" onClick={handleGrant} disabled={!shareEmail || grantMutation.isPending}>
              {grantMutation.isPending ? 'Granting...' : 'Grant Access'}
            </Button>
            <Box>
              <Typography fontWeight={600} sx={{ mb: 1 }}>
                Current Access
              </Typography>
              <List dense>
                {selectedDoc?.shares.map((share) => (
                  <ListItem
                    key={share.id}
                    secondaryAction={
                      <IconButton
                        edge="end"
                        onClick={() =>
                          revokeMutation.mutate({
                            documentId: selectedDoc.id,
                            userId: share.user_id,
                            permission: share.permission_type,
                          })
                        }
                      >
                        <DeleteIcon />
                      </IconButton>
                    }
                  >
                    <ListItemText primary={share.email} secondary={share.permission_type} />
                  </ListItem>
                ))}
                {!selectedDoc?.shares.length && (
                  <Typography variant="body2" color="text.secondary">
                    No grants yet.
                  </Typography>
                )}
              </List>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedDoc(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Create Document Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Document</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Document Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Classification"
              select
              SelectProps={{ native: true }}
              value={form.classification}
              onChange={(e) => setForm({ ...form, classification: e.target.value })}
              fullWidth
            >
              <option value="PUBLIC">Public</option>
              <option value="INTERNAL">Internal</option>
              <option value="CONFIDENTIAL">Confidential</option>
            </TextField>
            <TextField
              label="Visibility"
              select
              SelectProps={{ native: true }}
              value={form.visibility}
              onChange={(e) => setForm({ ...form, visibility: e.target.value as 'all' | 'specific', departments: e.target.value === 'all' ? [] : form.departments })}
              fullWidth
              helperText={
                form.visibility === 'all'
                  ? 'Document will be visible to all users'
                  : 'Document will only be visible to selected departments'
              }
            >
              <option value="all">All Departments</option>
              <option value="specific">Specific Departments</option>
            </TextField>

            {form.visibility === 'specific' && (
              <TextField
                label="Select Departments"
                select
                SelectProps={{
                  native: true,
                  multiple: true,
                }}
                value={form.departments}
                onChange={(e) => {
                  const target = e.target as unknown as HTMLSelectElement;
                  const selectedOptions = Array.from(target.selectedOptions, (option) => option.value);
                  setForm({ ...form, departments: selectedOptions });
                }}
                fullWidth
                helperText="Hold Ctrl/Cmd to select multiple departments"
              >
                <option value="" disabled>No departments available</option>
              </TextField>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={!form.name.trim() || createMutation.isPending}>
            {createMutation.isPending ? 'Creating...' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Access Request Decision Dialog */}
      <Dialog open={decisionDialog.open} onClose={() => setDecisionDialog({ open: false, request: null, action: 'APPROVE' })} maxWidth="sm" fullWidth>
        <DialogTitle>
          {decisionDialog.action === 'APPROVE' ? 'Grant Access' : 'Reject Access Request'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {decisionDialog.request
                ? `Request from ${decisionDialog.request.requester_username || decisionDialog.request.user_id} for "${
                    decisionDialog.request.document_name || `Document #${decisionDialog.request.document_id}`
                  }".`
                : 'No request selected.'}
            </Typography>
            {decisionDialog.action === 'APPROVE' && (
              <TextField
                label="Permission"
                select
                SelectProps={{ native: true }}
                value={decisionPermission}
                onChange={(e) => setDecisionPermission(e.target.value)}
              >
                <option value="read">Read</option>
                <option value="edit">Edit</option>
                <option value="*">Full</option>
              </TextField>
            )}
            <TextField
              label="Note (optional)"
              value={decisionNote}
              onChange={(e) => setDecisionNote(e.target.value)}
              multiline
              minRows={3}
              placeholder={decisionDialog.action === 'APPROVE' ? 'Provide context for the approval' : 'Explain why this was rejected'}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDecisionDialog({ open: false, request: null, action: 'APPROVE' })}>Cancel</Button>
          <Button
            variant="contained"
            color={decisionDialog.action === 'APPROVE' ? 'primary' : 'error'}
            onClick={handleResolveRequest}
            disabled={resolveRequestMutation.isPending || !decisionDialog.request}
          >
            {resolveRequestMutation.isPending ? 'Saving...' : decisionDialog.action === 'APPROVE' ? 'Grant Access' : 'Reject Request'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!successMessage}
        autoHideDuration={6000}
        onClose={() => setSuccessMessage('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSuccessMessage('')}
          severity={successMessage.includes('Failed') ? 'error' : 'success'}
          sx={{ width: '100%' }}
        >
          {successMessage}
        </Alert>
      </Snackbar>
    </Stack>
  );
};
