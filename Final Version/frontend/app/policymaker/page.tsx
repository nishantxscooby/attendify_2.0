'use client'

import React, { useMemo, useState } from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Download, BarChart3, TrendingUp, ShieldCheck } from 'lucide-react'

type KPI = { label: string; value: string; delta?: string; positive?: boolean }
type District = { name: string; region: 'North' | 'South' | 'East' | 'West'; attendance: number }
type RangeKey = 'semester' | '30d' | 'yoy'
type RegionKey = 'all' | 'north' | 'south' | 'east' | 'west'

/* ------------------------ MOCK DATA (switch by range) ----------------------- */
const DATA_BY_RANGE: Record<
  RangeKey,
  {
    kpis: KPI[]
    complianceByRegion: { region: 'North' | 'South' | 'East' | 'West'; value: number }[]
    districts: District[]
  }
> = {
  semester: {
    kpis: [
      { label: 'National Attendance Avg', value: '84%', delta: '+2.1 pts', positive: true },
      { label: 'Districts Below 75%', value: '42', delta: '-5', positive: true },
      { label: 'Semester Pass Rate', value: '76%', delta: '+1.3 pts', positive: true },
      { label: 'Institutions Onboarded', value: '312', delta: '+19', positive: true },
    ],
    complianceByRegion: [
      { region: 'North', value: 81 },
      { region: 'South', value: 79 },
      { region: 'East', value: 86 },
      { region: 'West', value: 88 },
    ],
    districts: [
      { name: 'Aurora', region: 'North', attendance: 92 },
      { name: 'Brookfield', region: 'West', attendance: 89 },
      { name: 'Cypress', region: 'East', attendance: 87 },
      { name: 'Dover', region: 'South', attendance: 83 },
      { name: 'Elmwood', region: 'North', attendance: 72 },
      { name: 'Fairview', region: 'South', attendance: 69 },
      { name: 'Greendale', region: 'West', attendance: 71 },
      { name: 'Hillside', region: 'East', attendance: 67 },
    ],
  },
  '30d': {
    kpis: [
      { label: 'National Attendance Avg', value: '81%', delta: '-1.5 pts', positive: false },
      { label: 'Districts Below 75%', value: '56', delta: '+3', positive: false },
      { label: 'Semester Pass Rate', value: '72%', delta: '-2.0 pts', positive: false },
      { label: 'Institutions Onboarded', value: '298', delta: '+5', positive: true },
    ],
    complianceByRegion: [
      { region: 'North', value: 78 },
      { region: 'South', value: 75 },
      { region: 'East', value: 83 },
      { region: 'West', value: 84 },
    ],
    districts: [
      { name: 'Aurora', region: 'North', attendance: 88 },
      { name: 'Brookfield', region: 'West', attendance: 84 },
      { name: 'Cypress', region: 'East', attendance: 82 },
      { name: 'Dover', region: 'South', attendance: 77 },
      { name: 'Elmwood', region: 'North', attendance: 69 },
      { name: 'Fairview', region: 'South', attendance: 65 },
      { name: 'Greendale', region: 'West', attendance: 68 },
      { name: 'Hillside', region: 'East', attendance: 63 },
    ],
  },
  yoy: {
    kpis: [
      { label: 'National Attendance Avg', value: '86%', delta: '+4.0 pts', positive: true },
      { label: 'Districts Below 75%', value: '38', delta: '-12', positive: true },
      { label: 'Semester Pass Rate', value: '78%', delta: '+3.1 pts', positive: true },
      { label: 'Institutions Onboarded', value: '330', delta: '+25', positive: true },
    ],
    complianceByRegion: [
      { region: 'North', value: 83 },
      { region: 'South', value: 82 },
      { region: 'East', value: 88 },
      { region: 'West', value: 90 },
    ],
    districts: [
      { name: 'Aurora', region: 'North', attendance: 93 },
      { name: 'Brookfield', region: 'West', attendance: 91 },
      { name: 'Cypress', region: 'East', attendance: 90 },
      { name: 'Dover', region: 'South', attendance: 85 },
      { name: 'Elmwood', region: 'North', attendance: 74 },
      { name: 'Fairview', region: 'South', attendance: 71 },
      { name: 'Greendale', region: 'West', attendance: 73 },
      { name: 'Hillside', region: 'East', attendance: 70 },
    ],
  },
}

