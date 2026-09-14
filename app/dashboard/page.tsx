'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

interface TaskStats {
  taskId: string
  taskName: string
  thisWeek: number
  currentStreak: number
  longestStreak: number
}

interface DailyData {
  date: string
  dayName: string
  count: number
}

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalTasks: 0,
    completedToday: 0,
    completedThisWeek: 0,
    completionRate: 0,
    customTasksToday: 0,
  })
  const [taskStats, setTaskStats] = useState<TaskStats[]>([])
  const [dailyCompletion, setDailyCompletion] = useState<DailyData[]>([])
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

      const today = new Date().toISOString().split('T')[0]
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

      // Task stats
      const { data: allTasks } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', authUser.id)

      const { data: todayLogs } = await supabase
        .from('task_logs')
        .select('*')
        .eq('user_id', authUser.id)
        .eq('date', today)
        .eq('completed', true)

      const { data: weekLogs } = await supabase
        .from('task_logs')
        .select('*')
        .eq('user_id', authUser.id)
        .gte('date', weekAgo)
        .eq('completed', true)

      const { data: allLogs } = await supabase
        .from('task_logs')
        .select('*')
        .eq('user_id', authUser.id)

      const completedCount = allLogs?.filter(l => l.completed).length || 0
      const totalCount = allLogs?.length || 0

      setStats({
        totalTasks: allTasks?.length || 0,
        completedToday: todayLogs?.length || 0,
        completedThisWeek: weekLogs?.length || 0,
        completionRate: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0,
        customTasksToday: 0,
      })

      // Task stats (templates only)
      const { data: templates } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', authUser.id)
        .eq('is_template', true)

      if (templates && templates.length > 0) {
        const taskStatsArray: TaskStats[] = []

        for (const template of templates) {
          const { data: logs } = await supabase
            .from('task_logs')
            .select('*')
            .eq('user_id', authUser.id)
            .eq('task_id', template.id)
            .gte('date', weekAgo)

          const { data: streak } = await supabase
            .from('task_streaks')
            .select('*')
            .eq('user_id', authUser.id)
            .eq('task_id', template.id)
            .single()

          const completedWeek = logs?.filter(l => l.completed).length || 0

          taskStatsArray.push({
            taskId: template.id,
            taskName: template.name,
            thisWeek: completedWeek,
            currentStreak: streak?.current_streak || 0,
            longestStreak: streak?.longest_streak || 0,
          })
        }

        setTaskStats(taskStatsArray)
      }

      // Daily completion for last 7 days
      const last7Days: DailyData[] = []
      for (let i = 6; i >= 0; i--) {
        const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
        const dateStr = date.toISOString().split('T')[0]
        const dayName = date.toLocaleDateString('default', { weekday: 'short' })
        
        const { data: dayLogs } = await supabase
          .from('task_logs')
          .select('*')
          .eq('user_id', authUser.id)
          .eq('date', dateStr)
          .eq('completed', true)

        last7Days.push({
          date: dateStr,
          dayName: dayName,
          count: dayLogs?.length || 0,
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

      {/* Task Overview */}
      <h2 style={{ fontSize: '16px', marginBottom: '1rem', fontWeight: '600' }}>Task Overview</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '2rem' }}>
        <StatCard label="Total tasks" value={stats.totalTasks} />
        <StatCard label="Completed today" value={stats.completedToday} />
        <StatCard label="This week" value={stats.completedThisWeek} />
        <StatCard label="Completion rate" value={stats.completionRate + '%'} />
      </div>

      {/* Daily Completion Chart - IMPROVED */}
      <h2 style={{ fontSize: '16px', marginBottom: '1rem', fontWeight: '600' }}>Last 7 Days Activity</h2>
      <div style={{
        padding: '2rem 1rem',
        background: '#f9fafb',
        border: '0.5px solid #e5e7eb',
        borderRadius: '8px',
        marginBottom: '2rem',
      }}>
        {/* Chart */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: '12px',
          height: '200px',
          marginBottom: '1rem',
          justifyContent: 'space-around',
        }}>
          {dailyCompletion.map((day, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
              {/* Bar */}
              <div
                style={{
                  width: '100%',
                  background: day.count > 0 ? '#3b82f6' : '#e5e7eb',
                  borderRadius: '4px 4px 0 0',
                  height: maxDaily > 0 ? `${(day.count / maxDaily) * 150}px` : '4px',
                  minHeight: day.count > 0 ? '4px' : '2px',
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'center',
                  paddingBottom: '4px',
                  position: 'relative',
                }}
              >
                {/* Count on top of bar */}
                <div style={{
                  fontSize: '11px',
                  fontWeight: '600',
                  color: day.count > 0 ? 'white' : '#666',
                  position: 'absolute',
                  top: '-18px',
                  whiteSpace: 'nowrap',
                }}>
                  {day.count}
                </div>
              </div>
              {/* Day label */}
              <div style={{ fontSize: '12px', color: '#666', marginTop: '8px', fontWeight: '500' }}>
                {day.dayName}
              </div>
              {/* Date */}
              <div style={{ fontSize: '9px', color: '#999', marginTop: '2px' }}>
                {new Date(day.date).getDate()}
              </div>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div style={{
          padding: '1rem',
          background: 'white',
          border: '0.5px solid #e5e7eb',
          borderRadius: '4px',
          marginTop: '1rem',
        }}>
          <div style={{ fontSize: '12px', fontWeight: '600', marginBottom: '0.5rem', color: '#666' }}>
            📊 What This Shows:
          </div>
          <ul style={{ margin: '0', paddingLeft: '1.2rem', fontSize: '12px', lineHeight: '1.6', color: '#555' }}>
            <li>Each bar = tasks completed that day</li>
            <li>Height = number of completed tasks</li>
            <li>Number on top = exact count</li>
            <li>Blue = completed tasks</li>
            <li>Gray = no tasks completed</li>
          </ul>
        </div>

        {/* Example */}
        <div style={{
          padding: '1rem',
          background: '#eff6ff',
          border: '0.5px solid #bfdbfe',
          borderRadius: '4px',
          marginTop: '1rem',
          fontSize: '12px',
          color: '#0284c7',
        }}>
          💡 <strong>Example:</strong> If Monday shows "5", you completed 5 tasks that day
        </div>
      </div>

      {/* Habits Insights */}
      {taskStats.length > 0 && (
        <>
          <h2 style={{ fontSize: '16px', marginBottom: '1rem', fontWeight: '600' }}>Habits Insights</h2>
          <div style={{ display: 'grid', gap: '12px', marginBottom: '2rem' }}>
            {taskStats.map(task => (
              <div
                key={task.taskId}
                style={{
                  padding: '1rem',
                  background: '#f9fafb',
                  border: '0.5px solid #e5e7eb',
                  borderRadius: '8px',
                }}
              >
                <div style={{ fontWeight: '600', fontSize: '14px', marginBottom: '0.75rem' }}>
                  {task.taskName}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', fontSize: '12px' }}>
                  <div>
                    <div style={{ color: '#666', marginBottom: '2px' }}>This week</div>
                    <div style={{ fontSize: '16px', fontWeight: '600', color: '#3b82f6' }}>
                      {task.thisWeek}x
                    </div>
                  </div>
                  <div>
                    <div style={{ color: '#666', marginBottom: '2px' }}>Current streak</div>
                    <div style={{ fontSize: '16px', fontWeight: '600', color: '#059669' }}>
                      {task.currentStreak}d
                    </div>
                  </div>
                  <div>
                    <div style={{ color: '#666', marginBottom: '2px' }}>Best streak</div>
                    <div style={{ fontSize: '16px', fontWeight: '600', color: '#7c3aed' }}>
                      {task.longestStreak}d
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <Link
        href="/"
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
        }}
      >
        Back to tasks
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
