import { createTheme } from '@mui/material/styles';

declare module '@mui/material/styles' {
  interface Palette {
    neutral: Palette['primary'];
  }
  interface PaletteOptions {
    neutral?: PaletteOptions['primary'];
  }
}

export const theme = createTheme({
  palette: {
    primary: {
      main: '#0c63ff',
      dark: '#004ccc',
      light: '#4f8dff',
    },
    secondary: {
      main: '#0f172a',
    },
    success: {
      main: '#10b981',
    },
    warning: {
      main: '#f59e0b',
    },
    error: {
      main: '#ef4444',
    },
    background: {
      default: '#f5f6fa',
      paper: '#ffffff',
    },
    neutral: {
      main: '#1e293b',
    },
  },
  typography: {
    fontFamily: ['Inter', 'system-ui', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'].join(', '),
    h1: {
      fontWeight: 600,
      fontSize: '2.2rem',
    },
    h2: {
      fontWeight: 600,
      fontSize: '1.8rem',
    },
    h3: {
      fontWeight: 600,
      fontSize: '1.5rem',
    },
    button: {
      textTransform: 'none',
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 12,
  },
});


