module.exports = (sequelize, Sequelize) => {
    const Department = sequelize.define('department', {
        department_id: {
            primaryKey: true,
            type: Sequelize.STRING,
            defaultValue: Sequelize.UUIDV4,
            allowNull: false
        },
        department_type: {
            type: Sequelize.STRING
        }
    },{
        schema: 'public',
        freezeTableName:  true,
        underscored: true,
        timestamps: false
    })

    return Department
}