import '@testing-library/jest-dom/vitest'
import { configure } from '@testing-library/react'

// The first render of a lazy-loaded page can take over a second on CI runners; wait longer than the 1 s default for it.
configure({ asyncUtilTimeout: 5000 })
