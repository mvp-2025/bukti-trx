const express = require("express");
const axios = require("axios");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname));

/* ===========================
CONFIG URL (PINDAH KE SINI)
=========================== */
const TRANSFER_URL = "https://multiqris.com/api/adm-super/transfer-history/paging";

/* ===========================
BANK MAP (AUTO DARI API)
=========================== */
let bankMap = {};

/* ===========================
FORMAT DATE
=========================== */
function formatDate(unix) {
  if (!unix) return "-";

  const d = new Date(unix * 1000);

  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();

  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const seconds = String(d.getSeconds()).padStart(2, "0");

  return `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;
}

/* ===========================
FORMAT DATE STRING
=========================== */
function formatDateString(date) {
  if (!date) return "";

  const d = new Date(date);

  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();

  return `${day}-${month}-${year}`;
}

/* ===========================
FORMAT AMOUNT
=========================== */
function formatAmount(n) {
  if (!n) return "0";
  return Number(n).toLocaleString("id-ID");
}

/* ===========================
API TRANSAKSI
=========================== */
app.post("/api/transaksi", async (req, res) => {
  console.log("REQUEST:", req.body);

  try {
    const { vendorId, user_id = 839, dateStart, dateEnd } = req.body;

    if (!vendorId) {
      return res.status(400).json({
        message: "Ref ID wajib diisi"
      });
    }

    /* USER PANEL */
    const panelMap = {
      839: "MVP",
      842: "ELITE",
      841: "X-PAY"
    };

    const user_name = panelMap[user_id] || "MVP";

    /* DATE */
    const now = new Date();

    const startUnix = dateStart
      ? Math.floor(new Date(dateStart).getTime() / 1000)
      : Math.floor(new Date(now.setHours(0, 0, 0, 0)).getTime() / 1000);

    const endUnix = dateEnd
      ? Math.floor(new Date(dateEnd).getTime() / 1000)
      : Math.floor(Date.now() / 1000);

    /* BODY MQ */
    const body = {
      field: "",
      orderedIdList: null,
      page: 1,
      size: 20,
      search: vendorId,
      web_id: null,
      user_id: Number(user_id),
      user_name: user_name,
      bankId: null,
      bankName: null,
      dateStart: startUnix,
      dateEnd: endUnix,
      dateStartString: formatDateString(dateStart),
      dateEndString: formatDateString(dateEnd),
      report_type: "INSTALL"
    };

    /* 🔥 URL SUDAH TIDAK DARI ENV */
    const url = `${TRANSFER_URL}?user_id=${user_id}&search=${vendorId}`;

    console.log("HIT API:", url);

    const response = await axios.post(url, body, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${process.env.BEARER_MQ}`,
        "Content-Type": "application/json"
      }
    });

    const list = response.data?.content?.content;

    if (!list || list.length === 0) {
      return res.status(404).json({
        message: "Transaksi tidak ditemukan"
      });
    }

    const trx = list[0];

    /* ===========================
    OUTPUT FINAL (SUDAH MAPPING)
    =========================== */
    const result = {
      transactionId: trx.vendorId,
      status: trx.status,
      accountName: trx.accountName,
      bankNo: trx.bankNo,
      bank: trx.bankCode, // <--- kirim kode bank saja
      amount: formatAmount(trx.amount),
      dateCreated: formatDate(trx.dateCreated)
    };

    console.log("RESULT:", result);

    res.json(result);

  } catch (err) {
    console.log("ERROR DETAIL:", err.response?.data || err.message);

    res.status(500).json({
      message: "Gagal ambil data",
      error: err.response?.data || err.message
    });
  }
});

app.listen(PORT, () => {
  console.log("Server running:");
  console.log(`http://localhost:${PORT}`);
});