const { obtenerTipoCambio } = require("../services/tipoCambioService");

const getTipoCambio = async (req, res) => {
  try {
    const data = await obtenerTipoCambio();

    res.json({
      ok: true,
      data,
    });
  } catch (error) {
    console.error("Error tipo cambio:", error.message);

    res.status(500).json({
      ok: false,
      mensaje: "Error obteniendo tipo de cambio",
    });
  }
};

module.exports = { getTipoCambio };