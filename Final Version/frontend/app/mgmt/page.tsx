'use client'

import { useState } from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Download, BarChart3 } from 'lucide-react'

export default function ManagementDashboardPage() {
  /* ------------------------------ State ------------------------------ */
  const [term, setTerm] = useState<'semester' | '30d' | 'yoy'>('semester')
  const [dept, setDept] = useState<'all' | 'cs' | 'math' | 'physics' | 'english'>('all')

  /* ------------------------------ Mock Data ------------------------------ */
  const kpis = [
    { label: 'Total Students', value: '1,245' },
    { label: 'Total Teachers', value: '87' },
    { label: 'Average Attendance', value: '82%' },
    { label: 'At-Risk Students', value: '46' },
  ]

  const alerts = [
    { title: 'Physics 301 Attendance Decline', detail: 'Attendance fell below 75% this week. Immediate review recommended.' },
    { title: 'Consecutive Absences', detail: '12 students have 3+ consecutive absences. Outreach is required.' },
    { title: 'Accreditation Report', detail: 'Submission due next month. Ensure compliance documentation is updated.' },
  ]

  const faculty = [
    { name: 'Prof. A. Smith', dept: 'Computer Science', classes: 4, avg: 89, lowFlags: 0 },
    { name: 'Dr. R. Johnson', dept: 'Mathematics',      classes: 3, avg: 81, lowFlags: 1 },
    { name: 'Dr. M. Williams', dept: 'Physics',         classes: 5, avg: 73, lowFlags: 3 },
    { name: 'Ms. L. Brown',    dept: 'English',         classes: 3, avg: 86, lowFlags: 0 },
    { name: 'Mr. V. Patel',    dept: 'Economics',       classes: 4, avg: 78, lowFlags: 2 },
  ]

  const filteredFaculty = dept === 'all' ? faculty : faculty.filter(f => f.dept.toLowerCase().includes(dept))

  /* ------------------------------ Export Functions ------------------------------ */
  function exportCSV() {
    const lines: string[] = []
    lines.push('College Management Dashboard')
    lines.push('')
    lines.push('KPIs')
    kpis.forEach(k => lines.push(`${k.label},${k.value}`))
    lines.push('')
    lines.push('Faculty Performance')
    lines.push('Name,Department,Classes,Avg Attendance,Low Attendance Flags')
    faculty.forEach(f => lines.push(`${f.name},${f.dept},${f.classes},${f.avg}%,${f.lowFlags}`))
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'management_dashboard.csv'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  function exportPDF() {
    const html = `
<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>College Management Report</title>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;padding:24px;color:#111}
  h1{font-size:22px;margin:0 0 8px}
  h2{font-size:16px;margin:18px 0 8px}
  table{width:100%;border-collapse:collapse;margin-top:8px}
  th,td{border:1px solid #ddd;padding:8px;text-align:left;font-size:12px}
  th{background:#f5f5f5}
  .kpi{display:flex;justify-content:space-between;border:1px solid #eee;padding:10px;border-radius:8px;margin:6px 0}
  .muted{color:#666;font-size:12px}
</style>
</head>
<body>
  <h1>Smart Attendance — College Management Report</h1>

  <h2>Key Indicators</h2>
  ${kpis.map(k => `<div class="kpi"><div>${k.label}</div><div><b>${k.value}</b></div></div>`).join('')}

  <h2>Faculty Performance</h2>
  <table>
    <thead><tr><th>Name</th><th>Department</th><th>Classes</th><th>Avg Attendance</th><th>Low Attendance Flags</th></tr></thead>
    <tbody>
      ${faculty.map(f => `<tr><td>${f.name}</td><td>${f.dept}</td><td>${f.classes}</td><td>${f.avg}%</td><td>${f.lowFlags}</td></tr>`).join('')}
    </tbody>
  </table>

  <h2>Compliance Alerts</h2>
  <ul class="muted">
    ${alerts.map(a => `<li><b>${a.title}:</b> ${a.detail}</li>`).join('')}
  </ul>

  <script>window.onload=()=>window.print()</script>
</body>
</html>
    `.trim()

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  /* ------------------------------ UI ------------------------------ */
  return (
    <DashboardLayout
      title="College Management Dashboard"
      userType="mgmt"
      navigation={[
        { name: 'Overview', href: '/mgmt', icon: <BarChart3 className="h-5 w-5" />, current: true },
      ]}
    >
      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2 text-sm text-muted-foreground">
          <span>Term:</span>
          <Button size="sm" variant={term === 'semester' ? 'default' : 'outline'} onClick={() => setTerm('semester')}>This Semester</Button>
          <Button size="sm" variant={term === '30d' ? 'default' : 'outline'} onClick={() => setTerm('30d')}>Last 30 Days</Button>
          <Button size="sm" variant={term === 'yoy' ? 'default' : 'outline'} onClick={() => setTerm('yoy')}>Year over Year</Button>
        </div>
        <div className="flex gap-2 text-sm text-muted-foreground">
          <span>Department:</span>
          <Button size="sm" variant={dept === 'all' ? 'default' : 'outline'} onClick={() => setDept('all')}>All</Button>
          <Button size="sm" variant={dept === 'cs' ? 'default' : 'outline'} onClick={() => setDept('cs')}>CS</Button>
          <Button size="sm" variant={dept === 'math' ? 'default' : 'outline'} onClick={() => setDept('math')}>Math</Button>
          <Button size="sm" variant={dept === 'physics' ? 'default' : 'outline'} onClick={() => setDept('physics')}>Physics</Button>
          <Button size="sm" variant={dept === 'english' ? 'default' : 'outline'} onClick={() => setDept('english')}>English</Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map(k => (
          <Card key={k.label}>
            <CardHeader><CardTitle className="text-sm">{k.label}</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{k.value}</div></CardContent>
          </Card>
        ))}
      </div>

      {/* Export actions */}
      <div className="my-6 flex justify-end gap-2">
        <Button variant="outline" size="sm" className="gap-2" onClick={exportCSV}>
          <Download className="h-4 w-4" /> Export CSV
        </Button>
        <Button size="sm" className="gap-2" onClick={exportPDF}>
          <Download className="h-4 w-4" /> Export PDF
        </Button>
      </div>

      {/* Faculty Performance */}
      <Card className="mb-6">
        <CardHeader><CardTitle>Faculty Performance (Attendance)</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Faculty</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Classes</TableHead>
                <TableHead>Avg Attendance</TableHead>
                <TableHead className="text-right">Flags</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredFaculty.map(f => (
                <TableRow key={f.name}>
                  <TableCell>{f.name}</TableCell>
                  <TableCell className="text-muted-foreground">{f.dept}</TableCell>
                  <TableCell>{f.classes}</TableCell>
                  <TableCell>
                    <span className={f.avg < 75 ? 'text-red-600 font-medium' : 'font-medium'}>
                      {f.avg}%
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {f.lowFlags === 0 ? (
                      <Badge className="text-xs">OK</Badge>
                    ) : (
                      <Badge variant="destructive" className="text-xs">
                        {f.lowFlags} issue{f.lowFlags > 1 ? 's' : ''}
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="mt-3 text-xs text-muted-foreground">
            Flags indicate classes where average attendance fell below 75% during the selected term.
          </p>
        </CardContent>
      </Card>

      {/* Compliance Alerts */}
      <Card>
        <CardHeader><CardTitle>Compliance Alerts</CardTitle></CardHeader>
        <CardContent>
          <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            {alerts.map((a, i) => (
              <li key={i}>
                <span className="text-foreground font-medium">{a.title}:</span> {a.detail}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </DashboardLayout>
  )
}
