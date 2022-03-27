module.exports = (sequelize, Sequelize) => {
    const Receipt = sequelize.define('receipt', {
        receipt_id: {
            primaryKey: true, 
            type: Sequelize.STRING,
            defaultValue: Sequelize.UUIDV4,
            allowNull: false
        },
        html: {
            type: Sequelize.STRING
        },
        receipt_number: {
            type: Sequelize.STRING
        },
        comment: {
            type: Sequelize.STRING
        },
        payment_id: {
            type: Sequelize.STRING
        }
    },{
        schema: 'public',
        freezeTableName:  true,
        underscored: true,
        timestamps: false
    })

    return Receipt
}