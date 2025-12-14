import client from "prom-client";

export const register = new client.Registry();
client.collectDefaultMetrics({ register });

// Contador total de requests HTTP
export const httpRequests = new client.Counter({
    name: "http_requests_total",
    help: "Total de requests HTTP procesadas",
    labelNames: ["level", "outcome"],
});

// Gauge del nivel actual de servicio
export const levelGauge = new client.Gauge({
    name: "service_level_current",
    help: "Nivel de servicio actual (1=Full, 2=Degraded, 3=Minimum)",
    labelNames: ["level"],
});

// Contador de transiciones entre niveles
export const levelTransitions = new client.Counter({
    name: "service_level_transitions_total",
    help: "Total de transiciones entre niveles de servicio",
    labelNames: ["from", "to"],
});

// Gauge de conteo de errores en la última ventana
export const errorCountGauge = new client.Gauge({
    name: "error_count_last_window",
    help: "Cantidad de errores en la última ventana de tiempo (1 minuto)",
});

// Registrar todas las métricas
register.registerMetric(httpRequests);
register.registerMetric(levelGauge);
register.registerMetric(levelTransitions);
register.registerMetric(errorCountGauge);

export function setLevelGauge(level) {
    levelGauge.reset();
    levelGauge.set({ level: String(level) }, 1);
}
