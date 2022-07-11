const db = require("../models");
const Receipt = db.receipt;

const controller = {};

controller.updateReceiptZPL = (req, res) => {
  console.log(req.body);
  Receipt.update(
    {
      app_zpl: req.body.appZPL,
    },
    {
      where: {
        receipt_id: req.body.receiptId,
      },
    }
  ).then((receipt) => {
    res.send(receipt);
  });
};

module.exports = controller;
