import { useState } from 'react'
import { FileDown } from 'lucide-react'
import { useEvents } from '../../api/hooks'
import { api } from '../../api/client'
import { Button, PageHeader, Select, useToast } from '../../components'

export function ReportsPage() {
  const { data: events } = useEvents()
  const [eventId, setEventId] = useState('')
  const toast = useToast()

  const download = async (path: string, filename: string) => {
    try {
      await api.downloadCsv(path, filename)
      toast.success(`Downloaded ${filename}`)
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  const base = '/api/v1/internal/reports'
  const attendancePath = `${base}/attendance.csv${eventId ? `?eventId=${eventId}` : ''}`

  return (
    <div>
      <PageHeader title="Reports" />
      <div className="space-y-4 max-w-lg">

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-800 mb-1">Attendance Report</h2>
          <p className="text-sm text-gray-500 mb-4">RSVP status for all attendees. Optionally filter by event.</p>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Filter by event (optional)</label>
              <Select
                value={eventId}
                onChange={setEventId}
                placeholder="All events"
                options={(events ?? []).map(e => ({ value: e.id, label: e.name }))}
              />
            </div>
            <Button onClick={() => download(attendancePath, 'attendance.csv')}>
              <FileDown size={14} /> Download
            </Button>
          </div>
        </div>

        {[
          { title: 'Dietary & Accessibility', desc: 'Dietary requirements and accessibility needs per guest.', filename: 'dietary.csv', path: `${base}/dietary.csv` },
          { title: 'Rooming List', desc: 'Room assignments with check-in/out dates.', filename: 'rooming.csv', path: `${base}/rooming.csv` },
          { title: 'Budget Summary', desc: 'Planned vs. actual spend by category.', filename: 'budget.csv', path: `${base}/budget.csv` },
        ].map(({ title, desc, filename, path }) => (
          <div key={filename} className="bg-white rounded-lg border border-gray-200 p-6 flex items-center gap-4">
            <div className="flex-1">
              <h2 className="font-semibold text-gray-800">{title}</h2>
              <p className="text-sm text-gray-500 mt-0.5">{desc}</p>
            </div>
            <Button onClick={() => download(path, filename)}>
              <FileDown size={14} /> Download
            </Button>
          </div>
        ))}

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-800 mb-1">Guest Import Template</h2>
          <p className="text-sm text-gray-500 mb-4">Blank CSV template for bulk guest import.</p>
          <Button onClick={() => download('/api/v1/internal/guests/import-template.csv', 'guest-import-template.csv')}>
            <FileDown size={14} /> Download Template
          </Button>
        </div>

      </div>
    </div>
  )
}
