import { useQuery } from '@tanstack/react-query'
import { api, ApiRequestError } from '../api/client'
import { ContactForm, type Contact } from '../auth/ContactGate'
import { useGuestAuth } from '../auth/GuestAuthContext'
import { LoadingSpinner } from '../components'

export function ContactInfoPage() {
  const { logout } = useGuestAuth()
  const query = useQuery({ queryKey: ['guest-contact'], queryFn: () => api.get<Contact>('/api/v1/guest/contact'), retry: false, refetchOnMount: 'always', refetchOnWindowFocus: false, refetchOnReconnect: false })
  if (query.isPending) return <LoadingSpinner />
  if (query.error) {
    const signIn = query.error instanceof ApiRequestError && (query.error.code === 'GUEST_IDENTITY_REQUIRED' || query.error.status === 403)
    return (
      <div className="text-center space-y-4">
        <h1 className="font-display text-2xl">Your contact information</h1>
        <p role="alert">{signIn ? 'Please sign in again to edit your contact information.' : 'Unable to load your contact information. Please try again.'}</p>
        <button className="underline" onClick={signIn ? logout : () => { void query.refetch() }}>{signIn ? 'Sign in again' : 'Try again'}</button>
      </div>
    )
  }
  // Mount the form only once the current server values are available.
  if (query.isFetching) return <LoadingSpinner />
  return <ContactForm contact={query.data} editing />
}
