const bcrypt = require('bcryptjs');

class PasswordValidator {
    
    static validate(password) {
        const errors = [];

        if (password.length < 14) {
            errors.push('Debe tener al menos 14 caracteres');
        }

        if (!/[A-Z]/.test(password)) {
            errors.push('Debe incluir al menos una letra MAYÚSCULA');
        }

        if (!/[a-z]/.test(password)) {
            errors.push('Debe incluir al menos una letra minúscula');
        }

        if (!/[0-9]/.test(password)) {
            errors.push('Debe incluir al menos un número');
        }

        if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
            errors.push('Debe incluir al menos un símbolo especial (!@#$%...)');
        }

        if (/(?:012|123|234|345|456|567|678|789|890)/.test(password)) {
            errors.push('No debe contener números consecutivos (ej: 123, 456)');
        }

        const secuenciasComunes = [
            'password', 'Password', 'PASSWORD',
            'qwerty', 'QWERTY', 'Qwerty',
            'abc', 'ABC', 'Abc',
            '12345', '54321'
        ];
        
        for (const secuencia of secuenciasComunes) {
            if (password.includes(secuencia)) {
                errors.push(`No debe contener "${secuencia}"`);
                break;
            }
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }


    static async checkPasswordHistory(idUsuario, newPassword, db) {
        try {
            const [history] = await db.query(`
                SELECT contraseña 
                FROM HistorialContraseñas 
                WHERE idUsuario = ? 
                ORDER BY fechaCambio DESC 
                LIMIT 10
            `, [idUsuario]);

            console.log(`📜 Verificando contra ${history.length} contraseñas anteriores`);


            for (const record of history) {
                const esIgual = await bcrypt.compare(newPassword, record.contraseña);
                if (esIgual) {
                    console.log('❌ Contraseña ya fue usada anteriormente');
                    return false; 
                }
            }

            console.log('✅ Contraseña nueva, no está en el historial');
            return true; 

        } catch (error) {
            console.error('Error al verificar historial:', error);
            return true; 
        }
    }

    static async saveToHistory(idUsuario, hashedPassword, db) {
        try {
            await db.query(`
                INSERT INTO HistorialContraseñas (idUsuario, contraseña)
                VALUES (?, ?)
            `, [idUsuario, hashedPassword]);

            console.log('✅ Contraseña guardada en historial');

            // Mantener solo las últimas 10
            await db.query(`
                DELETE FROM HistorialContraseñas 
                WHERE idUsuario = ? 
                AND idHistorial NOT IN (
                    SELECT * FROM (
                        SELECT idHistorial 
                        FROM HistorialContraseñas 
                        WHERE idUsuario = ? 
                        ORDER BY fechaCambio DESC 
                        LIMIT 10
                    ) AS temp
                )
            `, [idUsuario, idUsuario]);

        } catch (error) {
            console.error('Error al guardar en historial:', error);
        }
    }
}

module.exports = PasswordValidator;