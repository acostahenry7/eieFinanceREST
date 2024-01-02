module.exports = (sequelize, Sequelize) => {
  const GeneralDiaryNumber = sequelize.define(
    "general_diary_number",
    {
      general_diary_number_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        allowNull: false,
      },
    },
    {
      schema: "public",
      underscored: true,
      freezeTableName: true,
      timestamps: false,
    }
  );

  return GeneralDiaryNumber;
};
