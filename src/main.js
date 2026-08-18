import fastify from "fastify";

import serverRoutes from "./rpc/routes/server.js";

const app = new fastify({ logger: false });

const port = process.env.PORT || 3000
const host = '0.0.0.0'

app.register(serverRoutes, { prefix: '/' });

const start = async () => {
  try {
    await app.listen({ port, host })
    console.log(`🚀 WebSocket API running on port ${port}`);
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}
start()