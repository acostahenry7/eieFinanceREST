module.exports = (sequelize, Sequelize) =>  {
    const EmployeeZone = sequelize.define('employee_zone', {
        employee_zone_id: {
            primaryKey: true,
            type: Sequelize.STRING,
            defaultValue: Sequelize.UUIDV4,
            allowNull: false
        },
        zone_id: {
            type: Sequelize.STRING
        },
        employee_id: {
            type: Sequelize.STRING
        },
        status_type: {
            type: Sequelize.STRING
        }
    }, {
        schema: 'public',
        freezeTableName:  true,
        underscored: true,
        timestamps: false
    })

    return EmployeeZone
}