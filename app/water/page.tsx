'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

interface DailyWaterData {
  date: string
  dayName: string
  cupsToday: number
  completed: boolean
}

export default function Water() {
  const [waterCount, setWaterCount] = useState(0)
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [waterWeekly, setWaterWeekly] = useState<DailyWaterData[]>([])
  const [waterTaskId, setWaterTaskId] = useState<string>('')
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

      // Find or create "Water" template
      const { data: existingWater } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', authUser.id)
        .eq('name', 'Water')
        .eq('is_template', true)
        .single()

      let waterId = existingWater?.id

      // If Water template doesn't exist, create it
      if (!waterId) {
        const { data: newWater } = await supabase
          .from('tasks')
          .insert({
            user_id: authUser.id,
            name: 'Water',
            category: 'health',
            is_template: true,
          })
          .select()
          .single()
        waterId = newWater?.id
      }

      setWaterTaskId(waterId)

      // Get today's water intake
      const { data: todayLog } = await supabase
        .from('task_logs')
        .select('*')
        .eq('user_id', authUser.id)
        .eq('task_id', waterId)
        .eq('date', today)
        .single()

      const currentCount = todayLog?.count || 0
      setWaterCount(currentCount)

      // Get weekly water data
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      const { data: weekLogs } = await supabase
        .from('task_logs')
        .select('*')
        .eq('user_id', authUser.id)
        .eq('task_id', waterId)
        .gte('date', weekAgo)
        .order('date', { ascending: true })

      // Build weekly data
      const last7Days: DailyWaterData[] = []
      for (let i = 6; i >= 0; i--) {
        const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
        const dateStr = date.toISOString().split('T')[0]
        const dayName = date.toLocaleDateString('default', { weekday: 'short' })
        const dayDate = String(date.getDate()).padStart(2, '0')
        const monthNum = String(date.getMonth() + 1).padStart(2, '0')

        const dayLog = weekLogs?.find(l => l.date === dateStr)
        const cupsToday = dayLog?.count || 0
        const completed = dayLog?.completed || false

        last7Days.push({
          date: dateStr,
          dayName: `${dayName} ${dayDate}/${monthNum}`,
          cupsToday,
          completed,
        })
      }

      setWaterWeekly(last7Days)
      setLoading(false)
    }

    init()
  }, [router])

  const updateWaterCount = async (newCount: number) => {
    if (!user || !waterTaskId) return

    const today = new Date().toISOString().split('T')[0]
    const isCompleted = newCount >= 8

    const { error } = await supabase.from('task_logs').upsert({
      user_id: user.id,
      task_id: waterTaskId,
      date: today,
      count: newCount,
      completed: isCompleted,
    }, {
      onConflict: 'user_id,task_id,date'
    })

    if (!error) {
      setWaterCount(newCount)

      // Update streak if completed
      if (isCompleted && newCount === 8) {
        await updateWaterStreak()
      }
    }
  }

  const updateWaterStreak = async () => {
    if (!user || !waterTaskId) return

    const today = new Date().toISOString().split('T')[0]
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    // Check if water was completed yesterday
    const { data: yesterdayLog } = await supabase
      .from('task_logs')
      .select('completed')
      .eq('task_id', waterTaskId)
      .eq('user_id', user.id)
      .eq('date', yesterday)
      .single()

    const { data: currentStreak } = await supabase
      .from('task_streaks')
      .select('current_streak, longest_streak')
      .eq('user_id', user.id)
      .eq('task_id', waterTaskId)
      .single()

    let newStreak = 1
    if (yesterdayLog?.completed) {
      newStreak = (currentStreak?.current_streak || 0) + 1
    }

    const longestStreak = Math.max(newStreak, currentStreak?.longest_streak || 0)

    await supabase.from('task_streaks').upsert({
      user_id: user.id,
      task_id: waterTaskId,
      current_streak: newStreak,
      longest_streak: longestStreak,
      last_completed_date: today,
    }, {
      onConflict: 'user_id,task_id'
    })
  }

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>

  const fillPercentage = Math.min((waterCount / 8) * 100, 100)
  const cupsRemaining = Math.max(8 - waterCount, 0)

  return (
    <div style={{ padding: '1.5rem', maxWidth: '600px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '24px', margin: 0 }}>Hydration</h1>
        <Link href="/" style={{ color: '#3b82f6', textDecoration: 'none', fontSize: '14px' }}>Back</Link>
      </div>

      {/* Today's Date */}
      <div style={{ fontSize: '14px', color: '#666', marginBottom: '2rem', textAlign: 'center' }}>
        {new Date().toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric' })}
      </div>

      {/* Bottle Visualization */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem' }}>
        <div style={{
          width: '120px',
          height: '240px',
          border: '3px solid #0284c7',
          borderRadius: '12px 12px 4px 4px',
          background: '#f0f9ff',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 4px 12px rgba(2, 132, 199, 0.15)',
        }}>
          {/* Water fill */}
          <div style={{
            position: 'absolute',
            bottom: 0,
            width: '100%',
            height: `${fillPercentage}%`,
            background: 'linear-gradient(180deg, #3b82f6 0%, #0284c7 100%)',
            transition: 'height 0.3s ease',
          }} />

          {/* Cup markers */}
          {[1, 2, 3, 4, 5, 6, 7, 8].map((cup) => (
            <div
              key={cup}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: `${(8 - cup) * 12.5}%`,
                height: '1px',
                background: cup === 8 ? '#059669' : '#bfdbfe',
                opacity: cup === 8 ? 1 : 0.5,
              }}
            />
          ))}

          {/* Cup number indicator */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: '32px',
            fontWeight: '600',
            color: fillPercentage > 50 ? 'white' : '#0284c7',
            textShadow: fillPercentage > 50 ? 'none' : '0 0 10px rgba(2, 132, 199, 0.1)',
            zIndex: 10,
          }}>
            {waterCount}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '2rem' }}>
        <div style={{ padding: '1rem', background: '#eff6ff', border: '0.5px solid #bfdbfe', borderRadius: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '12px', color: '#0284c7', marginBottom: '4px' }}>Daily Goal</div>
          <div style={{ fontSize: '20px', fontWeight: '600', color: '#0284c7' }}>8 cups</div>
        </div>
        <div style={{ padding: '1rem', background: waterCount >= 8 ? '#f0fdf4' : '#fff7ed', border: waterCount >= 8 ? '0.5px solid #bbf7d0' : '0.5px solid #fed7aa', borderRadius: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '12px', color: waterCount >= 8 ? '#166534' : '#92400e', marginBottom: '4px' }}>Remaining</div>
          <div style={{ fontSize: '20px', fontWeight: '600', color: waterCount >= 8 ? '#059669' : '#d97706' }}>
            {cupsRemaining}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ fontSize: '12px', color: '#666', marginBottom: '0.5rem', fontWeight: '500' }}>Progress</div>
        <div style={{
          width: '100%',
          height: '8px',
          background: '#e5e7eb',
          borderRadius: '4px',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            background: waterCount >= 8 ? '#059669' : '#3b82f6',
            width: `${fillPercentage}%`,
            transition: 'width 0.3s ease',
          }} />
        </div>
        <div style={{ fontSize: '11px', color: '#666', marginTop: '0.5rem', textAlign: 'right' }}>
          {Math.round(fillPercentage)}%
        </div>
      </div>

      {/* Completion Message */}
      {waterCount >= 8 && (
        <div style={{
          padding: '1rem',
          background: '#f0fdf4',
          border: '0.5px solid #bbf7d0',
          borderRadius: '8px',
          marginBottom: '2rem',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '20px', marginBottom: '0.5rem' }}>🎉</div>
          <div style={{ fontSize: '14px', fontWeight: '600', color: '#166534' }}>Goal reached!</div>
          <div style={{ fontSize: '12px', color: '#166534', marginTop: '0.5rem' }}>You've completed your daily hydration goal</div>
        </div>
      )}

      {/* Cup Buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '2rem' }}>
        <button
          onClick={() => updateWaterCount(Math.max(waterCount - 1, 0))}
          disabled={waterCount === 0}
          style={{
            padding: '1rem',
            background: waterCount === 0 ? '#f3f4f6' : '#fee2e2',
            color: waterCount === 0 ? '#d1d5db' : '#991b1b',
            border: '0.5px solid',
            borderColor: waterCount === 0 ? '#e5e7eb' : '#fecaca',
            borderRadius: '8px',
            cursor: waterCount === 0 ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: '600',
          }}
        >
          − Remove Cup
        </button>
        <button
          onClick={() => updateWaterCount(Math.min(waterCount + 1, 10))}
          style={{
            padding: '1rem',
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600',
          }}
        >
          + Add Cup
        </button>
      </div>

      {/* Weekly History */}
      <h2 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '1rem' }}>This Week</h2>
      <div style={{ display: 'grid', gap: '12px' }}>
        {waterWeekly.map((day) => (
          <div
            key={day.date}
            style={{
              padding: '1rem',
              background: day.completed ? '#f0fdf4' : '#f9fafb',
              border: day.completed ? '0.5px solid #bbf7d0' : '0.5px solid #e5e7eb',
              borderRadius: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '14px', fontWeight: '600', color: '#000' }}>{day.dayName}</span>
              <span style={{
                fontSize: '12px',
                fontWeight: '600',
                color: day.completed ? '#059669' : '#666',
                background: day.completed ? '#dcfce7' : '#f3f4f6',
                padding: '4px 12px',
                borderRadius: '16px',
              }}>
                {day.cupsToday}/8 {day.completed ? '✓' : ''}
              </span>
            </div>
            <div style={{
              width: '100%',
              height: '6px',
              background: '#e5e7eb',
              borderRadius: '3px',
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                background: day.completed ? '#059669' : '#3b82f6',
                width: `${(day.cupsToday / 8) * 100}%`,
              }} />
            </div>
          </div>
        ))}
      </div>

      {/* Tips */}
      <div style={{
        marginTop: '2rem',
        padding: '1rem',
        background: '#eff6ff',
        borderLeft: '3px solid #3b82f6',
        borderRadius: '8px',
      }}>
        <div style={{ fontSize: '12px', fontWeight: '600', color: '#0284c7', marginBottom: '0.75rem' }}>💡 Tips</div>
        <ul style={{ margin: 0, paddingLeft: '1.5rem', fontSize: '12px', color: '#0284c7', lineHeight: '1.6' }}>
          <li>1 cup = 8 oz (250 ml)</li>
          <li>Drink water throughout the day</li>
          <li>Consistent hydration builds streaks!</li>
          <li>Your water tracking syncs to dashboard</li>
        </ul>
      </div>
    </div>
  )
}
