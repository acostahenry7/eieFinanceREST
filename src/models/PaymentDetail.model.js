module.exports = (sequelize, Sequelize) => {
    const PaymentDetail = sequelize.define('payment_detail', {
        payment_detail_id: {
            primaryKey: true, 
            type: Sequelize.STRING,
            defaultValue: Sequelize.UUIDV4,
            allowNull: false
        },
        amortization_id: {
            type: Sequelize.STRING
        },
        payment_id: {
            type: Sequelize.STRING
        },
        pay: {
            type: Sequelize.STRING
        }
    },{
        schema: 'public',
        freezeTableName:  true,
        underscored: true,
        timestamps: false
    })

    return PaymentDetail
}