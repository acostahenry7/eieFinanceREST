const controller = {};
const db = require("../models/index");
const Sequelize = db.Sequelize;
const _ = require("lodash");

const Amortization = db.amortization;
const Payment = db.payment;
const PaymentDetail = db.paymentDetail;
const LoanPaymentAddress = db.loanPaymentAddress;
const Section = db.section;
const Receipt = db.receipt;
const ReceiptTransaction = db.receiptTransaction;
const fs = require("fs");
const path = require("path");

controller.getPaymentsBySearchkey = async (req, res) => {
  const results = {};

  console.log("DATE", Sequelize.NOW());

  try {
    const [client, metaClient] = await db.sequelize.query(
      `select la.customer_id , first_name, last_name, identification
                from loan_application la
                join customer c on (c.customer_id = la.customer_id)
                where loan_application_id in (select loan_application_id
                                            from loan l
										    join loan_payment_address lp on (lp.loan_id = l.loan_id)
                                            where loan_number_id='${req.body.searchKey}'
										  	and lp.section_id in (select cast(section_id as int) 
																from zone_neighbor_hood 
																where zone_id in (select zone_id
																				  from employee_zone
																				  where employee_id='${req.body.employeeId}')))	
										and la.outlet_id=(select outlet_id from employee where employee_id='${req.body.employeeId}')`
    );

    var customerId = client[0].customer_id;

    const [loans, metaLoan] = await db.sequelize.query(
      `select l.loan_id, l.loan_number_id, count(quota_number) quota_amount, sum(amount_of_fee) as balance
                from amortization a
                join loan l on (l.loan_id = a.loan_id)
                where a.loan_id in (select loan_id from loan where loan_number_id in (select loan_number_id 
                                                                                from loan 
                                                                                where loan_application_id in (select loan_application_id 
                                                                                                              from loan_application
                                                                                                              where customer_id = '${customerId}')
                                                                                                              and status_type != 'PAID'))
                group by l.loan_number_id, l.loan_id`
    );

    var currentOuotas = [];

    // loans.map( item => {
    //     console.log(item);
    // })
    let loanNumbers = [];

    loans.map((item) => {
      loanNumbers.push(item.loan_number_id);
    });

    const [quotas, metaQuota] = await db.sequelize.query(
      `select amortization_id, l.loan_number_id, ((amount_of_fee - total_paid) + mora) - discount as current_fee, quota_number, 
      mora, payment_date, discount_mora, discount_interest, amount_of_fee - total_paid as fixed_amount
                    from amortization a
                    join loan l on (a.loan_id = l.loan_id)
                    where l.loan_number_id in (${loanNumbers.join()})
                    and paid='false'
                    order by a.loan_id, quota_number`
    );

    results.quotas = _.groupBy(quotas, (quota) => quota.loan_number_id);
    results.customer = client;
    results.loans = [...loans];
  } catch (error) {
    console.log(error);
  }

  console.log(results);
  res.send(results);
};

