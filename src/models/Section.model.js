module.exports = (sequelize, Sequelize) => {
    const Section = sequelize.define('section', {
        section_id: {
            primaryKey: true,
            type: Sequelize.INTEGER,
            allowNull: false
        },
        code: {
            type: Sequelize.STRING
        },
        name: {
            type: Sequelize.STRING
        },
        description: {
            type: Sequelize.STRING
        },
        municipality_id: {
            type: Sequelize.STRING
        }
    },{
        schema: 'public',
        freezeTableName:  true,
        underscored: true,
        timestamps: false
    })

    return Section
}