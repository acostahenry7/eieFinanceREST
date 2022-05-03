module.exports = (sequelize, Sequelize) => {
  const User = sequelize.define(
    "jhi_user",
    {
      user_id: {
        type: Sequelize.STRING,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
        primaryKey: true,
      },
      login: {
        type: Sequelize.STRING,
      },
      password_hash: {
        type: Sequelize.STRING,
      },
      first_name: {
        type: Sequelize.STRING,
      },
      last_name: {
        type: Sequelize.STRING,
      },
      employee_id: {
        type: Sequelize.STRING,
      },
      router_restriction: {
        type: Sequelize.INTEGER,
      },
      outlet_id: {
        type: Sequelize.STRING,
      },
    },
    {
      schema: "public",
      freezeTableName: true,
      underscored: true,
      timestamps: false,
    }
  );

  return User;
};
