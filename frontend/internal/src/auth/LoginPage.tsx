import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { api, ApiRequestError } from '../api/client'
import { loginOptions, passkeysSupported, signInWithPasskey, registerPasskey, passkeyError, type PlannerSession } from './passkeys'

type Step = 'email' | 'passkey' | 'password' | 'setup'
const inputClass = 'block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'
const buttonClass = 'w-full bg-indigo-600 text-white rounded-md py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors'
const secondaryClass = 'w-full text-indigo-700 rounded-md py-2 text-sm font-medium hover:bg-indigo-50 disabled:opacity-50'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [hasPasskey, setHasPasskey] = useState(false)
  const [enrollmentToken, setEnrollmentToken] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)
  const supported = passkeysSupported()

  const passwordSignIn = async () => {
    const result = await api.post<PlannerSession>('/api/v1/auth/planner/login', { email, password, origin: window.location.origin })
    login(result.accessToken, result.role)
    setPassword('')
    if (!result.hasPasskey && result.enrollmentToken) {
      setEnrollmentToken(result.enrollmentToken)
      setStep('setup')
    } else navigate('/')
  }
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setNotice('')
    setLoading(true)
    try {
      if (step === 'email') {
        if (!supported) {
          setNotice('Passkeys are unavailable in this browser. You can sign in with your password.')
          setStep('password')
        } else {
          try {
            const result = await loginOptions(email)
            setHasPasskey(result.hasPasskey)
            setStep(result.hasPasskey ? 'passkey' : 'password')
          } catch (err) {
            if (err instanceof ApiRequestError && err.code === 'PASSKEY_ORIGIN') {
              setNotice(err.message)
              setStep('password')
            } else throw err
          }
        }
      } else if (step === 'password') await passwordSignIn()
      else if (step === 'passkey') {
        const result = await signInWithPasskey(email)
        login(result.accessToken, result.role)
        navigate('/')
      } else if (enrollmentToken) {
        await registerPasskey(enrollmentToken)
        setEnrollmentToken(null)
        navigate('/')
      }
    } catch (err) {
      setError(passkeyError(err))
    } finally {
      setLoading(false)
    }
  }
  const changeEmail = () => {
    setStep('email')
    setPassword('')
    setHasPasskey(false)
    setError('')
    setNotice('')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 px-4">
      <div className="mx-auto w-full max-w-sm">
        <h1 className="text-center text-2xl font-bold text-gray-900 mb-8">Wedding Planner</h1>
        <div className="bg-white rounded-lg shadow p-8">
          <h2 className="text-lg font-semibold text-gray-700 mb-6">{step === 'setup' ? 'Set up your passkey' : 'Planner sign in'}</h2>
          {error && <div role="alert" className="mb-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}
          {notice && <p role="status" className="mb-4 text-sm text-gray-600">{notice}</p>}
          <form onSubmit={submit} className="space-y-4">
            {step === 'email' ? (
              <div>
                <label htmlFor="planner-email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input id="planner-email" type="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} className={inputClass} autoComplete="username" autoFocus />
              </div>
            ) : step !== 'setup' && (
              <div className="text-sm text-gray-600">
                <p className="break-all">{email}</p>
                <button type="button" disabled={loading} onClick={changeEmail} className="text-indigo-700 mt-1 hover:underline">Use a different email</button>
              </div>
            )}
            {step === 'password' && (
              <div>
                <label htmlFor="planner-password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input id="planner-password" type="password" required value={password} onChange={e => setPassword(e.target.value)} className={inputClass} autoComplete="current-password" autoFocus />
              </div>
            )}
            {step === 'passkey' && <p className="text-sm text-gray-600">Use your fingerprint, face, device PIN, or security key to sign in.</p>}
            {step === 'setup' && <p className="text-sm text-gray-600">Make your next sign-in easier with a passkey. Your device will help you set it up, and you can still use your password.</p>}
            {step === 'setup' && !supported && <p className="text-sm text-gray-600">Passkeys need a supported browser and a secure connection. You can continue now and set one up on a future login.</p>}
            {(step !== 'setup' || supported) && (
              <button type="submit" disabled={loading} className={buttonClass}>
                {loading ? 'Please wait…' : step === 'email' ? 'Continue' : step === 'password' ? 'Sign in' : step === 'passkey' ? 'Sign in with passkey' : 'Set up passkey'}
              </button>
            )}
            {step === 'passkey' && <button type="button" disabled={loading} className={secondaryClass} onClick={() => { setStep('password'); setError('') }}>Use password instead</button>}
            {step === 'password' && hasPasskey && supported && <button type="button" disabled={loading} className={secondaryClass} onClick={() => { setStep('passkey'); setPassword(''); setError('') }}>Use passkey instead</button>}
            {step === 'setup' && <button type="button" disabled={loading} className={secondaryClass} onClick={() => { setEnrollmentToken(null); navigate('/') }}>Not now</button>}
          </form>
        </div>
        <p className="mt-4 text-center text-xs text-gray-400">Refreshing or closing this tab signs you out.</p>
      </div>
    </div>
  )
}
