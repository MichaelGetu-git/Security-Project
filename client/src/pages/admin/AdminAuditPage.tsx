import { useMemo, useState } from 'react';
import { Box, Button, Card, CardContent, Chip, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import type { GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { useQuery } from '@tanstack/react-query';
import { fetchAuditLogs, type AuditLogEntry } from '../../api/audit';

const columns: GridColDef<AuditLogEntry>[] = [
  { field: 'timestamp', headerName: 'Timestamp', flex: 1 },
  { field: 'username', headerName: 'User', flex: 1 },
  {
    field: 'ip_address',
    headerName: 'IP Address',
    flex: 0.8,
    renderCell: (params: GridRenderCellParams<AuditLogEntry>) => params.row.ip_address || '-',
  },
  { field: 'action', headerName: 'Action', flex: 1 },
  { field: 'resource', headerName: 'Resource', flex: 1 },
  {
    field: 'status',
    headerName: 'Result',
    flex: 0.6,
    renderCell: (params) => <Chip label={params.value} color={params.value === 'SUCCESS' ? 'success' : 'error'} size="small" />,
  },
];

export const AdminAuditPage = () => {
  const [filters, setFilters] = useState({ user: '', action: '', from: '', to: '' });
  const [appliedFilters, setAppliedFilters] = useState(filters);

  const auditQuery = useQuery({
    queryKey: ['audit', appliedFilters],
    queryFn: () =>
      fetchAuditLogs({
        user: appliedFilters.user || undefined,
        action: appliedFilters.action || undefined,
        from: appliedFilters.from || undefined,
        to: appliedFilters.to || undefined,
      }),
  });

  const logs = auditQuery.data || [];

  const criticalEvents = useMemo(() => logs.filter((log) => log.status !== 'SUCCESS').slice(0, 3), [logs]);

  const handleSearch = () => setAppliedFilters(filters);

  const exportCsv = () => {
    const header = 'timestamp,user,ip,action,resource,status';
    const rows = logs.map((log) =>
      [log.timestamp, log.username, log.ip_address || '', log.action, log.resource || '', log.status].join(','),
    );
    const csvContent = [header, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'audit-logs.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Stack spacing={3}>
      <Typography variant="h2" fontSize="1.8rem">
        Audit Logs
      </Typography>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Filters
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: { xs: '1fr', md: 'repeat(4, minmax(0, 1fr))' },
            }}
          >
            <TextField
              type="date"
              label="From"
              InputLabelProps={{ shrink: true }}
              value={filters.from}
              onChange={(e) => setFilters((prev) => ({ ...prev, from: e.target.value }))}
            />
            <TextField
              type="date"
              label="To"
              InputLabelProps={{ shrink: true }}
              value={filters.to}
              onChange={(e) => setFilters((prev) => ({ ...prev, to: e.target.value }))}
            />
            <TextField
              label="User"
              placeholder="admin@example.com"
              value={filters.user}
              onChange={(e) => setFilters((prev) => ({ ...prev, user: e.target.value }))}
            />
            <TextField
              select
              label="Action"
              value={filters.action}
              onChange={(e) => setFilters((prev) => ({ ...prev, action: e.target.value }))}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="LOGIN_SUCCESS">Login Success</MenuItem>
              <MenuItem value="LOGIN_FAILED">Login Failed</MenuItem>
              <MenuItem value="DOCUMENT_SHARE">Document Share</MenuItem>
              <MenuItem value="REGISTER">Register</MenuItem>
            </TextField>
          </Box>
          <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
            <Button variant="contained" onClick={handleSearch} disabled={auditQuery.isFetching}>
              {auditQuery.isFetching ? 'Searching...' : 'Search'}
            </Button>
            <Button variant="outlined" onClick={exportCsv} disabled={!logs.length}>
              Export CSV
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Box sx={{ height: 420 }}>
            <DataGrid
              rows={logs}
              columns={columns}
              loading={auditQuery.isLoading}
              disableRowSelectionOnClick
              getRowId={(row) => row.id || `${row.timestamp}-${row.action}`}
            />
          </Box>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Recent Critical Events
          </Typography>
          <Stack spacing={1}>
            {criticalEvents.length
              ? criticalEvents.map((event) => (
                  <Chip
                    key={event.id || event.timestamp}
                    label={`${event.timestamp} — ${event.username}: ${event.action}`}
                    color="warning"
                    variant="outlined"
                  />
                ))
              : <Typography color="text.secondary">No critical events.</Typography>}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
};

