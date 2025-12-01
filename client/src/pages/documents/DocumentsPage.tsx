import { useState } from 'react';
import {
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
  Stack,
  TextField,
  Typography,
  Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ShareIcon from '@mui/icons-material/Share';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  fetchUserDocuments,
  createDocument,
  grantDocumentAccess,
  revokeDocumentAccess,
  requestDocumentAccess,
  type DocumentRecord,
  type DeniedDocumentRecord,
} from '../../api/documents';
import { fetchDepartments } from '../../api/users';
import { authStore } from '../../store/authStore';

export const DocumentsPage = () => {
  const { user } = authStore();
  const documentsQuery = useQuery({ queryKey: ['documents', 'user'], queryFn: fetchUserDocuments });
  const departmentsQuery = useQuery({ queryKey: ['departments'], queryFn: fetchDepartments });
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<DocumentRecord | null>(null);
  const [form, setForm] = useState({ name: '', classification: 'PUBLIC', visibility: 'all' as 'all' | 'specific', departments: [] as string[] });
  const [shareEmail, setShareEmail] = useState('');
  const [permission, setPermission] = useState('read');
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [requestReason, setRequestReason] = useState('');
  const [requestTarget, setRequestTarget] = useState<DeniedDocumentRecord | null>(null);

  const createMutation = useMutation({
    mutationFn: createDocument,
    onSuccess: () => {
      documentsQuery.refetch();
      setCreateDialogOpen(false);
      setForm({ name: '', classification: 'PUBLIC', visibility: 'all', departments: [] });
    },
  });

  const grantMutation = useMutation({
    mutationFn: (payload: { documentId: number; email: string; permission: string }) =>
      grantDocumentAccess(payload.documentId, { email: payload.email, permission: payload.permission }),
    onSuccess: () => documentsQuery.refetch(),
  });

  const revokeMutation = useMutation({
    mutationFn: (payload: { documentId: number; userId: number; permission?: string }) =>
      revokeDocumentAccess(payload.documentId, payload.userId, payload.permission),
    onSuccess: () => documentsQuery.refetch(),
  });

  const requestAccessMutation = useMutation({
    mutationFn: (payload: { documentId: number; reason?: string }) =>
      requestDocumentAccess(payload.documentId, { reason: payload.reason }),
    onSuccess: () => {
      documentsQuery.refetch();
      setRequestDialogOpen(false);
      setRequestReason('');
      setRequestTarget(null);
    },
  });


  const handleCreate = () => {
    if (!form.name.trim()) return;
    createMutation.mutate({
      name: form.name,
      classification: form.classification,
      visibility: form.visibility,
      departments: form.departments,
    });
  };

  const handleGrant = () => {
    if (!selectedDoc || !shareEmail) return;
    grantMutation.mutateAsync({ documentId: selectedDoc.id, email: shareEmail, permission });
    setShareEmail('');
  };

  const handleRevoke = (documentId: number, userId: number, permission?: string) => {
    revokeMutation.mutateAsync({ documentId, userId, permission });
  };

  const documents = documentsQuery.data?.documents || [];
  const denied = (documentsQuery.data?.denied || []) as DeniedDocumentRecord[];

  const openRequestDialog = (doc: DeniedDocumentRecord) => {
    setRequestTarget(doc);
    setRequestReason('');
    setRequestDialogOpen(true);
  };

  const handleSubmitAccessRequest = () => {
    if (!requestTarget) return;
    requestAccessMutation.mutate({
      documentId: requestTarget.id,
      reason: requestReason.trim() || undefined,
    });
  };

  return (
    <Stack spacing={3}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h2" fontSize="1.8rem">
          My Documents
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
        <>
          {denied.length > 0 && (
            <Alert severity="warning">
              <Stack spacing={1}>
                <Typography variant="subtitle2" fontWeight={600}>
                  Access Denied ({denied.length} document{denied.length > 1 ? 's' : ''})
                </Typography>
                {denied.map((doc) => (
                  <Box key={doc.id} sx={{ border: '1px dashed rgba(0,0,0,0.12)', borderRadius: 1, p: 1.5 }}>
                    <Typography variant="body2" fontWeight={600}>
                      {doc.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {doc.reasons?.join(', ') || 'Insufficient permissions'}
                    </Typography>
                    {doc.accessRequest ? (
                      <Typography variant="body2" sx={{ mt: 0.5 }}>
                        Request status: {doc.accessRequest.status}
                        {doc.accessRequest.status === 'APPROVED' && doc.reasons?.length ? ' (REVOKED)' : ''}
                      </Typography>
                    ) : null}
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1 }}>
                      {(!doc.accessRequest || doc.accessRequest.status === 'REJECTED') && doc.canRequestAccess !== false && (
                        <Button variant="outlined" size="small" onClick={() => openRequestDialog(doc)}>
                          Request Access
                        </Button>
                      )}
                      {doc.accessRequest?.status === 'PENDING' && (
                        <Chip size="small" label="Pending review" color="warning" variant="outlined" />
                      )}
                      {doc.accessRequest?.status === 'APPROVED' && (
                        <Chip
                          size="small"
                          label={doc.reasons?.length ? "Revoked" : "Granted (refresh to apply)"}
                          color={doc.reasons?.length ? "error" : "success"}
                          variant="outlined"
                        />
                      )}
                    </Stack>
                  </Box>
                ))}
              </Stack>
            </Alert>
          )}

          {documents.length === 0 ? (
            <Card>
              <CardContent>
                <Typography color="text.secondary" textAlign="center" py={4}>
                  No documents available. Create your first document!
                </Typography>
              </CardContent>
            </Card>
          ) : (
            <Box
              sx={{
                display: 'grid',
                gap: 3,
                gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
              }}
            >
              {documents.map((doc) => (
                <Card key={doc.id}>
                  <CardContent>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Typography variant="h6">{doc.name}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {doc.owner_id === user?.id ? 'You own this' : `Owner: ${doc.owner_name || doc.owner_email}`}
                        </Typography>
                      </Box>
                      <Chip label={doc.classification} color="primary" variant="outlined" />
                    </Stack>
                    {doc.department && (
                      <Chip size="small" label={`Dept: ${doc.department}`} sx={{ mt: 1 }} />
                    )}
                  </CardContent>
                  {doc.owner_id === user?.id && (
                    <CardActions>
                      <Button startIcon={<ShareIcon />} onClick={() => { setSelectedDoc(doc); setShareDialogOpen(true); }}>
                        Share
                      </Button>
                    </CardActions>
                  )}
                </Card>
              ))}
            </Box>
          )}
        </>
      )}

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
              helperText={
                user?.security_level === 'PUBLIC'
                  ? 'You can only create PUBLIC documents'
                  : user?.security_level === 'INTERNAL'
                    ? 'You can create PUBLIC and INTERNAL documents'
                    : 'You can create documents at any classification level'
              }
            >
              <option value="PUBLIC">Public</option>
              {user?.security_level !== 'PUBLIC' && <option value="INTERNAL">Internal</option>}
              {user?.security_level === 'CONFIDENTIAL' && <option value="CONFIDENTIAL">Confidential</option>}
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
                {departmentsQuery.data?.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
                {(!departmentsQuery.data || departmentsQuery.data.length === 0) && (
                  <option disabled>No departments available</option>
                )}
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

      {/* Share Dialog */}
      <Dialog open={shareDialogOpen} onClose={() => setShareDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Share "{selectedDoc?.name}"</DialogTitle>
        <DialogContent>
          <Stack spacing={3}>
            {/* Existing Permissions */}
            {selectedDoc?.shares && selectedDoc.shares.length > 0 && (
              <Box>
                <Typography variant="h6" gutterBottom>
                  Current Permissions
                </Typography>
                <Stack spacing={1}>
                  {selectedDoc.shares.map((share) => (
                    <Box
                      key={share.id}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        p: 1,
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 1,
                      }}
                    >
                      <Box>
                        <Typography variant="body2" fontWeight={500}>
                          {share.email}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Granted {new Date(share.granted_at).toLocaleString()}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip
                          label={
                            share.permission_type === '*' ? 'Full' :
                            share.permission_type === 'edit' ? 'Edit' : 'Read'
                          }
                          size="small"
                          color="primary"
                        />
                        <Button
                          size="small"
                          color="error"
                          onClick={() => handleRevoke(selectedDoc.id, share.user_id, share.permission_type)}
                          disabled={revokeMutation.isPending}
                        >
                          Remove
                        </Button>
                      </Box>
                    </Box>
                  ))}
                </Stack>
              </Box>
            )}

            {/* Grant New Access */}
            <Box>
              <Typography variant="h6" gutterBottom>
                Grant New Access
              </Typography>
              <Stack spacing={2}>
                <TextField
                  label="Email"
                  placeholder="employee@example.com"
                  value={shareEmail}
                  onChange={(e) => setShareEmail(e.target.value)}
                  fullWidth
                />
                <TextField
                  label="Permission"
                  select
                  SelectProps={{ native: true }}
                  value={permission}
                  onChange={(e) => setPermission(e.target.value)}
                  fullWidth
                >
                  <option value="read">Read</option>
                  <option value="edit">Edit</option>
                  <option value="*">Full</option>
                </TextField>
                <Button variant="contained" onClick={handleGrant} disabled={!shareEmail || grantMutation.isPending}>
                  {grantMutation.isPending ? 'Granting...' : 'Grant Access'}
                </Button>
              </Stack>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShareDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Access Request Dialog */}
      <Dialog open={requestDialogOpen} onClose={() => setRequestDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Request Access{requestTarget ? ` for "${requestTarget.name}"` : ''}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Explain why you need access so an administrator can review and grant it.
            </Typography>
            <TextField
              label="Reason (optional)"
              value={requestReason}
              onChange={(e) => setRequestReason(e.target.value)}
              multiline
              minRows={3}
              placeholder="e.g., Need to review for upcoming audit"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRequestDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSubmitAccessRequest}
            disabled={requestAccessMutation.isPending || !requestTarget}
          >
            {requestAccessMutation.isPending ? 'Submitting...' : 'Submit Request'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};


