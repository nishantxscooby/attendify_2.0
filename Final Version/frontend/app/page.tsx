'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card } from '@/components/ui/card'

function LoginContent() {
  const router = useRouter()
  const search = useSearchParams()
  const justRegistered = search?.get('registered') === '1'
  const [role, setRole] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  function handleLogin(e: React.FormEvent) {
    e.preventDefault()

    // TODO: Replace with real API later
    if (!role || !username || !password) {
      alert('Please fill all fields')
      return
    }

    const user = { role, name: username, email: username + '@example.com' }
    localStorage.setItem('user', JSON.stringify(user))

    if (role === 'STUDENT') router.push('/student')
    if (role === 'TEACHER') router.push('/teacher')
    if (role === 'ADMIN') router.push('/admin')
    if (role === 'MGMT') router.push('/mgmt')
    if (role === 'DEPT') router.push('/dept')
    if (role === 'POLICYMAKER') router.push('/policymaker')
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-gray-50 to-white p-4 space-y-6">
      {/* Heading section outside the box */}
      <div className="text-center">
        <h1 className="text-4xl font-bold">Attendify</h1>
        <p className="text-sm text-muted-foreground">AI-powered attendance management system</p>
      </div>

      {/* The white card with form stays below */}
      <Card className="w-full max-w-md p-6">
        <form onSubmit={handleLogin} className="space-y-6">
          {justRegistered && (
            <div className="rounded-md bg-green-50 text-green-700 text-sm px-3 py-2 text-center">
              Admin registered successfully. Please log in.
            </div>
          )}

          <div>
            <label className="block text-sm font-medium">User Type</label>
            <select value={role} onChange={(e) => setRole(e.target.value)} className="mt-1 block w-full border rounded-md p-2">
              <option value="">Select your role</option>
              <option value="STUDENT">Student</option>
              <option value="TEACHER">Teacher</option>
              <option value="ADMIN">Admin</option>
              <option value="MGMT">Management</option>
              <option value="DEPT">Education Dept</option>
              <option value="POLICYMAKER">Policymaker</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium">Username</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="mt-1 block w-full border rounded-md p-2" />
          </div>

          <div>
            <label className="block text-sm font-medium">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 block w-full border rounded-md p-2" />
          </div>

          <button type="submit" className="w-full bg-black text-white rounded-md py-2">Sign In</button>
          <p className="text-xs text-center text-gray-500">
            Need public insights? <a href="/dept" className="underline">Education Dept</a> &middot; <a href="/policymaker" className="underline">Policymaker</a>
          </p>
          <p className="text-xs text-center text-gray-500">
            Need an account?{' '}
            <a href="/admin/register" className="underline text-blue-600">Register as Admin</a>
          </p>
        </form>
      </Card>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading…</div>}>
      <LoginContent />
    </Suspense>
  )
}
