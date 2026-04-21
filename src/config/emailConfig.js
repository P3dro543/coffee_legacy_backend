const nodemailer = require('nodemailer');

// Configuración para Gmail
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,     // Tu email de Gmail
        pass: process.env.EMAIL_PASSWORD  // Contraseña de aplicación de Gmail
    }
});

// Función para enviar email de verificación
const enviarEmailVerificacion = async (email, nombre, token) => {
    const urlVerificacion = `http://localhost:3000/api/auth/verificar-email/${token}`;

    const mailOptions = {
        from: `"Romero Café Legacy" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: '✅ Verifica tu cuenta - Romero Café Legacy',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #6F4E37 0%, #8B6F47 100%); padding: 30px; text-align: center;">
                    <h1 style="color: white; margin: 0;">☕ Romero Café Legacy</h1>
                </div>
                
                <div style="padding: 30px; background-color: #f9f9f9;">
                    <h2 style="color: #6F4E37;">¡Hola ${nombre}!</h2>
                    
                    <p style="font-size: 16px; line-height: 1.6;">
                        Gracias por registrarte en Romero Café Legacy. 
                        Para completar tu registro, por favor verifica tu correo electrónico haciendo clic en el botón de abajo:
                    </p>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${urlVerificacion}" 
                           style="background-color: #6F4E37; 
                                  color: white; 
                                  padding: 15px 40px; 
                                  text-decoration: none; 
                                  border-radius: 5px; 
                                  font-size: 16px;
                                  display: inline-block;">
                            Verificar mi cuenta
                        </a>
                    </div>
                    
                    <p style="font-size: 14px; color: #666;">
                        Si el botón no funciona, copia y pega este enlace en tu navegador:
                    </p>
                    <p style="font-size: 12px; color: #999; word-break: break-all;">
                        ${urlVerificacion}
                    </p>
                    
                    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                    
                    <p style="font-size: 12px; color: #999;">
                        Este enlace expirará en 24 horas.
                        Si no solicitaste este registro, puedes ignorar este correo.
                    </p>
                </div>
                
                <div style="background-color: #333; color: white; padding: 20px; text-align: center; font-size: 12px;">
                    <p style="margin: 0;">© 2024 Romero Café Legacy - Santa María de Dota, Costa Rica</p>
                </div>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('✅ Email de verificación enviado a:', email);
        return true;
    } catch (error) {
        console.error('❌ Error al enviar email:', error);
        return false;
    }
};

// Función para enviar email de recuperación
const enviarEmailRecuperacion = async (email, nombre, token) => {
    const urlRecuperacion = `http://localhost:3000/api/auth/reset-password/${token}`;

    const mailOptions = {
        from: `"Romero Café Legacy" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: '🔑 Recuperación de contraseña - Romero Café Legacy',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #6F4E37 0%, #8B6F47 100%); padding: 30px; text-align: center;">
                    <h1 style="color: white; margin: 0;">☕ Romero Café Legacy</h1>
                </div>
                
                <div style="padding: 30px; background-color: #f9f9f9;">
                    <h2 style="color: #6F4E37;">Recuperación de contraseña</h2>
                    
                    <p style="font-size: 16px; line-height: 1.6;">
                        Hola ${nombre},
                    </p>
                    
                    <p style="font-size: 16px; line-height: 1.6;">
                        Recibimos una solicitud para restablecer tu contraseña. 
                        Si fuiste tú, haz clic en el botón de abajo:
                    </p>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${urlRecuperacion}" 
                           style="background-color: #6F4E37; 
                                  color: white; 
                                  padding: 15px 40px; 
                                  text-decoration: none; 
                                  border-radius: 5px; 
                                  font-size: 16px;
                                  display: inline-block;">
                            Restablecer contraseña
                        </a>
                    </div>
                    
                    <p style="font-size: 14px; color: #666;">
                        Si el botón no funciona, copia y pega este enlace:
                    </p>
                    <p style="font-size: 12px; color: #999; word-break: break-all;">
                        ${urlRecuperacion}
                    </p>
                    
                    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                    
                    <p style="font-size: 12px; color: #999;">
                        Este enlace expirará en 1 hora.
                        Si no solicitaste restablecer tu contraseña, ignora este correo.
                    </p>
                </div>
                
                <div style="background-color: #333; color: white; padding: 20px; text-align: center; font-size: 12px;">
                    <p style="margin: 0;">© 2024 Romero Café Legacy - Santa María de Dota, Costa Rica</p>
                </div>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('✅ Email de recuperación enviado a:', email);
        return true;
    } catch (error) {
        console.error('❌ Error al enviar email:', error);
        return false;
    }
};

module.exports = {
    enviarEmailVerificacion,
    enviarEmailRecuperacion
};