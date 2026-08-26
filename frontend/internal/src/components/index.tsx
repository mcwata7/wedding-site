import {
  createContext, useContext, useCallback, useState,
  type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes, type TextareaHTMLAttributes,
} from 'react'
import { X } from 'lucide-react'
import { useMediaAssets } from '../api/hooks'
import type { MediaAsset } from '../api/types'

// --- Button ---
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md'
}
export function Button({ variant = 'primary', size = 'md', className = '', children, ...props }: ButtonProps) {
  const base = 'inline-flex items-center gap-1.5 font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
  const sizes = { sm: 'px-3 py-1.5 text-sm', md: 'px-4 py-2 text-sm' }
  const variants = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500',
    secondary: 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    ghost: 'text-gray-600 hover:bg-gray-100',
  }
  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  )
}

// --- Badge ---
export function Badge({ label, className = '' }: { label: string; className?: string }) {
  return <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${className}`}>{label}</span>
}

// --- Modal ---
interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg'
}
export function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  if (!open) return null
  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={`relative bg-white rounded-lg shadow-xl w-full ${widths[size]} max-h-[90vh] flex flex-col`}>
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto p-6 space-y-4">{children}</div>
      </div>
    </div>
  )
}

// --- Field ---
interface FieldProps {
  label: string
  error?: string
  required?: boolean
  children: ReactNode
}
export function Field({ label, error, required, children }: FieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}

// --- Input ---
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}
export function Input({ error, className = '', ...props }: InputProps) {
  return (
    <input
      className={`block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${error ? 'border-red-400' : 'border-gray-300'} ${className}`}
      {...props}
    />
  )
}

// --- Textarea ---
interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean
}
export function TextArea({ error, className = '', ...props }: TextAreaProps) {
  return (
    <textarea
      rows={3}
      className={`block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${error ? 'border-red-400' : 'border-gray-300'} ${className}`}
      {...props}
    />
  )
}

// --- Select ---
interface SelectProps {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
  error?: boolean
  className?: string
}
export function Select({ value, onChange, options, placeholder, error, className = '' }: SelectProps) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={`block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white ${error ? 'border-red-400' : 'border-gray-300'} ${className}`}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

// --- Table ---
interface Column<T> {
  key: string
  header: string
  render?: (row: T) => ReactNode
}
interface TableProps<T extends { id: string }> {
  columns: Column<T>[]
  rows: T[]
  onRowClick?: (row: T) => void
  emptyMessage?: string
}
export function Table<T extends { id: string }>({ columns, rows, onRowClick, emptyMessage = 'No records found.' }: TableProps<T>) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            {columns.map(c => (
              <th key={c.key} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-100">
          {rows.length === 0 ? (
            <tr><td colSpan={columns.length} className="px-4 py-8 text-center text-gray-400">{emptyMessage}</td></tr>
          ) : rows.map(row => (
            <tr
              key={row.id}
              onClick={() => onRowClick?.(row)}
              className={onRowClick ? 'cursor-pointer hover:bg-indigo-50 transition-colors' : ''}
            >
              {columns.map(c => (
                <td key={c.key} className="px-4 py-3 text-gray-700 whitespace-nowrap">
                  {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// --- Toast ---
interface Toast {
  id: number
  message: string
  type: 'success' | 'error' | 'info'
}
interface ToastCtx {
  success: (msg: string) => void
  error: (msg: string) => void
  info: (msg: string) => void
}
const ToastContext = createContext<ToastCtx | null>(null)

let _nextId = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const push = useCallback((message: string, type: Toast['type']) => {
    const id = ++_nextId
    setToasts(t => [...t, { id, message, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000)
  }, [])

  const ctx: ToastCtx = {
    success: (m) => push(m, 'success'),
    error: (m) => push(m, 'error'),
    info: (m) => push(m, 'info'),
  }

  const colors = { success: 'bg-green-600', error: 'bg-red-600', info: 'bg-indigo-600' }

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map(t => (
          <div key={t.id} className={`${colors[t.type]} text-white text-sm px-4 py-3 rounded-lg shadow-lg max-w-xs`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastCtx {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be inside ToastProvider')
  return ctx
}

// --- Loading / Error states ---
export function LoadingSpinner() {
  return (
    <div className="flex justify-center items-center py-12">
      <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
    </div>
  )
}

export function ErrorMessage({ message }: { message: string }) {
  return <div className="rounded-md bg-red-50 border border-red-200 p-4 text-sm text-red-700">{message}</div>
}

// --- Page layout helpers ---
export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  )
}

export function Section({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {title && <div className="px-6 py-4 border-b bg-gray-50 font-medium text-gray-700">{title}</div>}
      <div className="p-6">{children}</div>
    </div>
  )
}

// --- MediaPicker ---
interface MediaPickerProps {
  value: string
  onChange: (id: string) => void
  filter?: (m: MediaAsset) => boolean
}
export function MediaPicker({ value, onChange, filter }: MediaPickerProps) {
  const { data: media } = useMediaAssets()
  const filtered = (media ?? []).filter(m => !filter || filter(m))
  const options = [{ value: '', label: 'None' }, ...filtered.map(m => ({ value: m.id, label: m.original_name || m.id }))]
  return (
    <div className="flex items-center gap-3">
      <Select value={value} onChange={onChange} options={options} />
      {value && <img src={`/api/v1/media/${value}`} alt="" className="h-10 w-10 rounded object-cover border border-gray-200" />}
    </div>
  )
}
