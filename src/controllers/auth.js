const controller = {};

const db = require("../models/index");
const User = db.user;
const Employee = db.employee;
const Department = db.department;
const Outlet = db.outlet;
const bcrypt = require("bcryptjs");

let tries = 0;
let lockedUsers = [];

controller.login = async (req, res) => {
  const results = {};
  console.log(req.body);

  let isUserLocked = false;

  lockedUsers.forEach((user) => {
    if (user == req.body.username) {
      isUserLocked = true;
    }
  });

  if (isUserLocked == true) {
    results.successfullLogin = false;

    results.error = "Has sido blockeado contacta al Administrador";
    res.send(results);
  } else {
    console.log("TRIES", tries);
    if (tries <= 3) {
      if (req.body.version) {
        if (req.body.version != "1.1") {
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
                        if (
                          department.dataValues.department_type == "COLLECTORS"
                        ) {
                          bcrypt
                            .compare(req.body.password, user.password_hash)
                            .then((success) => {
                              if (success == false) {
                                results.successfullLogin = false;
                                results.error = `Tienes ${
                                  3 - tries
                                } intentos restantes.`;
                                tries++;

                                res.send(results);
                              } else {
                                results.successfullLogin = true;
                                results.userData = user;

                                tries = 0;

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
      } else {
        results.successfullLogin = false;
        results.error = "MMVERSION";
        res.send(results);
      }
    } else {
      lockedUsers.push(req.body.username);
      results.successfullLogin = false;

      results.error = `Has sido blockeado contacta al Administrador`;
      tries = 0;
      res.send(results);
    }
  }
};

controller.listLockedUsers = async (req, res) => {
  res.send(lockedUsers);
};
controller.unlockUser = async (req, res) => {
  let index = lockedUsers.indexOf((item) => item.id === req.params.username);
  lockedUsers.splice(index, 1);
  res.send({ message: "User Unlocked" });
};
controller.lockUser = async (req, res) => {};

module.exports = controller;
