import { Alert, Box, Typography } from '@mui/material';

type denialType = 'MAC' | 'DAC' | 'RBAC' | 'RuBAC' | 'ABAC';

const denialCopy: Record<denialType, string> = {
  MAC: 'Access Denied: This resource is classified above your clearance level.',
  DAC: 'Access Denied: The resource owner has not granted you permission.',
  RBAC: 'Access Denied: Your current role lacks the required permission.',
  RuBAC: 'Access Denied: Rule-based restrictions (time/location/device) are active.',
  ABAC: 'Access Denied: Your attributes (department/location/status) do not meet the policy requirements.',
};

export const AccessDeniedMessage = ({ type }: { type: denialType }) => (
  <Alert severity="error" variant="outlined" sx={{ borderRadius: 2 }}>
    <Box>
      <Typography fontWeight={600}>{type} Restriction</Typography>
      <Typography variant="body2">{denialCopy[type]}</Typography>
    </Box>
  </Alert>
);


