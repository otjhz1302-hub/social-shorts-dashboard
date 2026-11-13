export const metadata = { title: 'Terms of Service — Social Shorts' }

export default function Terms() {
  return (
    <main className="max-w-2xl mx-auto p-6 text-sm leading-relaxed text-muted">
      <h1 className="text-2xl font-bold text-white mb-1">Terms of Service</h1>
      <p className="mb-6">Last updated: November 12, 2026</p>

      <h2 className="text-white font-semibold mt-6 mb-2">The service</h2>
      <p>Social Shorts is an invite-only tool that finds gaming moments, edits them into short vertical clips and,
        at your request, uploads them to the social accounts you connect. Access can be granted or removed by the
        administrator at any time.</p>

      <h2 className="text-white font-semibold mt-6 mb-2">Your responsibilities</h2>
      <ul className="list-disc pl-5 space-y-1">
        <li>You only connect accounts you own or are authorized to manage.</li>
        <li>You review what is published on your accounts and follow each platform’s rules (TikTok, YouTube, Meta).</li>
        <li>Clips include attribution to the original creator; you will not remove it or claim the original content as yours.</li>
      </ul>

      <h2 className="text-white font-semibold mt-6 mb-2">Uploads</h2>
      <p>On TikTok, clips are sent to your inbox as drafts: nothing is public until you post it yourself.
        On other platforms, a clip is published only when you request it. Daily limits apply.</p>

      <h2 className="text-white font-semibold mt-6 mb-2">No warranty</h2>
      <p>The service is provided “as is”, without guarantees of views, reach or availability. We are not liable for
        actions taken by the platforms on your accounts.</p>

      <h2 className="text-white font-semibold mt-6 mb-2">Privacy</h2>
      <p>See our <a href="/privacy" className="text-gold hover:underline">Privacy Policy</a>.</p>
    </main>
  )
}
