module.exports = (sequelize, Sequelize) => {
  const AppAccessControl = sequelize.define(
    "app_access_control",
    {
      app_access_control_id: {
        primaryKey: true,
        allowNull: false,
        defaultValue: Sequelize.UUIDV4,
        type: Sequelize.UUID,
      },
      user_id: {
        type: Sequelize.STRING,
      },
      description: {
        type: Sequelize.STRING,
      },
      mac_address: {
        type: Sequelize.STRING,
      },
      status_type: {
        type: Sequelize.STRING,
        //defaultValue: sequelize.literal('CURRENT_TIMESTAMP')
      },
    },
    {
      schema: "public",
      freezeTableName: true,
      underscored: true,
      timestamps: false,
    }
  );

  return AppAccessControl;
};
