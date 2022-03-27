
const { engine } = require('express-handlebars')
const path = require('path');
const routes = require('../routes')
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');





module.exports = app =>{
    //Listenin Port
    app.set('port', process.env.PORT || 3000)

    //Middlewares
    app.use(session({secret: "eiesecret"}));
    app.use(bodyParser.urlencoded({extended: true}));
    app.use(express.urlencoded({extended: false}));
    app.use(express.json());
    //app.use(cookieParser());
    //app.use(cors(corsOptions))

    //Routes
    routes(app)
    

    return app;
}
