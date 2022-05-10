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
        type: Sequelize.INTEGER,
      },
      payment_date: {
        type: Sequelize.DATE,
      },
      amount: {
        type: Sequelize.INTEGER,
      },
      mora: {
        type: Sequelize.INTEGER,
      },
      discount: {
        type: Sequelize.INTEGER,
      },
      discount_interest: {
        type: Sequelize.INTEGER,
      },
      discount_mora: {
        type: Sequelize.INTEGER,
      },
      total_paid: {
        type: Sequelize.INTEGER,
      },
      cashback: {
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
