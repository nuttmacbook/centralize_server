import { isAllowAPIKey } from "../safeguard/apiKey.js";

let memoTransactions = [];

export default async function memopoolRoutes(app, options) {
    app.get('/pending', async (request, reply) => {
        return memoTransactions;
    });

    app.post('/push', async (request, reply) => {
        try {
            const apiKey = request.headers['x-api-key'];
            await isAllowAPIKey(apiKey);

            const { nonce, from, to, data } = request.body;

            const indexed = memoTransactions.length;
            const tx = { indexed, from, to, data }

            memoTransactions.push(tx);

            return { success: true, tx };
        } catch (error) {
            return { success: false, error }
        }
    });
}