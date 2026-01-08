const controller = {};

const db = require("../models/index");

controller.getCustomersByEmployeeId = async (req, res) => {
  {
    if (!req.query.offset) {
      req.query.offset = 1;
    }

    if (!req.query.limit) {
      req.query.limit = 100;
    }

    var offset = parseInt(req.query.offset);
    var limit = parseInt(req.query.limit);

    const startIndex = (offset - 1) * limit;
    const endIndex = offset * limit;

    let whereClause;

    //    whereClause = `where 1 = 1`
    //}else {
    whereClause = `where employee_id='${req.params.employeeId}'`;
    //andCla

    if (req.params.employeeId == 0) {
      whereClause = "where 1 = 1";
    }
    //}

    //console.log("Employee ID", req.params.employeeId);
    let query = "";
    //if (req.params.employeeId == "0") {
    query = `select distinct(customer_id), min(identification) as identification, min(loan_id) as loan_id, min(loan_number_id) as loan_number_id,  
    min(first_name) as first_name, min(last_name) as last_name, min(loan_payment_address_id) as loan_payment_address_id, min(street) as street,
    min(street2) as street2, min(loan_situation) as loan_situation, min(image_url) as image_url, min(payment_address_type) as payment_address_type,
    min(province) as province, min(municipality) as municipality, min(section) as section, min(business) as business, min(qr_code) as qr_code,
	min(outlet) as outlet
    from 
    (select la.customer_id, c.identification, l.loan_id, l.loan_number_id, c.first_name , c.last_name,
          l.loan_payment_address_id, lpa.street, lpa.street2, l.loan_situation, c.image_url,
          lpa.payment_address_type, p.name as province, m.name as municipality, s.name as section, lb.name as business, c.qr_code, o.name as outlet
          from loan l 
          join loan_payment_address lpa on l.loan_payment_address_id = lpa.loan_payment_address_id
          join loan_application la on l.loan_application_id = la.loan_application_id
          join province p on (lpa.province_id = p.province_id)
          join municipality m on (lpa.municipality_id = m.municipality_id)
          join section s on (lpa.section_id = s.section_id)
          join customer c on la.customer_id = c.customer_id
	 	  join outlet o on (l.outlet_id = o.outlet_id)
          left join loan_business lb on (la.loan_application_id = lb.loan_business_id)
          where lpa.section_id in (
            select section_id
            from zone_neighbor_hood
            where zone_id in(
              select ez.zone_id
              from employee_zone ez
              join zone z on ez.zone_id = z.zone_id
              where employee_id='${req.params.employeeId}'
			  and z.outlet_id in (
				  select outlet_id from employee_outlet where employee_id = '${req.params.employeeId}'
				  union
				  select outlet_id from employee where employee_id = '${req.params.employeeId}'
			  )
              and z.status_type = 'ENABLED'
              and ez.status_type = 'ENABLED')
            and status_type = 'ENABLED'
            order by section_id)
          and l.status_type not in ('PAID', 'REFINANCE', 'DELETE')
          and l.loan_situation not in ('SEIZED')
          
          and l.outlet_id = (select z.outlet_id
              from employee_zone ez
              join zone z on ez.zone_id = z.zone_id
              where employee_id='${req.params.employeeId}'
			  and z.outlet_id in ( 
				  select outlet_id from employee_outlet where employee_id = '${req.params.employeeId}'
				  union
				  select outlet_id from employee where employee_id = '${req.params.employeeId}')
              and z.status_type = 'ENABLED'
              and ez.status_type = 'ENABLED')
          order by l.created_date desc, c.first_name) t1
        group by customer_id
        order by first_name
        `;
    //}

    try {
      const [data, meta] = await db.sequelize.query(query);

      console.log(data);
      const results = {};

      if (endIndex < data.length) {
        var nextOffset = offset + 1;
        results.next = `http://10.1.102.106:3000/customers/main/${req.params.employeeId}?limit=${limit}&offset=${nextOffset}`;
      }

      if (startIndex > 0) {
        results.previous = {
          offset: offset - 1,
          limit: limit,
        };
      }

      results.customers = data.slice(startIndex, endIndex);

      results.loans = [];

      data.find((item, index) => {
        //console.log(data[index]);
        item.loan_situation == "ARREARS" ? results.loans.push(data[index]) : "";
      });

      key = "customer_id";

      results.customers = [
        ...new Map(results.customers.map((item) => [item[key], item])).values(),
      ];

      res.send(results);
    } catch (error) {
      console.log(error);
      //console.log("Admin customers", error);
    }
  }
};

controller.getCustomerById = async (req, res) => {
  //console.log(req.params.id);
  const results = {};
  console.log(req.body);

  const [customer, metadata] = await db.sequelize.query(
    `SELECT customer_id as key, identification, first_name, last_name, birth_date, email, p.name as province, m.name as municipality, 
    s.name as section, street, street2, phone, mobile, status_type, image_url
    from customer c
    join province p on (p.province_id = c.province_id)
    join municipality m on (m.municipality_id = c.municipality_id)
    join section s on (s.section_id = c.section_id)
    where customer_id = '${req.body.id}'`
  );

  const [loan, meta] = await db.sequelize.query(
    `select * from loan 
          where loan_application_id in (select la.loan_application_id 
                                        from loan_application la
                                        join loan l on (la.loan_application_id = l.loan_application_id)
                                        join loan_payment_address lp on (lp.loan_id = l.loan_id)
                                        where la.customer_id = '${req.body.id}'
                                        and lp.section_id in (select cast(section_id as int) 
                                        from zone_neighbor_hood 
                                        where zone_id in (select zone_id
                                                  from employee_zone
                                                  where employee_id='${req.body.employeeId}')))
          and outlet_id=(select outlet_id from employee where employee_id='${req.body.employeeId}')
          and status_type not in ('PAID', 'REFINANCE', 'DELETE')
          and loan_situation not in ('SEIZED')`
  );

  results.customerInfo = customer[0];
  results.customerLoans = [...loan];

  res.send(results);
};

module.exports = controller;
