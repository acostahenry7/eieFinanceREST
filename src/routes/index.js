const _ = require("lodash");
const express = require("express");
const router = express.Router();
const { uuid } = require("uuidv4");

const authController = require("../controllers/auth");
const customerController = require("../controllers/customers");
const collectorController = require("../controllers/collectors");
const qrController = require("../controllers/qr");
const paymentController = require("../controllers/payments");
const imageController = require("../controllers/camera");
const multer = require("multer");

const db = require("../models/index");
const Sequelize = db.Sequelize;
const { user, password } = require("../server/dbconfig");
const Customer = db.customer;
const Loan = db.loan;
const Register = db.register;
const Receipt = db.receipt;
const ReceiptTransaction = db.receiptTransaction;
const User = db.user;
const Employee = db.employee;
const EmployeeZone = db.employeeZone;
const Department = db.department;
const Amortization = db.amortization;
const Payment = db.payment;
const PaymentDetail = db.paymentDetail;
const Visit = db.visit;
const LoanApplication = db.loanApplication;
const LoanPaymentAddress = db.loanPaymentAddress;
const Section = db.section;
const PaymentRouter = db.paymentRouter;
const PaymentRouterDetail = db.paymentRouterDetail;
const Outlet = db.outlet;
const fs = require("fs");
const path = require("path");

const Op = db.Sequelize;

const bcrypt = require("bcryptjs");
const {
  receipt,
  paymentDetail,
  amortization,
  employeeZone,
} = require("../models/index");

