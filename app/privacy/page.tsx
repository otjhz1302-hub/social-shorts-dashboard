export const metadata = { title: 'Privacy Policy — Social Shorts' }

// Public page (middleware only guards /dashboard): required by TikTok, Google and Meta for the OAuth apps.
export default function Privacy() {
  return (
    <main className="max-w-2xl mx-auto p-6 text-sm leading-relaxed text-muted">
      <h1 className="text-2xl font-bold text-white mb-1">Privacy Policy</h1>
      <p className="mb-6">Last updated: November 12, 2026</p>

      <h2 className="text-white font-semibold mt-6 mb-2">What Social Shorts does</h2>
      <p>Social Shorts edits short vertical clips of gaming moments and, only when you connect an account and ask for it,
        uploads them to that account (TikTok as a draft in your inbox, YouTube, Facebook or Instagram).</p>

      <h2 className="text-white font-semibold mt-6 mb-2">Data we collect</h2>
      <ul className="list-disc pl-5 space-y-1">
        <li>Your email, to sign in to the dashboard.</li>
        <li>For each account you connect: its public id and display name, and the access tokens the platform gives us.</li>
        <li>The clips we produce for you and the links of the posts we create.</li>
      </ul>

      <h2 className="text-white font-semibold mt-6 mb-2">How we use it</h2>
      <p>Only to publish the clips you request to the accounts you connected, and to show you their status.
        Tokens are stored encrypted at rest on our server and are never shown in the browser, sold or shared.
        We do not read your followers, messages or any other content of your accounts.</p>

      <h2 className="text-white font-semibold mt-6 mb-2">Your control</h2>
      <p>Disconnect any account at any time in “Mis redes”: its tokens are deleted immediately. You can also revoke access
        from the platform’s own settings. Unused clips are deleted after 21 days. To delete your whole account and data,
        contact us as described below.</p>

      <h2 className="text-white font-semibold mt-6 mb-2">Contact</h2>
      <p>Questions or deletion requests: through the contact of the account that invited you to Social Shorts.</p>

      <hr className="border-border my-8" />
      <p className="text-xs">Español: Social Shorts solo usa tus datos para publicar en las cuentas que conectes los cortes que
        pidas. Puedes desconectar cualquier cuenta en «Mis redes» y sus tokens se borran al momento.</p>
    </main>
  )
}
