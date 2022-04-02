const controller = {};
const db = require("../models/index");
const Customer = db.customer;
const { uuid } = require("uuidv4");

controller.createQrByCustomerId = (req, res) => {
  Customer.update(
    {
      qr_code: uuid().toString(),
    },
    {
      where: {
        customer_id: req.params.customerId,
      },
      returning: true,
    }
  )
    .then((customer) => {
      res.send(customer["1"][0].dataValues);
    })
    .catch((err) => {
      console.log(err);
    });
};

controller.getQrByCustomerId = (req, res) => {
  Customer.findOne({
    where: {
      customer_id: req.params.customerId,
    },
  }).then((customer) => {
    console.log(customer.dataValues);
    res.send(customer.dataValues);
  });
};

module.exports = controller;
