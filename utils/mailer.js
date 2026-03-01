const nodemailer = require("nodemailer");

// Create reusable transporter object using the default SMTP transport
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: process.env.SMTP_PORT || 587,
  secure: process.env.SMTP_PORT == 465, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  // Require valid TLS certificates for security
  tls: {
    rejectUnauthorized: true
  }
});

/**
 * Sends an OTP email to the specified address.
 * @param {string} toEmail - The recipient's email address.
 * @param {string} otpCode - The 6-digit OTP code to send.
 * @param {string} [userName] - The recipient's name (optional).
 */
const sendOTPEmail = async (toEmail, otpCode, userName = "") => {
  try {
    // Se não houver configuração de email real, não tenta enviar para evitar timeouts longos em ambiente de dev

    const htmlContent = `
      <div style="font-family: 'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f6f8; padding: 40px 20px; text-align: center;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
          
          <!-- Header -->
          <div style="background-color: #1a1a1a; padding: 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: 1px;">Move<span style="color: #f39c12;">Plus</span></h1>
          </div>
          
          <!-- Body -->
          <div style="padding: 40px 30px; text-align: left;">
            <h2 style="color: #333333; font-size: 22px; margin-top: 0; margin-bottom: 20px;">Verificação de Conta</h2>
            <p style="color: #555555; font-size: 16px; line-height: 1.6; margin: 0;">
              Olá${userName ? ' ' + userName.split(' ')[0] : ''},<br><br>
              Obrigado por te juntares à <strong>Move Plus</strong>! Para garantir a segurança da tua conta e concluir o registo, por favor utiliza o código de verificação abaixo:
            </p>
            
            <div style="margin: 35px 0; text-align: center; background-color: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 20px;">
              <span style="display: inline-block; font-size: 32px; font-weight: 800; color: #1a1a1a; letter-spacing: 8px; margin-left: 8px;">
                ${otpCode}
              </span>
            </div>
            
            <p style="color: #666666; font-size: 14px; margin-bottom: 25px;">
              Este código é válido por <strong>15 minutos</strong>. Por questões de segurança, não o partilhes com ninguém.
            </p>
            
            <p style="color: #888888; font-size: 14px; margin: 0;">
              Se não solicitaste esta verificação, podes ignorar com segurança este email.
            </p>
          </div>
          
          <!-- Footer -->
          <div style="background-color: #fafbfc; padding: 20px; border-top: 1px solid #eeeeee; text-align: center;">
            <p style="color: #999999; font-size: 12px; margin: 0;">
              &copy; ${new Date().getFullYear()} Move Plus. Todos os direitos reservados.
            </p>
            <p style="color: #aaaaaa; font-size: 12px; margin: 5px 0 0 0;">
              A tua loja online de confiança.
            </p>
          </div>
          
        </div>
      </div>
    `;

    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || '"Move Plus" <noreply@moveplus.ao>',
      to: toEmail,
      subject: "Código de Verificação da Conta - Move Plus",
      html: htmlContent,
    });

    console.log("Email enviado: %s", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Erro ao enviar email OTP:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Sends a password reset OTP email to the specified address.
 * @param {string} toEmail - The recipient's email address.
 * @param {string} otpCode - The 6-digit OTP code to send.
 * @param {string} [userName] - The recipient's name (optional).
 */
const sendPasswordResetOTPEmail = async (toEmail, otpCode, userName = "") => {
  try {
    const htmlContent = `
      <div style="font-family: 'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f6f8; padding: 40px 20px; text-align: center;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
          
          <!-- Header -->
          <div style="background-color: #1a1a1a; padding: 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: 1px;">Move<span style="color: #f39c12;">Plus</span></h1>
          </div>
          
          <!-- Body -->
          <div style="padding: 40px 30px; text-align: left;">
            <h2 style="color: #333333; font-size: 22px; margin-top: 0; margin-bottom: 20px;">Recuperação de Senha</h2>
            <p style="color: #555555; font-size: 16px; line-height: 1.6; margin: 0;">
              Olá${userName ? ' ' + userName.split(' ')[0] : ''},<br><br>
              Recebemos um pedido para repor a tua palavra-passe. Por favor, utiliza o código de verificação abaixo para concluir o processo:
            </p>
            
            <div style="margin: 35px 0; text-align: center; background-color: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 20px;">
              <span style="display: inline-block; font-size: 32px; font-weight: 800; color: #1a1a1a; letter-spacing: 8px; margin-left: 8px;">
                ${otpCode}
              </span>
            </div>
            
            <p style="color: #666666; font-size: 14px; margin-bottom: 25px;">
              Este código é válido por <strong>15 minutos</strong>. Não o partilhes com ninguém.
            </p>
            
            <p style="color: #888888; font-size: 14px; margin: 0;">
              Se não solicitaste esta alteração, podes ignorar este email com segurança. A tua palavra-passe permanecerá inalterada.
            </p>
          </div>
          
          <!-- Footer -->
          <div style="background-color: #fafbfc; padding: 20px; border-top: 1px solid #eeeeee; text-align: center;">
            <p style="color: #999999; font-size: 12px; margin: 0;">
              &copy; ${new Date().getFullYear()} Move Plus. Todos os direitos reservados.
            </p>
            <p style="color: #aaaaaa; font-size: 12px; margin: 5px 0 0 0;">
              A tua loja online de confiança.
            </p>
          </div>
          
        </div>
      </div>
    `;

    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || '"Move Plus" <noreply@moveplus.ao>',
      to: toEmail,
      subject: "Recuperação de Senha - Move Plus",
      html: htmlContent,
    });

    console.log("Email de recuperação enviado: %s", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Erro ao enviar email de recuperação:", error);
    return { success: false, error: error.message };
  }
};

module.exports = { sendOTPEmail, sendPasswordResetOTPEmail };
