'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

interface HabitStats {
  habitId: string
  habitName: string
  thisWeek: number
  currentStreak: number
  longestStreak: number
}

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalTasks: 0,
    completedToday: 0,
    completedThisWeek: 0,
    completionRate: 0,
  })
  const [habitStats, setHabitStats] = useState<HabitStats[]>([])
  const [dailyCompletion, setDailyCompletion] = useState<{ date: string; count: number }[]>([])
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

      // Task stats
      const today = new Date().toISOString().split('T')[0]
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

      const { data: allTasks } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', authUser.id)

      const { data: todayTasks } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', authUser.id)
        .eq('scheduled_date', today)
        .eq('completed', true)

      const { data: weekTasks } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', authUser.id)
        .gte('scheduled_date', weekAgo)
        .eq('completed', true)

      const completedCount = allTasks?.filter(t => t.completed).length || 0
      const totalCount = allTasks?.length || 0

      setStats({
        totalTasks: totalCount,
        completedToday: todayTasks?.length || 0,
        completedThisWeek: weekTasks?.length || 0,
        completionRate: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0,
      })

      // Habit stats
      const { data: templates } = await supabase
        .from('habit_templates')
        .select('*')
        .eq('user_id', authUser.id)

      if (templates && templates.length > 0) {
        const habitStatsArray: HabitStats[] = []

        for (const template of templates) {
          const { data: logs } = await supabase
            .from('habit_logs')
            .select('*')
            .eq('user_id', authUser.id)
            .eq('habit_template_id', template.id)
            .gte('date', weekAgo)

          const { data: streak } = await supabase
            .from('habit_streaks')
            .select('*')
            .eq('user_id', authUser.id)
            .eq('habit_template_id', template.id)
            .single()

          const completedWeek = logs?.filter(l => l.completed).length || 0

          habitStatsArray.push({
            habitId: template.id,
            habitName: template.name,
            thisWeek: completedWeek,
            currentStreak: streak?.current_streak || 0,
            longestStreak: streak?.longest_streak || 0,
          })
        }

        setHabitStats(habitStatsArray)
      }

      // Daily completion for last 7 days
      const last7Days = []
      for (let i = 6; i >= 0; i--) {
        const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        const { data: dayTasks } = await supabase
          .from('tasks')
          .select('*')
          .eq('user_id', authUser.id)
          .eq('scheduled_date', date)
          .eq('completed', true)

        last7Days.push({
          date,
          count: dayTasks?.length || 0,
        })
      }
      setDailyCompletion(last7Days)

      setLoading(false)
    }

    init()
  }, [router])

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>

  const maxDaily = Math.max(...dailyCompletion.map(d => d.count), 1)

  return (
    <div style={{ padding: '1.5rem', maxWidth: '700px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '24px', margin: 0 }}>Dashboard</h1>
        <Link href="/" style={{ color: '#3b82f6', textDecoration: 'none' }}>Back</Link>
      </div>

      {/* Task stats */}
      <h2 style={{ fontSize: '16px', marginBottom: '1rem', fontWeight: '600' }}>Task Overview</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '2rem' }}>
        <StatCard label="Total tasks" value={stats.totalTasks} />
        <StatCard label="Completed today" value={stats.completedToday} />
        <StatCard label="This week" value={stats.completedThisWeek} />
        <StatCard label="Completion rate" value={stats.completionRate + '%'} />
      </div>

      {/* Daily completion chart */}
      <h2 style={{ fontSize: '16px', marginBottom: '1rem', fontWeight: '600' }}>Last 7 days</h2>
      <div style={{
        padding: '1.5rem',
        background: '#f9fafb',
        border: '0.5px solid #e5e7eb',
        borderRadius: '8px',
        marginBottom: '2rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '120px' }}>
          {dailyCompletion.map((day, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div
                style={{
                  width: '100%',
                  background: day.count > 0 ? '#3b82f6' : '#e5e7eb',
                  borderRadius: '4px 4px 0 0',
                  height: maxDaily > 0 ? (day.count / maxDaily) * 100 : 10,
                  minHeight: '4px',
                }}
              />
              <div style={{ fontSize: '10px', color: '#666', marginTop: '4px' }}>
                {new Date(day.date).getDate()}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Habit insights */}
      {habitStats.length > 0 && (
        <>
          <h2 style={{ fontSize: '16px', marginBottom: '1rem', fontWeight: '600' }}>Habit Insights</h2>
          <div style={{ display: 'grid', gap: '12px', marginBottom: '2rem' }}>
            {habitStats.map(habit => (
              <div
                key={habit.habitId}
                style={{
                  padding: '1rem',
                  background: '#f9fafb',
                  border: '0.5px solid #e5e7eb',
                  borderRadius: '8px',
                }}
              >
                <div style={{ fontWeight: '600', fontSize: '14px', marginBottom: '0.5rem' }}>
                  {habit.habitName}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', fontSize: '12px' }}>
                  <div>
                    <div style={{ color: '#666', marginBottom: '2px' }}>This week</div>
                    <div style={{ fontSize: '16px', fontWeight: '600', color: '#3b82f6' }}>
                      {habit.thisWeek}x
                    </div>
                  </div>
                  <div>
                    <div style={{ color: '#666', marginBottom: '2px' }}>Current streak</div>
                    <div style={{ fontSize: '16px', fontWeight: '600', color: '#059669' }}>
                      {habit.currentStreak} days
                    </div>
                  </div>
                  <div>
                    <div style={{ color: '#666', marginBottom: '2px' }}>Best streak</div>
                    <div style={{ fontSize: '16px', fontWeight: '600', color: '#7c3aed' }}>
                      {habit.longestStreak} days
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <Link
        href="/today"
        style={{
          display: 'block',
          padding: '1rem',
          background: '#eff6ff',
          border: '0.5px solid #bfdbfe',
          borderRadius: '8px',
          textAlign: 'center',
          color: '#0284c7',
          textDecoration: 'none',
          fontWeight: '500',
          marginBottom: '1rem',
        }}
      >
        Quick add today's habits
      </Link>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{
      padding: '1rem',
      background: '#f9fafb',
      border: '0.5px solid #e5e7eb',
      borderRadius: '8px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: '12px', color: '#666', marginBottom: '0.5rem' }}>{label}</div>
      <div style={{ fontSize: '24px', fontWeight: '600', color: '#3b82f6' }}>{value}</div>
    </div>
  )
}