/* ------------------------------- COMPONENT ------------------------------- */
export default function PolicymakerDashboard() {
  const [range, setRange] = useState<RangeKey>('semester')
  const [region, setRegion] = useState<RegionKey>('all')

  const { kpis, complianceByRegion, districts } = DATA_BY_RANGE[range]

  const filteredDistricts = useMemo(
    () => (region === 'all' ? districts : districts.filter((d) => d.region.toLowerCase() === region)),
    [districts, region]
  )

  const top = [...filteredDistricts].sort((a, b) => b.attendance - a.attendance).slice(0, 4)
  const bottom = [...filteredDistricts].sort((a, b) => a.attendance - b.attendance).slice(0, 4)

  const navigation = [{ name: 'Overview', href: '/policymaker', icon: <BarChart3 className="h-5 w-5" />, current: true }]

  /* --------------------------- Export Functions --------------------------- */
  function handleExportCSV() {
    const lines: string[] = []

    lines.push(`Smart Attendance - Policymaker Export`)
    lines.push(`Range,${range},Region,${region}`)
    lines.push('')

    lines.push('KPI,Value,Delta')
    kpis.forEach((k) => lines.push(`${k.label},${k.value},${k.delta ?? ''}`))
    lines.push('')

    lines.push('Compliance by Region,Percent')
    DATA_BY_RANGE[range].complianceByRegion.forEach((r) => lines.push(`${r.region},${r.value}%`))
    lines.push('')

    lines.push('Top Districts by Attendance,,,')
    lines.push('District,Region,Attendance')
    top.forEach((d) => lines.push(`${d.name},${d.region},${d.attendance}%`))
    lines.push('')

    lines.push('Districts Requiring Attention,,,')
    lines.push('District,Region,Attendance')
    bottom.forEach((d) => lines.push(`${d.name},${d.region},${d.attendance}%`))

    const csv = lines.join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `policymaker_${range}_${region}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  function handleExportPDF() {
    const html = `
<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Policy Brief — ${range} — ${region}</title>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;padding:24px;color:#111}
  h1{font-size:22px;margin:0 0 8px}
  h2{font-size:16px;margin:20px 0 8px}
  table{width:100%;border-collapse:collapse;margin-top:8px}
  th,td{border:1px solid #ddd;padding:8px;text-align:left;font-size:12px}
  th{background:#f5f5f5}
  .kpi{display:flex;justify-content:space-between;border:1px solid #eee;padding:10px;border-radius:8px;margin:8px 0}
  .muted{color:#666;font-size:12px}
</style>
</head>
<body>
  <h1>Smart Attendance — Policy Brief</h1>
  <div class="muted">Timeframe: <b>${range}</b> · Region: <b>${region}</b></div>

  <h2>Key Indicators</h2>
  ${kpis
    .map(
      (k) => `
    <div class="kpi">
      <div>${k.label}</div>
      <div><b>${k.value}</b> ${k.delta ? `(${k.delta})` : ''}</div>
    </div>
  `
    )
    .join('')}

  <h2>Compliance by Region (≥ 75%)</h2>
  <table>
    <thead><tr><th>Region</th><th>Compliance</th></tr></thead>
    <tbody>
      ${DATA_BY_RANGE[range].complianceByRegion
        .map((r) => `<tr><td>${r.region}</td><td>${r.value}%</td></tr>`)
        .join('')}
    </tbody>
  </table>

  <h2>Top Districts by Attendance</h2>
  <table>
    <thead><tr><th>District</th><th>Region</th><th>Attendance</th></tr></thead>
    <tbody>
      ${top.map((d) => `<tr><td>${d.name}</td><td>${d.region}</td><td>${d.attendance}%</td></tr>`).join('')}
    </tbody>
  </table>

  <h2>Districts Requiring Attention</h2>
  <table>
    <thead><tr><th>District</th><th>Region</th><th>Attendance</th></tr></thead>
    <tbody>
      ${bottom.map((d) => `<tr><td>${d.name}</td><td>${d.region}</td><td>${d.attendance}%</td></tr>`).join('')}
    </tbody>
  </table>

  <p class="muted">Methodology: Aggregates are based on institution-reported attendance and pass rates; figures are anonymized.</p>
  <script>window.onload = () => window.print();</script>
</body>
</html>
    `.trim()

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  return (
    <DashboardLayout title="Policymaker — National KPIs" userType="policymaker" navigation={navigation}>
      {/* Controls */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="text-sm text-muted-foreground">Timeframe:</div>
        <div className="flex overflow-hidden rounded-md border">
          <FilterTab label="This Semester" active={range === 'semester'} onClick={() => setRange('semester')} />
          <FilterTab label="Last 30 days" active={range === '30d'} onClick={() => setRange('30d')} />
          <FilterTab label="Year over Year" active={range === 'yoy'} onClick={() => setRange('yoy')} />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Region:</span>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value as RegionKey)}
            className="h-9 rounded-md border bg-white px-2 text-sm"
          >
            <option value="all">All</option>
            <option value="north">North</option>
            <option value="south">South</option>
            <option value="east">East</option>
            <option value="west">West</option>
          </select>
          <Button variant="outline" size="sm" className="gap-2" onClick={handleExportCSV}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
          <Button size="sm" className="gap-2" onClick={handleExportPDF}>
            <Download className="h-4 w-4" /> Export Policy Brief (PDF)
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardHeader>
              <CardTitle className="text-sm">{k.label}</CardTitle>
            </CardHeader>
            <CardContent className="flex items-end justify-between">
              <div className="text-3xl font-bold">{k.value}</div>
              {k.delta && (
                <Badge variant={k.positive ? 'default' : 'destructive'} className="text-xs">
                  {k.delta}
                </Badge>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Compliance by Region */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" /> Policy Compliance by Region (≥ 75% Attendance)
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {complianceByRegion.map((r) => (
            <div key={r.region}>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium">{r.region}</span>
                <span className="text-muted-foreground">{r.value}%</span>
              </div>
              <div className="h-2 w-full rounded bg-muted">
                <div className="h-2 rounded bg-foreground" style={{ width: `${r.value}%` }} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Top / Bottom districts */}
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top Districts by Attendance</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>District</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead className="text-right">Attendance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {top.map((d) => (
                  <TableRow key={d.name}>
                    <TableCell>{d.name}</TableCell>
                    <TableCell className="text-muted-foreground">{d.region}</TableCell>
                    <TableCell className="text-right font-medium">{d.attendance}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Districts Requiring Attention</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>District</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead className="text-right">Attendance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bottom.map((d) => (
                  <TableRow key={d.name}>
                    <TableCell>{d.name}</TableCell>
                    <TableCell className="text-muted-foreground">{d.region}</TableCell>
                    <TableCell className="text-right font-medium">{d.attendance}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Strategy */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" /> Strategic Initiatives
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• Incentivize districts improving compliance from 65% → 75% within the semester.</p>
          <p>• Trigger early-warning outreach for sharp month-on-month declines.</p>
          <p>• Standardize remote/online class compatibility reporting across regions.</p>
        </CardContent>
      </Card>
    </DashboardLayout>
  )
}

/* ------------------------------- Helpers ------------------------------- */
function FilterTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 text-sm ${active ? 'bg-foreground text-white' : 'bg-background text-muted-foreground'} transition`}
    >
      {label}
    </button>
  )
}
