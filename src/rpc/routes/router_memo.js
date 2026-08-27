// api version: 1

import { isAllowAPIKey } from "../safeguard/guard_key.js";

let pendingTx = [];

export default async function router_memo(app, options) {

    app.get('/pending', async (request, reply) => {
        return pendingTx;
    });

    app.post('/push', async (request, reply) => {
        try {
            const apiKey = request.headers['x-api-key'];
            await isAllowAPIKey(apiKey);

            const { from, to, data } = request.body;

            const indexed = pendingTx.length;
            const tx = { indexed, from, to, data }

            pendingTx.push(tx);

            return { success: true, tx };
        } catch (error) {
            return { success: false, error }
        }
    });
}