module.exports = (sequelize, Sequelize) => {
    const Register = sequelize.define('register', {
        register_id: {
            primaryKey: true,
            defaultValue: Sequelize.UUIDV4,
            allowNull: false,
            type: Sequelize.STRING,
        },
        amount: {
            type: Sequelize.INTEGER
        },
        description: {
            type: Sequelize.STRING
        },
        user_id: {
            type: Sequelize.STRING
        },
        outlet_id: {
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
        },
        status_type: {
            type: Sequelize.STRING
        },
        total_check: {
            type: Sequelize.INTEGER,
            defaultValue: null
        },
        total_transfer: {
            type: Sequelize.INTEGER,
            defaultValue: null
        },
        total_cash: {
            type: Sequelize.INTEGER,
            defaultValue: null
        },
        total_pay: {
            type: Sequelize.INTEGER,
            defaultValue: null
        },
        total_registered: {
            type: Sequelize.INTEGER,
            defaultValue: null
        }
        
    },{
        schema: 'public',
        freezeTableName:  true,
        underscored: true,
        timestamps: false
    })

    return Register
}