controller.createPayment = async (req, res) => {
  const results = {};
  var paidLoan = false;
  var totalPaid = getPaymentTotal(req.body.amortization);
  var counter = 1;
  const receiptNumber = generateReceiptNumber();

  const [receiptId, metadata] = await db.sequelize.query(
    `Select cast(max(html) as int) + 1 as nextHtml from receipt`
  );

  const [reference, meta] = await db.sequelize.query(
    `select cast(max(reference) as int) + 1 as reference from payment`
  );

  const [nextLoid] = await db.sequelize.query(
    `select max(loid::int) as current_id from pg_largeobject `
  );

  var receiptPaymentId = "";

  Payment.create({
    pay: totalPaid,
    loan_id: req.body.payment.loanId,
    ncf: req.body.payment.ncf,
    customer_id: req.body.payment.customerId,
    payment_type: req.body.payment.paymentType,
    created_by: req.body.payment.createdBy,
    last_modified_by: req.body.payment.lastModifiedBy,
    reference: reference[0].reference,
    employee_id: req.body.payment.employeeId,
    outlet_id: req.body.payment.outletId,
    comment: req.body.payment.comment,
    register_id: req.body.payment.registerId,
    reference_bank: null,
    bank: null,
    pay_off_loan_discount: 0,
    pay_off_loan: req.body.payment.payOffLoan,
    capital_subscription: false,
    status_type: "ENABLED",
  })
    .then((payment) => {
      req.body.amortization.map(async (quota, index) => {
        Amortization.findOne({
          attributes: ["total_paid", "quota_number"],
          where: { amortization_id: quota.quotaId },
        })
          .then((totalPaid) => {
            Amortization.update(
              {
                paid: quota.paid,
                status_type: quota.statusType,
                total_paid:
                  quota.totalPaid + parseInt(totalPaid.dataValues.total_paid),
                last_modified_by: req.body.payment.lastModifiedBy,
              },
              {
                where: {
                  amortization_id: quota.quotaId,
                },
                returning: true,
              }
            )
              .then((amortization) => {
                //Crea detalle del pago
                PaymentDetail.create({
                  amortization_id: quota.quotaId,
                  payment_id: payment.dataValues.payment_id,
                  pay: quota.totalPaid,
                })
                  .then((paymentDetail) => {
                    results.amortization = [];

                    var date = amortization[1][0].dataValues.payment_date
                      .toISOString()
                      .split("T")[0];

                    results.amortization.push(
                      date.split("-").reverse().join("/")
                    );

                    if (parseInt(req.body.amortization.length) == counter) {
                      //Crea recibo del pago
                      Receipt.create({
                        html: nextLoid[0].current_id,
                        receipt_number: receiptNumber,
                        comment: null,
                        payment_id: paymentDetail.dataValues.payment_id,
                      })
                        .then((receipt) => {
                          results.receipt = receipt;
                          var bulkTransactions = [];

                          req.body.amortization.map((item) => {
                            bulkTransactions.push({
                              receipt_id: receipt.dataValues.receipt_id,
                              quota_number: item.quota_number,
                              payment_date: (() => {
                                let date = new Date(
                                  item.date.split("/").reverse().join("-")
                                );
                                // console.log(
                                //   item.date.split("/").reverse().join("-")
                                // );
                                return date;
                              })(),
                              amount: item.amount,
                              mora: item.mora,
                              discount:
                                parseFloat(item.discountInterest) +
                                parseFloat(item.discountMora),
                              total_paid: item.totalPaid,
                              discount_interest: item.discountInterest,
                              discount_mora: item.discountMora,
                              cashback: req.body.payment.cashBack,
                            });
                          });

                          const receiptHtmlObject = {
                            receiptNumber: receiptNumber,
                            // customer:
                            //   req.body.payment.customer.first_name +
                            //   " " +
                            //   req.body.payment.customer.last_name,
                            loanNumber: 13672,
                            paymentType: req.body.payment.paymentType,
                            subTotal: (() => {
                              let result = 0;
                              bulkTransactions.map((item) => {
                                result +=
                                  parseFloat(item.total_paid) +
                                  parseFloat(item.mora);
                              });

                              return result;
                            })(),
                            discount: (() => {
                              let result = 0;
                              bulkTransactions.map((item) => {
                                result += parseFloat(item.discount);
                              });
                              return result;
                            })(),
                            total: (() => {
                              let result = 0;
                              bulkTransactions.map((item) => {
                                result +=
                                  parseFloat(item.total_paid) +
                                  parseFloat(item.mora) -
                                  parseFloat(item.discount);
                              });

                              return result;
                            })(),
                            date: (() => {
                              //Date
                              const date = new Date().getDate();
                              const month = new Date().getMonth() + 1;
                              const year = new Date().getFullYear();

                              //Time
                              const hour = new Date().getHours();
                              var minute = new Date().getMinutes();
                              minute < 10
                                ? (minute = "" + minute)
                                : (minute = minute);
                              var dayTime = hour >= 12 ? "PM" : "AM";

                              const fullDate = `${date}/${month}/${year}  ${hour}:${minute} ${dayTime}`;
                              return fullDate.toString();
                            })(),
                            pendingAmount: 0,
                            receivedAmount: (() => {
                              let result = 0;
                              bulkTransactions.map((item) => {
                                result +=
                                  parseFloat(item.total_paid) +
                                  parseFloat(item.mora) -
                                  parseFloat(item.discount);
                              });

                              return result + bulkTransactions[0].cashback;
                            })(),
                            cashBack: bulkTransactions[0].cashback,
                            amortization: bulkTransactions,
                          };

                          var filePath = path.join(
                            __dirname,
                            "../assets/res/receipts/"
                          );
                          var fileName = "temp_receipt2.html";
                          var stream = fs.createWriteStream(
                            filePath + fileName
                          );

                          stream.on("open", async () => {
                            var html = buildReceiptHtml(receiptHtmlObject);
                            stream.end(html);
                            //console.log(html);

                            console.log(nextLoid);

                            const [data, meta] = await db.sequelize.query(
                              `update pg_largeobject
                              set data=decode('${html}', 'escape')
                              where loid::int = ${nextLoid[0].current_id}`
                            );

                            //console.log(data);
                          });

                          ReceiptTransaction.bulkCreate(bulkTransactions)
                            .then((receiptTransaction) => {
                              console.log("BULK", bulkTransactions);
                              LoanPaymentAddress.findOne({
                                attributes: ["section_id"],
                                where: {
                                  loan_id: req.body.payment.loanId,
                                },
                              }).then((sectionId) => {
                                console.log(sectionId.dataValues.section_id);

                                Section.findOne({
                                  attributes: ["name"],
                                  where: {
                                    section_id: sectionId.dataValues.section_id,
                                  },
                                }).then((section) => {
                                  results.loanDetails = {
                                    section: section.dataValues.name,
                                  };

                                  res.send(results);
                                });
                              });
                            })
                            .catch((err) => console.log(err));
                        })
                        .catch((err) => {
                          console.log("Error creating receipt " + err);
                        });
                    }

                    counter++;
                  })
                  .catch((err) => {
                    console.log("Error creating Payment Detail " + err);
                  });
              })
              .catch((err) => {
                console.log("Error creating the amortization " + err);
              });
          })
          .catch((err) => {
            console.log("Error searching for the quota " + err);
          });
      });
    })
    .catch((err) => {
      console.log("Error creating the payment " + err);
    });
};

