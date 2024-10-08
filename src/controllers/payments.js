const controller = {};
const db = require("../models/index");
const Sequelize = db.Sequelize;
const _ = require("lodash");

const Amortization = db.amortization;
const Payment = db.payment;
const ProcessNcf = db.processNcf;
const PaymentDetail = db.paymentDetail;
const Loan = db.loan;
const LoanPaymentAddress = db.loanPaymentAddress;
const Section = db.section;
const Receipt = db.receipt;
const ReceiptTransaction = db.receiptTransaction;
const PaymentRouterDetail = db.paymentRouterDetail;

//Accounting
const GeneralDiaryNumber = db.generalDiaryNumber;
const GeneralDiary = db.generalDiary;
const GeneralDiaryAccount = db.generalDiaryAccount;

const fs = require("fs");
const path = require("path");
const { result } = require("lodash");

controller.getPaymentsBySearchkey = async (req, res) => {
  const results = {};

  console.log("DATE", db.sequelize.fn("NOW"));

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
      `select l.loan_id, l.loan_number_id, count(quota_number) quota_amount, sum(amount_of_fee) as balance,
      l.number_of_installments as amount_of_quotas,l.outlet_id, reverse(split_part(reverse(la.loan_type),'_',1)) as loan_type
      from amortization a
    right join loan l on (l.loan_id = a.loan_id)
    join loan_application la on (la.loan_application_id = l.loan_application_id)
    where la.customer_id = '${customerId}'
    and a.outlet_id = l.outlet_id
    and l.status_type not in ('PAID', 'REFINANCE', 'DELETE')
    and l.loan_situation not in ('SEIZED')
    group by l.loan_number_id, l.loan_id, l.number_of_installments, l.outlet_id, la.loan_type`
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
      .query(`select a.amortization_id, a.quota_number,((a.amount_of_fee + a.mora) - a.discount) - (a.total_paid) as quota_amount, a.amount_of_fee,
      l.loan_number_id, a.capital, a.interest, a.mora, a.total_paid, a.total_paid_mora, a.discount, a.status_type, a.paid  
            from amortization a
            left join loan l on (a.loan_id = l.loan_id)
            where l.loan_number_id in (${loanNumbers.join()})
            and a.outlet_id = l.outlet_id 
            and a.paid='false'
            and a.status_type not like 'DELETE'
            order by a.loan_id, quota_number`);

    const [charges] = await db.sequelize
      .query(`select loan_charge_id as charge_id, l.loan_number_id as loan_number,  lch.amount as amount
      from loan_charge lch
      join charge ch on (lch.charge_id = ch.charge_id)
	    join loan l on (l.loan_id = lch.loan_id)
      where lch.loan_id in (select loan_id from loan where loan_number_id in (${loanNumbers.join()}))
      and lch.status_type ='CREATED'
	  group by l.loan_number_id, loan_charge_id, lch.amount`);

    const [gDiscount] = await db.sequelize.query(`select discount
    from amortization_discount
    where loan_id in (select loan_id from loan where loan_number_id in (${loanNumbers.join()}))
    and status_type = 'CREATED'`);

    console.log("CHARGES", charges);

    const [[{ end_ncf }]] = await db.sequelize.query(`
    select end_ncf 
    from ncf 
    where outlet_id = (select outlet_id from loan where loan_number_id = '${req.body.searchKey}' )
    and ncf_type_id = 2`);

    results.quotas = _.groupBy(quotas, (quota) => quota.loan_number_id);
    results.customer = client;
    results.loans = [...loans];
    results.charges = [...charges];
    if (end_ncf == undefined) {
      end_ncf = true;
    }
    results.isNcfAvailable = !end_ncf;
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
    `select max(quota_number) as quota from amortization where loan_id = '${req.body.payment.loanId}' and status_type not like 'DELETE'`
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

  const [amountOfQuotas] = await db.sequelize.query(
    `select number_of_installments as "amountOfQuotas" from loan where loan_id = '${req.body.payment.loanId}'`
  );

  const [isAccountingEnabled] = await db.sequelize.query(
    `select activation_date from outlet where outlet_id = '${req.body.payment.outletId}'`
  );

  var receiptPaymentId = "";
  let isLoanPaid = false;

  console.log("%%%%%%%%%%%%%%", req.body.payment);

  Payment.create({
    pay: req.body.payment.pay,
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
      //AQUI VA LA LOGICA DE NCF

      //CONSUMIENDO NCF
      db.sequelize
        .query(
          `
        SELECT ncf_id, to_ncf, next_ncf, prefix_ncf, end_ncf
        FROM ncf 
        WHERE outlet_id like '${req.body.payment.outletId}' and ncf_type_id = 2
        `
        )
        .then(async ([[ncf]]) => {
          console.log(ncf);

          if (ncf?.end_ncf == false) {
            if (parseInt(ncf.next_ncf) >= parseInt(ncf.to_ncf)) {
              await db.sequelize.query(
                `UPDATE ncf SET end_ncf = 'true' WHERE ncf_id = '${ncf.ncf_id}'`
              );
            }
            ProcessNcf.create({
              status_type: "CREATED",
              ncf_number: generateNCFNumber(ncf.next_ncf),
              payment_id: payment.dataValues.payment_id,
              outlet_id: req.body.payment.outletId,
              ncf_type_id: 2,
              created_by: req.body.payment.createdBy,
              last_modified_by: req.body.payment.lastModifiedBy,
            }).then(async (processNcf) => {
              console.log("NCF PROCESSED!");
              if (parseInt(ncf.next_ncf) < parseInt(ncf.to_ncf)) {
                await db.sequelize.query(
                  `UPDATE ncf SET next_ncf = ${
                    parseInt(ncf.next_ncf) + 1
                  } WHERE ncf_id = '${ncf.ncf_id}'`
                );
              }
            });
          }
        })
        .catch((err) => {
          console.log("ERROR CONSUMIENDO NCF ", err);
        });

      req.body.amortization.map(async (quota, index) => {
        Amortization.findOne({
          attributes: ["total_paid", "quota_number"],
          where: { amortization_id: quota.quotaId },
        })
          .then((totalPaid) => {
            if (
              parseInt(quota.quotaNumber) == parseInt(maxQuota[0].quota) &&
              quota.paid == true
            ) {
              isLoanPaid = true;

              Loan.update(
                {
                  status_type: "PAID",
                },
                {
                  where: {
                    loan_id: req.body.payment.loanId,
                  },
                }
              ).then(async () => {
                console.log("LOAN PAID");
                await db.sequelize.query(
                  `UPDATE customer_loan SET status_type='PAID' WHERE loan_id = '${req.body.payment.loanId}'`
                );
              });
            }
            Amortization.update(
              {
                paid: quota.paid,
                status_type: quota.statusType,
                //total_paid: quota.totalPaid,
                total_paid: quota.totalPaid - quota.discount,
                //last_modified_by: req.body.payment.lastModifiedBy,
                mora: quota.mora,
                total_paid_mora: quota.totalPaidMora,
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
                  //pay: parseFloat(req.body.payment.totalPaid),
                  pay:
                    quota.totalPaid -
                    quota.fixedTotalPaid +
                    (quota.totalPaidMora - quota.fixedTotalPaidMora),

                  pay_mora:
                    quota.discount > 0
                      ? // ? quota.totalPaidMora +
                        //   (quota.discount - quota.totalPaidMora)
                        quota.fixedMora
                      : quota.totalPaidMora - quota.fixedTotalPaidMora,
                  paid_mora_only: quota.payMoraOnly,
                  status_type: quota.fixedStatusType,
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
                              discount: parseFloat(item.discount),
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
                            // subTotal: (() => {
                            //   let result = 0;
                            //   bulkTransactions.map((item) => {
                            //     result += parseFloat(item.amount);
                            //   });

                            //   return result;
                            // })(),
                            // discount: (() => {
                            //   let result = 0;
                            //   bulkTransactions.map((item) => {
                            //     result += parseFloat(item.discount);
                            //   });
                            //   return result;
                            // })(),
                            // total: (() => {
                            //   let result = 0;
                            //   bulkTransactions.map((item) => {
                            //     result += parseFloat(item.amount);
                            //   });

                            //   return result;
                            // })(),
                            totalPaid:
                              req.body.payment.totalPaid -
                              req.body.payment.fixedTotalPaid +
                              (req.body.payment.totalPaidMora -
                                req.body.payment.fixedTotalPaidMora),
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
                            totalPaidMora:
                              req.body.payment.totalPaidMora -
                              req.body.payment.fixedTotalPaidMora,
                            pendingAmount: req.body.payment.pendingAmount,
                            receivedAmount: req.body.payment.receivedAmount,
                            cashBack: req.body.payment.change,
                            amortization: req.body.amortization,
                            quotaAmount: req.body.payment.quotaAmount,
                            amountOfQuotas: amountOfQuotas[0].amountOfQuotas,
                            payLoan: isLoanPaid,
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
                                    amountOfQuotas:
                                      amountOfQuotas[0].amountOfQuotas,
                                    // section.dataValues.name +
                                    // " " +

                                    //zone: zone[0].name,
                                  };

                                  //----------------Accounting--------------
                                  if (
                                    isAccountingEnabled[0].activation_date !=
                                    null
                                  ) {
                                    //Reservation of general_diary_number_id

                                    let maxDiaryNumberCol =
                                      await getLastDiaryNumbers(
                                        req.body.amortization
                                      );

                                    console.log(
                                      "GENERAL DIARY ID FROM GENERAL DIARY",
                                      maxDiaryNumberCol
                                    );

                                    let diaryBulkTransactions =
                                      await generateDiaryTransactions(
                                        maxDiaryNumberCol,
                                        req.body.amortization,
                                        {
                                          ...req.body.payment,
                                          customer:
                                            currentCustomer[0].first_name +
                                            " " +
                                            currentCustomer[0].last_name,
                                          payment_id:
                                            paymentDetail.dataValues.payment_id,
                                        }
                                      );
                                    GeneralDiary.bulkCreate(
                                      diaryBulkTransactions
                                    )
                                      .then(async (diary) => {
                                        console.log("$$$ hace dias", diary);

                                        let diaryAccountBulkTransactions =
                                          await setAccountingSeat(
                                            req.body.amortization,
                                            {
                                              ...req.body.payment,
                                              payment_id:
                                                paymentDetail.dataValues
                                                  .payment_id,
                                            },
                                            diary
                                          );
                                        console.log(
                                          "GENERAL DIARY ACCOUNT\n",
                                          diaryAccountBulkTransactions
                                        );
                                        GeneralDiaryAccount.bulkCreate(
                                          diaryAccountBulkTransactions
                                        )
                                          .then((generalDiaryAccount) => {
                                            res.send(results);
                                          })
                                          .catch((err) => {
                                            console.log(err);
                                          });
                                      })
                                      .catch((err) => {
                                        console.log(err);
                                      });
                                  } else {
                                    res.send(results);
                                  }
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

controller.payCharge = async (req, res) => {
  try {
    let receiptNumber = generateReceiptNumber();

    let [data] = await db.sequelize
      .query(`select loan_charge_id as charge_id,ch.name, ch.description, l.loan_number_id as loan_number, lch.amount as amount, lch.status_type
    from loan_charge lch
    join charge ch on (lch.charge_id = ch.charge_id)
    join loan l on (l.loan_id = lch.loan_id)
    where lch.loan_charge_id = '${req.body.loanChargeId}'
    and lch.status_type ='CREATED'
  group by l.loan_number_id, loan_charge_id, ch.name, ch.description, lch.amount, lch.status_type`);

    await db.sequelize.query(`update loan_charge
    set status_type = 'PAID'
    where loan_charge_id = '${req.body.loanChargeId}'`);

    let result = {
      ...data[0],
      receiptNumber,
    };

    res.send(result);
  } catch (error) {
    res.send({
      message: error.message,
      error: true,
    });
  }
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

function generateNCFNumber(number) {
  let ncf = `B02`;

  for (let i = 0; i < 8 - number.toString().length; i++) {
    ncf += "0";
  }

  ncf += number.toString();

  return ncf;
}

async function getLastDiaryNumbers(amortization) {
  try {
    let selectString = `SELECT nextval('general_diary_number_general_diary_number_id_seq'::regclass) as "1" `;

    // for (let a = 0; a < amortization.length; a++) {
    //   if (a > 0) {
    //     selectString += ", \n";
    //   }

    //   selectString += `nextval('general_diary_number_general_diary_number_id_seq'::regclass) as "${
    //     a + 1
    //   }"`;
    // }

    let [maxDiaryNumberCol, meta] = await db.sequelize.query(selectString);

    console.log(
      "GENERAL DIARY NUMBER SEQUENCE> ",
      Object.values(maxDiaryNumberCol[0])
    );

    let result = Object.values(maxDiaryNumberCol[0]);
    let generealDiaryNumberBulk = result.map((item) => ({
      general_diary_number_id: parseInt(item),
    }));

    await GeneralDiaryNumber.bulkCreate(generealDiaryNumberBulk);
    return result;
  } catch (error) {
    console.log("ERROR % GENERAL DIARY NUMBER SEQUENCE", error);
  }
}

async function generateDiaryTransactions(maxDiaryNumbers, dues, payment) {
  let rows = [];

  rows.push({
    general_diary_number_id: maxDiaryNumbers[0],
    general_diary_type: "AUTO",
    description: `Pago recibido Prestamo ${payment.loanType} Préstamo No. ${payment.loanNumber} - ${payment.customer}`,
    comment: "Registro AUTO generado desde la APP",
    total: payment.pay,
    status_type: "ENABLED",
    created_by: payment.createdBy,
    last_modified_by: payment.lastModifiedBy,
    accoun_number_id: null,
    outlet_id: payment.outletId,
    payment_id: payment.payment_id,
  });

  // for (let i = 0; i < dues.length; i++) {
  //   rows.push({
  //     general_diary_number_id: maxDiaryNumbers[i],
  //     general_diary_type: "AUTO",
  //     description: `Pago recibido Prestamo ${payment.loanType} Préstamo No. ${payment.loanNumber} - ${payment.customer}`,
  //     comment: "Registro AUTO generado desde la APP",
  //     total:
  //       dues[i].totalPaid +
  //       dues[i].totalPaidMora -
  //       dues[i].fixedTotalPaid -
  //       dues[i].fixedTotalPaidMora,
  //     status_type: "ENABLED",
  //     created_by: payment.createdBy,
  //     last_modified_by: payment.lastModifiedBy,
  //     accoun_number_id: null,
  //     outlet_id: payment.outletId,
  //     payment_id: payment.payment_id,
  //   });
  // }

  return rows;
}

async function setAccountingSeat(dues, payment, diaryIds) {
  let rows = [];
  let result = [];

  const [accountCatalog] = await db.sequelize.query(
    `SELECT *
    FROM account_catalog
    WHERE outlet_id = '${payment.outletId}'
    ORDER BY number`
  );

  const isPayingMora =
    dues.filter((due) => due.totalPaidMora - due.fixedTotalPaidMora > 0)
      .length > 0
      ? true
      : false;
  const [accounts] = await db.sequelize.query(
    `SELECT account_determination_id,transaction_account, split_part(transaction_account,'_',1) account_target, 
    ad.account_catalog_id, ad.status_type, ad.outlet_id, ad.name, ac.number, ac.name
    FROM account_determination ad
    JOIN account_catalog ac ON (ad.account_catalog_id = ac.account_catalog_id)
    WHERE ad.outlet_id = '${payment.outletId}'
    AND  split_part(transaction_account,'_',1) IN ('${
      payment.loanType
    }','GENERAL' ${isPayingMora ? ", 'LATE'" : ""})`
  );

  console.log("ROWS GENERAL DIARY ACCOUNT LENGTH", dues.length);
  for (let i = 0; i < dues.length; i++) {
    accounts.map((account) => {
      let debit = 0;
      let credit = 0;

      switch (account.number[0]) {
        case "4":
          if (account.name.toLowerCase().includes("mora")) {
            credit = dues[i].totalPaidMora - dues[i].fixedTotalPaidMora;
          } else {
            if (dues[i].fixedTotalPaid >= dues[i].interest) {
              credit = 0;
            } else {
              if (
                dues[i].totalPaid - dues[i].fixedTotalPaid >=
                dues[i].interest - dues[i].fixedTotalPaid
              ) {
                credit = dues[i].interest - dues[i].fixedTotalPaid;
              } else {
                credit = dues[i].totalPaid - dues[i].fixedTotalPaid;
              }
            }
          }
          break;
        case "2":
          if (dues[i].fixedTotalPaid >= dues[i].interest) {
            debit = 0;
          } else {
            if (
              dues[i].totalPaid - dues[i].fixedTotalPaid >=
              dues[i].interest - dues[i].fixedTotalPaid
            ) {
              debit = dues[i].interest - dues[i].fixedTotalPaid;
            } else {
              debit = dues[i].totalPaid - dues[i].fixedTotalPaid;
            }
          }
          break;
        case "1":
          if (account.name.toLowerCase().includes("caja")) {
            debit =
              dues[i].totalPaid -
              dues[i].fixedTotalPaid +
              dues[i].totalPaidMora -
              dues[i].fixedTotalPaidMora;
          } else {
            credit = dues[i].totalPaid - dues[i].fixedTotalPaid;
          }
          break;

        default:
          break;
      }

      rows.push({
        account_catalog_id: account.account_catalog_id,
        debit,
        credit,
      });
      console.log("ROWS GENERAL DIARY ACCOUNT", rows);
    });

    // for (let o = 0; o < rows.length; o++) {
    //   let accountsToUpdate = [];

    //   // console.log(accountCatalog);
    //   let parents = getParentAccounts(rows[o], accountCatalog);

    //   console.log(
    //     rows[o].account_catalog_id,
    //     parents.map(({ account_catalog_id, name }) => ({
    //       account_catalog_id,
    //       name,
    //     }))
    //   );

    //   // await db.sequelize.query(`
    //   // update account_catalog
    //   // set balance =
    //   // where account_catalog_id = '${rows[o].account_catalog_id}'`)
    // }
  }

  console.log("ROWS GENERAL DIARY ACCOUNT", rows);

  for (item of accounts) {
    let calcDebit = rows
      .filter((a) => a.account_catalog_id == item.account_catalog_id)
      .reduce((acc, b) => acc + b.debit, 0);

    let calcCredit = rows
      .filter((a) => a.account_catalog_id == item.account_catalog_id)
      .reduce((acc, b) => acc + b.credit, 0);

    if (payment.globalDiscount > 0) {
      switch (item.number[0]) {
        case "1":
          if (item.name.toLowerCase().includes("caja")) {
            calcDebit = calcDebit - payment.globalDiscount;
          } else {
            calcCredit = calcCredit;
          }
          break;
        case "2":
          calcDebit = calcDebit;
          break;
        case "4":
          if (item.name.toLowerCase().includes("interes")) {
            calcCredit = calcCredit - payment.globalDiscount;
          }
          break;
        default:
          break;
      }
    }

    result.push({
      general_diary_id: diaryIds[0].dataValues.general_diary_id,
      account_catalog_id: item.account_catalog_id,
      debit: calcDebit,
      credit: calcCredit,
      status_type: "ENABLED",
      created_by: payment.createdBy,
      last_modified_by: payment.lastModifiedBy,
      reconcile: false,
    });
  }

  return result;
}

function getParentAccounts(account, catalog) {
  let accounts = [];

  let currentAccount = catalog.filter(
    (a) => a.account_catalog_id === account.account_catalog_id
  )[0];

  let parent = catalog.filter(
    (catalogAccount) =>
      currentAccount.control_account == catalogAccount.account_catalog_id
  );

  console.log(parent);

  if (parent.length > 0) {
    if (parent[0].control_account != null) {
      accounts.push(getParentAccounts(parent[0], catalog));
    }
    // } else {
    //   accounts.push(parent[0]);
    // }
  }

  return accounts;
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
  <html>
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

      .tran_container  {
          max-width: 240px;
        
      }

      .tran_container span {
        font-size: 14px; 
        font-weight: normal;

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
            <div class="col-md-6">
              <div>
                <h6 class="title">Cantidad de cuotas</h6>
                <h6>${object.amountOfQuotas}</h6>
              </div>
            </div>
          </div>
          </div>
          <div class="r_body_detail">
            <div class="r_section" style="background-color:  #fff">
              <h6 class="text-dark title">Transacciones</h6>
            </div>
            <div class="r_body_detail_headers" style="width: 100%; font-weight: bold; padding: 10px">

              ${generateDetail(object)}
              <div class="row mt-4">
                <div class="col-md-1">

                </div>
                <div class="col-md-12" style="list-style: none; font-size: 13px; ">
                  <div style="display: flex; flex-direction: row; justify-content: flex-end">
                    <div class="col-md-5" style="text-align: right;">
                      <li>Mora Pagada:</li>
                      <li style="background-color: black; color: white">Total Pagado:</li>
                      <li>Monto Recibido:</li>
                    </div>
                    <div class="p-0 col-md-5">
                      <ul style="list-style: none; padding: 0; text-align: right;">
                      <li>${significantFigure(
                        object.totalPaidMora?.toFixed(2)
                      )}</li>
                      <li style="background-color: black; color: white">${significantFigure(
                        object.totalPaid?.toFixed(2)
                      )}</li>
                      <li>${significantFigure(
                        object.receivedAmount?.toFixed(2)
                      )}</li>
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

function generateDetail(object) {
  if (object.payLoan == true) {
    return `<div style="text-align: center">
              <span>-- Saldo de préstamo  --</span>
            </div>`;
  } else {
    return `<div class="row">
    <div style="display: flex; justify-content: space-between;">
      <h6 class="title">Cuotas Pagadas</h6>
      <h6 class="title">Monto</h6>
    </div>
    <div style="display: flex; justify-content: space-between;">
      <div class="tran_container">
        ${generateTrasactionsTemplate(object, "PAID")}
    </div>
    <div class="tran_amount tran_container">
      <span>${getTransactionAmount(object.amortization, "PAID")}</span>
    </div>
    </div>
    
    <div style="display: flex; justify-content: space-between;">
      <h6 class="title">Abono a cuota</h6>
      <h6 class="title">Monto</h6>
    </div>
    <div style="display: flex; justify-content: space-between;">
      <div class="tran_container">
      ${generateTrasactionsTemplate(object, "COMPOST", "DEFEATED")}
    </div>
    <div class="tran_amount tran_container">
      <span>${getTransactionAmount(
        object.amortization,
        "COMPOST",
        "DEFEATED"
      )}</span>
    </div>
    </div>
  </div>`;
  }
}

function generateTrasactionsTemplate(object, status, status2) {
  let arr = [];

  //let transactionTemplate = `<div></div>`;
  object.amortization
    ?.filter(
      (i) => i.statusType == status || (status2 && i.statusType == status2)
    )
    .map((item, index) => {
      console.log("AMORTIZATION TO RECEIPT", item);

      switch (index) {
        case object.amortization?.filter(
          (i) => i.statusType == status || (status2 && i.statusType == status2)
        ).length - 2:
          arr.push(`<span>${item.quotaNumber} y </span>`);
          break;
        case object.amortization?.filter(
          (i) => i.statusType == status || (status2 && i.statusType == status2)
        ).length - 1:
          arr.push(`<span>${item.quotaNumber}</span>`);
          break;

        default:
          arr.push(`<span>${item.quotaNumber}, </span>`);
          break;
      }
    });

  console.log(arr.join(" ").toString());

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

function getTransactionAmount(quotas, status, status2) {
  let amount = quotas
    .filter((i) => i.statusType == status || i.statusType == status2)
    .reduce((acc, i) => acc + i.totalPaid - i.fixedTotalPaid, 0);

  return significantFigure(
    (((amount + Number.EPSILON) * 100) / 100).toFixed(2)
  );
}
