export class ServiceLevelController {
    constructor({
                    windowTimeMs = 60000  // Ventana de 1 minuto
                } = {}) {
        this.windowTimeMs = windowTimeMs;
        this.level = 1;

        // Array de timestamps de errores: [timestamp1, timestamp2, ...]
        this.errorTimestamps = [];

        // Umbrales de ERRORES ABSOLUTOS por minuto
        this.ERRORS_TO_LEVEL_2 = 5;   // 5+ errores → Nivel 2
        this.ERRORS_TO_LEVEL_3 = 10;  // 10+ errores → Nivel 3

        // Para recuperación, esperamos indicadores saludables
        // "Saludable" = menos errores que el umbral de degradación
        this.ERRORS_RECOVER_TO_LEVEL_2 = 10; // < 10 errores para 3→2
        this.ERRORS_RECOVER_TO_LEVEL_1 = 5;  // < 5 errores para 2→1

        // Tiempo mínimo entre transiciones (estabilidad)
        this.lastTransitionTime = Date.now();
        this.minTransitionInterval = 5000; // 5 segundos

        // Contador de evaluaciones consecutivas para estabilidad
        this.consecutiveEvaluations = {
            shouldDegradeToLevel2: 0,
            shouldDegradeToLevel3: 0,
            shouldRecoverToLevel2: 0,
            shouldRecoverToLevel1: 0
        };
        this.requiredConsecutive = 2; // Requiere 2 evaluaciones consecutivas
    }

    currentLevel() {
        return this.level;
    }

    recordOutcome({ success }) {
        const now = Date.now();

        // Si es un error, agregar timestamp
        if (!success) {
            this.errorTimestamps.push(now);
        }

        // Limpiar errores fuera de la ventana de tiempo
        this._cleanOldErrors(now);

        // Contar errores en la última ventana
        const errorCount = this.errorTimestamps.length;
        const prev = this.level;

        // Evaluar si debe cambiar de nivel
        this._evaluateTransition(errorCount, now);

        return {
            prev,
            next: this.level,
            errorCount
        };
    }

    _cleanOldErrors(now) {
        // Remover errores más antiguos que la ventana de tiempo
        const cutoff = now - this.windowTimeMs;
        this.errorTimestamps = this.errorTimestamps.filter(ts => ts > cutoff);
    }

    _evaluateTransition(errorCount, now) {
        // No hacer transiciones muy frecuentes
        if (now - this.lastTransitionTime < this.minTransitionInterval) {
            return;
        }

        let shouldTransition = false;
        let targetLevel = this.level;

        // NIVEL 1 → Evaluar degradación
        if (this.level === 1) {
            if (errorCount >= this.ERRORS_TO_LEVEL_2) {
                this.consecutiveEvaluations.shouldDegradeToLevel2++;

                if (this.consecutiveEvaluations.shouldDegradeToLevel2 >= this.requiredConsecutive) {
                    shouldTransition = true;
                    targetLevel = 2;
                }
            } else {
                this.consecutiveEvaluations.shouldDegradeToLevel2 = 0;
            }
        }

        // NIVEL 2 → Evaluar degradación o recuperación
        else if (this.level === 2) {
            // Degradar a nivel 3
            if (errorCount >= this.ERRORS_TO_LEVEL_3) {
                this.consecutiveEvaluations.shouldDegradeToLevel3++;
                this.consecutiveEvaluations.shouldRecoverToLevel1 = 0;

                if (this.consecutiveEvaluations.shouldDegradeToLevel3 >= this.requiredConsecutive) {
                    shouldTransition = true;
                    targetLevel = 3;
                }
            }
            // Recuperar a nivel 1
            else if (errorCount < this.ERRORS_RECOVER_TO_LEVEL_1) {
                this.consecutiveEvaluations.shouldRecoverToLevel1++;
                this.consecutiveEvaluations.shouldDegradeToLevel3 = 0;

                if (this.consecutiveEvaluations.shouldRecoverToLevel1 >= this.requiredConsecutive) {
                    shouldTransition = true;
                    targetLevel = 1;
                }
            }
            // Zona intermedia: mantener nivel 2
            else {
                this._resetCounters();
            }
        }

        // NIVEL 3 → Evaluar recuperación
        else if (this.level === 3) {
            if (errorCount < this.ERRORS_RECOVER_TO_LEVEL_2) {
                this.consecutiveEvaluations.shouldRecoverToLevel2++;

                if (this.consecutiveEvaluations.shouldRecoverToLevel2 >= this.requiredConsecutive) {
                    shouldTransition = true;
                    targetLevel = 2;
                }
            } else {
                this.consecutiveEvaluations.shouldRecoverToLevel2 = 0;
            }
        }

        // Aplicar transición
        if (shouldTransition && targetLevel !== this.level) {
            this.level = targetLevel;
            this.lastTransitionTime = now;
            this._resetCounters();
        }
    }

    _resetCounters() {
        this.consecutiveEvaluations = {
            shouldDegradeToLevel2: 0,
            shouldDegradeToLevel3: 0,
            shouldRecoverToLevel2: 0,
            shouldRecoverToLevel1: 0
        };
    }

    getStats() {
        const now = Date.now();
        this._cleanOldErrors(now);

        return {
            level: this.level,
            errorCountLastMinute: this.errorTimestamps.length,
            windowTimeMs: this.windowTimeMs,
            thresholds: {
                toLevel2: `${this.ERRORS_TO_LEVEL_2}+ errors/min`,
                toLevel3: `${this.ERRORS_TO_LEVEL_3}+ errors/min`,
                recoverToLevel2: `< ${this.ERRORS_RECOVER_TO_LEVEL_2} errors/min`,
                recoverToLevel1: `< ${this.ERRORS_RECOVER_TO_LEVEL_1} errors/min`
            },
            consecutiveEvaluations: this.consecutiveEvaluations,
            lastTransitionTime: new Date(this.lastTransitionTime).toISOString()
        };
    }
}