module.exports = controller;

function getPaymentTotal(amortization) {
  var paymentTotal = 0;

  amortization.map((quota) => {
    paymentTotal += quota.totalPaid;
  });

  return paymentTotal;
}

function generateReceiptNumber() {
  const firstRandom = Math.floor(Math.random() * 9000);
  const secondRandom = Math.floor(Math.random() * 9000);

  const result = firstRandom + "-" + secondRandom;

  return result.toString();
}

function getPaymentTotal(amortization) {
  var paymentTotal = 0;

  amortization.map((quota) => {
    paymentTotal += parseFloat(quota.totalPaid);
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

      .r_body_detail_data {
        max-height: 180px;
        overflow-y: scroll;
        scroll-behavior: smooth;
      }

      .r_body_detail_data::-webkit-scrollbar {
        display: none
      }

      .r_body_detail_data h6{
        font-size: 12px;
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

      .r_footer {
        min-height: 20px;
      }

    </style>
    <title>Document</title>
  </head>
  <body>
    <div class="container box">
      <div class="card shadow border-0 r_container">
        <div class="r_header">
          <!--
          
          Aquí va el logo, insertar la lógica correspondiente para traerlo desde
          configuración
          -->

          <!-- <img
            src="http://op.grupoavant.com.do:26015/assets/profile/banner1.png"
            width="100%"
            height="100px"
            alt=""
          /> -->
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
                  <h6 class="title">Numero Recibo</h6>
                  <h6>${object.receiptNumber}</h6>
                </div>
              </div>
              <div class="col-md-6">
                <h6 class="title">Fecha:</h6>
                <h6>${object.date}</h6>
              </div>
            </div>
            <div class="row mt-3">
              <div class="col-md-6">
                <div>
                  <h6 class="title">Prestamo</h6>
                  <h6>${object.loanNumber}</h6>
                </div>
              </div>
              <div class="col-md-6">
                <h6 class="title">Cliente</h6>
                <h6>${object.customer}</h6>
              </div>
            </div>
            <div class="row mt-3">
              <div class="col-md-6">
                <div>
                  <h6 class="title">Tipo de Pago</h6>
                  <h6>${object.paymentType}</h6>
                </div>
              </div>
              <div class="col-md-6">
                <div>
                  <h6 class="title">Zona</h6>
                  <h6>${object.section}</h6>
                </div>
              </div>
            </div>
          </div>
          <div class="r_body_detail">
            <div class="r_section" style="background-color:  #fff">
              <h6 class="text-dark title">Transacciones</h6>
            </div>
            <div class="r_body_detail_headers" style="width: 100%; font-weight: bold">
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
              <div class="mt-2 r_body_detail_data" style="display: block">
              ${generateTrasactionsTemplate(object)}
              </div>
              <div class="row mt-4">
                <div class="col-md-4">

                </div>
                <div class="col-md-8" style="list-style: none; font-size: 13px;">
                  <div style="display: flex; flex-direction: row">
                    <div class="col-md-6">
                      <li>SubTotal</li>
                      <li>Descuento</li>
                      <li>Total</li>
                      <li>Monto Recibido</li>
                      <li>Saldo Pendiente</li>
                      <li>Cambio</li>
                    </div>
                    <div class="col-md-6">
                      <ul style="list-style: none;">
                      <li>RD$ ${
                        hasDecimal(object.subTotal)
                          ? object.subTotal
                          : object.subTotal + ".00"
                      }</li>
                      <li>RD$ ${
                        hasDecimal(object.discount)
                          ? object.discount
                          : object.discount + ".00"
                      }</li>
                      <li>RD$ ${
                        hasDecimal(object.total)
                          ? object.total
                          : object.total + ".00"
                      }</li>
                      <li>RD$ ${
                        hasDecimal(object.receivedAmount)
                          ? object.receivedAmount
                          : object.receivedAmount + ".00"
                      }</li>
                      <li>RD$ ${
                        hasDecimal(object.pendingAmount)
                          ? object.pendingAmount
                          : object.pendingAmount + ".00"
                      }</li>
                      <li>RD$ ${
                        hasDecimal(object.cashBack)
                          ? object.cashBack
                          : object.cashBack + ".00"
                      }</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="r_footer mb-3">
          <h6 class="text-center mt-4" style="font-size: 11px; font-weight: bold">
            Nota: No somos responsables de dinero entregado sin recibo.
          </h6>
          <h5 class="text-center mt-1" style="font-size: 14px; font-weight: bold">--- COPIA DE RECIBO ---</h5>
        </div>
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
            <ul style="list-style: none; padding: 0">
              <li>
                <div style="display: flex">
                  <div style="width: 16%">
                    <h6 class="title">${item.quota_number}</h6>
                  </div>
                  <div style="width: 30%">
                    <h6 class="title">${item.payment_date}</h6>
                  </div>
                  <div style="width: 19%">
                    <h6 class="title">${
                      hasDecimal(item.amount)
                        ? item.amount
                        : item.amount + ".00"
                    }</h6>
                  </div>
                  <div style="width: 19%">
                    <h6 class="title">${
                      hasDecimal(item.mora) ? item.mora : item.mora + ".00"
                    }</h6>
                  </div>
                  <div style="width: 15%">
                    <h6 class="title">${
                      hasDecimal(item.total_paid)
                        ? item.total_paid
                        : item.total_paid + ".00"
                    }</h6>
                  </div
                </div>
              </li>
              <li>
                <div class="mt-2" style="display: flex; flex-direction: row; justify-content: space-around">
                <div style="">
                  <h5 style="font-size: 12px">Desc. Mora ${
                    hasDecimal(item.discount_mora)
                      ? item.discount_mora
                      : item.discount_mora + ".00"
                  }</h5>
                </div>
                <div style="">
                  <h5 style="font-size: 12px">Desc. Interes ${
                    hasDecimal(item.discountInterest)
                      ? item.discount_interest
                      : item.discount_interest + ".00"
                  }</h5>
                </div>
                </div>
              </li>

            </ul>
    `);
  });

  console.log(arr.join(",").toString());

  return arr.length > 1
    ? arr.join(",").toString().replaceAll(",", "")
    : arr.join(",");
}

function hasDecimal(num) {
  return !!(num % 1);
}
