import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router'
import { Layout } from './components/Layout'
import { Loading } from './components/Status'

// Each page is its own chunk; the trends page carries the charting library.
const Home = lazy(() => import('./pages/Home'))
const Explore = lazy(() => import('./pages/Explore'))
const Trends = lazy(() => import('./pages/Trends'))
const Methods = lazy(() => import('./pages/Methods'))
const NotFound = lazy(() => import('./pages/NotFound'))

export default function App() {
  return (
    <Layout>
      <Suspense fallback={<Loading what="the page" />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/explore/:cohort?/:indicator?" element={<Explore />} />
          <Route path="/trends/:cohort?/:indicator?" element={<Trends />} />
          <Route path="/methods" element={<Methods />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </Layout>
  )
}
