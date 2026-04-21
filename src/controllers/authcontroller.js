const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
require('dotenv').config();

const PasswordValidator = require('../utils/passwordValidator');
const { enviarEmailVerificacion, enviarEmailRecuperacion } = require('../config/emailConfig');

const MAX_INTENTOS = 5;
const BLOQUEO_MINUTOS = 15;


exports.register = async (req, res) => {
    try {
        const {
            nombre,
            correo,
            contraseña,
            telefono,
            idDistrito,
            direccionDetalle,
            numeroIdentificacion,    // ← NUEVO
            tipoIdentificacion,      // ← NUEVO
            nacionalidad             // ← NUEVO
        } = req.body;

        console.log('📝 Registrando usuario:', correo);

        // 1. Validar política de contraseña
        const validacion = PasswordValidator.validate(contraseña);

        if (!validacion.isValid) {
            return res.status(400).json({
                success: false,
                message: 'La contraseña no cumple con las políticas de seguridad',
                errors: validacion.errors
            });
        }

        // 2. Verificar correo único
        const [existeCorreo] = await db.query(
            "SELECT * FROM Usuario WHERE correo = ?",
            [correo]
        );

        if (existeCorreo.length > 0) {
            return res.status(400).json({
                success: false,
                message: "El correo ya está registrado"
            });
        }

        // 3. Verificar número de identificación único (si se proporciona)
        if (numeroIdentificacion) {
            const [existeId] = await db.query(
                "SELECT * FROM Usuario WHERE numeroIdentificacion = ?",
                [numeroIdentificacion]
            );

            if (existeId.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: "El número de identificación ya está registrado"
                });
            }
        }

        // 4. Hashear contraseña
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(contraseña, salt);

        // 5. Calcular fecha de expiración
        const fechaExpiracion = new Date();
        fechaExpiracion.setDate(fechaExpiracion.getDate() + 90);
        const fechaExpiracionStr = fechaExpiracion.toISOString().split('T')[0];

        // 6. Insertar usuario (CON DATOS DE IDENTIDAD)
        const [result] = await db.query(`
            INSERT INTO Usuario 
            (nombre, correo, passwordHash, telefono, idDistrito, direccionDetalle,
             numeroIdentificacion, tipoIdentificacion, nacionalidad,
             fechaExpiracionPassword, diasVigenciaPassword, emailVerificado)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 90, FALSE)
        `, [
            nombre,
            correo,
            hashedPassword,
            telefono || null,
            idDistrito || null,
            direccionDetalle || null,
            numeroIdentificacion || null,    // ← NUEVO
            tipoIdentificacion || 'Cédula',  // ← NUEVO
            nacionalidad || 'Costarricense',  // ← NUEVO
            fechaExpiracionStr
        ]);

        const idUsuario = result.insertId;
        console.log('✅ Usuario creado con ID:', idUsuario);

        // 7. Guardar en historial
        await PasswordValidator.saveToHistory(idUsuario, hashedPassword, db);

        // 8. Generar token de verificación
        const crypto = require('crypto');
        const tokenVerificacion = crypto.randomBytes(32).toString('hex');
        const fechaExpiracionToken = new Date();
        fechaExpiracionToken.setHours(fechaExpiracionToken.getHours() + 24);

        await db.query(`
            INSERT INTO TokensVerificacion (idUsuario, token, tipo, fechaExpiracion)
            VALUES (?, ?, 'verificacion', ?)
        `, [idUsuario, tokenVerificacion, fechaExpiracionToken]);

        // 9. Enviar email de verificación
        const { enviarEmailVerificacion } = require('../config/emailConfig');
        const emailEnviado = await enviarEmailVerificacion(correo, nombre, tokenVerificacion);

        if (!emailEnviado) {
            console.warn('⚠️ No se pudo enviar el email de verificación');
        }

        res.status(201).json({
            success: true,
            message: "Usuario registrado. Revisa tu correo para verificar tu cuenta.",
            data: {
                idUsuario: idUsuario,
                nombre: nombre,
                correo: correo,
                emailVerificado: false
            }
        });

    } catch (error) {
        console.error('❌ Error al registrar:', error);
        res.status(500).json({
            success: false,
            message: "Error del servidor"
        });
    }
};


