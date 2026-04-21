/**
 * Detectar marca de tarjeta según el número
 */
function detectarMarcaTarjeta(numeroTarjeta) {
    const numero = numeroTarjeta.replace(/\s/g, ''); // Quitar espacios

    // Visa: empieza con 4
    if (/^4/.test(numero)) {
        return 'Visa';
    }

    // Mastercard: 51-55 o 2221-2720
    if (/^5[1-5]/.test(numero) || /^2[2-7]/.test(numero)) {
        return 'Mastercard';
    }

    // American Express: 34 o 37
    if (/^3[47]/.test(numero)) {
        return 'American Express';
    }

    return 'Desconocida';
}

/**
 * Validar formato de número de tarjeta (16 dígitos)
 */
function validarFormatoTarjeta(numeroTarjeta) {
    const numero = numeroTarjeta.replace(/\s/g, '');
    
    // Debe tener 15-16 dígitos (Amex tiene 15)
    if (!/^\d{15,16}$/.test(numero)) {
        return {
            valido: false,
            error: 'El número de tarjeta debe tener 15-16 dígitos'
        };
    }

    return { valido: true };
}

/**
 * Algoritmo de Luhn para validar número de tarjeta
 */
function validarLuhn(numeroTarjeta) {
    const numero = numeroTarjeta.replace(/\s/g, '');
    
    let suma = 0;
    let alternar = false;

    // Recorrer de derecha a izquierda
    for (let i = numero.length - 1; i >= 0; i--) {
        let digito = parseInt(numero.charAt(i), 10);

        if (alternar) {
            digito *= 2;
            if (digito > 9) {
                digito -= 9;
            }
        }

        suma += digito;
        alternar = !alternar;
    }

    return (suma % 10) === 0;
}

/**
 * Validar CVV (3-4 dígitos)
 */
function validarCVV(cvv, marcaTarjeta) {
    // American Express usa 4 dígitos, otros usan 3
    const longitudEsperada = marcaTarjeta === 'American Express' ? 4 : 3;
    
    if (cvv.length !== longitudEsperada) {
        return {
            valido: false,
            error: `CVV debe tener ${longitudEsperada} dígitos para ${marcaTarjeta}`
        };
    }

    if (!/^\d+$/.test(cvv)) {
        return {
            valido: false,
            error: 'CVV solo debe contener números'
        };
    }

    return { valido: true };
}

/**
 * Validar fecha de vencimiento
 */
function validarFechaVencimiento(mes, anio) {
    const mesNum = parseInt(mes);
    const anioNum = parseInt(anio);

    if (mesNum < 1 || mesNum > 12) {
        return {
            valido: false,
            error: 'Mes inválido (debe ser 1-12)'
        };
    }

    const hoy = new Date();
    const mesActual = hoy.getMonth() + 1;
    const anioActual = hoy.getFullYear();

    // Convertir año de 2 dígitos a 4 si es necesario
    const anioCompleto = anioNum < 100 ? 2000 + anioNum : anioNum;

    if (anioCompleto < anioActual) {
        return {
            valido: false,
            error: 'La tarjeta está vencida (año pasado)'
        };
    }

    if (anioCompleto === anioActual && mesNum < mesActual) {
        return {
            valido: false,
            error: 'La tarjeta está vencida (mes pasado)'
        };
    }

    return { 
        valido: true,
        anioCompleto: anioCompleto
    };
}

/**
 * Validar teléfono SINPE (formato Costa Rica)
 */
function validarTelefonoSinpe(telefono) {
    // Formato: 8888-8888 o 88888888 (8 dígitos)
    const numero = telefono.replace(/\D/g, ''); // Quitar todo menos dígitos

    if (numero.length !== 8) {
        return {
            valido: false,
            error: 'El teléfono debe tener 8 dígitos'
        };
    }

    // En Costa Rica, los teléfonos suelen empezar con 2, 4, 5, 6, 7, 8
    if (!/^[2-8]/.test(numero)) {
        return {
            valido: false,
            error: 'Número de teléfono inválido'
        };
    }

    return { 
        valido: true,
        numeroFormateado: `${numero.substring(0, 4)}-${numero.substring(4)}`
    };
}

/**
 * Generar token único para tarjeta (simulación de tokenización)
 */
function generarTokenTarjeta(numeroTarjeta, idUsuario) {
    const crypto = require('crypto');
    const data = `${numeroTarjeta}-${idUsuario}-${Date.now()}`;
    return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Generar código de autorización para transacción
 */
function generarCodigoAutorizacion() {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
    return `AUTH-${timestamp}-${random}`;
}

/**
 * Formatear número de tarjeta enmascarado
 */
function enmascararTarjeta(numeroTarjeta) {
    const numero = numeroTarjeta.replace(/\s/g, '');
    const ultimos4 = numero.slice(-4);
    return `**** **** **** ${ultimos4}`;
}

module.exports = {
    detectarMarcaTarjeta,
    validarFormatoTarjeta,
    validarLuhn,
    validarCVV,
    validarFechaVencimiento,
    validarTelefonoSinpe,
    generarTokenTarjeta,
    generarCodigoAutorizacion,
    enmascararTarjeta
};