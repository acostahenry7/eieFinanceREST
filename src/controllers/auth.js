const controller = {};

const db = require("../models/index");
const User = db.user;
const Employee = db.employee;
const Department = db.department;
const Outlet = db.outlet;
const AppAccessControl = db.appAccessControl;
const bcrypt = require("bcryptjs");

const APPVERSION = "1.28";

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

  AppAccessControl.findOne({
    where: {
      mac_address: req.body.deviceInfo.mac,
    },
  }).then((device) => {
    if (device) {
      if (
        device.dataValues.status_type == "ALLOWED" ||
        req.body.username == "admin"
      ) {
        if (isUserLocked == true) {
          results.successfullLogin = false;

          results.error = "Has sido blockeado contacta al Administrador";
          res.send(results);
        } else {
          console.log("TRIES", tries);
          if (tries <= 3) {
            if (req.body.version) {
              if (req.body.version != APPVERSION) {
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
                                department.dataValues.department_type ==
                                "COLLECTORS"
                              ) {
                                bcrypt
                                  .compare(
                                    req.body.password,
                                    user.password_hash
                                  )
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
      } else {
        res.send({
          successfullLogin: false,
          error:
            "Este dispostivo no tiene acceso permitido.Comuníquese con el Administrador",
        });
      }
    } else {
      AppAccessControl.create({
        description: req.body.deviceInfo.description,
        mac_address: req.body.deviceInfo.mac,
        user_id: "16b67d74-fd76-491a-96c1-29b105bb2b91",
        status_type: "BLOCKED",
      }).then((dev) => {
        res.send({
          successfullLogin: false,
          error:
            "Este dispostivo no tiene acceso permitido.Comuníquese con el Administrador",
        });
      });
    }
  });
};

//Users
controller.listLockedUsers = async (req, res) => {
  res.send(lockedUsers);
};
controller.unlockUser = async (req, res) => {
  let index = lockedUsers.indexOf((item) => item.id === req.params.username);
  lockedUsers.splice(index, 1);
  res.send({ message: "User Unlocked" });
};
controller.lockUser = async (req, res) => {};

//Devices

controller.listDevices = async (req, res) => {
  AppAccessControl.findAll().then((devices) => {
    res.send(devices);
  });
};

controller.changeDeviceStatus = async (req, res) => {
  console.log(req.body);

  AppAccessControl.update(
    {
      status_type: req.body.status,
    },
    {
      where: {
        app_access_control_id: req.body.id,
      },
    }
  )
    .then((dev) => {
      res.send({
        message: "El acceso del dispostivo ha sido ",
        status: req.body.status,
      });
    })
    .catch((err) => {
      res.send(err);
    });
};

controller.unregisterDevice = async (req, res) => {
  AppAccessControl.destroy({
    where: {
      app_access_control_id: req.params.deviceId,
    },
  })
    .then(() => {
      res.send({ message: "Dispositivo eliminado." });
    })
    .catch((err) => {
      res.send({
        message: "Hubo un error al tratar del eliminar el dispositvo.",
      });
    });
};

controller.setDevMac = async (req, res) => {
  AppAccessControl.update(
    {
      mac_address: req.body.mac,
    },
    {
      where: {
        app_access_control_id: req.body.id,
      },
    }
  )
    .then(() => {
      res.send({ message: "Done" });
    })
    .catch((err) => {
      res.send({ err });
    });
};

module.exports = controller;
