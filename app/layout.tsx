import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Social Shorts',
  description: 'Panel de control para automatización de shorts',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