// =====================================================
// LOGIN
// =====================================================
// =====================================================
// LOGIN
// =====================================================
exports.login = async (req, res) => {
    try {
        const { correo, contrasena } = req.body;
        const correoNorm = correo ? correo.trim().toLowerCase() : null;

        console.log('🔐 Intento de login:', correoNorm);

        if (!correoNorm || !contrasena) {
            return res.status(400).json({
                success: false,
                message: "Correo y contrasena son obligatorios"
            });
        }

        // 1. Buscar usuario
        const [usuarios] = await db.query(
            "SELECT * FROM Usuario WHERE correo = ?",
            [correoNorm]
        );

        if (usuarios.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Credenciales incorrectas"
            });
        }

        const usuario = usuarios[0];

        // 2. Verificar bloqueo por intentos fallidos
        if (usuario.intentosFallidos >= MAX_INTENTOS && usuario.fechaBloqueo) {
            const desbloqueo = new Date(usuario.fechaBloqueo);
            desbloqueo.setMinutes(desbloqueo.getMinutes() + BLOQUEO_MINUTOS);

            if (new Date() < desbloqueo) {
                const minutosRestantes = Math.ceil((desbloqueo - new Date()) / 60000);
                return res.status(429).json({
                    success: false,
                    message: 'Cuenta bloqueada temporalmente. Intenta en ' + minutosRestantes + ' minuto(s).'
                });
            } else {
                await db.query(
                    "UPDATE Usuario SET intentosFallidos = 0, fechaBloqueo = NULL WHERE idUsuario = ?",
                    [usuario.idUsuario]
                );
                usuario.intentosFallidos = 0;
            }
        }

        // 3. Verificar email
        // 3. Verificar email (solo bloquear si explícitamente es 0)
        if (usuario.emailVerificado === 0) {
            return res.status(403).json({
                success: false,
                emailNotVerified: true,
                message: 'Debes verificar tu correo electronico antes de iniciar sesion.'
            });
        }

        // 4. Validar contrasena
        const isMatch = await bcrypt.compare(contrasena, usuario.passwordHash);

        if (!isMatch) {
            const nuevosIntentos = (usuario.intentosFallidos || 0) + 1;

            if (nuevosIntentos >= MAX_INTENTOS) {
                await db.query(
                    "UPDATE Usuario SET intentosFallidos = ?, fechaBloqueo = NOW() WHERE idUsuario = ?",
                    [nuevosIntentos, usuario.idUsuario]
                );
            } else {
                await db.query(
                    "UPDATE Usuario SET intentosFallidos = ? WHERE idUsuario = ?",
                    [nuevosIntentos, usuario.idUsuario]
                );
            }

            return res.status(401).json({
                success: false,
                message: "Credenciales incorrectas"
            });
        }

        // 5. Verificar expiracion de contrasena
        if (new Date() > new Date(usuario.fechaExpiracionPassword)) {
            return res.status(403).json({
                success: false,
                passwordExpired: true,
                message: "Su contrasena ha expirado. Debe cambiarla."
            });
        }

        // 6. Resetear intentos
        await db.query(
            "UPDATE Usuario SET intentosFallidos = 0, fechaBloqueo = NULL WHERE idUsuario = ?",
            [usuario.idUsuario]
        );

        // =================================================
        // 🔐 VERIFICAR SI TIENE 2FA ACTIVADO
        // =================================================
        if (usuario.twoFactorEnabled) {
            console.log('🔐 Usuario tiene 2FA activado');

            return res.json({
                success: true,
                require2FA: true,
                userId: usuario.idUsuario,
                message: 'Ingresa el codigo de Google Authenticator'
            });
        }

        // 7. Generar token si no tiene 2FA
        const token = jwt.sign(
            { idUsuario: usuario.idUsuario },
            process.env.JWT_SECRET,
            { expiresIn: "24h" }
        );

        console.log('✅ Login exitoso:', correoNorm);

        res.json({
            success: true,
            message: "Login exitoso",
            token,
            userId: usuario.idUsuario,
            nombre: usuario.nombre
        });

    } catch (error) {
        console.error('❌ Error en login:', error);
        res.status(500).json({ success: false, message: "Error del servidor" });
    }
};


