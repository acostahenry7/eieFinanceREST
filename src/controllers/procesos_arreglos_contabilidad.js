const db = require("../models");
const GeneralDiaryNumber = db.generalDiaryNumber;
const GeneralDiary = db.generalDiary;
const GeneralDiaryAccount = db.generalDiaryAccount;

const controller = {};

controller.generalBoxMissingFixer = async (req, res) => {
  try {
    const [data] = await db.sequelize.query(`
    select general_diary_number_id, general_diary_id, '0b24bae5-83c7-42dc-9069-1f0ea961605a' as account_catalog_id, total as debit, 0.00 as credit, created_by,
    created_by as last_modified_by
    from general_diary where payment_id in( 
    select gd.payment_id
    from payment p
    left join general_diary gd on (p.payment_id = gd.payment_id)
    left join general_diary_account gda on (gd.general_diary_id = gda.general_diary_id)
    left join account_catalog ac on (gda.account_catalog_id = ac.account_catalog_id)
    --left join lan
    where p.created_by = 'j.berroa'
    and p.created_date::date between '2024-02-19' and '2024-02-19'
    and p.status_type = 'ENABLED'
    and gd.status_type = 'ENABLED'
    and p.outlet_id = '11d63958-e505-49c6-8cd5-09e8d8ae0776'
    group by p.payment_id, gd.payment_id
    having p.pay <> coalesce(sum(debit) filter(where ac.number = '1101'),0))
        `);

    console.log(data);
    let counter = 0;
    for (item of data) {
      counter++;
      await GeneralDiaryAccount.create({
        general_diary_id: item.general_diary_id,
        account_catalog_id: item.account_catalog_id,
        debit: item.debit,
        credit: item.credit,
        status_type: "ENABLED",
        created_by: item.created_by,
        last_modified_by: item.last_modified_by,
        reconcile: false,
      });
      console.log(counter + " de " + data.length);
    }

    return res.send({ msg: "Everythin OK" });
  } catch (error) {
    return "error";
  }
};

module.exports = controller;
