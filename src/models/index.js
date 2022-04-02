const { Sequelize } = require('sequelize')
const config = require('../server/dbconfig.js')


const sequelize = new Sequelize(
    config.db,
    config.user,
    config.password,
    {
        host: config.host,
        dialect: config.dialect,
        operatorsAliases: false,
        
        pool: {
            max: config.pool.max,
            min: config.pool.min,
            acquire: config.pool.acquire,
            idle: config.pool.idle
        }
    }
)

const db ={}

db.Sequelize = Sequelize
db.sequelize = sequelize

db.customer = require('../models/customer.model')(sequelize, Sequelize)
db.loan = require('../models/Loan.model')(sequelize, Sequelize)
db.loanApplication = require('../models/LoanApplication.model')(sequelize, Sequelize)
db.loanPaymentAddress = require('./LoanPaymentAddress.model')(sequelize, Sequelize)
db.payment = require('./Payment.model')(sequelize, Sequelize)
db.paymentDetail = require('../models/PaymentDetail.model')(sequelize, Sequelize)
db.register = require('./Register.model')(sequelize, Sequelize)
db.user = require('../models/user.model')(sequelize, Sequelize)
db.receipt = require('./Receipt.model')(sequelize, Sequelize)
db.amortization = require('../models/Amortization.model')(sequelize, Sequelize)
db.employee = require('../models/Employee.model')(sequelize, Sequelize)
db.employeeZone = require('../models/EmployeeZone.model')(sequelize, Sequelize)
db.department = require('../models/Department.model')(sequelize, Sequelize)
db.visit = require('../models/collectorCustomerVisit')(sequelize, Sequelize)
db.section =  require('../models/Section.model')(sequelize, Sequelize)
db.paymentRouter = require('../models/PaymentRouter.model')(sequelize, Sequelize)
db.paymentRouterDetail = require('../models/PaymentRouterDetail.model')(sequelize, Sequelize)
db.outlet = require('../models/Outlet.model')(sequelize, Sequelize)

db.loanApplication.belongsTo(db.customer,{
    foreignKey: 'customer_id'
})
db.customer.hasOne(db.loanApplication,{
    foreignKey: 'customer_id'
})


// db.paymentRouterDetail.hasMany(db.loan, {
//     foreignKey: 'loan_payment_address_id'
// })

// db.loan.belongsToMany(db.paymentRouterDetail, {
//     through: db.paymentDetail,
//     foreignKey: 'loan_payment_address_id'
// })


// db.paymentDetail.hasMany(db.amortization, {
//     foreignKey: 'amortization_id'
    
// })

// db.amortization.belongsToMany(db.payment, {
//      through: db.paymentDetail,
//      foreignKey: 'payemnt_id'
// })




db.payment.hasOne(db.receipt, {
    foreignKey: 'payment_id'
})
db.receipt.belongsTo(db.payment, {
    foreignKey: 'payment_id'
})

module.exports = db
