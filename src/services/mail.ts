import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

export const sendVerificationEmail = async (email: string, username: string, token: string, host: string, protocol: string): Promise<void> => {
  // Use frontend URL if configured, otherwise fallback to request headers
  const clientUrl = process.env.CLIENT_URL || `${protocol}://${host}`;
  const verificationUrl = `${clientUrl}/verify-email?token=${token}`;

  const mailOptions = {
    to: email,
    from: `"DIARY-WEB-APP" <${process.env.EMAIL_USER}>`,
    subject: '🔐 Verify Your Email for Diary',
    html: `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        body {
          font-family: 'Inter', sans-serif;
          background-color: #f8fafc;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 600px;
          margin: 20px auto;
          background: white;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
        }
        .header {
          background: linear-gradient(135deg, #4f46e5, #06b6d4);
          padding: 30px;
          text-align: center;
          color: white;
        }
        .header h1 {
          margin: 0;
          font-size: 24px;
          font-weight: 700;
        }
        .content {
          padding: 40px 30px;
          color: #334155;
          line-height: 1.6;
        }
        .button-container {
          text-align: center;
          margin: 30px 0;
        }
        .btn {
          display: inline-block;
          padding: 12px 24px;
          background-color: #4f46e5;
          color: white !important;
          text-decoration: none;
          font-weight: 600;
          border-radius: 6px;
          box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2);
        }
        .url-box {
          background-color: #f1f5f9;
          padding: 15px;
          border-radius: 6px;
          word-break: break-all;
          font-family: monospace;
          font-size: 14px;
          color: #64748b;
        }
        .footer {
          background-color: #f8fafc;
          padding: 20px;
          text-align: center;
          font-size: 12px;
          color: #94a3b8;
          border-top: 1px solid #e2e8f0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Verify Your Email</h1>
        </div>
        <div class="content">
          <p>Hi <strong>${username}</strong>,</p>
          <p>Welcome to Diary! We are excited to have you join our community of storytellers. Please verify your email address to active your account.</p>
          <div class="button-container">
            <a href="${verificationUrl}" class="btn">Verify Account</a>
          </div>
          <p>If the button doesn't work, copy and paste the following link in your browser:</p>
          <div class="url-box">
            ${verificationUrl}
          </div>
          <p>This verification link will expire in 24 hours.</p>
        </div>
        <div class="footer">
          © ${new Date().getFullYear()} Diary. All rights reserved.
        </div>
      </div>
    </body>
    </html>
    `
  };

  await transporter.sendMail(mailOptions);
};

export const sendResetPasswordEmail = async (email: string, username: string, token: string, host: string, protocol: string): Promise<void> => {
  const clientUrl = process.env.CLIENT_URL || `${protocol}://${host}`;
  const resetUrl = `${clientUrl}/reset-password/${token}`;

  const mailOptions = {
    to: email,
    from: `"DIARY-WEB-APP" <${process.env.EMAIL_USER}>`,
    subject: '✍️ Reset your Diary password',
    html: `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Merriweather:wght@400;700&family=Open+Sans:wght@400;600&display=swap');
        body { font-family: 'Open Sans', sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 0; }
        .container { padding: 30px; }
        .header { text-align: center; margin-bottom: 25px; }
        .logo { 
          font-family: 'Merriweather', serif;
          font-size: 28px; 
          font-weight: 700; 
          color: #2d3748; 
          margin-bottom: 5px;
        }
        .tagline {
          color: #718096;
          font-style: italic;
          margin-bottom: 20px;
        }
        .divider {
          height: 3px;
          background: linear-gradient(90deg, #f6ad55, #f687b3, #805ad5);
          margin: 25px 0;
          border-radius: 3px;
        }
        .button { 
          display: inline-block; 
          background: linear-gradient(135deg, #805ad5, #d53f8c); 
          color: white !important; 
          padding: 14px 28px; 
          text-decoration: none; 
          border-radius: 8px; 
          font-weight: 600; 
          margin: 25px 0;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .url-container {
          background-color: #f8fafc;
          border-left: 4px solid #805ad5;
          padding: 15px;
          border-radius: 0 4px 4px 0;
          margin: 20px 0;
        }
        .url {
          word-break: break-all;
          font-family: monospace;
          color: #4a5568;
        }
        .footer { 
          margin-top: 40px; 
          padding-top: 20px; 
          border-top: 1px solid #edf2f7; 
          font-size: 13px; 
          color: #718096; 
          text-align: center;
        }
        .username {
          font-weight: 600;
          color: #2d3748;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">Diary</div>
          <div class="tagline">Where your stories come to life</div>
          <div class="divider"></div>
        </div>

        <p>Hi <span class="username">${username}</span>,</p>
        
        <p>We received a request to reset your Diary password. Don't worry - every great story needs the right key to continue!</p>
        
        <div style="text-align: center;">
          <a href="${resetUrl}" class="button">Continue Your Story →</a>
        </div>
        
        <p>If the button doesn't work, copy and paste this link into your browser:</p>
        
        <div class="url-container">
          <code class="url">${resetUrl}</code>
        </div>
        
        <p><strong>Note:</strong> This link will expire in 1 hour for your security.</p>
        <p>If you didn't request this, you can safely ignore this email - your story remains unchanged.</p>
        
        <div class="footer">
          <p>© ${new Date().getFullYear()} Diary. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
    `
  };

  await transporter.sendMail(mailOptions);
};

export const sendPasswordConfirmationEmail = async (email: string, username: string): Promise<void> => {
  const mailOptions = {
    to: email,
    from: `"DIARY-WEB-APP" <${process.env.EMAIL_USER}>`,
    subject: 'Your Diary password has been updated',
    html: `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #10b981; color: white; padding: 15px; text-align: center; border-radius: 6px 6px 0 0; }
        .content { border: 1px solid #e5e7eb; border-top: none; padding: 20px; border-radius: 0 0 6px 6px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h2>Password Updated Successfully</h2>
      </div>
      <div class="content">
        <p>Hi <strong>${username}</strong>,</p>
        <p>This is a confirmation that the password for your Diary account has been successfully updated.</p>
        <p>If you did not perform this action, please contact our support team immediately.</p>
        <p>Happy writing!</p>
      </div>
    </body>
    </html>
    `
  };

  await transporter.sendMail(mailOptions);
};
