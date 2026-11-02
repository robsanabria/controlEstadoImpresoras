/**
 * Envío de correo del módulo.
 *
 * Hoy sale por SMTP (nodemailer). Si no hay servidor configurado, NO falla:
 * escribe el correo en el log y avisa que no se envió, para que el resumen
 * diario se pueda probar antes de que Infra habilite la casilla.
 *
 * Si mañana la casa estandariza Microsoft Graph (sendMail), se cambia sólo este
 * archivo: el resto del módulo llama a enviar() y no sabe cómo viaja.
 */
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const REMITENTE = process.env.MAIL_REMITENTE || SMTP_USER;

const haySMTP = !!(SMTP_HOST && SMTP_USER && SMTP_PASS && REMITENTE);

/**
 * @param {{para: string[], asunto: string, texto: string}} mail
 * @returns {Promise<{enviado: boolean, motivo?: string}>}
 */
async function enviar({ para, asunto, texto }) {
  if (!para?.length) return { enviado: false, motivo: 'sin destinatarios' };

  if (!haySMTP) {
    console.warn(
      `[Mail] SMTP no configurado: el correo NO se envió.\n` +
        `  Para: ${para.join(', ')}\n  Asunto: ${asunto}\n${texto}`
    );
    return { enviado: false, motivo: 'SMTP no configurado' };
  }

  // Se carga acá adentro para que el módulo arranque aunque no esté instalado.
  const nodemailer = require('nodemailer');
  const transporte = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  await transporte.sendMail({ from: REMITENTE, to: para.join(', '), subject: asunto, text: texto });
  console.log(`[Mail] Enviado a ${para.join(', ')}: ${asunto}`);
  return { enviado: true };
}

module.exports = { enviar, haySMTP };
