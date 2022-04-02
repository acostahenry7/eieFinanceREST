module.exports = (sequelize, Sequelize) => {
    const Outlet = sequelize.define('outlet',{
        outlet_id: {
        type: Sequelize.UUID,
        primaryKey: true 
        },
        name: {
            type: Sequelize.STRING
        },
        rnc: {
            type: Sequelize.STRING
        }
    },{
        schema: 'public',
        underscored: true,
        freezeTableName: true,
        timestamps: false
    })

    return Outlet
}