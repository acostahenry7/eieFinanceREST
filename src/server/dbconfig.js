//Conexión prara finance web

// module.exports = {
//   host: "10.202.5.39",
//   user: "webadmin",
//   password: "EDJKNOSOj6",
//   db: "finance",
//   dialect: "postgres",
//   pool: {
//     max: 10,
//     min: 0,
//     acquire: 30000,
//     idle: 10000,
//   },
// };

//Conexión para finance local

module.exports = {
  host: "localhost",
  user: "postgres",
  password: "postgres",
  db: "finance",
  dialect: "postgres",
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
};
