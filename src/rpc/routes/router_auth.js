// api version: 2
import { randomUUID } from 'node:crypto'
import { SiweMessage } from 'siwe';
import QRCode from "qrcode";

import { dbpath } from '../../main.js';

const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    signed: true,
    maxAge: 86400,
}

async function generateQRCode(data) {
    try {
        const text = typeof data === "object" ? JSON.stringify(data) : String(data);
        const qrDataUrl = await QRCode.toDataURL(text, {
            errorCorrectionLevel: "H",
            color: { dark: "#000000", light: "#ffffff" }
        });
        return qrDataUrl;
    } catch (err) {
        console.error("❌ Create QRCode Failed:", err);
    }
}

function getSession(cardianal, address) {
    return cardianal.read(`${address}:auth`) ?? null;
}

function saveSession(cardianal, address, data) {
    cardianal.write(`${address}:auth`, data);
    cardianal.commit({ throwOnError: true });
}

function deleteSession(cardianal, address) {
    cardianal.remove(`${address}:auth`);
}

function revoked(session) {
    const session_revoked = { error: 'Logged in from another device', code: 'session_revoked', device: session?.device };
    const session_ended = { error: 'Logged out', code: 'session_ended', device: null };
    return session ? session_revoked : session_ended
}

function issue(app, user, reply, keep = {}) {
    const sid = keep.sid ?? randomUUID()
    const rtId = randomUUID()

    saveSession(app.cardianal, user.address, {
        sid, rtId, device: keep.device ?? null,
        loginAt: keep.loginAt ?? new Date().toISOString(),
    })

    reply.setCookie('rt', app.jwt.refresh.sign({ sub: user.address, sid, rtId }), cookieOptions)
    reply.header('cache-control', 'no-store')

    return {
        accessToken: app.jwt.sign({ sub: user.address, sid }),
        expiresIn: 900,
        user: user,
    }
}

const auth = async (app, req, reply) => {
    try { await req.jwtVerify() } catch { return reply.code(401).send({ error: 'unauthorized' }) }
    const session = getSession(app.cardianal, req.user.sub)
    if (!session || session.sid !== req.user.sid) return reply.code(401).send(revoked(session))
}

const readCookie = (req) => {
    const raw = req.cookies.rt
    if (!raw) return null
    const unsigned = req.unsignCookie(raw)
    return unsigned.valid ? unsigned.value : null
}

export default async function router_auth(app, options) {
    app.post('/request', async (req, reply) => {
        const { address } = req.body ?? {}
        const siwePath = `${address}:siwe`;
        let siwePublic = app.cardianal.read(siwePath) ?? null;
        if (siwePublic && new Date(siwePublic.siweMessage.issuedAt).getTime() > Date.now() - 10 * 1000) {
            return { siwePublic };
        } else {
            const siweMessage = new SiweMessage({
                domain: dbpath,
                address,
                statement: "Sign in with Ethereum to access the app.",
                uri: `${req.protocol}://${req.hostname}/api/v1/auth`,
                version: "1",
                chainId: 1,
                issuedAt: new Date().toISOString()
            });

            const EIP4361 = siweMessage.prepareMessage();
            const siwePrivate = crypto.randomUUID();
            const device = req.headers['user-agent'] ?? null

            const QRCodeLogin = await generateQRCode(siweMessage);

            const signature = "";
            siwePublic = { siweMessage, EIP4361, signature, device }

            app.cardianal.write(siwePath, siwePublic);
            app.cardianal.write(siwePath + ":private", siwePrivate);
            app.cardianal.commit({ throwOnError: true });

            //test reovery
            const response = siweMessage.toStr;
            const parsed = JSON.parse(response)
            const rEIP4361 = parsed.prepareMessage();

            console.log({ response, parsed, rEIP4361 });

            return { siwePublic, siwePrivate, QRCodeLogin }
        }
    })

    app.post('/login', async (req, reply) => {
        const { address, signature } = req.body ?? {}

        const siwePath = `${address}:siwe`;

        let siwePublic = app.cardianal.read(siwePath) ?? null;

        if (!siwePublic) { return reply.code(401).send({ error: 'Not found EIP4361 record' }) }

        const siweMessage = new SiweMessage(siwePublic.EIP4361);

        const fields = await siweMessage.verify({ signature });

        siwePublic.signature = signature;

        app.cardianal.write(siwePath, siwePublic);
        app.cardianal.commit({ throwOnError: true });

        return fields;
    })

    app.post('/verify', async (req, reply) => {
        const { address, requestkey } = req.body ?? {}

        const siwePath = `${address}:siwe`;

        const siwePublic = app.cardianal.read(siwePath) ?? null;
        const siwePrivate = app.cardianal.read(siwePath + ":private") ?? null;

        if (!siwePublic) { return reply.code(401).send({ error: 'Not found EIP4361 record' }) }
        if (siwePrivate !== requestkey) { return reply.code(401).send({ error: 'Invalid expect siwe request key' }) }
        if (siwePrivate == "0x") return reply.code(102).send({ polling: 'Waiting for signature sign' })

        const siweMessage = new SiweMessage(siwePublic.EIP4361);
        const signature = siwePublic.signature;

        const fields = await siweMessage.verify({ signature });

        const user = { address: fields.data.address }

        const previous = getSession(app.cardianal, user.address)
        const device = req.headers['user-agent'] ?? null

        return {
            ...issue(app, user, reply, { device }),
            revokedPrevious: previous ? { device: previous.device, loginAt: previous.loginAt } : null,
        }
    })

    app.post('/refresh', async (req, reply) => {
        const raw = readCookie(req)
        if (!raw) return reply.code(401).send({ error: 'Not found refresh token' })

        let payload
        try { payload = app.jwt.refresh.verify(raw) }
        catch { return reply.code(401).send({ error: 'Refresh token expired' }) }

        const session = getSession(app.cardianal, payload.sub)

        if (!session || session.sid !== payload.sid) {
            reply.clearCookie('rt', cookieOptions)
            return reply.code(401).send(revoked(session))
        }
        if (session.rtId !== payload.rtId) {
            deleteSession(app.cardianal, payload.sub)
            reply.clearCookie('rt', cookieOptions)
            return reply.code(401).send({ error: 'Refresh token reuse detected', code: 'token_reuse' })
        }

        // const user = users.find((u) => u.address === payload.sub)
        // if (!user) return reply.code(401).send({ error: 'User not found' })

        return issue(app, user, reply, { sid: session.sid, loginAt: session.loginAt, device: session.device })
    })

    app.post('/logout', async (req, reply) => {
        const raw = readCookie(req)
        if (raw) { try { deleteSession(app.cardianal, app.jwt.refresh.decode(raw).sub) } catch { } }
        reply.clearCookie('rt', cookieOptions)
        return { ok: true }
    })

    app.get('/context', { onRequest: (req, reply) => auth(app, req, reply) }, async (req, reply) => {
        reply.send({ context: req.user })
    })
}