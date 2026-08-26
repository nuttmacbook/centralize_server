import fastify from "fastify";
import Web3 from "web3";
import { configDotenv } from "dotenv";

configDotenv({ quiet: true });

import { DB } from "./database/lmdb.js";

import memopoolRoutes from "./rpc/routes/memopool.js";
import metadataRoutes from "./rpc/routes/metadata.js";

export const app = new fastify({ logger: false });
export const web3 = new Web3();

export const port = process.env.PORT || 3000
export const host = '0.0.0.0'

export const dbpath = process.env.SYNCNETWORK_DB;
export const cardianal = new DB(dbpath);

app.decorate('cardianal', cardianal);

app.get('/', async (request, reply) => {
    return { basekey: cardianal.basekey, status: true };
});

app.register(metadataRoutes, { prefix: '/api/v1' });
app.register(memopoolRoutes, { prefix: '/memopool' });

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