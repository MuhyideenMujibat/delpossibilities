import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Gift, Wallet, Flame, BadgeCheck, Copy, Check, MessageCircle, X } from 'lucide-react'
import { formatNaira, whatsappShareUrl } from '../api'
import { publicFetch } from '../publicData'

// Opened from Profile.jsx's "Share & Earn" button (non-VVIP students only —
// see MEMBERSHIP_BADGES handling there). Shows the referral rewards
// attractively before handing the student a link to actually share.
function ReferralShareModal({ open, onClose, customerId }) {
  const [commissionAmount, setCommissionAmount] = useState(0)
  const [friendsTarget, setFriendsTarget] = useState(10)
  const [kgTarget, setKgTarget] = useState(30)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!open) return

    let cancelled = false

    publicFetch('/price')
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (cancelled || !data) return
        setCommissionAmount(Number(data.referral_commission_amount || 0))
        if (data.referral_milestone_referred_count) setFriendsTarget(Number(data.referral_milestone_referred_count))
        if (data.referral_milestone_kg) setKgTarget(Number(data.referral_milestone_kg))
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [open])

  if (!open) return null

  const shareLink = `${window.location.origin}/register?ref=${encodeURIComponent(customerId || '')}`
  const shareMessage = `Join Delpossibilities Gas with my referral link and become an Ambassador too! Register here: ${shareLink}`

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard access denied — the link is still visible to copy manually.
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />

      <div role="dialog" aria-modal="true" className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
          aria-label="Close"
        >
          <X className="h-5 w-5" strokeWidth={2} />
        </button>

        <div className="mb-4 flex items-start gap-3">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-brand-teal/10 text-brand-teal">
            <Gift className="h-5 w-5" strokeWidth={1.8} />
          </span>
          <div>
            <h3 className="font-heading text-base font-bold text-brand-navy">Share & Earn</h3>
            <p className="mt-1 text-sm text-slate-500">
              Invite friends to become Delpossibilities Ambassadors with you.
            </p>
          </div>
        </div>

        <div className="mb-5 flex flex-col gap-3">
          <div className="flex items-start gap-3 rounded-xl border border-slate-200 p-3">
            <Wallet className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand-teal" strokeWidth={1.8} />
            <div>
              <p className="text-sm font-semibold text-brand-navy">
                {commissionAmount > 0 ? formatNaira(commissionAmount) : 'Cash'} commission per order
              </p>
              <p className="text-xs text-slate-500">
                Every time a friend you referred pays for a gas order, you earn cash — no limit on how many
                friends or orders. It builds up on your account and is paid out to you later.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-slate-200 p-3">
            <Flame className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand-teal" strokeWidth={1.8} />
            <div>
              <p className="text-sm font-semibold text-brand-navy">Free 3kg gas, every time you hit it</p>
              <p className="text-xs text-slate-500">
                Get {friendsTarget} or more friends you referred to each fill gas, with their combined orders
                reaching {kgTarget}kg, and 3kg gets credited free toward your own next order — any extra beyond
                that carries straight into the next round, so nothing's wasted. Repeats every time you hit it
                again.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-slate-200 p-3">
            <BadgeCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand-teal" strokeWidth={1.8} />
            <div>
              <p className="text-sm font-semibold text-brand-navy">Official Brand Ambassador status</p>
              <p className="text-xs text-slate-500">
                The first time you hit that milestone, you're made an official Delpossibilities Brand
                Ambassador — with an ID card and an executive gift package.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <a
            href={whatsappShareUrl(shareMessage)}
            target="_blank"
            rel="noreferrer"
            className="btn-primary flex w-full items-center justify-center gap-2"
          >
            <MessageCircle className="h-4 w-4" strokeWidth={2} />
            Share on WhatsApp
          </a>
          <button type="button" onClick={handleCopyLink} className="btn-outline flex w-full items-center justify-center gap-2">
            {copied ? (
              <>
                <Check className="h-4 w-4" strokeWidth={2} /> Copied
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" strokeWidth={1.8} /> Copy link
              </>
            )}
          </button>
        </div>

        <p className="mt-3 text-center text-xs text-slate-400">
          Sharing opens WhatsApp — pick a friend, a group, or post it to your own Status.
        </p>
      </div>
    </div>,
    document.body
  )
}

export default ReferralShareModal
