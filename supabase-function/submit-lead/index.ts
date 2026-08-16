import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const PDF_URL_LT = 'https://fsqtjmexsyockqsisuab.supabase.co/storage/v1/object/public/pdfs/14-Forex-ICT-PDF.zip'
const PDF_URL_EN = 'https://fsqtjmexsyockqsisuab.supabase.co/storage/v1/object/public/pdfs/THE%20CANDLESTICK%20TRADING%20BIBLE(1).pdf'
const ADMIN_EMAIL = 'ernestasbudvytis@gmail.com'
const FROM_EMAIL = 'info@errotips.com'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { name, email, lang } = await req.json()

    if (!name || !email) {
      return new Response(JSON.stringify({ error: 'Trūksta laukų' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const isEn = lang === 'en'

    // 1. Išsaugoti į DB
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    await supabase.from('leads').insert({ name, email })

    // 2. Siųsti el. laišką klientui
    const clientEmail = isEn
      ? {
          subject: 'The Candlestick Trading Bible – your free PDF guide',
          html: `
            <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;padding:32px;background:#08060f;color:#f4f0ff;border-radius:16px;">
              <h2 style="margin:0 0 16px;font-size:22px;color:#38bdf8;">Hi, ${name}! 👋</h2>
              <p style="margin:0 0 16px;line-height:1.7;color:#c0b4d8;">
                Thanks for your interest in trading. Below is your link to The Candlestick Trading Bible PDF guide:
              </p>
              <a href="${PDF_URL_EN}"
                 style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#0ea5e9,#a855f7);color:#0f0b1a;font-weight:700;border-radius:10px;text-decoration:none;margin:8px 0 24px;">
                ⬇ Download The Candlestick Trading Bible (PDF)
              </a>
              <p style="margin:0;font-size:13px;color:#9b8ab5;line-height:1.6;">
                Questions? Email us: <a href="mailto:${FROM_EMAIL}" style="color:#38bdf8;">${FROM_EMAIL}</a><br>
                Telegram: <a href="https://t.me/errotipscopyfx" style="color:#38bdf8;">@errotipscopyfx</a>
              </p>
            </div>
          `,
        }
      : {
          subject: '14 Forex ICT strategijos PDF – tavo nemokama medžiaga',
          html: `
            <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;padding:32px;background:#08060f;color:#f4f0ff;border-radius:16px;">
              <h2 style="margin:0 0 16px;font-size:22px;color:#38bdf8;">Sveiki, ${name}! 👋</h2>
              <p style="margin:0 0 16px;line-height:1.7;color:#c0b4d8;">
                Ačiū, kad susidomėjote Forex ICT strategija. Žemiau rasite nuorodą į jūsų 14 PDF mokymų:
              </p>
              <a href="${PDF_URL_LT}"
                 style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#0ea5e9,#a855f7);color:#0f0b1a;font-weight:700;border-radius:10px;text-decoration:none;margin:8px 0 24px;">
                ⬇ Atsisiųsti 14 PDF (ZIP)
              </a>
              <p style="margin:0;font-size:13px;color:#9b8ab5;line-height:1.6;">
                Jei turite klausimų, rašykite: <a href="mailto:${FROM_EMAIL}" style="color:#38bdf8;">${FROM_EMAIL}</a><br>
                Telegram: <a href="https://t.me/errotipscopyfx" style="color:#38bdf8;">@errotipscopyfx</a>
              </p>
            </div>
          `,
        }

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `Errotips <${FROM_EMAIL}>`,
        to: [email],
        subject: clientEmail.subject,
        html: clientEmail.html,
      }),
    })

    // 3. Siųsti pranešimą adminui
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `Errotips sistema <${FROM_EMAIL}>`,
        to: [ADMIN_EMAIL],
        subject: `Naujas kontaktas: ${name}`,
        html: `
          <p><strong>Vardas:</strong> ${name}</p>
          <p><strong>El. paštas:</strong> ${email}</p>
          <p><strong>Kalba:</strong> ${isEn ? 'EN (Candlestick Trading Bible)' : 'LT (14 ICT PDF)'}</p>
          <p><strong>Laikas:</strong> ${new Date().toLocaleString('lt-LT')}</p>
        `,
      }),
    })

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
