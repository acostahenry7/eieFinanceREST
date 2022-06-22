module.exports = (sequelize, Sequelize) => {
  const Payment = sequelize.define(
    "payment",
    {
      payment_id: {
        primaryKey: true,
        type: Sequelize.STRING,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
      },
      pay: {
        type: Sequelize.INTEGER,
      },
      loan_id: {
        type: Sequelize.STRING,
      },
      customer_id: {
        type: Sequelize.STRING,
      },
      payment_type: {
        type: Sequelize.STRING,
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
      reference: {
        type: Sequelize.INTEGER,
      },
      employee_id: {
        type: Sequelize.STRING,
      },
      outlet_id: {
        type: Sequelize.STRING,
      },
      comment: {
        type: Sequelize.STRING,
      },
      register_id: {
        type: Sequelize.STRING,
      },
      reference_bank: {
        type: Sequelize.STRING,
      },
      bank: {
        type: Sequelize.STRING,
      },
      pay_off_loan_discount: {
        type: Sequelize.INTEGER,
      },
      pay_off_loan: {
        type: Sequelize.BOOLEAN,
      },
      status_type: {
        type: Sequelize.STRING,
      },
      capital_subscription: {
        type: Sequelize.BOOLEAN,
      },
      payment_origin: {
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

  return Payment;
};
