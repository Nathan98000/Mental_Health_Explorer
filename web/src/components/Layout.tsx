import { useEffect, type ReactNode } from 'react'
import { useLocation } from 'react-router'
import { Footer } from './Footer'
import { Header } from './Header'

export function Layout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:rounded-full focus:bg-surface focus:px-4 focus:py-2">
        Skip to content
      </a>
      <Header />
      <main id="main" className="mx-auto min-h-screen w-full max-w-6xl flex-1 px-4 sm:px-6">
        {children}
      </main>
      <Footer />
    </div>
  )
}
