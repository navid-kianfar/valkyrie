import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';
import { I18nProvider } from './i18n';
import { ThemeProvider } from './providers/theme';
import { AuthProvider } from './providers/auth';
import { PreferencesProvider } from './providers/preferences';
import { Toaster } from './components/ui/sonner';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <PreferencesProvider>
          <I18nProvider>
            <AuthProvider>
              <BrowserRouter>
                <App />
                <Toaster />
              </BrowserRouter>
            </AuthProvider>
          </I18nProvider>
        </PreferencesProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
);
