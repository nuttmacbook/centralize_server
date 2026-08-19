import { decodeTxInput } from "../safeguard/decodeTxInput.js";

export default async function metadataRoutes(app, options) {
    app.get('/', async (request, reply) => {
        return { online: true }
    });
}