import { createContext, useContext } from 'react'

export const UserContext = createContext(null)

export function useCurrentUser() {
  const ctx = useContext(UserContext)
  if (!ctx) throw new Error('useCurrentUser must be used within a UserProvider')
  return ctx
}
