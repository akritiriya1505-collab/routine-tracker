'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

interface Task {
  id: string
  name: string
  scheduled_date: string
  completed: boolean
}

export default function Calendar() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [showForm, setShowForm] = useState(false)
  const [taskName, setTaskName] = useState('')
  const router = useRouter()

  useEffect(() => {
    const init = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        router.push('/login')
        return
      }
      setUser(authUser)

      const { data: tasksData } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', authUser.id)
        .order('scheduled_date', { ascending: true })

      setTasks(tasksData || [])
      setLoading(false)
    }

    init()
  }, [router])

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!taskName.trim() || !user) return

    const { error } = await supabase.from('tasks').insert({
      user_id: user.id,
      name: taskName.trim(),
      scheduled_date: selectedDate,
    })

    if (!error) {
      setTaskName('')
      setShowForm(false)
      const { data: tasksData } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .order('scheduled_date', { ascending: true })
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

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>

  const tasksForSelectedDate = tasks.filter(t => t.scheduled_date === selectedDate)
  const calendarDays = getDaysInMonth(new Date(selectedDate))
  const currentMonth = new Date(selectedDate).toLocaleString('default', { month: 'long', year: 'numeric' })

  return (
    <div style={{ padding: '1.5rem', maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '24px', margin: 0 }}>Calendar</h1>
        <Link href="/" style={{ color: '#3b82f6', textDecoration: 'none' }}>Back</Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
        {/* Calendar */}
        <div>
          <h2 style={{ fontSize: '18px', marginBottom: '1rem' }}>{currentMonth}</h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: '4px',
            marginBottom: '2rem',
          }}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} style={{ textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#666', padding: '8px' }}>
                {day}
              </div>
            ))}
            {calendarDays.map((day, i) => {
              const dateStr = new Date(selectedDate).getFullYear() + '-' + 
                String((new Date(selectedDate).getMonth() + 1)).padStart(2, '0') + '-' + 
                String(day).padStart(2, '0')
              const dayTasks = tasks.filter(t => t.scheduled_date === dateStr)
              const isSelected = dateStr === selectedDate

              return (
                <button
                  key={i}
                  onClick={() => setSelectedDate(dateStr)}
                  style={{
                    padding: '8px',
                    border: isSelected ? '2px solid #3b82f6' : '0.5px solid #e5e7eb',
                    background: isSelected ? '#eff6ff' : '#f9fafb',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: isSelected ? '600' : '400',
                  }}
                >
                  <div>{day}</div>
                  {dayTasks.length > 0 && (
                    <div style={{ fontSize: '10px', color: '#3b82f6', marginTop: '2px' }}>
                      {dayTasks.length} task{dayTasks.length !== 1 ? 's' : ''}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Tasks for selected date */}
        <div>
          <h2 style={{ fontSize: '16px', marginBottom: '1rem' }}>
            {new Date(selectedDate).toLocaleDateString()}
          </h2>
          {tasksForSelectedDate.length === 0 ? (
            <p style={{ color: '#999', fontSize: '14px' }}>No tasks</p>
          ) : (
            tasksForSelectedDate.map(task => (
              <div
                key={task.id}
                style={{
                  padding: '1rem',
                  background: task.completed ? '#f0fdf4' : '#f9fafb',
                  border: '0.5px solid #e5e7eb',
                  borderRadius: '4px',
                  marginBottom: '8px',
                }}
              >
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={task.completed}
                    onChange={e => toggleTask(task.id, e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                  <span style={{
                    textDecoration: task.completed ? 'line-through' : 'none',
                    color: task.completed ? '#999' : '#000',
                  }}>
                    {task.name}
                  </span>
                </label>
              </div>
            ))
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
              marginTop: '1rem',
              fontWeight: '500',
            }}
          >
            {showForm ? 'Cancel' : '+ Add task'}
          </button>

          {showForm && (
            <form onSubmit={handleCreateTask} style={{ marginTop: '1rem' }}>
              <input
                type="text"
                value={taskName}
                onChange={e => setTaskName(e.target.value)}
                placeholder="Task name..."
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '0.5px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '12px',
                  marginBottom: '0.5rem',
                }}
              />
              <button
                type="submit"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  background: '#059669',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                Create
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

function getDaysInMonth(date: Date) {
  const year = date.getFullYear()
  const month = date.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const days = Array(firstDay).fill(null)
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i)
  }
  return days
}
