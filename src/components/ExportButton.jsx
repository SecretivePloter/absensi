import { Button } from './ui/button'
import { FileSpreadsheet } from 'lucide-react'
import { exportAttendanceToExcel } from '../utils/exportExcel'

export function ExportButton({ records, filename, disabled }) {
  const handleExport = () => {
    if (!records || records.length === 0) return
    exportAttendanceToExcel(records, filename)
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={disabled || !records || records.length === 0}
    >
      <FileSpreadsheet className="h-4 w-4 mr-1.5" />
      Export Excel
    </Button>
  )
}
