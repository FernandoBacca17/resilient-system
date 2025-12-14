import express from "express";

const app = express();
app.use(express.json());

app.post("/service-api", async (req, res) => {
    const { error } = req.body ?? {};

    // Si se solicita un error (para testing)
    if (error === true) {
        return res.status(500).json({
            level: 1,
            ok: false,
            message: "Nivel 1: Operación full con error"
        });
    }

    // Respuesta exitosa con datos completos
    return res.status(200).json({
        level: 1,
        ok: true,
        message: 'Nivel 1: OK',
    });
});

app.get("/health", (_, res) => {
    res.status(200).json({
        status: "ok",
        service: "service-full",
        level: 1,
        uptime: process.uptime()
    });
});

const port = process.env.PORT ?? 8081;
app.listen(port, () => {
    console.log(`   Level: 1 (FULL SERVICE)`);
});
