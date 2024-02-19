const db = require("../models");
const GeneralDiaryNumber = db.generalDiaryNumber;
const GeneralDiary = db.generalDiary;
const GeneralDiaryAccount = db.generalDiaryAccount;

const controller = {};

controller.procesoActualizarAsientosContables = async (req, res) => {
  try {
    const [data] = await db.sequelize
      .query(`select distinct(am.amortization_id), la.loan_type, l.loan_number_id,  c.first_name || ' ' || c.last_name customer_name, 
      quota_number, am.total_paid as pay, total_paid_mora as paid_mora, max(p.created_date) as created_date, 
      min(p.created_by) created_by, min(p.last_modified_by) last_modified_by, p.outlet_id, p.payment_id
      from amortization am
      join loan l on (am.loan_id = l.loan_id)
      join loan_application la on (l.loan_application_id = la.loan_application_id)
      join customer c on (la.customer_id = c.customer_id)
      join payment_detail pd on (am.amortization_id = pd.amortization_id)
      join payment p on (pd.payment_id = p.payment_id and extract(year from p.created_date) = 2024)
      where am.amortization_id in (
      select distinct(amortization_id)
      from payment_detail
      where payment_id in (select payment_id
                      from payment p
                      join loan l on (p.loan_id = l.loan_id)
                      where extract(year from p.created_date) = 2024
                      and p.status_type = 'ENABLED'
                      and p.outlet_id in ('9fb4a5c4-5e46-4bb8-8ba8-b730803939d8', 
                                        '857b8b3b-d603-4474-9b35-4a90277d9bc0', 
                                        '11d63958-e505-49c6-8cd5-09e8d8ae0776')
                      and l.status_type <> 'DELETE'))
      group by am.amortization_id, l.loan_number_id, la.loan_type, c.first_name, c.last_name, p.outlet_id, p.payment_id
      order by l.loan_number_id desc, quota_number desc
      limit 1500
      offset 1`);

    // data.dataValues.map((item) => {
    //   console.log(item);
    // });
    console.log(data);
    //res.send(data);

    //Reservation of general_diary_number_id

    let maxDiaryNumberCol = await getLastDiaryNumbers(data);

    console.log("GENERAL DIARY ID FROM GENERAL DIARY", maxDiaryNumberCol);

    let diaryBulkTransactions = await generateDiaryTransactions(
      maxDiaryNumberCol,
      data
    );
    GeneralDiary.bulkCreate(diaryBulkTransactions)
      .then(async (diary) => {
        console.log("$$$ hace dias", diary);

        // let diaryAccountBulkTransactions = await setAccountingSeat(
        //   data,
        //   {
        //     ...req.body.payment,
        //     payment_id: paymentDetail.dataValues.payment_id,
        //   },
        //   diary
        // );

        res.send(data);
        // GeneralDiaryAccount.bulkCreate(diaryAccountBulkTransactions)
        //   .then((generalDiaryAccount) => {
        //     res.send(results);
        //   })
        //   .catch((err) => {
        //     console.log(err);
        //   });
      })
      .catch((err) => {
        console.log(err);
      });
  } catch (error) {
    console.log(error);
    //res.send({ error });
  }
};

async function getLastDiaryNumbers(amortization) {
  try {
    let selectString = "SELECT ";

    for (let a = 0; a < amortization.length; a++) {
      if (a > 0) {
        selectString += ", \n";
      }

      selectString += `nextval('general_diary_number_general_diary_number_id_seq'::regclass) as "${
        a + 1
      }"`;
    }

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

async function generateDiaryTransactions(maxDiaryNumbers, dues) {
  let rows = [];

  for (let i = 0; i < dues.length; i++) {
    rows.push({
      general_diary_number_id: maxDiaryNumbers[i],
      general_diary_type: "AUTO",
      description: `Pago recibido Prestamo ${dues[i].loan_type} Préstamo No. ${
        dues[i].loan_number_id
      } - ${
        dues[i].customer_name.split(" ").length > 4
          ? `${dues[i].customer_name.split(" ")[0]} ${
              dues[i].customer_name.split(" ")[1]
            } ${dues[i].customer_name.split(" ")[2]} ${
              dues[i].customer_name.split(" ")[3]
            }`
          : dues[i].customer_name
      }`,
      comment: "Registro AUTO generado por el sistema - migrado",
      total: dues[i].pay,
      general_diary_date: dues[i].created_date,
      created_date: dues[i].created_date,
      //   dues[i].totalPaid +
      //   dues[i].totalPaidMora -
      //   dues[i].fixedTotalPaid -
      //   dues[i].fixedTotalPaidMora,
      status_type: "ENABLED",
      created_by: dues[i].created_by,
      last_modified_by: dues[i].last_modified_by,
      accoun_number_id: null,
      outlet_id: dues[i].outlet_id,
      payment_id: dues[i].payment_id,
    });
  }

  return rows;
}
async function setAccountingSeat(dues, payment, diaryIds) {
  let rows = [];

  const [accountCatalog] = await db.sequelize.query(
    `SELECT *
      FROM account_catalog
      WHERE outlet_id = '${payment.outletId}'
      ORDER BY number`
  );

  const isPayingMora =
    dues.filter((due) => due.pay_mora > 0).length > 0 ? true : false;
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

  for (let i = 0; i < dues.length; i++) {
    accounts.map((account) => {
      let debit = 0;
      let credit = 0;

      switch (account.number[0]) {
        case "4":
          if (account.name.toLowerCase().includes("mora")) {
            credit = dues[i].pay_mora;
          } else {
            credit = dues[i].pay;
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
        general_diary_id: diaryIds[i].dataValues.general_diary_id,
        account_catalog_id: account.account_catalog_id,
        debit,
        credit,
        status_type: "ENABLED",
        created_by: payment.createdBy,
        last_modified_by: payment.lastModifiedBy,
        reconcile: false,
      });
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
  return rows;
}

module.exports = controller;
