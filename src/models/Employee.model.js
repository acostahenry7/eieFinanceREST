module.exports = (sequelize, Sequelize) => {
  const Employee = sequelize.define(
    "employee",
    {
      employee_id: {
        primaryKey: true,
        type: Sequelize.STRING,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
      },
      first_name: {
        type: Sequelize.STRING,
      },
      last_name: { type: Sequelize.STRING },
      street: {
        type: Sequelize.STRING,
      },
      street2: {
        type: Sequelize.STRING,
      },
      department_id: {
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

  return Employee;
};
