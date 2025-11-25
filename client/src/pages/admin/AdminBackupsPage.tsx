import { Box, Button, Card, CardContent, Chip, Stack, Typography } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import type { GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { useMutation, useQuery } from '@tanstack/react-query';
import { fetchBackups, triggerBackup, type BackupEntry } from '../../api/backups';

type BackupRow = BackupEntry & { id: number };

const columns: GridColDef<BackupRow>[] = [
  {
    field: 'modified',
    headerName: 'Date',
    flex: 1,
    renderCell: (params: GridRenderCellParams<BackupRow>) => new Date(params.row.modified).toLocaleString(),
  },
  {
    field: 'size',
    headerName: 'Size',
    flex: 1,
    renderCell: (params: GridRenderCellParams<BackupRow>) => `${((params.row.size || 0) / 1024 / 1024).toFixed(2)} MB`,
  },
  {
    field: 'status',
    headerName: 'Status',
    flex: 1,
    renderCell: () => <Chip label="Success" color="success" />,
  },
  {
    field: 'actions',
    headerName: 'Actions',
    flex: 1.2,
    sortable: false,
    renderCell: (params) => (
      <Stack direction="row" spacing={1}>
        <Button size="small" variant="outlined" component="a" href={`/api/backups/${params.row.name}/download`}>
          Download
        </Button>
      </Stack>
    ),
  },
];

export const AdminBackupsPage = () => {
  const backupsQuery = useQuery({ queryKey: ['backups'], queryFn: fetchBackups });
  const triggerMutation = useMutation({
    mutationFn: triggerBackup,
    onSuccess: () => backupsQuery.refetch(),
  });

  const rows: BackupRow[] = (backupsQuery.data || []).map((backup, index) => ({ id: index, ...backup }));
  const lastBackup = backupsQuery.data?.[0];

  return (
    <Stack spacing={3}>
      <Typography variant="h2" fontSize="1.8rem">
        Backups
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
            <Box sx={{ height: 420 }}>
              <DataGrid
                rows={rows}
                columns={columns}
                disableRowSelectionOnClick
                loading={backupsQuery.isLoading}
                getRowId={(row) => row.id}
              />
            </Box>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Settings
            </Typography>
            <Stack spacing={1}>
              <Typography>Automatic schedule: Daily at 2 AM</Typography>
              <Typography>Retention period: 30 days</Typography>
              <Typography>Last backup: {lastBackup ? new Date(lastBackup.modified).toLocaleString() : '—'}</Typography>
              <Typography>Next backup: Scheduled</Typography>
            </Stack>
            <Button
              variant="contained"
              fullWidth
              sx={{ mt: 3 }}
              onClick={() => triggerMutation.mutate()}
              disabled={triggerMutation.isPending}
            >
              {triggerMutation.isPending ? 'Creating…' : 'Create Backup Now'}
            </Button>
          </CardContent>
        </Card>
      </Box>
    </Stack>
  );
};

