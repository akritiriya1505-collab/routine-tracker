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

interface HabitLog {
  habit_template_id: string
  completed: boolean
  count: number
}

export default function AddHabitsToday() {
  const [habits, setHabits] = useState<HabitTemplate[]>([])
  const [logs, setLogs] = useState<HabitLog[]>([])
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
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

      const today = new Date().toISOString().split('T')[0]
      const { data: logsData } = await supabase
        .from('habit_logs')
        .select('*')
        .eq('user_id', authUser.id)
        .eq('date', today)

      setLogs(logsData || [])
      setLoading(false)
    }

    init()
  }, [router])

  const toggleHabit = async (habitId: string, completed: boolean) => {
    if (!user) return

    const today = new Date().toISOString().split('T')[0]

    const { error } = await supabase.from('habit_logs').upsert({
      user_id: user.id,
      habit_template_id: habitId,
      date: today,
      completed,
    }, {
      onConflict: 'user_id,habit_template_id,date'
    })

    if (!error) {
      setLogs(prev => {
        const existing = prev.find(l => l.habit_template_id === habitId)
        if (existing) {
          return prev.map(l => l.habit_template_id === habitId ? { ...l, completed } : l)
        }
        return [...prev, { habit_template_id: habitId, completed, count: 0 }]
      })
    }
  }

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>

  const completedCount = logs.filter(l => l.completed).length

  return (
    <div style={{ padding: '1.5rem', maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '24px', margin: 0 }}>Today's habits</h1>
        <Link href="/" style={{ color: '#3b82f6', textDecoration: 'none' }}>Back</Link>
      </div>

      <div style={{ fontSize: '12px', color: '#666', marginBottom: '1.5rem' }}>
        {completedCount}/{habits.length} completed
      </div>

      {habits.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#999' }}>
          <p>No habit templates yet.</p>
          <Link href="/habits" style={{ color: '#3b82f6' }}>Create your first habit</Link>
        </div>
      ) : (
        habits.map(habit => {
          const log = logs.find(l => l.habit_template_id === habit.id)
          return (
            <div
              key={habit.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '1rem',
                background: log?.completed ? '#f0fdf4' : '#f9fafb',
                border: '0.5px solid #e5e7eb',
                borderRadius: '8px',
                marginBottom: '10px',
              }}
            >
              <input
                type="checkbox"
                checked={log?.completed || false}
                onChange={e => toggleHabit(habit.id, e.target.checked)}
                style={{ width: '20px', height: '20px', cursor: 'pointer' }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '500', fontSize: '14px' }}>{habit.name}</div>
                <div style={{ fontSize: '12px', color: '#666' }}>{habit.category}</div>
              </div>
            </div>
          )
        })
      )}

      <Link
        href="/habits"
        style={{
          display: 'block',
          marginTop: '2rem',
          padding: '0.75rem',
          background: '#eff6ff',
          border: '0.5px solid #bfdbfe',
          borderRadius: '4px',
          textAlign: 'center',
          color: '#0284c7',
          textDecoration: 'none',
          fontWeight: '500',
        }}
      >
        Manage habits
      </Link>
    </div>
  )
}
