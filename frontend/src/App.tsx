import { NavLink, Route, Routes } from 'react-router-dom'
import { CategoryPage } from './pages/CategoryPage'
import { HomePage } from './pages/HomePage'
import { ScanPage } from './pages/ScanPage'

function App() {
  return (
    <div className="min-h-svh bg-stone-50 text-stone-800 dark:bg-stone-950 dark:text-stone-200">
      <header className="border-b border-stone-200/80 bg-stone-50/90 backdrop-blur dark:border-stone-800 dark:bg-stone-950/90">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <NavLink
            to="/"
            className="text-lg font-medium tracking-tight text-accent hover:opacity-90"
          >
            Skill Intent Scanner
          </NavLink>
          <span className="hidden max-w-md text-right text-sm text-balance text-stone-500 sm:inline dark:text-stone-400">
            Open Source AI Agent skill catalog & scanner
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/scan/:id" element={<ScanPage />} />
          <Route path="/category/:tag" element={<CategoryPage />} />
        </Routes>
      </main>

      <footer className="mt-12 border-t border-stone-200/80 bg-stone-100/50 px-4 py-6 text-center text-xs leading-relaxed text-stone-500 dark:border-stone-800 dark:bg-stone-900/40 dark:text-stone-400">
        <p className="mx-auto max-w-3xl text-balance">
          Best-effort scanning only; results may be incomplete or wrong. Not for sole
          security-critical decisions. Submissions are processed and stored. See{' '}
          <a
            href="https://github.com/sagiantebi/scanskill.dev/blob/main/TERMS.md"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent underline decoration-stone-400/60 underline-offset-2 hover:opacity-90 dark:decoration-stone-500/50"
          >
            TERMS.md
          </a>
          .
        </p>
      </footer>
    </div>
  )
}

export default App