// =====================================================
// VERIFICAR EMAIL
// =====================================================
exports.verificarEmail = async (req, res) => {
    try {
        const { token } = req.params;

        console.log('📧 Verificando token:', token);

        const [tokens] = await db.query(`
            SELECT * FROM TokensVerificacion
            WHERE token = ?
            AND tipo = 'verificacion'
            AND usado = FALSE
        `, [token]);

        if (tokens.length === 0) {
            return res.status(404).send(`
                <html>
                    <body style="font-family: Arial; text-align: center; padding: 50px;">
                        <h1>Token invalido</h1>
                        <p>El enlace de verificacion no es valido o ya fue usado.</p>
                    </body>
                </html>
            `);
        }

        const tokenData = tokens[0];

        if (new Date() > new Date(tokenData.fechaExpiracion)) {
            return res.status(400).send(`
                <html>
                    <body style="font-family: Arial; text-align: center; padding: 50px;">
                        <h1>Token expirado</h1>
                        <p>El enlace de verificacion ha expirado.</p>
                    </body>
                </html>
            `);
        }

        await db.query(
            "UPDATE Usuario SET emailVerificado = TRUE, fechaVerificacion = NOW() WHERE idUsuario = ?",
            [tokenData.idUsuario]
        );

        await db.query(
            "UPDATE TokensVerificacion SET usado = TRUE WHERE idToken = ?",
            [tokenData.idToken]
        );

        console.log('✅ Email verificado para usuario:', tokenData.idUsuario);

        res.send(`
            <html>
                <body style="font-family: Arial; text-align: center; padding: 50px;">
                    <h1>Email verificado</h1>
                    <p>Tu cuenta ha sido verificada exitosamente.</p>
                    <p>Ya puedes iniciar sesion en la aplicacion.</p>
                </body>
            </html>
        `);

    } catch (error) {
        console.error('❌ Error al verificar email:', error);
        res.status(500).send(`
            <html>
                <body style="font-family: Arial; text-align: center; padding: 50px;">
                    <h1>Error del servidor</h1>
                </body>
            </html>
        `);
    }
};


// =====================================================
// SOLICITAR RECUPERACION
// =====================================================
exports.solicitarRecuperacion = async (req, res) => {
    try {
        const { correo } = req.body;
        const correoNorm = correo ? correo.trim().toLowerCase() : null;

        console.log('🔑 Solicitud de recuperacion para:', correoNorm);

        if (!correoNorm) {
            return res.status(400).json({
                success: false,
                message: 'El correo es obligatorio'
            });
        }

        const [usuarios] = await db.query(
            "SELECT * FROM Usuario WHERE correo = ?",
            [correoNorm]
        );

        if (usuarios.length === 0) {
            console.log('⚠️ Email no existe, pero respondemos exitoso por seguridad');
            return res.json({
                success: true,
                message: 'Si el correo existe, recibiras un email con instrucciones.'
            });
        }

        const usuario = usuarios[0];

        const tokenRecuperacion = crypto.randomBytes(32).toString('hex');
        const fechaExpiracion = new Date();
        fechaExpiracion.setHours(fechaExpiracion.getHours() + 1);

        await db.query(`
            INSERT INTO TokensVerificacion (idUsuario, token, tipo, fechaExpiracion)
            VALUES (?, ?, 'recuperacion', ?)
        `, [usuario.idUsuario, tokenRecuperacion, fechaExpiracion]);

        console.log('🔑 Token de recuperacion generado');

        const emailEnviado = await enviarEmailRecuperacion(
            correoNorm,
            usuario.nombre,
            tokenRecuperacion
        );

        if (!emailEnviado) {
            console.warn('⚠️ No se pudo enviar el email de recuperacion');
        }

        res.json({
            success: true,
            message: 'Si el correo existe, recibiras un email con instrucciones para recuperar tu contrasena.'
        });

    } catch (error) {
        console.error('❌ Error al solicitar recuperacion:', error);
        res.status(500).json({ success: false, message: 'Error del servidor' });
    }
};


