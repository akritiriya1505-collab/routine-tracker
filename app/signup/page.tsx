'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signup } from '@/lib/auth'
import Link from 'next/link'

export default function Signup() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    const { error: authError } = await signup(email, password)
    if (authError) {
      setError(authError.message)
    } else {
      setError('Account created! You can now log in.')
      setTimeout(() => router.push('/login'), 2000)
    }
    setLoading(false)
  }

  return (
    <div style={{ maxWidth: '400px', margin: '4rem auto', padding: '2rem' }}>
      <h1 style={{ marginBottom: '2rem', fontSize: '24px' }}>Sign up</h1>
      {error && (
        <div style={{
          padding: '1rem',
          background: error.includes('created') ? '#dcfce7' : '#fee2e2',
          border: error.includes('created') ? '0.5px solid #bbf7d0' : '0.5px solid #fecaca',
          borderRadius: '4px',
          color: error.includes('created') ? '#166534' : '#991b1b',
          marginBottom: '1rem',
          fontSize: '14px',
        }}>
          {error}
        </div>
      )}
      <form onSubmit={handleSignup}>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '14px', fontWeight: '500' }}>
            Email
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '0.5px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '14px',
            }}
          />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '14px', fontWeight: '500' }}>
            Password
          </label>
          <input
            type="password"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '0.5px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '14px',
            }}
          />
        </div>
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '14px', fontWeight: '500' }}>
            Confirm Password
          </label>
          <input
            type="password"
            required
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '0.5px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '14px',
            }}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '0.75rem',
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontWeight: '500',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          {loading ? 'Creating account...' : 'Sign up'}
        </button>
      </form>
      <p style={{ marginTop: '1rem', textAlign: 'center', fontSize: '14px', color: '#666' }}>
        Already have an account? <Link href="/login" style={{ color: '#3b82f6', textDecoration: 'none' }}>Login</Link>
      </p>
    </div>
  )
}
