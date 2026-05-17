import { redirect } from 'next/navigation'

export default function HomePage() {
  // Middleware handles the redirect, but this is a fallback
  redirect('/login')
}
