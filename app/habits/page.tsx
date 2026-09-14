'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

interface HabitTemplate {
  id: string
  name: string
  category: string
}

export default function HabitsManager() {
  const [habits, setHabits] = useState<HabitTemplate[]>([])
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [habitName, setHabitName] = useState('')
  const [category, setCategory] = useState('health')
  const router = useRouter()

  useEffect(() => {
    const init = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        router.push('/login')
        return
      }
      setUser(authUser)

      const { data: habitsData } = await supabase
        .from('habit_templates')
        .select('*')
        .eq('user_id', authUser.id)

      setHabits(habitsData || [])
      setLoading(false)
    }

    init()
  }, [router])

  const handleAddHabit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!habitName.trim() || !user) return

    const { error } = await supabase.from('habit_templates').insert({
      user_id: user.id,
      name: habitName.trim(),
      category,
    })

    if (!error) {
      setHabitName('')
      const { data: habitsData } = await supabase
        .from('habit_templates')
        .select('*')
        .eq('user_id', user.id)
      setHabits(habitsData || [])
    }
  }

  const deleteHabit = async (habitId: string) => {
    if (!confirm('Delete this habit?')) return

    const { error } = await supabase
      .from('habit_templates')
      .delete()
      .eq('id', habitId)

    if (!error) {
      setHabits(prev => prev.filter(h => h.id !== habitId))
    }
  }

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>

  return (
    <div style={{ padding: '1.5rem', maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '24px', margin: 0 }}>My habits</h1>
        <Link href="/" style={{ color: '#3b82f6', textDecoration: 'none' }}>Back</Link>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '16px', marginBottom: '1rem' }}>Your habit library</h2>
        {habits.length === 0 ? (
          <p style={{ color: '#999' }}>No habits yet. Create one below!</p>
        ) : (
          habits.map(habit => (
            <div
              key={habit.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '1rem',
                background: '#f9fafb',
                border: '0.5px solid #e5e7eb',
                borderRadius: '8px',
                marginBottom: '8px',
              }}
            >
              <div>
                <div style={{ fontWeight: '500', fontSize: '14px' }}>{habit.name}</div>
                <div style={{ fontSize: '12px', color: '#666' }}>{habit.category}</div>
              </div>
              <button
                onClick={() => deleteHabit(habit.id)}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#fee2e2',
                  color: '#991b1b',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                Delete
              </button>
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleAddHabit} style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '16px', marginBottom: '1rem' }}>Create new habit</h2>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '14px', fontWeight: '500' }}>
            Habit name
          </label>
          <input
            type="text"
            value={habitName}
            onChange={e => setHabitName(e.target.value)}
            placeholder="e.g., Gym, Drink water, Skincare"
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
            Category
          </label>
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '0.5px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '14px',
            }}
          >
            <option value="health">Health</option>
            <option value="fitness">Fitness</option>
            <option value="wellness">Wellness</option>
            <option value="other">Other</option>
          </select>
        </div>
        <button
          type="submit"
          style={{
            width: '100%',
            padding: '0.75rem',
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: '500',
            fontSize: '14px',
          }}
        >
          Create habit
        </button>
      </form>
    </div>
  )
}
