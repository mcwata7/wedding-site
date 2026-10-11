import { useState } from 'react'
import { api } from '../api/client'
import { passkeysSupported, registerPasskey, passkeyError } from '../auth/passkeys'
import { Button, Input } from '../components'

export function PasskeysPage() {
  const [password, setPassword] = useState('')
  const [anotherDevice, setAnotherDevice] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const supported = passkeysSupported()

  const addPasskey = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSaved(false)
    setLoading(true)
    try {
      const { enrollmentToken } = await api.post<{ enrollmentToken: string }>('/api/v1/internal/passkeys/enrollment', { password })
      setPassword('')
      await registerPasskey(enrollmentToken, anotherDevice)
      setSaved(true)
    } catch (err) {
      const cancelled = err instanceof Error && (err.name === 'NotAllowedError' || err.name === 'AbortError')
      setError(cancelled ? 'Passkey setup was cancelled or timed out. Enter your password to try again.' : passkeyError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Passkeys</h1>
      <p className="text-sm text-gray-600">Add another passkey so you can sign in from more than one device. Your existing passkeys and password will continue to work.</p>
      {saved && <p role="status" className="rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-800">Passkey added. You can use it the next time you sign in.</p>}
      {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      {!supported ? (
        <p className="text-sm text-gray-600">Passkey setup needs a supported browser and a secure website connection. Open the planner in a supported browser to add a passkey.</p>
      ) : (
        <form onSubmit={addPasskey} className="space-y-5 rounded-lg border bg-white p-6">
          <fieldset disabled={loading} className="space-y-2">
            <legend className="mb-2 text-sm font-medium text-gray-700">Where would you like to save the passkey?</legend>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="radio" name="passkey-device" checked={anotherDevice} onChange={() => setAnotherDevice(true)} />
              Another device or security key
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="radio" name="passkey-device" checked={!anotherDevice} onChange={() => setAnotherDevice(false)} />
              This device or password manager
            </label>
          </fieldset>
          <p className="text-sm text-gray-600">{anotherDevice ? 'Your browser will offer available devices or security keys. If it shows a QR code, scan it with the device where you want to save the passkey, then follow its prompts. Keep the devices nearby with Bluetooth enabled.' : 'Follow your browser’s prompts to save a passkey on this device or in your password manager.'}</p>
          <div>
            <label htmlFor="passkey-password" className="mb-1 block text-sm font-medium text-gray-700">Confirm your password</label>
            <Input id="passkey-password" type="password" autoComplete="current-password" required maxLength={1024} disabled={loading} value={password} onChange={e => setPassword(e.target.value)} />
            <p className="mt-1 text-xs text-gray-500">Confirm your password before adding a new sign-in method.</p>
          </div>
          <Button type="submit" disabled={loading}>{loading ? 'Setting up passkey…' : 'Add passkey'}</Button>
        </form>
      )}
    </div>
  )
}
