// package import
import fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import fastifyCookie from "@fastify/cookie";

import Web3 from "web3";
import { configDotenv } from "dotenv";

// config
configDotenv({ quiet: true });

// project import
import { DB } from "./engine/lmdb.js";

// router import
import router_memo from "./rpc/routes/router_memo.js";
import router_auth from "./rpc/routes/router_auth.js";

// setting variable
export const app = new fastify({ logger: false });
export const web3 = new Web3();

export const port = process.env.PORT || 3000
export const host = '0.0.0.0'

export const dbpath = process.env.SYNCNETWORK_DB;
export const cardianal = new DB(dbpath);

// initialization
app.decorate('cardianal', cardianal);

// engine router
await app.register(fastifyCookie, { secret: process.env.COOKIE_SECRET })
await app.register(fastifyJwt, { secret: process.env.ACCESS_SECRET, sign: { expiresIn: '15m' } })
await app.register(fastifyJwt, { namespace: 'refresh', secret: process.env.REFRESH_SECRET, sign: { expiresIn: '1d' } })

// main router
app.get('/', async (request, reply) => {
    return { basekey: cardianal.basekey, status: true };
});

// rpc router
await app.register(router_memo, { prefix: 'api/v1/memo' });
await app.register(router_auth, { prefix: 'api/v1/auth' });

// server
const start = async () => {
  try {
    await app.listen({ port, host })
    console.log(`🚀 WebSocket API running on port ${port}`);
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start();