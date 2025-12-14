export async function proxyPostJson({ url, body, timeoutMs = 2000 }) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);

    try {
        const resp = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body ?? {}),
            signal: ctrl.signal,
        });

        const text = await resp.text();
        return { status: resp.status, text };
    } finally {
        clearTimeout(t);
    }
}
