const express = require("express");
const { getTipoCambio } = require("../controllers/tipoCambioController");

const router = express.Router();

router.get("/", getTipoCambio);

module.exports = router;