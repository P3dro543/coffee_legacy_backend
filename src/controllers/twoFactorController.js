const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const db = require('../config/db');
const crypto = require('crypto');

// Generar secret y QR para activar 2FA
exports.generarQR = async (req, res) => {
    try {
        const { idUsuario } = req.params;

        console.log('🔐 Generando QR para 2FA - Usuario:', idUsuario);

        // 1. Buscar usuario
        const [usuarios] = await db.query(
            "SELECT * FROM Usuario WHERE idUsuario = ?",
            [idUsuario]
        );

        if (usuarios.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }

        const usuario = usuarios[0];

        // 2. Generar secret
        const secret = speakeasy.generateSecret({
            name: `Romero Café (${usuario.correo})`,
            issuer: 'Romero Café Legacy'
        });

        console.log('🔑 Secret generado:', secret.base32);

        // 3. Generar QR code
        const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

        // 4. Guardar secret TEMPORALMENTE (no está activado aún)
        await db.query(`
            UPDATE Usuario 
            SET twoFactorSecret = ?
            WHERE idUsuario = ?
        `, [secret.base32, idUsuario]);

        res.json({
            success: true,
            qrCode: qrCodeUrl,
            secret: secret.base32,
            manualEntry: secret.base32 // Por si no puede escanear QR
        });

    } catch (error) {
        console.error('❌ Error al generar QR:', error);
        res.status(500).json({
            success: false,
            message: 'Error del servidor'
        });
    }
};

// Verificar código y activar 2FA
exports.activar2FA = async (req, res) => {
    try {
        const { idUsuario } = req.params;
        const { codigo } = req.body;

        console.log('✅ Activando 2FA - Usuario:', idUsuario);

        // 1. Buscar usuario
        const [usuarios] = await db.query(
            "SELECT * FROM Usuario WHERE idUsuario = ?",
            [idUsuario]
        );

        if (usuarios.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }

        const usuario = usuarios[0];

        if (!usuario.twoFactorSecret) {
            return res.status(400).json({
                success: false,
                message: 'Primero debes generar el código QR'
            });
        }

        // 2. Verificar código
        const verificado = speakeasy.totp.verify({
            secret: usuario.twoFactorSecret,
            encoding: 'base32',
            token: codigo,
            window: 2 // Tolerancia de ±2 periodos (60 segundos)
        });

        if (!verificado) {
            return res.status(400).json({
                success: false,
                message: 'Código inválido. Intenta de nuevo.'
            });
        }

        console.log('✅ Código verificado correctamente');

        // 3. Generar códigos de respaldo (10 códigos)
        const backupCodes = [];
        for (let i = 0; i < 10; i++) {
            const code = crypto.randomBytes(4).toString('hex').toUpperCase();
            backupCodes.push(code);
        }

        // 4. Activar 2FA
        await db.query(`
            UPDATE Usuario 
            SET twoFactorEnabled = TRUE,
                twoFactorBackupCodes = ?
            WHERE idUsuario = ?
        `, [JSON.stringify(backupCodes), idUsuario]);

        console.log('🎉 2FA activado exitosamente');

        res.json({
            success: true,
            message: '2FA activado exitosamente',
            backupCodes: backupCodes
        });

    } catch (error) {
        console.error('❌ Error al activar 2FA:', error);
        res.status(500).json({
            success: false,
            message: 'Error del servidor'
        });
    }
};

// Desactivar 2FA
exports.desactivar2FA = async (req, res) => {
    try {
        const { idUsuario } = req.params;
        const { contraseña } = req.body;

        console.log('🔓 Desactivando 2FA - Usuario:', idUsuario);

        // 1. Buscar usuario
        const [usuarios] = await db.query(
            "SELECT * FROM Usuario WHERE idUsuario = ?",
            [idUsuario]
        );

        if (usuarios.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }

        const usuario = usuarios[0];

        // 2. Verificar contraseña (por seguridad)
        const bcrypt = require('bcryptjs');
        const isMatch = await bcrypt.compare(contraseña, usuario.passwordHash);

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Contraseña incorrecta'
            });
        }

        // 3. Desactivar 2FA
        await db.query(`
            UPDATE Usuario 
            SET twoFactorEnabled = FALSE,
                twoFactorSecret = NULL,
                twoFactorBackupCodes = NULL
            WHERE idUsuario = ?
        `, [idUsuario]);

        console.log('✅ 2FA desactivado');

        res.json({
            success: true,
            message: '2FA desactivado exitosamente'
        });

    } catch (error) {
        console.error('❌ Error al desactivar 2FA:', error);
        res.status(500).json({
            success: false,
            message: 'Error del servidor'
        });
    }
};

// Verificar código 2FA en login
exports.verificarCodigo2FA = async (req, res) => {
    try {
        const { idUsuario, codigo, esCodigoRespaldo } = req.body;

        console.log('🔍 Verificando código 2FA - Usuario:', idUsuario);

        // 1. Buscar usuario
        const [usuarios] = await db.query(
            "SELECT * FROM Usuario WHERE idUsuario = ?",
            [idUsuario]
        );

        if (usuarios.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }

        const usuario = usuarios[0];

        if (!usuario.twoFactorEnabled) {
            return res.status(400).json({
                success: false,
                message: '2FA no está activado'
            });
        }

        let verificado = false;

        // 2. Verificar si es código de respaldo
        if (esCodigoRespaldo) {
            const backupCodes = JSON.parse(usuario.twoFactorBackupCodes || '[]');
            const codigoIndex = backupCodes.indexOf(codigo.toUpperCase());

            if (codigoIndex !== -1) {
                // Código válido, eliminarlo para que no se pueda usar de nuevo
                backupCodes.splice(codigoIndex, 1);
                
                await db.query(`
                    UPDATE Usuario 
                    SET twoFactorBackupCodes = ?
                    WHERE idUsuario = ?
                `, [JSON.stringify(backupCodes), idUsuario]);

                verificado = true;
                console.log('✅ Código de respaldo válido (quedan', backupCodes.length, ')');
            }
        } else {
            // 3. Verificar código TOTP
            verificado = speakeasy.totp.verify({
                secret: usuario.twoFactorSecret,
                encoding: 'base32',
                token: codigo,
                window: 2
            });
        }

        if (!verificado) {
            return res.status(400).json({
                success: false,
                message: 'Código inválido'
            });
        }

        console.log('✅ Código 2FA verificado correctamente');

        // 4. Generar JWT (igual que en login normal)
        const jwt = require('jsonwebtoken');
        const token = jwt.sign(
            { idUsuario: usuario.idUsuario },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            message: 'Autenticación exitosa',
            token: token,
            userId: usuario.idUsuario,
            nombre: usuario.nombre
        });

    } catch (error) {
        console.error('❌ Error al verificar código 2FA:', error);
        res.status(500).json({
            success: false,
            message: 'Error del servidor'
        });
    }
};

// Obtener estado de 2FA
exports.obtenerEstado2FA = async (req, res) => {
    try {
        const { idUsuario } = req.params;

        const [usuarios] = await db.query(
            "SELECT twoFactorEnabled FROM Usuario WHERE idUsuario = ?",
            [idUsuario]
        );

        if (usuarios.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }

        res.json({
            success: true,
            twoFactorEnabled: usuarios[0].twoFactorEnabled === 1
        });

    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error del servidor'
        });
    }
};