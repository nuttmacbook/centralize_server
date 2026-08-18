export default async function serverRoutes(app, options) {
    app.get('/', async (request, reply) => {
        return { online: true }
    });
}