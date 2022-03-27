module.exports = (sequelize, Sequelize) => {
    const Visit = sequelize.define('collector_customer_visits', {
        visit_id: {
            primaryKey: true,
            allowNull: false,
            defaultValue: Sequelize.UUIDV4,
            type: Sequelize.UUID,
        },
        customer_id: {
            type: Sequelize.STRING
        },
        user_id: {
            type: Sequelize.STRING
        },
        user_name: {
            type: Sequelize.STRING
        },
        actual_location: {
            type: Sequelize.STRING
        },
        visit_date: {
            type: Sequelize.DATE,
            defaultValue: sequelize.literal('CURRENT_TIMESTAMP')
        },
        commentary: {
            type: Sequelize.STRING
        }
    },{
        schema: 'public',
        freezeTableName:  true,
        underscored: true,
        timestamps: false
    })

    return Visit
}