// =====================================================
// VERIFICAR TOKEN RECUPERACION (muestra formulario)
// =====================================================
exports.verificarTokenRecuperacion = async (req, res) => {
    try {
        const { token } = req.params;

        console.log('🔍 Verificando token de recuperacion:', token);

        const [tokens] = await db.query(`
            SELECT * FROM TokensVerificacion
            WHERE token = ?
            AND tipo = 'recuperacion'
            AND usado = FALSE
        `, [token]);

        if (tokens.length === 0) {
            return res.status(404).send(`
                <html>
                    <body style="font-family: Arial; text-align: center; padding: 50px;">
                        <h1>Token invalido</h1>
                        <p>El enlace de recuperacion no es valido o ya fue usado.</p>
                    </body>
                </html>
            `);
        }

        const tokenData = tokens[0];

        if (new Date() > new Date(tokenData.fechaExpiracion)) {
            return res.status(400).send(`
                <html>
                    <body style="font-family: Arial; text-align: center; padding: 50px;">
                        <h1>Token expirado</h1>
                        <p>El enlace ha expirado. Solicita uno nuevo.</p>
                    </body>
                </html>
            `);
        }

        res.send(`
            <html>
                <head>
                    <meta charset="UTF-8">
                    <title>Restablecer contrasena</title>
                    <style>
                        * { margin: 0; padding: 0; box-sizing: border-box; }
                        body {
                            font-family: Arial, sans-serif;
                            background: linear-gradient(135deg, #6F4E37 0%, #8B6F47 100%);
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            min-height: 100vh;
                            padding: 20px;
                        }
                        .container {
                            background: white;
                            border-radius: 12px;
                            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
                            padding: 40px;
                            max-width: 500px;
                            width: 100%;
                        }
                        h1 { color: #6F4E37; margin-bottom: 10px; font-size: 28px; }
                        .subtitle { color: #666; margin-bottom: 30px; font-size: 14px; }
                        .form-group { margin-bottom: 20px; }
                        label { display: block; color: #333; font-weight: 600; margin-bottom: 8px; font-size: 14px; }
                        input {
                            width: 100%; padding: 12px 15px;
                            border: 2px solid #e0e0e0;
                            border-radius: 8px; font-size: 15px;
                        }
                        input:focus { outline: none; border-color: #6F4E37; }
                        .requirements {
                            background: #f5f5f5; border-radius: 8px;
                            padding: 15px; margin-top: 15px; font-size: 13px;
                        }
                        .requirements h3 { color: #6F4E37; font-size: 14px; margin-bottom: 10px; }
                        .requirement { color: #666; margin: 5px 0; padding-left: 15px; }
                        button {
                            width: 100%; padding: 14px; background: #6F4E37;
                            color: white; border: none; border-radius: 8px;
                            font-size: 16px; font-weight: 600; cursor: pointer; margin-top: 20px;
                        }
                        button:hover { background: #5a3d2a; }
                        button:disabled { background: #ccc; cursor: not-allowed; }
                        .message { padding: 12px; border-radius: 8px; margin-bottom: 20px; display: none; }
                        .message.success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
                        .message.error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>Restablecer contrasena</h1>
                        <p class="subtitle">Ingresa tu nueva contrasena</p>
                        <div id="message" class="message"></div>
                        <form id="resetForm">
                            <div class="form-group">
                                <label>Nueva contrasena</label>
                                <input type="password" id="password" required
                                    placeholder="Ingresa tu nueva contrasena">
                            </div>
                            <div class="form-group">
                                <label>Confirmar contrasena</label>
                                <input type="password" id="confirmPassword" required
                                    placeholder="Confirma tu nueva contrasena">
                            </div>
                            <div class="requirements">
                                <h3>Requisitos:</h3>
                                <div class="requirement">- Minimo 14 caracteres</div>
                                <div class="requirement">- Al menos una letra MAYUSCULA</div>
                                <div class="requirement">- Al menos una letra minuscula</div>
                                <div class="requirement">- Al menos un numero</div>
                                <div class="requirement">- Al menos un simbolo especial</div>
                                <div class="requirement">- Sin numeros consecutivos (123, 456...)</div>
                            </div>
                            <button type="submit" id="submitBtn">Restablecer contrasena</button>
                        </form>
                    </div>
                    <script>
                        var form = document.getElementById('resetForm');
                        var messageDiv = document.getElementById('message');
                        var submitBtn = document.getElementById('submitBtn');

                        function showMessage(text, type) {
                            messageDiv.textContent = text;
                            messageDiv.className = 'message ' + type;
                            messageDiv.style.display = 'block';
                        }

                        form.addEventListener('submit', async function(e) {
                            e.preventDefault();

                            var password = document.getElementById('password').value;
                            var confirmPassword = document.getElementById('confirmPassword').value;

                            if (password !== confirmPassword) {
                                showMessage('Las contrasenas no coinciden', 'error');
                                return;
                            }

                            submitBtn.disabled = true;
                            submitBtn.textContent = 'Procesando...';

                            try {
                                var response = await fetch('/api/auth/reset-password', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        token: '${token}',
                                        nuevaContrasena: password
                                    })
                                });

                                var data = await response.json();

                                if (data.success) {
                                    showMessage('Contrasena restablecida. Redirigiendo...', 'success');
                                    setTimeout(function() { window.location.href = '/'; }, 2000);
                                } else {
                                    showMessage(data.message || 'Error al restablecer', 'error');
                                    submitBtn.disabled = false;
                                    submitBtn.textContent = 'Restablecer contrasena';
                                }
                            } catch (err) {
                                showMessage('Error del servidor. Intenta de nuevo.', 'error');
                                submitBtn.disabled = false;
                                submitBtn.textContent = 'Restablecer contrasena';
                            }
                        });
                    </script>
                </body>
            </html>
        `);

    } catch (error) {
        console.error('❌ Error al verificar token:', error);
        res.status(500).send(`
            <html>
                <body style="font-family: Arial; text-align: center; padding: 50px;">
                    <h1>Error del servidor</h1>
                </body>
            </html>
        `);
    }
};


