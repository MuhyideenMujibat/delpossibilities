import { useCurrentUser } from '../userContext'
import CreateOrder from './CreateOrder'

// "/home" — the app's home for students and guests: CreateOrder reused
// completely as-is (see CreateOrder.jsx for the one guest-specific tweak at
// its final step). "/" is the public marketing landing page. This wrapper
// only adds a personalized greeting strip for logged-in students; guests
// skip straight to the order form (the header's GuestUserMenu already covers
// "log in or register" for them, no need to repeat it here).
function HomeIntroStrip({ token }) {
  const { user } = useCurrentUser()
  const name = user?.name || ''
  const address = user?.hostel || ''

  if (!token || !name) return null

  return (
    <p className="mb-4 text-sm text-slate-500">
      Hi, <span className="font-semibold text-brand-navy">{name}</span>
      {address && (
        <>
          {' '}— delivering to <span className="font-medium text-brand-navy">{address}</span>
        </>
      )}
    </p>
  )
}

function Home({ token }) {
  return (
    <>
      <HomeIntroStrip token={token} />
      <CreateOrder token={token} />
    </>
  )
}

export default Home
