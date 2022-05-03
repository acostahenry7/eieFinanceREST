module.exports = (sequelize, Sequelize) => {
  const ReceiptTransaction = sequelize.define(
    "receipt_transaction",
    {
      receipt_transaction_id: {
        primaryKey: true,
        type: Sequelize.STRING,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
      },
      receipt_id: {
        type: Sequelize.STRING,
      },
      quota_number: {
        type: Sequelize.DOUBLE,
      },
      payment_date: {
        type: Sequelize.DATE,
      },
      amount: {
        type: Sequelize.DOUBLE,
      },
      mora: {
        type: Sequelize.DOUBLE,
      },
      discount: {
        type: Sequelize.DOUBLE,
      },
      discount_interest: {
        type: Sequelize.DOUBLE,
      },
      discount_mora: {
        type: Sequelize.DOUBLE,
      },
      total_paid: {
        type: Sequelize.DOUBLE,
      },
    },
    {
      schema: "public",
      freezeTableName: true,
      underscored: true,
      timestamps: false,
    }
  );

  return ReceiptTransaction;
};
