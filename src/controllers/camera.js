const db = require("../models/index");
const Customer = db.customer;

var controller = {};

controller.getCustomerImg = (req, res) => {
  console.log(req.params);
  Customer.findOne({
    attributes: ["image_url"],
    where: {
      customer_id: req.params.employeeId,
    },
  }).then((img) => {
    res.send(img.dataValues);
  });
};

controller.setCustomerImg = (req, res) => {
  console.log("CAMMEMRA", req.body.customerId);
  Customer.update(
    {
      image_url: req.body.imageUrl,
    },
    {
      where: {
        customer_id: req.body.customerId,
      },
    }
  )
    .then((customer) => {
      res.send(customer);
    })
    .catch((err) => {
      console.log(err);
    });
};

module.exports = controller;
