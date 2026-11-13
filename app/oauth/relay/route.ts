import { NextResponse, type NextRequest } from 'next/server'

// Desktop OAuth relay for the bot's own login (python main.py auth facebook): Meta only accepts https
// redirect URIs, so the app registers this URL and we hand ?code&state to the bot listening on the
// user's own machine. It only ever forwards to localhost, never to another host.
export function GET(req: NextRequest) {
  return NextResponse.redirect(`http://localhost:3456/callback/${req.nextUrl.search}`)
}
