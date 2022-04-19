const _ = require("lodash");
const express = require("express");
const router = express.Router();
const { uuid } = require("uuidv4");

const authController = require("../controllers/auth");
const customerController = require("../controllers/customers");
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

  //Login
  router.post("/login", authController.login);

  //Customer
  router.get(
    "/customers/main/:employeeId",
    customerController.getCustomersByEmployeeId
  );

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

    let query = "";
    query = `select payment_router_detail_id, prd.status_type, position, c.customer_id, c.image_url, c.first_name || ' ' || c.last_name as name, c.street as location
        from payment_router_detail prd
        inner join loan_payment_address lpa on (prd.loan_payment_address_id = lpa.loan_payment_address_id)
        inner join loan l on (lpa.loan_id = l.loan_id)
        inner join loan_application la on ( l.loan_application_id = la.loan_application_id )
        inner join customer c on ( la.customer_id = c.customer_id)
        where payment_router_id = (select payment_router_id
        from payment_router
        where zone_id in (select zone_id from employee_zone where employee_id = '${req.params.employeeId}')
        and created_date = (select max(created_date) from payment_router where zone_id in (select zone_id from employee_zone where employee_id = '${req.params.employeeId}')))
        order by position`;

    try {
      const [data, meta] = await db.sequelize.query(query);
      res.send(data);
    } catch (error) {
      console.log(error);
    }

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
        order: [["created_date", "asc"]],
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
    Payment.findOne({
      attributes: [
        [
          db.sequelize.literal(
            `(select created_date::date  as created_date from payment where payment_id = '${req.body.paymentId}')`
          ),
          "created_date",
        ],
        "pay",
      ],
      where: {
        payment_id: req.body.paymentId,
      },
    })
      .then((payment) => {
        //console.log(payment);
        PaymentDetail.findAll({
          //attributes: ['amortization_id','pay'],
          where: {
            payment_id: req.body.paymentId,
          },
        })
          .then((paymentDetail) => {
            var transactions = [];
            var counter = 1;
            var test;
            paymentDetail.map((pd, index) => {
              console.log(pd);
              //console.log("HAHAHAAHA", paymentDetail[index - 1]);
              Amortization.findOne({
                attributes: {
                  include: [
                    "amortization_id",
                    "quota_number",
                    "amount_of_fee",
                    "total_paid",
                    "mora",
                    [
                      db.sequelize.cast(
                        db.sequelize.col("payment_date"),
                        "date"
                      ),
                      "payment_date",
                    ],
                  ],
                },
                where: {
                  amortization_id: pd.amortization_id,
                },
              }).then((amortization) => {
                //

                var currentPay =
                  parseInt(amortization.dataValues.amount_of_fee) -
                  parseInt(amortization.dataValues.total_paid);

                transactions.push({
                  amortization_id: amortization.dataValues.amortization_id,
                  quota_number: amortization.dataValues.quota_number,
                  date: amortization.dataValues.payment_date,
                  amount:
                    currentPay == 0
                      ? amortization.dataValues.amount_of_fee
                      : //: currentPay + parseFloat(pd.pay) + ".00",
                        amortization.dataValues.amount_of_fee,
                  mora: amortization.dataValues.mora,
                  totalPaid: pd.pay,
                });
                console.log(counter, "vs", paymentDetail.length);
                if (counter == paymentDetail.length) {
                  //res.send(transactions)
                  console.log("HI");
                  console.log("TRANS", transactions);
                  res.send(transactions);
                }
                test = amortization.dataValues.amount_of_fee - pd.pay;
                console.log(test);
                counter++;
              });
            });
            //     console.log(paymentDetail);
            //     var amortization = []
            //     var pays = []
            //     paymentDetail.map( detail => {
            //         amortization.push(detail.dataValues.amortization_id.toString())
            //     })

            //     Amortization.findAll(
            //         {
            //             attributes: [
            //                 'amortization_id',
            //                 'quota_number',
            //                 'amount_of_fee',
            //                 [Sequelize.literal('amount_of_fee - total_paid'), 'amount'],
            //                 //[Sequelize.literal('total_paid - (((amount_of_fee - total_paid) + mora) - discount)'), 'quota_paid'],
            //                 'total_paid',
            //                 'mora'
            //             ],
            //             where: {
            //                 amortization_id: amortization
            //             }
            //         }
            //     ).then( amortization => {

            //         let quotas = []
            //         var currentPay = parseInt(payment.dataValues.pay)

            //         amortization.map( (quota , index) => {

            //             if( amortization.length > 1  && index != amortization.length -1) {
            //                 var x = quota.dataValues.amount == 0 ? quota.dataValues.amount_of_fee : quota.dataValues.amount
            //                 console.log(currentPay);
            //                 currentPay = currentPay - (x + parseInt(quota.dataValues.mora))
            //             }else {
            //                 currentPay = currentPay
            //             }

            //             quotas.push({
            //                 amortization_id: quota.dataValues.amortization_id,
            //                 quota_number: quota.dataValues.quota_number,
            //                 date: payment.dataValues.created_date,
            //                 amount: quota.dataValues.amount == 0 ? quota.dataValues.amount_of_fee : quota.dataValues.amount,
            //                 mora: quota.dataValues.mora,
            //                 totalPaid: currentPay
            //             })
            //         })

            //         res.send(quotas)
            //     }).catch( err =>{
            //         console.log(err);
            //     })
            //
          })
          .catch((err) => {
            console.log(err);
          });
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
