'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { logout } from '@/lib/auth'

interface Habit {
  id: string
  name: string
}

interface DailyLog {
  habit_id: string
  completed: boolean
  difficulty_rating: number | null
}

interface Streak {
  habit_id: string
  current_streak: number
}

export default function Dashboard() {
  const [habits, setHabits] = useState<Habit[]>([])
  const [logs, setLogs] = useState<DailyLog[]>([])
  const [streaks, setStreaks] = useState<{ [key: string]: number }>({})
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [reflection, setReflection] = useState('')
  const router = useRouter()

  const reflectionPrompts = [
    'Which habit was hardest today?',
    'What helped you stick to your routine?',
    'Did you notice any patterns?',
    'What will you do differently tomorrow?',
  ]
  const [promptIndex, setPromptIndex] = useState(0)

  useEffect(() => {
    const init = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        router.push('/login')
        return
      }
      setUser(authUser)

      // Fetch habits
      const { data: habitsData } = await supabase
        .from('habits')
        .select('*')
        .eq('user_id', authUser.id)
      setHabits(habitsData || [])

      // Fetch today's logs
      const today = new Date().toISOString().split('T')[0]
      const { data: logsData } = await supabase
        .from('daily_logs')
        .select('*')
        .eq('user_id', authUser.id)
        .eq('date', today)
      setLogs(logsData || [])

      // Fetch streaks
      const { data: streaksData } = await supabase
        .from('streaks')
        .select('*')
        .eq('user_id', authUser.id)
      
      const streakMap: { [key: string]: number } = {}
      streaksData?.forEach((s: any) => {
        streakMap[s.habit_id] = s.current_streak || 0
      })
      setStreaks(streakMap)

      setLoading(false)
    }

    init()
    const interval = setInterval(() => {
      setPromptIndex(prev => (prev + 1) % reflectionPrompts.length)
    }, 8000)

    return () => clearInterval(interval)
  }, [router])

  const toggleHabit = async (habitId: string, completed: boolean) => {
    if (!user) return

    const today = new Date().toISOString().split('T')[0]

    const { error } = await supabase.from('daily_logs').upsert({
      user_id: user.id,
      habit_id: habitId,
      date: today,
      completed,
    })

    if (!error) {
      setLogs(prev => {
        const existing = prev.find(l => l.habit_id === habitId)
        if (existing) {
          return prev.map(l =>
            l.habit_id === habitId ? { ...l, completed } : l
          )
        }
        return [...prev, { habit_id: habitId, completed, difficulty_rating: null }]
      })

      if (completed) {
        await updateStreak(habitId)
      }
    }
  }

  const updateStreak = async (habitId: string) => {
    if (!user) return

    const { data: existingStreak } = await supabase
      .from('streaks')
      .select('*')
      .eq('user_id', user.id)
      .eq('habit_id', habitId)
      .single()

    const today = new Date().toISOString().split('T')[0]
    const currentStreak = (existingStreak?.current_streak || 0) + 1

    await supabase.from('streaks').upsert({
      user_id: user.id,
      habit_id: habitId,
      current_streak: currentStreak,
      longest_streak: Math.max(existingStreak?.longest_streak || 0, currentStreak),
      last_completed_date: today,
    })

    setStreaks(prev => ({ ...prev, [habitId]: currentStreak }))
  }

  const handleLogout = async () => {
    await logout()
    router.push('/login')
  }

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Loading...</p>
      </div>
    )
  }

  const completedToday = logs.filter(l => l.completed).length

  return (
    <div style={{ padding: '1.5rem', maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '24px', margin: 0 }}>Routine Tracker</h1>
        <button
          onClick={handleLogout}
          style={{
            padding: '0.5rem 1rem',
            background: 'none',
            border: '0.5px solid #d1d5db',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          Logout
        </button>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <div style={{ fontSize: '12px', color: '#666', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Today
        </div>
        {habits.length === 0 ? (
          <p style={{ color: '#999' }}>No habits yet. <a href="/add-habit" style={{ color: '#3b82f6' }}>Create one</a></p>
        ) : (
          habits.map(habit => {
            const log = logs.find(l => l.habit_id === habit.id)
            const streak = streaks[habit.id] || 0
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
                <span style={{ flex: 1, fontWeight: '500', fontSize: '14px' }}>
                  {habit.name}
                </span>
                {streak > 0 && (
                  <span style={{ fontSize: '12px', fontWeight: '600', color: '#059669' }}>
                    {streak} days 🔥
                  </span>
                )}
              </div>
            )
          })
        )}
      </div>

      <div style={{
        padding: '1rem',
        background: '#eff6ff',
        borderLeft: '3px solid #3b82f6',
        borderRadius: '8px',
        marginBottom: '2rem',
      }}>
        <label style={{ fontSize: '11px', color: '#0284c7', fontWeight: '600', marginBottom: '8px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Reflection
        </label>
        <p style={{ fontSize: '14px', marginBottom: '1rem', color: '#0b0b0b' }}>
          {reflectionPrompts[promptIndex]}
        </p>
        <textarea
          value={reflection}
          onChange={e => setReflection(e.target.value)}
          placeholder="Type here..."
          style={{
            width: '100%',
            padding: '8px',
            border: '0.5px solid #d1d5db',
            borderRadius: '4px',
            fontSize: '12px',
            minHeight: '60px',
            fontFamily: 'inherit',
            resize: 'vertical',
          }}
        />
      </div>

      <div style={{
        padding: '1rem',
        background: '#f9fafb',
        border: '0.5px solid #e5e7eb',
        borderRadius: '8px',
      }}>
        <div style={{ fontWeight: '600', marginBottom: '1rem', fontSize: '14px' }}>This week</div>
        <div style={{ display: 'grid', gap: '8px', fontSize: '13px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#666' }}>Completed today</span>
            <span style={{ fontWeight: '500' }}>{completedToday}/{habits.length}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#666' }}>Completion rate</span>
            <span style={{ fontWeight: '500' }}>
              {habits.length > 0 ? Math.round((completedToday / habits.length) * 100) : 0}%
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
