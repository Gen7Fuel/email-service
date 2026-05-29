import { Hono } from 'hono'
import nodemailer from 'nodemailer'
import type { MiddlewareHandler } from 'hono'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

const app = new Hono()

const requireApiKey: MiddlewareHandler = async (c, next) => {
  const key = c.req.header('X-API-Key')
  if (!key || key !== process.env.API_KEY)
    return c.json({ ok: false, error: 'unauthorized' }, 401)
  await next()
}

app.get('/health', (c) =>
  c.json({ ok: true, service: 'email-service', ts: new Date().toISOString() })
)

app.post('/send', requireApiKey, async (c) => {
  let body: any
  try {
    body = await c.req.json()
  } catch {
    return c.json({ ok: false, error: 'invalid JSON body' }, 400)
  }

  const { to, subject, html, text, cc, bcc, from } = body

  if (!to || !subject || (!html && !text))
    return c.json({ ok: false, error: 'missing required fields: to, subject, and html or text' }, 400)

  try {
    const info = await transporter.sendMail({
      from: from ?? process.env.SMTP_FROM ?? `Gen7 Fuel <${process.env.SMTP_USER}>`,
      to: Array.isArray(to) ? to.join(', ') : to,
      cc: cc ? (Array.isArray(cc) ? cc.join(', ') : cc) : undefined,
      bcc: bcc ? (Array.isArray(bcc) ? bcc.join(', ') : bcc) : undefined,
      subject,
      html,
      text,
    })
    return c.json({ ok: true, messageId: info.messageId })
  } catch (err: any) {
    console.error('[email-service] send error:', err.message)
    return c.json({ ok: false, error: `SMTP error: ${err.message}` }, 500)
  }
})

const port = Number(process.env.PORT ?? 2525)
console.log(`[email-service] listening on port ${port}`)

export default { port, fetch: app.fetch }
