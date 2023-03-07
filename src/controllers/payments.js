const controller = {};
const db = require("../models/index");
const Sequelize = db.Sequelize;
const _ = require("lodash");

const Amortization = db.amortization;
const Payment = db.payment;
const PaymentDetail = db.paymentDetail;
const Loan = db.loan;
const LoanPaymentAddress = db.loanPaymentAddress;
const Section = db.section;
const Receipt = db.receipt;
const ReceiptTransaction = db.receiptTransaction;
const PaymentRouterDetail = db.paymentRouterDetail;
const fs = require("fs");
const path = require("path");
const { result } = require("lodash");

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
      `select l.loan_id, l.loan_number_id, count(quota_number) quota_amount, sum(amount_of_fee) as balance, l.number_of_installments as amount_of_quotas
      from amortization a
      right join loan l on (l.loan_id = a.loan_id)
      join loan_application la on (la.loan_application_id = l.loan_application_id)
      where la.customer_id = '${customerId}'
      and a.outlet_id = l.outlet_id
      and l.status_type != 'PAID'
      group by l.loan_number_id, l.loan_id, l.number_of_installments`
    );

    var currentOuotas = [];

    // loans.map( item => {
    //     console.log(item);
    // })
    let loanNumbers = [];

    loans.map((item) => {
      loanNumbers.push(item.loan_number_id);
    });

    //
    console.log(loanNumbers.join(","));
    const [quotas, metaQuota] = await db.sequelize
      .query(`select a.amortization_id, l.loan_number_id, amount_of_fee as quota_amount, ((amount_of_fee - total_paid) + mora) - a.discount as current_fee, 
      quota_number, a.created_date as date, 
      mora , payment_date, discount_mora, discount_interest, amount_of_fee - total_paid as fixed_amount, a.status_type, a.total_paid as current_paid,
      total_paid_mora      
      from amortization a
      left join loan l on (a.loan_id = l.loan_id)
      where l.loan_number_id in (${loanNumbers.join()})
      and a.outlet_id = l.outlet_id 
      and a.paid='false'
      order by a.loan_id, quota_number`);

    const [charges] = await db.sequelize
      .query(`select loan_charge_id as charge_id, l.loan_number_id as loan_number, sum(ch.amount) as amount
      from loan_charge lch
      join charge ch on (lch.charge_id = ch.charge_id)
	    join loan l on (l.loan_id = lch.loan_id)
      where lch.loan_id in (select loan_id from loan where loan_number_id in (${loanNumbers.join()}))
      and lch.status_type ='CREATED'
	  group by l.loan_number_id, loan_charge_id`);

    const [gDiscount] = await db.sequelize.query(`select discount
    from amortization_discount
    where loan_id in (select loan_id from loan where loan_number_id in (${loanNumbers.join()}))
    and status_type = 'CREATED'`);

    console.log("CHARGES", charges);

    results.quotas = _.groupBy(quotas, (quota) => quota.loan_number_id);
    results.customer = client;
    results.loans = [...loans];
    results.charges = [...charges];
    //result.charges = charges;
    results.globalDiscount = parseInt(gDiscount[0]?.discount);
  } catch (error) {
    console.log(error);
  }

  console.log(results);
  res.send(results);
};

