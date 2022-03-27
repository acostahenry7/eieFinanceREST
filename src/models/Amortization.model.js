module.exports = (sequelize, Sequelize) => {
    const Amortization = sequelize.define('amortization', {
        amortization_id: {
            primaryKey: true, 
            type: Sequelize.STRING,
            defaultValue: Sequelize.UUIDV4,
            allowNull: false
        },
        last_modified_by: {
            type: Sequelize.STRING
        },
        amount_of_fee: {
            type: Sequelize.DOUBLE
        },
        mora: {
            type: Sequelize.DOUBLE
        },
        discount: {
            type: Sequelize.DOUBLE
        },
        quota_number: {
            type: Sequelize.INTEGER
        },
        paid: {
            type: Sequelize.BOOLEAN
        },
        status_type: {
            type: Sequelize.STRING
        },
        total_paid: {
            type: Sequelize.DOUBLE
        }
    },{
        schema: 'public',
        freezeTableName:  true,
        underscored: true,
        timestamps: false
    })

    return Amortization
}