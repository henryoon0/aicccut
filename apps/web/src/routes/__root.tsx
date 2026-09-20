import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { TooltipProvider } from '../components/ui/tooltip'

import appCss from '../styles.css?url'

/**
 * Applies the stored theme before first paint. The theme hooks in
 * `#/editor/home/theme` and `#/editor/shell/hooks` only run after hydration,
 * so without this the page flashes light (SSR has no class) for every
 * dark-theme user. Key must match `THEME_KEY` there (`aicccut.theme`).
 */
const THEME_BOOT =
  '(function(){var d=document.documentElement;try{d.classList.toggle("dark",localStorage.getItem("aicccut.theme")!=="light")}catch(e){d.classList.add("dark")}})()'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'AiccCut',
      },
    ],
    links: [
      {
        rel: 'icon',
        href: '/favicon.ico',
        type: 'image/x-icon',
      },
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
        <HeadContent />
      </head>
      <body>
        <TooltipProvider>
          {children}
        </TooltipProvider>
        <Scripts />
      </body>
    </html>
  )
}
