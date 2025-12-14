import express from "express";

const app = express();
app.use(express.json());

app.post("/service-api", async (req, res) => {
    const { error } = req.body ?? {};

    // Si se solicita un error (para testing)
    if (error === true) {
        return res.status(500).json({
            level: 2,
            ok: false,
            message: "Nivel 2: Operación limitada"
        });
    }

    // Respuesta exitosa con funcionalidad degradada
    return res.status(200).json({
        level: 2,
        ok: true,
        message: "Nivel 2: OK"
    });
});

app.get("/health", (_, res) => {
    res.status(200).json({
        status: "degraded",
        service: "service-degraded",
        level: 2,
        uptime: process.uptime()
    });
});

const port = process.env.PORT ?? 8082;
app.listen(port, () => {
    console.log(`Level: 2 (DEGRADED SERVICE)`);
});
