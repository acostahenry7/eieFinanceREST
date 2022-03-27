module.exports = (sequelize, Sequelize) => {
    const LoanApplication = sequelize.define('loan_application',{
         loan_application_id: {
            type: Sequelize.UUID,
            primaryKey: true 
         },
         customer_id: {
             type: Sequelize.UUID
         }
    },{
        schema: 'public',
        underscored: true,
        freezeTableName: true,
        timestamps: false
    })

    return LoanApplication
}