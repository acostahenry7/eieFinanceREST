module.exports = (sequelize, Sequelize) => {
  const GeneralDiaryAccount = sequelize.define(
    "general_diary_account",
    {
      general_diary_account_id: {
        primaryKey: true,
        type: Sequelize.STRING,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
      },
      general_diary_id: {
        type: Sequelize.STRING,
        primaryKey: true,
      },
      account_catalog_id: {
        type: Sequelize.STRING,
      },
      debit: {
        type: Sequelize.INTEGER,
      },
      credit: {
        type: Sequelize.INTEGER,
      },
      status_type: {
        type: Sequelize.STRING,
      },
      created_by: {
        type: Sequelize.STRING,
      },
      created_date: {
        type: Sequelize.DATE,
        defaultValue: sequelize.literal("CURRENT_TIMESTAMP"),
      },
      last_modified_by: {
        type: Sequelize.STRING,
      },
      last_modified_date: {
        type: Sequelize.DATE,
        defaultValue: sequelize.literal("CURRENT_TIMESTAMP"),
      },
      reconcile: {
        type: Sequelize.BOOLEAN,
      },
    },
    {
      schema: "public",
      underscored: true,
      freezeTableName: true,
      timestamps: false,
    }
  );

  return GeneralDiaryAccount;
};
