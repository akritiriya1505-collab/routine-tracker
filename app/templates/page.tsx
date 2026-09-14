'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

interface Task {
  id: string
  name: string
  category: string
}

interface TaskStreak {
  task_id: string
  current_streak: number
  longest_streak: number
}

export default function Templates() {
  const [templates, setTemplates] = useState<Task[]>([])
  const [streaks, setStreaks] = useState<{ [key: string]: TaskStreak }>({})
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [taskName, setTaskName] = useState('')
  const [category, setCategory] = useState('fitness')
  const router = useRouter()

  useEffect(() => {
    const init = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        router.push('/login')
        return
      }
      setUser(authUser)

      const { data: templatesData } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', authUser.id)
        .eq('is_template', true)

      setTemplates(templatesData || [])

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

      setLoading(false)
    }

    init()
  }, [router])

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!taskName.trim() || !user) return

    const { error } = await supabase.from('tasks').insert({
      user_id: user.id,
      name: taskName.trim(),
      category,
      is_template: true,
    })

    if (!error) {
      setTaskName('')
      const { data: templatesData } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_template', true)
      setTemplates(templatesData || [])
    }
  }

  const deleteTemplate = async (templateId: string) => {
    if (!confirm('Delete this template?')) return

    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', templateId)

    if (!error) {
      setTemplates(prev => prev.filter(t => t.id !== templateId))
    }
  }

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>

  return (
    <div style={{ padding: '1.5rem', maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '24px', margin: 0 }}>Task templates</h1>
        <Link href="/" style={{ color: '#3b82f6', textDecoration: 'none' }}>Back</Link>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '16px', marginBottom: '1rem' }}>Your templates</h2>
        {templates.length === 0 ? (
          <p style={{ color: '#999' }}>No templates yet. Create one below!</p>
        ) : (
          templates.map(template => {
            const streak = streaks[template.id]
            return (
              <div
                key={template.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '1rem',
                  background: '#f9fafb',
                  border: '0.5px solid #e5e7eb',
                  borderRadius: '8px',
                  marginBottom: '8px',
                }}
              >
                <div>
                  <div style={{ fontWeight: '500', fontSize: '14px' }}>{template.name}</div>
                  <div style={{ fontSize: '12px', color: '#666' }}>{template.category}</div>
                  {streak && (
                    <div style={{ fontSize: '11px', color: '#059669', marginTop: '4px' }}>
                      Current: {streak.current_streak}d | Best: {streak.longest_streak}d
                    </div>
                  )}
                </div>
                <button
                  onClick={() => deleteTemplate(template.id)}
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#fee2e2',
                    color: '#991b1b',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                >
                  Delete
                </button>
              </div>
            )
          })
        )}
      </div>

      <form onSubmit={handleCreateTemplate} style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '16px', marginBottom: '1rem' }}>Create new template</h2>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '14px', fontWeight: '500' }}>
            Name
          </label>
          <input
            type="text"
            value={taskName}
            onChange={e => setTaskName(e.target.value)}
            placeholder="e.g., Gym, Water, Skincare"
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '0.5px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '14px',
            }}
          />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '14px', fontWeight: '500' }}>
            Category
          </label>
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '0.5px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '14px',
            }}
          >
            <option value="fitness">Fitness</option>
            <option value="health">Health</option>
            <option value="wellness">Wellness</option>
            <option value="work">Work</option>
            <option value="personal">Personal</option>
            <option value="other">Other</option>
          </select>
        </div>
        <button
          type="submit"
          style={{
            width: '100%',
            padding: '0.75rem',
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: '500',
            fontSize: '14px',
          }}
        >
          Create template
        </button>
      </form>
    </div>
  )
}
