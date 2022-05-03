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
    whereClause = `where employee_id='${req.params.employeeId}'))`;
    //andCla
    //}

    console.log("Employee ID", req.params.employeeId);
    let query = "";
    if (req.params.employeeId == '0') {
      query = `SELECT DISTINCT(la.customer_id) AS customer_id, c.first_name,last_name,  identification, street, c.qr_code, c.image_url
                    FROM loan_application la
                    JOIN customer c on (la.customer_id = c.customer_id)`;
    } else {
      query = `SELECT DISTINCT(la.customer_id) AS customer_id, c.first_name,last_name, identification, street, loan_situation, c.image_url
                    FROM loan_application la
                    JOIN customer c on (c.customer_id = la.customer_id)
                    join loan l on (la.loan_application_id = l.loan_application_id)
                    join loan_payment_address lp on (lp.loan_id = l.loan_id)
                    where lp.section_id in 	(select cast(section_id as int) 
                                            from zone_neighbor_hood 
                                            where zone_id in (select zone_id
                                                              from employee_zone
                                                              where employee_id='${req.params.employeeId}'))	
                    and la.outlet_id=(select outlet_id from employee where employee_id='${req.params.employeeId}')`;
    }
    
    try {
      const [data, meta] = await db.sequelize.query(query);

      
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
      console.log(data[index]);
      item.loan_situation == "ARREARS" ? results.loans.push(data[index]) : "";
    });

    key = "customer_id";

    results.customers = [
      ...new Map(results.customers.map((item) => [item[key], item])).values(),
    ];

    res.send(results);

    } catch (error) {
      console.log("Admin customers", error);
    }
   

  }
};

controller.getCustomerById = async (req, res) => {
  console.log(req.params.id);
  const results = {};

  const [customer, metadata] = await db.sequelize.query(
    `SELECT customer_id as key, identification, first_name, last_name, birth_date, email, p.name as province, m.name as municipality, s.name as section, street, street2, phone, mobile, status_type, image_url
    from customer c
    join province p on (p.province_id = c.province_id)
    join municipality m on (m.municipality_id = c.municipality_id)
    join section s on (s.section_id = c.section_id)
    where customer_id = '${req.body.id}'`
  );

  const [loan, meta] = await db.sequelize.query(
    `select * from loan 
          where loan_application_id in (select loan_application_id 
                                        from loan_application
                                        where customer_id = '${req.body.id}')
          and outlet_id=(select outlet_id from employee where employee_id='${req.body.employeeId}')
          and status_type != 'PAID'`
  );

  results.customerInfo = customer[0];
  results.customerLoans = [...loan];

  res.send(results);
};

module.exports = controller;
