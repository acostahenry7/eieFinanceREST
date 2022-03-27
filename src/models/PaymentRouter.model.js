module.exports = (sequelize, Sequelize) => {
    const PaymentRouter = sequelize.define('payment_router', {
        payment_router_id: {
            primaryKey: true, 
            type: Sequelize.STRING,
            defaultValue: Sequelize.UUIDV4,
            allowNull: false
        },
        status_type: {
            type: Sequelize.STRING
        },
        outlet_id: {
            type: Sequelize.STRING
        },
        zone_id: {
            type: Sequelize.STRING
        },
        created_by: {
            type: Sequelize.STRING
        },
        created_date: {
            type: Sequelize.DATE,
            defaultValue: Sequelize.NOW
        },
        last_modified_by: {
            type: Sequelize.STRING
        },
        last_modified_date: {
            type: Sequelize.DATE,
            defaultValue: Sequelize.NOW
        }
    },{
        schema: 'public',
        freezeTableName:  true,
        underscored: true,
        timestamps: false
    })

    return PaymentRouter
}