module.exports = (sequelize, Sequelize) => {
    const LoanPaymentAddress = sequelize.define('loan_payment_address', {
        loan_payment_address_id: {
            primaryKey: true,
            type: Sequelize.STRING,
            defaultValue: Sequelize.UUIDV4,
            allowNull: false
        },
        loan_id: {
            type: Sequelize.STRING
        },
        province: {
            type: Sequelize.STRING
        },
        municipality_id: {
            type: Sequelize.STRING
        },
        section_id: {
            type: Sequelize.STRING
        },
        payment_address_type: {
            type: Sequelize.STRING
        }
    },{
        schema: 'public',
        freezeTableName:  true,
        underscored: true,
        timestamps: false
    })

    return LoanPaymentAddress
}