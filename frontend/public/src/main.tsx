import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { GuestAuthProvider } from './auth/GuestAuthContext'
import { ToastProvider } from './components'
import App from './App'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <GuestAuthProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </GuestAuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>,
)
