import nodemailer from 'nodemailer';


export const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

transporter.verify((error) => {
  if (error) {
    console.error('[Mail Config] Error connecting to mail server:', error);
  } else {
    console.log('[Mail Config] Mail service is ready');
  }
});