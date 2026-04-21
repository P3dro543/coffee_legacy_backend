const axios = require("axios");

const BASE_URL = process.env.BCCR_BASE_URL;
const TOKEN = process.env.BCCR_TOKEN;

function formatearFecha(fecha = new Date()) {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${anio}/${mes}/${dia}`;
}

async function consultarIndicador(codigo, fecha) {
  const url = `${BASE_URL}/indicadoresEconomicos/${codigo}/series`;

  const response = await axios.get(url, {
    params: {
      fechaInicio: fecha,
      fechaFin: fecha,
      idioma: "ES",
    },
    headers: {
      Authorization: `Bearer ${TOKEN}`,
    },
  });

  return response.data;
}

function extraerValor(data) {
  const lista = data?.datos;

  if (!Array.isArray(lista) || lista.length === 0) return null;

  const series = lista[0]?.series;

  if (!Array.isArray(series) || series.length === 0) return null;

  const ultimo = series[series.length - 1];

  return Number(ultimo?.valorDatoPorPeriodo ?? null);
}

async function obtenerTipoCambio() {
  const hoy = formatearFecha();

  const [compraData, ventaData] = await Promise.all([
    consultarIndicador("318", hoy),
    consultarIndicador("317", hoy),
  ]);

  // 👇 AGREGA ESTO
  console.log("COMPRA FULL:", JSON.stringify(compraData, null, 2));
  console.log("VENTA FULL:", JSON.stringify(ventaData, null, 2));

  const compra = extraerValor(compraData);
  const venta = extraerValor(ventaData);

  return { compra, venta, fecha: hoy };
}


module.exports = { obtenerTipoCambio };