const controller = {};
const db = require("../models/index");
const Employee = db.employee;
const Department = db.department;
const User = db.user;

controller.getCollectors = (req, res) => {
  Department.findAll({
    attributes: ["department_id"],
    where: {
      department_type: "COLLECTORS",
    },
  })
    .then((response) => {
      let searchParam = [];

      response.map((item) => {
        searchParam.push(item.dataValues.department_id);
      });

      Employee.findAll({
        where: {
          department_id: searchParam,
        },
        include: {
          model: User,
        },
      })
        .then((response) => {
          //console.log(response);
          res.send(response);
        })
        .catch((err) => console.log(err));
    })
    .catch((err) => console.log(err));
};

controller.updateCollectorParams = (req, res) => {
  User.update(
    {
      router_restriction: req.body.routerRestriction,
    },
    {
      where: {
        user_id: req.body.userId,
      },
    }
  )
    .then(() => {
      res.send({ message: "Done" });
    })
    .catch((err) => {
      console.log(err);
    });
};

module.exports = controller;
