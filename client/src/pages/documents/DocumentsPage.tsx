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
import { fetchUserDocuments, createDocument, grantDocumentAccess, type DocumentRecord } from '../../api/documents';
import { authStore } from '../../store/authStore';

export const DocumentsPage = () => {
  const { user } = authStore();
  const documentsQuery = useQuery({ queryKey: ['documents', 'user'], queryFn: fetchUserDocuments });
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<DocumentRecord | null>(null);
  const [form, setForm] = useState({ name: '', classification: 'PUBLIC', department: '' });
  const [shareEmail, setShareEmail] = useState('');
  const [permission, setPermission] = useState('read');

  const createMutation = useMutation({
    mutationFn: createDocument,
    onSuccess: () => {
      documentsQuery.refetch();
      setCreateDialogOpen(false);
      setForm({ name: '', classification: 'PUBLIC', department: '' });
    },
  });

  const grantMutation = useMutation({
    mutationFn: (payload: { documentId: number; email: string; permission: string }) =>
      grantDocumentAccess(payload.documentId, { email: payload.email, permission: payload.permission }),
    onSuccess: () => documentsQuery.refetch(),
  });


  const handleCreate = () => {
    if (!form.name.trim()) return;
    createMutation.mutate({
      name: form.name,
      classification: form.classification,
      department: form.department || undefined,
    });
  };

  const handleGrant = () => {
    if (!selectedDoc || !shareEmail) return;
    grantMutation.mutateAsync({ documentId: selectedDoc.id, email: shareEmail, permission });
    setShareEmail('');
  };

  const documents = documentsQuery.data?.documents || [];
  const denied = documentsQuery.data?.denied || [];

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
              <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                Access Denied ({denied.length} document{denied.length > 1 ? 's' : ''})
              </Typography>
              {denied.map((doc: any) => (
                <Typography key={doc.id} variant="body2">
                  • {doc.name}: {doc.reasons?.join(', ') || 'Insufficient permissions'}
                </Typography>
              ))}
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
              label="Department (optional)"
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
              fullWidth
              placeholder="e.g., Finance, HR, IT"
            />
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
      <Dialog open={shareDialogOpen} onClose={() => setShareDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Share "{selectedDoc?.name}"</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
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
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShareDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};


