
export async function isAllowAPIKey(key) {
    if (!key) { throw new Error("isAllowAPIKey - Missing API Key!"); }
    return { isAllow: true }
}