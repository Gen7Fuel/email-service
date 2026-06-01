import { Hono } from 'hono'
import nodemailer from 'nodemailer'
import type { MiddlewareHandler } from 'hono'

interface Attachment {
  filename: string
  content: string       // base64-encoded
  encoding?: string     // defaults to 'base64'
  contentType?: string  // e.g. 'application/pdf', 'image/png'
}

interface SendRequest {
  to: string | string[]
  subject: string
  html?: string
  text?: string
  cc?: string | string[]
  bcc?: string | string[]
  from?: string
  attachments?: Attachment[]
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

transporter.verify().then(() => {
  console.log('[email-service] SMTP connection verified')
}).catch((err: Error) => {
  console.error('[email-service] SMTP verification failed:', err.message)
  process.exit(1)
})

const app = new Hono()

app.use('*', async (c, next) => {
  const start = Date.now()
  await next()
  console.log(`[email-service] ${c.req.method} ${c.req.path} ${c.res.status} ${Date.now() - start}ms`)
})

const requireApiKey: MiddlewareHandler = async (c, next) => {
  const key = c.req.header('X-API-Key')
  if (!key || key !== process.env.EMAIL_SERVICE_API_KEY)
    return c.json({ ok: false, error: 'unauthorized' }, 401)
  await next()
}

const rateBuckets = new Map<string, number[]>()
const RATE_WINDOW_MS = 60_000
const RATE_LIMIT = 20

const sendLimiter: MiddlewareHandler = async (c, next) => {
  const key = c.req.header('X-API-Key') ?? c.req.header('x-forwarded-for') ?? 'default'
  const now = Date.now()
  const timestamps = (rateBuckets.get(key) ?? []).filter(t => now - t < RATE_WINDOW_MS)
  if (timestamps.length >= RATE_LIMIT)
    return c.json({ ok: false, error: 'rate limit exceeded' }, 429)
  timestamps.push(now)
  rateBuckets.set(key, timestamps)
  await next()
}

app.get('/health', (c) =>
  c.json({ ok: true, service: 'email-service', ts: new Date().toISOString() })
)

app.post('/send', sendLimiter, requireApiKey, async (c) => {
  let body: SendRequest
  try {
    body = await c.req.json()
  } catch {
    return c.json({ ok: false, error: 'invalid JSON body' }, 400)
  }

  const { to, subject, html, text, cc, bcc, from, attachments } = body

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
      attachments: attachments?.map(a => ({
        filename: a.filename,
        content: Buffer.from(a.content, (a.encoding ?? 'base64') as BufferEncoding),
        contentType: a.contentType,
      })),
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
