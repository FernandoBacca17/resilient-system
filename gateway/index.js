import express from "express";
import { ServiceLevelController } from "./levelController.js";
import { proxyPostJson } from "./proxy.js";
import { register, httpRequests, levelTransitions, setLevelGauge, errorCountGauge } from "./metrics.js";

const app = express();
app.use(express.json());

// Crear controlador con ventana de 1 minuto
const slc = new ServiceLevelController({ windowTimeMs: 60000 });

// URLs internas
const LEVEL_URL = {
    1: process.env.URL_L1 ?? "http://service-full:8080/service-api",
    2: process.env.URL_L2 ?? "http://service-degraded:8080/service-api",
    3: process.env.URL_L3 ?? "http://service-minimum:8080/service-api",
};

setLevelGauge(slc.currentLevel());

// Endpoint de métricas Prometheus
app.get("/metrics", async (_, res) => {
    res.set("Content-Type", register.contentType);
    res.send(await register.metrics());
});

// Endpoint de salud con información detallada
app.get("/health", (_, res) => {
    const stats = slc.getStats();
    res.json({
        status: "ok",
        ...stats,
        timestamp: new Date().toISOString()
    });
});

// Endpoint principal del servicio
app.post("/service-api", async (req, res) => {
    const body = req.body ?? {};
    const level = slc.currentLevel();

    let upstream;
    let success = false;

    try {
        upstream = await proxyPostJson({
            url: LEVEL_URL[level],
            body,
            timeoutMs: 2000
        });

        // Éxito = status < 500
        success = upstream.status < 500;

        // Nivel 1 y 2: passthrough de la respuesta del servicio
        httpRequests.inc({
            level: String(level),
            outcome: success ? "success" : "error"
        }, 1);

        const change = slc.recordOutcome({ success });
        trackTransitions(change);

        return res.status(upstream.status).send(upstream.text);

    } catch (e) {
        // Error de conexión o timeout
        httpRequests.inc({ level: String(level), outcome: "error" }, 1);
        const change = slc.recordOutcome({ success: false });
        trackTransitions(change);

        if (level === 3) {
            return res.status(503).send("Nivel 3: Sistema bajo mantenimiento, intente más tarde");
        }

        return res.status(502).json({
            message: "upstream_error",
            error: e.message
        });
    }
});

function trackTransitions({ prev, next, errorCount }) {
    // Actualizar gauge del nivel actual
    setLevelGauge(next);

    // Actualizar gauge de conteo de errores
    errorCountGauge.set(errorCount);

    // Si hubo cambio de nivel, registrar transición
    if (prev !== next) {
        levelTransitions.inc({ from: String(prev), to: String(next) }, 1);

        const transitionType = next > prev ? "DEGRADATION" : "RECOVERY";

        console.log(JSON.stringify({
            transition: transitionType,
            from: prev,
            to: next,
            errorCount,
            timestamp: new Date().toISOString(),
            message: getTransitionMessage(prev, next, errorCount)
        }));
    }
}

function getTransitionMessage(from, to, errorCount) {
    if (from === 1 && to === 2) {
        return `Degradación a Nivel 2: detectados ${errorCount} errores en el último minuto`;
    }
    if (from === 2 && to === 3) {
        return `Degradación a Nivel 3: detectados ${errorCount} errores en el último minuto`;
    }
    if (from === 3 && to === 2) {
        return `Recuperación a Nivel 2: ${errorCount} errores en el último minuto`;
    }
    if (from === 2 && to === 1) {
        return `Recuperación a Nivel 1: ${errorCount} errores en el último minuto`;
    }
    return `Transición ${from} → ${to}`;
}

const port = process.env.PORT ?? 3000;
app.listen(port, () => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🚀 Gateway API ejecutándose en puerto ${port}`);
    console.log(`${'='.repeat(60)}`);
    console.log(`📊 Health:   http://localhost:${port}/health`);
    console.log(`📈 Metrics:  http://localhost:${port}/metrics`);
    console.log(`${'='.repeat(60)}`);
    console.log(`\n📋 Umbrales configurados:`);
    console.log(`   • 5+ errores/min  → Nivel 2 (Degradado)`);
    console.log(`   • 10+ errores/min → Nivel 3 (Mantenimiento)`);
    console.log(`   • < 5 errores/min → Recuperar a Nivel 1`);
    console.log(`   • < 10 errores/min → Recuperar a Nivel 2`);
    console.log(`${'='.repeat(60)}\n`);
});