module.exports = (app, storage) => {
  const upload = multer({ storage });

  console.log(upload);
  app.post("/api/upload", upload.single("userImg"), (req, res) => {
    console.log("body", req.body.customerId);
    res.status(200).json({
      message: "success!",
    });
  });

  app.post("/api/upload/receipt", (req, res) => {
    var filePath = path.join(__dirname, "../assets/res/receipts/");
    var fileName = "test2.html";
    var stream = fs.createWriteStream(filePath + fileName);

    stream.on("open", () => {
      var html = buildReceiptHtml(req.body);
      stream.end(html);

      res.send(
        "File Created on " +
          "http://localhost:3000/assets/res/receipts/" +
          fileName
      );
    });
  });

  //Login
  router.post("/login", authController.login);

  //Customer
  router.get(
    "/customers/main/:employeeId",
    customerController.getCustomersByEmployeeId
  );

  //Collectors
  router.get("/collectors", collectorController.getCollectors);
  router.post("/collectors/update", collectorController.updateCollectorParams);

  router.post("/customers/each", customerController.getCustomerById);

  //Camera
  router.get("/customer/img/:employeeId", imageController.getCustomerImg);
  router.post("/customer/img/", imageController.setCustomerImg);

  //Qr
  router.get(
    "/customers/createQR/:customerId",
    qrController.createQrByCustomerId
  );

  router.get("/customers/getQr/:customerId", qrController.getQrByCustomerId);

  //Register
  router.get("/register/:userId", (req, res) => {
    var results = {};

    Register.findOne({
      where: {
        user_id: req.params.userId,
        status_type: "ENABLED",
      },
    }).then((register) => {
      console.log(register);
      if (register) {
        results.status = true;
        results.register = register;
      } else {
        results.status = false;
      }

      res.send(results);
    });
  });

  router.post("/register/create", (req, res) => {
    Register.create({
      amount: req.body.amount,
      description: req.body.description,
      user_id: req.body.userId,
      outlet_id: req.body.outletId,
      created_by: req.body.createdBy,
      last_modified_by: req.body.lastModifiedBy,
      status_type: "ENABLED",
    })
      .then((register) => {
        res.send(register);
      })
      .catch((err) => {
        console.log(err);
      });
  });

  //Payments
  router.post("/payment", paymentController.getPaymentsBySearchkey);

  router.post("/payment/create", paymentController.createPayment);

  //Payment Router
  router.get("/paymentroute/:employeeId", async (req, res) => {
    console.log(req.params.employeeId);

    User.findOne({
      attributes: ["router_restriction"],
      where: {
        employee_id: req.params.employeeId,
      },
    }).then(async (user) => {
      console.log(user);
      let query = "";
      query = `select payment_router_detail_id, prd.status_type, position, c.customer_id, c.image_url, 
c.first_name || ' ' || c.last_name as name, c.street as location, s.name as section, s.section_id
        from payment_router_detail prd
        inner join loan_payment_address lpa on (prd.loan_payment_address_id = lpa.loan_payment_address_id)
        inner join loan l on (lpa.loan_id = l.loan_id)
        inner join loan_application la on ( l.loan_application_id = la.loan_application_id )
        inner join customer c on ( la.customer_id = c.customer_id)
		join section s on (lpa.section_id = s.section_id)
        where payment_router_id = (select payment_router_id
        from payment_router
        where zone_id in (select zone_id from employee_zone where employee_id = '${req.params.employeeId}')
        and created_date = (select max(created_date) from payment_router where zone_id in (select zone_id from employee_zone where employee_id = '${req.params.employeeId}')))
        order by position
        limit ${user.dataValues.router_restriction}`;

      try {
        const [data, meta] = await db.sequelize.query(query);
        let arr = [];
        arr = _.groupBy(data, (item) => item.section);
        console.log(arr);
        res.send(arr);
      } catch (error) {
        console.log(error);
      }
    });

    // var counter = 1;

    // EmployeeZone.findAll(
    //     {
    //         attributes: ['zone_id'],
    //         where: {
    //             employee_id: req.params.employeeId
    //         }
    //     }
    // ).then( employeeZone => {
    //     var zones = []

    //     employeeZone.map( item => {
    //         zones.push(item.dataValues.zone_id)
    //     })

    //     PaymentRouter.findOne(
    //         {
    //             attributes: ['payment_router_id'],
    //             where: {
    //                 zone_id: zones
    //             }
    //         }
    //     ).then( paymentRouter => {

    //         PaymentRouterDetail.findAll(
    //             {
    //                 where: {
    //                     payment_router_id: paymentRouter.dataValues.payment_router_id
    //                 },
    //             }
    //         ).then( paymentRouterDetail => {

    //             console.log(paymentRouterDetail);
    //             var routerDetail = []

    //             paymentRouterDetail.map( item => {
    //                 console.log(item.dataValues.loan_payment_address_id);
    //                 Loan.findAll(
    //                     {
    //                         where: {
    //                             loan_payment_address_id: item.dataValues.loan_payment_address_id
    //                         }
    //                     }
    //                 ).then( loan => {
    //                     console.log(loan);

    //                         LoanApplication.findAll(
    //                             {
    //                                 where: {
    //                                     loan_application_id: loan.dataValues.loan_application_id
    //                                 }
    //                             }
    //                         ).then( loanApplication => {
    //                             routerDetail.push({...item.dataValues ,
    //                                 loan_application_id: loanApplication.dataValues.loan_application_id
    //                         })

    //                         if (loan.length == counter) {
    //                             res.send(routerDetail)
    //                         }

    //                     })

    //                 })

    //             })

    //             counter++

    //         }).catch(err => {
    //             console.log(err);
    //         })

    //     }).catch( err => {
    //         console.log(err);
    //     })
    // })
  });

  //Receipts
  router.post("/receipt/payments", (req, res) => {
    Loan.findOne({
      attributes: ["loan_id"],

      where: {
        loan_number_id: req.body.loanNumber,
      },
    }).then((loanId) => {
      console.log("ID", loanId);
      Payment.findAll({
        attributes: [
          [
            db.sequelize.cast(db.sequelize.col("created_date"), "date"),
            "created_date",
          ],
          [
            db.sequelize.cast(db.sequelize.col("created_date"), "time"),
            "created_time",
          ],
          "payment_type",
          "payment_id",
        ],
        where: {
          loan_id: loanId.dataValues.loan_id,
        },
        order: [["created_date", "desc"]],
        include: {
          model: Receipt,
        },
      })
        .then((payments) => {
          console.log(payments);
          res.send(payments);
        })
        .catch((err) => {
          console.log(err);
        });
    });
  });

  router.post("/receipt/amortization", (req, res) => {
    ReceiptTransaction.findAll({
      attributes: [
        "quota_number",
        [
          db.sequelize.cast(db.sequelize.col("payment_date"), "date"),
          "payment_date",
        ],
        "amount",
        "mora",
        "discount_interest",
        "discount_mora",
        "discount",
        "total_paid",
        "cashback",
      ],
      where: {
        receipt_id: req.body.receiptId,
      },
    })
      .then((amortizations) => {
        var transactions = [];

        amortizations.map((amortization) => {
          transactions.push({
            quota_number: amortization.dataValues.quota_number,
            date: amortization.dataValues.payment_date,
            fixedAmount: amortization.dataValues.amount,
            mora: amortization.dataValues.mora,
            totalPaid: amortization.dataValues.total_paid,
            discountInterest: amortization.dataValues.discount_interest,
            discountMora: amortization.dataValues.discount_mora,
            discount: amortization.dataValues.discount,
            cashBack: amortization.dataValues.cashback,
          });
        });

        console.log(transactions);
        res.send(transactions);
      })
      .catch((err) => {
        console.log(err);
      });
  });

  //Visits
  router.post("/visit", (req, res) => {
    Visit.create({
      customer_id: req.body.customerId,
      user_id: req.body.userId,
      user_name: req.body.username,
      actual_location: req.body.currentLocation,
      commentary: "COBRO",
    })
      .then((visit) => {
        res.send(visit.dataValues);
      })
      .catch((err) => {
        console.log(err);
      });
  });

  router.post("/visit/commentary", (req, res) => {
    Visit.update(
      {
        commentary: req.body.commentary,
      },
      {
        where: {
          visit_id: req.body.visitId,
        },
      }
    ).then((visit) => {
      res.send(true);
    });
  });

  //Reports
  router.get("/reports/daypayments/:employeeId", async (req, res) => {
    const [data, meta] = await db.sequelize.query(
      `select r.receipt_number, r.payment_id, p.loan_id, l.loan_number_id, p.pay, p.created_date::time as time, 
      p.created_date::date as date, c.first_name || ' ' || c.last_name as name, pd.amortization_id, a.payment_date::date,
      case
        when a.payment_date::date - p.created_date::date <= 0 then 'Y'
        else 'N'
      end as arrear
      from receipt r
      inner join payment p on (r.payment_id = p.payment_id)
      inner join payment_detail pd on (p.payment_id = pd.payment_id)
      inner join amortization a on (pd.amortization_id = a.amortization_id)
      inner join loan l on (p.loan_id = l.loan_id)
      inner join loan_application la  on ( l.loan_application_id = la.loan_application_id)
      inner join loan_payment_address lpa on (l.loan_payment_address_id = lpa.loan_payment_address_id)
      inner join customer c on ( la.customer_id = c.customer_id)
      where p.created_date::date = CURRENT_DATE 
      and lpa.section_id in ((select cast(section_id as int) 
                  from zone_neighbor_hood 
                  where zone_id in (select zone_id
                            from employee_zone
                            where employee_id='${req.params.employeeId}')))
      order by p.created_date desc`
    );

    res.send(data);
  });

  app.use(router);
};

