'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { logout } from '@/lib/auth'
import Link from 'next/link'

interface Task {
  id: string
  name: string
  category: string
  is_template: boolean
}

interface TaskLog {
  task_id: string
  completed: boolean
  count: number
}

interface TaskStreak {
  task_id: string
  current_streak: number
  longest_streak: number
}

export default function Home() {
  const [todayTasks, setTodayTasks] = useState<(Task & TaskLog)[]>([])
  const [templates, setTemplates] = useState<Task[]>([])
  const [taskLogs, setTaskLogs] = useState<TaskLog[]>([])
  const [streaks, setStreaks] = useState<{ [key: string]: TaskStreak }>({})
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [searchInput, setSearchInput] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([])
  const [stats, setStats] = useState({ totalTasks: 0, completedThisWeek: 0 })
  const [reflection, setReflection] = useState('')
  const [reflectionSaved, setReflectionSaved] = useState(false)
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

      // Fetch all tasks (both template and custom)
      const { data: allTasks } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', authUser.id)
      setTemplates(allTasks?.filter(t => t.is_template) || [])

      // Fetch today's task logs
      const { data: logsData } = await supabase
        .from('task_logs')
        .select('*')
        .eq('user_id', authUser.id)
        .eq('date', today)
      setTaskLogs(logsData || [])

      // Combine tasks with logs for today
      if (allTasks && logsData) {
        const combined = logsData.map(log => {
          const task = allTasks.find(t => t.id === log.task_id)
          return { ...task, ...log } as Task & TaskLog
        })
        setTodayTasks(combined)
      }

      // Fetch streaks
      const { data: streaksData } = await supabase
        .from('task_streaks')
        .select('*')
        .eq('user_id', authUser.id)

      const streakMap: { [key: string]: TaskStreak } = {}
      streaksData?.forEach((s: any) => {
        streakMap[s.task_id] = {
          task_id: s.task_id,
          current_streak: s.current_streak || 0,
          longest_streak: s.longest_streak || 0,
        }
      })
      setStreaks(streakMap)

      // Get stats
      const { data: allTasksData } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', authUser.id)

      const { data: weekLogsData } = await supabase
        .from('task_logs')
        .select('*')
        .eq('user_id', authUser.id)
        .gte('date', weekAgo)
        .eq('completed', true)

      // Fetch saved reflection
      const { data: reflectionData } = await supabase
        .from('reflections')
        .select('content')
        .eq('user_id', authUser.id)
        .eq('date', today)
        .single()

      setReflection(reflectionData?.content || '')
      setStats({
        totalTasks: logsData?.length || 0,
        completedThisWeek: weekLogsData?.length || 0,
      })

      setLoading(false)
    }

    init()
  }, [router])

  useEffect(() => {
    if (searchInput.trim()) {
      const filtered = templates.filter(t =>
        t.name.toLowerCase().includes(searchInput.toLowerCase())
      )
      setFilteredTasks(filtered)
    } else {
      setFilteredTasks([])
    }
  }, [searchInput, templates])

  const handleAddTask = async (taskId?: string, isCustom: boolean = false) => {
    if (!user) return

    const today = new Date().toISOString().split('T')[0]

    if (isCustom && taskId === 'new') {
      // Create custom task
      const { data: newTask } = await supabase.from('tasks').insert({
        user_id: user.id,
        name: searchInput.trim(),
        is_template: false,
      }).select().single()

      if (newTask) {
        const { error } = await supabase.from('task_logs').insert({
          user_id: user.id,
          task_id: newTask.id,
          date: today,
          completed: false,
        })

        if (!error) {
          setSearchInput('')
          setShowSearch(false)
          // Refresh today's tasks
          const { data: logsData } = await supabase
            .from('task_logs')
            .select('*')
            .eq('user_id', user.id)
            .eq('date', today)

          const { data: allTasks } = await supabase
            .from('tasks')
            .select('*')
            .eq('user_id', user.id)

          if (allTasks && logsData) {
            const combined = logsData.map(log => {
              const task = allTasks.find(t => t.id === log.task_id)
              return { ...task, ...log } as Task & TaskLog
            })
            setTodayTasks(combined)
          }
        }
      }
    } else if (taskId) {
      // Add existing template
      const { error } = await supabase.from('task_logs').upsert({
        user_id: user.id,
        task_id: taskId,
        date: today,
        completed: false,
      }, {
        onConflict: 'user_id,task_id,date'
      })

      if (!error) {
        setSearchInput('')
        setShowSearch(false)
        // Refresh
        const { data: logsData } = await supabase
          .from('task_logs')
          .select('*')
          .eq('user_id', user.id)
          .eq('date', today)

        const { data: allTasks } = await supabase
          .from('tasks')
          .select('*')
          .eq('user_id', user.id)

        if (allTasks && logsData) {
          const combined = logsData.map(log => {
            const task = allTasks.find(t => t.id === log.task_id)
            return { ...task, ...log } as Task & TaskLog
          })
          setTodayTasks(combined)
        }
      }
    }
  }

  const toggleTask = async (taskId: string, completed: boolean) => {
    const today = new Date().toISOString().split('T')[0]
    
    const { error } = await supabase
      .from('task_logs')
      .update({ completed })
      .eq('task_id', taskId)
      .eq('user_id', user.id)
      .eq('date', today)

    if (!error) {
      setTodayTasks(prev =>
        prev.map(t => t.task_id === taskId ? { ...t, completed } : t)
      )

      // Update streak if it's a template task
      const task = todayTasks.find(t => t.task_id === taskId)
      if (task && task.is_template) {
        await updateStreak(taskId, completed)
      }
    }
  }

  const updateStreak = async (taskId: string, completed: boolean) => {
    const today = new Date().toISOString().split('T')[0]

    if (!completed) {
      // Task unchecked - reset streak to 0
      const { error } = await supabase
        .from('task_streaks')
        .upsert({
          user_id: user.id,
          task_id: taskId,
          current_streak: 0,
          longest_streak: streaks[taskId]?.longest_streak || 0,
          last_completed_date: null,
        }, {
          onConflict: 'user_id,task_id'
        })

      if (!error) {
        setStreaks(prev => ({
          ...prev,
          [taskId]: {
            task_id: taskId,
            current_streak: 0,
            longest_streak: streaks[taskId]?.longest_streak || 0,
          }
        }))
      }
      return
    }

    // Task is being completed
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    
    // Check if task was completed yesterday
    const { data: yesterdayLog } = await supabase
      .from('task_logs')
      .select('completed')
      .eq('task_id', taskId)
      .eq('user_id', user.id)
      .eq('date', yesterday)
      .single()

    let newStreak = 1
    if (yesterdayLog?.completed) {
      newStreak = (streaks[taskId]?.current_streak || 0) + 1
    }

    const longestStreak = Math.max(newStreak, streaks[taskId]?.longest_streak || 0)

    const { error } = await supabase
      .from('task_streaks')
      .upsert({
        user_id: user.id,
        task_id: taskId,
        current_streak: newStreak,
        longest_streak: longestStreak,
        last_completed_date: today,
      }, {
        onConflict: 'user_id,task_id'
      })

    if (!error) {
      setStreaks(prev => ({
        ...prev,
        [taskId]: {
          task_id: taskId,
          current_streak: newStreak,
          longest_streak: longestStreak,
        }
      }))
    }
  }

  const saveReflection = async () => {
    if (!user) return

    const today = new Date().toISOString().split('T')[0]

    const { error } = await supabase.from('reflections').upsert({
      user_id: user.id,
      date: today,
      content: reflection,
    }, {
      onConflict: 'user_id,date'
    })

    if (!error) {
      setReflectionSaved(true)
      setTimeout(() => setReflectionSaved(false), 2000)
    }
  }

  const handleLogout = async () => {
    await logout()
    router.push('/login')
  }

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>

  const completedTasks = todayTasks.filter(t => t.completed).length
  const today = new Date().toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div style={{ padding: '1.5rem', maxWidth: '700px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '24px', margin: 0 }}>Routine</h1>
        <button onClick={handleLogout} style={{ padding: '0.5rem 1rem', border: '0.5px solid #d1d5db', borderRadius: '4px', background: 'none', cursor: 'pointer', fontSize: '14px' }}>
          Logout
        </button>
      </div>

      {/* Navigation */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '2rem' }}>
        <Link href="/water" style={{ padding: '0.5rem 1rem', border: '0.5px solid #d1d5db', borderRadius: '4px', textDecoration: 'none', color: '#3b82f6', fontSize: '12px', fontWeight: '500' }}>
          💧 Water
        </Link>
        <Link href="/calendar" style={{ padding: '0.5rem 1rem', border: '0.5px solid #d1d5db', borderRadius: '4px', textDecoration: 'none', color: '#3b82f6', fontSize: '12px', fontWeight: '500' }}>
          Calendar
        </Link>
        <Link href="/templates" style={{ padding: '0.5rem 1rem', border: '0.5px solid #d1d5db', borderRadius: '4px', textDecoration: 'none', color: '#3b82f6', fontSize: '12px', fontWeight: '500' }}>
          Templates
        </Link>
        <Link href="/dashboard" style={{ padding: '0.5rem 1rem', border: '0.5px solid #d1d5db', borderRadius: '4px', textDecoration: 'none', color: '#3b82f6', fontSize: '12px', fontWeight: '500' }}>
          Stats
        </Link>
      </div>

      {/* Date & Progress */}
      <div style={{ padding: '1rem', background: '#f9fafb', border: '0.5px solid #e5e7eb', borderRadius: '8px', marginBottom: '2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '0.5rem' }}>{today}</div>
        <div style={{ fontSize: '12px', color: '#666', marginBottom: '0.5rem' }}>
          {completedTasks} of {todayTasks.length} completed
        </div>
        <div style={{
          width: '100%',
          height: '6px',
          background: '#e5e7eb',
          borderRadius: '3px',
          overflow: 'hidden',
          marginTop: '0.5rem',
        }}>
          <div style={{
            height: '100%',
            background: '#059669',
            width: todayTasks.length > 0 ? `${(completedTasks / todayTasks.length) * 100}%` : '0%',
          }} />
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '2rem' }}>
        <div style={{ padding: '1rem', background: '#f9fafb', border: '0.5px solid #e5e7eb', borderRadius: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: '#666', marginBottom: '4px' }}>Planned today</div>
          <div style={{ fontSize: '20px', fontWeight: '600', color: '#3b82f6' }}>{todayTasks.length}</div>
        </div>
        <div style={{ padding: '1rem', background: '#f9fafb', border: '0.5px solid #e5e7eb', borderRadius: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: '#666', marginBottom: '4px' }}>This week</div>
          <div style={{ fontSize: '20px', fontWeight: '600', color: '#3b82f6' }}>{stats.completedThisWeek}</div>
        </div>
      </div>

      {/* Today's Tasks */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '14px', color: '#666', margin: '0 0 1rem', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600' }}>
          Today's tasks
        </h2>

        {todayTasks.length === 0 ? (
          <p style={{ color: '#999', fontSize: '13px', marginBottom: '1rem' }}>No tasks yet</p>
        ) : (
          todayTasks.map(task => {
            const streak = streaks[task.task_id]
            return (
              <div
                key={task.task_id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '1rem',
                  background: task.completed ? '#f0fdf4' : '#f9fafb',
                  border: '0.5px solid #e5e7eb',
                  borderRadius: '8px',
                  marginBottom: '8px',
                }}
              >
                <input
                  type="checkbox"
                  checked={task.completed}
                  onChange={e => toggleTask(task.task_id, e.target.checked)}
                  style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '500', fontSize: '14px' }}>{task.name}</div>
                  <div style={{ fontSize: '11px', color: '#666' }}>{task.category || 'custom'}</div>
                </div>
                {task.is_template && streak && streak.current_streak > 0 && (
                  <span style={{ fontSize: '12px', fontWeight: '600', color: '#059669' }}>
                    🔥 {streak.current_streak}d
                  </span>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Smart Add Task */}
      <div style={{ marginBottom: '2rem' }}>
        {!showSearch ? (
          <button
            onClick={() => setShowSearch(true)}
            style={{
              width: '100%',
              padding: '0.75rem',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
            }}
          >
            + Add task
          </button>
        ) : (
          <div style={{ padding: '1rem', background: '#f9fafb', border: '0.5px solid #e5e7eb', borderRadius: '8px' }}>
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search or create..."
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

            {/* Results */}
            {filteredTasks.length > 0 && (
              <div style={{ marginBottom: '0.5rem' }}>
                {filteredTasks.map(task => (
                  <button
                    key={task.id}
                    onClick={() => handleAddTask(task.id)}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: '#eff6ff',
                      border: '0.5px solid #bfdbfe',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      textAlign: 'left',
                      marginBottom: '4px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span>{task.name}</span>
                    {streaks[task.id] && (
                      <span style={{ fontSize: '11px', color: '#059669', fontWeight: '600' }}>
                        🔥 {streaks[task.id].current_streak}d
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Create Custom */}
            {searchInput.trim().length > 0 && (
              <button
                onClick={() => handleAddTask('new', true)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: '#dcfce7',
                  border: '0.5px solid #bbf7d0',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  color: '#166534',
                  fontWeight: '500',
                  marginBottom: '0.5rem',
                }}
              >
                + Create custom: {searchInput.trim()}
              </button>
            )}

            <button
              onClick={() => {
                setShowSearch(false)
                setSearchInput('')
              }}
              style={{
                width: '100%',
                padding: '0.75rem',
                background: '#fee2e2',
                border: '0.5px solid #fecaca',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '13px',
                color: '#991b1b',
              }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Reflection */}
      <div style={{
        padding: '1rem',
        background: '#eff6ff',
        borderLeft: '3px solid #3b82f6',
        borderRadius: '8px',
      }}>
        <label style={{ fontSize: '11px', color: '#0284c7', fontWeight: '600', marginBottom: '8px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          📝 Daily Reflection
        </label>
        <p style={{ fontSize: '13px', marginBottom: '1rem', color: '#0b0b0b' }}>
          What's one thing you accomplished today?
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
            marginBottom: '0.5rem',
          }}
        />
        <button
          onClick={saveReflection}
          style={{
            width: '100%',
            padding: '0.5rem',
            background: reflectionSaved ? '#059669' : '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: '600',
            transition: 'background 0.3s',
          }}
        >
          {reflectionSaved ? '✓ Saved' : 'Save Reflection'}
        </button>
      </div>
    </div>
  )
}
