module.exports = (sequelize, Sequelize) => {
  const PaymentRouterDetail = sequelize.define(
    "payment_router_detail",
    {
      payment_router_detail_id: {
        primaryKey: true,
        type: Sequelize.STRING,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
      },
      status_type: {
        type: Sequelize.STRING,
      },
      payment_router_id: {
        type: Sequelize.STRING,
      },
      loan_payment_address_id: {
        type: Sequelize.STRING,
      },
      position: {
        type: Sequelize.INTEGER,
      },
      customer_id: {
        type: Sequelize.STRING,
      },
      loan_id: {
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

  return PaymentRouterDetail;
};
