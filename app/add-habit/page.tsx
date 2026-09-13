'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AddHabit() {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleAddHabit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('Not logged in')
      setLoading(false)
      return
    }

    const { error: dbError } = await supabase.from('habits').insert({
      user_id: user.id,
      name: name.trim(),
    })

    if (dbError) {
      setError(dbError.message)
    } else {
      setName('')
      router.push('/')
    }
    setLoading(false)
  }

  return (
    <div style={{ maxWidth: '400px', margin: '4rem auto', padding: '2rem' }}>
      <h1 style={{ marginBottom: '2rem', fontSize: '24px' }}>Add habit</h1>
      {error && (
        <div style={{
          padding: '1rem',
          background: '#fee2e2',
          border: '0.5px solid #fecaca',
          borderRadius: '4px',
          color: '#991b1b',
          marginBottom: '1rem',
        }}>
          {error}
        </div>
      )}
      <form onSubmit={handleAddHabit}>
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '14px', fontWeight: '500' }}>
            Habit name
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g., Take supplements, Meditate, Drink water"
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
          {loading ? 'Adding...' : 'Add habit'}
        </button>
      </form>
      <p style={{ marginTop: '1rem', textAlign: 'center' }}>
        <a href="/" style={{ color: '#3b82f6', textDecoration: 'none' }}>Back</a>
      </p>
    </div>
  )
}
