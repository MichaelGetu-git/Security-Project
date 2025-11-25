import { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import type { GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  assignRoleToUser,
  createRole,
  fetchRoleRequests,
  fetchRoles,
  fetchUserAuditTrail,
  fetchUsers,
  removeRoleFromUser,
  resolveRoleRequest,
  updateUserDepartment,
  updateUserSecurityLevel,
  type DirectoryUser,
  type Role,
  type RoleRequest,
} from '../../api/users';

type DialogState =
  | { type: 'role'; user: DirectoryUser }
  | { type: 'security'; user: DirectoryUser }
  | { type: 'department'; user: DirectoryUser }
  | { type: 'activity'; user: DirectoryUser }
  | null;

export const AdminUsersPage = () => {
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: fetchUsers });
  const rolesQuery = useQuery({ queryKey: ['roles'], queryFn: fetchRoles });
  const requestsQuery = useQuery({ queryKey: ['roleRequests'], queryFn: fetchRoleRequests });
  const [dialogState, setDialogState] = useState<DialogState>(null);
  const [selectedRole, setSelectedRole] = useState<number | ''>('');
  const [department, setDepartment] = useState('');
  const [securityLevel, setSecurityLevel] = useState<DirectoryUser['security_level']>('PUBLIC');
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRolePermissions, setNewRolePermissions] = useState('');
  const [newRoleDescription, setNewRoleDescription] = useState('');
  const [showCreateRole, setShowCreateRole] = useState(false);

  const approveMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'APPROVED' | 'REJECTED' }) => resolveRoleRequest(id, status),
    onSuccess: () => {
      requestsQuery.refetch();
      usersQuery.refetch(); // Also refresh user list to show updated security levels
    },
    onError: (error: any) => {
      console.error('Failed to resolve role request:', error);
      alert(error.response?.data?.error || 'Failed to resolve request. Please try again.');
    },
  });

  const assignRoleMutation = useMutation({
    mutationFn: ({ userId, roleId }: { userId: number; roleId: number }) => assignRoleToUser(userId, roleId),
    onSuccess: () => {
      usersQuery.refetch();
      setSelectedRole('');
    },
    onError: (error: any) => {
      console.error('Failed to assign role:', error);
      alert(error.response?.data?.error || 'Failed to assign role. Please try again.');
    },
  });

  const createRoleMutation = useMutation({
    mutationFn: (payload: { name: string; permissions: string[]; description?: string }) => createRole(payload),
    onSuccess: () => {
      rolesQuery.refetch();
      setNewRoleName('');
      setNewRolePermissions('');
      setNewRoleDescription('');
      setShowCreateRole(false);
    },
    onError: (error: any) => {
      console.error('Failed to create role:', error);
      alert(error.response?.data?.error || 'Failed to create role. Please try again.');
    },
  });

  const removeRoleMutation = useMutation({
    mutationFn: ({ userId, roleId }: { userId: number; roleId: number }) => removeRoleFromUser(userId, roleId),
    onSuccess: () => usersQuery.refetch(),
  });

  const securityMutation = useMutation({
    mutationFn: ({ userId, level }: { userId: number; level: DirectoryUser['security_level'] }) =>
      updateUserSecurityLevel(userId, level),
    onSuccess: () => usersQuery.refetch(),
  });

  const departmentMutation = useMutation({
    mutationFn: ({ userId, dept }: { userId: number; dept: string | null }) => updateUserDepartment(userId, dept),
    onSuccess: () => usersQuery.refetch(),
  });

  const columns = useMemo<GridColDef<DirectoryUser>[]>(
    () => [
      { field: 'username', headerName: 'Name', flex: 1 },
      { field: 'email', headerName: 'Email', flex: 1.2 },
      {
        field: 'roles',
        headerName: 'Roles (RBAC)',
        flex: 1,
        renderCell: (params: GridRenderCellParams<DirectoryUser>) =>
          params.row.roles && params.row.roles.length ? params.row.roles.join(', ') : 'User',
      },
      { field: 'security_level', headerName: 'Security Level (MAC)', flex: 0.9 },
      { field: 'department', headerName: 'Department (ABAC)', flex: 1 },
      {
        field: 'mfa_enabled',
        headerName: 'MFA',
        flex: 0.5,
        renderCell: (params) => <Chip label={params.value ? 'Enabled' : 'Disabled'} color={params.value ? 'success' : 'default'} />,
      },
      {
        field: 'actions',
        headerName: 'Actions',
        sortable: false,
        flex: 1.4,
        renderCell: (params) => (
          <Stack direction="row" spacing={1}>
            <Button size="small" variant="outlined" onClick={() => openDialog({ type: 'role', user: params.row })}>
              Edit Role
            </Button>
            <Button size="small" variant="outlined" onClick={() => openDialog({ type: 'security', user: params.row })}>
              Security
            </Button>
            <Button size="small" variant="outlined" onClick={() => openDialog({ type: 'department', user: params.row })}>
              Department
            </Button>
            <Button size="small" variant="text" onClick={() => openActivity(params.row)}>
              Activity
            </Button>
          </Stack>
        ),
      },
    ],
    [],
  );

  const openDialog = (state: DialogState) => {
    if (!state) return;
    setDialogState(state);
    if (state.type === 'role') {
      setSelectedRole('');
    }
    if (state.type === 'security') {
      setSecurityLevel(state.user.security_level);
    }
    if (state.type === 'department') {
      setDepartment(state.user.department || '');
    }
  };

  const openActivity = async (user: DirectoryUser) => {
    setDialogState({ type: 'activity', user });
    setLoadingAudit(true);
    try {
      const logs = await fetchUserAuditTrail(user.id);
      setAuditLogs(logs);
    } finally {
      setLoadingAudit(false);
    }
  };

  const closeDialog = () => {
    setDialogState(null);
    setAuditLogs([]);
  };

  const handleAssignRole = async () => {
    if (!dialogState || dialogState.type !== 'role' || !selectedRole) return;
    await assignRoleMutation.mutateAsync({ userId: dialogState.user.id, roleId: Number(selectedRole) });
    closeDialog();
  };

  const handleRemoveRole = async (roleName: string) => {
    if (!dialogState || dialogState.type !== 'role') return;
    const role = rolesQuery.data?.find((r) => r.name === roleName);
    if (!role) return;
    await removeRoleMutation.mutateAsync({ userId: dialogState.user.id, roleId: role.id });
  };

  const handleCreateRole = async () => {
    if (!newRoleName.trim()) {
      alert('Role name is required');
      return;
    }
    const permissions = newRolePermissions
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    if (permissions.length === 0) {
      alert('At least one permission is required');
      return;
    }
    await createRoleMutation.mutateAsync({
      name: newRoleName.trim(),
      permissions,
      description: newRoleDescription.trim() || undefined,
    });
  };

  const handleSecuritySave = async () => {
    if (!dialogState || dialogState.type !== 'security') return;
    await securityMutation.mutateAsync({ userId: dialogState.user.id, level: securityLevel });
    closeDialog();
  };

  const handleDepartmentSave = async () => {
    if (!dialogState || dialogState.type !== 'department') return;
    await departmentMutation.mutateAsync({ userId: dialogState.user.id, dept: department || null });
    closeDialog();
  };

  const roleRequests = requestsQuery.data || [];

  return (
    <Stack spacing={3}>
      <Typography variant="h2" fontSize="1.8rem">
        User Management
      </Typography>

      <Box
        sx={{
          display: 'grid',
          gap: 3,
          gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' },
        }}
      >
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Directory (MAC + RBAC + ABAC Overview)
            </Typography>
            {usersQuery.isLoading ? (
              <Stack alignItems="center" py={4}>
                <CircularProgress />
              </Stack>
            ) : (
              <Box sx={{ height: 500 }}>
                <DataGrid rows={usersQuery.data || []} columns={columns} getRowId={(row) => row.id} disableRowSelectionOnClick />
              </Box>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Security Level Upgrade Requests
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Stack spacing={2}>
              {roleRequests
                .filter((req) => req.status === 'PENDING')
                .map((req) => (
                  <RoleRequestCard key={req.id} request={req} onResolve={(status) => approveMutation.mutate({ id: req.id, status })} />
                ))}
              {!roleRequests.filter((req) => req.status === 'PENDING').length && (
                <Typography color="text.secondary">No pending requests</Typography>
              )}
            </Stack>
          </CardContent>
        </Card>
      </Box>

      <EditRoleDialog
        open={dialogState?.type === 'role'}
        onClose={closeDialog}
        user={dialogState?.type === 'role' ? dialogState.user : null}
        roles={rolesQuery.data || []}
        selectedRole={selectedRole}
        onSelectRole={setSelectedRole}
        onAssign={handleAssignRole}
        onRemove={handleRemoveRole}
        onCreateRole={() => setShowCreateRole(true)}
      />
      <CreateRoleDialog
        open={showCreateRole}
        onClose={() => {
          setShowCreateRole(false);
          setNewRoleName('');
          setNewRolePermissions('');
          setNewRoleDescription('');
        }}
        name={newRoleName}
        onNameChange={setNewRoleName}
        permissions={newRolePermissions}
        onPermissionsChange={setNewRolePermissions}
        description={newRoleDescription}
        onDescriptionChange={setNewRoleDescription}
        onCreate={handleCreateRole}
        loading={createRoleMutation.isPending}
      />
      <EditSecurityDialog
        open={dialogState?.type === 'security'}
        onClose={closeDialog}
        level={securityLevel}
        onChange={setSecurityLevel}
        onSave={handleSecuritySave}
      />
      <EditDepartmentDialog
        open={dialogState?.type === 'department'}
        onClose={closeDialog}
        department={department}
        onChange={setDepartment}
        onSave={handleDepartmentSave}
      />
      <ActivityDialog open={dialogState?.type === 'activity'} onClose={closeDialog} logs={auditLogs} loading={loadingAudit} />
    </Stack>
  );
};

const RoleRequestCard = ({ request, onResolve }: { request: RoleRequest; onResolve: (status: 'APPROVED' | 'REJECTED') => void }) => (
  <Box sx={{ p: 2, borderRadius: 2, bgcolor: '#f8fafc' }}>
    <Typography fontWeight={600}>
      Request #{request.id}: Security Level → {request.requested_role}
    </Typography>
    <Typography variant="body2" color="text.secondary">
      User ID: {request.user_id}
    </Typography>
    <Typography variant="body2" sx={{ mt: 1 }}>
      {request.justification}
    </Typography>
    <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
      <Button size="small" variant="contained" onClick={() => onResolve('APPROVED')}>
        Approve
      </Button>
      <Button size="small" variant="outlined" color="error" onClick={() => onResolve('REJECTED')}>
        Deny
      </Button>
    </Stack>
  </Box>
);

const EditRoleDialog = ({
  open,
  onClose,
  user,
  roles,
  selectedRole,
  onSelectRole,
  onAssign,
  onRemove,
  onCreateRole,
}: {
  open: boolean;
  onClose: () => void;
  user: DirectoryUser | null;
  roles: Role[];
  selectedRole: number | '';
  onSelectRole: (value: number | '') => void;
  onAssign: () => void;
  onRemove: (roleName: string) => void;
  onCreateRole: () => void;
}) => {
  // Filter out roles that are already assigned to the user
  const availableRoles = roles.filter((role) => !user?.roles.includes(role.name));

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Edit Roles for {user?.username}</DialogTitle>
      <DialogContent>
        <Typography variant="subtitle2" gutterBottom>
          Current Roles
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" mb={2}>
          {user?.roles && user.roles.length > 0 ? (
            user.roles.map((role) => (
              <Chip key={role} label={role} onDelete={() => onRemove(role)} color="primary" />
            ))
          ) : (
            <Typography color="text.secondary">No roles assigned.</Typography>
          )}
        </Stack>
        <Divider sx={{ my: 2 }} />
        <Stack spacing={2}>
          <TextField
            select
            fullWidth
            label="Add Role"
            value={selectedRole}
            onChange={(e) => onSelectRole(Number(e.target.value))}
            helperText={availableRoles.length === 0 ? 'All available roles are already assigned' : 'Select a role to assign'}
          >
            {availableRoles.length > 0 ? (
              availableRoles.map((role) => (
                <MenuItem key={role.id} value={role.id}>
                  {role.name} {role.description && `- ${role.description}`}
                </MenuItem>
              ))
            ) : (
              <MenuItem disabled>No roles available</MenuItem>
            )}
          </TextField>
          <Button variant="outlined" onClick={onCreateRole} fullWidth>
            + Create New Role
          </Button>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        <Button variant="contained" disabled={!selectedRole} onClick={onAssign}>
          Assign
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const CreateRoleDialog = ({
  open,
  onClose,
  name,
  onNameChange,
  permissions,
  onPermissionsChange,
  description,
  onDescriptionChange,
  onCreate,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  name: string;
  onNameChange: (value: string) => void;
  permissions: string;
  onPermissionsChange: (value: string) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  onCreate: () => void;
  loading: boolean;
}) => (
  <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
    <DialogTitle>Create New Role</DialogTitle>
    <DialogContent>
      <Stack spacing={2} sx={{ mt: 1 }}>
        <TextField
          label="Role Name"
          fullWidth
          required
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="e.g., Security Manager"
        />
        <TextField
          label="Permissions (comma-separated)"
          fullWidth
          required
          value={permissions}
          onChange={(e) => onPermissionsChange(e.target.value)}
          placeholder="e.g., documents:read, documents:create, documents:share"
          helperText="Separate multiple permissions with commas. Use '*' for all permissions."
        />
        <TextField
          label="Description (optional)"
          fullWidth
          multiline
          rows={2}
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="e.g., Security manager with after-hours access"
        />
      </Stack>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose} disabled={loading}>
        Cancel
      </Button>
      <Button variant="contained" onClick={onCreate} disabled={loading || !name.trim() || !permissions.trim()}>
        {loading ? 'Creating...' : 'Create Role'}
      </Button>
    </DialogActions>
  </Dialog>
);

const EditSecurityDialog = ({
  open,
  onClose,
  level,
  onChange,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  level: DirectoryUser['security_level'];
  onChange: (value: DirectoryUser['security_level']) => void;
  onSave: () => void;
}) => (
  <Dialog open={open} onClose={onClose}>
    <DialogTitle>Security Level</DialogTitle>
    <DialogContent>
      <TextField select fullWidth label="Level" value={level} onChange={(e) => onChange(e.target.value as DirectoryUser['security_level'])}>
        {['PUBLIC', 'INTERNAL', 'CONFIDENTIAL'].map((option) => (
          <MenuItem key={option} value={option}>
            {option}
          </MenuItem>
        ))}
      </TextField>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>Cancel</Button>
      <Button variant="contained" onClick={onSave}>
        Save
      </Button>
    </DialogActions>
  </Dialog>
);

const EditDepartmentDialog = ({
  open,
  onClose,
  department,
  onChange,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  department: string;
  onChange: (value: string) => void;
  onSave: () => void;
}) => (
  <Dialog open={open} onClose={onClose}>
    <DialogTitle>Department</DialogTitle>
    <DialogContent>
      <TextField label="Department" value={department} onChange={(e) => onChange(e.target.value)} fullWidth />
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>Cancel</Button>
      <Button variant="contained" onClick={onSave}>
        Save
      </Button>
    </DialogActions>
  </Dialog>
);

const ActivityDialog = ({
  open,
  onClose,
  logs,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  logs: any[];
  loading: boolean;
}) => (
  <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
    <DialogTitle>Recent Activity</DialogTitle>
    <DialogContent dividers>
      {loading ? (
        <Stack alignItems="center" py={2}>
          <CircularProgress />
        </Stack>
      ) : (
        <Stack spacing={1}>
          {logs.map((log) => (
            <Box key={log.id || log.timestamp} sx={{ p: 1.5, borderRadius: 1, bgcolor: '#f1f5f9' }}>
              <Typography variant="body2">
                {log.timestamp} — {log.action} ({log.status})
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {log.resource} · IP {log.ip_address}
              </Typography>
            </Box>
          ))}
          {!logs.length && <Typography color="text.secondary">No audit entries for this user.</Typography>}
        </Stack>
      )}
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>Close</Button>
    </DialogActions>
  </Dialog>
);

