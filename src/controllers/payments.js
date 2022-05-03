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
                        html: receiptId[0].nextHtml,
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
                              discount: parseFloat(item.discountInterest)+ parseFloat(item.discountMora),
                              total_paid: item.totalPaid,
                              discount_interest: item.discountInterest,
                              discount_mora: item.discountMora
                            });
                          });

                          ReceiptTransaction.bulkCreate(bulkTransactions).then(
                            (receiptTransaction) => {
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
                            }
                          ).catch(err => console.log(err));
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
    paymentTotal += quota.totalPaid;
  });

  return paymentTotal;
}
