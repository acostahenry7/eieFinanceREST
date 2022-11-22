const controller = {};

const db = require("../models/index");
const User = db.user;
const Employee = db.employee;
const Department = db.department;
const Outlet = db.outlet;
const bcrypt = require("bcryptjs");

controller.login = async (req, res) => {
  const results = {};
  console.log(req.body);

  if (req.body.version != "1.0") {
    results.successfullLogin = false;
    results.error = "MMVERSION";
    res.send(results);
  } else {
    if (req.body.username != "admin") {
      User.findOne({
        attributes: [
          "user_id",
          "login",
          "password_hash",
          "first_name",
          "last_name",
          "employee_id",
          "outlet_id",
        ],
        where: {
          login: req.body.username,
        },
      }).then((user) => {
        if (user) {
          Employee.findOne({
            attributes: ["department_id"],
            where: {
              employee_id: user.dataValues.employee_id,
            },
          })
            .then((employee) => {
              Department.findOne({
                attributes: ["department_type"],
                where: {
                  department_id: employee.dataValues.department_id,
                },
              })
                .then((department) => {
                  console.log(department);
                  if (department.dataValues.department_type == "COLLECTORS") {
                    bcrypt
                      .compare(req.body.password, user.password_hash)
                      .then((success) => {
                        if (success == false) {
                          results.successfullLogin = false;
                        } else {
                          results.successfullLogin = true;
                          results.userData = user;

                          Outlet.findOne({
                            where: {
                              outlet_id: user.dataValues.outlet_id,
                            },
                          })
                            .then((outlet) => {
                              results.userData = {
                                ...user.dataValues,
                                ...outlet.dataValues,
                              };
                              console.log(results.userData);
                              res.send(results);
                            })
                            .catch((err) => {
                              console.log(err);
                            });
                        }
                      });
                  } else {
                    results.error =
                      "No tiene autorización para acceder através de esta app";
                    res.send(results);
                  }
                })
                .catch((err) => {
                  console.log("Error retreiving department", err);
                });
            })
            .catch((err) => {
              console.log("Error retreiving user ", err);
            });
        } else {
          res.send(undefined);
        }
      });
    } else {
      if (req.body.password == "admin") {
        results.successfullLogin = true;
        results.userData = {
          employee_id: "",
          login: "admin",
          first_name: "Admin",
          last_name: "Admin",
          outlet_id: "local",
          user_id: "admin-0000-local-0000",
        };
      } else {
        results.successfullLogin = false;
      }

      res.send(results);
    }
  }
};

module.exports = controller;