function generateReceiptNumber() {
  const firstRandom = Math.floor(Math.random() * 9000);
  const secondRandom = Math.floor(Math.random() * 9000);

  const result = firstRandom + "-" + secondRandom;

  return result.toString();
}

function getPaymentTotal(amortization) {
  var paymentTotal = 0;

  amortization.map((quota) => {
    paymentTotal += quota.totalPaid;
  });

  return paymentTotal;
}

function buildReceiptHtml(object) {
  let arr = [];

  return `<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link
      href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css"
      rel="stylesheet"
      integrity="sha384-1BmE4kWBq78iYhFldvKuhfTAU6auU8tT94WrHftjDbrCEXSU1oBoqyl2QvZ6jIW3"
      crossorigin="anonymous"
    />
    <style>
      .box {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 30px 0px;
      }

      .r_container {
        background-color: "#FFF";
        width: 400px;
      }

      .r_header {
        padding: 15px;
      }

      .r_body h6 {
        font-size: 14px;
        margin: 0;
      }
      .r_body_info {
        padding: 0 15px;
      }

      .r_body_detail {
        padding: 0 15px;
      }

      .r_section {
        margin-top: 15px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1px solid black;
        background-color: black;
        margin-bottom: 15px;
      }

      .title {
        font-weight: bold;
      }
    </style>
    <title>Document</title>
  </head>
  <body>
    <div class="container box">
      <div class="card shadow border-0 r_container">
        <div class="r_header">
          <img
            src="http://op.grupoavant.com.do:26015/assets/profile/banner1.png"
            width="100%"
            height="100px"
            alt=""
          />
        </div>
        <div class="r_body">
          <div class="r_body_info">
            <div style="text-align: center">
              <h6 style="font-weight: bold">PRINCIPAL</h6>
              <h6 style="font-weight: bold">809654568</h6>
            </div>
            <div class="r_section">
              <h6 class="title text-light">Recibo</h6>
            </div>
            <div class="row">
              <div class="col-md-6">
                <div>
                  <h6 class="title">Número Recibo</h6>
                  <h6>0000-0000</h6>
                </div>
              </div>
              <div class="col-md-6">
                <h6 class="title">Fecha:</h6>
                <h6>12/03/2022</h6>
              </div>
            </div>
            <div class="row mt-3">
              <div class="col-md-6">
                <div>
                  <h6 class="title">Zona</h6>
                  <h6>Villa Mella</h6>
                </div>
              </div>
              <div class="col-md-6">
                <h6 class="title">No. Préstamo</h6>
                <h6>13672</h6>
              </div>
            </div>
            <div class="row mt-3">
              <div class="col-md-6">
                <div>
                  <h6 class="title">Nombre Cliente</h6>
                  <h6>Villa Mella</h6>
                </div>
              </div>
            </div>
          </div>
          <div class="r_body_detail">
            <div class="r_section">
              <h6 class="text-light title">Transacciones</h6>
            </div>
            <div class="r_body_detail_headers" style="width: 100%">
              <div class="row">
                <div style="width: 16%">
                  <h6 class="title">No. Cuota</h6>
                </div>
                <div style="width: 27%">
                  <h6 class="title">Fecha Cuota</h6>
                </div>
                <div style="width: 18%">
                  <h6 class="title">Monto</h6>
                </div>
                <div style="width: 18%">
                  <h6 class="title">Mora</h6>
                </div>
                <div style="width: 21%">
                  <h6 class="title">Pagado</h6>
                </div>
              </div>
              ${generateTrasactionsTemplate(object)}
            </div>
          </div>
        </div>
        <div class="r_footer"></div>
      </div>
    </div>
  </body>
</html>
`;
}

function generateTrasactionsTemplate(object) {
  let arr = [];

  let transactionTemplate = `<div></div>`;
  object.amortization?.map((item) => {
    arr.push(`
    <div class="row">
      ${item.quota}
    </div>
    `);
  });

  console.log(arr.join(",").toString().replaceAll(",", ""));

  return arr.join(",").toString().replaceAll(",", "");
}
