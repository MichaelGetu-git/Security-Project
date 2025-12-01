import { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { useMutation, useQuery } from '@tanstack/react-query';
import { createPolicyRecord, deletePolicyRecord, fetchPolicies, updatePolicyRecord, type PolicyRecord } from '../../api/rules';
import { fetchUsers, fetchRoles, type Role, type DirectoryUser } from '../../api/users';
import { fetchAdminDocuments } from '../../api/documents';

const WORKING_HOURS = 'Working Hours Restriction';
const WEEKEND_BLOCK = 'Weekend Block';
export const AdminRulesPage = () => {
  const policiesQuery = useQuery({ queryKey: ['policies'], queryFn: fetchPolicies });
  const documentsQuery = useQuery({ queryKey: ['documents', 'admin'], queryFn: fetchAdminDocuments });
  const rolesQuery = useQuery({ queryKey: ['roles'], queryFn: fetchRoles });
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: fetchUsers });
  const saveMutation = useMutation({
    mutationFn: (payload: { name: string; base: Partial<PolicyRecord> }) => upsertPolicy(payload.name, payload.base),
    onSuccess: () => policiesQuery.refetch(),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => deletePolicyRecord(id),
    onSuccess: () => policiesQuery.refetch(),
  });

  const [newRule, setNewRule] = useState({ department: '', selectedDocuments: [] as number[] });

  const departments: string[] =
    useMemo(
      () =>
        Array.from(
          new Set(
            (usersQuery.data || [])
              .map((u: DirectoryUser) => u.department)
              .filter((d): d is string => !!d && d.trim().length > 0),
          ),
        ).sort(),
      [usersQuery.data],
    );

  const policies = policiesQuery.data || [];

  const getPolicy = (name: string) => policies.find((policy) => policy.name === name);

  const workingHoursPolicy = getPolicy(WORKING_HOURS);
  const weekendPolicy = getPolicy(WEEKEND_BLOCK);

  const workingHoursEnabled = !!workingHoursPolicy?.is_active;
  const weekendBlockEnabled = !!getPolicy(WEEKEND_BLOCK)?.is_active;

  const [workingStart, setWorkingStart] = useState<number>(
    (workingHoursPolicy?.rules?.workingHours as any)?.start ?? 9,
  );
  const [workingEnd, setWorkingEnd] = useState<number>(
    (workingHoursPolicy?.rules?.workingHours as any)?.end ?? 17,
  );

  const abacPolicies = useMemo(() => policies.filter((policy) => policy.type === 'ABAC'), [policies]);

  const togglePolicy = (name: string, enabled: boolean, defaults: Partial<PolicyRecord>) =>
    saveMutation.mutate({
      name,
      base: {
        name,
        type: defaults.type || 'RuBAC',
        is_active: enabled,
        rules: defaults.rules || {},
      },
    });

  const handleAddAttributeRule = async () => {
    if (!newRule.department || newRule.selectedDocuments.length === 0) {
      alert('Please select a department and at least one document');
      return;
    }
    await createPolicyRecord({
      name: `ABAC-${newRule.department}-${Date.now()}`,
      type: 'ABAC',
      is_active: true,
      rules: {
        department: newRule.department,
        allowedResources: newRule.selectedDocuments, // Store document IDs
      },
    });
    setNewRule({ department: '', selectedDocuments: [] });
    policiesQuery.refetch();
  };

  return (
    <Stack spacing={3}>
      <Typography variant="h2" fontSize="1.8rem">
        Access Rules (RuBAC + ABAC)
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
                Time-Based Rules (RuBAC)
              </Typography>
              <Stack spacing={2}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={workingHoursEnabled}
                      onChange={(e) =>
                        togglePolicy(WORKING_HOURS, e.target.checked, {
                          type: 'RuBAC',
                          rules: { timeRestriction: true, workingHours: { start: workingStart, end: workingEnd } },
                        })
                      }
                    />
                  }
                  label="Restrict to working hours"
                />
                <Stack direction="row" spacing={2}>
                  <TextField
                    label="Start hour (0-23)"
                    type="number"
                    inputProps={{ min: 0, max: 23 }}
                    value={workingStart}
                    onChange={(e) => {
                      const v = Math.max(0, Math.min(23, Number(e.target.value) || 0));
                      setWorkingStart(v);
                      if (workingHoursEnabled) {
                        togglePolicy(WORKING_HOURS, true, {
                          type: 'RuBAC',
                          rules: { timeRestriction: true, workingHours: { start: v, end: workingEnd }, approvalRole: workingHoursPolicy?.rules?.approvalRole },
                        });
                      }
                    }}
                    helperText="Users (non-admin) can access from this hour"
                  />
                  <TextField
                    label="End hour (0-23)"
                    type="number"
                    inputProps={{ min: 0, max: 23 }}
                    value={workingEnd}
                    onChange={(e) => {
                      const v = Math.max(0, Math.min(23, Number(e.target.value) || 0));
                      setWorkingEnd(v);
                      if (workingHoursEnabled) {
                        togglePolicy(WORKING_HOURS, true, {
                          type: 'RuBAC',
                          rules: { timeRestriction: true, workingHours: { start: workingStart, end: v }, approvalRole: workingHoursPolicy?.rules?.approvalRole },
                        });
                      }
                    }}
                    helperText="Access allowed up to (but not including) this hour"
                  />
                </Stack>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={weekendBlockEnabled}
                      onChange={(e) =>
                        togglePolicy(WEEKEND_BLOCK, e.target.checked, {
                          type: 'RuBAC',
                          rules: { 
                            blockWeekend: true,
                            approvalRole: weekendPolicy?.rules?.approvalRole || '',
                          },
                        })
                      }
                    />
                  }
                  label="Block weekend access"
                />
                <FormControl fullWidth>
                  <InputLabel>Weekend approval role</InputLabel>
                  <Select
                    label="Weekend approval role"
                    value={weekendPolicy?.rules?.approvalRole || ''}
                    onChange={(e) =>
                      togglePolicy(WEEKEND_BLOCK, true, {
                        type: 'RuBAC',
                        rules: {
                          blockWeekend: true,
                          approvalRole: e.target.value,
                        },
                      })
                    }
                    disabled={rolesQuery.isLoading || !rolesQuery.data?.length}
                  >
                    {rolesQuery.isLoading && <MenuItem disabled>Loading roles...</MenuItem>}
                    {!rolesQuery.isLoading && !rolesQuery.data?.length && <MenuItem disabled>No roles available</MenuItem>}
                    {rolesQuery.data?.map((role: Role) => (
                      <MenuItem key={role.id} value={role.name}>
                        {role.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl fullWidth>
                  <InputLabel>After-hours approval role</InputLabel>
                  <Select
                    label="After-hours approval role"
                    value={workingHoursPolicy?.rules?.approvalRole || ''}
                    onChange={(e) =>
                      togglePolicy(WORKING_HOURS, true, {
                        type: 'RuBAC',
                        rules: {
                          timeRestriction: true,
                          workingHours: { start: workingStart, end: workingEnd },
                          approvalRole: e.target.value,
                        },
                      })
                    }
                    disabled={rolesQuery.isLoading || !rolesQuery.data?.length}
                  >
                    {rolesQuery.isLoading && <MenuItem disabled>Loading roles...</MenuItem>}
                    {!rolesQuery.isLoading && !rolesQuery.data?.length && <MenuItem disabled>No roles available</MenuItem>}
                    {rolesQuery.data?.map((role: Role) => (
                      <MenuItem key={role.id} value={role.name}>
                        {role.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>
            </CardContent>
          </Card>
        </Stack>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Attribute Rules (ABAC)
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Rule Name</TableCell>
                  <TableCell>Department (who)</TableCell>
                  <TableCell>Documents (what)</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {abacPolicies.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell>{rule.name}</TableCell>
                    <TableCell>{rule.rules?.department || '-'}</TableCell>
                    <TableCell>
                      {Array.isArray(rule.rules?.allowedResources) ? (
                        <Stack direction="row" spacing={0.5} flexWrap="wrap">
                          {rule.rules.allowedResources.map((docId: number) => {
                            const doc = documentsQuery.data?.find((d) => d.id === docId);
                            return doc ? <Chip key={docId} label={doc.name} size="small" /> : null;
                          })}
                        </Stack>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <IconButton size="small" onClick={() => deleteMutation.mutate(rule.id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {!abacPolicies.length && (
                  <TableRow>
                    <TableCell colSpan={4}>
                      <Typography color="text.secondary">
                        No attribute rules configured. Use the form below to say “only this department can access these documents”.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <Box sx={{ mt: 3 }}>
              <Typography fontWeight={600} gutterBottom>
                Add New Rule
              </Typography>
              <Stack spacing={2}>
                <FormControl fullWidth>
                  <InputLabel>Department</InputLabel>
                  <Select
                    label="Department"
                    value={newRule.department}
                    onChange={(e) => setNewRule((prev) => ({ ...prev, department: e.target.value as string }))}
                    disabled={usersQuery.isLoading}
                  >
                    {usersQuery.isLoading && <MenuItem disabled>Loading departments...</MenuItem>}
                    {!usersQuery.isLoading && !departments.length && (
                      <MenuItem disabled>No departments found. Set departments for users first.</MenuItem>
                    )}
                    {departments.map((dept) => (
                      <MenuItem key={dept} value={dept}>
                        {dept}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl fullWidth>
                  <InputLabel>Allowed Resources (Documents)</InputLabel>
                  <Select
                    multiple
                    value={newRule.selectedDocuments}
                    onChange={(e) => setNewRule((prev) => ({ ...prev, selectedDocuments: e.target.value as number[] }))}
                    renderValue={(selected) => (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {(selected as number[]).map((docId) => {
                          const doc = documentsQuery.data?.find((d) => d.id === docId);
                          return doc ? <Chip key={docId} label={doc.name} size="small" /> : null;
                        })}
                      </Box>
                    )}
                    label="Allowed Resources (Documents)"
                  >
                    {documentsQuery.data?.map((doc) => (
                      <MenuItem key={doc.id} value={doc.id}>
                        <Checkbox checked={newRule.selectedDocuments.includes(doc.id)} />
                        {doc.name} ({doc.classification})
                      </MenuItem>
                    )) || <MenuItem disabled>No documents available</MenuItem>}
                  </Select>
                </FormControl>
                <Typography variant="body2" color="text.secondary">
                  This rule means: <strong>only</strong> users in the selected department can access the selected documents. Others are blocked by ABAC.
                </Typography>
                <Button variant="contained" onClick={handleAddAttributeRule} disabled={!newRule.department || newRule.selectedDocuments.length === 0}>
                  Save Rule
                </Button>
              </Stack>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Stack>
  );
};

const upsertPolicy = async (name: string, base: Partial<PolicyRecord>) => {
  const policies = await fetchPolicies();
  const existing = policies.find((policy) => policy.name === name);
  if (existing) {
    return updatePolicyRecord(existing.id, { ...existing, ...base });
  }
  return createPolicyRecord({
    name,
    type: base.type || 'RuBAC',
    is_active: base.is_active ?? true,
    rules: base.rules || {},
  });
};

