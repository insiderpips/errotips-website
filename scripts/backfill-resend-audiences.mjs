// Vienkartinis skriptas: paima VISUS lead'us iš Supabase (per admin-leads funkciją)
// ir įkelia juos į teisingą Resend Audience (LT/EN) pagal `lang` lauką.
// Paleidimas:
//   node scripts/backfill-resend-audiences.mjs
// Reikalingi env kintamieji (arba įrašyk juos tiesiai žemiau prieš paleidimą):
//   ADMIN_PASSWORD, RESEND_API_KEY, RESEND_AUDIENCE_LT, RESEND_AUDIENCE_EN

const ADMIN_LEADS_URL = 'https://fsqtjmexsyockqsisuab.supabase.co/functions/v1/admin-leads'

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD
const RESEND_API_KEY = process.env.RESEND_API_KEY
const RESEND_AUDIENCE_LT = process.env.RESEND_AUDIENCE_LT || '4c32c842-90d3-4b54-8b99-2c0ef346605f'
const RESEND_AUDIENCE_EN = process.env.RESEND_AUDIENCE_EN || '1ba4bf24-d1bc-4c08-b438-c5c9b5588ec8'

if (!ADMIN_PASSWORD || !RESEND_API_KEY) {
  console.error('Trūksta ADMIN_PASSWORD arba RESEND_API_KEY environment kintamųjų.')
  process.exit(1)
}

const res = await fetch(ADMIN_LEADS_URL, {
  headers: { 'x-admin-password': ADMIN_PASSWORD },
})
const { leads, error } = await res.json()
if (error) {
  console.error('Klaida gaunant lead\'us:', error)
  process.exit(1)
}

console.log(`Rasta ${leads.length} lead'ų. Pradedu kėlimą į Resend...`)

let ok = 0, failed = 0
for (const lead of leads) {
  const isEn = lead.lang === 'en'
  const audienceId = isEn ? RESEND_AUDIENCE_EN : RESEND_AUDIENCE_LT
  const [firstName, ...rest] = (lead.name || '').trim().split(' ')

  const r = await fetch(`https://api.resend.com/audiences/${audienceId}/contacts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: lead.email,
      first_name: firstName || undefined,
      last_name: rest.join(' ') || undefined,
      unsubscribed: false,
    }),
  })

  if (r.ok) {
    ok++
  } else {
    failed++
    const body = await r.text()
    console.error(`Nepavyko: ${lead.email} (${lead.lang}) — ${r.status} ${body}`)
  }
}

console.log(`Baigta. Sėkmingai: ${ok}, nepavyko: ${failed}.`)
