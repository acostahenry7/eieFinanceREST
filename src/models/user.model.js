module.exports = (sequelize, Sequelize) => {
    const User = sequelize.define('jhi_user', {
        user_id: {
            type: Sequelize.STRING
        },
        login: {
            type: Sequelize.STRING
        },
        password_hash: {
            type: Sequelize.STRING
        },
        first_name: {
            type: Sequelize.STRING
        },
        last_name: {
            type: Sequelize.STRING
        },
        employee_id: {
            type: Sequelize.STRING
        },
        outlet_id: {
            type: Sequelize.STRING
        }    
    },{
        schema: 'public',
        freezeTableName:  true,
        underscored: true,
        timestamps: false
    })

    return User
}