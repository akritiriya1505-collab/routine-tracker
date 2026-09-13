'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { logout } from '@/lib/auth'
import Link from 'next/link'

interface Task {
  id: string
  name: string
  scheduled_date: string
  completed: boolean
}

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [taskName, setTaskName] = useState('')
  const [showForm, setShowForm] = useState(false)
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
      const { data: tasksData } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', authUser.id)
        .eq('scheduled_date', today)
        .order('created_at', { ascending: true })

      setTasks(tasksData || [])
      setLoading(false)
    }

    init()
  }, [router])

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!taskName.trim() || !user) return

    const today = new Date().toISOString().split('T')[0]
    const { error } = await supabase.from('tasks').insert({
      user_id: user.id,
      name: taskName.trim(),
      scheduled_date: today,
    })

    if (!error) {
      setTaskName('')
      setShowForm(false)
      const { data: tasksData } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .eq('scheduled_date', today)
      setTasks(tasksData || [])
    }
  }

  const toggleTask = async (taskId: string, completed: boolean) => {
    const { error } = await supabase
      .from('tasks')
      .update({ completed })
      .eq('id', taskId)

    if (!error) {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed } : t))
    }
  }

  const handleLogout = async () => {
    await logout()
    router.push('/login')
  }

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>

  const completedCount = tasks.filter(t => t.completed).length
  const today = new Date().toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div style={{ padding: '1.5rem', maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '24px', margin: 0 }}>Routine</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Link href="/calendar" style={{ padding: '0.5rem 1rem', border: '0.5px solid #d1d5db', borderRadius: '4px', textDecoration: 'none', color: '#3b82f6', fontSize: '14px' }}>
            Calendar
          </Link>
          <Link href="/dashboard" style={{ padding: '0.5rem 1rem', border: '0.5px solid #d1d5db', borderRadius: '4px', textDecoration: 'none', color: '#3b82f6', fontSize: '14px' }}>
            Stats
          </Link>
          <button onClick={handleLogout} style={{ padding: '0.5rem 1rem', border: '0.5px solid #d1d5db', borderRadius: '4px', background: 'none', cursor: 'pointer', fontSize: '14px' }}>
            Logout
          </button>
        </div>
      </div>

      <div style={{ fontSize: '12px', color: '#666', marginBottom: '1.5rem' }}>
        {today} — {completedCount}/{tasks.length} completed
      </div>

      {tasks.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#999', marginBottom: '2rem' }}>
          <p>No tasks today</p>
        </div>
      ) : (
        <div style={{ marginBottom: '2rem' }}>
          {tasks.map(task => (
            <div
              key={task.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '1rem',
                background: task.completed ? '#f0fdf4' : '#f9fafb',
                border: '0.5px solid #e5e7eb',
                borderRadius: '8px',
                marginBottom: '10px',
              }}
            >
              <input
                type="checkbox"
                checked={task.completed}
                onChange={e => toggleTask(task.id, e.target.checked)}
                style={{ width: '20px', height: '20px', cursor: 'pointer' }}
              />
              <span style={{
                flex: 1,
                fontWeight: '500',
                fontSize: '14px',
                textDecoration: task.completed ? 'line-through' : 'none',
                color: task.completed ? '#999' : '#000',
              }}>
                {task.name}
              </span>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => setShowForm(!showForm)}
        style={{
          width: '100%',
          padding: '0.75rem',
          background: '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '14px',
          marginBottom: '1rem',
          fontWeight: '500',
        }}
      >
        {showForm ? 'Cancel' : '+ Add task'}
      </button>

      {showForm && (
        <form onSubmit={handleCreateTask} style={{ marginBottom: '2rem' }}>
          <input
            type="text"
            value={taskName}
            onChange={e => setTaskName(e.target.value)}
            placeholder="Task name..."
            autoFocus
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '0.5px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '14px',
              marginBottom: '0.5rem',
            }}
          />
          <button
            type="submit"
            style={{
              width: '100%',
              padding: '0.75rem',
              background: '#059669',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Create
          </button>
        </form>
      )}

      <div style={{
        padding: '1rem',
        background: '#eff6ff',
        borderLeft: '3px solid #3b82f6',
        borderRadius: '8px',
      }}>
        <label style={{ fontSize: '11px', color: '#0284c7', fontWeight: '600', marginBottom: '8px', display: 'block' }}>
          Reflection
        </label>
        <p style={{ fontSize: '14px', marginBottom: '1rem', color: '#0b0b0b' }}>
          What's one thing you accomplished today?
        </p>
        <textarea
          placeholder="Type here..."
          style={{
            width: '100%',
            padding: '8px',
            border: '0.5px solid #d1d5db',
            borderRadius: '4px',
            fontSize: '12px',
            minHeight: '60px',
            fontFamily: 'inherit',
          }}
        />
      </div>
    </div>
  )
}
