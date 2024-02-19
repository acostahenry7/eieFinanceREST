module.exports = (sequelize, Sequelize) => {
  const GeneralDiary = sequelize.define(
    "general_diary",
    {
      general_diary_id: {
        primaryKey: true,
        type: Sequelize.STRING,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
      },
      general_diary_number_id: {
        type: Sequelize.INTEGER,
      },
      general_diary_type: {
        type: Sequelize.STRING,
      },
      description: {
        type: Sequelize.STRING,
      },
      comment: {
        type: Sequelize.STRING,
      },
      total: {
        type: Sequelize.INTEGER,
      },
      status_type: {
        type: Sequelize.STRING,
      },
      created_by: {
        type: Sequelize.STRING,
      },
      general_diary_date: {
        type: Sequelize.DATE,
        defaultValue: sequelize.literal("CURRENT_TIMESTAMP"),
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
      outlet_id: {
        type: Sequelize.STRING,
      },
      account_number_id: {
        type: Sequelize.STRING,
      },
      payment_id: {
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

  return GeneralDiary;
};
