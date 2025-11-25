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
  IconButton,
  List,
  ListItem,
  ListItemText,
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
  type DocumentRecord,
} from '../../api/documents';

export const AdminDocumentsPage = () => {
  const documentsQuery = useQuery({ queryKey: ['documents', 'admin'], queryFn: fetchAdminDocuments });
  const [selectedDoc, setSelectedDoc] = useState<DocumentRecord | null>(null);
  const [shareEmail, setShareEmail] = useState('');
  const [permission, setPermission] = useState('read');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: '', classification: 'PUBLIC', department: '' });

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

  const revokeMutation = useMutation({
    mutationFn: ({ documentId, userId, permission }: { documentId: number; userId: number; permission?: string }) =>
      revokeDocumentAccess(documentId, userId, permission),
    onSuccess: () => documentsQuery.refetch(),
  });

  const handleGrant = async () => {
    if (!selectedDoc || !shareEmail) return;
    await grantMutation.mutateAsync({ documentId: selectedDoc.id, email: shareEmail, permission });
    setShareEmail('');
  };

  const handleCreate = () => {
    if (!form.name.trim()) return;
    createMutation.mutate({
      name: form.name,
      classification: form.classification,
      department: form.department || undefined,
    });
  };

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

      <Dialog open={!!selectedDoc} onClose={() => setSelectedDoc(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Share "{selectedDoc?.name}"</DialogTitle>
        <DialogContent>
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
    </Stack>
  );
};
