import { supabase } from './supabase'

export async function signup(email: string, password: string) {
  return await supabase.auth.signUp({
    email,
    password,
  })
}

export async function login(email: string, password: string) {
  return await supabase.auth.signInWithPassword({
    email,
    password,
  })
}

export async function logout() {
  return await supabase.auth.signOut()
}

export async function getUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}
