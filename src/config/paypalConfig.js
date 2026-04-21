const paypal = require('@paypal/checkout-server-sdk');

/**
 * Configuración del entorno de PayPal
 */
function environment() {
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

    if (process.env.PAYPAL_MODE === 'production') {
        // Producción (dinero real)
        return new paypal.core.LiveEnvironment(clientId, clientSecret);
    } else {
        // Sandbox (pruebas)
        return new paypal.core.SandboxEnvironment(clientId, clientSecret);
    }
}

/**
 * Cliente de PayPal
 */
function client() {
    return new paypal.core.PayPalHttpClient(environment());
}

module.exports = { client };