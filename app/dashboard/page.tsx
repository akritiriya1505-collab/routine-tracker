'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Sidebar } from '../components/sidebar'
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
  planned: number
  completed: number
}

export default function Dashboard() {
  const [stats, setStats] = useState({
    bestDay: '',
    bestDayCount: 0,
    weekAverage: 0,
    consistencyDays: 0,
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

      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

      // Fetch all tasks
      const { data: allTasks } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', authUser.id)

      // Get this week: Monday to Sunday
      const today = new Date()
      const dayOfWeek = today.getDay()
      const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1) // Adjust to Monday
      const monday = new Date(today.setDate(diff))
      
      const last7Days: DailyData[] = []
      let totalCompleted = 0
      let daysWithCompletions = 0
      let bestDay = ''
      let bestDayCount = 0

      // Loop Monday (0) to Sunday (6)
      for (let i = 0; i < 7; i++) {
        const date = new Date(monday)
        date.setDate(date.getDate() + i)
        const dateStr = date.toISOString().split('T')[0]
        const dayName = date.toLocaleDateString('default', { weekday: 'short' })
        const dayDate = String(date.getDate()).padStart(2, '0')
        const monthNum = String(date.getMonth() + 1).padStart(2, '0')
        
        const { data: dayLogs } = await supabase
          .from('task_logs')
          .select('*')
          .eq('user_id', authUser.id)
          .eq('date', dateStr)

        const completed = dayLogs?.filter(l => l.completed).length || 0
        const planned = dayLogs?.length || 0

        totalCompleted += completed
        if (completed > 0) daysWithCompletions += 1

        if (completed > bestDayCount) {
          bestDayCount = completed
          bestDay = dayName
        }

        last7Days.push({
          date: dateStr,
          dayName: `${dayName} ${dayDate}/${monthNum}`,
          planned: planned,
          completed: completed,
        })
      }

      const weekAverage = totalCompleted > 0 ? Math.round(totalCompleted / 7) : 0

      setStats({
        bestDay,
        bestDayCount,
        weekAverage,
        consistencyDays: daysWithCompletions,
      })

      setDailyCompletion(last7Days)

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

        setTaskStats(taskStatsArray.sort((a, b) => b.thisWeek - a.thisWeek))
      }

      setLoading(false)
    }

    init()
  }, [router])

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>

  return (
    <div style={{ background: '#fafafa', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Sidebar />

      <style>{`
        @media (min-width: 768px) {
          .main-content {
            margin-left: 200px !important;
          }
        }
        @media (max-width: 767px) {
          .main-content {
            margin-left: 0 !important;
            margin-top: 40px;
          }
        }
      `}</style>

      <div className="main-content" style={{ padding: '12px', flex: 1, overflow: 'auto' }}>
      <div style={{ padding: '1.5rem', maxWidth: '700px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '24px', margin: 0 }}>Dashboard</h1>
        <Link href="/" style={{ color: '#3b82f6', textDecoration: 'none' }}>Back</Link>
      </div>

      {/* Weekly Insights - Creative Cards */}
      <h2 style={{ fontSize: '16px', marginBottom: '1rem', fontWeight: '600' }}>This Week's Insights</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '2rem' }}>
        {/* Best Day */}
        <div style={{
          padding: '1rem',
          background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
          color: 'white',
          borderRadius: '8px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '11px', opacity: 0.9, marginBottom: '4px' }}>🏆 Best Day</div>
          <div style={{ fontSize: '20px', fontWeight: '600', marginBottom: '4px' }}>
            {stats.bestDay || 'N/A'}
          </div>
          <div style={{ fontSize: '12px', opacity: 0.8 }}>
            {stats.bestDayCount} tasks
          </div>
        </div>

        {/* Consistency */}
        <div style={{
          padding: '1rem',
          background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
          color: 'white',
          borderRadius: '8px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '11px', opacity: 0.9, marginBottom: '4px' }}>📅 Active Days</div>
          <div style={{ fontSize: '20px', fontWeight: '600', marginBottom: '4px' }}>
            {stats.consistencyDays}/7
          </div>
          <div style={{ fontSize: '12px', opacity: 0.8 }}>
            days with tasks
          </div>
        </div>

        {/* Weekly Average */}
        <div style={{
          padding: '1rem',
          background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
          color: 'white',
          borderRadius: '8px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '11px', opacity: 0.9, marginBottom: '4px' }}>📊 Daily Average</div>
          <div style={{ fontSize: '20px', fontWeight: '600', marginBottom: '4px' }}>
            {stats.weekAverage}
          </div>
          <div style={{ fontSize: '12px', opacity: 0.8 }}>
            tasks per day
          </div>
        </div>

        {/* Streak Champion */}
        <div style={{
          padding: '1rem',
          background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
          color: 'white',
          borderRadius: '8px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '11px', opacity: 0.9, marginBottom: '4px' }}>🔥 Top Habit</div>
          <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '4px' }}>
            {taskStats.length > 0 ? taskStats[0].taskName : 'No data'}
          </div>
          <div style={{ fontSize: '12px', opacity: 0.8 }}>
            {taskStats.length > 0 ? `${taskStats[0].thisWeek}x this week` : ''}
          </div>
        </div>
      </div>

      {/* Weekly Overview */}
      <h2 style={{ fontSize: '16px', marginBottom: '1rem', fontWeight: '600' }}>Weekly Overview</h2>
      <div style={{
        padding: '1.5rem',
        background: '#f9fafb',
        border: '0.5px solid #e5e7eb',
        borderRadius: '8px',
        marginBottom: '2rem',
      }}>
        {/* Each day */}
        {dailyCompletion.map((day, i) => (
          <div key={i} style={{ marginBottom: i === dailyCompletion.length - 1 ? '0' : '1.5rem' }}>
            {/* Day header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '14px', fontWeight: '600', color: '#000', minWidth: '100px' }}>
                {day.dayName}
              </span>
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#3b82f6', marginLeft: 'auto' }}>
                {day.completed}/{day.planned}
              </span>
            </div>

            {/* Task boxes */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
              {day.planned === 0 ? (
                <span style={{ fontSize: '12px', color: '#999', fontStyle: 'italic' }}>
                  No tasks planned
                </span>
              ) : (
                Array.from({ length: day.planned }).map((_, boxIndex) => (
                  <div
                    key={boxIndex}
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '4px',
                      background: boxIndex < day.completed ? '#3b82f6' : '#e5e7eb',
                      border: boxIndex < day.completed ? '1px solid #1e40af' : '1px solid #d1d5db',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      fontWeight: '600',
                      color: boxIndex < day.completed ? 'white' : '#999',
                    }}
                    title={boxIndex < day.completed ? 'Completed' : 'Pending'}
                  >
                    {boxIndex < day.completed ? '✓' : '○'}
                  </div>
                ))
              )}
            </div>
          </div>
        ))}

        {/* Legend */}
        <div style={{
          marginTop: '1.5rem',
          paddingTop: '1.5rem',
          borderTop: '0.5px solid #e5e7eb',
          display: 'flex',
          gap: '1.5rem',
          justifyContent: 'center',
          fontSize: '12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '20px', height: '20px', background: '#3b82f6', borderRadius: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '10px', fontWeight: '600' }}>
              ✓
            </div>
            <span>Completed</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '20px', height: '20px', background: '#e5e7eb', borderRadius: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: '10px' }}>
              ○
            </div>
            <span>Pending</span>
          </div>
        </div>
      </div>

      {/* Habits Insights */}
      {taskStats.length > 0 && (
        <>
          <h2 style={{ fontSize: '16px', marginBottom: '1rem', fontWeight: '600' }}>Habits Insights</h2>
          <div style={{ display: 'grid', gap: '12px', marginBottom: '2rem' }}>
            {taskStats.slice(0, 5).map((task, index) => (
              <div
                key={task.taskId}
                style={{
                  padding: '1rem',
                  background: '#f9fafb',
                  border: '0.5px solid #e5e7eb',
                  borderRadius: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '18px' }}>
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '⭐'}
                  </span>
                  <div style={{ fontWeight: '600', fontSize: '14px', flex: 1 }}>
                    {task.taskName}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', fontSize: '12px' }}>
                  <div>
                    <div style={{ color: '#666', marginBottom: '2px' }}>This week</div>
                    <div style={{ fontSize: '16px', fontWeight: '600', color: '#3b82f6' }}>
                      {task.thisWeek}x
                    </div>
                  </div>
                  <div>
                    <div style={{ color: '#666', marginBottom: '2px' }}>Current 🔥</div>
                    <div style={{ fontSize: '16px', fontWeight: '600', color: '#059669' }}>
                      {task.currentStreak}d
                    </div>
                  </div>
                  <div>
                    <div style={{ color: '#666', marginBottom: '2px' }}>Best ever</div>
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
      </div>
    </div>
  )
}
