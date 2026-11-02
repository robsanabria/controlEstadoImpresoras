#!/usr/bin/env node
/**
 * Resumen diario a día vencido. Corre una vez y termina: está pensado para que
 * lo dispare un cron (WebJob del App Service, GitHub Actions o Logic App).
 *
 *   npm run resumen                  # mira ayer y avisa si hubo menos del mínimo
 *   npm run resumen -- 2026-11-01    # un día puntual (para probar o recuperar)
 *   npm run resumen -- --forzar      # manda el correo aunque el día esté OK
 *
 * Sale con 0 siempre que haya podido calcular el resumen, haya avisado o no.
 * Si falla la base o el envío, sale con 1 para que el cron lo marque en rojo.
 */
require('dotenv').config();

const { resumenDe, ayer, DESTINATARIOS } = require('../services/resumenDiario');
const { enviar } = require('../services/mailer');

(async () => {
  const args = process.argv.slice(2);
  const forzar = args.includes('--forzar');
  const fecha = args.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a)) || ayer();

  try {
    const r = await resumenDe(fecha);
    console.log(`[Resumen ${r.fecha}] ${r.total} verificaciones (mínimo ${r.minimo}).`);

    if (!r.hayQueAvisar && !forzar) {
      console.log('[Resumen] El día está OK: no se manda correo.');
      process.exit(0);
    }

    const { enviado, motivo } = await enviar({
      para: DESTINATARIOS,
      asunto: r.asunto,
      texto: r.texto,
    });

    if (!enviado) {
      console.error(`[Resumen] No se pudo enviar el aviso: ${motivo}.`);
      process.exit(1);
    }
    process.exit(0);
  } catch (err) {
    console.error('[Resumen] Falló:', err.message);
    process.exit(1);
  }
})();
