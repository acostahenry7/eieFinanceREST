module.exports = (sequelize, Sequelize) => {
  const ProcessNcf = sequelize.define(
    "process_ncf",
    {
      process_ncf_id: {
        primaryKey: true,
        type: Sequelize.STRING,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
      },
      status_type: {
        type: Sequelize.STRING,
      },
      ncf_number: {
        type: Sequelize.STRING,
      },
      payment_id: {
        type: Sequelize.STRING,
      },
      outlet_id: {
        type: Sequelize.STRING,
      },
      ncf_type_id: {
        type: Sequelize.INTEGER,
      },
      created_by: {
        type: Sequelize.STRING,
      },
      created_date: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
      last_modified_by: {
        type: Sequelize.STRING,
      },
      last_modified_date: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
    },
    {
      schema: "public",
      underscored: true,
      freezeTableName: true,
      timestamps: false,
    }
  );

  return ProcessNcf;
};
