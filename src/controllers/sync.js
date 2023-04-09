const db = require("../models/index");
const _ = require("lodash");
let controller = {};

controller.getCustomers = async (req, res) => {
  let [customers, metaCutomer] = await db.sequelize.query(
    `SELECT DISTINCT(la.customer_id) AS customer_id, c.first_name,c.last_name,c.birth_date, c.email, p.name as province, m.name as municipality, s.name as section, c.phone, c.mobile, identification, l.loan_number_id, l.loan_id, l.loan_payment_address_id,
        lp.street, lp.street2, loan_situation, c.image_url, lb.name as business, '${req.params.employeeId}' as employee_id
        FROM loan_application la
        LEFT JOIN loan_business lb on (la.loan_application_id = lb.loan_business_id)
        JOIN customer c on (c.customer_id = la.customer_id)
        join province p on (p.province_id = c.province_id)
        join municipality m on (m.municipality_id = c.municipality_id)
        join section s on (s.section_id = c.section_id)
        join loan l on (la.loan_application_id = l.loan_application_id and l.status_type not in ('DELETE', 'PAID'))
        join loan_payment_address lp on (lp.loan_id = l.loan_id)
        where lp.section_id in 	(select cast(section_id as int) 
                                from zone_neighbor_hood 
                                where zone_id in (select zone_id
                                                  from employee_zone
                                                  where employee_id='${req.params.employeeId}'
                                                  and status_type = 'ENABLED'
                                                  ))	
        and la.outlet_id=(select outlet_id from employee where employee_id='${req.params.employeeId}')
        order by c.first_name`
  );

  // let [customerInfo] = await db.sequelize.query();

  //console.log(customers);

  let results = {
    customers: [...customers],
    loans: [],
  };

  console.log(results);

  res.send(results);
};

controller.getAmortization = async (req, res) => {
  let results = {};

  let [loans] = await db.sequelize
    .query(`select l.loan_id, c.customer_id, l.loan_number_id, l.number_of_installments as amount_of_quotas, loan_situation, amount_approved, l.amount_of_free, '${req.params.employeeId}' as employee_id
  from loan_application la
  join customer c on (c.customer_id = la.customer_id)
join loan l on (la.loan_application_id = l.loan_application_id)
  where la.loan_application_id in (select loan_application_id
                              from loan l
          join loan_payment_address lp on (lp.loan_id = l.loan_id)
          and lp.section_id in (select cast(section_id as int) 
                  from zone_neighbor_hood 
                  where zone_id in (select zone_id
                            from employee_zone
                            where employee_id='${req.params.employeeId}')))	
      and la.outlet_id=(select outlet_id from employee where employee_id='${req.params.employeeId}')`);

  let loanNumbers = [];

  loans.map((loan) => {
    loanNumbers.push(loan.loan_number_id);
  });

  const [quotas, metaQuota] = await db.sequelize
    .query(`select a.amortization_id, l.loan_number_id, amount_of_fee as quota_amount, ((amount_of_fee - total_paid) + mora) - a.discount as current_fee, 
      quota_number, a.created_date as date, 
      mora , payment_date, discount_mora, discount_interest, amount_of_fee - total_paid as fixed_amount, a.status_type, a.total_paid as current_paid,
      total_paid_mora, '${req.params.employeeId}' as employee_id      
      from amortization a
      left join loan l on (a.loan_id = l.loan_id)
      where l.loan_number_id in (${loanNumbers.join()})
      and a.outlet_id = l.outlet_id 
      and a.paid='false'
      order by a.loan_id, quota_number`);

  const [charges] = await db.sequelize
    .query(`select loan_charge_id as charge_id, l.loan_number_id as loan_number, sum(ch.amount) as amount, '${
    req.params.employeeId
  }' as employee_id
    from loan_charge lch
    join charge ch on (lch.charge_id = ch.charge_id)
    join loan l on (l.loan_id = lch.loan_id)
    where lch.loan_id in (select loan_id from loan where loan_number_id in (${loanNumbers.join()}))
    and lch.status_type ='CREATED'
  group by l.loan_number_id, loan_charge_id`);

  const [gDiscount] = await db.sequelize
    .query(`select discount, l.loan_number_id, '${
    req.params.employeeId
  }' as employee_id
    from amortization_discount ad
    join loan l on (ad.loan_id = l.loan_id)
    where ad.loan_id in (select loan_id from loan where loan_number_id in (${loanNumbers.join()}))
    and ad.status_type = 'CREATED'`);

  results.loans = loans;
  //results.quotas = _.groupBy(quotas, (quota) => quota.loan_number_id);
  results.quotas = quotas;
  //results.charges = _.groupBy(charges, (charge) => charge.loan_number);
  results.charges = charges;
  // results.globalDiscount = _.groupBy(
  //   gDiscount,
  //   (discount) => discount.loan_number_id
  // );
  results.globalDiscount = gDiscount;
  res.send(results);
};

module.exports = controller;
