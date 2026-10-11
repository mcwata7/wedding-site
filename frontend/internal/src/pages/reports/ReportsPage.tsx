import { FileDown } from 'lucide-react'
import { api } from '../../api/client'
import { Button, PageHeader, useToast } from '../../components'

export function ReportsPage() {
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
  const attendancePath = `${base}/attendance.csv`

  return (
    <div>
      <PageHeader title="Reports" />
      <div className="space-y-4 max-w-lg">

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-800 mb-1">Attendance Report</h2>
          <p className="text-sm text-gray-500 mb-4">One wedding RSVP per guest.</p>
          <div className="flex gap-3 items-end">
            <Button onClick={() => download(attendancePath, 'attendance.csv')}>
              <FileDown size={14} /> Download
            </Button>
          </div>
        </div>

        {[
          { title: 'Dietary & Accessibility', desc: 'Dietary requirements and accessibility needs per guest.', filename: 'dietary.csv', path: `${base}/dietary.csv` },
          { title: 'Guest List', desc: 'Relationship, side, attendance probability, passport, and room assignment per guest.', filename: 'guest-list.csv', path: `${base}/guest-list.csv` },
          { title: 'Rooming List', desc: 'Room assignments with check-in/out dates.', filename: 'rooming.csv', path: `${base}/rooming.csv` },
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
