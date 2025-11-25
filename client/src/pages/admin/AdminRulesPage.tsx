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
import {
  createPolicyRecord,
  deletePolicyRecord,
  fetchPolicies,
  updatePolicyRecord,
  type PolicyRecord,
} from '../../api/rules';
import { fetchAdminDocuments } from '../../api/documents';

const WORKING_HOURS = 'Working Hours Restriction';
const WEEKEND_BLOCK = 'Weekend Block';
const HR_LEAVE = 'HR Leave Approval';
const FINANCE_SALARY = 'Finance Salary Guard';

export const AdminRulesPage = () => {
  const policiesQuery = useQuery({ queryKey: ['policies'], queryFn: fetchPolicies });
  const documentsQuery = useQuery({ queryKey: ['documents', 'admin'], queryFn: fetchAdminDocuments });
  const saveMutation = useMutation({
    mutationFn: (payload: { name: string; base: Partial<PolicyRecord> }) => upsertPolicy(payload.name, payload.base),
    onSuccess: () => policiesQuery.refetch(),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => deletePolicyRecord(id),
    onSuccess: () => policiesQuery.refetch(),
  });

  const [newRule, setNewRule] = useState({ department: '', selectedDocuments: [] as number[], restriction: '' });

  const policies = policiesQuery.data || [];

  const getPolicy = (name: string) => policies.find((policy) => policy.name === name);

  const workingHoursEnabled = !!getPolicy(WORKING_HOURS)?.is_active;
  const weekendBlockEnabled = !!getPolicy(WEEKEND_BLOCK)?.is_active;
  const hrLeaveEnabled = !!getPolicy(HR_LEAVE)?.is_active;
  const financeSalaryEnabled = !!getPolicy(FINANCE_SALARY)?.is_active;

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
        timeRestriction: newRule.restriction,
      },
    });
    setNewRule({ department: '', selectedDocuments: [], restriction: '' });
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
                          rules: { timeRestriction: true, workingHours: { start: 9, end: 17 } },
                        })
                      }
                    />
                  }
                  label="Restrict to working hours (09:00-17:00)"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={weekendBlockEnabled}
                      onChange={(e) =>
                        togglePolicy(WEEKEND_BLOCK, e.target.checked, {
                          type: 'RuBAC',
                          rules: { 
                            blockWeekend: true,
                            approvalRole: getPolicy(WEEKEND_BLOCK)?.rules?.approvalRole || '',
                          },
                        })
                      }
                    />
                  }
                  label="Block weekend access"
                />
                <TextField
                  label="Weekend approval role"
                  placeholder="Security Manager"
                  value={getPolicy(WEEKEND_BLOCK)?.rules?.approvalRole || ''}
                  onChange={(e) =>
                    togglePolicy(WEEKEND_BLOCK, true, {
                      type: 'RuBAC',
                      rules: { 
                        blockWeekend: true,
                        approvalRole: e.target.value,
                      },
                    })
                  }
                />
                <TextField
                  label="After-hours approval role"
                  placeholder="Security Manager"
                  value={getPolicy(WORKING_HOURS)?.rules?.approvalRole || ''}
                  onChange={(e) =>
                    togglePolicy(WORKING_HOURS, true, {
                      type: 'RuBAC',
                      rules: { timeRestriction: true, workingHours: { start: 9, end: 17 }, approvalRole: e.target.value },
                    })
                  }
                />
              </Stack>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Conditional Rules
              </Typography>
              <Stack spacing={2}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={hrLeaveEnabled}
                      onChange={(e) =>
                        togglePolicy(HR_LEAVE, e.target.checked, {
                          type: 'RuBAC',
                          rules: { role: 'HR Manager', approvalLimitDays: 10 },
                        })
                      }
                    />
                  }
                  label="HR Managers can approve leave > 10 days"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={financeSalaryEnabled}
                      onChange={(e) =>
                        togglePolicy(FINANCE_SALARY, e.target.checked, {
                          type: 'ABAC',
                          rules: { department: 'Finance', allowedResources: 'Salary Data' },
                        })
                      }
                    />
                  }
                  label="Only Finance can access salary data"
                />
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField
                    label="Custom rule description"
                    placeholder="Only SOC can access logs after hours"
                    fullWidth
                    disabled
                  />
                  <Button variant="contained" sx={{ minWidth: 160 }} disabled>
                    Add Rule
                  </Button>
                </Stack>
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
                  <TableCell>Name</TableCell>
                  <TableCell>Department</TableCell>
                  <TableCell>Resources</TableCell>
                  <TableCell>Time Restriction</TableCell>
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
                    ) : typeof rule.rules?.allowedResources === 'string' ? (
                      rule.rules.allowedResources
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell>{String(rule.rules?.timeRestriction || '-')}</TableCell>
                    <TableCell align="center">
                      <IconButton size="small" onClick={() => deleteMutation.mutate(rule.id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {!abacPolicies.length && (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <Typography color="text.secondary">No attribute rules configured.</Typography>
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
                <TextField
                  label="Department"
                  value={newRule.department}
                  onChange={(e) => setNewRule((prev) => ({ ...prev, department: e.target.value }))}
                  placeholder="e.g., Finance, IT, HR"
                />
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
                <TextField
                  label="Time Restriction (optional)"
                  value={newRule.restriction}
                  onChange={(e) => setNewRule((prev) => ({ ...prev, restriction: e.target.value }))}
                  placeholder="e.g., Working hours only"
                  helperText="Optional: Additional time-based restrictions"
                />
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