controller.createPayment = async (req, res) => {
  const results = {};

  var counter = 1;
  const receiptNumber = generateReceiptNumber();

  const [reference, meta] = await db.sequelize.query(
    `select cast(max(reference) as int) + 1 as reference from payment`
  );

  const [maxQuota] = await db.sequelize.query(
    `select max(quota_number) as quota from amortization where loan_id = '${req.body.payment.loanId}'`
  );

  const [currentLoanId] = await db.sequelize.query(
    `select loan_number_id as loan_number from loan where loan_id = '${req.body.payment.loanId}'`
  );

  const [currentCustomer] = await db.sequelize.query(
    `select first_name, last_name from customer where customer_id = '${req.body.payment.customerId}'`
  );

  const [imgUrl] = await db.sequelize.query(
    `select image_url from outlet where outlet_id = '${req.body.payment.outletId}'`
  );

  const [sectionName] = await db.sequelize.query(
    `select name 
    from section
    where section_id=(select section_id from loan_payment_address where loan_id ='${req.body.payment.loanId}')`
  );

  var receiptPaymentId = "";

  console.log("%%%%%%%%%%%%%%", req.body.amortization);

  Payment.create({
    pay: req.body.payment.totalPaid,
    loan_id: req.body.payment.loanId,
    ncf: req.body.payment.ncf,
    customer_id: req.body.payment.customerId,
    payment_type: req.body.payment.paymentType,
    created_by: req.body.payment.createdBy,
    last_modified_by: req.body.payment.lastModifiedBy,
    reference: reference[0].reference,
    employee_id: req.body.payment.employeeId,
    outlet_id: req.body.payment.outletId,
    comment: req.body.payment.commentary,
    register_id: req.body.payment.registerId,
    reference_bank: null,
    bank: null,
    pay_off_loan_discount: 0,
    pay_off_loan: req.body.payment.liquidateLoan,
    capital_subscription: false,
    status_type: "ENABLED",
    payment_origin: "APP",
  })
    .then((payment) => {
      req.body.amortization.map(async (quota, index) => {
        Amortization.findOne({
          attributes: ["total_paid", "quota_number"],
          where: { amortization_id: quota.quotaId },
        })
          .then((totalPaid) => {
            if (
              parseInt(quota.quotaNumber) == parseInt(maxQuota[0].quota) &&
              quota.isPaid == true
            ) {
              Loan.update(
                {
                  status_type: "PAID",
                },
                {
                  where: {
                    loan_id: req.body.payment.loanId,
                  },
                }
              ).then(() => {
                console.log("hi");
              });
            }
            Amortization.update(
              {
                paid: quota.isPaid,
                status_type: quota.statusType,
                total_paid: (
                  parseFloat(quota.currentPaid) + parseFloat(quota.totalPaid)
                ).toFixed(2),
                last_modified_by: req.body.payment.lastModifiedBy,
                mora: quota.mora,
                total_paid_mora: (
                  parseFloat(quota.fixedTotalPaidMora) +
                  parseFloat(quota.totalPaidMora)
                ).toFixed(2),
                execute_process_mora: quota.executeProcessMora,
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
                let payMora = 0;
                if (quota.fixedMora == 0) {
                  payMora = quota.fixedMora;
                } else {
                  if (quota.totalPaidMora > quota.fixedMora) {
                    payMora = quota.fixedMora;
                  } else {
                    payMora = quota.totalPaidMora;
                  }
                }

                PaymentDetail.create({
                  amortization_id: quota.quotaId,
                  payment_id: payment.dataValues.payment_id,
                  pay: parseFloat(req.body.payment.totalPaid),
                  pay_mora: payMora,
                  paid_mora_only: quota.payMoraOnly,
                  status_type: quota.latestStatus,
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
                        html: null,
                        receipt_number: receiptNumber,
                        comment: null,
                        payment_id: paymentDetail.dataValues.payment_id,
                      })
                        .then((receipt) => {
                          results.receipt = receipt;
                          var bulkTransactions = [];

                          req.body.amortization.map((item) => {
                            console.log("BULK", item);
                            bulkTransactions.push({
                              receipt_id: receipt.dataValues.receipt_id,
                              quota_number: item.quotaNumber,
                              payment_date: item.date,
                              amount: item.amount,
                              mora: item.mora,
                              discount:
                                parseFloat(item.discountInterest) +
                                parseFloat(item.discountMora),
                              total_paid: item.totalPaid,
                              discount_interest: item.discountInterest,
                              discount_mora: item.discountMora,
                              cashback: req.body.payment.change,
                            });
                          });

                          console.log("CURRENT LOAN ID", currentLoanId);
                          const receiptHtmlObject = {
                            receiptNumber: receiptNumber,
                            section: sectionName[0].name,
                            customer:
                              currentCustomer[0].first_name +
                              " " +
                              currentCustomer[0].last_name,
                            loanNumber: req.body.payment.loanNumber,
                            logo: imgUrl[0].image_url,
                            paymentType: req.body.payment.paymentType,
                            createdBy: req.body.payment.createdBy,
                            subTotal: (() => {
                              let result = 0;
                              bulkTransactions.map((item) => {
                                result += parseFloat(item.amount);
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
                                result += parseFloat(item.amount);
                              });

                              return result;
                            })(),
                            totalPayment: req.body.payment.totalPaid,
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
                            totalMora: req.body.payment.totalMora,
                            pendingAmount: req.body.payment.pendingAmount,
                            receivedAmount: req.body.payment.receivedAmount,
                            cashBack: req.body.payment.change,
                            amortization: req.body.amortization,
                            quotaAmount: req.body.payment.quotaAmount,
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
                            await db.sequelize.query(
                              `update receipt set app_html='${html}' where receipt_id = '${receipt.dataValues.receipt_id}'`
                            );

                            //await splitAndUpdateLOB(html, 2044, db);

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
                                }).then(async (section) => {
                                  const [zone, metadata] = await db.sequelize
                                    .query(`
                                        select name 
                                        from zone 
                                        where zone_id = (select zone_id from zone_neighbor_hood where section_id = '${sectionId.dataValues.section_id}'  limit 1)`);

                                  console.log(zone);
                                  results.loanDetails = {
                                    section:
                                      zone[0].name +
                                      " - " +
                                      sectionName[0].name,
                                    pay: req.body.totalPaid,
                                    // section.dataValues.name +
                                    // " " +

                                    //zone: zone[0].name,
                                  };

                                  console.log("HI", results);
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

controller.createPaymentRouterDetail = async (req, res) => {
  console.log(req.body);

  const [paymentRouterId] = await db.sequelize.query(
    `  select payment_router_id
    from payment_router
    where zone_id in (select zone_id from employee_zone where employee_id = '${req.body.employee.employee_id}')
    and created_date::date = (select max(created_date::date) 
              from payment_router 
              where zone_id in (select zone_id from employee_zone where employee_id = '${req.body.employee.employee_id}' and status_type='ENABLED'))
  limit 1
    `
  );

  const [position] = await db.sequelize.query(
    `select max(position) + 1 as position
     from payment_router_detail
     where payment_router_id = '${paymentRouterId[0].payment_router_id}'
    `
  );

  PaymentRouterDetail.findAll({
    attributes: ["customer_id"],
    where: {
      payment_router_id: paymentRouterId[0].payment_router_id,
    },
  }).then((data) => {
    let routedCustomers = [];

    data.map((item) => {
      routedCustomers.push(item.dataValues.customer_id);
    });

    console.log(routedCustomers);

    let currentPosition;
    position[0]?.position == null
      ? (currentPosition = 0)
      : (currentPosition = parseInt(position[0].position));

    let bulkItems = [];

    req.body.customers.map((item) => {
      let isRouted = routedCustomers.find(
        (customerId) => customerId == item.customer_id
      );

      if (isRouted == null) {
        bulkItems.push({
          status_type: item.status_type,
          payment_router_id: paymentRouterId[0].payment_router_id,
          loan_payment_address_id: item.loan_payment_address_id,
          position: currentPosition,
          customer_id: item.customer_id,
          loan_id: item.loan_id,
        });

        console.log(bulkItems);

        currentPosition++;
      }
    });

    console.log("BULKITEM", bulkItems);

    if (bulkItems.length > 0) {
      PaymentRouterDetail.bulkCreate(bulkItems).then((data) => {
        console.log(data);
      });
      res.send({
        data,
        message:
          "Todos los clientes seleccionados, fueron agregados a la ruta exitosamente!",
        messageTitle: "Listo!",
      });
    } else {
      console.log("Todos los clientes ya existen en la ruta!");
      res.send({
        message: "Todos los clientes seleccionados ya existen en la ruta!",
        messageTitle: "Error",
      });
    }
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

  return `<!DOCTYPE html>
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
      <div class="card border-0 r_container">
        <div class="r_header">
          <image src="${object.logo}" alt="Logo", width="100%", height="200px"/>
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
            <div class="row mt-3">
            <div class="col-md-6">
              <div>
                <h6 class="title">Cajero</h6>
                <h6>${object.createdBy}</h6>
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
                <div style="width: 17%">
                  <h6 class="title">No. Cuota</h6>
                </div>
                <div style="width: 27%">
                  <h6 class="title">Fecha Cuota</h6>
                </div>
                <div style="width: 19%">
                  <h6 class="title">Monto</h6>
                </div>
                <div style="width: 17%">
                  <h6 class="title">Mora</h6>
                </div>
                <div style="width: 20%">
                  <h6 class="title">Pagado</h6>
                </div>
              </div>
              <div class="mt-2 r_body_detail_data" style="display: block">
              ${generateTrasactionsTemplate(object)}
              </div>
              <div class="row mt-4">
                <div class="col-md-1">

                </div>
                <div class="col-md-11" style="list-style: none; font-size: 13px;">
                  <div style="display: flex; flex-direction: row">
                    <div class="col-md-6">
                      <li>Total Mora</li>
                      <li>SubTotal</li>
                      <li>Descuento</li>
                      <li>Total</li>
                      <li>Monto Recibido</li>
                      <li>Total Pagado</li>
                      <li>Cambio</li>
                    </div>
                    <div class="col-md-6">
                      <ul style="list-style: none;">
                      <li>RD$ ${significantFigure(
                        parseFloat(object.totalMora).toFixed(2)
                      )}</li>
                      <li>RD$ ${significantFigure(
                        (
                          parseFloat(object.subTotal) +
                          parseFloat(object.totalMora)
                        ).toFixed(2)
                      )}</li>
                      <li>RD$ ${significantFigure(
                        parseFloat(object.discount).toFixed(2)
                      )}</li>
                      <li>RD$ ${significantFigure(
                        (
                          parseFloat(object.total) +
                          parseFloat(object.totalMora) -
                          parseFloat(object.discount)
                        ).toFixed(2)
                      )}</li>
                      <li>RD$ ${significantFigure(
                        parseFloat(object.receivedAmount).toFixed(2)
                      )}</li>
                      <li>RD$ ${significantFigure(
                        parseFloat(object.totalPayment).toFixed(2)
                      )}</li>
                      <li>RD$ ${
                        significantFigure(
                          parseFloat(object.cashBack).toFixed(2)
                        ) || 0
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
            Nota: Este recibo no es válido sin la firma y sello del cajero.
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
    console.log("AMORTIZATION TO RECEIPT", item);
    arr.push(`  
            <ul style="list-style: none; padding: 0">
              <li>
                <div style="display: flex">
                  <div style="width: 16%">
                    <h6 class="title">${item.quotaNumber}/${
      object.quotaAmount
    }</h6>
                  </div>
                  <div style="width: 30%">
                    <h6 class="title">${item.date
                      //.toISOString()
                      .split("T")[0]
                      .split("-")
                      .reverse()
                      .join("/")}</h6>
                  </div>
                  <div style="width: 19%">
                    <h6 class="title">${significantFigure(
                      parseFloat(item.amount).toFixed(2)
                    )}</h6>
                  </div>
                  <div style="width: 19%">
                    <h6 class="title">${significantFigure(
                      parseFloat(item.fixedMora).toFixed(2)
                    )}</h6>
                  </div>
                  <div style="width: 15%">
                    <h6 class="title">${significantFigure(
                      (
                        parseFloat(item.totalPaid) -
                        item.currentPaid +
                        parseFloat(item.totalPaidMora)
                      ).toFixed(2)
                    )}</h6>
                  </div
                </div>
              </li>
              <li>
                <div class="mt-2" style="display: flex; flex-direction: row; justify-content: space-around">
                <div style="">
                  <h5 style="font-size: 12px">Desc. Mora ${significantFigure(
                    parseFloat(item.discountMora).toFixed(2)
                  )}</h5>
                </div>
                <div style="">
                  <h5 style="font-size: 12px">Desc. Interes ${significantFigure(
                    parseFloat(item.discountInterest).toFixed(2)
                  )}</h5>
                </div>
                </div>
              </li>

            </ul>
    `);
  });

  console.log(arr.join(",").toString());

  return arr.length > 1
    ? arr.join(",").toString().replace(/,/g, "")
    : arr.join(",");
}

// async function splitAndUpdateLOB(str, size, db) {
//   var elements = Math.ceil(str.length / size);
//   console.log("Largo", elements);
//   var arr = new Array(elements);
//   var startPoint = 0;

//   const [id] = await db.sequelize.query(
//     `select max(loid::int) + 1 as current_id from pg_largeobject`
//   );

//   console.log("ID", id[0].current_id);

//   for (let i = 0; i < arr.length; i++) {
//     arr[i] = str.substr(startPoint, size);
//     console.log(`Element ${i}`, arr[i]);
//     await db.sequelize.query(
//       `insert into pg_largeobject(loid, pageno, data)
//        values (${id[0].current_id},${i} ,decode('${arr[i]}', 'escape'))`
//     );
//     startPoint += size;
//   }

//   console.log(arr.length);
//   return arr;
// }

function hasDecimal(num) {
  console.log("has decimal", !!(parseFloat(num) % 1));
  return !!(parseFloat(num) % 1);
}

function significantFigure(num) {
  let decimal;

  if (num) {
    num = num.toString();

    if (num.split(".").length > 0) {
      console.log("hola");
      decimal = num.split(".")[1];
      num = num.split(".")[0];
    }

    let styledNum = "";

    switch (num.length) {
      case 4:
        styledNum = separatorPlace(num, 1);
        break;
      case 5:
        styledNum = separatorPlace(num, 2);
        break;
      case 6:
        styledNum = separatorPlace(num, 3);
        break;
      case 7:
        styledNum = separatorPlace(num, 1, 4);
        break;
      case 8:
        styledNum = separatorPlace(num, 2, 5);
        break;
      case 9:
        styledNum = separatorPlace(num, 3, 6);
        break;
      default:
        styledNum = num;
        break;
    }

    console.log("FANCY FUNCTION", styledNum, typeof styledNum);

    if (decimal) {
      styledNum = styledNum + `.${decimal.toString()}`;
    } else {
      styledNum = styledNum + ".00";
    }

    return styledNum;
  } else {
    return 0;
  }
}

function separatorPlace(num, fPos, sPos) {
  let result = "";

  if (num.length <= 6) {
    for (let i = 0; i < num.length; i++) {
      i == fPos ? (result += ",") : undefined;
      result += num.charAt(i);
    }
  } else {
    for (let i = 0; i < num.length; i++) {
      i == fPos ? (result += ",") : undefined;
      i == sPos ? (result += ",") : undefined;
      result += num.charAt(i);
    }
  }

  return result;
}