// =====================================================
// RESETEAR CONTRASENA
// =====================================================
exports.resetearContrasena = async (req, res) => {
    try {
        const token = req.body.token;
        const nuevaContrasena = req.body.nuevaContrasena || req.body.nuevaContraseña;

        console.log('🔄 Procesando reseteo de contrasena');

        if (!token || !nuevaContrasena) {
            return res.status(400).json({
                success: false,
                message: 'Token y nueva contrasena son obligatorios'
            });
        }

        // 1. Validar politica
        const validacion = PasswordValidator.validate(nuevaContrasena);
        if (!validacion.isValid) {
            return res.status(400).json({
                success: false,
                message: 'La contrasena no cumple con las politicas de seguridad',
                errors: validacion.errors
            });
        }

        // 2. Buscar token
        const [tokens] = await db.query(`
            SELECT * FROM TokensVerificacion
            WHERE token = ?
            AND tipo = 'recuperacion'
            AND usado = FALSE
        `, [token]);

        if (tokens.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Token invalido o ya usado'
            });
        }

        const tokenData = tokens[0];

        // 3. Verificar expiracion
        if (new Date() > new Date(tokenData.fechaExpiracion)) {
            return res.status(400).json({
                success: false,
                message: 'Token expirado'
            });
        }

        // 4. Verificar historial
        const esNueva = await PasswordValidator.checkPasswordHistory(
            tokenData.idUsuario,
            nuevaContrasena,
            db
        );

        if (!esNueva) {
            return res.status(400).json({
                success: false,
                message: 'No puedes usar una de tus ultimas 10 contrasenas'
            });
        }

        // 5. Hashear
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(nuevaContrasena, salt);

        // 6. Actualizar usuario
        const fechaExpiracion = new Date();
        fechaExpiracion.setDate(fechaExpiracion.getDate() + 90);
        const fechaExpiracionStr = fechaExpiracion.toISOString().split('T')[0];

        await db.query(`
            UPDATE Usuario
            SET passwordHash = ?,
                fechaExpiracionPassword = ?,
                intentosFallidos = 0,
                fechaBloqueo = NULL
            WHERE idUsuario = ?
        `, [hashedPassword, fechaExpiracionStr, tokenData.idUsuario]);

        // 7. Guardar historial
        await PasswordValidator.saveToHistory(tokenData.idUsuario, hashedPassword, db);

        // 8. Marcar token usado
        await db.query(
            "UPDATE TokensVerificacion SET usado = TRUE WHERE idToken = ?",
            [tokenData.idToken]
        );

        console.log('✅ Contrasena restablecida para usuario:', tokenData.idUsuario);

        res.json({
            success: true,
            message: 'Contrasena restablecida exitosamente'
        });

    } catch (error) {
        console.error('❌ Error al resetear contrasena:', error);
        res.status(500).json({ success: false, message: 'Error del servidor' });
    }
};

exports.updateProfile = async (req, res) => {
    try {

        const { idUsuario } = req.params;
        const { nombre, telefono, direccion } = req.body;

        const [result] = await db.query(`
            UPDATE Usuario
            SET nombre = ?, telefono = ?, direccion = ?
            WHERE idUsuario = ?
        `, [nombre, telefono, direccion, idUsuario]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Usuario no encontrado"
            });
        }

        res.json({
            success: true,
            message: "Perfil actualizado correctamente"
        });

    } catch (error) {

        console.error('❌ Error al actualizar perfil:', error);

        res.status(500).json({
            success: false,
            message: "Error del servidor"
        });

    }
};