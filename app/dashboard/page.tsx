'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalTasks: 0,
    completedToday: 0,
    completedThisWeek: 0,
    completionRate: 0,
  })
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

      setLoading(false)
    }

    init()
  }, [router])

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>

  return (
    <div style={{ padding: '1.5rem', maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '24px', margin: 0 }}>Dashboard</h1>
        <Link href="/" style={{ color: '#3b82f6', textDecoration: 'none' }}>Back</Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '2rem' }}>
        <StatCard label="Total tasks" value={stats.totalTasks} />
        <StatCard label="Completed today" value={stats.completedToday} />
        <StatCard label="This week" value={stats.completedThisWeek} />
        <StatCard label="Completion rate" value={stats.completionRate + '%'} />
      </div>

      <div style={{
        padding: '1.5rem',
        background: '#eff6ff',
        border: '0.5px solid #bfdbfe',
        borderRadius: '8px',
      }}>
        <h2 style={{ fontSize: '16px', marginBottom: '1rem', color: '#0284c7' }}>Keep going!</h2>
        <p style={{ fontSize: '14px', color: '#0b0b0b', lineHeight: '1.6' }}>
          You're on a journey. The more tasks you complete, the stronger your discipline becomes. Focus on consistency, not perfection.
        </p>
      </div>
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
