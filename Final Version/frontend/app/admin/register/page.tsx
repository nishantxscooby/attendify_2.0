'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

export default function AdminRegisterPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!username || !password || !confirm) {
      setError('Please fill all fields.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 6) {
      setError('Password should be at least 6 characters.')
      return
    }

    setLoading(true)
    try {
      // TODO: call real API; mocked for now
      // await fetch('/api/admin/register', { method:'POST', body: JSON.stringify({ username, password }) })
      // Store nothing sensitive in localStorage here (registration only).
      // On success, go back to login WITH a success flag in the URL:
      router.push('/?registered=1')
    } catch (e) {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-gray-50 to-white p-4 space-y-6">
      {/* Heading like login */}
      <div className="text-center">
        <h1 className="text-4xl font-bold">Attendify</h1>
        <p className="text-sm text-muted-foreground">AI-powered attendance management system</p>
      </div>

      <Card className="w-full max-w-md p-6">
        <CardHeader>
          <CardTitle className="text-xl">Create Admin Account</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            This account will have full access to the Admin Panel.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-4">
            {error && (
              <div className="rounded-md bg-red-50 text-red-700 text-sm px-3 py-2">
                {error}
              </div>
            )}
            <div>
              <Label htmlFor="username">Username</Label>
              <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              <p className="text-xs text-muted-foreground mt-1">Min 6 characters.</p>
            </div>
            <div>
              <Label htmlFor="confirm">Confirm Password</Label>
              <Input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Registering…' : 'Register'}
            </Button>

            <p className="text-xs text-center text-gray-500">
              Already have an account? <a href="/" className="underline">Back to Login</a>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
