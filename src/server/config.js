const { engine } = require("express-handlebars");
const path = require("path");
const routes = require("../routes");
const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");
const multer = require("multer");
const fs = require("fs");

module.exports = (app) => {
  //Listenin Port
  app.set("port", process.env.PORT || 3001);

  //Middlewares
  app.use(session({ secret: "eiesecret" }));
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());
  //app.use(cookieParser());
  //app.use(cors(corsOptions))

  //Midlewares
  app.use(bodyParser.json());

  const storage = multer.diskStorage({
    destination(req, res, cb) {
      console.log(req.body);
      const route = path.join(
        __dirname,
        `../assets/profile/${req.body.fileName.split("_")[0]}`
      );
      fs.rmSync(route, { recursive: true, force: true });
      fs.mkdirSync(route, { recursive: true });
      cb(null, route);
    },

    filename(req, file, cb) {
      const filename = `${req.body.fileName}`;
      //fs.unlinkSync(path.join(__dirname, `../assets/profile/${req.body.fileName.split('_')[0]}`))
      cb(null, filename);
    },
  });

  //Routes
  routes(app, storage);

  app.use("/assets", express.static(path.join(__dirname, "../assets")));

  return app;
};
