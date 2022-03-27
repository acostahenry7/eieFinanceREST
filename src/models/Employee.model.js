module.exports = (sequelize, Sequelize) => {
    const Employee = sequelize.define('employee', {
        employee_id: {
            primaryKey: true,
            type: Sequelize.STRING,
            defaultValue: Sequelize.UUIDV4,
            allowNull: false
        },
        department_id: {
            type: Sequelize.STRING
        },
        employee_id: {
            type: Sequelize.STRING
        }
    },{
        schema: 'public',
        freezeTableName:  true,
        underscored: true,
        timestamps: false
    })

    return Employee
}