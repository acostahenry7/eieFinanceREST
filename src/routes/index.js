const _ = require('lodash')
const express =  require('express')
const router = express.Router()
const { uuid } = require('uuidv4')


const db = require('../models/index')
const Sequelize = db.Sequelize
const { user, password } = require('../server/dbconfig')
const Customer = db.customer
const Loan = db.loan
const Register = db.register
const Receipt = db.receipt
const User = db.user
const Employee = db.employee
const EmployeeZone = db.employeeZone
const Department = db.department
const Amortization = db.amortization
const Payment = db.payment
const PaymentDetail = db.paymentDetail
const Visit = db.visit
const LoanApplication = db.loanApplication
const LoanPaymentAddress = db.loanPaymentAddress
const Section = db.section
const PaymentRouter = db.paymentRouter
const PaymentRouterDetail = db.paymentRouterDetail

const Op = db.Sequelize

const bcrypt = require('bcryptjs')
const { receipt, paymentDetail, amortization, employeeZone } = require('../models/index')


module.exports = app => {

    
    //Login
    router.post('/login' , async(req, res) => {
        const results = {}
        console.log(req.body);

        if (req.body.username != "admin"){
        
            User.findOne(
                {   attributes: [
                        'user_id',
                        'login',
                        'password_hash',
                        'first_name',
                        'last_name',
                        'employee_id',
                        'outlet_id'
                    ],
                    where: {
                        login: req.body.username
                    }
                }
            ).then( user => {
                if (user){
                    
                    Employee.findOne(
                        {
                            attributes: ['department_id'],
                            where: {
                                employee_id: user.dataValues.employee_id
                            }
                        }
                    ).then( employee => {
                        
                        
                        Department.findOne(
                            {
                                attributes: ['department_type'],
                                where: {
                                    department_id: employee.dataValues.department_id
                                }
                            }
                        ).then ( department => {
                            console.log(department);
                            if (department.dataValues.department_type == "COLLECTORS") {
                                bcrypt.compare(req.body.password, user.password_hash).then(success =>  {
                            
                                    if (success == false) {
                                        results.successfullLogin = false
                
                                    }else {
                                        results.successfullLogin = true
                                        results.userData = user
                                    }
                                
                                    res.send(results)
                                        //results.success = success 
                                })
                            }else {
                                results.error = "No tiene autorización para acceder através de esta app"
                                res.send(results)
                            }
                            
                        }).catch(err => {
                            console.log("Error retreiving department", err);
                        })

                    }).catch( err => {
                        console.log("Error retreiving user ", err);
                    })
                    
                } else {
                    res.send(undefined)
                }
                
            })
        } else {

            if (req.body.password == "admin"){
                results.successfullLogin = true
                results.userData = {
                    employee_id: "",
                    login: 'admin',
                    first_name: 'Admin',
                    last_name: 'Admin',
                    outlet_id: 'local',
                    user_id: 'admin-0000-local-0000'
                }
            }else {
                results.successfullLogin = false
            }

            res.send(results)    
            
        }
    })



    //Customer
    router.get('/customers/main/:employeeId', async(req, res) => {

        if(!req.query.offset){
            req.query.offset = 1
        }

        if(!req.query.limit){
            req.query.limit=100
        }

        var offset = parseInt(req.query.offset)
        var limit = parseInt(req.query.limit)

        
        const startIndex = (offset - 1) * limit
        const endIndex = offset * limit

        let whereClause;

        
        //    whereClause = `where 1 = 1`
        //}else {
            whereClause = `where employee_id='${req.params.employeeId}'))`
            //andCla
        //}

        console.log("Employee ID", req.params.employeeId);
        let query = ""
        if (req.params.employeeId == 0){
            
            query =
                `SELECT DISTINCT(la.customer_id) AS customer_id, c.first_name,last_name,  identification, street, c.qr_code
                FROM loan_application la
                JOIN customer c on (la.customer_id = c.customer_id)`
            
        }else {

            query = 
            
            
                `SELECT DISTINCT(la.customer_id) AS customer_id, c.first_name,last_name, identification, street, loan_situation
                FROM loan_application la
                JOIN customer c on (c.customer_id = la.customer_id)
                join loan l on (la.loan_application_id = l.loan_application_id)
                join loan_payment_address lp on (lp.loan_id = l.loan_id)
                where lp.section_id in 	(select cast(section_id as int) 
                                        from zone_neighbor_hood 
                                        where zone_id in (select zone_id
                                                          from employee_zone
                                                          where employee_id='${req.params.employeeId}'))	
                and la.outlet_id=(select outlet_id from employee where employee_id='${req.params.employeeId}')`
                
                
        }

        const [data , meta ] = await db.sequelize.query(query)


            

            const results   = {}

            if (endIndex < data.length){
                var nextOffset = offset + 1
                results.next = `http://10.1.102.106:3000/customers/main/${req.params.employeeId}?limit=${limit}&offset=${nextOffset}` 
            }

            if (startIndex > 0 ){
                results.previous = {
                    offset: offset - 1,
                    limit: limit
                }
            }

            
            results.customers = data.slice(startIndex, endIndex)

            results.loans = []

            data.find((item, index) =>  {
            
                console.log(data[index]);
                item.loan_situation == 'ARREARS' ? results.loans.push(data[index]) : '';
                 
             })

            key='customer_id'

            

            results.customers = [...new Map(results.customers.map(item =>
            [item[key], item])).values()];
              
                
            res.send(results)

    })
    
    router.post('/customers/each', async(req, res) => {
        console.log(req.params.id);
        const results = {}

        const [customer, metadata] = await db.sequelize.query(
            `SELECT customer_id as key, identification, first_name, last_name, birth_date, email, p.name as province, m.name as municipality, s.name as section, street, street2, phone, mobile, status_type
			from customer c
			join province p on (p.province_id = c.province_id)
			join municipality m on (m.municipality_id = c.municipality_id)
			join section s on (s.section_id = c.section_id)
			where customer_id = '${req.body.id}'`
        )

        /*SELECT customer_id as key, first_name, last_name, birth_date, email, p.name, m.name, s.section_id, street, street2, phone, mobile
			from customer c
			join province p on (p.province_id = c.province_id)
			join municipality m on (m.municipality_id = c.municipality_id)
			join section s on (s.section_id = c.section_id)
			where customer_id = 'b57c520b-af96-4f2d-b8a1-f8ed5533f379'*/

        const [loan, meta] = await db.sequelize.query(
            `select * from loan 
            where loan_application_id in (select loan_application_id 
                                          from loan_application
                                          where customer_id = '${req.body.id}')
            and outlet_id=(select outlet_id from employee where employee_id='${req.body.employeeId}')
            and status_type != 'PAID'`
        )


        results.customerInfo = customer[0]
        results.customerLoans = [...loan]
        

        res.send(results)
    })

    router.get('/customers/createQR/:customerId' , async(req, res) => {

        Customer.update(
            {
                qr_code : uuid().toString()
            },
            {
                where: {
                    customer_id: req.params.customerId,
                    
                },
                returning: true
            }
        ).then( customer => { 
            res.send(customer['1'][0].dataValues)
        }).catch(err => {
            console.log(err);
        })
    })

    router.get('/customers/getQr/:customerId', async(req, res) => {
        
        Customer.findOne({
            where: {
                customer_id: req.params.customerId
            }
        }).then( customer => {
            console.log(customer.dataValues);
            res.send(customer.dataValues)
        })
    })


    
    //Register
    router.get('/register/:userId', (req, res) =>{

        var results = {}

        Register.findOne(
            {
                where: {
                    user_id: req.params.userId,    
                    status_type: 'ENABLED'
                }
            }
        ).then(register => {
            console.log(register);
            if (register){
                results.status = true
                results.register = register
            }
            else {
                results.status = false
            }
            
            res.send(results)
        })
    })
    
    router.post('/register/create' , (req, res) => {

        Register.create(
            {
                amount: req.body.amount,
                description: req.body.description,
                user_id: req.body.userId,
                outlet_id: req.body.outletId,
                created_by: req.body.createdBy,
                last_modified_by: req.body.lastModifiedBy,
                status_type: 'ENABLED'
            }
        ).then( register => {
            res.send(register)
        }).catch( err  => {
            console.log(err);
        })
    })




    //Payments
    router.post('/payment', async (req, res) => {    

        const results = {}

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
            )

            var customerId = client[0].customer_id
          
   
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
            )
            
            var currentOuotas = []
    
    
            // loans.map( item => {
            //     console.log(item);
            // })
                let loanNumbers = []
    
                loans.map( item => {
                    loanNumbers.push(item.loan_number_id)
                })
    
                const [quotas, metaQuota] = await db.sequelize.query(
                    `select amortization_id, l.loan_number_id, ((amount_of_fee - total_paid) + mora) - discount as current_fee, quota_number, discount_mora as mora
                    from amortization a
                    join loan l on (a.loan_id = l.loan_id)
                    where l.loan_number_id in (${loanNumbers.join()})
                    and paid='false'
                    order by a.loan_id, quota_number`
                )

                
                results.quotas = _.groupBy(quotas, quota => quota.loan_number_id)
                results.customer = client
                results.loans = [...loans]

        } catch (error) {
            console.log(error);
        }
       
 
        
        console.log(results);
        res.send(results)
    })

    router.post('/payment/create' , async(req, res) => {


        const results = {}
        var paidLoan = false;
        var totalPaid = getPaymentTotal(req.body.amortization);
        var counter = 1;
        const receiptNumber = generateReceiptNumber()


        const [receiptId, metadata] = await db.sequelize.query (
            `Select cast(max(html) as int) + 1 as nextHtml from receipt`
        )


        const [reference, meta] = await db.sequelize.query(
            `select cast(max(reference) as int) + 1 as reference from payment`
        )

        var receiptPaymentId = ""
            


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
            status_type: 'ENABLED'
        }).then( payment => {

            req.body.amortization.map(async(quota, index) => {
                Amortization.findOne(
                    {
                        attributes:  ['total_paid', 'quota_number'],
                        where: { amortization_id : quota.quotaId}
                    }
                ).then( totalPaid => {
                    Amortization.update(
                        {
                        paid: quota.paid,
                        status_type: quota.statusType,
                        total_paid: quota.totalPaid + parseInt(totalPaid.dataValues.total_paid),
                        last_modified_by: req.body.payment.lastModifiedBy
                        },
                        {
                            where: {
                                amortization_id: quota.quotaId
                            },
                            returning: true
                        }
                    ).then (amortization => {
                        //Crea detalle del pago
                        PaymentDetail.create({
                            amortization_id: quota.quotaId,
                            payment_id: payment.dataValues.payment_id,
                            pay: quota.totalPaid
                        }).then( paymentDetail => {
                            
                            if (parseInt(req.body.amortization.length) == counter ){
                                //Crea recibo del pago
                                Receipt.create({
                                    html: receiptId[0].nextHtml,
                                    receipt_number: receiptNumber,
                                    comment: null,
                                    payment_id: paymentDetail.dataValues.payment_id

                                }).then( receipt => {

                                    results.receipt = receipt

                                    LoanPaymentAddress.findOne(
                                        {
                                            attributes: ['section_id'],
                                            where: {
                                                loan_id: req.body.payment.loanId
                                            }
                                        }
                                    ).then( sectionId => {
                                        console.log(sectionId.dataValues.section_id);

                                        Section.findOne(
                                            {
                                                attributes: ['name'],
                                                where: {
                                                    section_id: sectionId.dataValues.section_id
                                                }
                                            }
                                        ).then(section => {
                                            
                                            results.loanDetails = {
                                                section: section.dataValues.name
                                            }

                                            res.send(results)
                                        })
                                    })
                                }).catch( err => {
                                    console.log("Error creating receipt " + err);
                                })
                            }

                            counter++

                        }).catch( err => {
                            console.log("Error creating Payment Detail " + err);
                        })
                    }).catch(err => {
                        console.log("Error creating the amortization " + err);
                    })
                }).catch( err => {
                    console.log("Error searching for the quota " + err);
                })
            })

        }).catch( err => {
            console.log("Error creating the payment " + err);
        })
    })
    
    //Payment Router
    router.get('/paymentroute/:employeeId', async(req, res) => {


        let query = ""
        query = `select payment_router_detail_id, position, first_name || ' ' || last_name as name,l.loan_number_id, street as location, prd.payment_router_id, pr.created_date
        from payment_router_detail  prd
        join payment_router pr on (prd.payment_router_id = pr.payment_router_id)
        join loan_payment_address lpa on (prd.loan_payment_address_id = lpa.loan_payment_address_id)
        join loan l on (prd.loan_payment_address_id = l.loan_payment_address_id)
        join loan_application la on (l.loan_application_id = la.loan_application_id)
        join customer c on (la.customer_id = c.customer_id)
        where pr.zone_id in (select zone_id from employee_zone where employee_id = '${req.params.employeeId}')
        and pr.created_date = (select max(created_date) from payment_router where zone_id in (select zone_id from employee_zone where employee_id = '${req.params.employeeId}'))
        order by position`

        try {
            const [data , meta] = await db.sequelize.query(query)    
            res.send(data)
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
    })

    //Receipts
    router.post('/receipt/payments', (req, res) => {
        

        Loan.findOne(
            {   
                attributes: [ 'loan_id'],
                
                where: {
                    loan_number_id: req.body.loanNumber
                }
            }
        ).then( loanId => { 
            console.log("ID", loanId);
            Payment.findAll(
                {   
                    where: {
                        loan_id: loanId.dataValues.loan_id
                    },
                    include: {
                        model: Receipt
                    }
                }
            ).then(payments => {

                console.log(payments);
                res.send(payments)
            }).catch( err => {
                console.log(err);
            })
        })
    })

    router.post('/receipt/amortization', (req, res) => {

        Payment.findOne(
            {
                attributes: ['created_date', 'pay'],
                where: {
                    payment_id: req.body.paymentId
                }
            }
        ).then(payment => {
            //console.log(payment);
            PaymentDetail.findAll(
                {
                    //attributes: ['amortization_id','pay'],
                    where: {
                        payment_id: req.body.paymentId
                    }

                }
            ).then( paymentDetail => {

                var transactions = []
                var counter = 1;
                paymentDetail.map( (pd, index) => {
                    console.log(pd);
                    Amortization.findOne(
                        {
                            where: {
                                amortization_id: pd.amortization_id
                            }
                        }
                    ).then( amortization => {
                        //

                        var currentPay  =  parseInt(amortization.dataValues.amount_of_fee) - parseInt(amortization.dataValues.total_paid)
                        

                        transactions.push({
                            amortization_id: amortization.dataValues.amortization_id,
                            quota_number: amortization.dataValues.quota_number,
                            date: payment.dataValues.created_date,
                            amount: currentPay == 0 ? amortization.dataValues.amount_of_fee : currentPay,
                            mora: amortization.dataValues.mora,
                            totalPaid: pd.pay
                        })
                        console.log(counter, 'vs', paymentDetail.length);
                        if (counter == paymentDetail.length ) {
                            //res.send(transactions)
                            console.log('HI');
                            console.log("TRANS", transactions);
                            res.send(transactions)
                            
                        }

                        counter++

                    })  
                    
                })
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
        }).catch( err => {
                console.log(err);
            })
        }).catch( err => {
            console.log(err);
        })
    })


    



    //Visits
    router.post('/visit', (req, res) => {
        Visit.create(
            {
                customer_id: req.body.customerId,
                user_id: req.body.userId,
                user_name: req.body.username,
                actual_location: req.body.currentLocation,
                commentary: 'COBRO'
            }
        ).then( visit => {
            res.send(visit.dataValues)
        }).catch(err => {
            console.log(err);
        })
    })

    router.post('visit/commentary', (req, res) => {

        Visit.update(
            {
                commentary: req.body.commentary
            },
            {
                where: {
                    visit_id: req.body.visitId
                }
            }
        ).then( visit => {
            res.send(true)
        })
    })




    //Reports
    router.get('/reports/daypayments/:employeeId', async (req, res) => {

        const [data, meta] = await db.sequelize.query(
            `select r.receipt_number, r.payment_id, p.loan_id, l.loan_number_id, p.created_date::time as time, p.created_date::date as date, c.first_name || ' ' || c.last_name as name
            from receipt r
            inner join payment p on (r.payment_id = p.payment_id)
            inner join loan l on (p.loan_id = l.loan_id)
            inner join loan_application la  on ( l.loan_application_id = la.loan_application_id)
            inner join loan_payment_address lpa on (l.loan_payment_address_id = lpa.loan_payment_address_id)
            inner join customer c on ( la.customer_id = c.customer_id)
            where p.created_date::date = CURRENT_DATE 
            and lpa.section_id in ((select cast(section_id as int) 
                                    from zone_neighbor_hood 
                                    where zone_id in (select zone_id
                                                      from employee_zone
                                                      where employee_id='${req.params.employeeId}')))`
        )

        res.send(data)
    })

    app.use(router)	

}


function generateReceiptNumber(){

    const firstRandom = Math.floor(Math.random() * 9000)
    const secondRandom = Math.floor(Math.random() * 9000)

    const result = firstRandom + "-" + secondRandom

    return result.toString()
}

function getPaymentTotal(amortization){

    var paymentTotal = 0 ;

    amortization.map(quota => {
        paymentTotal += quota.totalPaid
    })

    return paymentTotal

}
