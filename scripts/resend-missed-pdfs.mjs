// Vienkartinis skriptas: iš naujo išsiunčia PDF laišką visiems lead'ams, kurie užsiregistravo,
// kol Supabase `RESEND_API_KEY` secret'as buvo neteisingas (nuo 2026-09-19 09:34 UTC).
//
// Pirmiausia peržiūra be siuntimo:
//   ADMIN_PASSWORD=... RESEND_API_KEY=re_... node scripts/resend-missed-pdfs.mjs --dry-run
// Siuntimas (kiekvieną dieną ne daugiau MAX_SEND laiškų, nes Resend free planas = 100/dieną):
//   ADMIN_PASSWORD=... RESEND_API_KEY=re_... node scripts/resend-missed-pdfs.mjs
// Kitą dieną paleisk tą pačią komandą — skriptas prisimena, kam jau išsiuntė (.missed-pdf-sent.json).

import { readFileSync, writeFileSync, existsSync } from 'node:fs'

const ADMIN_LEADS_URL = 'https://fsqtjmexsyockqsisuab.supabase.co/functions/v1/admin-leads'
const SINCE = process.env.SINCE || '2026-09-19T09:30:00Z'
const MAX_SEND = Number(process.env.MAX_SEND || 80)
const STATE_FILE = new URL('./.missed-pdf-sent.json', import.meta.url)
const DRY_RUN = process.argv.includes('--dry-run')

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD
const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL = 'info@errotips.com'
const SKIP_EMAILS = new Set(['ernestasbudvytis@gmail.com'])

const PDF_URL_LT = 'https://fsqtjmexsyockqsisuab.supabase.co/storage/v1/object/public/pdfs/14-Forex-ICT-PDF.zip'
const PDF_URL_EN = 'https://fsqtjmexsyockqsisuab.supabase.co/storage/v1/object/public/pdfs/THE%20CANDLESTICK%20TRADING%20BIBLE(1).pdf'

if (!ADMIN_PASSWORD || (!RESEND_API_KEY && !DRY_RUN)) {
  console.error('Trūksta ADMIN_PASSWORD (ir RESEND_API_KEY siuntimui) environment kintamųjų.')
  process.exit(1)
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

function buildEmail(lead) {
  const name = esc(lead.name || '')
  const box = (inner) => `<div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;padding:32px;background:#08060f;color:#f4f0ff;border-radius:16px;">${inner}</div>`
  const btn = (href, label) => `<a href="${href}" style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#0ea5e9,#a855f7);color:#0f0b1a;font-weight:700;border-radius:10px;text-decoration:none;margin:8px 0 24px;">${label}</a>`

  if (lead.lang === 'en') {
    return {
      subject: 'The Candlestick Trading Bible – your free PDF guide',
      html: box(`
        <h2 style="margin:0 0 16px;font-size:22px;color:#38bdf8;">Hi, ${name}! 👋</h2>
        <p style="margin:0 0 16px;line-height:1.7;color:#c0b4d8;">Sorry for the delay – our automatic email didn't reach you earlier. Here is your link to The Candlestick Trading Bible PDF guide:</p>
        ${btn(PDF_URL_EN, '⬇ Download The Candlestick Trading Bible (PDF)')}
        <p style="margin:0;font-size:13px;color:#9b8ab5;line-height:1.6;">Questions? Email us: <a href="mailto:${FROM_EMAIL}" style="color:#38bdf8;">${FROM_EMAIL}</a><br>Telegram: <a href="https://t.me/errotipsfx" style="color:#38bdf8;">@errotipsfx</a></p>`),
    }
  }
  return {
    subject: '14 Forex ICT strategijos PDF – tavo nemokama medžiaga',
    html: box(`
      <h2 style="margin:0 0 16px;font-size:22px;color:#38bdf8;">Sveiki, ${name}! 👋</h2>
      <p style="margin:0 0 16px;line-height:1.7;color:#c0b4d8;">Atsiprašome už vėlavimą – automatinis laiškas jums anksčiau nepasiekė. Žemiau nuoroda į jūsų 14 PDF mokymų:</p>
      ${btn(PDF_URL_LT, '⬇ Atsisiųsti 14 PDF (ZIP)')}
      <p style="margin:0;font-size:13px;color:#9b8ab5;line-height:1.6;">Jei turite klausimų, rašykite: <a href="mailto:${FROM_EMAIL}" style="color:#38bdf8;">${FROM_EMAIL}</a><br>Telegram: <a href="https://t.me/errotipscopyfx" style="color:#38bdf8;">@errotipscopyfx</a></p>`),
  }
}

const res = await fetch(ADMIN_LEADS_URL, { headers: { 'x-admin-password': ADMIN_PASSWORD } })
const { leads, error } = await res.json()
if (error) {
  console.error("Klaida gaunant lead'us:", error)
  process.exit(1)
}

const alreadySent = new Set(existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, 'utf8')) : [])
const since = new Date(SINCE).getTime()
const seen = new Set()
const queue = []
for (const lead of [...leads].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))) {
  const email = (lead.email || '').trim().toLowerCase()
  if (!email || new Date(lead.created_at).getTime() < since) continue
  if (SKIP_EMAILS.has(email) || seen.has(email) || alreadySent.has(email)) continue
  seen.add(email)
  queue.push({ ...lead, email })
}

const lt = queue.filter((l) => l.lang !== 'en').length
console.log(`Lead'ų nuo ${SINCE}: laukia išsiuntimo ${queue.length} (LT ${lt}, EN ${queue.length - lt}); jau išsiųsta anksčiau: ${alreadySent.size}.`)
if (DRY_RUN) {
  console.log('Peržiūra (--dry-run), nieko nesiunčiu. Pirmi 10:')
  queue.slice(0, 10).forEach((l) => console.log(' ', l.created_at, l.lang, l.email))
  process.exit(0)
}

let sent = 0, failed = 0
for (const lead of queue) {
  if (sent >= MAX_SEND) {
    console.log(`Pasiektas dienos limitas (${MAX_SEND}). Likusius paleisk rytoj tuo pačiu skriptu.`)
    break
  }
  const { subject, html } = buildEmail(lead)
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: `Errotips <${FROM_EMAIL}>`, to: [lead.email], subject, html }),
  })
  if (r.ok) {
    sent++
    alreadySent.add(lead.email)
    writeFileSync(STATE_FILE, JSON.stringify([...alreadySent], null, 2))
  } else {
    failed++
    const body = await r.text()
    console.error(`Nepavyko: ${lead.email} — ${r.status} ${body}`)
    if (r.status === 401 || r.status === 403 || r.status === 429) {
      console.error('Stoju: tai raktas/limito problema, ne atskiro adreso.')
      break
    }
  }
  await new Promise((resolve) => setTimeout(resolve, 600))
}

console.log(`Baigta. Išsiųsta: ${sent}, nepavyko: ${failed}.`)
