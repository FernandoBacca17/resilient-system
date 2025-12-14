import express from "express";

const app = express();
app.use(express.json());

app.post("/service-api", async (req, res) => {
    const { error } = req.body ?? {};

    if (error === true) {
        return res.status(503).json({
            level: 3,
            ok: false,
            message: "Nivel 3: Sistema bajo mantenimiento, intente más tarde"
        });
    }

    return res.status(200).json({
        level: 3,
        ok: true,
        message: "Nivel 3: Operación al mínimo"
    });
});

app.get("/health", (_, res) => {
    res.status(200).json({
        status: "minimum",
        service: "service-minimum",
        level: 3,
        uptime: process.uptime(),
    });
});

const port = process.env.PORT ?? 8083;
app.listen(port, () => {
    console.log(`Level: 3 (MINIMUM OPERATION)`);
});
