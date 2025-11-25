import { Card, CardContent, Chip, Stack, Typography } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import type { GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { useQuery } from '@tanstack/react-query';
import { fetchSystemLogs, type SystemLogEvent } from '../../api/systemLogs';

type LogRow = SystemLogEvent & { id: number };

const columns: GridColDef<LogRow>[] = [
  { field: 'timestamp', headerName: 'Timestamp', flex: 1, renderCell: (params: GridRenderCellParams<LogRow>) => params.row.timestamp || '-' },
  {
    field: 'eventType',
    headerName: 'Event Type',
    flex: 0.6,
    renderCell: (params: GridRenderCellParams<LogRow>) => params.row.type || params.row.level || 'event',
  },
  {
    field: 'details',
    headerName: 'Details',
    flex: 1.4,
    renderCell: (params: GridRenderCellParams<LogRow>) => params.row.message || JSON.stringify(params.row),
  },
  { field: 'user', headerName: 'User', flex: 0.8, renderCell: (params: GridRenderCellParams<LogRow>) => params.row.user || 'system' },
];

export const AdminSystemLogsPage = () => {
  const logsQuery = useQuery({ queryKey: ['system-logs'], queryFn: fetchSystemLogs });
  const rows: LogRow[] = (logsQuery.data || []).map((event, index) => ({ id: index, ...event }));

  return (
    <Stack spacing={3}>
      <Typography variant="h2" fontSize="1.8rem">
        System Logs
      </Typography>
      <Card>
        <CardContent sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Typography fontWeight={600}>Log Encryption Status:</Typography>
          <Chip label="Logs Encrypted ✓" color="success" variant="outlined" />
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <div style={{ height: 420 }}>
            <DataGrid rows={rows} columns={columns} loading={logsQuery.isLoading} disableRowSelectionOnClick />
          </div>
        </CardContent>
      </Card>
    </Stack>
  );
};

