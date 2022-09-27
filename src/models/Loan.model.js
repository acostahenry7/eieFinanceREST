module.exports = (sequelize, Sequelize) => {
  const Loan = sequelize.define(
    "loan",
    {
      loan_id: {
        type: Sequelize.UUID,
        primaryKey: true,
      },
      loan_situation: {
        type: Sequelize.STRING,
      },
      loan_number_id: {
        type: Sequelize.INTEGER,
      },
      loan_application_id: {
        type: Sequelize.INTEGER,
      },
      status_type: {
        type: Sequelize.STRING,
      },
      loan_payment_address_id: {
        type: Sequelize.STRING,
      },
    },
    {
      schema: "public",
      underscored: true,
      freezeTableName: true,
      timestamps: false,
    }
  );

  return Loan;
};
