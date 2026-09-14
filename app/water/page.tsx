'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function WaterTracker() {
  const [cups, setCups] = useState(0)
  const [goal, setGoal] = useState(8)
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
      const { data: logs } = await supabase
        .from('habit_logs')
        .select('*')
        .eq('user_id', authUser.id)
        .eq('date', today)

      const waterLog = logs?.find((l: any) => {
        // This assumes you have a habit template named "Water"
        return true
      })

      if (waterLog) {
        setCups(waterLog.count || 0)
      }

      setLoading(false)
    }

    init()
  }, [router])

  const addCup = async () => {
    if (!user) return

    const newCount = cups + 1
    const today = new Date().toISOString().split('T')[0]

    // First get the water habit template
    const { data: templates } = await supabase
      .from('habit_templates')
      .select('*')
      .eq('user_id', user.id)
      .eq('name', 'Water')
      .single()

    if (!templates) {
      alert('Please create a "Water" habit first')
      return
    }

    const { error } = await supabase.from('habit_logs').upsert({
      user_id: user.id,
      habit_template_id: templates.id,
      date: today,
      completed: newCount >= goal,
      count: newCount,
    }, {
      onConflict: 'user_id,habit_template_id,date'
    })

    if (!error) {
      setCups(newCount)
    }
  }

  const removeCup = async () => {
    if (cups === 0) return

    const newCount = cups - 1
    const today = new Date().toISOString().split('T')[0]

    const { data: templates } = await supabase
      .from('habit_templates')
      .select('*')
      .eq('user_id', user.id)
      .eq('name', 'Water')
      .single()

    if (!templates) return

    const { error } = await supabase.from('habit_logs').upsert({
      user_id: user.id,
      habit_template_id: templates.id,
      date: today,
      completed: newCount >= goal,
      count: newCount,
    }, {
      onConflict: 'user_id,habit_template_id,date'
    })

    if (!error) {
      setCups(newCount)
    }
  }

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>

  const percentage = Math.min((cups / goal) * 100, 100)
  const isComplete = cups >= goal

  return (
    <div style={{ padding: '1.5rem', maxWidth: '500px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '24px', margin: 0 }}>Water intake</h1>
        <Link href="/" style={{ color: '#3b82f6', textDecoration: 'none' }}>Back</Link>
      </div>

      <div style={{
        padding: '2rem',
        textAlign: 'center',
        background: '#f9fafb',
        border: '0.5px solid #e5e7eb',
        borderRadius: '12px',
        marginBottom: '2rem',
      }}>
        {/* Circular progress */}
        <div style={{
          position: 'relative',
          width: '200px',
          height: '200px',
          margin: '0 auto 2rem',
          borderRadius: '50%',
          background: `conic-gradient(#3b82f6 0deg ${percentage * 3.6}deg, #e5e7eb ${percentage * 3.6}deg)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{
            width: '180px',
            height: '180px',
            borderRadius: '50%',
            background: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <div style={{ fontSize: '32px', fontWeight: '600', color: '#3b82f6' }}>
              {cups}
            </div>
            <div style={{ fontSize: '12px', color: '#666' }}>of {goal} cups</div>
          </div>
        </div>

        {isComplete && (
          <div style={{
            padding: '0.75rem',
            background: '#dcfce7',
            border: '0.5px solid #bbf7d0',
            borderRadius: '4px',
            color: '#166534',
            fontSize: '14px',
            fontWeight: '500',
            marginBottom: '1.5rem',
          }}>
            🎉 Goal reached! Great hydration!
          </div>
        )}

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button
            onClick={removeCup}
            disabled={cups === 0}
            style={{
              padding: '0.75rem 1.5rem',
              background: cups === 0 ? '#e5e7eb' : '#fee2e2',
              color: cups === 0 ? '#999' : '#991b1b',
              border: 'none',
              borderRadius: '4px',
              cursor: cups === 0 ? 'default' : 'pointer',
              fontWeight: '600',
              fontSize: '14px',
            }}
          >
            − Cup
          </button>
          <button
            onClick={addCup}
            style={{
              padding: '0.75rem 1.5rem',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '14px',
            }}
          >
            + Cup
          </button>
        </div>
      </div>

      <div style={{
        padding: '1rem',
        background: '#eff6ff',
        border: '0.5px solid #bfdbfe',
        borderRadius: '8px',
        fontSize: '13px',
        color: '#0284c7',
      }}>
        💧 <strong>Tip:</strong> Drink 8 cups per day for optimal hydration. One cup = 250ml.
      </div>
    </div>
  )
}
