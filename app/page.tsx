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
  date: string
}

interface TaskStreak {
  task_id: string
  current_streak: number
  longest_streak: number
}

export default function Home() {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [dateTasksData, setDateTasksData] = useState<(Task & TaskLog)[]>([])
  const [templates, setTemplates] = useState<Task[]>([])
  const [allTasks, setAllTasks] = useState<Task[]>([])
  const [streaks, setStreaks] = useState<{ [key: string]: TaskStreak }>({})
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [searchInput, setSearchInput] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([])
  const [stats, setStats] = useState({ totalTasks: 0, completedThisWeek: 0 })
  const [reflection, setReflection] = useState('')
  const [reflectionSaved, setReflectionSaved] = useState(false)
  const [waterCount, setWaterCount] = useState(0)
  const [waterTaskId, setWaterTaskId] = useState('')
  const router = useRouter()

  // Fetch data when date changes
  useEffect(() => {
    const init = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        router.push('/login')
        return
      }
      setUser(authUser)

      // Get all tasks (both templates and custom)
      const { data: allTasksData } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', authUser.id)

      // Set templates (for search/filtering)
      const templatesData = allTasksData?.filter(t => t.is_template) || []
      setTemplates(templatesData)
      setAllTasks(allTasksData || [])

      // Find or create Water template
      let waterId = allTasksData?.find(t => t.name.toLowerCase().includes('water') && t.is_template)?.id

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

      // Fetch data for selected date (use allTasksData which includes both templates and custom tasks)
      await fetchDateData(authUser.id, selectedDate, waterId, allTasksData || [])
    }

    init()
  }, [selectedDate, router])

  const fetchDateData = async (userId: string, date: Date, waterId: string, allTasks: Task[]) => {
    const dateStr = date.toISOString().split('T')[0]

    // Get task logs for selected date
    const { data: logsData } = await supabase
      .from('task_logs')
      .select('*')
      .eq('user_id', userId)
      .eq('date', dateStr)

    // Combine tasks with logs
    if (allTasks && logsData) {
      const combined = logsData.map(log => {
        const task = allTasks.find(t => t.id === log.task_id)
        return { 
          ...task, 
          ...log,
          name: task?.name || 'Unnamed task'
        } as Task & TaskLog
      })
      setDateTasksData(combined)
    } else {
      setDateTasksData([])
    }

    // Fetch streaks
    const { data: streaksData } = await supabase
      .from('task_streaks')
      .select('*')
      .eq('user_id', userId)

    const streakMap: { [key: string]: TaskStreak } = {}
    streaksData?.forEach((s: any) => {
      streakMap[s.task_id] = {
        task_id: s.task_id,
        current_streak: s.current_streak || 0,
        longest_streak: s.longest_streak || 0,
      }
    })
    setStreaks(streakMap)

    // Get stats (for this week)
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const { data: weekLogsData } = await supabase
      .from('task_logs')
      .select('*')
      .eq('user_id', userId)
      .gte('date', weekAgo)
      .eq('completed', true)

    setStats({
      totalTasks: logsData?.length || 0,
      completedThisWeek: weekLogsData?.length || 0,
    })

    // Fetch water for selected date
    const waterLog = logsData?.find((l: any) => l.task_id === waterId)
    setWaterCount(waterLog?.count || 0)

    // Fetch reflection for selected date
    const { data: reflectionData } = await supabase
      .from('reflections')
      .select('content')
      .eq('user_id', userId)
      .eq('date', dateStr)
      .single()

    setReflection(reflectionData?.content || '')
    setLoading(false)
  }

  const toggleTask = async (taskId: string, completed: boolean) => {
    if (!user) return

    const dateStr = selectedDate.toISOString().split('T')[0]

    const { error } = await supabase.from('task_logs').upsert({
      user_id: user.id,
      task_id: taskId,
      date: dateStr,
      completed: !completed,
      count: 0,
    }, {
      onConflict: 'user_id,task_id,date'
    })

    if (!error) {
      // Update local state
      setDateTasksData(prev =>
        prev.map(t =>
          t.task_id === taskId ? { ...t, completed: !completed } : t
        )
      )

      // Update streak if task is being marked complete
      if (!completed) {
        await updateStreak(taskId, true)
      } else {
        // Task is being uncompleted - reset current streak
        const { error: streakError } = await supabase
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

        if (!streakError) {
          setStreaks(prev => ({
            ...prev,
            [taskId]: {
              task_id: taskId,
              current_streak: 0,
              longest_streak: streaks[taskId]?.longest_streak || 0,
            }
          }))
        }
      }
    }
  }

  const updateStreak = async (taskId: string, completed: boolean) => {
    if (!user || !completed) return

    const dateStr = selectedDate.toISOString().split('T')[0]
    const yesterday = new Date(selectedDate.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]

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
        last_completed_date: dateStr,
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

  const addWater = async () => {
    if (!user || !waterTaskId) return

    const dateStr = selectedDate.toISOString().split('T')[0]
    const newCount = waterCount + 1
    const isCompleted = newCount >= 8

    const { error } = await supabase.from('task_logs').upsert({
      user_id: user.id,
      task_id: waterTaskId,
      date: dateStr,
      completed: isCompleted,
      count: newCount,
    }, {
      onConflict: 'user_id,task_id,date'
    })

    if (!error) {
      setWaterCount(newCount)
      if (isCompleted) {
        await updateStreak(waterTaskId, true)
      }
    }
  }

  const removeWater = async () => {
    if (!user || !waterTaskId || waterCount === 0) return

    const dateStr = selectedDate.toISOString().split('T')[0]
    const newCount = waterCount - 1

    const { error } = await supabase.from('task_logs').upsert({
      user_id: user.id,
      task_id: waterTaskId,
      date: dateStr,
      completed: newCount >= 8,
      count: newCount,
    }, {
      onConflict: 'user_id,task_id,date'
    })

    if (!error) {
      setWaterCount(newCount)
    }
  }

  const saveReflection = async () => {
    if (!user) return

    const dateStr = selectedDate.toISOString().split('T')[0]

    const { error } = await supabase.from('reflections').upsert({
      user_id: user.id,
      date: dateStr,
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

  const handleAddTask = async (taskName: string) => {
    if (!user || !taskName.trim()) return

    const dateStr = selectedDate.toISOString().split('T')[0]

    // Check if it's a template task
    let taskId: string
    const existingTemplate = templates.find(t => t.name.toLowerCase() === taskName.toLowerCase())

    if (existingTemplate) {
      taskId = existingTemplate.id
    } else {
      // Create custom task (not template)
      const { data: newTask } = await supabase
        .from('tasks')
        .insert({
          user_id: user.id,
          name: taskName,
          category: 'custom',
          is_template: false,
        })
        .select()
        .single()
      taskId = newTask?.id
    }

    // Log the task for this date
    const { error } = await supabase.from('task_logs').insert({
      user_id: user.id,
      task_id: taskId,
      date: dateStr,
      completed: false,
      count: 0,
    })

    if (!error) {
      setSearchInput('')
      setShowSearch(false)
      // Refetch data with all tasks
      await fetchDateData(user.id, selectedDate, waterTaskId, allTasks)
    }
  }

  const changeDate = (days: number) => {
    const newDate = new Date(selectedDate)
    newDate.setDate(newDate.getDate() + days)
    setSelectedDate(newDate)
  }

  const getDateDisplay = () => {
    const day = selectedDate.toLocaleDateString('default', { weekday: 'short' })
    const date = String(selectedDate.getDate()).padStart(2, '0')
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0')
    return { day, date, month }
  }

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>

  const { day, date, month } = getDateDisplay()

  return (
    <div style={{ minHeight: '100vh', background: '#fafafa' }}>
      {/* Top Navigation */}
      <div style={{
        display: 'flex',
        borderBottom: '0.5px solid #e5e7eb',
        background: '#ffffff',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <Link href="/" style={{
          flex: 1,
          padding: '12px',
          borderBottom: '2px solid #3b82f6',
          textDecoration: 'none',
          textAlign: 'center',
          fontSize: '13px',
          fontWeight: '500',
          color: '#000',
        }}>
          Home
        </Link>
        <Link href="/calendar" style={{
          flex: 1,
          padding: '12px',
          textDecoration: 'none',
          textAlign: 'center',
          fontSize: '13px',
          fontWeight: '500',
          color: '#999',
          borderBottom: '2px solid transparent',
        }}>
          📅 Calendar
        </Link>
        <Link href="/templates" style={{
          flex: 1,
          padding: '12px',
          textDecoration: 'none',
          textAlign: 'center',
          fontSize: '13px',
          fontWeight: '500',
          color: '#999',
          borderBottom: '2px solid transparent',
        }}>
          ⚙️ Templates
        </Link>
        <Link href="/dashboard" style={{
          flex: 1,
          padding: '12px',
          textDecoration: 'none',
          textAlign: 'center',
          fontSize: '13px',
          fontWeight: '500',
          color: '#999',
          borderBottom: '2px solid transparent',
        }}>
          📊 Stats
        </Link>
      </div>

      {/* Main content */}
      <div style={{ padding: '1.5rem', maxWidth: '600px', margin: '0 auto' }}>
        {/* Date Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '2rem', justifyContent: 'center' }}>
          <button
            onClick={() => changeDate(-1)}
            style={{
              width: '32px',
              height: '32px',
              border: '0.5px solid #d1d5db',
              background: '#fff',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ‹
          </button>
          <div style={{ textAlign: 'center', minWidth: '120px' }}>
            <p style={{ fontSize: '12px', color: '#666', margin: '0' }}>{day}</p>
            <p style={{ fontSize: '18px', fontWeight: '600', color: '#000', margin: '4px 0 0' }}>{date}/{month}</p>
          </div>
          <button
            onClick={() => changeDate(1)}
            style={{
              width: '32px',
              height: '32px',
              border: '0.5px solid #d1d5db',
              background: '#fff',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ›
          </button>
        </div>

        {/* Water Intake */}
        <div style={{ marginBottom: '2rem', padding: '1rem', background: '#eff6ff', border: '0.5px solid #bfdbfe', borderRadius: '8px' }}>
          <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '1rem', color: '#0284c7' }}>💧 Water intake</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
            <div style={{ fontSize: '18px', fontWeight: '600', color: '#0284c7' }}>{waterCount}/8</div>
            <div style={{ flex: 1, height: '8px', background: '#dbeafe', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ height: '100%', background: '#0284c7', width: `${(waterCount / 8) * 100}%` }} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button
              onClick={removeWater}
              disabled={waterCount === 0}
              style={{
                padding: '0.75rem',
                background: waterCount === 0 ? '#f3f4f6' : '#fee2e2',
                color: waterCount === 0 ? '#d1d5db' : '#991b1b',
                border: waterCount === 0 ? '0.5px solid #e5e7eb' : '0.5px solid #fecaca',
                borderRadius: '6px',
                cursor: waterCount === 0 ? 'not-allowed' : 'pointer',
                fontSize: '12px',
                fontWeight: '600',
              }}
            >
              − Remove
            </button>
            <button
              onClick={addWater}
              style={{
                padding: '0.75rem',
                background: '#0284c7',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '600',
              }}
            >
              + Add cup
            </button>
          </div>
        </div>

        {/* Smart Add Task */}
        <div style={{ marginBottom: '2rem' }}>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value)
              if (e.target.value) {
                const filtered = templates.filter(t =>
                  t.name.toLowerCase().includes(e.target.value.toLowerCase())
                )
                setFilteredTasks(filtered)
              } else {
                setFilteredTasks([])
              }
            }}
            onFocus={() => setShowSearch(true)}
            placeholder="+ Add task..."
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '0.5px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px',
            }}
          />

          {showSearch && (
            <div style={{ marginTop: '8px', background: '#fff', border: '0.5px solid #d1d5db', borderRadius: '6px', overflow: 'hidden' }}>
              {searchInput && (
                <button
                  onClick={() => {
                    handleAddTask(searchInput)
                  }}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: 'none',
                    background: '#f3f4f6',
                    borderBottom: '0.5px solid #d1d5db',
                    cursor: 'pointer',
                    fontSize: '12px',
                    color: '#3b82f6',
                    fontWeight: '500',
                    textAlign: 'left',
                  }}
                >
                  + Create custom: {searchInput}
                </button>
              )}
              {filteredTasks.map((task) => (
                <button
                  key={task.id}
                  onClick={() => {
                    handleAddTask(task.name)
                  }}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: 'none',
                    background: '#fff',
                    borderBottom: '0.5px solid #e5e7eb',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: '500',
                    textAlign: 'left',
                  }}
                >
                  {task.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tasks */}
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '14px', fontWeight: '600', color: '#666', margin: '0 0 12px' }}>Tasks ({dateTasksData.filter(t => t.completed && t.name.toLowerCase() !== 'water').length}/{dateTasksData.filter(t => t.name.toLowerCase() !== 'water').length})</h2>
          {dateTasksData.filter(t => t.name.toLowerCase() !== 'water').length === 0 ? (
            <p style={{ fontSize: '13px', color: '#999', margin: '0' }}>No tasks planned for this day</p>
          ) : (
            dateTasksData.filter(t => t.name.toLowerCase() !== 'water').map((task) => (
              <div
                key={task.task_id}
                style={{
                  padding: '12px',
                  background: '#fff',
                  border: '0.5px solid #e5e7eb',
                  borderRadius: '6px',
                  marginBottom: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <input
                  type="checkbox"
                  checked={task.completed}
                  onChange={() => toggleTask(task.task_id, task.completed)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <div style={{ flex: 1 }}>
                  <p style={{
                    margin: '0',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#000',
                    textDecoration: task.completed ? 'line-through' : 'none',
                  }}>
                    {task.name || 'Unnamed task'}
                  </p>
                  {task.is_template && streaks[task.task_id] && streaks[task.task_id].current_streak > 0 && (
                    <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#666' }}>
                      🔥 {streaks[task.task_id].current_streak}d
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '2rem' }}>
          <div style={{ padding: '12px', background: '#f9fafb', border: '0.5px solid #e5e7eb', borderRadius: '6px', textAlign: 'center' }}>
            <p style={{ fontSize: '11px', color: '#666', margin: '0 0 4px' }}>Completed</p>
            <p style={{ fontSize: '18px', fontWeight: '600', color: '#000', margin: '0' }}>{dateTasksData.filter(t => t.completed).length}/{dateTasksData.length}</p>
          </div>
          <div style={{ padding: '12px', background: '#f9fafb', border: '0.5px solid #e5e7eb', borderRadius: '6px', textAlign: 'center' }}>
            <p style={{ fontSize: '11px', color: '#666', margin: '0 0 4px' }}>This week</p>
            <p style={{ fontSize: '18px', fontWeight: '600', color: '#3b82f6', margin: '0' }}>{stats.completedThisWeek}</p>
          </div>
        </div>

        {/* Reflection */}
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '14px', fontWeight: '600', color: '#666', margin: '0 0 12px' }}>Reflection</h2>
          <textarea
            value={reflection}
            onChange={(e) => setReflection(e.target.value)}
            placeholder="How was your day?"
            style={{
              width: '100%',
              padding: '12px',
              border: '0.5px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '13px',
              fontFamily: 'inherit',
              minHeight: '100px',
              resize: 'vertical',
              marginBottom: '8px',
            }}
          />
          <button
            onClick={saveReflection}
            style={{
              width: '100%',
              padding: '0.75rem',
              background: reflectionSaved ? '#10b981' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '600',
              transition: 'background 0.3s',
            }}
          >
            {reflectionSaved ? '✓ Saved' : 'Save reflection'}
          </button>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          style={{
            width: '100%',
            padding: '12px',
            background: '#fff',
            border: '0.5px solid #d1d5db',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '13px',
            color: '#dc2626',
            fontWeight: '600',
          }}
        >
          Logout
        </button>
      </div>
    </div>
  )
}
