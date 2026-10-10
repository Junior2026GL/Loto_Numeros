import nodemailer from 'nodemailer';
import { env } from '../../config/env.js';

let transporter = null;

export function isMailConfigured() {
  return Boolean(env.mail.host);
}

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.mail.host,
      port: env.mail.port,
      secure: env.mail.secure,
      auth: env.mail.user ? { user: env.mail.user, pass: env.mail.pass } : undefined,
    });
  }
  return transporter;
}

export async function sendMail({ to, subject, text }) {
  if (!isMailConfigured()) throw new Error('El correo saliente no está configurado (falta SMTP_HOST)');
  await getTransporter().sendMail({ from: env.mail.from, to, subject, text });
}
